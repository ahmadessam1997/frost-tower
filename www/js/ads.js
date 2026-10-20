/* =====================================================================
   Frost Tower — ads (AdMob)
   ---------------------------------------------------------------------
   Four formats, each deliberately placed:
     interstitial  after a game over, every Nth *real* run, with a
                   cooldown. Never mid-run — this game's runs are ~30s and
                   an interrupt would destroy the flow.
     rewarded      always opt-in: revive a run once, or earn coins in the
                   shop.
     rewarded      the SAME between-runs seam, never an extra break:
      interstitial every Nth seam ad is served as this format instead of
                   the plain one. Pays more and grants snowflakes, so the
                   interruption is worth more to both sides. Either format
                   fills the seam when the other is not loaded.
     banner        menu and game-over card only, taken down before a run
                   starts — a bottom strip sits exactly where the next
                   jump is judged from.

   The run counter and the seam-ad count are persisted in FTSave
   (adRuns / seamAds), so the cadence carries across cold starts.

   Remove Ads silences ALL FOUR, the opt-in rewarded video included.

   Google's UMP consent flow runs BEFORE initialize(), so the first ad
   request never goes out under an unknown consent state. It requires a
   matching message in AdMob → Privacy & messaging; without one the SDK
   reports no form available and we carry on serving regardless.

   Ads are fire-and-forget: every entry point resolves rather than
   rejecting, because a failed ad load must never block the player from
   restarting. In the browser everything no-ops and reports "not shown".
   ===================================================================== */
(function (global) {
  'use strict';

  var Cfg = global.FTConfig;

  /* How long showInterstitial() may sit without the ad ever opening
     before the seam gives up and lets the player carry on. */
  var SHOW_TIMEOUT_MS = 8000;

  function track(name, params) {
    if (global.FTAnalytics) global.FTAnalytics.log(name, params);
  }

  var Ads = {
    available: false,
    removeAdsOwned: false,
    _interstitialReady: false,
    _rewardedReady: false,
    /* ONE counter and ONE clock for BOTH full-screen seam formats.
       Separate state would let the two line up and fire back to back. */
    _lastInterstitialAt: 0,
    _runsSinceAd: 0,
    _seamAdsShown: 0,                // picks the format: every Nth seam ad is rewarded
    _seamBusy: false,                // re-entry guard, see showSeamAd
    _rewardedInterstitialReady: false,
    _earnedRIReward: false,
    /* _bannerShown tracks whether an ad VIEW exists, _bannerWanted whether
       the current screen wants one. They diverge whenever the SDK tears a
       banner down on its own (failed refresh, ad view reaped under memory
       pressure), which is exactly when calling resumeBanner() would throw
       instead of re-showing. */
    _bannerShown: false,
    _bannerWanted: false,

    init: function () {
      var self = this;
      if (!Cfg.isNative()) {
        console.info('[ads] Browser preview — ads disabled.');
        return Promise.resolve(false);
      }
      var AdMob = global.Capacitor.Plugins.AdMob;
      if (!AdMob) {
        console.warn('[ads] AdMob plugin missing.');
        return Promise.resolve(false);
      }
      self._m = AdMob;

      var testDevices = (Cfg.admob.testDeviceIds || []).filter(Boolean);

      /* Consent BEFORE initialize. Google's UMP flow has to resolve first
         so the SDK knows whether it may request personalised ads at all;
         running it afterwards means the first ad request goes out under
         an unknown consent state. Never rejects — a consent failure must
         not cost the player their ads *or* their game. */
      return self._requestConsent(testDevices).then(function () {
        return self._requestTracking();
      }).then(function () {
        return AdMob.initialize({
          /* The plugin IGNORES testingDevices unless this flag is true
             (AdMob.java: initializeForTesting ? getArray(...) : EMPTY), so it
             has to be on whenever we have a device list — even though the ad
             unit IDs are real. It is not a global test switch: all it does is
             feed RequestConfiguration.setTestDeviceIds(), so listed devices
             get test ads and every other device still gets real ones. */
          initializeForTesting: !!Cfg.admob.isTest || testDevices.length > 0,
          testingDevices: testDevices,
          // The game is rated Everyone and appears in family-friendly
          // searches; tagging keeps it out of behaviourally-targeted and
          // age-inappropriate ad inventory.
          tagForChildDirectedTreatment: false,
          tagForUnderAgeOfConsent: false,
          /* MUST be one of the plugin's exact enum strings — General,
             ParentalGuidance, Teen, MatureAudience. This said 'G', which
             matches no case in the Android switch, so the rating silently
             stayed UNSPECIFIED and ad requests carried no content cap at all.
             Harmless while the test ad units were in use (they always serve
             the same house ads); a real problem the moment real units went
             live on an Everyone-rated game. */
          maxAdContentRating: 'General'
        });
      }).then(function () {
        self.available = true;
        self._wireListeners();
        /* Only warm the cache if the SDK says we may actually request
           ads. Preloading under a REQUIRED-but-unanswered consent state
           burns a request that comes back empty and leaves _ready false
           anyway. */
        if (self.canRequestAds) {
          self.preloadInterstitial();
          self.preloadRewarded();
          self.preloadRewardedInterstitial();
        } else {
          console.info('[ads] canRequestAds=false — not preloading.');
        }
        return true;
      }).catch(function (e) {
        console.warn('[ads] initialize failed:', e);
        return false;
      });
    },

    /* The ad unit id for `key` on THIS platform (config.js adUnit():
       Android ids on Android and in the browser, admob.ios on iOS).
       '' means that format is off. Trimmed, because an id pasted out of
       the AdMob console arrives with whitespace often enough to matter. */
    _unit: function (key) {
      if (Cfg.adUnit) return Cfg.adUnit(key);   // per-platform (config.js)
      var id = (Cfg.admob && Cfg.admob[key]) || '';
      return (typeof id === 'string') ? id.trim() : '';
    },

    /* iOS only: App Tracking Transparency. Asked AFTER the UMP consent
       flow (Google's recommended order) and BEFORE initialize, so the
       first ad request already knows whether the IDFA may be used. A
       refusal or an error never stops ads: they run non-personalised. */
    _requestTracking: function () {
      var m = this._m;
      if (!Cfg.isIOS || !Cfg.isIOS() || !m || !m.requestTrackingAuthorization) {
        return Promise.resolve();
      }
      return Promise.resolve()
        .then(function () { return m.trackingAuthorizationStatus ? m.trackingAuthorizationStatus() : null; })
        .then(function (s) {
          if (s && s.status && s.status !== 'notDetermined') return null;
          return m.requestTrackingAuthorization();
        })
        .catch(function (e) { console.warn('[ads] ATT request failed:', e); });
    },

    /* ------------------------------------------------------------------
       UMP consent. Resolves ALWAYS — the caller continues to initialize()
       whatever happens here.

       `canRequestAds` is the only field worth branching on. It is true
       when consent was obtained, when consent was never required (most of
       the world), and when the user accepted a limited-ads path; false
       only when a form is genuinely outstanding. Defaults to true so a
       consent *failure* degrades to the previous behaviour rather than
       silently switching ads off everywhere.
       ------------------------------------------------------------------ */
    canRequestAds: true,
    consentStatus: 'UNKNOWN',
    privacyOptionsRequired: false,

    _requestConsent: function (testDevices) {
      var self = this, m = self._m;
      var cc = (Cfg.admob && Cfg.admob.consent) || {};

      if (cc.enabled === false) {
        console.info('[ads] consent flow disabled by config.');
        return Promise.resolve();
      }
      if (!m.requestConsentInfo) {
        console.warn('[ads] plugin has no consent API — update the plugin.');
        return Promise.resolve();
      }

      return m.requestConsentInfo({
        /* NUMBER, not a string — AdConsentExecutor reads it with
           call.getInt(). 0 = DISABLED. */
        debugGeography: cc.debugGeography || 0,
        /* Hashed SDK ids, the same ones setTestDeviceIds wants. */
        testDeviceIdentifiers: testDevices || [],
        tagForUnderAgeOfConsent: false
      })
        .then(function (info) {
          self._applyConsent(info);
          /* A form is only shown when one is actually available AND the
             user still owes an answer. Showing it unconditionally would
             re-prompt on every cold start. */
          if (info && info.isConsentFormAvailable && info.status === 'REQUIRED') {
            return m.showConsentForm().then(function (after) {
              self._applyConsent(after);
            });
          }
          return null;
        })
        .catch(function (e) {
          /* The commonest cause here is NO MESSAGE CONFIGURED in the
             AdMob console — the SDK reports no form available, or errors
             outright. That is a dashboard problem, not a code one, and it
             must not take the game's ads down with it. */
          console.warn('[ads] consent failed (is a message configured in ' +
            'AdMob → Privacy & messaging?):', e && (e.message || e));
        });
    },

    _applyConsent: function (info) {
      if (!info) return;
      if (typeof info.canRequestAds === 'boolean') {
        this.canRequestAds = info.canRequestAds;
      }
      if (info.status) this.consentStatus = info.status;
      this.privacyOptionsRequired =
        info.privacyOptionsRequirementStatus === 'REQUIRED';
      console.info('[ads] consent status=' + this.consentStatus +
        ' canRequestAds=' + this.canRequestAds +
        ' privacyOptions=' + this.privacyOptionsRequired);
    },

    /* Regulators require a persistent way to CHANGE a consent choice, not
       just make it once. Surface this from the shop/settings only when
       privacyOptionsRequired is true — Google hides the entry point
       otherwise, and a dead button is worse than no button. */
    showPrivacyOptions: function () {
      var self = this, m = self._m;
      if (!m || !m.showPrivacyOptionsForm) {
        return Promise.resolve({ ok: false });
      }
      return m.showPrivacyOptionsForm()
        .then(function () { return { ok: true }; })
        .catch(function (e) {
          console.warn('[ads] privacy options form:', e && (e.message || e));
          return { ok: false };
        });
    },

    _wireListeners: function () {
      var self = this;
      var m = self._m;
      try {
        m.addListener('interstitialAdLoaded', function () { self._interstitialReady = true; });
        m.addListener('interstitialAdFailedToLoad', function () { self._interstitialReady = false; });
        /* The ad is genuinely on screen, so the wedge timer in
           _showInterstitial has done its job. Without this a player who
           watched for longer than the timeout had the next run started
           underneath the ad. */
        m.addListener('interstitialAdShowed', function () {
          if (self._onInterstitialShowed) { var f = self._onInterstitialShowed; self._onInterstitialShowed = null; f(); }
        });
        m.addListener('interstitialAdDismissed', function () {
          self._interstitialReady = false;
          self.preloadInterstitial();          // always have the next one warm
          if (self._onInterstitialClosed) { var f = self._onInterstitialClosed; self._onInterstitialClosed = null; f(); }
        });
        m.addListener('interstitialAdFailedToShow', function () {
          self._interstitialReady = false;
          // Nothing was shown, so the seam's cadence must be handed back.
          if (self._onInterstitialFailed) { var f = self._onInterstitialFailed; self._onInterstitialFailed = null; f(); }
          self.preloadInterstitial();
        });

        m.addListener('onRewardedVideoAdLoaded', function () { self._rewardedLoading = false; self._rewardedReady = true; });
        m.addListener('onRewardedVideoAdFailedToLoad', function () { self._rewardedLoading = false; self._rewardedReady = false; });
        m.addListener('onRewardedVideoAdReward', function () { self._earnedReward = true; });
        m.addListener('onRewardedVideoAdDismissed', function () {
          self._rewardedReady = false;
          self.preloadRewarded();
        });

        m.addListener('onRewardedInterstitialAdLoaded', function () { self._riLoading = false; self._rewardedInterstitialReady = true; });
        m.addListener('onRewardedInterstitialAdFailedToLoad', function () { self._riLoading = false; self._rewardedInterstitialReady = false; });
        m.addListener('onRewardedInterstitialAdReward', function () { self._earnedRIReward = true; });
        m.addListener('onRewardedInterstitialAdDismissed', function () {
          self._rewardedInterstitialReady = false;
          self.preloadRewardedInterstitial();
        });

        m.addListener('bannerAdLoaded', function () {
          self._bannerShown = true;
          if (!self._bannerLogged) { self._bannerLogged = true; track('ad_shown', { format: 'banner' }); }
        });
        m.addListener('bannerAdFailedToLoad', function () { self._bannerShown = false; self._setBannerInset(0); });
        /* The banner overlays the WebView rather than resizing it, so the
           cards are told how much of the bottom edge it has taken and pad
           themselves clear of it (--banner-h in index.html). */
        m.addListener('bannerAdSizeChanged', function (sz) {
          self._bannerHeight = (sz && sz.height > 0) ? Math.round(sz.height) : 0;
          if (self._bannerWanted) self._setBannerInset(self._bannerHeight);
        });
      } catch (e) { console.warn('[ads] listeners:', e); }
    },

    /* Remove Ads means EXACTLY that: every format goes silent for that
       player — banner, interstitial, rewarded interstitial AND the opt-in
       rewarded video. Changed 2026-09-20 at the owner's instruction; the
       earlier design deliberately kept rewarded videos alive as the only
       free coin faucet, so anything that OFFERS one now has to hide
       rather than fail. Every caller already gates on rewardedAvailable(),
       which is why suppressing it there is enough. */
    setRemoveAds: function (owned) {
      this.removeAdsOwned = !!owned;
      /* Take the banner down NOW, not at the next screen change. The
         purchase happens in the shop with the banner on screen directly
         beneath it; leaving it up until the player navigates away reads
         as the purchase having failed. */
      if (this.removeAdsOwned) this.removeBanner();
    },

    preloadInterstitial: function () {
      var self = this;
      if (!self.available || self.removeAdsOwned) return Promise.resolve();
      return self._m.prepareInterstitial({ adId: self._unit('interstitialId') })
        .then(function () { self._interstitialReady = true; })
        .catch(function (e) { self._interstitialReady = false; console.warn('[ads] preload interstitial:', e); });
    },

    preloadRewarded: function () {
      var self = this;
      if (!self.available || self.removeAdsOwned) return Promise.resolve();
      if (self._rewardedLoading) return Promise.resolve();
      self._rewardedLoading = true;
      return self._m.prepareRewardVideoAd({ adId: self._unit('rewardedId') })
        .then(function () { self._rewardedLoading = false; self._rewardedReady = true; })
        .catch(function (e) { self._rewardedLoading = false; self._rewardedReady = false; console.warn('[ads] preload rewarded:', e); });
    },

    /* A rewarded video is otherwise only re-requested after one has been
       SHOWN, so a single "No fill" (seen on the 1.2.0 emulator check) took
       revive and double off every game-over card for the rest of the
       session. game.js calls this at each game over, the same way
       showSeamAd re-warms an interstitial that was due but empty. */
    warmRewarded: function () {
      if (!this._rewardedReady) this.preloadRewarded();
    },

    /* The cadence lives in the save file so it survives a cold start.
       game.js calls this once FTSave.load() has resolved; runs counted
       while the save was still loading are kept, not overwritten. */
    loadCadence: function () {
      var S = global.FTSave;
      if (!S || !S.data) return;
      this._runsSinceAd += (S.data.adRuns | 0);
      this._seamAdsShown += (S.data.seamAds | 0);
    },

    _persistCadence: function () {
      var S = global.FTSave;
      if (!S || !S.data) return;
      S.data.adRuns = this._runsSinceAd;
      S.data.seamAds = this._seamAdsShown;
      try { S.save(); } catch (e) {}
    },

    /* Called once per finished run. Returns true if the run counts
       toward the seam-ad cadence. */
    noteRunFinished: function (runSeconds) {
      if (runSeconds >= Cfg.ads.minRunSecondsForAd) {
        this._runsSinceAd++;
        this._persistCadence();
        return true;
      }
      return false;
    },

    /* WHEN a seam ad is due, whatever its format: enough counted runs and
       the cooldown served. */
    seamAdDue: function () {
      if (!this.available || this.removeAdsOwned) return false;
      if (this._runsSinceAd < Cfg.ads.interstitialEveryNRuns) return false;
      return (Date.now() - this._lastInterstitialAt) >= Cfg.ads.interstitialCooldownMs;
    },

    shouldShowInterstitial: function () {
      return this.seamAdDue() && this._interstitialReady;
    },

    /* ==================================================================
       showSeamAd() -> {shown, kind, coins}

       THE ONLY full-screen entry point between runs. Resolves when the ad
       closes, or immediately if nothing is shown; never rejects.

       kind is 'rewardedInterstitial', 'interstitial' or null. coins is
       non-zero only when a rewarded interstitial actually paid out;
       game.js credits FTSave with it.

       ONE cadence decides WHEN a seam ad is due; the format is chosen only
       after that. Every Nth seam ad is the rewarded interstitial. The old
       design gave each format its own run count off one shared counter,
       so the plain interstitial (every 3) always reset the counter before
       the rewarded one (every 6) could be due — it only ever fired when
       the plain one had failed to load. Ported from Trap Jam's
       maybeShowLevelAd, which had the identical bug.
       ================================================================== */
    showSeamAd: function () {
      var self = this;
      var none = { shown: false, kind: null, coins: 0 };

      /* Re-entry guard: a double-tapped CLIMB AGAIN must not fire two
         prepared full-screen ads into one seam. */
      if (self._seamBusy || !self.seamAdDue()) return Promise.resolve(none);

      var riNth = Cfg.ads.rewardedInterstitialEveryNthAd;
      var riReady = !!self._unit('rewardedInterstitialId') && self._rewardedInterstitialReady;
      var iReady = !!self._unit('interstitialId') && self._interstitialReady;

      var riTurn = !!riNth && ((self._seamAdsShown + 1) % riNth === 0);
      if (riReady && (riTurn || !iReady)) return self._showRewardedInterstitial();
      /* Its turn but nothing loaded (a "No fill" is otherwise never
         retried): the interstitial covers this seam, and the rewarded
         interstitial is re-requested for a later one. */
      if (riTurn && !riReady && !self._riLoading && self._unit('rewardedInterstitialId')) {
        self._riLoading = true;
        self.preloadRewardedInterstitial().then(function () { self._riLoading = false; });
      }
      if (iReady) return self._showInterstitial();

      /* Due but empty. Leave the counter ALONE so the next seam is still
         due, and try to warm one for it. */
      self.preloadInterstitial();
      return Promise.resolve(none);
    },

    _showInterstitial: function () {
      var self = this;
      /* Spend the cadence and the cooldown BEFORE the show, so a second
         call that slips past the busy flag finds them spent, and restore
         them if the show never happened — a player who was never
         interrupted has not used up their quiet period. */
      var prevAt = self._lastInterstitialAt;
      var prevCount = self._runsSinceAd;
      self._lastInterstitialAt = Date.now();
      self._runsSinceAd = 0;
      self._seamBusy = true;

      return new Promise(function (resolve) {
        var settled = false, killer = null;
        var done = function (shown) {
          if (killer) { clearTimeout(killer); killer = null; }
          if (settled) return;
          settled = true;
          self._seamBusy = false;
          self._onInterstitialClosed = null;
          self._onInterstitialShowed = null;
          self._onInterstitialFailed = null;
          if (!shown) {
            self._lastInterstitialAt = prevAt;
            self._runsSinceAd = prevCount;
          } else {
            self._seamAdsShown++;
            track('ad_shown', { format: 'interstitial' });
          }
          self._persistCadence();
          resolve({ shown: shown, kind: shown ? 'interstitial' : null, coins: 0 });
        };
        self._onInterstitialClosed = function () { done(true); };
        self._onInterstitialFailed = function () { done(false); };
        // A wedged ad SDK must not strand the player on a dead screen...
        killer = setTimeout(function () { done(false); }, SHOW_TIMEOUT_MS);
        // ...but an ad that DID open is not wedged, however long it is watched.
        self._onInterstitialShowed = function () {
          if (killer) { clearTimeout(killer); killer = null; }
        };
        self._m.showInterstitial().catch(function (e) {
          console.warn('[ads] showInterstitial:', e);
          self._interstitialReady = false;
          self.preloadInterstitial();
          done(false);
        });
      });
    },

    rewardedAvailable: function () {
      return this.available && !this.removeAdsOwned && this._rewardedReady;
    },

    /* Resolves {earned:bool}. Never rejects. `placement` only labels the
       analytics event: 'revive' | 'double' | 'shop'. */
    showRewarded: function (placement) {
      var self = this;
      /* Defence in depth: rewardedAvailable() already hides every button
         that leads here, so reaching this line with the purchase owned
         means a caller went around the UI. Refuse without preloading. */
      if (self.removeAdsOwned) {
        return Promise.resolve({ earned: false, unavailable: true, removed: true });
      }
      if (!self.rewardedAvailable()) {
        // Try to warm one up for next time and tell the caller honestly.
        self.preloadRewarded();
        return Promise.resolve({ earned: false, unavailable: true });
      }
      self._earnedReward = false;
      return self._m.showRewardVideoAd()
        .then(function (reward) {
          var earned = self._earnedReward || !!(reward && (reward.amount > 0 || reward.type));
          self._rewardedReady = false;
          self.preloadRewarded();
          track('ad_shown', { format: 'rewarded' });
          if (earned) track('rewarded_done', { placement: placement || 'unknown' });
          return { earned: earned };
        })
        .catch(function (e) {
          console.warn('[ads] showRewarded:', e);
          self._rewardedReady = false;
          self.preloadRewarded();
          return { earned: false };
        });
    },

    /* ==================================================================
       Banner
       showBanner() is idempotent and records intent, so a caller can fire
       it on every screen change without tracking state itself.
       hideBanner() keeps the view alive for a cheap resume; removeBanner()
       tears it down for good.
       ================================================================== */
    bannerEnabled: function () {
      return this.available &&
             !this.removeAdsOwned &&
             !!this._unit('bannerId') &&
             !!(Cfg.ads.banner && Cfg.ads.banner.enabled !== false);
    },

    showBanner: function () {
      var self = this;
      if (!self.bannerEnabled()) return Promise.resolve(false);
      self._bannerWanted = true;
      if (self._bannerShown) {
        return self._m.resumeBanner()
          .then(function () {
            if (self._bannerWanted) self._setBannerInset(self._bannerHeight || 0);
            return true;
          })
          .catch(function (e) {
            console.warn('[ads] resumeBanner:', e);
            self._bannerShown = false;
            return false;
          });
      }
      var b = Cfg.ads.banner || {};
      return self._m.showBanner({
        adId: self._unit('bannerId'),
        adSize: b.size || 'ADAPTIVE_BANNER',
        position: b.position || 'BOTTOM_CENTER',
        margin: b.margin || 0,
        /* The banner is the one format that can sit on screen for minutes
           under a REQUIRED-but-unanswered consent state. npa keeps it
           serving non-personalised rather than coming back empty, which
           is the difference between a cheap impression and none. */
        npa: !self.canRequestAds
      })
        .then(function () {
          self._bannerShown = true;
          if (self._bannerWanted) self._setBannerInset(self._bannerHeight || 0);
          return true;
        })
        .catch(function (e) {
          console.warn('[ads] showBanner:', e);
          self._bannerShown = false;
          return false;
        });
    },

    _setBannerInset: function (px) {
      try {
        global.document.documentElement.style.setProperty('--banner-h', (px || 0) + 'px');
      } catch (e) {}
    },

    hideBanner: function () {
      var self = this;
      self._bannerWanted = false;
      self._setBannerInset(0);
      if (!self.available || !self._bannerShown) return Promise.resolve();
      return self._m.hideBanner().catch(function (e) {
        console.warn('[ads] hideBanner:', e);
      });
    },

    removeBanner: function () {
      var self = this;
      self._bannerWanted = false;
      self._setBannerInset(0);
      if (!self.available || !self._bannerShown) return Promise.resolve();
      self._bannerShown = false;
      return self._m.removeBanner().catch(function (e) {
        console.warn('[ads] removeBanner:', e);
      });
    },

    /* ==================================================================
       Rewarded interstitial
       ================================================================== */
    preloadRewardedInterstitial: function () {
      var self = this;
      if (!self.available || self.removeAdsOwned || !self._unit('rewardedInterstitialId')) return Promise.resolve();
      return self._m.prepareRewardInterstitialAd({ adId: self._unit('rewardedInterstitialId') })
        .then(function () { self._rewardedInterstitialReady = true; })
        .catch(function (e) {
          self._rewardedInterstitialReady = false;
          console.warn('[ads] preload rewarded interstitial:', e);
        });
    },

    /* Resolves {shown, kind, coins}; never rejects.

       removeAdsOwned silences this exactly like the plain interstitial.
       It is NOT opt-in the way the revive video is - it appears whether or
       not the player asked - so keeping it after the purchase on the
       grounds that it carries a reward would be a cheat. (That gate lives
       in seamAdDue, via showSeamAd, the only caller.) */
    _showRewardedInterstitial: function () {
      var self = this;
      var prevAt = self._lastInterstitialAt;
      var prevCount = self._runsSinceAd;
      self._lastInterstitialAt = Date.now();
      self._runsSinceAd = 0;
      self._seamBusy = true;
      self._earnedRIReward = false;

      return self._m.showRewardInterstitialAd()
        .then(function (reward) {
          /* Two sources for "did it pay?": the reward LISTENER, which is
             the reliable one, and the resolved value, which some plugin
             versions populate and some leave undefined. */
          var earned = self._earnedRIReward ||
                       !!(reward && (reward.amount > 0 || reward.type));
          self._seamBusy = false;
          self._seamAdsShown++;
          self._persistCadence();
          self._rewardedInterstitialReady = false;
          self.preloadRewardedInterstitial();
          track('ad_shown', { format: 'rewarded_interstitial' });
          if (earned) track('rewarded_done', { placement: 'seam' });
          return {
            shown: true,
            kind: 'rewardedInterstitial',
            coins: earned ? (Number(Cfg.ads.rewardedInterstitialCoins) || 0) : 0
          };
        })
        .catch(function (e) {
          console.warn('[ads] showRewardedInterstitial:', e);
          self._seamBusy = false;
          self._rewardedInterstitialReady = false;
          /* Give the cadence back — nothing was shown, so nothing was
             spent. Deliberately NOT falling through to the plain
             interstitial in the same seam: a show that just failed
             usually means the SDK is unhappy right now, and a second
             full-screen attempt is exactly the double-ad this function
             exists to prevent. The next seam is still due. */
          self._lastInterstitialAt = prevAt;
          self._runsSinceAd = prevCount;
          self._persistCadence();
          self.preloadRewardedInterstitial();
          return { shown: false, kind: null, coins: 0 };
        });
    }
  };

  global.FTAds = Ads;
})(window);
