/* =====================================================================
   Frost Tower — monetization configuration
   ---------------------------------------------------------------------
   THE ONLY FILE YOU EDIT WHEN THE REAL ACCOUNTS EXIST.
   Everything below ships with Google's official *test* ad units and an
   empty RevenueCat key, which is deliberate:

     - Test ad units always fill, so ads are verifiable before AdMob
       approves the account. Serving real ads to yourself is a policy
       violation and gets the account banned, so do not swap these in
       until you are testing on a registered test device.
     - An empty RevenueCat key makes billing FAIL CLOSED on device
       (buttons say "Store unavailable"), never fall back to the mock.
       HomeKept shipped the opposite once and handed out free lifetime
       access; see Mobile Softwares/Home Tracking/homekept/GO-LIVE.md.

   The browser mock is gated on "not a native platform" alone, so it can
   never activate in the shipped APK/AAB.
   ===================================================================== */
(function (global) {
  'use strict';

  var Config = {
    /* ---------------- AdMob ----------------
       Replace with the real values from AdMob → Apps → Frost Tower.
       The app ID ALSO has to be written into
       android/app/src/main/AndroidManifest.xml as the
       com.google.android.gms.ads.APPLICATION_ID meta-data, or the app
       crashes on launch. Keep the two in sync. */
    admob: {
      // Real IDs from AdMob → Apps → Frost Tower, 2026-08-08.
      // App ID is duplicated in AndroidManifest.xml as
      // com.google.android.gms.ads.APPLICATION_ID — the two MUST match or the
      // SDK throws at startup and the app crashes on launch.
      appId: 'ca-app-pub-7898882561225435~4844848706',
      interstitialId: 'ca-app-pub-7898882561225435/8592522025', // frost-tower-interstitial
      rewardedId: 'ca-app-pub-7898882561225435/3593290870',     // frost-tower-rewarded (50 snowflakes)

      /* Added 2026-09-20 to widen format coverage. Both are LIVE units
         created that day. ads.js still checks each id before use and
         no-ops on null, so blanking one here is a safe kill switch for
         that format. Created under
         AdMob -> Apps -> Frost Tower -> Ad units and paste them here. A
         WRONG id is worse than a null one: the SDK reports a load failure
         and the slot silently never fills. */
      bannerId: 'ca-app-pub-7898882561225435/9483167913',              // frost-tower-banner
      rewardedInterstitialId: 'ca-app-pub-7898882561225435/4031441392', // frost-tower-rewarded-interstitial
      // true while these are Google's test IDs. Set false with real IDs.
      isTest: false,

      /* iOS (App Store build). AdMob ids are per PLATFORM: these are the
         live units of the AdMob iOS app "Frost Tower" (created 2026-10-15),
         the twins of the Android units above. appId must equal
         GADApplicationIdentifier in ios/App/App/Info.plist. */
      ios: {
        appId: 'ca-app-pub-7898882561225435~2671752523',
        interstitialId: 'ca-app-pub-7898882561225435/8237658562',         // frost-tower-interstitial
        rewardedId: 'ca-app-pub-7898882561225435/8854017492',             // frost-tower-rewarded (50 snowflakes)
        bannerId: 'ca-app-pub-7898882561225435/7676667195',               // frost-tower-banner
        rewardedInterstitialId: 'ca-app-pub-7898882561225435/7540935827'  // frost-tower-rewarded-interstitial
      },

      /* Devices that get TEST ads even though the IDs above are real.
         Every other device still gets real ads — this list only marks
         these devices, it does not put the app into test mode.

         WHY THIS EXISTS: tapping a real ad on your own device is invalid
         traffic, and it is the most common way developers get an AdMob
         account suspended. Put every device you personally test on here.

         HOW TO GET THE VALUE: it is NOT the advertising ID. Install the
         app on the device, then:
             adb logcat | grep -i setTestDeviceIds
         The SDK logs a line containing
             Arrays.asList("33BE2250B43518CCDA7DE426D04EE231")
         and that hash is what goes in this array. */
      testDeviceIds: [],

      /* ---------------- UMP consent (GDPR / US states) ----------------
         The game serves personalised ads and ships AD_ID, and it is
         published in the EEA and UK, so a consent form has to be
         REQUESTED here and CREATED in the AdMob console (Privacy &
         messaging). Neither half works alone: without the console message
         the SDK reports no form available, and without this call the
         console message is never shown to anyone.

         debugGeography is read natively with call.getInt(), so it is a
         NUMBER, not a string. Passing 'EEA' silently does nothing — the
         same failure mode as the maxAdContentRating enum in ads.js.
             0 DISABLED   1 EEA   2 NOT_EEA (deprecated)
             3 US         4 OTHER
         Set it to 1 on a test device to force the EEA form outside the
         EEA; ship it as 0.

         testDeviceIdentifiers takes the SDK's *hashed* device id — the
         same value as testDeviceIds above, and NOT the advertising ID
         from the AdMob console. It reuses that list on purpose so there
         is only one place to get it wrong. */
      consent: {
        debugGeography: 0,
        /* Set false to skip the whole flow (e.g. if the console message
           is ever withdrawn). Ads then still run, but only with whatever
           consent state the SDK already has. */
        enabled: true
      }
    },

    /* ---------------- RevenueCat ----------------
       Public Google SDK key (starts "goog_") from
       RevenueCat → Project → API keys. NOT the secret key. */
    revenueCat: {
      // Project "Frost Tower" → app "Frost Tower (Play Store)", 2026-08-05.
      // Public SDK key: safe to ship in the bundle. The SECRET key is not
      // here and must never be.
      androidApiKey: 'goog_AmTMmpCjnxrMXGguNLpiuVCsEJG',
      /* iOS public SDK key (starts "appl_") from RevenueCat -> Project ->
         Apps -> + App Store app -> API keys. While it is the IOS_TODO
         placeholder, revenueCatKey() returns '' and billing FAILS CLOSED on
         iOS ("Store unavailable"), exactly like a blank Android key. */
      iosApiKey: 'IOS_TODO_RC_IOS_KEY'
    },

    /* ---------------- Leaderboard ----------------
       Google Play Games Services. Both values come from Play Console →
       Grow users → Play Games services. The project ID is ALSO in
       android/app/src/main/res/values/strings.xml as
       game_services_project_id — the SDK reads it from the manifest at
       startup, so the two must stay in step. */
    leaderboard: {
      // Play Games services project ID (same as strings.xml).
      projectId: '198265567595',
      // Leaderboard → "Highest Floor", sorted largest-first.
      highestFloorId: 'CgkI6_KxzOIFEAIQAA',

      /* iOS: Game Center (ios/App/App/LeaderboardPlugin.swift, same JS
         API). Game Center leaderboard ids are chosen by the developer and
         must be created with EXACTLY this id in App Store Connect -> the
         app -> Services -> Game Center -> Leaderboards: Classic, "High
         Score First" (best kept), Integer format, name "Highest Floor".
         See IOS-TODO.md. */
      ios: {
        highestFloorId: 'frosttower.best_floor'
      }
    },

    /* ---------------- Products ----------------
       Product IDs must match Play Console exactly, and be imported into
       RevenueCat with an entitlement of the SAME id attached.
       All four are one-time, NON-CONSUMABLE managed products. */
    products: {
      remove_ads:  { price: '$2.99', label: 'Remove Ads' },
      skin_aurora: { price: '$1.99', label: 'Aurora' },
      skin_golden: { price: '$2.99', label: 'Golden Crown' },
      skin_void:   { price: '$2.99', label: 'Void Walker' }
    },

    /* App Store product ids that differ from the ids above. Apple makes a
       product id unique across the whole developer account and Trap Jam
       already owns `remove_ads`, so the iOS twin had to be prefixed. Only
       the store boundary in billing.js sees these (storeProductId /
       productIdFromStore below); save data, the shop, analytics and the
       RevenueCat entitlement all keep `remove_ads`. Android ignores it. */
    iosProductIds: {
      remove_ads: 'frosttower_remove_ads'
    },

    /* ---------------- Ad pacing ----------------
       Tuned for 30-second runs: an interstitial on every run would be
       intolerable, and Play's ad policy penalises interruptive density. */
    ads: {
      interstitialEveryNRuns: 3,
      interstitialCooldownMs: 90 * 1000,
      // A run must have lasted this long to count toward the cadence, so
      // rage-restarts don't speed-run the player into an ad.
      minRunSecondsForAd: 8,

      /* ---- Banner ----
         Never during a run. A climber reads the column of platforms
         bottom-to-top and a strip pinned to the bottom of the screen sits
         exactly where the next jump is judged from, so game.js shows the
         banner only on the menu and the game-over card and hides it the
         instant a run starts. */
      banner: {
        enabled: true,
        size: 'ADAPTIVE_BANNER',
        position: 'BOTTOM_CENTER',
        margin: 0
      },

      /* ---- Rewarded interstitial ----
         Not a second break and not a second cadence: every Nth seam ad
         (above) is served as a rewarded interstitial instead of a plain
         one. It used to have its own run count (every 6) off the SAME
         counter the plain interstitial (every 3) reset, so it was only
         ever reachable when the plain one had been skipped. If the
         preferred format is not loaded the other one fills the seam. */
      rewardedInterstitialEveryNthAd: 3,
      rewardedInterstitialCoins: 40
    },

    /* ---------------- Economy ---------------- */
    economy: {
      coinsPerScore: 25,     // coins = floor(score / this)
      rewardedAdCoins: 50,
      /* The game-over "double" video is not offered below this many
         snowflakes: a 30-second ad for +2 reads as a bad joke. */
      doubleMinCoins: 5
    },

    /* ---------------- Revive ----------------
       Floors CLIMBED this run (a head start does not count) before the
       revive video is offered. Was a hard-coded 10, which most first
       sessions never reached, so new players never saw the offer. */
    revive: {
      minFloor: 5
    },

    /* ---------------- Power-ups ----------------
       Consumables bought with snowflakes; one of each kind in stock is
       used up automatically by the next run. Priced so a couple of
       decent runs (~20 snowflakes each) or one shop video (50) buys one.

       headStartFloor: the run begins on this floor. Records and the
       global board count only floors CLIMBED on such a run (see
       game.js gameOver), so a head start cannot buy a ranking. */
    powerups: {
      maxStock: 9,
      shield: {
        price: 50, icon: '🛡', name: 'Shield',
        blurb: 'Survive one fall or frost hit on your next run.'
      },
      headstart: {
        price: 40, icon: '🚀', name: 'Head start',
        blurb: 'Begin your next run on floor 15.'
      },
      headStartFloor: 15
    },

    /* ---------------- Daily mission + streak ----------------
       One mission per calendar day (device local time), picked from this
       list by a hash of the date, so every player gets the same one and
       it never repeats two days running. Goal types:
           floor  reach floor N in one run
           coins  collect N snowflakes in one run
           score  score N in one run
           combo  N combo points in one run
           runs   finish N runs today
       The streak counts consecutive days with a CLAIMED mission and adds
       streakBonusPerDay for each day beyond the first, up to the cap. */
    missions: {
      list: [
        { id: 'floor20',  type: 'floor', goal: 20,   reward: 30, text: 'Reach floor 20 in one run' },
        { id: 'runs3',    type: 'runs',  goal: 3,    reward: 25, text: 'Play 3 runs' },
        { id: 'coins60',  type: 'coins', goal: 60,   reward: 40, text: 'Collect 60 snowflakes in one run' },
        { id: 'floor35',  type: 'floor', goal: 35,   reward: 40, text: 'Reach floor 35 in one run' },
        { id: 'combo15',  type: 'combo', goal: 15,   reward: 30, text: 'Earn 15 combo points in one run' },
        { id: 'score800', type: 'score', goal: 800,  reward: 35, text: 'Score 800 in one run' },
        { id: 'runs5',    type: 'runs',  goal: 5,    reward: 35, text: 'Play 5 runs' },
        { id: 'floor50',  type: 'floor', goal: 50,   reward: 60, text: 'Reach floor 50 in one run' }
      ],
      streakBonusPerDay: 10,
      streakBonusCap: 50,
      /* Local reminder, re-armed after every run for this long after the
         last one. Permission is only ever asked for when the player
         claims their first mission reward, never at launch. */
      reminderHours: 24,
      reminderId: 4101
    },

    /* ---------------- More games ----------------
       Cross-promotion panel on the menu. `live: false` hides an entry
       (a Play listing that is not public yet opens a "not found" page).
       Icons live in www/img, copied from each game's play-assets. */
    moreGames: [
      { name: 'Escape Chambers', blurb: 'Escape rooms. Can you read them?',
        pkg: 'com.ahmadessam.escapechambers', icon: 'img/more-escape.png', live: true },
      { name: 'Adaptive Chess', blurb: 'Chess that adapts to your level.',
        pkg: 'com.ahmadessam.adaptivechess', icon: 'img/more-chess.png', live: true },
      // Live since 2026-10-14 (Trap Jam production release prepared the same day).
      { name: 'Trap Jam', blurb: 'One-tap platformer where every level lies.',
        pkg: 'com.ahmadessam.trapjam', icon: 'img/more-trapjam.png', live: true }
    ]
  };

  /* ---------------- App Store ids (iOS) ----------------
     The numeric "Apple ID" App Store Connect shows under App Information
     for each app. A store link on iOS can only be built from it, so while
     an entry is still an IOS_TODO placeholder, that game is hidden from
     the iOS "More games" panel and (for this game's own entry) the rating
     prompt never shows on iOS. Android ignores this table. */
  Config.appStoreIds = {
    'com.ahmadessam.frosttower': '6824664822',
    'com.ahmadessam.escapechambers': '6824664816',
    'com.ahmadessam.adaptivechess': '6824666389',
    'com.ahmadessam.trapjam': '6824664950'
  };

  Config.isNative = function () {
    return !!(global.Capacitor && global.Capacitor.isNativePlatform && global.Capacitor.isNativePlatform());
  };

  /* 'android' | 'ios' | 'web'. The browser preview and the e2e suite are
     'web' and keep the Android (Google Play) behaviour. */
  Config.platform = function () {
    var C = global.Capacitor;
    return (C && C.getPlatform) ? C.getPlatform() : 'web';
  };
  Config.isIOS = function () { return Config.platform() === 'ios'; };

  /* The ad unit to use for `key` on this platform. */
  Config.adUnit = function (key) {
    var src = Config.isIOS() ? (Config.admob.ios || {}) : Config.admob;
    var id = src[key] || '';
    return (typeof id === 'string') ? id.trim() : '';
  };

  /* RevenueCat public key for this platform; '' (fail closed) while a
     key is missing or still a placeholder. */
  Config.revenueCatKey = function () {
    var k = Config.isIOS() ? Config.revenueCat.iosApiKey : Config.revenueCat.androidApiKey;
    k = (k || '').trim();
    return /^IOS_TODO/.test(k) ? '' : k;
  };

  /* The id the store knows product `id` by on this platform. Identity
     everywhere but iOS, so Play is sent exactly what it always was. */
  Config.storeProductId = function (id) {
    var map = Config.isIOS() ? (Config.iosProductIds || {}) : {};
    return map[id] || id;
  };

  /* The reverse: a store product identifier back to the id the game uses. */
  Config.productIdFromStore = function (sid) {
    var map = Config.isIOS() ? (Config.iosProductIds || {}) : {};
    for (var id in map) {
      if (map.hasOwnProperty(id) && map[id] === sid) return id;
    }
    return sid;
  };

  function appStoreId(pkg) {
    var id = Config.appStoreIds[pkg] || '';
    return /^\d+$/.test(id) ? id : '';
  }

  /* Can this platform link to pkg's store page? Always true off iOS. */
  Config.hasStorePage = function (pkg) {
    return !Config.isIOS() || !!appStoreId(pkg);
  };

  /* Store page for pkg on this platform, or '' when there is none yet.
     review=true opens the App Store's "write a review" sheet on iOS. */
  Config.storeUrl = function (pkg, review) {
    if (Config.isIOS()) {
      var id = appStoreId(pkg);
      return id ? 'itms-apps://apps.apple.com/app/id' + id + (review ? '?action=write-review' : '') : '';
    }
    return 'https://play.google.com/store/apps/details?id=' + pkg;
  };

  /* "Google Play" / "the App Store", for UI copy. */
  Config.storeName = function () {
    return Config.isIOS() ? 'the App Store' : 'Google Play';
  };

  global.FTConfig = Config;
})(window);
