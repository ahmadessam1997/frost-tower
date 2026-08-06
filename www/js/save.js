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
    seenShop: false
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
        ['best', 'bestFloor', 'coins', 'runs'].forEach(function (k) {
          var n = Number(self.data[k]);
          self.data[k] = (isFinite(n) && n >= 0) ? Math.floor(n) : 0;
        });
        if (typeof self.data.skin !== 'string') self.data.skin = 'frost';
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
