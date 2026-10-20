/* =====================================================================
   Frost Tower — shop
   Renders the skin grid, the power-ups, the Remove Ads tile and the
   coin faucet.
   Owns no state of its own: everything is read from FTSave / FTBilling
   and re-rendered, so there is one source of truth per fact.
   ===================================================================== */
(function (global) {
  'use strict';

  var Save = global.FTSave, Skins = global.FTSkins,
      Billing = global.FTBilling, Ads = global.FTAds, Cfg = global.FTConfig;

  var el = {};
  var previewCanvases = [];
  var busy = false;
  var onClose = null;

  function $(id) { return document.getElementById(id); }

  function track(name, params) {
    if (global.FTAnalytics) global.FTAnalytics.log(name, params);
  }

  function init(closeCallback) {
    onClose = closeCallback;
    el.overlay = $('shopOv');
    el.grid = $('skinGrid');
    el.coins = $('shopCoins');
    el.notice = $('shopNotice');
    el.removeAds = $('removeAdsTile');
    el.earn = $('earnCoinsBtn');
    el.earnSection = $('earnSection');
    el.powerups = $('powerupList');
    el.restore = $('restoreBtn');
    el.privacy = $('shopPrivacy');

    $('shopCloseBtn').addEventListener('click', close);
    el.earn.addEventListener('click', watchForCoins);
    el.restore.addEventListener('click', restore);
    el.privacy.addEventListener('click', openPrivacyOptions);
    /* iOS: purchases belong to the Apple Account, not Google Play. */
    var acct = $('shopStoreAcct');
    if (acct && Cfg.isIOS && Cfg.isIOS()) acct.textContent = 'Apple Account';
    return Shop;
  }

  function toast(msg, isError) {
    el.notice.textContent = msg;
    el.notice.className = 'shop-notice' + (isError ? ' err' : '') + (msg ? ' show' : '');
    clearTimeout(toast._t);
    if (msg) toast._t = setTimeout(function () { el.notice.className = 'shop-notice'; }, 3200);
  }

  /* Milestone skins unlock silently as you play; this reconciles the save
     file with the player's records and returns anything newly earned. */
  function reconcileMilestones() {
    var newly = [];
    Skins.list.forEach(function (s) {
      if (Save.owns(s.id)) return;
      var u = s.unlock;
      var earned =
        (u.type === 'free') ||
        (u.type === 'floor' && Save.data.bestFloor >= u.v) ||
        (u.type === 'score' && Save.data.best >= u.v);
      if (earned && Save.grant(s.id)) newly.push(s);
    });
    return newly;
  }

  /* Mirror RevenueCat entitlements into the save file so premium skins
     render offline. Billing stays the source of truth. */
  function reconcileEntitlements() {
    Skins.list.forEach(function (s) {
      if (s.unlock.type === 'iap' && Billing.owns(s.unlock.product)) Save.grant(s.id);
    });
    /* Remove Ads is mirrored into the save too, for one reason: at boot
       the banner is ready before billing has answered, and an owner must
       not be shown an ad in that gap. The mirror is only ever WRITTEN from
       a definite answer; while the store is unreachable ('unavailable')
       the last known answer stands rather than ads coming back. */
    var owned = Billing.owns('remove_ads');
    if (Billing.state === 'unavailable') owned = owned || Save.data.noAds === true;
    else if (Save.data.noAds !== owned) { Save.data.noAds = owned; Save.save(); }
    Ads.setRemoveAds(owned);
  }

  function open() {
    reconcileMilestones();
    reconcileEntitlements();
    Save.data.seenShop = true;
    Save.save();
    track('shop_open', { coins: Save.data.coins });
    render();
    el.overlay.classList.remove('hidden');
  }

  function close() {
    el.overlay.classList.add('hidden');
    if (onClose) onClose();
  }

  function isOpen() { return el.overlay && !el.overlay.classList.contains('hidden'); }

  /* ---------------- rendering ---------------- */
  function render() {
    el.coins.textContent = '❄ ' + Save.data.coins;
    renderGrid();
    renderPowerups();
    renderRemoveAds();
    renderEarn();
    el.restore.classList.toggle('hidden', Billing.state === 'unavailable');
    /* Only where Google actually has a form to show — it hides the entry
       point otherwise, and a dead button is worse than no button. NOT
       gated on removeAds: buying Remove Ads silences every ad format,
       rewarded videos included, but the ad SDK still holds a consent
       decision and regulators require a persistent way to change it. */
    el.privacy.classList.toggle('hidden', !Ads.privacyOptionsRequired);
  }

  function renderGrid() {
    el.grid.innerHTML = '';
    previewCanvases = [];

    Skins.list.forEach(function (s) {
      var owned = Save.owns(s.id);
      var selected = Save.data.skin === s.id;
      var u = s.unlock;

      var card = document.createElement('div');
      card.className = 'skin-card' + (selected ? ' sel' : '') + (owned ? '' : ' locked');

      var cv = document.createElement('canvas');
      cv.className = 'skin-prev';
      card.appendChild(cv);
      previewCanvases.push({ cv: cv, id: s.id });

      var name = document.createElement('div');
      name.className = 'skin-name';
      name.textContent = s.name;
      card.appendChild(name);

      var sub = document.createElement('div');
      sub.className = 'skin-sub';
      card.appendChild(sub);

      var btn = document.createElement('button');
      btn.className = 'skin-btn';
      card.appendChild(btn);

      if (owned) {
        sub.textContent = s.blurb;
        btn.textContent = selected ? 'WEARING' : 'WEAR';
        btn.disabled = selected;
        btn.className += selected ? ' on' : '';
        btn.addEventListener('click', function () {
          Save.select(s.id);
          render();
        });
      } else if (u.type === 'coins') {
        sub.textContent = s.blurb;
        var afford = Save.data.coins >= u.v;
        btn.textContent = u.v + ' ❄';
        btn.disabled = !afford;
        btn.addEventListener('click', function () { buyWithCoins(s); });
      } else if (u.type === 'iap') {
        sub.textContent = s.blurb;
        btn.textContent = Billing.priceOf(u.product) + (Billing.isMock() ? ' · DEV' : '');
        btn.className += ' prem';
        btn.disabled = !Billing.isReady();
        if (!Billing.isReady()) sub.textContent = 'Store unavailable';
        btn.addEventListener('click', function () { buyPremium(s); });
      } else {
        // Milestone — no button, just the goal and how close they are.
        var have = u.type === 'floor' ? Save.data.bestFloor : Save.data.best;
        sub.textContent = Skins.unlockLabel(s);
        btn.textContent = 'LOCKED';
        btn.disabled = true;
        var bar = document.createElement('div');
        bar.className = 'skin-prog';
        var fill = document.createElement('i');
        fill.style.width = Math.min(100, Math.round(have / u.v * 100)) + '%';
        bar.appendChild(fill);
        card.appendChild(bar);
      }

      el.grid.appendChild(card);
    });
  }

  /* Consumables. A row per kind in Cfg.powerups: what it does, how many
     are in stock, and a snowflake price. Stock is capped so a rich
     player cannot sink the whole wallet into one tap-happy minute. */
  var POWERUPS = ['shield', 'headstart'];

  function renderPowerups() {
    el.powerups.innerHTML = '';
    POWERUPS.forEach(function (kind) {
      var def = Cfg.powerups[kind];
      var have = Save.data.powerups[kind] | 0;

      var tile = document.createElement('div');
      tile.className = 'pu-tile';

      var icon = document.createElement('div');
      icon.className = 'pu-icon';
      icon.textContent = def.icon;
      tile.appendChild(icon);

      var info = document.createElement('div');
      info.className = 'pu-info';
      var name = document.createElement('div');
      name.className = 'pu-name';
      name.textContent = def.name;
      if (have > 0) {
        var stock = document.createElement('small');
        stock.textContent = '×' + have + ' ready';
        name.appendChild(stock);
      }
      info.appendChild(name);
      var sub = document.createElement('div');
      sub.className = 'pu-sub';
      sub.textContent = def.blurb;
      info.appendChild(sub);
      tile.appendChild(info);

      var btn = document.createElement('button');
      btn.className = 'skin-btn';
      btn.id = 'buy_' + kind;
      var full = have >= Cfg.powerups.maxStock;
      btn.textContent = full ? 'MAX' : (def.price + ' ❄');
      btn.disabled = full || Save.data.coins < def.price;
      btn.addEventListener('click', function () { buyPowerup(kind); });
      tile.appendChild(btn);

      el.powerups.appendChild(tile);
    });
  }

  function renderRemoveAds() {
    var owned = Billing.owns('remove_ads');
    el.removeAds.innerHTML = '';

    var t = document.createElement('div');
    t.className = 'ra-title';
    t.textContent = owned ? '✓ Ads removed' : 'Remove Ads';
    el.removeAds.appendChild(t);

    var d = document.createElement('div');
    d.className = 'ra-sub';
    d.textContent = owned
      ? 'Thank you! Every ad is gone — banners, breaks between climbs and reward videos.'
      : 'One payment. Removes every ad, forever — reward videos included.';
    el.removeAds.appendChild(d);

    if (!owned) {
      var b = document.createElement('button');
      b.className = 'skin-btn prem wide';
      b.textContent = Billing.priceOf('remove_ads') + (Billing.isMock() ? ' · DEV' : '');
      b.disabled = !Billing.isReady();
      if (!Billing.isReady()) d.textContent = 'Store unavailable right now.';
      b.addEventListener('click', function () { buyRemoveAds(); });
      el.removeAds.appendChild(b);
    }
    el.removeAds.classList.toggle('owned', owned);
  }

  function renderEarn() {
    var can = Ads.rewardedAvailable();
    el.earn.textContent = '▶ Watch an ad · +' + Cfg.economy.rewardedAdCoins + ' ❄';
    el.earn.disabled = !can;
    /* Hide the whole section, header included, when there is no ad SDK or
       when Remove Ads is owned - an empty "SNOWFLAKES" heading looks
       broken, and a permanently disabled "Watch an ad" button reads as
       the purchase having broken something. */
    el.earnSection.classList.toggle('hidden', !Ads.available || Ads.removeAdsOwned);
  }

  /* ---------------- actions ---------------- */
  function buyWithCoins(s) {
    if (busy) return;
    if (!Save.spendCoins(s.unlock.v)) { toast('Not enough snowflakes.', true); return; }
    Save.grant(s.id);
    Save.select(s.id);
    track('skin_bought', { skin: s.id, method: 'coins', price: s.unlock.v });
    toast(s.name + ' unlocked!');
    render();
  }

  /* Returns true when one was bought. Exposed for the tests. */
  function buyPowerup(kind) {
    var def = Cfg.powerups[kind];
    if (busy || !def || POWERUPS.indexOf(kind) < 0) return false;
    if ((Save.data.powerups[kind] | 0) >= Cfg.powerups.maxStock) {
      toast('You already carry the most you can.', true);
      return false;
    }
    if (!Save.spendCoins(def.price)) { toast('Not enough snowflakes.', true); return false; }
    Save.data.powerups[kind] = (Save.data.powerups[kind] | 0) + 1;
    Save.save();
    track('powerup_bought', { powerup: kind, price: def.price });
    toast(def.icon + ' ' + def.name + ' ready for your next run.');
    render();
    return true;
  }

  function buyPremium(s) {
    if (busy) return;
    busy = true;
    toast('Opening store…');
    track('purchase_start', { product: s.unlock.product });
    Billing.purchase(s.unlock.product).then(function (res) {
      busy = false;
      if (res.cancelled) { toast(''); return; }          // silent, as it should be
      if (!res.ok) { toast(res.error || 'Purchase failed.', true); render(); return; }
      Save.grant(s.id);
      Save.select(s.id);
      track('purchase_done', { product: s.unlock.product, restored: !!res.restored });
      track('skin_bought', { skin: s.id, method: 'iap' });
      reconcileEntitlements();
      toast(res.restored ? (s.name + ' restored!') : (s.name + ' unlocked!'));
      render();
    });
  }

  function buyRemoveAds() {
    if (busy) return;
    busy = true;
    toast('Opening store…');
    track('purchase_start', { product: 'remove_ads' });
    Billing.purchase('remove_ads').then(function (res) {
      busy = false;
      if (res.cancelled) { toast(''); return; }
      if (!res.ok) { toast(res.error || 'Purchase failed.', true); render(); return; }
      track('purchase_done', { product: 'remove_ads', restored: !!res.restored });
      reconcileEntitlements();
      Ads.setRemoveAds(true);
      toast('Ads removed. Enjoy the quiet.');
      render();
    });
  }

  function watchForCoins() {
    if (busy) return;
    busy = true;
    el.earn.disabled = true;
    Ads.showRewarded('shop').then(function (r) {
      busy = false;
      if (r.earned) {
        Save.addCoins(Cfg.economy.rewardedAdCoins);
        toast('+' + Cfg.economy.rewardedAdCoins + ' ❄');
      } else if (r.unavailable) {
        toast('No video ready — try again in a moment.', true);
      } else {
        toast('');
      }
      render();
    });
  }

  function restore() {
    if (busy) return;
    busy = true;
    toast('Restoring…');
    Billing.restore().then(function (res) {
      busy = false;
      if (!res.ok) { toast(res.error || 'Restore failed.', true); return; }
      reconcileEntitlements();
      var n = Object.keys(Billing.entitlements).length;
      toast(n ? ('Restored ' + n + ' purchase' + (n > 1 ? 's' : '') + '.') : 'Nothing to restore.');
      render();
    });
  }

  /* Regulators require a persistent way to CHANGE a consent choice, not
     just make it once. Deliberately does NOT re-render afterwards: the form
     changes ad personalisation, not anything the shop displays, and a
     flicker after dismissing it would look like a purchase state changed. */
  function openPrivacyOptions() {
    if (busy) return;
    busy = true;
    Ads.showPrivacyOptions().then(function (res) {
      busy = false;
      if (!res.ok) toast('Couldn’t open privacy choices just now.', true);
    }).catch(function () {
      busy = false;
      toast('Couldn’t open privacy choices just now.', true);
    });
  }

  /* Preview canvases animate so Aurora shimmers and Ember flickers. */
  function tick(t) {
    for (var i = 0; i < previewCanvases.length; i++) {
      Skins.drawPreview(previewCanvases[i].cv, previewCanvases[i].id, t);
    }
  }

  var Shop = {
    init: init, open: open, close: close, isOpen: isOpen,
    render: render, tick: tick, toast: toast, buyPowerup: buyPowerup,
    reconcileMilestones: reconcileMilestones,
    reconcileEntitlements: reconcileEntitlements
  };
  global.FTShop = Shop;
})(window);
