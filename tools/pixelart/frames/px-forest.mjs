// Mossy Hollow: the screen sits in the hollow of a giant old tree. Leafy canopy on top, a squirrel on a
// side branch, an owl peeking from a knot-hole, hanging ivy, roots spreading over a mossy diorama base
// with a tiny door, a ring of red-cap mushrooms, ferns, fallen leaves and drifting fireflies.
import { Canvas, rng, bayer, ramp } from '../pixel.mjs';
import { INK, inset, part, sprite, spriteMask } from '../kit.mjs';

const W = 256, H = 256, HOLE = [64, 72, 128, 96], HR = 8; // 4:3
const Bk = ramp('#7a4e34', 7, { step: 0.1, hue: 4, sat: 0.03 }); // bark
const Hw = ramp('#c98d58', 6, { step: 0.1, hue: 5, sat: 0.04 }); // heartwood lip
const Lf = ramp('#3f8f3a', 7, { step: 0.11, hue: 6, sat: 0.05 }); // leaves
const Ms = ramp('#6ea83a', 5, { step: 0.12, hue: 6, sat: 0.05 }); // moss / grass
const Rd = ramp('#d8343c', 5, { step: 0.13, hue: 5, sat: 0.05 }); // mushroom caps
const Or = ramp('#d87830', 5, { step: 0.12, hue: 5, sat: 0.05 }); // squirrel / autumn leaves
const Ow = ramp('#8a6a52', 5, { step: 0.12, hue: 5, sat: 0.04 }); // owl
const Dt = ramp('#5e3c2a', 5, { step: 0.1, hue: 5, sat: 0.04 }); // soil
const Dr = ramp('#a8643a', 5, { step: 0.12, hue: 5, sat: 0.04 }); // door planks
const Cr = ramp('#e8d7b8', 5, { step: 0.1, hue: 5, sat: 0.04 }); // cream (stems, bellies)
const St = ['#3d3a4a', '#5f5b6e', '#878396', '#b1aec0']; // step stone
const GOLD = '#ffd36b', GLOW = '#fff3b0';

const lerp = (a, b, t) => a + (b - a) * t;
// Piecewise-linear level with dithered transitions (plateaus stay solid).
const level = (pts, t, x, y) => {
  let i = 0;
  while (i < pts.length - 2 && t > pts[i + 1][0]) i++;
  const [t0, v0] = pts[i], [t1, v1] = pts[i + 1], v = lerp(v0, v1, Math.min(1, Math.max(0, (t - t0) / (t1 - t0))));
  const k = Math.floor(v);
  return k + (v - k > bayer(x, y) ? 1 : 0);
};

// Tapering limb from a chain of points (radius r0 -> r1).
function limb(cv, pts, r0, r1) {
  const m = cv.mask();
  for (let i = 0; i + 1 < pts.length; i++) {
    const [ax, ay] = pts[i], [bx, by] = pts[i + 1];
    for (let s = 0; s <= 6; s++) {
      const t = (i + s / 6) / (pts.length - 1);
      m.circle(Math.round(lerp(ax, bx, s / 6)), Math.round(lerp(ay, by, s / 6)), lerp(r0, r1, t), 1.1);
    }
  }
  return m;
}

function shroom(cv, x, y, s) { // x = stem center, y = ground line, s = cap half-width
  const sh = Math.max(2, Math.round(s * 0.7)), sw = s > 3 ? 3 : 2, cy = y - sh;
  const stem = cv.mask().rect(x - (sw >> 1), cy, sw, sh);
  part(cv, stem, Cr, { top: [3], left: [3], bottom: [1], right: [1], fill: 2 });
  const cap = cv.mask().oval(x - s, cy - s, 2 * s + 1, 2 * s + 1, 1.05).clip(0, 0, cv.w, cy + 1);
  part(cv, cap, Rd, { top: [4], left: [3], bottom: [0], right: [1], fill: 2 });
  cv.rect(x - s + 1, cy, 2 * s - 1, 1, Rd[0]);
  const spots = s >= 4 ? [[-2, -3], [1, -4], [2, -2], [-3, -1]] : [[-1, -2], [1, -1]];
  for (const [dx, dy] of spots) if (cap.has(x + dx, cy + dy)) cv.set(x + dx, cy + dy, Cr[3]);
}

function fern(cv, bx, by, ang, len, bend, R) { // a curling frond; ang in radians (0 = right, -PI/2 = up)
  const spine = cv.mask(), leaf = cv.mask(), tip = cv.mask();
  let x = bx, y = by, a = ang;
  for (let i = 0; i < len; i++) {
    x += Math.cos(a); y += Math.sin(a); a += bend;
    const px = Math.round(x), py = Math.round(y);
    spine.put(px, py);
    if (i % 2 === 1) {
      const l = Math.max(1, Math.round((1 - i / len) * 4.5));
      for (const side of [-1, 1]) {
        const la = a + side * 1.1;
        for (let k = 1; k <= l; k++) (k === l ? tip : leaf).put(Math.round(px + Math.cos(la) * k), Math.round(py + Math.sin(la) * k - k * 0.3));
      }
    }
  }
  cv.fill(leaf, R[3]).fill(tip, R[4]).fill(spine, R[1]);
  return spine.or(leaf).or(tip);
}

export default {
  id: 'px-forest', name: 'Mossy Hollow', theme: 'forest', rarity: 'common', translucent: false,
  collection: 'wild-pixels', license: 'CC-BY-4.0',
  desc: 'Your game peeks out from the hollow of a cozy old tree, where an owl, a squirrel and a ring of red mushrooms keep you company.',
  tags: ['forest', 'tree', 'animals', 'mushrooms', 'cozy', 'pixel'],
  css: '.ffa{animation:ff 1.8s steps(1) infinite}.ffb{animation:ff 1.8s steps(1) -.9s infinite}' +
    '.ffc{animation:tw 2.6s steps(1) infinite}@keyframes ff{50%{opacity:0}}@keyframes tw{0%,58%{opacity:1}59%,100%{opacity:0}}',
  draw() {
    const cv = new Canvas(W, H), rnd = rng(11);
    cv.use(Bk, Hw, Lf, Ms, Rd, Or, Ow, Dt, Dr, Cr, St);
    const [hx, hy, hw, hh] = HOLE;

    // ---- diorama base: floor shadow, soil slab, mossy top -------------------------------------------
    const shadow = cv.mask().oval(12, 244, 232, 12);
    cv.fill(shadow, (x, y) => (Math.abs(x + 0.5 - 128) < 96 || bayer(x, y) < 0.5 ? INK : null));
    const top = cv.mask().oval(2, 204, 252, 40);
    let slab = top.clone();
    for (let k = 1; k <= 8; k++) slab = slab.or(top.shift(0, k));
    const face = slab.sub(top);
    cv.fill(face, (x, y) => {
      const b = top.bbox(), d = y - (b.y + b.h - 1) - 1; // rows below the top surface's lowest point
      const i = d < 2 ? 3 : d < 5 ? 2 : 1;
      return Dt[i - (x < 40 || x > 216 ? 1 : 0)];
    });
    face.each((x, y) => { if (rnd() < 0.05) cv.set(x, y, Dt[4]); });
    cv.fill(face.edge().and(face.shift(0, -1).not()), Dt[0]);
    for (const [x, y] of [[40, 248], [92, 251], [150, 250], [204, 248], [120, 247]]) sprite(cv, x, y, ['.ab', 'abb'], { a: St[3], b: St[1] });
    cv.fill(top, (x, y) => Ms[level([[0, 1.2], [0.25, 2], [0.65, 2.4], [1, 3.2]], 1 - (y - 204) / 40 + (x < 128 ? 0.08 : -0.08), x, y)]);
    top.each((x, y) => { const r = rnd(); if (r < 0.05) cv.set(x, y, Ms[4]); else if (r < 0.1) cv.set(x, y, Ms[1]); });
    for (let x = 4; x < W - 4; x += 2 + Math.floor(rnd() * 3)) { // grass lip hanging over the soil
      let y = 0; while (top.has(x, y + 1) || y < 200) { y++; if (y > 250) break; }
      if (top.has(x, y)) { cv.set(x, y + 1, Ms[1]); if (rnd() < 0.4) cv.set(x, y + 2, Ms[0]); }
    }

    // ---- ferns behind the trunk ----------------------------------------------------------------------
    const ferns = cv.mask();
    for (const [bx, by, a, l, b] of [[22, 222, -2.2, 26, 0.05], [18, 224, -2.7, 20, 0.07], [28, 222, -1.75, 22, -0.06],
      [236, 222, -0.95, 26, -0.05], [240, 224, -0.45, 20, -0.07], [228, 222, -1.4, 22, 0.06]]) ferns.or(fern(cv, bx, by, a, l, b, Lf)).d.forEach((v, i) => { if (v) ferns.d[i] = 1; });

    // ---- trunk: cylinder shading, bark furrows -------------------------------------------------------
    const half = (y) => 102 + Math.round(Math.sin(y * 0.09) * 1.2) + (y > 172 ? Math.round(((y - 172) / 54) ** 2 * 20) : 0);
    const trunk = cv.mask().plot((x, y) => Math.abs(x + 0.5 - 128) <= half(y) && y < 224 + Math.round(Math.abs(x - 128) / 24), 0, 14, W, 236);
    cv.cast(trunk, 2, 1, -1);
    const BAND = [[0, 3.4], [0.05, 5], [0.28, 5], [0.34, 4], [0.55, 4], [0.61, 3], [0.77, 3], [0.83, 2], [0.93, 2], [1, 1]];
    const tAt = (x, y) => (x + 0.5 - (128 - half(y))) / (2 * half(y));
    cv.fill(trunk, (x, y) => Bk[Math.min(6, level(BAND, tAt(x, y), x, y))]);
    for (let k = 0; k < 17; k++) { // furrows: dark groove, lit far wall
      const t0 = (k + 0.3 + rnd() * 0.4) / 17, ph = rnd() * 6;
      let y = 14 + Math.floor(rnd() * 10);
      while (y < 232) {
        const run = 10 + Math.floor(rnd() * 26);
        for (let j = 0; j < run && y < 232; j++, y++) {
          const h = half(y), x = Math.round(128 - h + t0 * 2 * h + Math.sin(y * 0.05 + ph) * 1.6);
          if (!trunk.has(x, y) || !trunk.has(x + 1, y)) continue;
          cv.set(x, y, cv.step(cv.get(x, y), -2));
          if (rnd() < 0.8) cv.set(x + 1, y, cv.step(cv.get(x + 1, y), 1));
        }
        y += 2 + Math.floor(rnd() * 5);
      }
    }

    // ---- roots ---------------------------------------------------------------------------------------
    const ROOTS = [
      [[[36, 190], [20, 210], [8, 226], [-2, 232]], 9, 3], [[[62, 200], [52, 216], [44, 232]], 7, 3],
      [[[220, 190], [236, 210], [248, 226], [258, 232]], 9, 3], [[[194, 200], [204, 216], [212, 232]], 7, 3],
      [[[110, 202], [106, 218], [98, 232]], 6, 3], [[[146, 202], [150, 218], [158, 232]], 6, 3],
    ];
    const roots = cv.mask();
    for (const [pts, r0, r1] of ROOTS) {
      const m = limb(cv, pts, r0, r1).and(cv.mask().rect(0, 0, W, 238));
      part(cv, m, Bk, { top: [5, 4], left: [4], bottom: [1], right: [2], fill: 3, dx: 2, dy: 1 });
      m.each((x, y) => { if (rnd() < 0.06 && m.has(x, y - 2) && m.has(x, y + 2)) cv.set(x, y, Bk[2]); });
      const mt = m.sub(m.shift(0, 2)).and(cv.mask().rect(0, 200, W, 40)); // moss on the root tops
      cv.fill(mt, (x, y) => (bayer(x, y) < 0.6 ? Ms[3] : Ms[2]));
      roots.d.forEach((v, i) => { if (m.d[i]) roots.d[i] = 1; });
    }

    // ---- canopy --------------------------------------------------------------------------------------
    const puffs = [[-2, 30, 15], [22, 34, 14], [48, 30, 16], [76, 34, 15], [104, 32, 16], [130, 34, 17], [156, 32, 16],
      [182, 34, 15], [208, 30, 16], [234, 34, 14], [258, 30, 15], [30, 14, 15], [72, 12, 17], [118, 10, 18], [160, 12, 17],
      [204, 14, 16], [244, 18, 12], [8, 20, 11], [96, 20, 13], [184, 22, 13]];
    const U = (dy, k = 1) => puffs.reduce((m, [x, y, r]) => m.circle(x, Math.round(y - dy * r), Math.round(r * k)), cv.mask());
    const crown = U(0);
    cv.cast(crown, 1, 3, -1).cast(crown, 1, 2, -1);
    cv.fill(crown, Lf[2]).fill(crown.and(U(0.25, 0.97)), Lf[3]).fill(crown.and(U(0.5, 0.94)), Lf[4]);
    cv.fill(crown.sub(crown.shift(1, 2)).and(U(0.5, 0.94)), Lf[5]);
    cv.fill(crown.sub(crown.shift(0, -2)), Lf[1]);
    crown.erode(2).each((x, y) => { // leaf texture: little lit leaves with a shadow tick
      if (rnd() < 0.045) { const c = cv.get(x, y); cv.set(x, y, cv.step(c, 1)).set(x + 1, y, cv.step(c, 1)).set(x + 1, y + 1, cv.step(c, -1)); }
    });
    for (const [x, y] of [[40, 22], [88, 8], [150, 24], [196, 10], [226, 28], [62, 38], [170, 40]]) // autumn flecks
      sprite(cv, x, y, ['ab', 'bc'], { a: Or[4], b: Or[2], c: Or[1] });
    cv.outline(INK, crown, { all: true });

    // ---- ivy -----------------------------------------------------------------------------------------
    for (const [x0, y0, y1, ph] of [[40, 46, 150, 0], [46, 48, 108, 2], [220, 46, 94, 1]]) {
      let vx = x0;
      for (let y = y0; y < y1; y++) {
        vx = x0 + Math.round(Math.sin(y * 0.16 + ph) * 1.4);
        cv.set(vx, y, Lf[1]);
        if (y % 5 === 0) sprite(cv, (y / 5) % 2 ? vx + 1 : vx - 3, y - 1, ['.ab', 'abb', '.b.'], { a: Lf[5], b: Lf[3] }, { flip: (y / 5) % 2 === 0 });
      }
      sprite(cv, vx - 1, y1, ['.a.', 'aba', '.b.'], { a: Lf[4], b: Lf[2] });
    }

    // ---- the hollow: heartwood lip + deep recessed rim -----------------------------------------------
    const lip = cv.mask().rrect(hx - 11, hy - 11, hw + 22, hh + 22, HR + 11);
    for (let i = 0; i < 26; i++) { // lumpy callus edge
      const a = rnd() * Math.PI * 2, px = 128 + Math.cos(a) * (hw / 2 + 10), py = hy + hh / 2 + Math.sin(a) * (hh / 2 + 10);
      lip.circle(Math.round(Math.min(hx + hw + 9, Math.max(hx - 10, px))), Math.round(Math.min(hy + hh + 9, Math.max(hy - 10, py))), 2 + Math.floor(rnd() * 2));
    }
    part(cv, lip, Hw, { top: [5, 4], left: [4], bottom: [0], right: [1], fill: 3, dx: 2, dy: 2 });
    const ring = cv.mask().rrect(hx - 6, hy - 6, hw + 12, hh + 12, HR + 6).edge();
    cv.fill(ring, (x, y) => (bayer(x, y) < 0.75 ? Hw[2] : null));
    cv.fill(cv.mask().rrect(hx - 4, hy - 4, hw + 8, hh + 8, HR + 4).sub(cv.mask().rrect(hx - 3, hy - 3, hw + 6, hh + 6, HR + 3)), Hw[2]);
    inset(cv, hx, hy, hw, hh, HR, { rim: INK, top: Bk[0], left: Bk[1], bottom: Bk[3], right: Bk[2] }, 2);
    // moss cushions on the top of the lip (kept off the inner edge)
    for (const [x, w] of [[60, 18], [96, 10], [150, 22]]) {
      const m = cv.mask().oval(x, hy - 14, w, 6).and(cv.mask().rect(0, 0, W, hy - 9));
      part(cv, m, Ms, { top: [4], left: [3], bottom: [1], right: [2], fill: 2, shadow: false });
    }

    // ---- side branch with a squirrel -----------------------------------------------------------------
    const br = limb(cv, [[30, 86], [14, 80], [-2, 76]], 3, 2).or(limb(cv, [[10, 79], [4, 70]], 1, 1));
    part(cv, br, Bk, { top: [5], left: [4], bottom: [1], right: [2], fill: 3 });
    sprite(cv, 0, 64, ['..ab..', '.abbc.', 'abbc..', '.bc...'], { a: Lf[5], b: Lf[3], c: Lf[1] });
    const sx = 12, sy = 78; // squirrel sits here (on the branch top), facing the screen
    const tail = cv.mask();
    for (const [x, y, r] of [[sx - 2, sy - 4, 3], [sx - 5, sy - 8, 3.6], [sx - 6, sy - 13, 3.8], [sx - 4, sy - 18, 3.4], [sx - 1, sy - 20, 2.4]]) tail.circle(x, y, r, 1.1);
    part(cv, tail, Or, { top: [4], left: [3], bottom: [1], right: [1], fill: 2 });
    cv.fill(tail.erode(2).and(cv.mask().rect(0, 0, sx - 5, H)), Or[3]);
    const body = cv.mask().oval(sx - 2, sy - 11, 10, 11);
    const head = cv.mask().oval(sx + 3, sy - 19, 10, 9);
    const ear = cv.mask().pts([[sx + 5, sy - 20], [sx + 5, sy - 21], [sx + 6, sy - 20]]);
    const sq = body.or(head).or(ear);
    part(cv, sq, Or, { top: [4], left: [3], bottom: [1], right: [1], fill: 2 });
    cv.fill(cv.mask().oval(sx + 3, sy - 9, 5, 7), Cr[3]).fill(cv.mask().oval(sx + 9, sy - 15, 4, 4), Cr[3]);
    cv.rect(sx + 7, sy - 17, 2, 2, INK).set(sx + 7, sy - 17, '#ffffff').set(sx + 12, sy - 14, INK).set(sx + 8, sy - 14, Rd[3]);
    sprite(cv, sx + 6, sy - 9, ['.aa.', 'abbc', 'dddd', 'deed', '.dd.'], { a: Dt[2], b: Dt[3], c: Dt[1], d: Hw[3], e: Hw[2] }); // acorn
    cv.px([[sx + 5, sy - 6], [sx + 10, sy - 6]], Or[3]);
    cv.rect(sx, sy - 1, 3, 1, Or[1]).rect(sx + 5, sy - 1, 3, 1, Or[1]);

    // ---- owl in a knot-hole --------------------------------------------------------------------------
    const ox = 206, oy = 100;
    const knot = cv.mask().oval(ox, oy, 24, 28);
    part(cv, knot, Hw, { top: [5, 4], left: [4], bottom: [0], right: [1], fill: 3, dx: 2, dy: 2 });
    const den = cv.mask().oval(ox + 4, oy + 4, 16, 20);
    cv.fill(den, (x, y) => (y < oy + 9 ? INK : Bk[0]));
    const owl = cv.mask().oval(ox + 5, oy + 7, 14, 18).and(den.or(cv.mask().rect(ox, oy + 20, 24, 10)))
      .or(cv.mask().pts([[ox + 6, oy + 6], [ox + 7, oy + 7], [ox + 17, oy + 6], [ox + 16, oy + 7]]));
    part(cv, owl, Ow, { top: [4], left: [3], bottom: [1], right: [1], fill: 2, shadow: false });
    cv.fill(cv.mask().oval(ox + 8, oy + 16, 8, 8).and(owl), Cr[2]);
    for (const [x, y] of [[ox + 10, oy + 18], [ox + 13, oy + 18], [ox + 11, oy + 21]]) cv.px([[x, y], [x + 1, y + 1]], Ow[2]);
    for (const ex of [ox + 6, ox + 13]) {
      cv.fill(cv.mask().oval(ex, oy + 9, 5, 5), Cr[3]);
      cv.rect(ex + 1, oy + 10, 3, 3, INK).set(ex + 1, oy + 10, '#ffffff');
    }
    cv.px([[ox + 11, oy + 13], [ox + 12, oy + 13], [ox + 11, oy + 14]], Or[3]).set(ox + 12, oy + 14, Or[1]);
    cv.px([[ox + 8, oy + 25], [ox + 10, oy + 25], [ox + 14, oy + 25], [ox + 16, oy + 25]], Or[2]);
    cv.fill(cv.mask().oval(ox + 4, oy + 4, 16, 20).sub(den.erode(1)).and(cv.mask().rect(0, oy + 22, W, 6)).sub(owl), Bk[0]);

    // ---- tiny door between the roots -----------------------------------------------------------------
    const dx0 = 121, dy0 = 200;
    cv.fill(cv.mask().rrect(dx0 - 2, dy0 - 2, 18, 26, [9, 9, 0, 0]), INK);
    const door = cv.mask().rrect(dx0, dy0, 14, 24, [7, 7, 0, 0]);
    cv.shade(door, Dr, { top: [4], left: [3], bottom: [1], right: [1], fill: 2 });
    for (const x of [dx0 + 4, dx0 + 9]) cv.fill(cv.mask().rect(x, dy0, 1, 24).and(door), Dr[0]);
    for (const y of [dy0 + 8, dy0 + 18]) cv.rect(dx0 + 1, y, 12, 1, St[1]).rect(dx0 + 1, y + 1, 12, 1, St[2]);
    const win = cv.mask().circle(dx0 + 7, dy0 + 5, 2);
    cv.outline(INK, win, { all: true }).fill(win, GOLD).set(dx0 + 6, dy0 + 4, GLOW).set(dx0 + 7, dy0 + 5, Or[3]);
    cv.set(dx0 + 11, dy0 + 13, GOLD).set(dx0 + 11, dy0 + 14, Or[1]);
    part(cv, cv.mask().rrect(dx0 - 3, dy0 + 23, 20, 5, 2), St, { top: [3], left: [3], bottom: [0], right: [1], fill: 2, dx: 2, dy: 1 });

    // ---- mushrooms: fairy ring on the right, a pair on the left root ---------------------------------
    const ring6 = [];
    for (let i = 0; i < 7; i++) { const a = (i / 7) * Math.PI * 2 + 0.3; ring6.push([Math.round(184 + Math.cos(a) * 16), Math.round(236 + Math.sin(a) * 4), [4, 3, 5, 3, 4, 3, 5][i]]); }
    ring6.sort((a, b) => a[1] - b[1]).forEach(([x, y, s]) => shroom(cv, x, y, s));
    shroom(cv, 72, 238, 5); shroom(cv, 82, 240, 3);
    shroom(cv, 22, 214, 3);

    // ---- fallen leaves --------------------------------------------------------------------------------
    const LEAVES = [['.ab', 'abb', 'b..'], ['ab.', 'bbc', '.c.'], ['.a', 'ab', 'bc']];
    for (const [x, y, k, c] of [[30, 238, 0, 0], [52, 242, 1, 1], [92, 236, 2, 2], [112, 241, 0, 1], [140, 238, 1, 0], [164, 242, 2, 1],
      [212, 240, 0, 2], [232, 236, 1, 0], [244, 232, 2, 1], [10, 232, 1, 2], [58, 230, 2, 0], [200, 230, 0, 0]]) {
      const P = [{ a: Or[4], b: Or[2], c: Or[1] }, { a: '#ffe08a', b: '#f2b23a', c: '#c27a1c' }, { a: Rd[4], b: Rd[2], c: Rd[1] }][c];
      sprite(cv, x, y, LEAVES[k], P);
    }

    // ---- fireflies (two drifting positions + a twinkling set) ----------------------------------------
    const FF = [[18, 116], [34, 170], [236, 150], [244, 76], [196, 196], [56, 196], [8, 50], [250, 196]];
    const fly = (l, x, y) => l.px([[x - 1, y], [x + 1, y], [x, y - 1], [x, y + 1]], '#d9f26a').set(x, y, '#fffbd8');
    const la = cv.layer('ffa'), lb = cv.layer('ffb'), lc = cv.layer('ffc');
    FF.forEach(([x, y], i) => { if (i < 6) { fly(la, x, y); fly(lb, x + (i % 2 ? 2 : -2), y - 2); } else fly(lc, x, y); });

    cv.outline(INK);
    return cv.punch(...HOLE, HR);
  },
};

// Palette arrays by name, for skins (tools/pixelart/skins) that redraw this shell in other colors.
export const PALETTES = { Bk, Hw, Lf, Ms, Rd, Or, Ow, Dt, Dr, Cr, St };
