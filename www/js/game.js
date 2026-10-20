/* =====================================================================
   Frost Tower — game
   Physics and rendering are unchanged from v1.0 except where the skin,
   coin and revive hooks needed to reach in. The v1 pointer-stack input
   (two-thumb play) is preserved verbatim — it was a shipped bug fix.
   ===================================================================== */
(function () {
'use strict';

var Save = window.FTSave, Skins = window.FTSkins, Shop = window.FTShop,
    Billing = window.FTBilling, Ads = window.FTAds, Cfg = window.FTConfig,
    Leaderboard = window.FTLeaderboard, Missions = window.FTMissions;

function track(name, params) {
  if (window.FTAnalytics) window.FTAnalytics.log(name, params);
}
function $(id) { return document.getElementById(id); }

var cv = document.getElementById('c'), ctx = cv.getContext('2d');

/* roundRect polyfill — some older Android WebViews lack it; without this every
   frame would throw and the screen stays black. */
if (!CanvasRenderingContext2D.prototype.roundRect) {
  CanvasRenderingContext2D.prototype.roundRect = function (x, y, w, h, r) {
    r = Math.max(0, Math.min(r, Math.abs(w) / 2, Math.abs(h) / 2));
    this.moveTo(x + r, y);
    this.arcTo(x + w, y, x + w, y + h, r);
    this.arcTo(x + w, y + h, x, y + h, r);
    this.arcTo(x, y + h, x, y, r);
    this.arcTo(x, y, x + w, y, r);
    this.closePath();
    return this;
  };
}

var W = 0, H = 0;
function resize() {
  var dpr = Math.min(devicePixelRatio || 1, 2);
  W = innerWidth; H = innerHeight;
  cv.width = W * dpr; cv.height = H * dpr;
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  /* keep the player inside the walls after an orientation/size change */
  try { if (P) { P.x = Math.max(P.r, Math.min(W - P.r, P.x)); } } catch (_) {}
}
addEventListener('resize', resize);
resize();

/* ---------- state ----------
   'menu' | 'play' | 'pause' | 'over'. step() only advances in 'play', so
   'pause' freezes the climber, the platforms and the frost in one go. */
var state = 'menu', best = 0;
var P, plats, cam, frost, maxFloor, lastFloor, comboTotal, comboStreak, comboTimer,
    score, snow = [], parts = [], shake = 0, tGame = 0;
var frostY = 99999;
var revivedThisRun = false;
var coinsThisRun = 0;
var graceTimer = 0;          /* post-revive invulnerability to the frost */
var startFloor = 0;          /* head start: the floor this run began on */
var shieldActive = false;    /* a Shield is riding along on this run */
var doubledThisRun = false;  /* the "double snowflakes" video was used */
var bonusCoins = 0;          /* what that video added, for the card */
var runCounted = false;      /* this run's first death is already counted */
var adBusy = false;          /* a rewarded video is in flight */

var SPACING = 78, PW0 = 120;
function platW(f) { return Math.max(48, PW0 - f * 0.7); }
function newPlat(f) {
  var w = platW(f);
  var type = 'ice';
  if (f > 25 && Math.random() < 0.18) type = 'move';
  if (f > 50 && Math.random() < 0.15) type = 'crack';
  return { f: f, x: 20 + Math.random() * (W - 40 - w), y: -f * SPACING, w: w, h: 16, type: type,
           dir: Math.random() < .5 ? -1 : 1, sp: 40 + Math.random() * 60, broken: false, tm: 0 };
}
/* start: the floor the run begins on (0, or the head-start floor). The
   whole tower is simply built from there up — floor numbers, platform
   widths and the frost's speed all key off the real floor number, so a
   head start is exactly as hard as having climbed there. */
function reset(start) {
  startFloor = start || 0;
  var baseY = -startFloor * SPACING;
  P = { x: W / 2, y: baseY - 20, vx: 0, vy: 0, r: 16, onIce: false };
  plats = [{ f: startFloor, x: 0, y: baseY, w: W, h: 16, type: 'base' }];
  for (var f = startFloor + 1; f <= startFloor + 30; f++) plats.push(newPlat(f));
  cam = baseY - H * 0.7; frost = H * 0.6; maxFloor = startFloor; lastFloor = startFloor;
  comboTotal = 0; comboStreak = 0; comboTimer = 0; score = 0; tGame = 0;
  parts = []; shake = 0;
  frostY = baseY + H * 1.4;
  revivedThisRun = false; coinsThisRun = 0; graceTimer = 0;
  shieldActive = false; doubledThisRun = false; bonusCoins = 0; runCounted = false;
  updHud();
}
function updHud() {
  document.getElementById('floorHud').textContent = '🏔 Floor ' + maxFloor;
  document.getElementById('scoreHud').textContent = '✦ ' + score;
  document.getElementById('bestHud').textContent = '👑 ' + best;
}

/* snow */
for (var i = 0; i < 70; i++) {
  snow.push({ x: Math.random(), y: Math.random(), s: 1 + Math.random() * 2.5,
              v: 12 + Math.random() * 26, w: Math.random() * 6 });
}

/* ---------- input ---------- */
/* track every active pointer so two-thumb play works: releasing one finger
   falls back to the other instead of stopping the run */
var dir = 0;
var touchStack = [];
function stackDir() { dir = touchStack.length ? touchStack[touchStack.length - 1].side : 0; }
addEventListener('pointerdown', function (e) {
  if (state !== 'play') return;
  e.preventDefault();
  var side = e.clientX < W / 2 ? -1 : 1;
  touchStack.push({ id: e.pointerId, side: side }); dir = side;
}, { passive: false });
addEventListener('pointermove', function (e) {
  if (state !== 'play') return;
  var t = null;
  for (var i = 0; i < touchStack.length; i++) if (touchStack[i].id === e.pointerId) t = touchStack[i];
  if (t) { t.side = e.clientX < W / 2 ? -1 : 1; stackDir(); }
});
function dropPtr(e) {
  for (var i = 0; i < touchStack.length; i++) {
    if (touchStack[i].id === e.pointerId) { touchStack.splice(i, 1); break; }
  }
  stackDir();
}
addEventListener('pointerup', dropPtr);
addEventListener('pointercancel', dropPtr);
addEventListener('keydown', function (e) {
  if (e.code === 'ArrowLeft') dir = -1;
  if (e.code === 'ArrowRight') dir = 1;
});
addEventListener('keyup', function (e) {
  if ((e.code === 'ArrowLeft' && dir === -1) || (e.code === 'ArrowRight' && dir === 1)) dir = 0;
});

/* Leaving the app mid-run (the home button, a call, the recents key) must
   not leave a direction stuck on — and must not let the frost win while
   nobody is looking, so a run in progress pauses itself. */
document.addEventListener('visibilitychange', function () {
  if (document.hidden) { touchStack.length = 0; dir = 0; pauseRun(); }
});

/* ---------- screen wiring ---------- */
function startRun() {
  $('menu').classList.add('hidden');
  $('overOv').classList.add('hidden');
  /* Down before reset(), not after: the banner overlays the WebView, so a
     late hide leaves it pinned across the bottom of the first frame of a
     run - exactly where the next jump is judged from. */
  Ads.hideBanner();

  /* Power-ups: one of each kind in stock is spent on this run. */
  var pu = Save.data.powerups, head = 0, shield = false;
  if (pu.headstart > 0) { pu.headstart--; head = Cfg.powerups.headStartFloor; }
  if (pu.shield > 0) { pu.shield--; shield = true; }
  if (head || shield) Save.save();

  reset(head);
  shieldActive = shield;
  touchStack.length = 0; dir = 0;
  state = 'play';
  $('pauseBtn').classList.remove('hidden');
  track('run_start', { run: Save.data.runs + 1, shield: shield, headstart: !!head });
}
$('playBtn').addEventListener('click', startRun);
$('againBtn').addEventListener('click', function () {
  /* The ad lands between runs, never during one. Two formats share this
     ONE slot and never stack: Ads.showSeamAd() decides whether an ad is
     due at all and which format it is (every Nth is the rewarded
     interstitial, which hands the player coins). It always resolves, with
     shown:false when it declines. */
  $('overOv').classList.add('hidden');
  Ads.hideBanner();
  /* A due rating prompt takes this seam INSTEAD of the ad, so the two never
     land back to back; the ad cadence is untouched and fires next seam.
     "Rate now" leaves for the store, so the player comes back to the
     game-over card rather than a run that started without them. */
  /* iOS has no custom prompt (guideline 5.6.1): at the same moment it asks
     for the system review sheet and reports 'review', which, like "Rate
     now", returns to the game-over card so no run starts under the sheet. */
  if (window.RatePrompt && RatePrompt.maybeShow(function (choice) {
    if (choice === 'rate' || choice === 'review') shopClosed(); else startRun();
  })) return;
  Ads.showSeamAd().then(function (res) {
    if (res.coins > 0) {
      Save.addCoins(res.coins);
      refreshMenuWallet();
      Shop.toast('\u2744 +' + res.coins + ' snowflakes for watching.');
    }
    startRun();
  });
});
document.getElementById('menuShopBtn').addEventListener('click', function () {
  document.getElementById('menu').classList.add('hidden');
  Shop.open();
});
document.getElementById('overShopBtn').addEventListener('click', function () {
  document.getElementById('overOv').classList.add('hidden');
  Shop.open();
});
$('reviveBtn').addEventListener('click', doRevive);
$('doubleBtn').addEventListener('click', doDouble);
$('miClaim').addEventListener('click', claimMission);
$('oClaimBtn').addEventListener('click', claimMission);

/* Global ranking. The button stays hidden until Leaderboard.init() proves the
   plugin is present, so it never appears on a device that cannot use it. */
document.getElementById('menuBoardBtn').addEventListener('click', function () {
  Leaderboard.show().then(function (r) {
    if (r && r.ok) return;
    // Signed-out or unavailable — say so rather than doing nothing visible.
    var el = document.getElementById('menuBoardBtn');
    var was = el.textContent;
    el.textContent = (r && r.error === 'not signed in')
      ? ((Cfg.isIOS && Cfg.isIOS()) ? 'Sign in to Game Center to rank'
                                    : 'Sign in to Play Games to rank')
      : 'Ranking unavailable right now';
    setTimeout(function () { el.textContent = was; }, 2600);
  });
});

/* Where the shop returns to depends on where it was opened from. */
function shopClosed() {
  if (state === 'over') $('overOv').classList.remove('hidden');
  else $('menu').classList.remove('hidden');
  refreshMenuWallet();
  /* A Remove Ads purchase made in the shop takes the two video offers
     off the card it returns to. */
  if (!Ads.rewardedAvailable()) {
    $('reviveBtn').classList.add('hidden');
    $('doubleBtn').classList.add('hidden');
  }
  /* Both destinations are banner screens. This also re-checks
     removeAdsOwned, so a Remove Ads purchase made in the shop leaves the
     banner down on the way back out. */
  Ads.showBanner();
}

/* Game-over card -> menu (the back button's route out of a finished run). */
function toMenu() {
  $('overOv').classList.add('hidden');
  $('pauseOv').classList.add('hidden');
  $('pauseBtn').classList.add('hidden');
  reset(0);
  state = 'menu';
  $('menu').classList.remove('hidden');
  refreshMenuWallet();
  Ads.showBanner();
}

/* =====================================================================
   Pause
   ---------------------------------------------------------------------
   Reached from the HUD button, the Android back button, and by itself
   when the app goes to the background mid-run. No banner here: the pause
   card sits over a live run, and that is still "over gameplay".
   ===================================================================== */
function pauseRun() {
  if (state !== 'play') return;
  state = 'pause';
  touchStack.length = 0; dir = 0;
  $('pauseInfo').textContent = '🏔 Floor ' + maxFloor + '  ·  ✦ ' + score;
  $('pauseBtn').classList.add('hidden');
  $('pauseOv').classList.remove('hidden');
}
function resumeRun() {
  if (state !== 'pause') return;
  $('pauseOv').classList.add('hidden');
  $('pauseBtn').classList.remove('hidden');
  touchStack.length = 0; dir = 0;
  state = 'play';
}
/* The pause button eats its own pointerdown so the tap that pauses is not
   also read as "run right" by the window listener above. */
$('pauseBtn').addEventListener('pointerdown', function (e) {
  e.preventDefault(); e.stopPropagation(); pauseRun();
});
$('pauseBtn').addEventListener('click', pauseRun);
$('resumeBtn').addEventListener('click', resumeRun);
$('endRunBtn').addEventListener('click', function () {
  if (state !== 'pause') return;
  $('pauseOv').classList.add('hidden');
  state = 'play';
  gameOver();            /* a run ended by hand still banks its snowflakes */
});

/* =====================================================================
   More games — a config-driven list of the sibling games (FTConfig
   .moreGames). Each row opens its Play listing.
   ===================================================================== */
function liveGames() {
  /* On iOS a game is listed only once its App Store id is known
     (Cfg.hasStorePage); a link that cannot be built is not shown. */
  return (Cfg.moreGames || []).filter(function (g) {
    return g.live !== false && g.pkg && (!Cfg.hasStorePage || Cfg.hasStorePage(g.pkg));
  });
}
function openListing(pkg) {
  /* iOS: the App Store link from config.js (itms-apps://), '' while the
     App Store id is unknown. No market:// fallback dance there. */
  if (Cfg.isIOS && Cfg.isIOS()) {
    var url = Cfg.storeUrl(pkg);
    if (!url) return;
    track('more_games_tap', { game: pkg });
    window.location.href = url;
    return;
  }
  track('more_games_tap', { game: pkg });
  var web = 'https://play.google.com/store/apps/details?id=' + pkg;
  if (!Cfg.isNative()) { window.open(web, '_blank'); return; }
  /* market:// goes straight to the Play Store app. Capacitor turns any
     off-app URL into an ACTION_VIEW intent and swallows the failure when
     nothing can handle it, so there is no error to catch: if the app is
     still in the foreground a moment later, nothing opened, and the
     https link (which any browser can take) is tried instead. */
  var tappedAt = Date.now();
  window.location.href = 'market://details?id=' + pkg;
  /* "Still in the foreground" is judged by the activity's own pause event
     as well as document.hidden: on the 1.2.0 emulator check the page was
     still reported visible 1.2 s after the Play Store had opened, so the
     https link was fired on top of a handoff that had already worked. */
  setTimeout(function () {
    if (!document.hidden && lastPauseAt < tappedAt) window.location.href = web;
  }, 1500);
}
function renderMoreGames() {
  var list = $('moreList');
  list.innerHTML = '';
  /* "Free on Google Play" / "Free on the App Store" (the last word keeps
     its non-breaking space, as in index.html). */
  var line = $('moreStoreLine');
  if (line && Cfg.storeName) {
    line.textContent = 'From the maker of Frost Tower. Free on ' +
      Cfg.storeName().replace(/ (\S+)$/, ' $1') + '.';
  }
  liveGames().forEach(function (g) {
    var row = document.createElement('button');
    row.className = 'mg-row';
    if (g.icon) {
      var img = document.createElement('img');
      img.src = g.icon; img.alt = '';
      row.appendChild(img);
    }
    var txt = document.createElement('div');
    var name = document.createElement('b'); name.textContent = g.name;
    var sub = document.createElement('span'); sub.textContent = g.blurb || '';
    txt.appendChild(name); txt.appendChild(sub);
    row.appendChild(txt);
    var go = document.createElement('em'); go.textContent = 'GET';
    row.appendChild(go);
    row.addEventListener('click', function () { openListing(g.pkg); });
    list.appendChild(row);
  });
}
function moreOpen() { return !$('moreOv').classList.contains('hidden'); }
function closeMore() {
  $('moreOv').classList.add('hidden');
  $('menu').classList.remove('hidden');
}
$('menuMoreBtn').addEventListener('click', function () {
  renderMoreGames();
  track('more_games_open', {});
  $('menu').classList.add('hidden');
  $('moreOv').classList.remove('hidden');
});
$('moreCloseBtn').addEventListener('click', closeMore);

/* ---------------------------------------------------------------------
   Android hardware back button.

   Without @capacitor/app the WebView's default wins and back closes the
   whole app from wherever the player is — including 40 floors into a
   run. The order is the usual one-step-back stack:

       rating prompt -> "Later"
       shop          -> close the shop
       more games    -> close it
       in a run      -> pause
       paused        -> resume
       game over     -> menu (no ad: an interstitial fired by a back
                        press is the accidental-click pattern Play
                        penalises)
       menu          -> exit the app

   Returns what it did, which is only of interest to the tests.
   --------------------------------------------------------------------- */
function handleBack() {
  var rp = window.RatePrompt;
  if (rp && rp.isOpen()) { rp.dismiss(); return 'rate'; }
  if (Shop.isOpen()) { Shop.close(); return 'shop'; }
  if (moreOpen()) { closeMore(); return 'more'; }
  if (state === 'play') { pauseRun(); return 'pause'; }
  if (state === 'pause') { resumeRun(); return 'resume'; }
  if (state === 'over') { toMenu(); return 'menu'; }
  var App = appPlugin();
  if (App && App.exitApp) App.exitApp();
  return 'exit';
}
function appPlugin() {
  return (window.Capacitor && window.Capacitor.Plugins && window.Capacitor.Plugins.App) || null;
}
function wireApp() {
  var App = appPlugin();
  if (!App || !App.addListener) return;      // browser: no hardware back
  App.addListener('backButton', handleBack);
  /* Belt and braces with visibilitychange above: some WebViews report
     the activity pausing before (or without) the page turning hidden. */
  App.addListener('pause', function () { lastPauseAt = Date.now(); pauseRun(); });
}
/* When the activity last went to the background (0 = never). Lets
   openListing() tell whether the Play Store actually took over. */
var lastPauseAt = 0;

/* ---------- physics ---------- */
var ACC = 1400, FRIC = 6, MAXV = 560, GRAV = 1500;
function step(dt) {
  if (state !== 'play') return;
  tGame += dt;
  if (graceTimer > 0) graceTimer -= dt;

  P.vx += dir * ACC * dt;
  var fr = P.onIce ? 1.2 : FRIC;
  if (dir === 0) P.vx -= P.vx * Math.min(1, fr * dt);
  P.vx = Math.max(-MAXV, Math.min(MAXV, P.vx));
  P.vy += GRAV * dt; if (P.vy > 1150) P.vy = 1150;
  P.x += P.vx * dt; P.y += P.vy * dt;

  /* wall rebound keeps your speed — Icy Tower style */
  var trail = Skins.get(Save.data.skin).trail;
  if (P.x < P.r) { P.x = P.r; P.vx = Math.abs(P.vx) * 0.96; pop(P.x, P.y, trail, 5); }
  if (P.x > W - P.r) { P.x = W - P.r; P.vx = -Math.abs(P.vx) * 0.96; pop(P.x, P.y, trail, 5); }

  /* landing */
  P.onIce = false;
  if (P.vy > 0) {
    for (var i = 0; i < plats.length; i++) {
      var p = plats[i];
      if (p.broken) continue;
      if (P.x > p.x - 6 && P.x < p.x + p.w + 6 &&
          P.y + P.r > p.y && P.y + P.r < p.y + p.h + P.vy * dt + 6) {
        P.y = p.y - P.r;
        var speed = Math.abs(P.vx);
        P.vy = -(600 + speed * 1.05);          /* speed = height */
        P.onIce = p.type !== 'base';
        pop(P.x, p.y, '#dff4ff', 6);
        if (navigator.vibrate) navigator.vibrate(8);
        /* combo logic */
        var gained = p.f - lastFloor;
        if (gained >= 2) {
          comboStreak += gained; comboTimer = 2.2;
          showCombo(comboStreak);
          comboTotal += gained;
          score += gained * 15;
        } else if (gained > 0) { if (comboTimer <= 0) comboStreak = 0; }
        if (p.f > maxFloor) { score += (p.f - maxFloor) * 10; maxFloor = p.f; }
        lastFloor = p.f;
        if (p.type === 'crack') { p.tm = 0.001; }
        updHud();
        break;
      }
    }
  }
  comboTimer -= dt; if (comboTimer <= 0) { comboStreak = 0; hideCombo(); }

  /* platform updates */
  plats.forEach(function (p) {
    if (p.type === 'move') {
      p.x += p.dir * p.sp * dt;
      if (p.x < 10) { p.x = 10; p.dir = 1; }
      if (p.x + p.w > W - 10) { p.x = W - 10 - p.w; p.dir = -1; }
    }
    if (p.type === 'crack' && p.tm > 0) {
      p.tm += dt;
      if (p.tm > 0.45 && !p.broken) { p.broken = true; pop(p.x + p.w / 2, p.y, '#bfe6ff', 10); }
    }
  });

  /* camera + spawning */
  var target = P.y - H * 0.42;
  if (target < cam) cam += (target - cam) * Math.min(1, dt * 8);
  var topF = 0;
  for (var k = 0; k < plats.length; k++) if (plats[k].f > topF) topF = plats[k].f;
  var hf = topF;
  while ((-(hf + 1) * SPACING) > cam - 200) { hf++; plats.push(newPlat(hf)); }
  plats = plats.filter(function (p) { return p.y < cam + H + 300 && !(p.broken && p.tm > 2); });

  /* frost line rises */
  var fSpeed = 26 + maxFloor * 0.9 + tGame * 1.1;
  frostY -= fSpeed * dt;
  if (frostY > cam + H + 60) frostY = cam + H + 60;   /* never lag too far */
  if (graceTimer <= 0 && P.y + P.r > frostY) die();
  else if (P.y - cam > H + 80) die();

  updParts(dt);
}

function pop(x, y, c, n) {
  for (var i = 0; i < n; i++) {
    parts.push({ x: x, y: y, vx: (Math.random() - .5) * 220,
                 vy: -Math.random() * 200, r: 2 + Math.random() * 3, c: c, life: .7 });
  }
}
function updParts(dt) {
  for (var i = parts.length - 1; i >= 0; i--) {
    var p = parts[i];
    p.life -= dt * 1.6; p.vy += 700 * dt; p.x += p.vx * dt; p.y += p.vy * dt;
    if (p.life <= 0) parts.splice(i, 1);
  }
}
var comboEl = document.getElementById('combo');
function showCombo(n) {
  comboEl.textContent = 'COMBO ×' + n + ' ❄️';
  comboEl.classList.add('show');
}
function hideCombo() { comboEl.classList.remove('show'); }

/* ---------- game over / revive ---------- */
/* The frost caught up or the climber fell off the screen. A Shield, if
   one is riding along, is spent here instead of the run. */
function die() {
  if (state !== 'play') return;
  if (shieldActive) {
    shieldActive = false;
    rescue('#8fe8ff');
    Shop.toast('🛡 Shield used — keep climbing!');
    track('shield_used', { floor: maxFloor });
    return;
  }
  gameOver();
}

/* Put the player back on solid ground with room to breathe: drop the
   frost well below, clear the fall, and grant a short grace window so
   a slow reaction doesn't waste the rescue. Shared by the revive video
   and the Shield. */
function rescue(colour) {
  var landing = null;
  for (var i = 0; i < plats.length; i++) {
    if (!plats[i].broken && plats[i].f <= maxFloor &&
        (!landing || plats[i].f > landing.f)) landing = plats[i];
  }
  if (landing) { P.x = landing.x + landing.w / 2; P.y = landing.y - P.r - 4; }
  P.vx = 0; P.vy = -650;
  cam = P.y - H * 0.42;
  frostY = P.y + H * 0.85;
  graceTimer = 1.6;
  comboStreak = 0; comboTimer = 0;
  lastFloor = maxFloor;
  parts = [];
  touchStack.length = 0; dir = 0;
  state = 'play';
  $('pauseBtn').classList.remove('hidden');
  pop(P.x, P.y, colour, 26);
}

function coinsLine() {
  return '❄ Earned: ' + (coinsThisRun + bonusCoins) + ' snowflakes' +
         (doubledThisRun ? ' (doubled!)' : '');
}

function gameOver() {
  if (state !== 'play') return;
  state = 'over'; hideCombo();
  $('pauseBtn').classList.add('hidden');
  score += comboTotal * 5;
  var isBest = score > best;
  if (isBest) best = score;

  /* Records + wallet. Coins are only awarded once per run even if the
     player revives, because coinsThisRun is subtracted out below. */
  var earned = Math.floor(score / Cfg.economy.coinsPerScore) - coinsThisRun;
  if (earned < 0) earned = 0;
  coinsThisRun += earned;

  /* A head-start run began on startFloor without climbing to it, so the
     lifetime record — which is what the global board ranks and what the
     floor milestones unlock on — only counts the floors actually CLIMBED.
     Score needs no such correction: the skipped floors never paid any. */
  var climbed = maxFloor - startFloor;

  /* A revived run dies twice. It is still ONE run for the run count, the
     rating prompt and the ad cadence. */
  var firstDeath = !runCounted;
  runCounted = true;

  Save.data.best = Math.max(Save.data.best, score);
  Save.data.bestFloor = Math.max(Save.data.bestFloor, climbed);
  Save.data.coins += earned;
  if (firstDeath) Save.data.runs++;
  Save.save();
  if (firstDeath && window.RatePrompt) RatePrompt.tick();
  best = Save.data.best;

  /* Daily mission. The floor a mission sees is the one on the HUD, head
     start included: the power-up was paid for, and "reach floor 20" being
     easier with it is the point of buying one. */
  Missions.noteRun({ floor: maxFloor, coins: coinsThisRun, score: score,
                     combo: comboTotal, counts: firstDeath });

  /* Global leaderboard. Fire-and-forget on purpose: submitFloor() always
     resolves, and nothing on the game-over screen waits for it. Submits the
     lifetime best rather than this run's floor, so a player whose device was
     offline for their best run still gets ranked on the next one. */
  Leaderboard.submitFloor(Save.data.bestFloor);
  updHud();

  var newSkins = Shop.reconcileMilestones();

  $('oFloor').textContent = '🏔 Highest floor: ' + maxFloor +
    (startFloor ? ' (' + climbed + ' climbed)' : '');
  $('oCombo').textContent = '❄️ Combo points: ' + comboTotal;
  $('oScore').textContent =
    '✦ Score: ' + score + (isBest && score > 0 ? '  — NEW BEST!' : '');
  $('oCoins').textContent = coinsLine();
  $('oQuip').textContent =
    newSkins.length ? ('🎁 Unlocked: ' + newSkins.map(function (s) { return s.name; }).join(', ') + '! Grab it in the shop.') :
    /* judged on floors CLIMBED: a head start that dies on its first
       platform is not "a respectable climb" */
    climbed < 15 ? 'The frost barely had to try. 🥶' :
    climbed < 40 ? 'A respectable climb. The tower nods.' :
    climbed < 80 ? '❄️ Impressive! The frost is sweating. Somehow.' :
    '👑 TOWER LEGEND. The summit whispers your name.';

  /* Revive is offered once per run, and only for a run worth saving. */
  var reviveBtn = $('reviveBtn');
  var canRevive = !revivedThisRun && climbed >= Cfg.revive.minFloor && Ads.rewardedAvailable();
  reviveBtn.classList.toggle('hidden', !canRevive);
  reviveBtn.disabled = false;
  reviveBtn.textContent = '▶ WATCH AD · REVIVE';
  if (canRevive) track('revive_offered', { floor: maxFloor });

  /* Double is offered once per run too, and never for small change. Both
     offers go through rewardedAvailable(), which is false with no ad
     loaded and for Remove Ads owners — so for them the buttons are simply
     not there, rather than there and dead. */
  var doubleBtn = $('doubleBtn');
  var canDouble = !doubledThisRun && coinsThisRun >= Cfg.economy.doubleMinCoins &&
                  Ads.rewardedAvailable();
  doubleBtn.classList.toggle('hidden', !canDouble);
  doubleBtn.disabled = false;
  doubleBtn.textContent = doubleLabel();
  if (canDouble) track('double_offered', { coins: coinsThisRun });

  /* No video loaded (e.g. an earlier "No fill"): ask again now, so the
     NEXT card can offer revive / double. */
  Ads.warmRewarded();

  if (firstDeath) Ads.noteRunFinished(tGame);
  track('run_end', { floor: maxFloor, climbed: climbed, score: score,
                     seconds: Math.round(tGame), snowflakes: coinsThisRun,
                     revived: revivedThisRun, headstart: !!startFloor });

  refreshMenuWallet();
  $('overOv').classList.remove('hidden');
  /* The run is over and the player is reading a score, so the banner goes
     back up here and on the menu - the only two screens that get one. */
  Ads.showBanner();
  /* Re-arm the come-back reminder from this run. No-op until the player
     has claimed a mission and granted the permission. */
  Missions.armReminder();
  if (navigator.vibrate) navigator.vibrate([60, 40, 80]);
}

function doRevive() {
  var btn = $('reviveBtn');
  if (btn.disabled || adBusy || state !== 'over') return;
  adBusy = true;
  btn.disabled = true;
  btn.textContent = 'Loading ad…';
  Ads.showRewarded('revive').then(function (r) {
    adBusy = false;
    if (!r.earned) {
      btn.disabled = false;
      btn.textContent = '▶ WATCH AD · REVIVE';
      Shop.toast(r.unavailable ? 'No video ready — try again in a moment.' : 'Revive cancelled.', true);
      return;
    }
    if (state !== 'over') return;      /* the card was left while the ad ran */
    revivedThisRun = true;
    track('revive_used', { floor: maxFloor });
    $('overOv').classList.add('hidden');
    Ads.hideBanner();
    rescue('#ffd166');
  });
}

function doubleLabel() { return '▶ WATCH AD · DOUBLE ❄ (+' + coinsThisRun + ')'; }

/* Doubles what this run earned. The amount is fixed when the button is
   pressed, so the reward is the number the button showed. */
function doDouble() {
  var btn = $('doubleBtn');
  if (btn.disabled || adBusy || doubledThisRun || state !== 'over') return;
  var amount = coinsThisRun;
  adBusy = true;
  btn.disabled = true;
  btn.textContent = 'Loading ad…';
  Ads.showRewarded('double').then(function (r) {
    adBusy = false;
    if (!r.earned) {
      btn.disabled = false;
      btn.textContent = doubleLabel();
      Shop.toast(r.unavailable ? 'No video ready — try again in a moment.' : 'No reward — the video was closed early.', true);
      return;
    }
    doubledThisRun = true;
    bonusCoins = amount;
    Save.addCoins(amount);
    track('double_used', { coins: amount });
    btn.classList.add('hidden');
    $('oCoins').textContent = coinsLine();
    refreshMenuWallet();
    Shop.toast('❄ +' + amount + ' snowflakes — doubled!');
  });
}

/* ---------- daily mission ---------- */
function renderMission() {
  var v = Missions.view();
  $('missionTile').classList.toggle('hidden', !v);
  $('oMission').classList.toggle('hidden', !v);
  if (!v) { $('oClaimBtn').classList.add('hidden'); return; }

  var claimable = v.done && !v.claimed;
  var claimText = 'CLAIM +' + v.total + ' ❄' + (v.bonus ? ' (streak +' + v.bonus + ')' : '');

  $('miStreak').textContent = v.streak > 0 ? '🔥 ' + v.streak + '-day streak' : '';
  $('miText').textContent = v.text;
  $('miFill').style.width = Math.round(v.progress / v.goal * 100) + '%';
  $('miFoot').textContent =
    v.claimed ? '✓ Claimed. A new mission arrives tomorrow.' :
    v.done ? 'Complete! Claim your reward.' :
    v.progress + ' / ' + v.goal + '  ·  reward ' + v.total + ' ❄';
  $('miClaim').classList.toggle('hidden', !claimable);
  $('miClaim').textContent = claimText;

  $('oMission').textContent =
    v.claimed ? '🎯 Daily mission claimed ✓' :
    v.done ? '🎯 Daily mission complete!' :
    '🎯 ' + v.text + ': ' + v.progress + ' / ' + v.goal;
  $('oClaimBtn').classList.toggle('hidden', !claimable);
  $('oClaimBtn').textContent = claimText;
}

function claimMission() {
  var r = Missions.claim();
  if (!r.ok) return;
  refreshMenuWallet();
  Shop.toast('🎯 +' + r.total + ' ❄' + (r.streak > 1 ? '  ·  🔥 ' + r.streak + '-day streak' : ''));
  /* The ONLY place the notification permission is ever asked for: the
     player has just been paid by the feature the reminder is about. */
  Missions.askPermissionOnce();
}

/* ---------- render ---------- */
function rr(x, y, w, h, r) { ctx.beginPath(); ctx.roundRect(x, y, w, h, r); }
function draw(tSec) {
  /* aurora sky shifting with height */
  var hFac = Math.min(1, maxFloor / 120);
  var sky = ctx.createLinearGradient(0, 0, 0, H);
  sky.addColorStop(0, 'hsl(' + (250 + hFac * 60) + ',60%,' + (10 + hFac * 6) + '%)');
  sky.addColorStop(.55, 'hsl(' + (222 + hFac * 40) + ',58%,' + (20 + hFac * 5) + '%)');
  sky.addColorStop(1, '#1c2b5e');
  ctx.fillStyle = sky; ctx.fillRect(0, 0, W, H);
  /* aurora band */
  var au = ctx.createLinearGradient(0, H * 0.1, W, H * 0.35);
  au.addColorStop(0, 'rgba(80,255,190,0)');
  au.addColorStop(.5, 'rgba(80,255,190,' + (0.10 + hFac * 0.14) + ')');
  au.addColorStop(1, 'rgba(140,120,255,0)');
  ctx.fillStyle = au;
  ctx.beginPath();
  ctx.moveTo(0, H * 0.16);
  for (var x = 0; x <= W; x += 30) ctx.lineTo(x, H * 0.16 + Math.sin(x * 0.01 + tSec / 1.4) * 26);
  ctx.lineTo(W, H * 0.42); ctx.lineTo(0, H * 0.42); ctx.fill();
  /* stars */
  ctx.fillStyle = 'rgba(255,255,255,.8)';
  for (var i = 0; i < 26; i++) {
    var sx = (i * 97) % W, sy = ((i * 61) % Math.floor(H * 0.5));
    ctx.globalAlpha = 0.3 + ((i * 37) % 60) / 100;
    ctx.fillRect(sx, sy, 2, 2);
  }
  ctx.globalAlpha = 1;

  ctx.save();
  if (shake > 0) { shake *= 0.85; ctx.translate((Math.random() - .5) * shake, (Math.random() - .5) * shake); }
  ctx.translate(0, -cam);

  /* tower walls */
  var wallG = ctx.createLinearGradient(0, 0, 18, 0);
  wallG.addColorStop(0, '#2a3d7a'); wallG.addColorStop(1, 'rgba(42,61,122,0)');
  ctx.fillStyle = wallG; ctx.fillRect(0, cam, 18, H);
  var wallG2 = ctx.createLinearGradient(W, 0, W - 18, 0);
  wallG2.addColorStop(0, '#2a3d7a'); wallG2.addColorStop(1, 'rgba(42,61,122,0)');
  ctx.fillStyle = wallG2; ctx.fillRect(W - 18, cam, 18, H);

  /* platforms */
  plats.forEach(function (p) {
    if (p.broken) return;
    ctx.save();
    if (p.type === 'crack' && p.tm > 0) ctx.translate((Math.random() - .5) * 3, 0);
    var g = ctx.createLinearGradient(0, p.y, 0, p.y + p.h);
    if (p.type === 'base') { g.addColorStop(0, '#7ba7d9'); g.addColorStop(1, '#4a76ad'); }
    else if (p.type === 'move') { g.addColorStop(0, '#b39ddb'); g.addColorStop(1, '#7e57c2'); }
    else if (p.type === 'crack') { g.addColorStop(0, '#ffe0b2'); g.addColorStop(1, '#e0a96b'); }
    else { g.addColorStop(0, '#c9ecff'); g.addColorStop(1, '#79bde8'); }
    ctx.fillStyle = g; rr(p.x, p.y, p.w, p.h, 8); ctx.fill();
    ctx.fillStyle = 'rgba(255,255,255,.55)';
    rr(p.x + 4, p.y + 2, Math.max(10, p.w * 0.35), 4, 2); ctx.fill();
    if (p.type === 'crack') {
      ctx.strokeStyle = 'rgba(90,60,20,.5)'; ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.moveTo(p.x + p.w * 0.3, p.y + 2); ctx.lineTo(p.x + p.w * 0.45, p.y + 12);
      ctx.moveTo(p.x + p.w * 0.7, p.y + 3); ctx.lineTo(p.x + p.w * 0.6, p.y + 13);
      ctx.stroke();
    }
    /* floor marker every 10 */
    if (p.f > 0 && p.f % 10 === 0) {
      ctx.fillStyle = 'rgba(255,255,255,.75)';
      ctx.font = '800 12px sans-serif'; ctx.textAlign = 'left';
      ctx.fillText('— ' + p.f + ' —', p.x + p.w + 8, p.y + 12);
    }
    ctx.restore();
  });

  /* player — the skin owns everything from here */
  ctx.save();
  ctx.translate(P.x, P.y);
  if (shieldActive) {
    /* drawn before the skin, which is free to leave the context dirty */
    ctx.strokeStyle = 'rgba(143,232,255,.9)'; ctx.lineWidth = 2.5;
    ctx.beginPath(); ctx.arc(0, 0, P.r + 7 + Math.sin(tSec * 5) * 1.5, 0, 7); ctx.stroke();
  }
  if (graceTimer > 0) ctx.globalAlpha = 0.45 + Math.abs(Math.sin(tSec * 12)) * 0.55;
  Skins.draw(ctx, Save.data.skin, P.r, P.vx, P.vy, tSec);
  ctx.restore();
  ctx.globalAlpha = 1;

  /* particles */
  parts.forEach(function (p) {
    ctx.globalAlpha = Math.max(0, p.life); ctx.fillStyle = p.c;
    ctx.beginPath(); ctx.arc(p.x, p.y, p.r, 0, 7); ctx.fill();
  });
  ctx.globalAlpha = 1;

  /* frost line */
  if (state === 'play' || state === 'pause' || state === 'over') {
    var fg = ctx.createLinearGradient(0, frostY - 70, 0, frostY + 200);
    fg.addColorStop(0, 'rgba(160,230,255,0)');
    fg.addColorStop(.35, 'rgba(160,230,255,.55)');
    fg.addColorStop(1, 'rgba(210,245,255,.95)');
    ctx.fillStyle = fg; ctx.fillRect(0, frostY - 70, W, H + 300);
    ctx.strokeStyle = 'rgba(255,255,255,.9)'; ctx.lineWidth = 3;
    ctx.beginPath();
    for (var fx = 0; fx <= W; fx += 24) ctx.lineTo(fx, frostY + Math.sin(fx * 0.08 + tSec * 3.3) * 6);
    ctx.stroke();
  }
  ctx.restore();

  /* snow (screen space) */
  ctx.fillStyle = 'rgba(255,255,255,.85)';
  snow.forEach(function (s) {
    var sx = ((s.x * W) + Math.sin(tSec + s.w) * 22 + W) % W;
    var sy = ((s.y * H) + tSec * s.v) % H;
    ctx.globalAlpha = 0.35 + s.s * 0.18;
    ctx.beginPath(); ctx.arc(sx, sy, s.s, 0, 7); ctx.fill();
  });
  ctx.globalAlpha = 1;
}

/* Everything on the menu and the game-over card that mirrors the save:
   the wallet, the daily mission, and what the next run will spend. */
function refreshMenuWallet() {
  $('menuWallet').textContent = '❄ ' + Save.data.coins;
  var pu = Save.data.powerups, bits = [];
  if (pu.shield > 0) bits.push(Cfg.powerups.shield.icon + ' Shield');
  if (pu.headstart > 0) bits.push(Cfg.powerups.headstart.icon + ' Head start');
  var next = bits.length ? 'Next run: ' + bits.join(' + ') : '';
  ['menuNextRun', 'overNextRun'].forEach(function (id) {
    $(id).textContent = next;
    $(id).classList.toggle('hidden', !next);
  });
  renderMission();
}

/* ---------- loop ---------- */
var last = performance.now();
function loop(now) {
  var dt = (now - last) / 1000; last = now; if (dt > 0.05) dt = 0.05;
  var tSec = now / 1000;
  step(dt);
  draw(tSec);
  if (Shop.isOpen()) Shop.tick(tSec);
  requestAnimationFrame(loop);
}

/* ---------- boot ----------
   The world is built immediately so the render loop never sees an empty
   state, then persistence and the two SDKs settle in the background. */
reset();
Shop.init(shopClosed);
requestAnimationFrame(loop);

/* Each SDK is isolated. A billing failure used to reject this whole chain,
   which silently skipped Ads.init() as well — one TypeError in billing.init
   took out purchases AND ads at once. Wrapping each step means the worst a
   broken SDK can do now is disable itself. */
/* NOT named step() — there is already a step(dt) physics function above,
   and a second function declaration silently wins the hoist, so the game
   loop ends up calling this instead and the climber never moves. */
function bootStep(label, fn) {
  return Promise.resolve()
    .then(fn)
    .catch(function (e) { console.warn('[boot] ' + label + ' failed:', e); });
}

if (window.RatePrompt) RatePrompt.init({
  appName: 'Frost Tower',
  packageId: 'com.ahmadessam.frosttower',
  config: Cfg,          // per-platform store link + name (config.js)
  everyN: 2,
  onChoice: function (action) { track('rate_prompt', { action: action }); },
  colors: { card: '#fff', text: '#3a3350', title: '#2e6fb0', muted: '#5b5470',
            accent: 'linear-gradient(180deg,#5cc8ff,#2e9be6)', accentText: '#fff' }
});

Save.load().catch(function (e) {
  console.warn('[boot] save load failed:', e);
}).then(function () {
  best = Save.data.best;
  updHud();
  /* The saved ad cadence, and the last known Remove Ads answer so an
     owner is not shown a banner in the gap before billing replies. */
  Ads.loadCadence();
  Ads.setRemoveAds(Save.data.noAds);
  var rolled = Missions.sync();
  if (rolled.carried) Shop.toast('🎯 Yesterday’s mission: +' + rolled.carried + ' ❄');
  refreshMenuWallet();
  Shop.reconcileMilestones();
  $('menuMoreBtn').classList.toggle('hidden', !liveGames().length);
  wireApp();

  /* The two SDKs start together and never wait on each other. Chaining them
     meant a slow billing call delayed ads indefinitely — on an offline
     device getOfferings() simply never settles, and ads stayed dead even
     though nothing had actually failed. Isolation alone was not enough;
     they had to be decoupled in time as well. */
  var billingReady = bootStep('billing', function () {
    return Billing.init();
  }).then(function () {
    return bootStep('entitlements', function () {
      // Applies Remove Ads too. Safe after Ads.init(): seamAdDue() re-checks
      // the flag at show time, so at worst one preload is wasted.
      Shop.reconcileEntitlements();
      if (Shop.isOpen()) Shop.render();
    });
  });

  var adsReady = bootStep('ads', function () { return Ads.init(); });

  /* The boot menu's banner. Every other banner is raised by a screen
     change, and booting INTO the menu is not one, so until now the first
     menu of every session had no banner at all. It waits for the ad SDK
     and — briefly — for billing, so a Remove Ads owner whose entitlement
     arrives a moment later is not shown one. Never over a run: by the
     time this fires the player may already be climbing. */
  var billingOrTimeout = Promise.race([
    billingReady,
    new Promise(function (r) { setTimeout(r, 3000); })
  ]);
  Promise.all([adsReady, billingOrTimeout]).then(function () {
    if (state === 'menu' || state === 'over') Ads.showBanner();
    // Videos may only now be loadable: nothing to re-render on the menu,
    // and the game-over card re-reads availability each time it opens.
  });

  /* Re-arm the come-back reminder for this session (no-op before the
     first mission claim). */
  bootStep('reminder', function () { return Missions.armReminder(); });

  var boardReady = bootStep('leaderboard', function () {
    return Leaderboard.init().then(function () {
      // Only offer the button once the plugin is genuinely there. Sign-in can
      // still be refused later; show() handles that and tells the player.
      if (Leaderboard.available) {
        document.getElementById('menuBoardBtn').classList.remove('hidden');
      }
      // Catch up anyone whose best predates the leaderboard existing.
      if (Save.data.bestFloor > 0) Leaderboard.submitFloor(Save.data.bestFloor);
    });
  });

  return Promise.all([billingReady, adsReady, boardReady]);
}).then(function () {
  if (Shop.isOpen()) Shop.render();
});

/* Handle for the test suites and the hardware-back listener. _debug
   exists so a test can stage a death without playing to one. */
window.FTGame = {
  state: function () { return state; },
  pause: pauseRun,
  resume: resumeRun,
  handleBack: handleBack,
  startRun: startRun,
  refresh: refreshMenuWallet,
  _debug: {
    info: function () {
      return { state: state, maxFloor: maxFloor, startFloor: startFloor, score: score,
               shield: shieldActive, coinsThisRun: coinsThisRun, tGame: tGame,
               frostY: frostY, playerY: P.y, revived: revivedThisRun };
    },
    set: function (o) {
      if (o.maxFloor !== undefined) { maxFloor = o.maxFloor; lastFloor = o.maxFloor; }
      if (o.score !== undefined) score = o.score;
      if (o.tGame !== undefined) tGame = o.tGame;
      if (o.comboTotal !== undefined) comboTotal = o.comboTotal;
    },
    die: die
  }
};

})();
