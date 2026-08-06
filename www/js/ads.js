/* =====================================================================
   Frost Tower — ads (AdMob)
   ---------------------------------------------------------------------
   Two formats, deliberately:
     interstitial  after a game over, every Nth *real* run, with a
                   cooldown. Never mid-run — this game's runs are ~30s and
                   an interrupt would destroy the flow.
     rewarded      always opt-in: revive a run once, or earn coins in the
                   shop.

   Ads are fire-and-forget: every entry point resolves rather than
   rejecting, because a failed ad load must never block the player from
   restarting. In the browser everything no-ops and reports "not shown".
   ===================================================================== */
(function (global) {
  'use strict';

  var Cfg = global.FTConfig;

  var Ads = {
    available: false,
    removeAdsOwned: false,
    _interstitialReady: false,
    _rewardedReady: false,
    _lastInterstitialAt: 0,
    _runsSinceAd: 0,

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

      return AdMob.initialize({
        initializeForTesting: !!Cfg.admob.isTest,
        // The game is rated Everyone and appears in family-friendly
        // searches; tagging keeps it out of behaviourally-targeted and
        // age-inappropriate ad inventory.
        tagForChildDirectedTreatment: false,
        tagForUnderAgeOfConsent: false,
        maxAdContentRating: 'G'
      }).then(function () {
        self.available = true;
        self._wireListeners();
        self.preloadInterstitial();
        self.preloadRewarded();
        return true;
      }).catch(function (e) {
        console.warn('[ads] initialize failed:', e);
        return false;
      });
    },

    _wireListeners: function () {
      var self = this;
      var m = self._m;
      try {
        m.addListener('onInterstitialAdLoaded', function () { self._interstitialReady = true; });
        m.addListener('onInterstitialAdFailedToLoad', function () { self._interstitialReady = false; });
        m.addListener('onInterstitialAdDismissed', function () {
          self._interstitialReady = false;
          self.preloadInterstitial();          // always have the next one warm
          if (self._onInterstitialClosed) { var f = self._onInterstitialClosed; self._onInterstitialClosed = null; f(); }
        });
        m.addListener('onInterstitialAdFailedToShow', function () {
          self._interstitialReady = false;
          if (self._onInterstitialClosed) { var f = self._onInterstitialClosed; self._onInterstitialClosed = null; f(); }
        });

        m.addListener('onRewardedVideoAdLoaded', function () { self._rewardedReady = true; });
        m.addListener('onRewardedVideoAdFailedToLoad', function () { self._rewardedReady = false; });
        m.addListener('onRewardedVideoAdReward', function () { self._earnedReward = true; });
        m.addListener('onRewardedVideoAdDismissed', function () {
          self._rewardedReady = false;
          self.preloadRewarded();
        });
      } catch (e) { console.warn('[ads] listeners:', e); }
    },

    /* Remove Ads only silences the interstitial. Rewarded ads stay
       reachable because they are opt-in and are the only coin faucet —
       the shop labels them so nobody feels cheated out of the purchase. */
    setRemoveAds: function (owned) { this.removeAdsOwned = !!owned; },

    preloadInterstitial: function () {
      var self = this;
      if (!self.available || self.removeAdsOwned) return Promise.resolve();
      return self._m.prepareInterstitial({ adId: Cfg.admob.interstitialId })
        .then(function () { self._interstitialReady = true; })
        .catch(function (e) { self._interstitialReady = false; console.warn('[ads] preload interstitial:', e); });
    },

    preloadRewarded: function () {
      var self = this;
      if (!self.available) return Promise.resolve();
      return self._m.prepareRewardVideoAd({ adId: Cfg.admob.rewardedId })
        .then(function () { self._rewardedReady = true; })
        .catch(function (e) { self._rewardedReady = false; console.warn('[ads] preload rewarded:', e); });
    },

    /* Called once per finished run. Returns true if the run counts
       toward the interstitial cadence. */
    noteRunFinished: function (runSeconds) {
      if (runSeconds >= Cfg.ads.minRunSecondsForAd) {
        this._runsSinceAd++;
        return true;
      }
      return false;
    },

    shouldShowInterstitial: function () {
      if (!this.available || this.removeAdsOwned || !this._interstitialReady) return false;
      if (this._runsSinceAd < Cfg.ads.interstitialEveryNRuns) return false;
      return (Date.now() - this._lastInterstitialAt) >= Cfg.ads.interstitialCooldownMs;
    },

    /* Resolves when the ad closes, or immediately if it isn't shown. */
    showInterstitial: function () {
      var self = this;
      if (!self.shouldShowInterstitial()) return Promise.resolve(false);
      return new Promise(function (resolve) {
        var settled = false;
        var done = function (shown) { if (!settled) { settled = true; resolve(shown); } };
        self._onInterstitialClosed = function () { done(true); };
        // A wedged ad SDK must not strand the player on a dead screen.
        setTimeout(function () { done(false); }, 8000);
        self._lastInterstitialAt = Date.now();
        self._runsSinceAd = 0;
        self._m.showInterstitial().catch(function (e) {
          console.warn('[ads] showInterstitial:', e);
          self._onInterstitialClosed = null;
          done(false);
        });
      });
    },

    rewardedAvailable: function () { return this.available && this._rewardedReady; },

    /* Resolves {earned:bool}. Never rejects. */
    showRewarded: function () {
      var self = this;
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
          return { earned: earned };
        })
        .catch(function (e) {
          console.warn('[ads] showRewarded:', e);
          self._rewardedReady = false;
          self.preloadRewarded();
          return { earned: false };
        });
    }
  };

  global.FTAds = Ads;
})(window);
