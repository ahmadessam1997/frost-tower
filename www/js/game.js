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
    Leaderboard = window.FTLeaderboard;

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

/* ---------- state ---------- */
var state = 'menu', best = 0;
var P, plats, cam, frost, maxFloor, lastFloor, comboTotal, comboStreak, comboTimer,
    score, snow = [], parts = [], shake = 0, tGame = 0;
var frostY = 99999;
var revivedThisRun = false;
var coinsThisRun = 0;
var graceTimer = 0;          /* post-revive invulnerability to the frost */

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
function reset() {
  P = { x: W / 2, y: -20, vx: 0, vy: 0, r: 16, onIce: false };
  plats = [{ f: 0, x: 0, y: 0, w: W, h: 16, type: 'base' }];
  for (var f = 1; f <= 30; f++) plats.push(newPlat(f));
  cam = -H * 0.7; frost = H * 0.6; maxFloor = 0; lastFloor = 0;
  comboTotal = 0; comboStreak = 0; comboTimer = 0; score = 0; tGame = 0;
  parts = []; shake = 0;
  frostY = H * 1.4;
  revivedThisRun = false; coinsThisRun = 0; graceTimer = 0;
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

/* Leaving the app mid-run (an interstitial, the home button) must not
   leave a direction stuck on. */
document.addEventListener('visibilitychange', function () {
  if (document.hidden) { touchStack.length = 0; dir = 0; }
});

/* ---------- screen wiring ---------- */
function startRun() {
  document.getElementById('menu').classList.add('hidden');
  document.getElementById('overOv').classList.add('hidden');
  reset();
  state = 'play';
}
document.getElementById('playBtn').addEventListener('click', startRun);
document.getElementById('againBtn').addEventListener('click', function () {
  /* The interstitial lands between runs, never during one. */
  var el = document.getElementById('overOv');
  el.classList.add('hidden');
  Ads.showInterstitial().then(startRun);
});
document.getElementById('menuShopBtn').addEventListener('click', function () {
  document.getElementById('menu').classList.add('hidden');
  Shop.open();
});
document.getElementById('overShopBtn').addEventListener('click', function () {
  document.getElementById('overOv').classList.add('hidden');
  Shop.open();
});
document.getElementById('reviveBtn').addEventListener('click', doRevive);

/* Global ranking. The button stays hidden until Leaderboard.init() proves the
   plugin is present, so it never appears on a device that cannot use it. */
document.getElementById('menuBoardBtn').addEventListener('click', function () {
  Leaderboard.show().then(function (r) {
    if (r && r.ok) return;
    // Signed-out or unavailable — say so rather than doing nothing visible.
    var el = document.getElementById('menuBoardBtn');
    var was = el.textContent;
    el.textContent = (r && r.error === 'not signed in')
      ? 'Sign in to Play Games to rank'
      : 'Ranking unavailable right now';
    setTimeout(function () { el.textContent = was; }, 2600);
  });
});

/* Where the shop returns to depends on where it was opened from. */
function shopClosed() {
  if (state === 'over') document.getElementById('overOv').classList.remove('hidden');
  else document.getElementById('menu').classList.remove('hidden');
  refreshMenuWallet();
}

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
  if (graceTimer <= 0 && P.y + P.r > frostY) gameOver();
  if (P.y - cam > H + 80) gameOver();

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
function gameOver() {
  if (state !== 'play') return;
  state = 'over'; hideCombo();
  score += comboTotal * 5;
  var isBest = score > best;
  if (isBest) best = score;

  /* Records + wallet. Coins are only awarded once per run even if the
     player revives, because coinsThisRun is subtracted out below. */
  var earned = Math.floor(score / Cfg.economy.coinsPerScore) - coinsThisRun;
  if (earned < 0) earned = 0;
  coinsThisRun += earned;

  Save.data.best = Math.max(Save.data.best, score);
  Save.data.bestFloor = Math.max(Save.data.bestFloor, maxFloor);
  Save.data.coins += earned;
  Save.data.runs++;
  Save.save();
  best = Save.data.best;

  /* Global leaderboard. Fire-and-forget on purpose: submitFloor() always
     resolves, and nothing on the game-over screen waits for it. Submits the
     lifetime best rather than this run's floor, so a player whose device was
     offline for their best run still gets ranked on the next one. */
  Leaderboard.submitFloor(Save.data.bestFloor);
  updHud();

  var newSkins = Shop.reconcileMilestones();

  document.getElementById('oFloor').textContent = '🏔 Highest floor: ' + maxFloor;
  document.getElementById('oCombo').textContent = '❄️ Combo points: ' + comboTotal;
  document.getElementById('oScore').textContent =
    '✦ Score: ' + score + (isBest && score > 0 ? '  — NEW BEST!' : '');
  document.getElementById('oCoins').textContent = '❄ Earned: ' + earned + ' snowflakes';
  document.getElementById('oQuip').textContent =
    newSkins.length ? ('🎁 Unlocked: ' + newSkins.map(function (s) { return s.name; }).join(', ') + '! Grab it in the shop.') :
    maxFloor < 15 ? 'The frost barely had to try. 🥶' :
    maxFloor < 40 ? 'A respectable climb. The tower nods.' :
    maxFloor < 80 ? '❄️ Impressive! The frost is sweating. Somehow.' :
    '👑 TOWER LEGEND. The summit whispers your name.';

  /* Revive is offered once per run, and only for a run worth saving. */
  var reviveBtn = document.getElementById('reviveBtn');
  var canRevive = !revivedThisRun && maxFloor >= 10 && Ads.rewardedAvailable();
  reviveBtn.classList.toggle('hidden', !canRevive);
  reviveBtn.disabled = false;
  reviveBtn.textContent = '▶ WATCH AD · REVIVE';

  Ads.noteRunFinished(tGame);
  document.getElementById('overOv').classList.remove('hidden');
  if (navigator.vibrate) navigator.vibrate([60, 40, 80]);
}

function doRevive() {
  var btn = document.getElementById('reviveBtn');
  if (btn.disabled) return;
  btn.disabled = true;
  btn.textContent = 'Loading ad…';
  Ads.showRewarded().then(function (r) {
    if (!r.earned) {
      btn.disabled = false;
      btn.textContent = '▶ WATCH AD · REVIVE';
      Shop.toast(r.unavailable ? 'No video ready — try again in a moment.' : 'Revive cancelled.', true);
      return;
    }
    revivedThisRun = true;
    document.getElementById('overOv').classList.add('hidden');

    /* Put the player back on solid ground with room to breathe: drop the
       frost well below, clear the fall, and grant a short grace window so
       a slow reaction doesn't waste the reward. */
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
    state = 'play';
    pop(P.x, P.y, '#ffd166', 26);
  });
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
  if (state === 'play' || state === 'over') {
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

function refreshMenuWallet() {
  document.getElementById('menuWallet').textContent = '❄ ' + Save.data.coins;
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

Save.load().catch(function (e) {
  console.warn('[boot] save load failed:', e);
}).then(function () {
  best = Save.data.best;
  updHud();
  refreshMenuWallet();
  Shop.reconcileMilestones();

  /* The two SDKs start together and never wait on each other. Chaining them
     meant a slow billing call delayed ads indefinitely — on an offline
     device getOfferings() simply never settles, and ads stayed dead even
     though nothing had actually failed. Isolation alone was not enough;
     they had to be decoupled in time as well. */
  var billingReady = bootStep('billing', function () {
    return Billing.init();
  }).then(function () {
    return bootStep('entitlements', function () {
      Shop.reconcileEntitlements();
      // Safe to apply after Ads.init(): shouldShowInterstitial() re-checks
      // this flag at show time, so at worst one preload is wasted.
      Ads.setRemoveAds(Billing.owns('remove_ads'));
      if (Shop.isOpen()) Shop.render();
    });
  });

  var adsReady = bootStep('ads', function () { return Ads.init(); });

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

})();
