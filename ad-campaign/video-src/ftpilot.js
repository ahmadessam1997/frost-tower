/* ---------------------------------------------------------------
   Frost Tower pilot — short-horizon MPC.

   Every frame it replays the game's own physics forward for each of
   the three possible inputs and keeps the one that climbs highest
   without dropping out of frame. Injected at capture time; the game
   itself is untouched apart from the state getters.
   --------------------------------------------------------------- */
window.__FT_PILOT = function makePilot(FT, opts) {
  opts = opts || {};
  const HORIZON = opts.horizon || 2.6;      // seconds to look ahead
  const DT = 1 / 60;
  const ACC = 1400, FRIC = 6, ICE_FRIC = 1.2, MAXV = 560, GRAV = 1500;

  function simulate(dir, steps) {
    const W = FT.W, H = FT.H, SP = FT.SPACING;
    const P0 = FT.P, cam0 = FT.cam;
    let x = P0.x, y = P0.y, vx = P0.vx, vy = P0.vy, onIce = P0.onIce, r = P0.r;
    let cam = cam0, best = FT.maxFloor, landed = 0, died = false;

    // static snapshot of the tower; moving platforms are treated as fixed,
    // which is close enough over 2.6 s and keeps this cheap
    const ps = FT.plats;

    for (let i = 0; i < steps; i++) {
      vx += dir * ACC * DT;
      const fr = onIce ? ICE_FRIC : FRIC;
      if (dir === 0) vx -= vx * Math.min(1, fr * DT);
      if (vx > MAXV) vx = MAXV; else if (vx < -MAXV) vx = -MAXV;
      vy += GRAV * DT; if (vy > 1150) vy = 1150;
      x += vx * DT; y += vy * DT;

      if (x < r) { x = r; vx = Math.abs(vx) * 0.96; }
      if (x > W - r) { x = W - r; vx = -Math.abs(vx) * 0.96; }

      onIce = false;
      if (vy > 0) {
        for (let k = 0; k < ps.length; k++) {
          const p = ps[k];
          if (p.broken) continue;
          if (x > p.x - 6 && x < p.x + p.w + 6 &&
              y + r > p.y && y + r < p.y + p.h + vy * DT + 6) {
            y = p.y - r;
            vy = -(600 + Math.abs(vx) * 1.05);
            onIce = p.type !== 'base';
            if (p.f > best) best = p.f;
            landed++;
            break;
          }
        }
      }

      const target = y - H * 0.42;
      if (target < cam) cam += (target - cam) * Math.min(1, DT * 8);
      if (y - cam > H + 80) { died = true; break; }
    }
    return { best, landed, died, y };
  }

  return function pick() {
    if (FT.state !== 'play') return;
    const steps = Math.round(HORIZON / DT);
    let bestDir = 0, bestScore = -Infinity;
    for (const d of [-1, 0, 1]) {
      const s = simulate(d, steps);
      // climbing is the goal; dying inside the horizon is close to fatal,
      // and landings are a mild tiebreak so it prefers busy, readable play
      let score = (s.best - FT.maxFloor) * 100 + s.landed * 2;
      if (s.died) score -= 10000;
      // prefer keeping momentum when two options tie
      if (d !== 0 && Math.sign(d) === Math.sign(FT.P.vx)) score += 1;
      if (score > bestScore) { bestScore = score; bestDir = d; }
    }
    FT.setDir(bestDir);
  };
};
