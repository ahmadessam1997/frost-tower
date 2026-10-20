/* =====================================================================
   Frost Tower — 1.2.0 feature suite
   ---------------------------------------------------------------------
   Covers what test/e2e.js cannot: everything behind the native plugins.
   The page is loaded with FAKE Capacitor plugins (AdMob, Preferences,
   App, LocalNotifications, FirebaseAnalytics, Leaderboard) installed
   before any game script runs, so ads.js / missions.js / analytics.js
   take their real native paths. A second, plain browser page covers the
   mock store and the More-games links.

       node test/features-sim.js          (serves www/ itself)

   Sections: seam-ad cadence, persisted counter, boot banner, double
   snowflakes, revive floor, power-ups, daily mission + streak + reminder,
   pause + back button, Remove Ads, analytics, More games, store product
   ids (iOS remove_ads is frosttower_remove_ads).
   ===================================================================== */
const puppeteer = require('puppeteer');
const http = require('http');
const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..', 'www');
const TYPES = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8',
                '.css': 'text/css; charset=utf-8', '.json': 'application/json; charset=utf-8',
                '.png': 'image/png' };

let passed = 0, failed = 0;
function ok(name, cond, detail) {
  if (cond) { passed++; console.log('  PASS  ' + name); }
  else { failed++; console.log('  FAIL  ' + name + (detail !== undefined ? '  [' + detail + ']' : '')); }
}
const sleep = ms => new Promise(r => setTimeout(r, ms));
const J = JSON.stringify;

function startServer() {
  return new Promise(resolve => {
    const server = http.createServer((req, res) => {
      let rel = decodeURIComponent(req.url.split('?')[0]);
      if (rel === '/') rel = '/index.html';
      const file = path.join(ROOT, path.normalize(rel).replace(/^([/\\])+/, ''));
      if (!file.startsWith(ROOT)) { res.writeHead(403).end(); return; }
      fs.readFile(file, (err, buf) => {
        if (err) { res.writeHead(404).end(); return; }
        res.writeHead(200, { 'Content-Type': TYPES[path.extname(file)] || 'application/octet-stream',
                             'Cache-Control': 'no-store' });
        res.end(buf);
      });
    });
    server.listen(0, () => resolve({ server, port: server.address().port }));
  });
}

/* Runs in the page before any game script. Options come from
   localStorage.__t so each (re)load can be configured:
     owner      seed a save with noAds:true (a Remove Ads owner)
     initDelay  ms AdMob.initialize() takes
     notif      'prompt' | 'granted' | 'denied'   permission state
     save       object merged into the seeded save                      */
function installFakes() {
  let t = {};
  try { t = JSON.parse(localStorage.getItem('__t') || '{}'); } catch (e) {}
  const calls = [], adL = {}, appL = {}, fa = [];
  const ad = { interstitial: true, rewarded: true, ri: true, earn: true, failShow: false };
  const notif = { perm: t.notif || 'prompt', scheduled: [] };
  window.__calls = calls; window.__adL = adL; window.__appL = appL; window.__fa = fa;
  window.__ad = ad; window.__notif = notif;

  /* Never let the rating prompt take a seam away from the ad tests. */
  if (!t.rate) localStorage.setItem('rate_prompt_v1', JSON.stringify({ never: true }));
  if (t.owner || t.save) {
    localStorage.setItem('cap.ft.save', JSON.stringify(Object.assign({ noAds: !!t.owner }, t.save || {})));
  }

  const wait = ms => new Promise(r => setTimeout(r, ms));
  const AdMob = {
    requestConsentInfo: async () => ({ status: 'NOT_REQUIRED', canRequestAds: true }),
    initialize: async () => { if (t.initDelay) await wait(t.initDelay); },
    addListener: (n, f) => { adL[n] = f; },
    prepareInterstitial: async () => { if (!ad.interstitial) throw new Error('no fill'); },
    prepareRewardVideoAd: async () => { if (!ad.rewarded) throw new Error('no fill'); },
    prepareRewardInterstitialAd: async () => { if (!ad.ri) throw new Error('no fill'); },
    showInterstitial: async () => {
      calls.push('showInterstitial');
      if (ad.failShow) throw new Error('show failed');
      setTimeout(() => { adL.interstitialAdShowed(); adL.interstitialAdDismissed(); }, 20);
    },
    showRewardVideoAd: async () => {
      calls.push('showRewardVideoAd');
      await wait(20);
      return ad.earn ? { type: 'snowflakes', amount: 50 } : {};
    },
    showRewardInterstitialAd: async () => {
      calls.push('showRewardInterstitialAd');
      await wait(20);
      return { type: 'snowflakes', amount: 40 };
    },
    showBanner: async () => {
      calls.push('showBanner');
      adL.bannerAdSizeChanged({ width: 320, height: 60 });
      adL.bannerAdLoaded();
    },
    hideBanner: async () => { calls.push('hideBanner'); },
    resumeBanner: async () => { calls.push('resumeBanner'); },
    removeBanner: async () => { calls.push('removeBanner'); }
  };
  const Preferences = {
    get: async o => ({ value: localStorage.getItem('cap.' + o.key) }),
    set: async o => { localStorage.setItem('cap.' + o.key, o.value); }
  };
  const App = {
    addListener: (n, f) => { appL[n] = f; },
    exitApp: async () => { calls.push('exitApp'); }
  };
  const LocalNotifications = {
    checkPermissions: async () => ({ display: notif.perm }),
    requestPermissions: async () => {
      calls.push('requestPermissions');
      if (notif.perm === 'prompt') notif.perm = t.notifAnswer || 'granted';
      return { display: notif.perm };
    },
    cancel: async () => { calls.push('cancelNotification'); },
    schedule: async o => { calls.push('schedule'); notif.scheduled.push(o.notifications[0]); return { notifications: [] }; }
  };
  const FirebaseAnalytics = { logEvent: async e => { fa.push(JSON.parse(JSON.stringify(e))); } };
  const Leaderboard = {
    signIn: async () => { calls.push('signIn'); return { ok: true }; },
    isSignedIn: async () => ({ ok: true }),
    submitScore: async o => { calls.push('submitScore:' + o.score); return { ok: true }; },
    showLeaderboard: async () => ({ ok: true })
  };
  window.Capacitor = {
    isNativePlatform: () => true,
    Plugins: { AdMob, Preferences, App, LocalNotifications, FirebaseAnalytics, Leaderboard }
  };
}

(async () => {
  const { server, port } = await startServer();
  const URL = `http://127.0.0.1:${port}/index.html`;
  const browser = await puppeteer.launch({ headless: 'new', args: ['--no-sandbox', '--disable-gpu'] });

  const errors = [];
  const mkPage = async native => {
    const page = await browser.newPage();
    await page.setViewport({ width: 412, height: 915, deviceScaleFactor: 1 });
    page.on('pageerror', e => errors.push((native ? 'native: ' : 'web: ') + e.message));
    if (native) await page.evaluateOnNewDocument(installFakes);
    await page.goto(URL, { waitUntil: 'domcontentloaded' });
    await sleep(1300);
    return page;
  };

  try {
    const page = await mkPage(true);
    const ev = (fn, arg) => page.evaluate(fn, arg);

    /* Wipe everything and boot again with the given fake options. */
    const fresh = async (opts, settle) => {
      await ev(o => { localStorage.clear(); localStorage.setItem('__t', JSON.stringify(o || {})); }, opts);
      await page.reload({ waitUntil: 'domcontentloaded' });
      await sleep(settle || 1300);
    };
    /* Reload keeping the save (a "cold start"). */
    const coldStart = async () => { await page.reload({ waitUntil: 'domcontentloaded' }); await sleep(1300); };

    /* One staged run, start to game-over card. A Shield needs two deaths. */
    const run = (o) => ev(o => {
      FTGame.startRun();
      FTGame._debug.set(Object.assign({ tGame: 20 }, o || {}));
      FTGame._debug.die();
      if (FTGame.state() === 'play' && !(o && o.keepAlive)) FTGame._debug.die();
    }, o);
    /* The seam: CLIMB AGAIN, then let the fake ad open and close. */
    const again = async () => {
      await ev(() => { FTAds._lastInterstitialAt = 0; document.getElementById('againBtn').click(); });
      await sleep(150);
    };
    const shows = () => ev(() => __calls.filter(c => /^show(Interstitial|RewardInterstitialAd)$/.test(c)));
    const hidden = id => ev(i => document.getElementById(i).classList.contains('hidden'), id);
    const click = id => ev(i => document.getElementById(i).click(), id);

    /* ============ F1a. seam-ad cadence ============ */
    console.log('\nF1a. Seam ads: one cadence, every 3rd is the rewarded interstitial');
    await fresh();
    ok('fake native boot: ads available', await ev(() => FTAds.available === true));
    await run(); await again();
    await run(); await again();
    ok('no ad before 3 counted runs', (await shows()).length === 0, J(await shows()));
    await run();
    ok('due after the 3rd run', await ev(() => { FTAds._lastInterstitialAt = 0; return FTAds.seamAdDue(); }));
    await again();
    ok('1st seam ad is the plain interstitial', J(await shows()) === J(['showInterstitial']), J(await shows()));
    ok('the run starts once the ad closes', await ev(() => FTGame.state() === 'play'));
    ok('the counter is spent by the ad', await ev(() => FTAds._runsSinceAd === 0 && FTAds._seamAdsShown === 1));
    for (let i = 0; i < 3; i++) { await run(); await again(); }
    ok('2nd seam ad is plain too',
       J(await shows()) === J(['showInterstitial', 'showInterstitial']), J(await shows()));
    const coinsBeforeRI = await ev(() => FTSave.data.coins);
    for (let i = 0; i < 3; i++) { await run(); if (i < 2) await again(); }
    const coinsAtCard = await ev(() => FTSave.data.coins);
    await again();
    ok('3rd seam ad is the REWARDED interstitial (was unreachable before)',
       J(await shows()) === J(['showInterstitial', 'showInterstitial', 'showRewardInterstitialAd']), J(await shows()));
    ok('and it pays its 40 snowflakes', await ev(c => FTSave.data.coins === c + 40, coinsAtCard),
       coinsBeforeRI + ' -> ' + coinsAtCard + ' -> ' + await ev(() => FTSave.data.coins));
    for (let i = 0; i < 3; i++) { await run(); await again(); }
    ok('4th goes back to plain', (await shows())[3] === 'showInterstitial', J(await shows()));

    // 5th and 6th: format fallbacks. Seam ad #6 is a rewarded turn.
    await ev(() => { FTAds._interstitialReady = false; __ad.interstitial = false; });
    for (let i = 0; i < 3; i++) { await run(); await again(); }
    ok('plain not loaded -> the rewarded one fills the seam',
       (await shows())[4] === 'showRewardInterstitialAd', J(await shows()));
    await ev(() => { __ad.interstitial = true; FTAds._interstitialReady = true;
                     FTAds._rewardedInterstitialReady = false; __ad.ri = false; });
    for (let i = 0; i < 3; i++) { await run(); await again(); }
    ok('rewarded turn but not loaded -> plain fills the seam',
       (await shows())[5] === 'showInterstitial', J(await shows()));

    await ev(() => { FTAds._rewardedInterstitialReady = false; FTAds._interstitialReady = false; });
    for (let i = 0; i < 3; i++) { await run(); if (i < 2) await again(); }
    const before = (await shows()).length;
    await again();
    ok('nothing loaded -> no ad, and the seam stays due',
       (await shows()).length === before && await ev(() => FTAds._runsSinceAd === 3));
    await ev(() => { FTAds._interstitialReady = true; __ad.failShow = true; });
    await run(); await again();
    ok('a failed show hands the counter back',
       await ev(() => FTAds._runsSinceAd >= 3 && FTAds._seamBusy === false),
       await ev(() => FTAds._runsSinceAd));
    ok('and the player is not stranded', await ev(() => FTGame.state() === 'play'));

    /* ============ F4. persisted counter ============ */
    console.log('\nF4. Ad cadence survives a cold start');
    await fresh();
    await run(); await again();
    await run({ tGame: 3 }); await again();          // too short to count
    await run();
    ok('counted runs are written to the save', await ev(() => FTSave.data.adRuns === 2), await ev(() => FTSave.data.adRuns));
    await coldStart();
    ok('counter restored after a reload', await ev(() => FTAds._runsSinceAd === 2), await ev(() => FTAds._runsSinceAd));
    await run();
    await again();
    ok('3rd run across the restart shows the ad', J(await shows()) === J(['showInterstitial']), J(await shows()));
    await coldStart();
    ok('seam-ad count is persisted too', await ev(() => FTAds._seamAdsShown === 1 && FTAds._runsSinceAd === 0));

    /* ============ F1b. boot banner ============ */
    console.log('\nF1b. Banner on the boot menu');
    await fresh();
    ok('banner is shown on the boot menu', await ev(() => __calls.includes('showBanner') && FTGame.state() === 'menu'), J(await ev(() => __calls)));
    ok('cards are padded clear of it',
       await ev(() => getComputedStyle(document.documentElement).getPropertyValue('--banner-h').trim() === '60px'));
    ok('boot never raises the Play Games sign-in sheet (isSignedIn only)',
       await ev(() => !__calls.includes('signIn') && FTLeaderboard.available), J(await ev(() => __calls)));
    await click('playBtn');
    ok('banner hidden when a run starts',
       await ev(() => __calls.includes('hideBanner') &&
                      getComputedStyle(document.documentElement).getPropertyValue('--banner-h').trim() === '0px'));
    await fresh({ initDelay: 900 }, 300);
    await click('playBtn');
    await sleep(1500);
    ok('never raised over a run that started before ads were ready',
       await ev(() => FTAds.available && !__calls.includes('showBanner') && FTGame.state() === 'play'), J(await ev(() => __calls)));
    await fresh({ owner: true });
    ok('Remove Ads owner gets no boot banner',
       await ev(() => FTAds.removeAdsOwned === true && !__calls.includes('showBanner')), J(await ev(() => __calls)));

    /* ============ F2. double snowflakes ============ */
    console.log('\nF2. Double snowflakes');
    await fresh();
    await run({ score: 500, maxFloor: 12 });
    const c0 = await ev(() => FTSave.data.coins);
    ok('run paid 20 snowflakes', c0 === 20, c0);
    ok('double button offered', !(await hidden('doubleBtn')));
    ok('it says what it adds', /\+20/.test(await ev(() => document.getElementById('doubleBtn').textContent)));
    await ev(() => { __ad.earn = false; });
    await click('doubleBtn'); await sleep(120);
    ok('video closed early pays nothing and keeps the offer',
       await ev(() => FTSave.data.coins === 20) && !(await hidden('doubleBtn')));
    await ev(() => { __ad.earn = true; FTAds._rewardedReady = true; });
    await click('doubleBtn'); await sleep(120);
    ok('watching doubles the run', await ev(() => FTSave.data.coins === 40), await ev(() => FTSave.data.coins));
    ok('button gone after use', await hidden('doubleBtn'));
    ok('card shows the doubled total', /Earned: 40 snowflakes \(doubled!\)/.test(await ev(() => document.getElementById('oCoins').textContent)),
       await ev(() => document.getElementById('oCoins').textContent));
    await ev(() => { FTAds._rewardedReady = true; document.getElementById('doubleBtn').click(); });
    await sleep(120);
    ok('only once per run', await ev(() => FTSave.data.coins === 40));
    await ev(() => { FTAds._rewardedReady = true; });
    await run({ score: 50, maxFloor: 12 });
    ok('not offered for small change', await hidden('doubleBtn'));
    await ev(() => { FTAds._rewardedReady = false; });
    await run({ score: 500, maxFloor: 12 });
    ok('hidden when no video is loaded', (await hidden('doubleBtn')) && (await hidden('reviveBtn')));
    /* A "No fill" used to be final for the session: rewarded videos were
       only re-requested after one had been shown. */
    await ev(() => { __ad.rewarded = false; FTAds._rewardedReady = false; });
    await run({ score: 500, maxFloor: 12 }); await sleep(50);
    ok('a no-fill leaves the offers off', await ev(() => !FTAds._rewardedReady) && (await hidden('doubleBtn')));
    await ev(() => { __ad.rewarded = true; });
    await run({ score: 500, maxFloor: 12 }); await sleep(50);
    ok('...and the next game over asks for a video again', await ev(() => FTAds._rewardedReady === true));
    await run({ score: 500, maxFloor: 12 });
    ok('so the card after that offers double again', !(await hidden('doubleBtn')));

    /* ============ F3. revive floor ============ */
    console.log('\nF3. Revive from floor 5');
    await fresh();
    await run({ maxFloor: 4 });
    ok('no revive at floor 4', await hidden('reviveBtn'));
    await run({ maxFloor: 5 });
    ok('revive offered at floor 5', !(await hidden('reviveBtn')));
    const runsBefore = await ev(() => FTSave.data.runs);
    await click('reviveBtn'); await sleep(150);
    ok('revive puts the player back in the run', await ev(() => FTGame.state() === 'play' && FTGame._debug.info().revived));
    await ev(() => { FTAds._rewardedReady = true; FTGame._debug.die(); });
    ok('revive is once per run', await hidden('reviveBtn'));
    ok('a revived run still counts as ONE run', await ev(n => FTSave.data.runs === n, runsBefore),
       runsBefore + ' -> ' + await ev(() => FTSave.data.runs));

    /* ============ F5. power-ups ============ */
    console.log('\nF5. Power-ups');
    await fresh();
    await ev(() => { FTSave.data.coins = 95; FTShop.open(); });
    ok('shop lists both power-ups', await ev(() => document.querySelectorAll('#powerupList .pu-tile').length === 2));
    await click('buy_shield');
    ok('shield bought with snowflakes', await ev(() => FTSave.data.coins === 45 && FTSave.data.powerups.shield === 1), J(await ev(() => [FTSave.data.coins, FTSave.data.powerups])));
    await click('buy_headstart');
    ok('head start bought', await ev(() => FTSave.data.coins === 5 && FTSave.data.powerups.headstart === 1));
    ok('cannot buy without the snowflakes',
       await ev(() => FTShop.buyPowerup('shield') === false && FTSave.data.coins === 5 && FTSave.data.powerups.shield === 1));
    ok('buy button disabled when short', await ev(() => document.getElementById('buy_shield').disabled));
    await ev(() => FTShop.close());
    ok('menu says what the next run will use',
       /Shield.*Head start/.test(await ev(() => document.getElementById('menuNextRun').textContent)));
    await coldStart();
    ok('stock survives a restart', await ev(() => FTSave.data.powerups.shield === 1 && FTSave.data.powerups.headstart === 1));

    await ev(() => FTGame.startRun());
    let inf = await ev(() => FTGame._debug.info());
    ok('head start: run begins on floor 15', inf.startFloor === 15 && inf.maxFloor === 15, J(inf));
    ok('shield armed', inf.shield === true);
    ok('both are consumed by that run', await ev(() => FTSave.data.powerups.shield === 0 && FTSave.data.powerups.headstart === 0));
    ok('a head start scores nothing for the skipped floors', inf.score === 0);
    await ev(() => { FTGame._debug.set({ maxFloor: 22, tGame: 20 }); FTGame._debug.die(); });
    inf = await ev(() => FTGame._debug.info());
    ok('shield survives the first death', inf.state === 'play' && inf.shield === false, J(inf));
    ok('and puts the frost back below the player', inf.frostY > inf.playerY);
    await ev(() => FTGame._debug.die());
    ok('the second death ends the run', await ev(() => FTGame.state() === 'over'));
    ok('record counts only floors CLIMBED on a head-start run',
       await ev(() => FTSave.data.bestFloor === 7), await ev(() => FTSave.data.bestFloor));
    ok('the card says so', /22 \(7 climbed\)/.test(await ev(() => document.getElementById('oFloor').textContent)),
       await ev(() => document.getElementById('oFloor').textContent));
    await sleep(50);
    ok('the global board is sent the climbed floors, not 22',
       await ev(() => __calls.filter(c => /^submitScore/.test(c)).join() === 'submitScore:7'),
       J(await ev(() => __calls.filter(c => /^submitScore/.test(c)))));
    await ev(() => { FTSave.data.powerups.headstart = 1; FTAds._rewardedReady = true; });
    await run({ maxFloor: 18 });
    ok('revive floor is measured in climbed floors too (18 = 3 climbed)', await hidden('reviveBtn'));
    await ev(() => FTGame.startRun());
    ok('a normal run starts on floor 0 again', await ev(() => FTGame._debug.info().startFloor === 0));
    ok('stock is capped', await ev(() => {
      FTSave.data.coins = 99999; FTSave.data.powerups.shield = FTConfig.powerups.maxStock;
      return FTShop.buyPowerup('shield') === false && FTSave.data.coins === 99999;
    }));
    ok('one decent run or one shop video buys a power-up',
       await ev(() => FTConfig.powerups.shield.price <= FTConfig.economy.rewardedAdCoins &&
                      FTConfig.powerups.headstart.price <= FTConfig.economy.rewardedAdCoins));

    /* ============ F7. daily mission, streak, reminder ============ */
    console.log('\nF7. Daily mission + streak + reminder');
    await fresh();
    const dates = await ev(() => {
      const M = FTMissions, n = FTConfig.missions.list.length;
      const d0 = M.dayNumber(new Date(2026, 9, 1, 12));
      let repeats = 0, stable = true; const seen = {};
      for (let i = 0; i < 800; i++) {
        const a = M.missionFor(d0 + i), b = M.missionFor(d0 + i + 1);
        if (a.id === b.id) repeats++;
        if (M.missionFor(d0 + i).id !== a.id) stable = false;
        seen[a.id] = true;
      }
      return {
        repeats, stable, kinds: Object.keys(seen).length, n,
        // 8 March 2026 is a 23-hour day in the US, 25 Oct 2026 a 25-hour one in the EU.
        dst1: M.dayNumber(new Date(2026, 2, 9, 0, 30)) - M.dayNumber(new Date(2026, 2, 8, 23, 30)),
        dst2: M.dayNumber(new Date(2026, 9, 26, 0, 30)) - M.dayNumber(new Date(2026, 9, 25, 23, 30)),
        year: M.dayNumber(new Date(2027, 0, 1, 0, 5)) - M.dayNumber(new Date(2026, 11, 31, 23, 55)),
        sameDay: M.dayNumber(new Date(2026, 9, 1, 0, 1)) === M.dayNumber(new Date(2026, 9, 1, 23, 59)),
        cap: M.bonusFor(1) === 0 && M.bonusFor(2) === 10 && M.bonusFor(6) === 50 && M.bonusFor(40) === 50
      };
    });
    ok('the same day always gets the same mission', dates.stable);
    ok('never the same mission two days running (800 days)', dates.repeats === 0, dates.repeats);
    ok('every mission in the list comes up', dates.kinds === dates.n, dates.kinds + '/' + dates.n);
    ok('a calendar day is one day, 00:01 to 23:59', dates.sameDay);
    ok('midnight is +1 day across DST changes and New Year', dates.dst1 === 1 && dates.dst2 === 1 && dates.year === 1, J(dates));
    ok('streak bonus: +10 a day, capped at +50', dates.cap);

    /* Pin the calendar. __day moves it. */
    const setDay = n => ev(n => {
      window.__day = n;
      FTMissions._now = () => new Date(2026, 9, 10 + window.__day, 12, 0, 0);
      FTGame.refresh();
    }, n);
    /* Finish today's mission through noteRun, whatever its type. */
    const finish = () => ev(() => {
      const v = FTMissions.view();
      for (let i = 0; i < v.goal && !FTMissions.view().done; i++) {
        FTMissions.noteRun({ floor: 9999, coins: 9999, score: 999999, combo: 9999 });
      }
      FTGame.refresh();
      return FTMissions.view();
    });
    await setDay(0);
    let v = await ev(() => FTMissions.view());
    ok('menu shows today’s mission', !(await hidden('missionTile')) &&
       await ev(t => document.getElementById('miText').textContent === t, v.text), v.text);
    ok('nothing to claim yet', await ev(() => FTMissions.claim().ok === false) && (await hidden('miClaim')));
    ok('no permission dialog and no reminder before a claim',
       await ev(() => !__calls.includes('requestPermissions') && !__calls.includes('schedule')), J(await ev(() => __calls)));

    // Progress through a REAL game over, with stats one short of every goal type.
    await ev(() => {
      const d = FTConfig.missions.list.find(m => m.id === FTMissions.view().id);
      window.__short = d.type === 'runs' ? {} :
        d.type === 'floor' ? { maxFloor: d.goal - 1 } :
        d.type === 'score' ? { score: d.goal - 1 } :
        d.type === 'coins' ? { score: d.goal * 25 - 1 } : { comboTotal: d.goal - 1 };
    });
    await run(await ev(() => window.__short));
    v = await ev(() => FTMissions.view());
    ok('a run short of the goal does not finish it',
       v.id.indexOf('runs') === 0 ? v.progress === 1 && !v.done : v.progress > 0 && !v.done, J(v));
    ok('game-over card shows the mission line', /🎯/.test(await ev(() => document.getElementById('oMission').textContent)));
    await run({ keepAlive: true });   // (no shield: this is an ordinary second run)
    ok('still no permission dialog after playing', await ev(() => !__calls.includes('requestPermissions') && !__calls.includes('schedule')));

    v = await finish();
    ok('mission completes', v.done && !v.claimed, J(v));
    ok('claim button appears on the menu and the card', !(await hidden('miClaim')) && !(await hidden('oClaimBtn')));
    const w0 = await ev(() => FTSave.data.coins);
    await click('oClaimBtn'); await sleep(150);
    let v2 = await ev(() => FTMissions.view());
    ok('claim pays the reward', await ev(a => FTSave.data.coins === a[0] + a[1], [w0, v.reward]), w0 + ' +' + v.reward);
    ok('streak starts at 1, no bonus on day one', v2.streak === 1 && v2.claimed && v.bonus === 0, J(v2));
    ok('claim buttons go away', (await hidden('miClaim')) && (await hidden('oClaimBtn')));
    ok('cannot claim twice', await ev(a => FTMissions.claim().ok === false && FTSave.data.coins === a[0] + a[1], [w0, v.reward]));
    ok('the FIRST claim is what asks for notifications',
       await ev(() => __calls.filter(c => c === 'requestPermissions').length === 1), J(await ev(() => __calls)));
    const rem = await ev(() => {
      const n = __notif.scheduled[__notif.scheduled.length - 1];
      return n && { id: n.id, exact: n.isExactNotification,
                    hours: (new Date(n.schedule.at) - FTMissions._now()) / 3600000, body: n.body };
    });
    ok('reminder scheduled ~24 h out', !!rem && Math.abs(rem.hours - 24) < 0.01, J(rem));
    ok('as an INEXACT alarm (no exact-alarm permission)', !!rem && rem.exact === false);
    ok('it mentions the streak', !!rem && /1-day streak/.test(rem.body), rem && rem.body);
    const sched0 = await ev(() => __notif.scheduled.length);
    await run();
    ok('every run re-arms the reminder', await ev(n => __notif.scheduled.length === n + 1, sched0));

    await setDay(1);
    v = await ev(() => FTMissions.view());
    ok('next day: a new mission, progress reset, streak kept alive',
       v.id !== v2.id && v.progress === 0 && !v.done && v.streak === 1, J(v));
    v = await finish();
    ok('day 2 offers the streak bonus', v.bonus === 10 && v.total === v.reward + 10, J(v));
    const w1 = await ev(() => FTSave.data.coins);
    await click('miClaim'); await sleep(150);
    ok('day-2 claim pays reward + 10 and makes it a 2-day streak',
       await ev(a => FTSave.data.coins === a[0] + a[1] && FTMissions.view().streak === 2, [w1, v.total]));
    ok('permission is not asked a second time',
       await ev(() => __calls.filter(c => c === 'requestPermissions').length === 1));

    await setDay(3);                                    // day 2 skipped
    v = await ev(() => FTMissions.view());
    ok('a missed day breaks the streak', v.streak === 0 && v.bonus === 0, J(v));
    v = await finish();
    await setDay(4);                                    // finished on day 3, never claimed
    const w2 = await ev(() => FTSave.data.coins);
    const carried = await ev(() => FTMissions.sync().carried);
    // setDay() already rolled over (refresh -> view -> sync), so read the wallet instead.
    ok('a finished-but-unclaimed mission is paid at rollover',
       carried === 0 && await ev(() => FTSave.data.daily.lastClaim === FTMissions.today() - 1 && FTSave.data.daily.streak === 1),
       J(await ev(() => FTSave.data.daily)));
    ok('and that payout continues the streak',
       (await ev(() => FTMissions.view())).streak === 1 && w2 > 0);

    // 'runs' missions: the second death of a revived run is not another run.
    ok('a revive does not count as a second run for "play N runs"', await ev(() => {
      const runs = FTConfig.missions.list.find(m => m.type === 'runs');
      FTSave.data.daily.id = runs.id; FTSave.data.daily.progress = 0; FTSave.data.daily.done = false;
      FTMissions.noteRun({ counts: true }); FTMissions.noteRun({ counts: false });
      return FTSave.data.daily.progress === 1;
    }));

    await fresh({ notifAnswer: 'denied' });
    await setDay(0); await finish(); await click('miClaim'); await sleep(150);
    ok('permission refused -> asked once, nothing scheduled',
       await ev(() => __calls.filter(c => c === 'requestPermissions').length === 1 && !__calls.includes('schedule')));
    await run();
    ok('and never asked again', await ev(() => __calls.filter(c => c === 'requestPermissions').length === 1 && !__calls.includes('schedule')));
    await coldStart();
    ok('nor at the next launch', await ev(() => !__calls.includes('requestPermissions') && !__calls.includes('schedule')));

    /* ============ F6. pause + back ============ */
    console.log('\nF6. Pause and the back button');
    await fresh();
    ok('back and pause listeners registered with @capacitor/app',
       await ev(() => typeof __appL.backButton === 'function' && typeof __appL.pause === 'function'));
    ok('no pause button on the menu', await hidden('pauseBtn'));
    await click('playBtn');
    ok('pause button shown in a run', !(await hidden('pauseBtn')));
    await sleep(300);
    await click('pauseBtn');
    ok('pause button pauses', await ev(() => FTGame.state() === 'pause') && !(await hidden('pauseOv')));
    const p1 = await ev(() => FTGame._debug.info());
    await sleep(500);
    const p2 = await ev(() => FTGame._debug.info());
    ok('the run is frozen while paused', p1.playerY === p2.playerY && p1.frostY === p2.frostY && p1.tGame === p2.tGame, J([p1, p2]));
    ok('no banner over a paused run', await ev(() => __calls.lastIndexOf('showBanner') < __calls.lastIndexOf('hideBanner')));
    await click('resumeBtn');
    await sleep(200);
    const p3 = await ev(() => FTGame._debug.info());
    ok('resume continues it', p3.state === 'play' && p3.tGame > p2.tGame && (await hidden('pauseOv')));

    ok('back in a run -> pause', await ev(() => { __appL.backButton(); return FTGame.state() === 'pause'; }));
    ok('back when paused -> resume', await ev(() => FTGame.handleBack() === 'resume' && FTGame.state() === 'play'));
    ok('app to background -> auto-pause', await ev(() => { __appL.pause(); return FTGame.state() === 'pause'; }));
    await ev(() => FTGame.resume());
    ok('page hidden -> auto-pause', await ev(() => {
      Object.defineProperty(document, 'hidden', { value: true, configurable: true });
      document.dispatchEvent(new Event('visibilitychange'));
      Object.defineProperty(document, 'hidden', { value: false, configurable: true });
      return FTGame.state() === 'pause';
    }));
    await ev(() => FTGame._debug.set({ score: 250 }));
    await click('endRunBtn');
    ok('END RUN goes to the game-over card and banks the snowflakes',
       await ev(() => FTGame.state() === 'over' && FTSave.data.coins === 10) && (await hidden('pauseOv')),
       await ev(() => FTSave.data.coins));
    ok('pause button gone on the game-over card', await hidden('pauseBtn'));
    await click('overShopBtn');
    ok('back in the shop -> closes it, back to the card',
       await ev(() => FTGame.handleBack() === 'shop' && !FTShop.isOpen()) && !(await hidden('overOv')));
    ok('back on the game-over card -> menu',
       await ev(() => FTGame.handleBack() === 'menu' && FTGame.state() === 'menu') && !(await hidden('menu')) && (await hidden('overOv')));
    await click('menuMoreBtn');
    ok('back on More games -> closes it',
       await ev(() => FTGame.handleBack() === 'more') && (await hidden('moreOv')) && !(await hidden('menu')));
    ok('nothing has exited the app so far', await ev(() => !__calls.includes('exitApp')));
    ok('back on the menu -> exit', await ev(() => FTGame.handleBack() === 'exit' && __calls.includes('exitApp')));
    await fresh({ rate: true });
    await ev(() => { RatePrompt._reset(); RatePrompt.tick(); RatePrompt.tick(); });
    await run();
    await ev(() => document.getElementById('againBtn').click());
    ok('back on the rating prompt -> "Later"',
       await ev(() => RatePrompt.isOpen() && FTGame.handleBack() === 'rate' && !RatePrompt.isOpen() && RatePrompt._state().laters === 1));

    /* ============ Remove Ads ============ */
    console.log('\nF8 / Remove Ads hides every rewarded offer');
    await fresh();
    await ev(() => FTShop.open());
    // (the offer's own copy is checked on the browser page below: with no
    // store plugin here the tile reads "Store unavailable")
    ok('non-owner sees the watch-an-ad faucet', !(await hidden('earnSection')));
    await ev(() => FTShop.close());
    await fresh({ owner: true });
    await ev(() => { FTBilling.entitlements.remove_ads = true; FTShop.open(); });
    const raText = await ev(() => document.getElementById('removeAdsTile').textContent);
    ok('owner copy no longer claims reward videos stay', !/stay optional/i.test(raText) && /reward videos/i.test(raText), raText);
    ok('watch-an-ad faucet hidden for owners', await hidden('earnSection'));
    await ev(() => FTShop.close());
    await ev(() => { FTAds._rewardedReady = true; });
    await run({ score: 800, maxFloor: 30 });
    ok('no revive offer for owners', await hidden('reviveBtn'));
    ok('no double offer for owners', await hidden('doubleBtn'));
    ok('showRewarded refuses outright', await ev(async () => (await FTAds.showRewarded('double')).removed === true));
    await again(); await run(); await again(); await run(); await again(); await run(); await again();
    ok('no seam ads and no banner for owners',
       await ev(() => !__calls.some(c => /^show/.test(c))), J(await ev(() => __calls)));
    // Buying it mid-session, from the game-over card's shop:
    await fresh();
    await ev(() => { FTAds._rewardedReady = true; });
    await run({ score: 800, maxFloor: 30 });
    ok('(offers were there before the purchase)', !(await hidden('reviveBtn')) && !(await hidden('doubleBtn')));
    await click('overShopBtn');
    await ev(() => { FTBilling.state = 'ready'; FTBilling.entitlements.remove_ads = true; FTShop.reconcileEntitlements(); FTShop.close(); });
    ok('offers vanish from the card once Remove Ads is bought',
       (await hidden('reviveBtn')) && (await hidden('doubleBtn')) && await ev(() => FTSave.data.noAds === true));

    /* ============ X1. analytics ============ */
    console.log('\nX1. Analytics');
    await fresh();
    await ev(() => { FTSave.data.coins = 60; FTShop.open(); });
    await click('buy_shield');
    await ev(() => FTShop.close());
    await run({ score: 500, maxFloor: 12, keepAlive: true });   // shield absorbs this one
    await ev(() => { FTGame._debug.die(); });
    await click('doubleBtn'); await sleep(120);
    await ev(() => { FTAds._rewardedReady = true; });
    await click('reviveBtn'); await sleep(150);
    await ev(() => FTGame._debug.die());
    for (let i = 0; i < 3; i++) { await again(); await run(); }
    await setDay(0); await finish(); await click('miClaim'); await sleep(150);
    const fa = await ev(() => __fa);
    const names = fa.map(e => e.name);
    const need = ['run_start', 'run_end', 'revive_offered', 'revive_used', 'double_offered', 'double_used',
                  'shop_open', 'powerup_bought', 'ad_shown', 'rewarded_done', 'mission_done', 'streak_day'];
    const missing = need.filter(n => !names.includes(n));
    ok('events reach the native plugin: ' + need.join(', '), missing.length === 0, 'missing ' + J(missing));
    const end = fa.find(e => e.name === 'run_end');
    ok('run_end carries floor, score, seconds, snowflakes',
       end && ['floor', 'score', 'seconds', 'snowflakes'].every(k => typeof end.params[k] === 'number'), J(end));
    ok('booleans are sent as 0/1', end && (end.params.revived === 0 || end.params.revived === 1), J(end));
    const fmts = fa.filter(e => e.name === 'ad_shown').map(e => e.params.format);
    ok('ad_shown is labelled by format', ['banner', 'rewarded', 'interstitial'].every(f => fmts.includes(f)), J(fmts));
    const plc = fa.filter(e => e.name === 'rewarded_done').map(e => e.params.placement);
    ok('rewarded_done is labelled by placement', plc.includes('double') && plc.includes('revive'), J(plc));
    await fresh({ rate: true });
    await ev(() => { RatePrompt._reset(); RatePrompt.tick(); RatePrompt.tick(); });
    await run();
    await ev(() => document.getElementById('againBtn').click());
    await click('rpLater');
    ok('rate_prompt logs shown + the choice',
       J(await ev(() => __fa.filter(e => e.name === 'rate_prompt').map(e => e.params.action))) === J(['shown', 'later']));
    await page.close();

    /* ---- plain browser page: mock store, no plugins ---- */
    const web = await mkPage(false);
    const wv = (fn, arg) => web.evaluate(fn, arg);
    await wv(() => { localStorage.clear(); });
    await web.reload({ waitUntil: 'domcontentloaded' }); await sleep(1300);
    await wv(() => { window.__opened = []; window.open = u => { window.__opened.push(u); return null; }; });
    ok('browser: analytics no-ops without a plugin and never throws', await wv(() => {
      FTAnalytics.log('x y-z', { a: true, b: undefined, c: 'q'.repeat(300), 'bad key': 1, d: NaN });
      const e = FTAnalytics._log[FTAnalytics._log.length - 1];
      return e.name === 'x_y_z' && e.params.a === 1 && !('b' in e.params) && e.params.c.length === 100 &&
             e.params.bad_key === 1 && !('d' in e.params);
    }));
    await wv(() => { FTSave.data.coins = 300; FTShop.open(); });
    ok('Remove Ads offer says reward videos go too',
       /reward videos included/i.test(await wv(() => document.getElementById('removeAdsTile').textContent)),
       await wv(() => document.getElementById('removeAdsTile').textContent));
    await wv(() => { [...document.querySelectorAll('#skinGrid .skin-btn')].find(b => /^250/.test(b.textContent)).click(); });
    await wv(() => { document.querySelector('#skinGrid .skin-btn.prem').click(); });
    await sleep(100);
    await wv(() => { document.querySelector('#removeAdsTile .skin-btn').click(); });
    await sleep(100);
    const wl = await wv(() => FTAnalytics._log.map(e => e.name + ':' + (e.params.product || e.params.method || '')));
    ok('skin_bought (coins + iap), purchase_start, purchase_done are logged',
       ['skin_bought:coins', 'skin_bought:iap', 'purchase_start:remove_ads', 'purchase_done:remove_ads']
         .every(k => wl.includes(k)), J(wl));
    await wv(() => FTShop.close());

    /* ============ X3. more games ============ */
    console.log('\nX3. More games');
    ok('MORE GAMES button on the menu', await wv(() => !document.getElementById('menuMoreBtn').classList.contains('hidden')));
    await wv(() => document.getElementById('menuMoreBtn').click());
    await sleep(400);
    const rows = await wv(() => [...document.querySelectorAll('#moreList .mg-row')].map(r => ({
      name: r.querySelector('b').textContent, icon: r.querySelector('img').naturalWidth })));
    ok('lists all three sibling games (Trap Jam live since 2026-10-14)',
       J(rows.map(r => r.name)) === J(['Escape Chambers', 'Adaptive Chess', 'Trap Jam']), J(rows));
    ok('icons load from www/img', rows.every(r => r.icon > 0), J(rows));
    await wv(() => document.querySelectorAll('#moreList .mg-row')[0].click());
    await wv(() => document.querySelectorAll('#moreList .mg-row')[1].click());
    await wv(() => document.querySelectorAll('#moreList .mg-row')[2].click());
    ok('each opens its Play listing', J(await wv(() => __opened)) === J([
      'https://play.google.com/store/apps/details?id=com.ahmadessam.escapechambers',
      'https://play.google.com/store/apps/details?id=com.ahmadessam.adaptivechess',
      'https://play.google.com/store/apps/details?id=com.ahmadessam.trapjam']), J(await wv(() => __opened)));
    await wv(() => { FTConfig.moreGames[2].live = false; document.getElementById('moreCloseBtn').click();
                     document.getElementById('menuMoreBtn').click(); });
    ok('flipping live:false in config hides Trap Jam again',
       await wv(() => document.querySelectorAll('#moreList .mg-row').length === 2 &&
                      !/Trap Jam/.test(document.getElementById('moreList').textContent)));
    await wv(() => { FTConfig.moreGames[2].live = true; });
    await web.close();

    /* ============ X4. store product ids ============ */
    console.log('\nX4. Store product ids: Remove Ads is frosttower_remove_ads on the App Store');
    const idp = await mkPage(true);
    const iv = (fn, arg) => idp.evaluate(fn, arg);
    const ids = await iv(() => {
      const out = {};
      for (const os of ['android', 'ios']) {
        Capacitor.getPlatform = () => os;
        out[os] = { to: FTConfig.storeProductId('remove_ads'), back: FTConfig.productIdFromStore('frosttower_remove_ads'),
                    skin: FTConfig.storeProductId('skin_void'), skinBack: FTConfig.productIdFromStore('skin_void') };
      }
      delete Capacitor.getPlatform;
      return out;
    });
    ok('Android: remove_ads is sent to Play unchanged',
       ids.android.to === 'remove_ads' && ids.android.back === 'frosttower_remove_ads' && ids.android.skin === 'skin_void', J(ids.android));
    ok('iOS: remove_ads <-> frosttower_remove_ads, skins untouched',
       ids.ios.to === 'frosttower_remove_ads' && ids.ios.back === 'remove_ads' &&
       ids.ios.skin === 'skin_void' && ids.ios.skinBack === 'skin_void', J(ids.ios));
    /* Re-runs FTBilling.init() against a fake RevenueCat on `os` (the real
       iOS key is not in config.js yet) and records every id the store sees. */
    const storeFlow = os => iv(async os => {
      Capacitor.getPlatform = () => os;
      const asked = [], bought = [];
      const RA = FTConfig.storeProductId('remove_ads');
      Capacitor.Plugins.Purchases = {
        configure: () => {},
        getCustomerInfo: async () => ({ customerInfo: { entitlements: { active: {} },
                                                        allPurchasedProductIdentifiers: [RA] } }),
        getOfferings: async () => ({ all: { default: { availablePackages: [
          { product: { identifier: 'skin_aurora', priceString: 'L$1.99' } }] } } }),
        getProducts: async o => { asked.push(...o.productIdentifiers);
          return { products: o.productIdentifiers.map(i => ({ identifier: i, priceString: 'P:' + i })) }; },
        purchaseStoreProduct: async o => { bought.push(o.product.identifier);
          return { customerInfo: { entitlements: { active: { remove_ads: {} } },
                                   allPurchasedProductIdentifiers: [o.product.identifier] } }; },
        purchasePackage: async o => { bought.push('pkg:' + o.aPackage.product.identifier); return {}; }
      };
      const key = FTConfig.revenueCatKey; FTConfig.revenueCatKey = () => 'test_key';
      FTBilling.entitlements = {}; FTBilling.prices = {}; FTBilling._packages = {}; FTBilling._storeProducts = {};
      const state = await FTBilling.init();
      const ownedAtBoot = FTBilling.owns('remove_ads'), price = FTBilling.prices.remove_ads;
      FTBilling._storeProducts = {};    // take the on-demand getProducts path
      const res = await FTBilling.purchase('remove_ads');
      FTConfig.revenueCatKey = key;
      delete Capacitor.getPlatform;
      return { state, asked, bought, ownedAtBoot, price, ok: res.ok, owned: Object.keys(FTBilling.entitlements) };
    }, os);
    const sfa = await storeFlow('android');
    ok('Android flow: Play asked for remove_ads, bought remove_ads, owned as remove_ads',
       sfa.state === 'ready' && sfa.ok && sfa.ownedAtBoot && sfa.price === 'P:remove_ads' &&
       J(sfa.asked) === J(['remove_ads', 'skin_golden', 'skin_void', 'remove_ads']) &&
       J(sfa.bought) === J(['remove_ads']) && J(sfa.owned) === J(['remove_ads']), J(sfa));
    const sfi = await storeFlow('ios');
    ok('iOS flow: App Store asked for frosttower_remove_ads (price lookup and purchase)',
       sfi.state === 'ready' && sfi.ok &&
       J(sfi.asked) === J(['frosttower_remove_ads', 'skin_golden', 'skin_void', 'frosttower_remove_ads']) &&
       J(sfi.bought) === J(['frosttower_remove_ads']), J(sfi));
    ok('iOS flow: price, restore-at-boot and the purchase all land on remove_ads',
       sfi.price === 'P:frosttower_remove_ads' && sfi.ownedAtBoot && J(sfi.owned) === J(['remove_ads']), J(sfi));
    await idp.close();

    ok('no page errors', errors.length === 0, errors.join(' | '));
  } catch (e) {
    failed++; console.log('HARNESS ERROR:', e);
  } finally {
    await browser.close();
    server.close();
  }
  console.log(`\n  ${passed} passed, ${failed} failed`);
  process.exit(failed ? 1 : 0);
})();
