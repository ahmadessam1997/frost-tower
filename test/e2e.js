/* =====================================================================
   Frost Tower — end-to-end test
   Drives www/ in a real Chromium at phone size and asserts the full
   monetization loop. Run:  node test/e2e.js
   Requires the static server on 8123 (see the npm "serve" script) or
   pass a URL:  node test/e2e.js http://127.0.0.1:8123/index.html
   ===================================================================== */
const puppeteer = require('puppeteer');

const URL = process.argv[2] || 'http://127.0.0.1:8123/index.html';

let pass = 0, fail = 0;
function ok(name, cond, detail) {
  if (cond) { pass++; console.log('  PASS  ' + name); }
  else { fail++; console.log('  FAIL  ' + name + (detail ? '  →  ' + detail : '')); }
}

(async () => {
  const browser = await puppeteer.launch({
    headless: 'new',
    args: ['--no-sandbox', '--disable-gpu', '--window-size=412,915']
  });
  const page = await browser.newPage();
  await page.setViewport({ width: 412, height: 915, deviceScaleFactor: 2.62, isMobile: true, hasTouch: true });

  const consoleErrors = [];
  // favicon.ico is a browser-only request; a Capacitor WebView never makes it.
  const ignorable = /favicon\.ico/;
  page.on('console', m => {
    if (m.type() !== 'error') return;
    // The "Failed to load resource" text has no URL in it — the URL is on
    // the message location, so both have to be checked.
    const where = (m.location() && m.location().url) || '';
    if (ignorable.test(m.text()) || ignorable.test(where)) return;
    consoleErrors.push(m.text() + (where ? ' @ ' + where : ''));
  });
  page.on('pageerror', e => consoleErrors.push('pageerror: ' + e.message));
  page.on('response', r => {
    if (r.status() >= 400 && !ignorable.test(r.url())) consoleErrors.push('HTTP ' + r.status() + ' ' + r.url());
  });

  /* 'domcontentloaded' + an explicit settle, NOT 'networkidle0'.
     networkidle0 waits for a 500ms window with zero in-flight requests and
     it stopped ever firing on this machine: every run died with "Navigation
     timeout of 30000ms exceeded" while the page was demonstrably fine — a
     probe using the same launch showed the app booted with zero pending
     requests. It failed identically on unmodified code, so it was the
     heuristic, not the app. 'load' hung too. The page is local static files
     with no external subresources, so domcontentloaded plus a fixed settle
     is both sufficient and deterministic. The three page.reload() calls
     below were changed for the same reason — they were the last thing still
     timing out after the goto was fixed. */
  await page.goto(URL, { waitUntil: 'domcontentloaded' });
  await page.evaluate(() => new Promise(r => setTimeout(r, 1200)));

  /* ---------------- 1. boot ---------------- */
  console.log('\n1. Boot');
  ok('save loaded', await page.evaluate(() => FTSave.loaded));
  ok('billing is mock in browser', await page.evaluate(() => FTBilling.state === 'mock'));
  ok('ads unavailable in browser', await page.evaluate(() => FTAds.available === false));
  ok('menu visible', await page.evaluate(() => !document.getElementById('menu').classList.contains('hidden')));
  ok('9 skins registered', await page.evaluate(() => FTSkins.list.length === 9));
  ok('only frost owned on a fresh save',
     await page.evaluate(() => JSON.stringify(FTSave.data.owned) === '["frost"]'),
     await page.evaluate(() => JSON.stringify(FTSave.data.owned)));

  /* ---------------- 2. a real climb ---------------- */
  console.log('\n2. Gameplay');
  await page.click('#playBtn');
  await page.evaluate(() => new Promise(r => setTimeout(r, 100)));
  ok('menu hidden after CLIMB', await page.evaluate(() => document.getElementById('menu').classList.contains('hidden')));

  // Hold alternating sides so the climber builds speed and rebounds.
  await page.evaluate(async () => {
    const send = (type, x) => dispatchEvent(new PointerEvent(type, {
      pointerId: 1, clientX: x, clientY: 600, bubbles: true, cancelable: true
    }));
    for (let i = 0; i < 14; i++) {
      const x = (i % 2 === 0) ? innerWidth * 0.85 : innerWidth * 0.15;
      send('pointerdown', x);
      await new Promise(r => setTimeout(r, 900));
      send('pointerup', x);
      await new Promise(r => setTimeout(r, 40));
    }
  });

  const climbed = await page.evaluate(() => ({
    floorText: document.getElementById('floorHud').textContent,
    scoreText: document.getElementById('scoreHud').textContent
  }));
  const floorNum = parseInt(climbed.floorText.replace(/\D/g, ''), 10) || 0;
  const scoreNum = parseInt(climbed.scoreText.replace(/\D/g, ''), 10) || 0;
  ok('climbed above floor 0', floorNum > 0, climbed.floorText);
  ok('scored above 0', scoreNum > 0, climbed.scoreText);

  /* ---------------- 3. game over + coins ---------------- */
  console.log('\n3. Game over');
  // Wait for the frost to catch up rather than forcing it, so the real
  // gameOver() path runs.
  await page.waitForFunction(
    () => !document.getElementById('overOv').classList.contains('hidden'),
    { timeout: 60000, polling: 100 }
  );
  const over = await page.evaluate(() => ({
    coinsLine: document.getElementById('oCoins').textContent,
    scoreLine: document.getElementById('oScore').textContent,
    floorLine: document.getElementById('oFloor').textContent,
    coins: FTSave.data.coins,
    best: FTSave.data.best,
    bestFloor: FTSave.data.bestFloor,
    runs: FTSave.data.runs,
    reviveHidden: document.getElementById('reviveBtn').classList.contains('hidden')
  }));
  ok('game-over overlay shows a coin line', /Earned: \d+ snowflakes/.test(over.coinsLine), over.coinsLine);
  ok('coins credited to the wallet', over.coins > 0, 'coins=' + over.coins);
  ok('best score recorded', over.best > 0, 'best=' + over.best);
  ok('best floor recorded', over.bestFloor > 0, 'bestFloor=' + over.bestFloor);
  ok('run counted', over.runs === 1, 'runs=' + over.runs);
  ok('revive button hidden with no ad SDK', over.reviveHidden);

  /* ---------------- 4. milestone unlocks ---------------- */
  console.log('\n4. Milestones');
  // Reset to a fresh wallet first: a good climb in step 2 may already have
  // earned Ember, and then it would not appear as "newly" granted.
  const milestones = await page.evaluate(() => {
    FTSave.data.owned = ['frost']; FTSave.data.bestFloor = 0; FTSave.data.best = 0;
    const beforeAny = FTShop.reconcileMilestones().map(s => s.id);
    FTSave.data.bestFloor = 29; FTSave.data.best = 5999;
    const justUnder = FTShop.reconcileMilestones().map(s => s.id);
    FTSave.data.bestFloor = 30; FTSave.data.best = 6000;
    const atThreshold = FTShop.reconcileMilestones().map(s => s.id);
    return { beforeAny, justUnder, atThreshold, owned: FTSave.data.owned.slice() };
  });
  ok('nothing unlocks at zero', milestones.beforeAny.length === 0, JSON.stringify(milestones.beforeAny));
  ok('nothing unlocks one short of the threshold', milestones.justUnder.length === 0, JSON.stringify(milestones.justUnder));
  ok('floor-30 unlocks Ember', milestones.atThreshold.indexOf('ember') >= 0, JSON.stringify(milestones.atThreshold));
  ok('score-6000 unlocks Midnight', milestones.atThreshold.indexOf('midnight') >= 0, JSON.stringify(milestones.atThreshold));
  ok('milestones are not re-granted',
     await page.evaluate(() => FTShop.reconcileMilestones().length === 0));

  /* ---------------- 5. coin economy ---------------- */
  console.log('\n5. Coins');
  const coinRes = await page.evaluate(() => {
    FTSave.data.coins = 300;
    const before = FTSave.data.coins;
    const bought = FTSave.spendCoins(250);
    FTSave.grant('mint');
    const refused = FTSave.spendCoins(999999);
    return { before, bought, after: FTSave.data.coins, refused, ownsMint: FTSave.owns('mint') };
  });
  ok('coin purchase succeeds and debits', coinRes.bought && coinRes.after === 50, JSON.stringify(coinRes));
  ok('overspend refused, balance intact', coinRes.refused === false && coinRes.after === 50);
  ok('coin skin granted', coinRes.ownsMint);

  /* ---------------- 6. premium purchases ---------------- */
  console.log('\n6. Premium (mock store)');
  const buy = await page.evaluate(async () => {
    const a = await FTBilling.purchase('skin_aurora');
    const r = await FTBilling.purchase('remove_ads');
    FTShop.reconcileEntitlements();
    return { a, r, ownsAurora: FTSave.owns('aurora'), removeAds: FTAds.removeAdsOwned };
  });
  ok('premium skin purchase ok', buy.a.ok === true);
  ok('premium skin mirrored into the save', buy.ownsAurora);
  ok('remove_ads purchase ok', buy.r.ok === true);
  ok('remove_ads flips the ads flag', buy.removeAds === true);
  ok('interstitial suppressed after remove_ads',
     await page.evaluate(() => { FTAds._runsSinceAd = 99; FTAds.available = true; FTAds._interstitialReady = true;
                                 const s = FTAds.shouldShowInterstitial(); FTAds.available = false; return s === false; }));

  /* ---------------- 7. skin selection + rendering ---------------- */
  console.log('\n7. Skins');
  await page.evaluate(() => { FTSave.select('aurora'); FTShop.open(); });
  await page.evaluate(() => new Promise(r => setTimeout(r, 400)));
  ok('shop opens', await page.evaluate(() => FTShop.isOpen()));
  ok('every skin has a card',
     await page.evaluate(() => document.querySelectorAll('#skinGrid .skin-card').length === 9));
  ok('selected skin card is marked',
     await page.evaluate(() => document.querySelectorAll('#skinGrid .skin-card.sel').length === 1));
  ok('previews actually paint pixels', await page.evaluate(() => {
    const cv = document.querySelector('.skin-prev');
    const ctx = cv.getContext('2d');
    const d = ctx.getImageData(0, 0, cv.width, cv.height).data;
    let nonEmpty = 0;
    for (let i = 3; i < d.length; i += 4) if (d[i] > 0) nonEmpty++;
    return nonEmpty > 200;
  }));
  ok('every skin draws without throwing', await page.evaluate(() => {
    const cv = document.createElement('canvas'); cv.width = cv.height = 64;
    const ctx = cv.getContext('2d');
    try {
      FTSkins.list.forEach(s => { ctx.save(); ctx.translate(32, 32); FTSkins.draw(ctx, s.id, 16, 120, -400, 1.7); ctx.restore(); });
      return true;
    } catch (e) { return 'threw: ' + e.message; }
  }));

  /* ---------------- 8. persistence ---------------- */
  console.log('\n8. Persistence');
  const beforeReload = await page.evaluate(() => JSON.parse(JSON.stringify(FTSave.data)));
  await page.reload({ waitUntil: 'domcontentloaded' });
  await page.evaluate(() => new Promise(r => setTimeout(r, 1200)));
  await page.evaluate(() => new Promise(r => setTimeout(r, 600)));
  const afterReload = await page.evaluate(() => JSON.parse(JSON.stringify(FTSave.data)));
  ok('owned skins survive reload',
     JSON.stringify(afterReload.owned.sort()) === JSON.stringify(beforeReload.owned.sort()),
     JSON.stringify(afterReload.owned));
  ok('coins survive reload', afterReload.coins === beforeReload.coins);
  ok('best survives reload', afterReload.best === beforeReload.best);
  ok('selected skin survives reload', afterReload.skin === beforeReload.skin, afterReload.skin);
  ok('entitlements survive reload',
     await page.evaluate(() => FTBilling.owns('remove_ads') && FTBilling.owns('skin_aurora')));

  /* ---------------- 9. corrupt-save resilience ---------------- */
  console.log('\n9. Resilience');
  await page.evaluate(() => localStorage.setItem('ft.save', '{not json at all'));
  await page.reload({ waitUntil: 'domcontentloaded' });
  await page.evaluate(() => new Promise(r => setTimeout(r, 1200)));
  await page.evaluate(() => new Promise(r => setTimeout(r, 600)));
  ok('corrupt save falls back to defaults instead of locking up',
     await page.evaluate(() => FTSave.loaded && FTSave.owns('frost') && FTSave.data.coins === 0));
  ok('game still playable after a corrupt save',
     await page.evaluate(() => { document.getElementById('playBtn').click();
                                 return document.getElementById('menu').classList.contains('hidden'); }));

  /* ---------------- 10. legacy save migration ---------------- */
  console.log('\n10. v1 save migration');
  await page.evaluate(() => { localStorage.clear(); localStorage.setItem('ftb', '720'); });
  await page.reload({ waitUntil: 'domcontentloaded' });
  await page.evaluate(() => new Promise(r => setTimeout(r, 1200)));
  await page.evaluate(() => new Promise(r => setTimeout(r, 600)));
  ok('v1 high score carried over', await page.evaluate(() => FTSave.data.best === 720),
     await page.evaluate(() => String(FTSave.data.best)));

  /* ---------------- console hygiene ---------------- */
  console.log('\n11. Console');
  ok('no console errors or page exceptions', consoleErrors.length === 0, consoleErrors.join(' | '));

  console.log('\n' + '='.repeat(46));
  console.log(`  ${pass} passed, ${fail} failed`);
  console.log('='.repeat(46));

  await browser.close();
  process.exit(fail ? 1 : 0);
})().catch(e => { console.error('HARNESS ERROR:', e); process.exit(2); });
