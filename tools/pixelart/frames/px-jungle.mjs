// Canopy Falls: a rainforest diorama round a lashed wooden window. Monstera and banana leaves crown it,
// a waterfall tumbles down mossy rocks into a lily pool, a sleepy sloth naps on a liana, a toucan-ish
// bird perches on the corner, a tree frog sits on a lily pad and fireflies drift through the mist.
import { Canvas, rng, bayer } from '../pixel.mjs';
import { INK, inset, part, sprite, spriteMask, sparkle } from '../kit.mjs';

const W = 304, H = 208, HOLE = [56, 48, 192, 108], HR = 4; // 16:9
const FR = [46, 38, 212, 128]; // wooden frame round the screen

const Lf = ['#0e2a2c', '#154438', '#1e6040', '#2c8244', '#4fa646', '#86c955', '#c6e87e']; // leaf
const Ld = ['#0a1a22', '#0e2a2c', '#133a36', '#1a4c3e', '#246246', '#327a4e', '#4a9258']; // shaded far leaf
const Bn = ['#163a26', '#245e2e', '#3c8634', '#66ab3c', '#9ccc58', '#d4ec90', '#f2fac4']; // banana leaf
const Bg = ['#071319', '#0b1d24', '#10292e', '#163636', '#1d453f', '#285749', '#386c55', '#4f8463']; // backdrop
const Wd = ['#2a1712', '#4a2a1a', '#6e4226', '#955f34', '#ba8244', '#dcab68', '#f2d49a']; // wood
const Bk = ['#1a1420', '#2c2229', '#433431', '#5c4a3e', '#7a6450', '#9a8266']; // bark
const Rk = ['#151826', '#232a38', '#363f4c', '#4e5a62', '#6c7a7a', '#93a198']; // wet rock
const Wa = ['#0b2c4a', '#124f72', '#1a7c9c', '#2fb0c4', '#74e0e6', '#c8fbf6', '#ffffff']; // water
const Li = ['#232414', '#3e4420', '#5f6a2c', '#86923a', '#b0bb58']; // liana
const Sl = ['#2c1f1c', '#4a362c', '#6e5440', '#927456', '#b49674', '#d6bc98']; // sloth fur
const Cm = ['#8a7258', '#c4ab88', '#e8d6b4', '#fbf0d8']; // cream
const Tc = ['#0f0c1a', '#1c1830', '#2c2848', '#403c64', '#5a5682']; // toucan plumage
const Bq = ['#7a1f16', '#c83a22', '#ff6a2e', '#ff9c34', '#ffd04a', '#fff09a']; // beak
const Or = ['#5a1748', '#9a2a78', '#d24a9e', '#f582c4', '#ffc4e6']; // orchid
const Fg = ['#1d4a1e', '#2f7a24', '#4cae2c', '#86dc42', '#c8f77a']; // frog
const Rd = ['#5a0f1e', '#a01f2a', '#e03a2e', '#ff7a3a', '#ffc06a']; // bromeliad bracts
const Sd = ['#160e16', '#24161a', '#3a2420', '#53362a', '#6e4c34', '#8c6644']; // soil
const FF = ['#f6ff9a', '#fffbe0']; // fireflies

const clamp = (v, a, b) => Math.max(a, Math.min(b, v));

// Catmull-Rom through the points, ~1px steps.
function spline(P) {
  const out = [];
  for (let i = 0; i + 1 < P.length; i++) {
    const [a, b, c, d] = [P[Math.max(0, i - 1)], P[i], P[i + 1], P[Math.min(P.length - 1, i + 2)]];
    const n = Math.ceil(Math.hypot(c[0] - b[0], c[1] - b[1]));
    for (let k = 0; k < n; k++) {
      const t = k / n, t2 = t * t, t3 = t2 * t;
      out.push([0, 1].map((j) => 0.5 * (2 * b[j] + (-a[j] + c[j]) * t + (2 * a[j] - 5 * b[j] + 4 * c[j] - d[j]) * t2 + (-a[j] + 3 * b[j] - 3 * c[j] + d[j]) * t3)));
    }
  }
  return out.concat([P[P.length - 1]]).map(([x, y]) => [Math.round(x), Math.round(y)]);
}

/**
 * Big tropical leaf from its base (x0, y0) pointing at `deg`: 'mon' = round monstera with slits and
 * holes, 'ban' = long banana leaf with a few tears. Lit half faces the top-left; ink outlined.
 */
function leaf(cv, x0, y0, deg, L, Wm, R, { kind = 'mon', seed = 1, stem = 0, shadow = true, flat = false } = {}) {
  const a = (deg * Math.PI) / 180, dx = Math.cos(a), dy = Math.sin(a), nx = -dy, ny = dx;
  const rnd = rng(seed);
  const hw = kind === 'mon'
    ? (u) => Wm * Math.max(0, Math.sin(Math.PI * Math.min(1, u * 1.04))) ** 0.55
    : (u) => Wm * Math.min(1, u * 5) * Math.sqrt(Math.max(0, 1 - u ** 3));
  const tears = kind === 'ban' ? Array.from({ length: 5 }, () => [0.2 + rnd() * 0.7, rnd() < 0.5 ? -1 : 1]) : [];
  const ph = rnd() * 5;
  const loc = (x, y) => {
    const px = x + 0.5 - x0, py = y + 0.5 - y0, u = (px * dx + py * dy) / L, v = px * nx + py * ny;
    return { u, v, h: hw(u) };
  };
  const VP = 7; // vein period along the leaf
  const vein = (u, v) => ((u * L + Math.abs(v) * 0.7 + (v < 0 ? ph : 0)) % VP + VP) % VP;
  const m = cv.mask(), r = L + Wm + 2;
  m.plot((x, y) => {
    const { u, v, h } = loc(x, y);
    if (u < 0 || u > 1 || Math.abs(v) > h) return false;
    const s = Math.abs(v) / Math.max(h, 0.01);
    if (kind === 'mon') {
      if (u < 0.09 && Math.abs(v) > 1.2) return false;
      const f = vein(u, v);
      if (s > 0.5 && u > 0.14 && u < 0.9 && f < 1.05) return false; // slits
      if (s > 0.2 && s < 0.38 && u > 0.3 && u < 0.78 && f > 3.2 && f < 4.4) return false; // holes
    } else {
      for (const [tu, side] of tears) if (Math.sign(v) === side && s > 0.3 && Math.abs(u * L - tu * L - Math.abs(v) * 0.4) < 0.6) return false;
    }
    return true;
  }, x0 - r, y0 - r, x0 + r + 1, y0 + r + 1);
  if (stem) {
    const sm = cv.mask().capsule(Math.round(x0 - dx * stem), Math.round(y0 - dy * stem), Math.round(x0 + dx * 2), Math.round(y0 + dy * 2), 0.8);
    cv.outline(INK, sm.sub(m), { all: true });
    cv.fill(sm.sub(m), R[3]);
  }
  if (shadow) cv.cast(m.dilate(1), 1, 1, -1);
  const litSign = nx + ny > 0 ? -1 : 1; // v side whose normal faces the light
  cv.fill(m, (x, y) => {
    const { u, v } = loc(x, y);
    let i = Math.sign(v) === litSign || Math.abs(v) < 0.6 ? 4 : 3;
    if (Math.abs(v) < 0.9 && u < 0.92) i = 5; // midrib
    else if (!flat && kind === 'mon' && vein(u, v) < 1 && Math.abs(v) > 2) i -= 1;
    else if (!flat && kind === 'ban' && (u * L + Math.abs(v) * 0.4) % 6 < 1) i -= 1;
    if (u < 0.1) i -= 1;
    if (!m.has(x, y - 1) || !m.has(x - 1, y)) i += 1;
    else if (!m.has(x, y + 1) || !m.has(x + 1, y)) i -= 1;
    return R[clamp(i, 0, R.length - 1)];
  });
  cv.outline(INK, m, { all: true });
  return m;
}

/** Liana along a spline: 2px vine, lit on top, ink outlined, little heart leaves every few pixels. */
function liana(cv, pts, { leaves = 6, seed = 3 } = {}) {
  const P = spline(pts), m = cv.mask(), rnd = rng(seed);
  for (let i = 0; i + 1 < P.length; i++) m.capsule(P[i][0], P[i][1], P[i + 1][0], P[i + 1][1], 0.75);
  cv.cast(m.dilate(1), 1, 1, -1);
  cv.outline(INK, m, { all: true });
  cv.fill(m, (x, y) => (!m.has(x, y - 1) ? Li[4] : !m.has(x, y + 1) ? Li[1] : Li[2]));
  if (leaves) for (let i = 4; i < P.length - 2; i += leaves) {
    const [x, y] = P[i], up = rnd() < 0.5;
    const rows = up ? ['.kk.', 'kabk', 'kbbk', '.kk.'] : ['.kk.', 'kabk', 'kbbk', '.kk.'];
    sprite(cv, x + (up ? 0 : -3), y + (up ? -3 : 1), rows, { k: INK, a: Lf[6], b: Lf[4] });
  }
  return P;
}

function orchid(cv, x, y) {
  const rows = ['..k.k..', '.kak.kak', 'kabbkbbak', '.kbbwbbk.', '..kbyBk..', '...kBk...', '....k....'];
  const pal = { k: INK, a: Or[4], b: Or[3], w: '#ffffff', y: '#ffd04a', B: Or[1] };
  sprite(cv, x - 4, y - 3, rows, pal);
}

function bromeliad(cv, bx, by, s = 1) {
  const m = cv.mask();
  for (const [deg, len] of [[-160, 9], [-135, 11], [-110, 12], [-70, 12], [-45, 11], [-20, 9]]) {
    const a = (deg * Math.PI) / 180;
    m.capsule(bx, by, Math.round(bx + Math.cos(a) * len * s), Math.round(by + Math.sin(a) * len * s), 1.1);
  }
  part(cv, m, Lf, { top: [6], left: [5], bottom: [2], right: [3], fill: 4 });
  const sp = cv.mask().poly([[bx - 2.5, by + 0.5], [bx + 0.5, by - 12 * s], [bx + 3.5, by + 0.5]]);
  part(cv, sp, Rd, { top: [4], left: [3], bottom: [0], right: [1], fill: 2, shadow: false });
  for (let k = 0; k < 3; k++) cv.set(bx - 1 + (k % 2) * 2, by - 3 - k * 3, Rd[4]);
}

export default {
  id: 'px-jungle', name: 'Canopy Falls', theme: 'jungle', rarity: 'rare', translucent: false,
  collection: 'wild-pixels', license: 'CC-BY-4.0',
  desc: 'Play in a misty rainforest where a waterfall splashes, a sloth snoozes on a vine and a tree frog cheers you on.',
  tags: ['jungle', 'rainforest', 'waterfall', 'animals', 'animated', 'pixel'],
  css: '.w1{animation:w1 .54s steps(1) infinite}.w2{animation:w2 .54s steps(1) infinite}' +
    '@keyframes w1{0%{opacity:0}33%{opacity:1}66%{opacity:0}}@keyframes w2{0%{opacity:0}66%{opacity:1}}' +
    '.zz{animation:zz 2.6s steps(1) infinite}@keyframes zz{0%{opacity:0}50%{opacity:1}}' +
    '.ff{animation:ff 3.2s steps(1) infinite}.ff2{animation:ff 3.2s steps(1) -1.6s infinite}@keyframes ff{0%,55%{opacity:1}56%,100%{opacity:0}}' +
    '.bl{animation:bl 4.4s steps(1) infinite}@keyframes bl{0%{opacity:0}92%{opacity:1}96%{opacity:0}}',
  draw() {
    const cv = new Canvas(W, H), rnd = rng(11);
    cv.use(Lf, Ld, Bn, Bg, Wd, Bk, Rk, Wa, Li, Sl, Cm, Tc, Bq, Or, Fg, Rd, Sd);

    // ---- misty backdrop: deep canopy shade fading to mist, far trunks and light shafts ----
    const back = cv.mask().rrect(4, 10, W - 8, 186, 12);
    cv.grad(back, Bg.slice(1, 7), { from: 10, to: 186, soft: 0.14 });
    for (const [x, w] of [[8, 6], [40, 4], [64, 7], [100, 4], [196, 5], [232, 7], [252, 4], [292, 5]]) {
      const t = back.and(cv.mask().rect(x, 10, w, 186));
      cv.tone(t, -1).tone(t.and(cv.mask().rect(x, 10, 1, 186)), 1);
    }
    cv.fill(back, (x, y, c) => { // light shafts from the top-left (solid: they only show above the frame)
      const k = (((x - y * 0.7) % 52) + 52) % 52;
      return k < 7 && y < 60 ? cv.step(c, 1) : c;
    });
    cv.fill(back, (x, y, c) => { // mist pooling low: horizontal wisps that thicken towards the ground
      const t = clamp((y - 116) / 56, 0, 1), n = Math.sin(x * 0.17 + y * 1.1) * 0.5 + 0.5;
      return (y % 2 ? n < t * 1.3 - 0.3 : n < t * 0.8 - 0.1) ? cv.step(c, 1) : c;
    });
    for (let i = 0; i < 26; i++) { // distant leaf clumps
      const x = 6 + Math.floor(rnd() * (W - 12)), y = 14 + Math.floor(rnd() * 26), r = 4 + Math.floor(rnd() * 5);
      const b = cv.mask().oval(x - r, y - r * 0.6, 2 * r, r * 1.3).and(back);
      cv.fill(b, (px, py) => Ld[py - (y - r * 0.6) < 2 ? 4 : 3]);
    }

    // ---- far canopy silhouettes breaking the top edge ----
    for (const [x, y, d, L, w, k] of [[96, 24, -100, 24, 10, 'mon'], [122, 20, -70, 20, 8, 'mon'], [184, 22, -110, 22, 9, 'mon'],
      [210, 22, -60, 24, 10, 'mon'], [150, 18, -95, 18, 5, 'ban'], [70, 26, -125, 22, 9, 'mon'], [236, 24, -80, 22, 5, 'ban']]) {
      leaf(cv, x, y, d, L, w, Ld, { kind: k, seed: x, shadow: false, flat: true });
    }

    // ---- right: big tree trunk with root flare ----
    const trunk = cv.mask().plot((x, y) => {
      const c = 277 + Math.sin(y * 0.05) * 1.5, hw = 13 + Math.max(0, (y - 150) * 0.35) ** 1.1;
      return Math.abs(x + 0.5 - c) < hw;
    }, 250, 0, W, 196);
    cv.fill(trunk, (x, y) => {
      const c = 277 + Math.sin(y * 0.05) * 1.5, hw = 13 + Math.max(0, (y - 150) * 0.35) ** 1.1, t = (x + 0.5 - c + hw) / (2 * hw);
      let i = t < 0.12 ? 4 : t < 0.38 ? 3 : t < 0.72 ? 2 : 1;
      const gx = x + Math.round(Math.sin(y * 0.07) * 2); // bark grooves: long wobbly vertical lines
      if ((((gx % 6) + 6) % 6) === 0 && t > 0.08 && t < 0.9) i -= 1;
      return Bk[clamp(i, 0, 5)];
    });
    cv.fill(trunk, (x, y, c) => { // moss creeping up the lit side in soft patches
      const c0 = 277 + Math.sin(y * 0.05) * 1.5, hw = 13 + Math.max(0, (y - 150) * 0.35) ** 1.1, t = (x + 0.5 - c0 + hw) / (2 * hw);
      const n = Math.sin(y * 0.09) + Math.sin(y * 0.23 + 1.2) * 0.6;
      return n > -0.3 && t < 0.1 + n * 0.1 ? (t < 0.06 ? Lf[5] : Lf[4]) : c;
    });
    const knot = cv.mask().oval(276, 140, 9, 12);
    cv.fill(knot.dilate(1), Bk[1]).fill(knot, Bk[0]).fill(knot.and(cv.mask().rect(276, 140, 9, 3)), INK);
    cv.outline(INK, trunk, { all: true });

    // ---- left: mossy cliff of boulders behind the waterfall ----
    const rocks = [[-2, 34, 22, 20], [14, 30, 30, 16], [30, 40, 18, 20], [-2, 52, 16, 26], [36, 58, 14, 26], [-2, 76, 14, 30],
      [34, 82, 16, 26], [-2, 104, 16, 26], [36, 106, 14, 24], [-2, 128, 18, 26], [34, 128, 16, 24], [-2, 152, 20, 22], [32, 150, 18, 24]];
    for (const [x, y, w, h] of rocks) {
      const m = cv.mask().rrect(x, y, w, h, 5);
      part(cv, m, Rk, { top: [5], left: [4], bottom: [0], right: [1], fill: 2 });
      const top = m.and(m.shift(0, 3).not()).and(m.erode(1)); // moss cap
      cv.fill(top, Lf[4]).fill(top.and(top.shift(0, 1).not()), Lf[5]);
      cv.fill(m.and(m.shift(0, 4).not()).sub(top).and(m.erode(1)).and(cv.mask().rect(x + 3, y, w - 6, h)), Lf[3]);
    }

    // ---- waterfall pouring off the lip into the pool (3 frames) ----
    const FX0 = 12, FX1 = 34, FY0 = 42, FY1 = 178;
    // Wide ribbons are static tall rects; only the thin bright streak columns carry highlights that
    // tumble down (period 15, three frames five rows apart), which keeps the SVG small.
    const STREAK = { 2: 0, 6: 5, 10: 11, 15: 3, 19: 8 }; // column -> phase
    const fall = cv.mask().rect(FX0, FY0, FX1 - FX0, FY1 - FY0).or(cv.mask().rrect(FX0 - 1, FY0 - 4, FX1 - FX0 + 2, 8, 3));
    const fallC = (x, y, off) => {
      const i = x - FX0, w = FX1 - FX0;
      if (i <= 0) return Wa[3];
      if (i >= w - 1) return Wa[2];
      let b = i < 4 ? 5 : i > w - 5 ? 3 : 4;
      if (i in STREAK) {
        const p = (((y - off - STREAK[i]) % 15) + 15) % 15;
        b += p < 5 ? 2 : p < 11 ? 1 : 0; // bright dash, streak, gap
      }
      if (y < FY0 + 2) b = 6;
      else if (y < FY0 + 5) b = Math.max(b, 5);
      return Wa[clamp(b, 2, 6)];
    };
    cv.outline(INK, fall, { all: true });
    cv.fill(fall, (x, y) => fallC(x, y, 0));
    const fall0 = cv.p.slice();

    // ---- ground slab, soil face and the lily pool ----
    let ground = cv.mask().rect(0, 166, W, 32);
    for (let x = 0; x < W; x += 6) ground.circle(x + 3, 167 + Math.round(Math.sin(x * 0.7) * 1.5), 3);
    ground = ground.sub(cv.mask().rect(FX0 - 1, 160, FX1 - FX0 + 2, 20)); // channel: the fall lands in the pool
    const soil = cv.mask().rrect(2, 194, W - 4, 13, [0, 0, 5, 5]);
    cv.fill(ground, (x, y) => (y < 170 ? Lf[5] : y < 172 ? ((x + y) % 2 ? Lf[4] : Lf[5]) : Lf[4]));
    for (let i = 0; i < 34; i++) { // grass tufts
      const x = 4 + Math.floor(rnd() * (W - 8)), y = 176 + Math.floor(rnd() * 14);
      cv.px([[x, y], [x + 1, y], [x + 1, y - 1]], Lf[3]);
    }
    cv.shade(soil, Sd, { top: [2], left: [4], bottom: [0], right: [1], fill: 3 });
    for (let i = 0; i < 40; i++) { const x = 6 + Math.floor(rnd() * (W - 12)), y = 197 + Math.floor(rnd() * 7); cv.set(x, y, rnd() < 0.5 ? Sd[5] : Sd[1]); }
    for (const [x, y] of [[40, 198], [130, 200], [214, 197], [258, 200]]) part(cv, cv.mask().rrect(x, y, 6, 4, 1), Rk, { top: [5], left: [4], bottom: [1], right: [2], fill: 3 });
    for (const x of [24, 86, 160, 200, 286]) { // dangling roots
      let rx = x;
      for (let y = 195; y < 205; y++) { cv.set(rx, y, Sd[5]); if (rnd() < 0.3) rx += rnd() < 0.5 ? -1 : 1; }
    }
    cv.fill(ground.and(soil.shift(0, -1)).sub(soil), Lf[2]);
    const pool = cv.mask().oval(4, 171, 176, 26);
    cv.shade(pool, Wa, { top: [0, 1], left: [1], bottom: [4], right: [3], fill: (x, y) => (y < 184 ? Wa[1] : Wa[2]) });
    for (let i = 0; i < 18; i++) { // glints
      const x = 40 + Math.floor(rnd() * 130), y = 178 + Math.floor(rnd() * 16), l = 3 + Math.floor(rnd() * 6);
      cv.fill(cv.mask().rect(x, y, l, 1).and(pool.erode(2)), Wa[3]);
    }
    cv.outline(INK, pool, { all: true });
    cv.fill(pool.ring().and(fall.erode(2)), Wa[5]); // no shelf line where the fall pours in
    const pool0 = cv.p.slice();

    // lily pads + lotus
    for (const [x, y, w] of [[98, 183, 18], [62, 188, 13], [144, 179, 12], [130, 190, 10]]) {
      const pad = cv.mask().oval(x, y, w, Math.round(w * 0.42)).sub(cv.mask().poly([[x + w / 2, y + w * 0.21], [x + w * 0.85, y + w * 0.42 + 1], [x + w * 0.6, y + w * 0.42 + 1]]));
      part(cv, pad, Lf, { top: [6], left: [5], bottom: [2], right: [3], fill: 4 });
    }
    sprite(cv, 64, 182, ['..k.k..', '.kak.ak', 'kabkbak', '.kbbbk.', '..kkk..'].map((r) => r.padEnd(7, '.')), { k: INK, a: Or[4], b: Or[3] });

    // ---- the wooden frame, lashed at the corners, mossy on top ----
    const frame = cv.mask().rrect(...FR, 6);
    part(cv, frame, Wd, { top: [6, 5], left: [5], bottom: [1, 2], right: [2], fill: 4, dy: 2 });
    const [hx, hy, hw, hh] = HOLE;
    cv.fill(frame.erode(2), (x, y, c) => { // grain: along the beams
      const top = y < hy - 3, bot = y >= hy + hh + 3, side = !top && !bot;
      const g = side ? (x - FR[0]) % 5 === 2 && Math.sin(y * 0.23 + x) > -0.3 : (y - FR[1]) % 5 === 2 && Math.sin(x * 0.19 + y) > -0.3;
      return g ? cv.step(c, -1) : c;
    });
    for (const [ox, oy, sx, sy] of [[FR[0], FR[1], 1, 1], [FR[0] + FR[2] - 1, FR[1], -1, 1], [FR[0], FR[1] + FR[3] - 1, 1, -1], [FR[0] + FR[2] - 1, FR[1] + FR[3] - 1, -1, -1]]) {
      const box = cv.mask().rect(Math.min(ox, ox + sx * 9), Math.min(oy, oy + sy * 9), 10, 10).and(frame);
      cv.fill(box, (x, y) => { // twine wraps
        const k = (((x * sx + y * sy) % 3) + 3) % 3;
        return k === 0 ? Li[1] : k === 1 ? Li[4] : Li[3];
      });
      cv.outline(INK, box.and(frame.erode(1)), {});
    }
    inset(cv, ...HOLE, HR, { rim: INK, top: Wd[0], left: Wd[1], bottom: Wd[3], right: Wd[2] }, 2);
    cv.fill(frame.and(cv.mask().rect(FR[0] + 10, FR[1], FR[2] - 20, 3)).sub(frame.shift(0, 1).not()), (x, y, c) => { // moss on the top beam
      const n = Math.sin(x * 0.21) + Math.sin(x * 0.53 + 2) * 0.7;
      return n > 0.2 - (y - FR[1]) * 0.5 ? (y === FR[1] ? Lf[6] : bayer(x, y) < 0.5 ? Lf[5] : Lf[4]) : c;
    });

    // ---- lianas: the sloth's swing across the top, plus two dangling down the sides ----
    liana(cv, [[52, 10], [100, 15], [152, 17], [204, 14], [262, 6]], { leaves: 9, seed: 5 });
    liana(cv, [[52, 30], [46, 60], [43, 92], [45, 116], [49, 124], [52, 120]], { leaves: 8, seed: 8 });
    liana(cv, [[262, 34], [262, 62], [261, 84], [258, 96], [255, 92]], { leaves: 8, seed: 9 });

    // ---- foreground leaves: monstera crown top-left, banana fronds top-right, corners below ----
    leaf(cv, 38, 40, -150, 32, 14, Lf, { seed: 1, stem: 6 });
    leaf(cv, 40, 38, -105, 34, 15, Lf, { seed: 2, stem: 6 });
    leaf(cv, 46, 40, -55, 28, 12, Lf, { seed: 3, stem: 6 });
    leaf(cv, 272, 36, -120, 46, 8, Bn, { kind: 'ban', seed: 4, stem: 4 });
    leaf(cv, 276, 34, -75, 40, 8, Bn, { kind: 'ban', seed: 5, stem: 4 });
    leaf(cv, 280, 38, -20, 34, 8, Bn, { kind: 'ban', seed: 6, stem: 4 });
    leaf(cv, 294, 196, -140, 28, 12, Lf, { seed: 7, stem: 4 });
    leaf(cv, 300, 186, -95, 22, 9, Lf, { seed: 8, stem: 2 });
    leaf(cv, 236, 192, -60, 18, 5, Bn, { kind: 'ban', seed: 9 });
    leaf(cv, 6, 196, -60, 22, 9, Lf, { seed: 10 });

    // ---- epiphytes ----
    for (const [x, y] of [[286, 104], [293, 112], [284, 118]]) orchid(cv, x, y);
    cv.fill(cv.mask().line(280, 98, 290, 102).or(cv.mask().line(290, 102, 296, 110)), Lf[2]);
    bromeliad(cv, 266, 128);
    bromeliad(cv, 222, 172, 0.9);
    for (const [x, y] of [[40, 142], [44, 150]]) orchid(cv, x, y);

    // ---- sleepy sloth hanging from the liana ----
    const sx = 152, vy = 17;
    const arms = cv.mask().capsule(sx - 6, vy + 10, sx - 7, vy, 2.2).or(cv.mask().capsule(sx + 6, vy + 10, sx + 7, vy, 2.2));
    part(cv, arms, Sl, { top: [3], left: [3], bottom: [0], right: [1], fill: 2 });
    for (const x of [sx - 9, sx + 5]) sprite(cv, x, vy - 2, ['.w.w.', 'w.w.w'], { w: Cm[3] });
    const legs = cv.mask().oval(sx - 10, vy + 18, 7, 7).or(cv.mask().oval(sx + 4, vy + 18, 7, 7));
    part(cv, legs, Sl, { top: [4], left: [3], bottom: [0], right: [1], fill: 2 });
    part(cv, cv.mask().oval(sx - 8, vy + 9, 17, 15), Sl, { top: [4], left: [4], bottom: [1], right: [2], fill: 3 });
    cv.fill(cv.mask().oval(sx - 4, vy + 14, 9, 8), Sl[4]);
    part(cv, cv.mask().oval(sx - 8, vy + 1, 17, 13), Sl, { top: [5], left: [4], bottom: [1], right: [2], fill: 3 });
    const face = cv.mask().oval(sx - 6, vy + 4, 13, 9);
    cv.shade(face, Cm, { top: [3], left: [3], bottom: [1], right: [2], fill: 2 });
    sprite(cv, sx - 7, vy + 6, ['dd.........dd', '.ddd.....ddd.', '..kd.....dk..', '...k.....k...'].map((r, j) => j === 3 ? r : r), { d: Sl[2], k: INK });
    sprite(cv, sx - 4, vy + 8, ['k..k.k..k', '.kk...kk.'], { k: INK });
    sprite(cv, sx - 1, vy + 9, ['kkk', '.k.'], { k: Sl[0] });
    sprite(cv, sx - 6, vy + 10, ['pp.......pp'], { p: '#f2a0a0' });

    // ---- toucan-ish bird on the top-right corner ----
    const tx = 252, ty = 38; // feet on the frame
    part(cv, cv.mask().rect(tx + 5, ty - 6, 6, 18), Tc, { top: [2], left: [2], bottom: [0], right: [0], fill: 1 }); // tail
    const body = cv.mask().oval(tx - 6, ty - 24, 17, 24);
    part(cv, body, Tc, { top: [4], left: [3], bottom: [0], right: [1], fill: 2, dy: 1 });
    const bib = cv.mask().oval(tx - 6, ty - 20, 10, 12).and(body.erode(1));
    cv.shade(bib, Bq, { top: [5], left: [5], bottom: [3], right: [4], fill: 4 });
    cv.fill(cv.mask().oval(tx - 5, ty - 9, 8, 5).and(body.erode(1)), Rd[2]);
    const wing = cv.mask().oval(tx + 1, ty - 18, 9, 15).and(body);
    cv.fill(wing, (x, y) => (y > ty - 7 && (x + y) % 3 === 0 ? Tc[3] : Tc[1]));
    cv.outline(INK, wing.and(body.erode(1)).ring().and(body.erode(1)).sub(bib), { all: true });
    const beak = cv.mask().poly([[tx - 3, ty - 23], [tx - 12, ty - 25], [tx - 22, ty - 23], [tx - 27, ty - 18], [tx - 25, ty - 16], [tx - 15, ty - 16], [tx - 4, ty - 14]]);
    cv.cast(beak.dilate(1), 1, 1, -1);
    cv.fill(beak, (x, y) => {
      const t = (tx - 3 - x) / 24;
      let i = t < 0.3 ? 4 : t < 0.75 ? 3 : 2;
      if (t > 0.88) i = 1;
      if (!beak.has(x, y - 1)) i += 1;
      else if (!beak.has(x, y + 1)) i -= 1;
      return Bq[clamp(i, 0, 5)];
    });
    cv.fill(cv.mask().line(tx - 4, ty - 18, tx - 22, ty - 19).and(beak), Bq[0]);
    cv.outline(INK, beak, { all: true });
    sprite(cv, tx - 3, ty - 22, ['.bb.', 'bkwb', 'bkkb', '.bb.'], { b: '#5cc8ff', k: INK, w: '#ffffff' });
    sprite(cv, tx - 2, ty - 1, ['g.g.g', 'ggggg'], { g: '#6a7a9a' });

    // ---- tree frog on the big lily pad ----
    const fx = 100, fy = 176;
    const frog = cv.mask().oval(fx, fy + 3, 15, 8).or(cv.mask().circle(fx + 3, fy + 3, 2)).or(cv.mask().circle(fx + 11, fy + 3, 2));
    part(cv, frog, Fg, { top: [4], left: [4], bottom: [1], right: [2], fill: 3 });
    cv.fill(cv.mask().oval(fx + 4, fy + 7, 7, 4).and(frog.erode(1)), Cm[3]);
    const eyes = [[fx + 2, fy + 2], [fx + 10, fy + 2]];
    for (const [x, y] of eyes) cv.rect(x, y, 3, 3, INK).set(x, y, '#ffffff');
    cv.px([[fx + 6, fy + 7], [fx + 7, fy + 8], [fx + 8, fy + 7]], INK);
    cv.px([[fx + 1, fy + 7], [fx + 13, fy + 7]], '#ff9cb0');
    sprite(cv, fx - 1, fy + 10, ['oo.............oo', '.o.............o.'], { o: Bq[3] });
    sprite(cv, fx + 3, fy + 11, ['ooo.....ooo'], { o: Bq[3] });

    cv.outline(INK);
    const base = cv.p.slice();

    // ---- animation layers ----
    // Water frames: only where the waterfall / pool is still visible in the final picture.
    const ripples = (off) => {
      const m = cv.mask();
      for (const k of [0, 1]) {
        const rx = 18 + k * 14 + off * 0.93, ry = rx * 0.28;
        m.plot((x, y) => Math.abs(Math.hypot((x + 0.5 - 23) / rx, (y + 0.5 - 179) / ry) - 1) < 0.07, 0, 170, 180, 198);
      }
      return m;
    };
    const foamC = (x, y, off) => { // solid foam blob that swells a little, plus a few hopping droplets
      const d = Math.hypot((x + 0.5 - 23) / (13 + ((off % 3) + 3) % 3), (y + 0.5 - 177) / 3.5);
      if (d < 1) return d < 0.55 ? Wa[6] : Wa[5];
      for (const [dx, dy] of [[-9, -3], [-4, -5], [6, -4], [11, -3]]) if (x === 23 + dx + (off % 2) && y === 177 + dy - (off % 2)) return Wa[6];
      return null;
    };
    // Only pixels still showing pristine water in the base belong to the animation.
    const wet = pool.erode(1);
    const wetShown = (x, y) => base[y * W + x] === pool0[y * W + x];
    const fallShown = (x, y) => base[y * W + x] === fall0[y * W + x];
    const waterAt = (off) => { // the water colour at every animated pixel for this frame
      const f = new Map();
      fall.each((x, y) => { if (fallShown(x, y)) f.set(y * W + x, fallC(x, y, off)); });
      wet.each((x, y) => { if (wetShown(x, y)) f.set(y * W + x, pool0[y * W + x]); });
      ripples(off).and(wet).each((x, y) => { if (wetShown(x, y)) f.set(y * W + x, Wa[3]); });
      wet.or(fall).each((x, y) => { const c = f.has(y * W + x) && foamC(x, y, off); if (c) f.set(y * W + x, c); });
      return f;
    };
    // Frame 0 goes into the base; the other frames only carry the pixels that differ from it.
    const f0 = waterAt(0);
    for (const [k, c] of f0) cv.set(k % W, Math.floor(k / W), c);
    for (const [cls, off] of [['w1', 5], ['w2', 10]]) {
      const l = cv.layer(cls);
      for (const [k, c] of waterAt(off)) if (c !== f0.get(k)) l.set(k % W, Math.floor(k / W), c);
    }

    // Snoozing Zs, drifting fireflies, frog blink.
    const zz = cv.layer('zz');
    sprite(zz, sx + 11, vy + 1, ['kkkk', '..k.', '.k..', 'kkkk'], { k: Cm[3] });
    sprite(cv, sx + 16, vy - 3, ['kkk', '.k.', 'kkk'], { k: Cm[2] });
    const ff = cv.layer('ff'), ff2 = cv.layer('ff2');
    for (const [x, y, l] of [[60, 30, ff], [230, 30, ff2], [292, 140, ff], [8, 26, ff2], [254, 150, ff2], [190, 34, ff]]) sparkle(l, x, y, 1, FF[0], FF[1]);
    for (const [x, y] of [[84, 36], [296, 70], [222, 20]]) cv.set(x, y, FF[0]);
    const bl = cv.layer('bl');
    for (const [x, y] of eyes) bl.rect(x, y, 3, 2, Fg[3]).rect(x, y + 2, 3, 1, INK);

    return cv.punch(...HOLE, HR);
  },
};
