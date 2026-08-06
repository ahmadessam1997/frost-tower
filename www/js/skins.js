/* =====================================================================
   Frost Tower — skins
   The player is drawn procedurally (no sprite atlas, keeps the download
   tiny), so a skin is a small spec plus an optional accessory painter.
   All drawing happens in the player's local space: origin at the centre
   of the body, +y down, radius r.
   ===================================================================== */
(function (global) {
  'use strict';

  /* ---------- accessory painters ---------- */
  var acc = {
    none: function () {},

    /* Ember — a flame tuft that flickers with time */
    flame: function (ctx, r, t) {
      var f = Math.sin(t * 9) * 0.15;
      var g = ctx.createLinearGradient(0, -r - 14, 0, -r + 2);
      g.addColorStop(0, '#fff3b0');
      g.addColorStop(0.5, '#ff9d3c');
      g.addColorStop(1, 'rgba(255,80,30,0)');
      ctx.fillStyle = g;
      ctx.beginPath();
      ctx.moveTo(-5, -r + 2);
      ctx.quadraticCurveTo(-3 + f * 4, -r - 8, 0, -r - 15 - f * 3);
      ctx.quadraticCurveTo(3 + f * 4, -r - 8, 5, -r + 2);
      ctx.closePath();
      ctx.fill();
    },

    /* Midnight — a crescent moon and two twinkling stars */
    moon: function (ctx, r, t) {
      ctx.fillStyle = '#ffe9a8';
      ctx.beginPath();
      ctx.arc(0, -r - 7, 5, 0, 7);
      ctx.fill();
      ctx.globalCompositeOperation = 'destination-out';
      ctx.beginPath();
      ctx.arc(2.5, -r - 8.5, 4.5, 0, 7);
      ctx.fill();
      ctx.globalCompositeOperation = 'source-over';
      ctx.fillStyle = 'rgba(255,255,255,' + (0.5 + Math.sin(t * 5) * 0.4) + ')';
      ctx.fillRect(-r - 3, -6, 2, 2);
      ctx.fillRect(r + 2, -10, 2, 2);
    },

    /* Mint Chip — chocolate chips scattered on the body */
    chips: function (ctx, r) {
      ctx.fillStyle = '#4a2c1a';
      [[-7, 2, 2.2], [5, -8, 1.9], [8, 4, 2.4], [-3, 9, 1.7]].forEach(function (c) {
        ctx.beginPath();
        ctx.arc(c[0], c[1], c[2], 0, 7);
        ctx.fill();
      });
    },

    /* Cocoa — a marshmallow balanced on top */
    marshmallow: function (ctx, r) {
      ctx.fillStyle = '#fff8ee';
      ctx.beginPath();
      ctx.roundRect(-6, -r - 11, 12, 10, 3);
      ctx.fill();
      ctx.strokeStyle = 'rgba(190,150,120,.5)';
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(-6, -r - 6);
      ctx.lineTo(6, -r - 6);
      ctx.stroke();
    },

    /* Glacier — jagged ice shards growing off the shoulders */
    shards: function (ctx, r) {
      ctx.fillStyle = 'rgba(215,245,255,.92)';
      [[-1, -1.15], [1, -1.15], [0, -1.4]].forEach(function (s, i) {
        var bx = s[0] * r * 0.7, by = -r * 0.3;
        var h = (i === 2 ? 16 : 11);
        ctx.beginPath();
        ctx.moveTo(bx - 3.5, by);
        ctx.lineTo(bx, by - h);
        ctx.lineTo(bx + 3.5, by);
        ctx.closePath();
        ctx.fill();
      });
    },

    /* Golden Crown */
    crown: function (ctx, r) {
      var g = ctx.createLinearGradient(0, -r - 13, 0, -r - 1);
      g.addColorStop(0, '#fff0a8');
      g.addColorStop(1, '#d99b1c');
      ctx.fillStyle = g;
      ctx.beginPath();
      ctx.moveTo(-9, -r - 1);
      ctx.lineTo(-9, -r - 9);
      ctx.lineTo(-4.5, -r - 5);
      ctx.lineTo(0, -r - 13);
      ctx.lineTo(4.5, -r - 5);
      ctx.lineTo(9, -r - 9);
      ctx.lineTo(9, -r - 1);
      ctx.closePath();
      ctx.fill();
      ctx.fillStyle = '#ff5c8a';
      ctx.beginPath();
      ctx.arc(0, -r - 4, 1.8, 0, 7);
      ctx.fill();
    },

    /* Void Walker — a starfield clipped inside the body, plus a ring */
    starfield: function (ctx, r, t) {
      ctx.save();
      ctx.beginPath();
      ctx.arc(0, 0, r - 1, 0, 7);
      ctx.clip();
      for (var i = 0; i < 12; i++) {
        var a = i * 2.3 + t * 0.4;
        var d = ((i * 7) % 13) / 13 * r;
        ctx.globalAlpha = 0.35 + ((i * 17) % 60) / 100;
        ctx.fillStyle = i % 3 === 0 ? '#c9a8ff' : '#ffffff';
        ctx.fillRect(Math.cos(a) * d, Math.sin(a * 1.3) * d, 1.6, 1.6);
      }
      ctx.restore();
      ctx.globalAlpha = 1;
      ctx.strokeStyle = 'rgba(180,120,255,.75)';
      ctx.lineWidth = 1.6;
      ctx.beginPath();
      ctx.ellipse(0, 1, r + 6, 4.5, Math.sin(t * 0.8) * 0.35, 0, 7);
      ctx.stroke();
    }
  };

  /* ---------- the registry ----------
     unlock kinds:
       free      always owned
       floor/score  milestone, granted automatically on game over
       coins     bought with in-game currency
       iap       real money, product id must exist in Play + RevenueCat  */
  var SKINS = [
    {
      id: 'frost', name: 'Frosty', blurb: 'The original. Scarf included.',
      body: ['#eafaff', '#8fd4f5'], scarf: '#ff5c8a', eye: '#1a2450',
      trail: '#8fe8ff', accessory: 'none',
      unlock: { type: 'free' }
    },
    {
      id: 'ember', name: 'Ember', blurb: 'Runs warm. The frost hates it.',
      body: ['#fff0c4', '#f2793d'], scarf: '#7a1f2b', eye: '#3a1408',
      trail: '#ffb45c', glow: 'rgba(255,140,60,.45)', accessory: 'flame',
      unlock: { type: 'floor', v: 30 }
    },
    {
      id: 'midnight', name: 'Midnight', blurb: 'Climbs by starlight.',
      body: ['#5b6bc7', '#232a5e'], scarf: '#ffe9a8', eye: '#d8e0ff',
      trail: '#8f9fff', glow: 'rgba(120,140,255,.35)', accessory: 'moon',
      unlock: { type: 'score', v: 6000 }
    },
    {
      id: 'mint', name: 'Mint Chip', blurb: 'Two scoops of courage.',
      body: ['#e6fff4', '#6fd6a8'], scarf: '#4a2c1a', eye: '#26543f',
      trail: '#9df0c8', accessory: 'chips',
      unlock: { type: 'coins', v: 250 }
    },
    {
      id: 'cocoa', name: 'Cocoa', blurb: 'Warm inside. Toasty on top.',
      body: ['#f0d6b8', '#a9714a'], scarf: '#fff8ee', eye: '#3d2314',
      trail: '#e8c9a8', accessory: 'marshmallow',
      unlock: { type: 'coins', v: 600 }
    },
    {
      id: 'glacier', name: 'Glacier', blurb: 'Became the thing it feared.',
      body: ['#ffffff', '#5fa8d8'], scarf: '#1d5c86', eye: '#0d3450',
      trail: '#d7f5ff', glow: 'rgba(140,220,255,.5)', accessory: 'shards',
      unlock: { type: 'coins', v: 1000 }
    },
    {
      id: 'aurora', name: 'Aurora', blurb: 'Wears the northern lights.',
      body: ['#ffffff', '#7bffd4'], scarf: '#b06cff', eye: '#123', hue: true,
      trail: '#7bffd4', glow: 'rgba(120,255,210,.45)', accessory: 'none',
      unlock: { type: 'iap', product: 'skin_aurora' }
    },
    {
      id: 'golden', name: 'Golden Crown', blurb: 'The tower already knows.',
      body: ['#fff8d0', '#e0a71c'], scarf: '#8c2b52', eye: '#4a3405',
      trail: '#ffd964', glow: 'rgba(255,210,90,.5)', accessory: 'crown',
      unlock: { type: 'iap', product: 'skin_golden' }
    },
    {
      id: 'void', name: 'Void Walker', blurb: 'Climbs out of somewhere else.',
      body: ['#3a2a5c', '#0b0718'], scarf: '#b06cff', eye: '#e0c9ff',
      trail: '#b06cff', glow: 'rgba(150,90,255,.5)', accessory: 'starfield',
      unlock: { type: 'iap', product: 'skin_void' }
    }
  ];

  var byId = {};
  SKINS.forEach(function (s) { byId[s.id] = s; });

  function get(id) { return byId[id] || byId.frost; }

  /* ---------- drawing ----------
     ctx must already be translated to the player's world position and
     NOT yet rotated/scaled — this applies the lean and squash itself so
     accessories inherit them. */
  function draw(ctx, skinId, r, vx, vy, t) {
    var s = get(skinId);

    ctx.save();
    var lean = Math.max(-0.3, Math.min(0.3, vx / 900));
    ctx.rotate(lean);
    var stretch = Math.max(0.85, Math.min(1.25, 1 + (-vy) / 2600));
    ctx.scale(2 - stretch, stretch);

    /* ground shadow */
    ctx.fillStyle = 'rgba(10,16,48,.3)';
    ctx.beginPath();
    ctx.ellipse(0, r + 3, r * 0.9, 4, 0, 0, 7);
    ctx.fill();

    /* outer glow for the premium/rare skins */
    if (s.glow) {
      var gg = ctx.createRadialGradient(0, 0, r * 0.6, 0, 0, r + 10);
      gg.addColorStop(0, s.glow);
      gg.addColorStop(1, 'rgba(0,0,0,0)');
      ctx.fillStyle = gg;
      ctx.beginPath();
      ctx.arc(0, 0, r + 10, 0, 7);
      ctx.fill();
    }

    /* body */
    var inner = s.body[0], outer = s.body[1];
    if (s.hue) {
      // Aurora cycles through the spectrum instead of holding one colour.
      var h = (t * 40) % 360;
      inner = 'hsl(' + h + ',100%,92%)';
      outer = 'hsl(' + ((h + 40) % 360) + ',80%,62%)';
    }
    var bg = ctx.createRadialGradient(-5, -6, 3, 0, 0, r + 2);
    bg.addColorStop(0, inner);
    bg.addColorStop(1, outer);
    ctx.fillStyle = bg;
    ctx.beginPath();
    ctx.arc(0, 0, r, 0, 7);
    ctx.fill();

    /* body-clipped accessories go before the scarf so the scarf overlaps */
    if (s.accessory === 'starfield' || s.accessory === 'chips') {
      acc[s.accessory](ctx, r, t);
    }

    /* scarf */
    ctx.fillStyle = s.scarf;
    ctx.beginPath(); ctx.roundRect(-r + 2, 3, r * 2 - 4, 6, 3); ctx.fill();
    ctx.beginPath(); ctx.roundRect(4, 7, 6, 12, 3); ctx.fill();

    /* face */
    ctx.fillStyle = s.eye;
    ctx.beginPath();
    ctx.arc(-5, -4, 2.6, 0, 7);
    ctx.arc(5, -4, 2.6, 0, 7);
    ctx.fill();
    ctx.strokeStyle = s.eye;
    ctx.lineWidth = 2;
    ctx.lineCap = 'round';
    ctx.beginPath();
    if (vy < -300) ctx.arc(0, 2, 3.4, 0, 7);       // open-mouthed on the way up
    else ctx.arc(0, 1, 4, 0.15, Math.PI - 0.15);   // small smile otherwise
    ctx.stroke();

    /* headwear last so it sits above everything */
    if (s.accessory !== 'starfield' && s.accessory !== 'chips') {
      acc[s.accessory](ctx, r, t);
    }

    ctx.restore();
  }

  /* Renders a skin into a <canvas> for the shop grid. */
  function drawPreview(canvas, skinId, t) {
    var ctx = canvas.getContext('2d');
    var dpr = Math.min(window.devicePixelRatio || 1, 2);
    var cssW = canvas.clientWidth || 72, cssH = canvas.clientHeight || 72;
    if (canvas.width !== Math.round(cssW * dpr)) {
      canvas.width = Math.round(cssW * dpr);
      canvas.height = Math.round(cssH * dpr);
    }
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, cssW, cssH);
    ctx.save();
    ctx.translate(cssW / 2, cssH / 2 + 3);
    var scale = Math.min(cssW, cssH) / 58;
    ctx.scale(scale, scale);
    draw(ctx, skinId, 16, 0, 0, t || 0);
    ctx.restore();
  }

  /* Human-readable unlock requirement, used by the shop. */
  function unlockLabel(skin) {
    var u = skin.unlock;
    if (u.type === 'free') return 'Free';
    if (u.type === 'floor') return 'Reach floor ' + u.v;
    if (u.type === 'score') return 'Score ' + u.v.toLocaleString();
    if (u.type === 'coins') return u.v + ' ❄';
    if (u.type === 'iap') {
      var p = global.FTConfig.products[u.product];
      return p ? p.price : '—';
    }
    return '';
  }

  global.FTSkins = {
    list: SKINS,
    get: get,
    draw: draw,
    drawPreview: drawPreview,
    unlockLabel: unlockLabel
  };
})(window);
