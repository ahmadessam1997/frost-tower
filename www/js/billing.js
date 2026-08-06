/* =====================================================================
   Frost Tower — billing (RevenueCat)
   ---------------------------------------------------------------------
   Three possible states, and which one we're in is never guessed:

     'mock'        browser / dev only. Purchases succeed instantly and
                   are labelled DEV in the UI. Gated on isNative()===false
                   so it CANNOT activate in a shipped build.
     'ready'       native + API key + RevenueCat configured.
     'unavailable' native but no key, or the SDK failed. Purchases are
                   refused with a message. This is the fail-closed path —
                   see the warning at the top of config.js.

   Entitlement truth comes from RevenueCat, not from local storage, so a
   refund or a reinstall resolves correctly. Owned skins are then mirrored
   into the save file only so the game can render offline.
   ===================================================================== */
(function (global) {
  'use strict';

  var Cfg = global.FTConfig;

  var Billing = {
    state: 'unavailable',
    entitlements: {},   // productId -> true
    prices: {},         // productId -> localized price string
    lastError: null,

    isMock: function () { return this.state === 'mock'; },
    isReady: function () { return this.state === 'mock' || this.state === 'ready'; },
    owns: function (productId) { return !!this.entitlements[productId]; },
    priceOf: function (productId) {
      return this.prices[productId] ||
             (Cfg.products[productId] && Cfg.products[productId].price) || '—';
    },

    /* ---------------------------------------------------------------- */
    init: function () {
      var self = this;

      if (!Cfg.isNative()) {
        // Browser preview: let the whole shop be exercised without a store.
        self.state = 'mock';
        Object.keys(Cfg.products).forEach(function (id) {
          self.prices[id] = Cfg.products[id].price;
        });
        // Mock entitlements live in localStorage so a reload keeps them,
        // which makes manual testing of the "already owned" states sane.
        try {
          var raw = localStorage.getItem('ft.mockEntitlements');
          if (raw) self.entitlements = JSON.parse(raw) || {};
        } catch (e) {}
        return Promise.resolve(self.state);
      }

      var key = (Cfg.revenueCat.androidApiKey || '').trim();
      if (!key) {
        self.state = 'unavailable';
        self.lastError = 'Store not configured';
        console.warn('[billing] No RevenueCat API key — purchases disabled (fail-closed).');
        return Promise.resolve(self.state);
      }

      var Purchases = global.Capacitor.Plugins.Purchases ||
                      (global.CapacitorCustomPlatform && global.CapacitorCustomPlatform.plugins.Purchases);
      if (!Purchases) {
        self.state = 'unavailable';
        self.lastError = 'Store plugin missing';
        return Promise.resolve(self.state);
      }
      self._p = Purchases;

      return Purchases.configure({ apiKey: key })
        .then(function () { return self.refresh(); })
        .then(function () {
          self.state = 'ready';
          return self.loadPrices();
        })
        .then(function () { return self.state; })
        .catch(function (err) {
          self.state = 'unavailable';
          self.lastError = (err && err.message) || 'Store unavailable';
          console.warn('[billing] configure failed:', err);
          return self.state;
        });
    },

    /* Pull localized prices so the shop shows ₹/€/¥ correctly rather than
       the hardcoded USD strings in config.js. */
    loadPrices: function () {
      var self = this;
      if (!self._p) return Promise.resolve();
      var ids = Object.keys(Cfg.products);
      return self._p.getOfferings()
        .then(function (offerings) {
          var seen = {};
          var all = offerings && offerings.all ? offerings.all : {};
          Object.keys(all).forEach(function (offId) {
            (all[offId].availablePackages || []).forEach(function (pkg) {
              if (pkg.product) {
                self.prices[pkg.product.identifier] = pkg.product.priceString;
                self._packages = self._packages || {};
                self._packages[pkg.product.identifier] = pkg;
                seen[pkg.product.identifier] = true;
              }
            });
          });
          // Anything not attached to an offering still needs a price.
          var missing = ids.filter(function (id) { return !seen[id]; });
          if (!missing.length) return null;
          return self._p.getProducts({ productIdentifiers: missing })
            .then(function (res) {
              (res.products || []).forEach(function (pr) {
                self.prices[pr.identifier] = pr.priceString;
                self._storeProducts = self._storeProducts || {};
                self._storeProducts[pr.identifier] = pr;
              });
            })
            .catch(function (e) { console.warn('[billing] getProducts:', e); });
        })
        .catch(function (e) { console.warn('[billing] getOfferings:', e); });
    },

    /* Re-read what the user owns. Called on boot, after a purchase, and
       from the Restore button. */
    refresh: function () {
      var self = this;
      if (self.state === 'mock') return Promise.resolve(self.entitlements);
      if (!self._p) return Promise.resolve(self.entitlements);
      return self._p.getCustomerInfo()
        .then(function (res) { return self._applyCustomerInfo(res.customerInfo); })
        .catch(function (e) {
          console.warn('[billing] getCustomerInfo:', e);
          return self.entitlements;
        });
    },

    restore: function () {
      var self = this;
      if (self.state === 'mock') return Promise.resolve({ ok: true, entitlements: self.entitlements });
      if (!self._p) return Promise.resolve({ ok: false, error: self.lastError || 'Store unavailable' });
      return self._p.restorePurchases()
        .then(function (res) {
          self._applyCustomerInfo(res.customerInfo);
          return { ok: true, entitlements: self.entitlements };
        })
        .catch(function (e) {
          return { ok: false, error: (e && e.message) || 'Restore failed' };
        });
    },

    _applyCustomerInfo: function (info) {
      var self = this;
      var next = {};
      if (info) {
        // Entitlements are the documented path...
        var active = (info.entitlements && info.entitlements.active) || {};
        Object.keys(active).forEach(function (k) { next[k] = true; });
        // ...but a mis-wired dashboard (product imported, entitlement not
        // attached) would silently strip a paid unlock, so also trust the
        // raw purchase list. Non-consumables never expire, so this is safe.
        (info.allPurchasedProductIdentifiers || []).forEach(function (pid) {
          if (Cfg.products[pid]) next[pid] = true;
        });
      }
      self.entitlements = next;
      return next;
    },

    /* Returns {ok} | {cancelled:true} | {ok:false, error} — never throws,
       and a user cancelling is NOT an error (HomeKept shipped a scary
       "Purchase failed" alert on cancel; see its session notes). */
    purchase: function (productId) {
      var self = this;

      if (self.state === 'mock') {
        self.entitlements[productId] = true;
        try {
          localStorage.setItem('ft.mockEntitlements', JSON.stringify(self.entitlements));
        } catch (e) {}
        return Promise.resolve({ ok: true, mock: true });
      }

      if (self.state !== 'ready' || !self._p) {
        return Promise.resolve({ ok: false, error: self.lastError || 'Store unavailable' });
      }

      var pkg = self._packages && self._packages[productId];
      var attempt;
      if (pkg) {
        attempt = self._p.purchasePackage({ aPackage: pkg });
      } else {
        var sp = self._storeProducts && self._storeProducts[productId];
        if (!sp) {
          // Fetch on demand — one product at a time, because a single
          // inactive id poisons a whole batch query (adaptive-chess).
          attempt = self._p.getProducts({ productIdentifiers: [productId] })
            .then(function (res) {
              var p = (res.products || [])[0];
              if (!p) throw new Error('Product not available: ' + productId);
              self._storeProducts = self._storeProducts || {};
              self._storeProducts[productId] = p;
              return self._p.purchaseStoreProduct({ product: p });
            });
        } else {
          attempt = self._p.purchaseStoreProduct({ product: sp });
        }
      }

      return attempt
        .then(function (res) {
          if (res && res.customerInfo) self._applyCustomerInfo(res.customerInfo);
          else self.entitlements[productId] = true;
          return { ok: true };
        })
        .catch(function (e) {
          if (e && (e.userCancelled === true || e.code === '1' || e.code === 1 ||
                    /cancel/i.test(e.message || ''))) {
            return { cancelled: true };
          }
          // Already owned but not reflected locally → treat as a restore.
          if (e && /already own|already purchased/i.test(e.message || '')) {
            return self.refresh().then(function () { return { ok: true, restored: true }; });
          }
          return { ok: false, error: (e && e.message) || 'Purchase failed' };
        });
    }
  };

  global.FTBilling = Billing;
})(window);
