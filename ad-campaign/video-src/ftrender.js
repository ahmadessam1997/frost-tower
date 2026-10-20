/* Renders the Frost Tower ad: live game underneath, overlay on top,
   one screenshot per output frame. */
const puppeteer = require('puppeteer-core');
const path = require('path'), fs = require('fs');

const GAME = path.join(__dirname, 'ftgame', 'index.html');
const OUT = path.join(__dirname, 'ft_frames');
const CHROME = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
const FPS = 30;

(async () => {
  const only = process.argv[2];            // "t=12.3" renders a single preview frame
  if (!only) { fs.rmSync(OUT, { recursive: true, force: true }); fs.mkdirSync(OUT, { recursive: true }); }
  else fs.mkdirSync(OUT, { recursive: true });

  const browser = await puppeteer.launch({
    executablePath: CHROME, headless: 'new',
    args: ['--allow-file-access-from-files', '--hide-scrollbars',
      '--font-render-hinting=none', '--force-color-profile=srgb']
  });
  const page = await browser.newPage();
  await page.setViewport({ width: 540, height: 960, deviceScaleFactor: 2 });
  page.on('pageerror', e => console.error('PAGE ERROR:', e.message));

  await page.goto('file:///' + GAME.replace(/\\/g, '/'), { waitUntil: 'load' });
  await new Promise(r => setTimeout(r, 1000));
  await page.addScriptTag({ content: fs.readFileSync(path.join(__dirname, 'ftpilot.js'), 'utf8') });
  await page.addScriptTag({ content: fs.readFileSync(path.join(__dirname, 'ftoverlay.js'), 'utf8') });

  /* ---- set up: seeded RNG, a plausible save, start a run, build the overlay ---- */
  const setup = await page.evaluate(async () => {
    /* deterministic tower so a good take can be reproduced */
    let seed = 1;
    window.__setSeed = s => { seed = s >>> 0; };
    Math.random = function () {
      seed = (seed * 1664525 + 1013904223) >>> 0;
      return seed / 4294967296;
    };

    window.FTSave.data.best = 8420;
    window.FTSave.data.coins = 1240;
    /* owned stays at the default so the shop shows real unlock costs */

    window.__FT_MANUAL = true;
    document.getElementById('playBtn').click();
    await new Promise(r => setTimeout(r, 250));
    window.__FT_MANUAL = true;
    document.getElementById('menu').classList.add('hidden');
    document.getElementById('overOv').classList.add('hidden');

    window.__FT_AD.build();
    await document.fonts.ready;

    window.__ad = {
      pilot: window.__FT_PILOT(window.__FT, { horizon: 2.0 }),
      scene: null, gameT: 0
    };
    return { total: window.__FT_AD.total };
  });

  /* ---- pick a seed per gameplay scene: dry-run, keep one that survives and climbs.
         Cached, because the search costs far more than the render. ---- */
  const SEEDFILE = path.join(__dirname, 'ft_seeds.json');
  let seeds;
  if (fs.existsSync(SEEDFILE) && !process.env.RESEED) {
    seeds = JSON.parse(fs.readFileSync(SEEDFILE, 'utf8'));
    console.log('seeds: cached');
  } else {
  seeds = await page.evaluate(() => {
    const FT = window.__FT, AD = window.__FT_AD;
    const pilot = window.__ad.pilot;
    const chosen = {};
    AD.scenes.forEach((sc, idx) => {
      if (sc.end || sc.shop) return;
      const need = Math.ceil((sc.t1 - sc.t0) * 60) + 30;
      let bestSeed = 1, bestGain = -1;
      for (let s = 1; s <= 24; s++) {
        window.__setSeed(s * 7919);
        window.FTSave.data.skin = sc.skin;
        FT.warp(sc.band, sc.gap); FT.begin();
        const start = FT.maxFloor;
        let t = 0, ok = true;
        for (let i = 0; i < need; i++) {
          pilot(); t += 1 / 60; FT.tick(1 / 60, t);
          if (FT.state !== 'play') { ok = false; break; }
        }
        const gain = (ok ? 1000 : 0) + (FT.maxFloor - start);
        if (gain > bestGain) { bestGain = gain; bestSeed = s * 7919; }
      }
      chosen[idx] = { seed: bestSeed, gain: bestGain };
    });
    return chosen;
  });
  fs.writeFileSync(SEEDFILE, JSON.stringify(seeds, null, 2));
  console.log('seeds:', JSON.stringify(seeds));
  }

  await page.evaluate(s => { window.__ad.seeds = s; }, seeds);

  /* ---- frame loop ---- */
  const total = setup.total;
  const n = Math.round(total * FPS);

  async function frame(t) {
    return page.evaluate((t) => {
      const FT = window.__FT, AD = window.__FT_AD, A = window.__ad;
      const sc = AD.sceneAt(t);
      const idx = AD.scenes.indexOf(sc);

      /* entering a new scene */
      if (A.scene !== idx) {
        A.scene = idx;
        A.gameT = 0;
        /* the game's own loop stays parked for the whole render, otherwise it
           plays on unattended behind the shop and leaves a FROZEN! card up */
        window.__FT_MANUAL = true;
        if (!sc.shop && window.FTShop.isOpen()) window.FTShop.close();
        document.getElementById('shopOv').classList.add('hidden');
        document.getElementById('overOv').classList.add('hidden');
        document.getElementById('menu').classList.add('hidden');
        if (sc.shop) {
          window.FTShop.open();
          document.getElementById('shopOv').classList.remove('hidden');
          document.getElementById('menu').classList.add('hidden');
          document.getElementById('overOv').classList.add('hidden');
        } else if (!sc.end) {
          const sd = (A.seeds && A.seeds[idx]) ? A.seeds[idx].seed : 1;
          window.__setSeed(sd);
          window.FTSave.data.skin = sc.skin;
          FT.warp(sc.band, sc.gap);
          FT.begin();
        }
      }

      /* the shop animates its own skin previews */
      if (sc.shop) window.FTShop.tick(t);

      /* advance the game at 60 Hz, two ticks per 30 fps output frame */
      if (!sc.shop && !sc.end && FT.state === 'play') {
        for (let k = 0; k < 2; k++) {
          A.pilot(); A.gameT += 1 / 60; FT.tick(1 / 60, A.gameT);
        }
        /* the frost scene only works if the frost is actually in shot */
        if (sc.chase) FT.setFrostGap(sc.chase);
      }

      AD.paint(t);
    }, t);
  }

  if (only) {
    const t = parseFloat(only.split('=')[1]);
    /* replay from the start of that scene so the game state is right */
    const sc = await page.evaluate(t => {
      const s = window.__FT_AD.sceneAt(t); return { t0: s.t0 };
    }, t);
    for (let tt = sc.t0; tt < t; tt += 1 / FPS) await frame(tt);
    await frame(t);
    await page.screenshot({ path: path.join(OUT, 'preview.png') });
    console.log('preview at t=' + t);
    await browser.close();
    return;
  }

  const t0 = Date.now();
  for (let i = 0; i < n; i++) {
    const t = i / FPS;
    await frame(t);
    await page.screenshot({
      path: path.join(OUT, 'f_' + String(i).padStart(5, '0') + '.png'),
      optimizeForSpeed: true
    });
    if (i % 90 === 0) {
      const el = (Date.now() - t0) / 1000;
      console.log(`${i}/${n}  ${el.toFixed(0)}s  eta ${(el / (i + 1) * (n - i)).toFixed(0)}s`);
    }
  }
  console.log('done ' + n + ' frames in ' + ((Date.now() - t0) / 1000).toFixed(0) + 's');
  await browser.close();
})();
