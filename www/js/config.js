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
      // true while these are Google's test IDs. Set false with real IDs.
      isTest: false
    },

    /* ---------------- RevenueCat ----------------
       Public Google SDK key (starts "goog_") from
       RevenueCat → Project → API keys. NOT the secret key. */
    revenueCat: {
      // Project "Frost Tower" → app "Frost Tower (Play Store)", 2026-08-05.
      // Public SDK key: safe to ship in the bundle. The SECRET key is not
      // here and must never be.
      androidApiKey: 'goog_AmTMmpCjnxrMXGguNLpiuVCsEJG'
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

    /* ---------------- Ad pacing ----------------
       Tuned for 30-second runs: an interstitial on every run would be
       intolerable, and Play's ad policy penalises interruptive density. */
    ads: {
      interstitialEveryNRuns: 3,
      interstitialCooldownMs: 90 * 1000,
      // A run must have lasted this long to count toward the cadence, so
      // rage-restarts don't speed-run the player into an ad.
      minRunSecondsForAd: 8
    },

    /* ---------------- Economy ---------------- */
    economy: {
      coinsPerScore: 25,     // coins = floor(score / this)
      rewardedAdCoins: 50
    }
  };

  Config.isNative = function () {
    return !!(global.Capacitor && global.Capacitor.isNativePlatform && global.Capacitor.isNativePlatform());
  };

  global.FTConfig = Config;
})(window);
