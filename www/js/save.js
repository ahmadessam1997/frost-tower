/* =====================================================================
   Frost Tower — persistence
   Capacitor Preferences on device, localStorage in the browser.
   One JSON blob under ft.save, plus a migration from the v1 'ftb' key
   so players who already have a high score keep it.
   ===================================================================== */
(function (global) {
  'use strict';

  var KEY = 'ft.save';
  var LEGACY_BEST = 'ftb';

  function plugin() {
    try {
      return global.Capacitor && global.Capacitor.Plugins && global.Capacitor.Plugins.Preferences;
    } catch (e) { return null; }
  }

  function rawGet(k) {
    var P = plugin();
    if (P) {
      return P.get({ key: k }).then(function (r) { return r.value; })
              .catch(function () { return lsGet(k); });
    }
    return Promise.resolve(lsGet(k));
  }
  function rawSet(k, v) {
    var P = plugin();
    if (P) {
      return P.set({ key: k, value: v }).catch(function () { lsSet(k, v); });
    }
    lsSet(k, v);
    return Promise.resolve();
  }
  function lsGet(k) { try { return localStorage.getItem(k); } catch (e) { return null; } }
  function lsSet(k, v) { try { localStorage.setItem(k, v); } catch (e) {} }

  var defaults = {
    best: 0,
    bestFloor: 0,
    coins: 0,
    skin: 'frost',
    owned: ['frost'],     // skin ids unlocked by ANY route (free/milestone/coins/IAP)
    runs: 0,
    seenShop: false,
    /* Ad cadence. Lived in memory only, so every cold start began a fresh
       count and a player with short sessions never reached an ad at all. */
    adRuns: 0,            // counted runs since the last seam ad
    seamAds: 0,           // seam ads shown, picks every Nth as rewarded
    /* Mirror of the remove_ads entitlement, so the boot banner can be
       withheld before billing has answered. Billing stays the truth. */
    noAds: false,
    powerups: { shield: 0, headstart: 0 },   // consumables in stock
    daily: null           // daily mission + streak, owned by missions.js
  };

  var Save = {
    data: JSON.parse(JSON.stringify(defaults)),
    loaded: false,

    load: function () {
      var self = this;
      return rawGet(KEY).then(function (raw) {
        if (raw) {
          try {
            var parsed = JSON.parse(raw);
            if (parsed && typeof parsed === 'object') {
              Object.keys(defaults).forEach(function (k) {
                if (parsed[k] !== undefined && parsed[k] !== null) self.data[k] = parsed[k];
              });
            }
          } catch (e) { /* corrupt blob → keep defaults rather than lock the player out */ }
        }
        return rawGet(LEGACY_BEST);
      }).then(function (legacy) {
        // v1 stored only the best score under 'ftb'.
        if (legacy) {
          var n = parseInt(legacy, 10);
          if (!isNaN(n) && n > self.data.best) self.data.best = n;
        }
        // Repair anything a bad write or hand-edit could have broken.
        if (!Array.isArray(self.data.owned)) self.data.owned = ['frost'];
        if (self.data.owned.indexOf('frost') < 0) self.data.owned.push('frost');
        ['best', 'bestFloor', 'coins', 'runs', 'adRuns', 'seamAds'].forEach(function (k) {
          var n = Number(self.data[k]);
          self.data[k] = (isFinite(n) && n >= 0) ? Math.floor(n) : 0;
        });
        if (typeof self.data.skin !== 'string') self.data.skin = 'frost';
        self.data.noAds = self.data.noAds === true;
        var pu = self.data.powerups;
        if (!pu || typeof pu !== 'object' || Array.isArray(pu)) pu = {};
        self.data.powerups = {};
        ['shield', 'headstart'].forEach(function (k) {
          var n = Number(pu[k]);
          self.data.powerups[k] = (isFinite(n) && n > 0) ? Math.floor(n) : 0;
        });
        if (!self.data.daily || typeof self.data.daily !== 'object' ||
            Array.isArray(self.data.daily)) self.data.daily = null;
        self.loaded = true;
        return self.data;
      });
    },

    save: function () {
      return rawSet(KEY, JSON.stringify(this.data));
    },

    /* ---- convenience ---- */
    addCoins: function (n) {
      this.data.coins = Math.max(0, this.data.coins + n);
      return this.save();
    },
    spendCoins: function (n) {
      if (this.data.coins < n) return false;
      this.data.coins -= n;
      this.save();
      return true;
    },
    owns: function (skinId) {
      return this.data.owned.indexOf(skinId) >= 0;
    },
    grant: function (skinId) {
      if (!this.owns(skinId)) {
        this.data.owned.push(skinId);
        this.save();
        return true;
      }
      return false;
    },
    select: function (skinId) {
      this.data.skin = skinId;
      return this.save();
    }
  };

  global.FTSave = Save;
})(window);
