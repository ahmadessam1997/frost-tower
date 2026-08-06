/* =====================================================================
   Frost Tower — Play Store screenshot generator
   ---------------------------------------------------------------------
   Captures REAL in-app frames (the actual canvas renderer and the actual
   shop DOM), then composes each into a framed 1080x1920 marketing shot
   matching the v1 art direction: navy gradient, soft blurred circles,
   bold white caption, rounded phone frame.

   Run:  node test/gen-screenshots.js
   Needs the static server:  npm run serve   (port 8123)

   Writes play-assets/raw/*.png (unframed) and play-assets/screenshot-N.png
   Re-runnable: it overwrites both.
   ===================================================================== */
const puppeteer = require('puppeteer');
const fs = require('fs');
const path = require('path');

const URL = process.argv[2] || 'http://127.0.0.1:8123/index.html';
const OUT = path.join(__dirname, '..', 'play-assets');
const RAW = path.join(OUT, 'raw');

/* Inner screen size, in device pixels, of the phone frame in the layout. */
const SCREEN_W = 770, SCREEN_H = 1530;

const SHOTS = [
  { id: 'climb',    caption: 'CLIMB\nFOREVER' },
  { id: 'skins',    caption: 'NINE CLIMBERS\nTO COLLECT' },
  { id: 'speed',    caption: 'SPEED =\nHEIGHT' },
  { id: 'earn',     caption: 'EARN SNOWFLAKES\nUNLOCK CLIMBERS' },
  { id: 'best',     caption: 'BEAT YOUR\nBEST CLIMB' },
  { id: 'flow',     caption: 'ONE THUMB.\nPURE FLOW.' }
];

/* Plays a genuine run so the tower, frost line and camera are all real. */
async function climb(page, seconds) {
  await page.evaluate(async (secs) => {
    const send = (type, x) => dispatchEvent(new PointerEvent(type, {
      pointerId: 1, clientX: x, clientY: 600, bubbles: true, cancelable: true
    }));
    const end = Date.now() + secs * 1000;
    let i = 0;
    while (Date.now() < end) {
      const x = (i++ % 2 === 0) ? innerWidth * 0.85 : innerWidth * 0.15;
      send('pointerdown', x);
      await new Promise(r => setTimeout(r, 850));
      send('pointerup', x);
      await new Promise(r => setTimeout(r, 30));
    }
  }, seconds);
}

/* Guarantees a run is in progress and freshly started. The frost accelerates
   with elapsed run time, so reusing an old run means the capture lands on the
   game-over card instead of a climb. */
async function freshRun(page) {
  await page.evaluate(async () => {
    if (FTShop.isOpen()) FTShop.close();
    const over = document.getElementById('overOv');
    const menu = document.getElementById('menu');
    if (!over.classList.contains('hidden')) document.getElementById('againBtn').click();
    else if (!menu.classList.contains('hidden')) document.getElementById('playBtn').click();
    else {
      // Mid-run: end it deterministically so the next one starts clean.
      document.getElementById('playBtn').click();
    }
    await new Promise(r => setTimeout(r, 250));
  });
}

/* Grants everything so the shop looks like a collection worth chasing. */
async function unlockAll(page, coins) {
  await page.evaluate(async (c) => {
    for (const id of ['skin_aurora', 'skin_golden', 'skin_void', 'remove_ads']) {
      await FTBilling.purchase(id);
    }
    FTSave.data.owned = ['frost', 'ember', 'midnight', 'mint', 'aurora', 'golden', 'void'];
    FTSave.data.coins = c;
    FTSave.data.bestFloor = 62; FTSave.data.best = 8940;
    await FTSave.save();
    FTShop.reconcileEntitlements();
  }, coins);
}

(async () => {
  fs.mkdirSync(RAW, { recursive: true });

  const browser = await puppeteer.launch({
    headless: 'new',
    args: ['--no-sandbox', '--disable-gpu', '--hide-scrollbars']
  });
  const page = await browser.newPage();
  await page.setViewport({
    width: SCREEN_W / 2, height: SCREEN_H / 2,
    deviceScaleFactor: 2, isMobile: true, hasTouch: true
  });

  const raw = {};
  const grab = async (id) => {
    const file = path.join(RAW, id + '.png');
    await page.screenshot({ path: file });
    raw[id] = 'data:image/png;base64,' + fs.readFileSync(file).toString('base64');
    console.log('  captured ' + id);
  };

  await page.goto(URL, { waitUntil: 'networkidle0' });
  await page.evaluate(() => new Promise(r => setTimeout(r, 500)));

  console.log('Capturing raw frames…');

  /* --- 1. climb: a real run, with the combo banner staged at its peak --- */
  await page.evaluate(() => { localStorage.clear(); });
  await page.reload({ waitUntil: 'networkidle0' });
  await page.evaluate(() => new Promise(r => setTimeout(r, 400)));
  await page.click('#playBtn');
  await climb(page, 9);
  await page.evaluate(() => {
    const c = document.getElementById('combo');
    c.textContent = 'COMBO ×10 ❄️';
    c.classList.add('show');
  });
  await page.evaluate(() => new Promise(r => setTimeout(r, 120)));
  await grab('climb');

  /* --- 5. best: let that same run end naturally, on the real card --- */
  await page.waitForFunction(
    () => !document.getElementById('overOv').classList.contains('hidden'),
    { timeout: 90000, polling: 100 }
  );
  await page.evaluate(() => new Promise(r => setTimeout(r, 250)));
  await grab('best');

  /* --- 3. speed: a FRESH run with Aurora equipped --- */
  await unlockAll(page, 640);
  await page.evaluate(() => {
    FTSave.select('aurora');
    document.getElementById('combo').classList.remove('show');
  });
  await freshRun(page);
  await climb(page, 5);
  await grab('speed');

  /* --- 6. flow: a FRESH run with Void Walker --- */
  await page.evaluate(() => FTSave.select('void'));
  await freshRun(page);
  await climb(page, 5);
  await grab('flow');

  /* --- 2. skins: the shop grid, scrolled to show the premium row --- */
  await unlockAll(page, 640);
  await page.evaluate(() => { FTSave.select('golden'); FTShop.open(); });
  await page.evaluate(() => new Promise(r => setTimeout(r, 500)));
  await grab('skins');

  /* --- 4. earn: shop scrolled to the snowflakes + upgrades sections --- */
  await page.evaluate(() => {
    // Force the ad-funded coin button visible for the marketing shot; it is
    // hidden in a browser only because there is no ad SDK here. On device
    // this section is always present.
    FTAds.available = true; FTAds._rewardedReady = true;
    // Show Remove Ads as an OFFER, not as already owned — "✓ Ads removed"
    // is weak marketing and implies the app ships ad-free, which it doesn't.
    delete FTBilling.entitlements.remove_ads;
    FTAds.setRemoveAds(false);
    FTShop.render();
    document.querySelector('.shop-body').scrollTop = 99999;
  });
  await page.evaluate(() => new Promise(r => setTimeout(r, 400)));
  await grab('earn');

  /* ---------------- compose ---------------- */
  console.log('Composing framed shots…');
  const framer = await browser.newPage();
  await framer.setViewport({ width: 1080, height: 1920, deviceScaleFactor: 1 });

  for (let i = 0; i < SHOTS.length; i++) {
    const s = SHOTS[i];
    const html = `<!DOCTYPE html><html><head><meta charset="utf-8"><style>
      *{margin:0;padding:0;box-sizing:border-box}
      body{width:1080px;height:1920px;overflow:hidden;position:relative;
        background:linear-gradient(165deg,#1b2a5e 0%,#141f47 45%,#0d1430 100%);
        font-family:'Segoe UI',-apple-system,Roboto,sans-serif;}
      .orb{position:absolute;border-radius:50%;filter:blur(2px);opacity:.5;}
      .o1{width:520px;height:520px;left:-190px;top:-120px;
        background:radial-gradient(circle at 35% 35%,#2f4a8f,#20325f);}
      .o2{width:380px;height:380px;right:-140px;bottom:120px;
        background:radial-gradient(circle at 40% 40%,#263d78,#182a55);opacity:.42;}
      .o3{width:210px;height:210px;right:90px;top:520px;
        background:radial-gradient(circle at 40% 40%,#2b4585,#1d2f5c);opacity:.3;}
      h1{position:absolute;top:96px;left:0;right:0;text-align:center;color:#fff;
        font-size:78px;font-weight:900;line-height:1.06;letter-spacing:-.5px;
        white-space:pre-line;text-shadow:0 6px 26px rgba(0,0,0,.42);}
      .phone{position:absolute;left:${(1080 - SCREEN_W) / 2 - 12}px;top:382px;
        width:${SCREEN_W + 24}px;height:${SCREEN_H + 24}px;
        background:#0b0f22;border-radius:58px;padding:12px;
        box-shadow:0 34px 90px rgba(0,0,0,.55),0 0 0 2px rgba(255,255,255,.06);}
      .screen{width:100%;height:100%;border-radius:47px;overflow:hidden;background:#0a1030;}
      .screen img{width:100%;height:100%;object-fit:cover;object-position:top center;display:block;}
    </style></head><body>
      <div class="orb o1"></div><div class="orb o2"></div><div class="orb o3"></div>
      <h1>${s.caption}</h1>
      <div class="phone"><div class="screen"><img src="${raw[s.id]}"></div></div>
    </body></html>`;

    await framer.setContent(html, { waitUntil: 'load' });
    await framer.evaluate(() => new Promise(r => setTimeout(r, 150)));
    const out = path.join(OUT, `screenshot-${i + 1}.png`);
    await framer.screenshot({ path: out });
    console.log('  wrote ' + path.basename(out) + '  (' + s.caption.replace('\n', ' ') + ')');
  }

  await browser.close();
  console.log('\nDone. 6 framed shots in play-assets/, raw frames in play-assets/raw/');
})().catch(e => { console.error('GENERATOR ERROR:', e); process.exit(1); });
