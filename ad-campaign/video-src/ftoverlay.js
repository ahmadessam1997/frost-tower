/* ---------------------------------------------------------------
   Frost Tower ad — overlay layer + timeline.
   Injected into the live game page; the canvas renders underneath.
   Every visual is a pure function of output time t.
   --------------------------------------------------------------- */
window.__FT_AD = (function () {
  'use strict';

  /* ---------------- easing ---------------- */
  const clamp = (v, a, b) => Math.min(b, Math.max(a, v));
  const inv = (t, a, b) => clamp((t - a) / (b - a || 1e-6), 0, 1);
  const easeOut = p => 1 - Math.pow(1 - p, 3);
  const easeOutBack = p => 1 + 2.2 * Math.pow(p - 1, 3) + 1.4 * Math.pow(p - 1, 2);
  const lerp = (a, b, p) => a + (b - a) * p;

  /* ---------------- the script ----------------
     Each scene is a cut: a floor band, a skin, and the text over it. */
  const S = [
    { t0: 0.0,  t1: 2.8,  band: 6,   skin: 'frost',    gap: 1150,
      cards: [{ t0: 0.9, t1: 2.8, kind: 'title', h: 'FROST TOWER', p: 'climb or freeze' }] },

    { t0: 2.8,  t1: 10.0, band: 12,  skin: 'frost',    gap: 1150,
      cards: [
        { t0: 3.2,  t1: 6.4, kind: 'big',  h: 'SPEED = HEIGHT',        p: 'Hold left or right to sprint' },
        { t0: 6.7,  t1: 9.9, kind: 'big',  h: 'REBOUND OFF THE WALLS', p: 'Keep every bit of your speed' }
      ] },

    { t0: 10.0, t1: 16.8, band: 28,  skin: 'frost',    gap: 1150,
      cards: [{ t0: 10.5, t1: 16.6, kind: 'big', h: 'SKIP FLOORS,\nCHAIN COMBOS', p: 'Two floors in one leap starts the chain' }] },

    { t0: 16.8, t1: 21.2, band: 34,  skin: 'frost',    gap: 1150, cut: true,
      cards: [{ t0: 17.2, t1: 21.0, kind: 'band', h: 'MOVING PLATFORMS', p: 'from floor 25', swatch: '#8e63c8' }] },

    { t0: 21.2, t1: 25.6, band: 68,  skin: 'frost',    gap: 1150, cut: true,
      cards: [{ t0: 21.6, t1: 25.4, kind: 'band', h: 'PLANKS THAT CRUMBLE', p: 'from floor 50', swatch: '#e0a96b' }] },

    { t0: 25.6, t1: 30.4, band: 132, skin: 'frost',    gap: 1150, cut: true,
      cards: [{ t0: 26.0, t1: 30.2, kind: 'band', h: 'AND A SKY THAT CHANGES', p: 'the higher you climb', swatch: '#7bffd4' }] },

    { t0: 30.4, t1: 33.4, shop: true, cut: true,
      cards: [{ t0: 30.8, t1: 33.3, kind: 'top', h: 'NINE CLIMBERS', p: 'Earn snowflakes every run and collect them' }] },

    { t0: 33.4, t1: 35.0, band: 30,  skin: 'ember',    gap: 1150, cut: true,
      cards: [{ t0: 33.6, t1: 34.9, kind: 'skin', skin: 'ember', h: 'EMBER',        p: 'Reach floor 30',  swatch: '#f2793d' }] },
    { t0: 35.0, t1: 36.6, band: 42,  skin: 'midnight', gap: 1150, cut: true,
      cards: [{ t0: 35.2, t1: 36.5, kind: 'skin', skin: 'midnight', h: 'MIDNIGHT',     p: 'Score 6,000',     swatch: '#5b6bc7' }] },
    { t0: 36.6, t1: 38.2, band: 55,  skin: 'mint',     gap: 1150, cut: true,
      cards: [{ t0: 36.8, t1: 38.1, kind: 'skin', skin: 'mint', h: 'MINT CHIP',    p: '250 snowflakes',  swatch: '#6fd6a8' }] },
    { t0: 38.2, t1: 39.8, band: 70,  skin: 'cocoa',    gap: 1150, cut: true,
      cards: [{ t0: 38.4, t1: 39.7, kind: 'skin', skin: 'cocoa', h: 'COCOA',        p: '600 snowflakes',  swatch: '#a9714a' }] },
    { t0: 39.8, t1: 41.4, band: 88,  skin: 'glacier',  gap: 1150, cut: true,
      cards: [{ t0: 40.0, t1: 41.3, kind: 'skin', skin: 'glacier', h: 'GLACIER',      p: '1,000 snowflakes', swatch: '#5fa8d8' }] },
    { t0: 41.4, t1: 43.0, band: 115, skin: 'aurora',   gap: 1150, cut: true,
      cards: [{ t0: 41.6, t1: 42.9, kind: 'skin', skin: 'aurora', h: 'AURORA',       p: 'and two more',    swatch: '#7bffd4' }] },

    { t0: 43.0, t1: 46.6, band: 50,  skin: 'void',     gap: 360,  chase: 345, cut: true,
      cards: [{ t0: 43.3, t1: 46.4, kind: 'big', h: 'THE FROST\nIS RISING', p: 'It never stops. How high can you get?' }] },

    { t0: 46.6, t1: 51.0, end: true, cut: true }
  ];

  const TOTAL = 51.0;
  const sceneAt = t => S.find(s => t >= s.t0 && t < s.t1) || S[S.length - 1];

  /* ---------------- DOM ---------------- */
  function build() {
    const css = document.createElement('style');
    css.textContent = `
@font-face{font-family:AdInter;src:url(ad/fonts/Inter-700.ttf);font-weight:700}
@font-face{font-family:AdInter;src:url(ad/fonts/Inter-800.ttf);font-weight:800}
@font-face{font-family:AdInter;src:url(ad/fonts/Inter-900.ttf);font-weight:900}
#adov{position:fixed;inset:0;z-index:9000;pointer-events:none;font-family:AdInter,sans-serif;
  -webkit-font-smoothing:antialiased}
#adTop{position:absolute;left:0;right:0;top:0;height:200px;
  background:linear-gradient(180deg,rgba(6,10,32,.82),rgba(6,10,32,0))}
#adBot{position:absolute;left:0;right:0;bottom:0;height:300px;
  background:linear-gradient(0deg,rgba(6,10,32,.88),rgba(6,10,32,0))}
#adCard{position:absolute;left:0;right:0;bottom:120px;text-align:center;padding:0 34px}
#adCard .h{font-weight:900;font-size:58px;line-height:1.04;color:#fff;letter-spacing:-.02em;
  text-shadow:0 0 26px rgba(56,182,255,.75),0 4px 0 rgba(6,10,32,.5);white-space:pre-line}
#adCard .p{font-weight:700;font-size:25px;line-height:1.3;color:#bfe6ff;margin-top:14px;
  text-shadow:0 2px 10px rgba(6,10,32,.8)}
#adCard .sw{display:inline-block;width:56px;height:6px;border-radius:3px;margin-bottom:18px}
#adTitle{position:absolute;inset:0;display:flex;flex-direction:column;align-items:center;
  justify-content:center;text-align:center}
#adTitle .h{font-weight:900;font-size:92px;line-height:1;color:#fff;letter-spacing:-.03em;
  text-shadow:0 0 44px rgba(56,182,255,.9),0 6px 0 rgba(6,10,32,.45)}
#adTitle .p{font-weight:800;font-size:31px;color:#8fe8ff;letter-spacing:.22em;margin-top:18px}
#adEnd{position:absolute;inset:0;display:flex;flex-direction:column;align-items:center;
  justify-content:center;text-align:center;background:rgba(7,11,34,.9);opacity:0}
#adEnd img{width:220px;height:220px;border-radius:52px;box-shadow:0 26px 70px rgba(0,0,0,.6)}
#adEnd .h{font-weight:900;font-size:80px;color:#fff;margin-top:44px;letter-spacing:-.03em;
  text-shadow:0 0 40px rgba(56,182,255,.8)}
#adEnd .p{font-weight:800;font-size:29px;color:#8fe8ff;letter-spacing:.2em;margin-top:16px}
#adEnd .cta{margin-top:46px;font-weight:900;font-size:32px;color:#062033;letter-spacing:.04em;
  background:linear-gradient(135deg,#bff0ff,#59c8ff);border-radius:999px;padding:24px 58px;
  box-shadow:0 20px 50px rgba(56,182,255,.45)}
#adEnd .fine{margin-top:26px;font-weight:700;font-size:23px;color:#8aa4c8}
#adBadge{display:block;margin:0 auto 6px;width:168px;height:168px;
  filter:drop-shadow(0 10px 26px rgba(0,0,0,.55))}
#adCard.top{bottom:auto;top:46px}
#adCard.top .h{font-size:52px}
body.ad-shop #shopOv{background:rgba(6,10,32,.92)}
body.ad-shop #shopOv .shop{transform:translateY(196px) scale(1.14);transform-origin:50% 0%}
body.ad-shop #shopOv .shop-body > .shop-section:not(:first-of-type){display:none}
body.ad-shop #shopOv .shop-foot{display:none}
#adBar{position:absolute;left:0;bottom:0;height:6px;background:linear-gradient(90deg,#38b6ff,#8fe8ff)}
#adFlash{position:absolute;inset:0;background:#dff4ff;opacity:0}
`;
    document.head.appendChild(css);
    const d = document.createElement('div');
    d.id = 'adov';
    d.innerHTML =
      '<div id="adTop"></div><div id="adBot"></div>' +
      '<div id="adTitle"><div class="h"></div><div class="p"></div></div>' +
      '<div id="adCard"><canvas id="adBadge"></canvas><div class="sw"></div><div class="h"></div><div class="p"></div></div>' +
      '<div id="adFlash"></div>' +
      '<div id="adEnd"><img src="ad/icon.png"><div class="h">FROST TOWER</div>' +
      '<div class="p">CLIMB OR FREEZE</div>' +
      '<div class="cta">PLAY FREE ON ANDROID</div>' +
      '<div class="fine">Free to play · works offline · no account</div></div>' +
      '<div id="adBar"></div>';
    document.body.appendChild(d);
  }

  const $ = id => document.getElementById(id);

  /* ---------------- per-frame paint ---------------- */
  function paint(t) {
    const sc = sceneAt(t);

    /* cut flash */
    $('adFlash').style.opacity = sc.cut ? 0.5 * (1 - easeOut(inv(t, sc.t0, sc.t0 + 0.18))) : 0;

    /* progress */
    $('adBar').style.width = (100 * clamp(t / TOTAL, 0, 1)) + '%';

    /* end card */
    const end = $('adEnd');
    if (sc.end) {
      end.style.opacity = easeOut(inv(t, sc.t0, sc.t0 + 0.4));
      [].slice.call(end.children).forEach((el, i) => {
        const p = easeOut(inv(t, sc.t0 + 0.25 + i * 0.13, sc.t0 + 1.1 + i * 0.13));
        el.style.opacity = p;
        el.style.transform = 'translateY(' + lerp(34, 0, p) + 'px)';
      });
    } else end.style.opacity = 0;

    /* cards */
    const card = $('adCard'), title = $('adTitle');
    let shownTitle = false, shownCard = false;
    const list = sc.cards || [];
    for (const c of list) {
      if (t < c.t0 || t > c.t1) continue;
      const a = easeOut(inv(t, c.t0, c.t0 + 0.42));
      const b = 1 - easeOut(inv(t, c.t1 - 0.3, c.t1));
      const vis = Math.min(a, b);
      if (c.kind === 'title') {
        shownTitle = true;
        title.style.opacity = vis;
        title.querySelector('.h').textContent = c.h;
        title.querySelector('.p').textContent = c.p;
        title.querySelector('.h').style.transform = 'scale(' + lerp(0.82, 1, easeOutBack(inv(t, c.t0, c.t0 + 0.55))) + ')';
        title.querySelector('.p').style.opacity = easeOut(inv(t, c.t0 + 0.25, c.t0 + 0.8));
      } else {
        shownCard = true;
        card.style.opacity = vis;
        card.classList.toggle('top', c.kind === 'top');
        card.style.transform = 'translateY(' + lerp(c.kind === 'top' ? -22 : 26, 0, a) + 'px)';
        card.querySelector('.h').textContent = c.h;
        card.querySelector('.p').textContent = c.p;
        const sw = card.querySelector('.sw');
        if (c.swatch) { sw.style.display = 'inline-block'; sw.style.background = c.swatch; }
        else sw.style.display = 'none';
        if (c.kind !== 'top') card.querySelector('.h').style.fontSize = (c.kind === 'skin' ? 66 : 58) + 'px';

        /* a large drawing of the climber, so the skin reads even when the
           player is small and far across the screen */
        const bg = document.getElementById('adBadge');
        if (c.skin && window.FTSkins) {
          bg.style.display = 'block';
          const g = easeOutBack(inv(t, c.t0, c.t0 + 0.5));
          bg.style.transform = 'scale(' + lerp(0.5, 1, g) + ')';
          window.FTSkins.drawPreview(bg, c.skin, t * 1.4);
        } else bg.style.display = 'none';
      }
    }
    if (!shownTitle) title.style.opacity = 0;
    if (!shownCard) card.style.opacity = 0;

    document.body.classList.toggle('ad-shop', !!sc.shop);

    /* the dark scrims are only wanted where text sits */
    $('adBot').style.opacity = shownCard ? 1 : 0.35;
    $('adTop').style.opacity = 0.9;
  }

  return { build, paint, scenes: S, total: TOTAL, sceneAt };
})();
