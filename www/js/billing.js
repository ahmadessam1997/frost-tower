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

  /* Everything outside this file uses the game's product ids. The App Store
     knows Remove Ads as `frosttower_remove_ads`, so ids are translated here
     and only here: toStore() on the way out (getProducts), fromStore() on
     everything the SDK reports back (package products, purchased ids).
     Both are the identity off iOS. Entitlement ids need no mapping: the
     RevenueCat entitlement stays `remove_ads` on both stores. */
  function toStore(id) { return Cfg.storeProductId ? Cfg.storeProductId(id) : id; }
  function fromStore(sid) { return Cfg.productIdFromStore ? Cfg.productIdFromStore(sid) : sid; }

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

      /* Per-platform key (config.js): '' on iOS until the App Store app
         exists in RevenueCat, which keeps billing failing closed there. */
      var key = Cfg.revenueCatKey ? Cfg.revenueCatKey()
                                  : (Cfg.revenueCat.androidApiKey || '').trim();
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
        // This branch used to be silent, which made a disabled shop
        // indistinguishable from a rejected configure() in logcat.
        console.warn('[billing] Purchases plugin not registered. Capacitor.Plugins =',
                     Object.keys((global.Capacitor && global.Capacitor.Plugins) || {}).join(','));
        return Promise.resolve(self.state);
      }
      self._p = Purchases;

      /* configure() is annotated RETURN_NONE in the Android plugin
         (PurchasesPlugin.kt), so it returns undefined — NOT a promise.
         Chaining .then() off it threw
             TypeError: Purchases.configure(...).then is not a function
         synchronously inside init(), which rejected the whole boot chain in
         game.js. That left state at its initial 'unavailable' (so every
         premium button was disabled) AND meant Ads.init() never ran. One
         wrong assumption, both SDKs dead. Verified on an emulator. */
      try {
        Purchases.configure({ apiKey: key });
      } catch (err) {
        self.state = 'unavailable';
        self.lastError = (err && err.message) || 'Store configure failed';
        console.warn('[billing] configure threw:', err);
        return Promise.resolve(self.state);
      }

      /* getCustomerInfo IS a promise and is the first real round-trip to
         RevenueCat, so it doubles as the readiness probe. Using it directly
         rather than refresh() matters: refresh() swallows its own errors,
         which would report 'ready' even when the store is unreachable and
         break the fail-closed guarantee. */
      return self._p.getCustomerInfo()
        .then(function (res) {
          self._applyCustomerInfo(res && res.customerInfo);
          self.state = 'ready';
          return self.loadPrices();
        })
        .then(function () {
          console.info('[billing] state=' + self.state +
                       ' prices=' + JSON.stringify(self.prices) +
                       ' owned=' + JSON.stringify(self.entitlements));
          return self.state;
        })
        .catch(function (err) {
          self.state = 'unavailable';
          self.lastError = (err && err.message) || 'Store unavailable';
          console.warn('[billing] configure failed:', err && (err.message || err),
                       'code=', err && err.code);
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
                var pid = fromStore(pkg.product.identifier);
                self.prices[pid] = pkg.product.priceString;
                self._packages = self._packages || {};
                self._packages[pid] = pkg;
                seen[pid] = true;
              }
            });
          });
          // Anything not attached to an offering still needs a price.
          var missing = ids.filter(function (id) { return !seen[id]; });
          if (!missing.length) return null;
          return self._p.getProducts({ productIdentifiers: missing.map(toStore) })
            .then(function (res) {
              (res.products || []).forEach(function (pr) {
                var pid = fromStore(pr.identifier);
                self.prices[pid] = pr.priceString;
                self._storeProducts = self._storeProducts || {};
                self._storeProducts[pid] = pr;
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
          /* Never the raw SDK text: offline, RevenueCat's message is
             "Error performing request.", which tells a player nothing
             (seen on the 1.2.0 emulator check). */
          console.warn('[billing] restore failed:', e && (e.message || e),
                       'code=', e && (e.code || e.errorCode));
          return { ok: false, error: self._humanError(e, 'restore') };
        });
    },

    _applyCustomerInfo: function (info) {
      var self = this;
      var next = {};
      if (info) {
        // Entitlements are the documented path...
        var active = (info.entitlements && info.entitlements.active) || {};
        Object.keys(active).forEach(function (k) { next[fromStore(k)] = true; });
        // ...but a mis-wired dashboard (product imported, entitlement not
        // attached) would silently strip a paid unlock, so also trust the
        // raw purchase list. Non-consumables never expire, so this is safe.
        (info.allPurchasedProductIdentifiers || []).forEach(function (sid) {
          var pid = fromStore(sid);
          if (Cfg.products[pid]) next[pid] = true;
        });
      }
      self.entitlements = next;
      return next;
    },

    /* Raw SDK errors must never reach a player. RevenueCat surfaces things
       like "There was a credentials issue" — which is a message to the
       DEVELOPER about a misconfigured dashboard, not something a paying
       customer can act on. shop.js toasts res.error directly, so the
       translation has to happen here.

       Deliberately NOT granting anything on a validation failure: if Play
       took the payment but RevenueCat could not verify it, the honest answer
       is "it will unlock once we can confirm it", not a local unlock. That
       is the fail-closed rule the whole billing module is built on. Play has
       recorded the purchase, so it comes back on Restore. */
    _humanError: function (e, what) {
      var code = String((e && (e.code || e.errorCode)) || '');
      var raw  = String((e && e.message) || '');
      /* RevenueCat's offline error is code 10, message "Error performing
         request." — the word "network" only appears in readableErrorCode
         ("NetworkError") and the host name in underlyingErrorMessage, so
         both are folded in or an offline player is told "Purchase failed". */
      var d = (e && e.data) || {};
      var extra = [e && e.readableErrorCode, e && e.underlyingErrorMessage,
                   d.readableErrorCode, d.readable_error_code,
                   d.underlyingErrorMessage].filter(Boolean).join(' ');
      var s = (code + ' ' + raw + ' ' + extra).toLowerCase();
      var restoring = what === 'restore';

      // Dashboard/service-account problems: the purchase itself may well
      // have gone through on the store side.
      if (/credential|configuration|invalid_credentials/.test(s)) {
        return 'The store isn’t fully set up yet. If you were charged, ' +
               'nothing is lost — tap Restore purchases in a little while ' +
               'and it will unlock.';
      }
      if (/network|connect|timeout|host/.test(s)) {
        return 'Couldn’t reach the store. Check your connection and try again.';
      }
      if (/not allowed|billing.?unavailable|purchasenotallowed/.test(s)) {
        return 'Purchases aren’t available on this device or account.';
      }
      if (/not available|productnotavailable|sku|item unavailable/.test(s)) {
        return 'That item isn’t available right now. Please try again later.';
      }
      return restoring ? 'Couldn’t restore purchases. Please try again.'
                       : 'Purchase failed. Please try again.';
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
          attempt = self._p.getProducts({ productIdentifiers: [toStore(productId)] })
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
          // Keep the real text in logcat for whoever is debugging, but hand
          // the player something they can actually act on.
          console.warn('[billing] purchase failed:', e && (e.message || e),
                       'code=', e && (e.code || e.errorCode));
          return { ok: false, error: self._humanError(e) };
        });
    }
  };

  global.FTBilling = Billing;
})(window);
