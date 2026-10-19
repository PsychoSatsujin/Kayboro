// Lighthouse Cove: a sunny rocky cove at the sea surface. A white nautical sign-board bezel floats on
// bright turquoise water; a red-and-white lighthouse on the boulders at the left sweeps its beam over
// the frame, a sailboat sits on the horizon, a pier post with rope coils and a lifebuoy stands on the
// right, a whale waves its tail and a striped buoy bobs below, and a sandy corner with a crab, shells
// and the scallop mascot fills the bottom-right. Foam lines roll along the water in three steps.
import { Canvas, rng, bayer, ramp, mix } from '../pixel.mjs';
import { INK, inset, part, sprite, spriteMask, screw, scallop } from '../kit.mjs';

const W = 304, H = 216, HOLE = [56, 46, 192, 108], HR = 4; // 16:9
const SEA = 42; // horizon line
const Wa = ramp('#2ab6c6', 7, { step: 0.1, hue: 6, sat: 0.05 }); // turquoise water
const Sa = ramp('#e8cd92', 6, { step: 0.09, hue: 5, sat: 0.04 }); // sand
const Rk = ramp('#8e8798', 6, { step: 0.11, hue: 5, sat: 0.04 }); // boulders
const Wh = ramp('#ebe9f0', 5, { step: 0.1, hue: 6, sat: 0.08 }); // lighthouse white
const Rd = ramp('#e24a44', 5, { step: 0.13, hue: 5, sat: 0.05 }); // lighthouse red
const Yl = ramp('#ffd24a', 5, { step: 0.11, hue: 5, sat: 0.05 }); // lantern / sun
const Wd = ramp('#a67048', 6, { step: 0.1, hue: 5, sat: 0.04 }); // pier wood
const Rp = ramp('#dcb878', 5, { step: 0.11, hue: 5, sat: 0.04 }); // rope
const Wl = ramp('#5e86ba', 6, { step: 0.11, hue: 6, sat: 0.05 }); // whale
const Cb = ramp('#ee6e4c', 5, { step: 0.12, hue: 5, sat: 0.05 }); // crab / starfish
const Bz = ramp('#e3e7ee', 6, { step: 0.09, hue: 6, sat: 0.07 }); // bezel board
const Cl = ramp('#eef3ff', 5, { step: 0.1, hue: 6, sat: 0.07 }); // cloud
const Pk = ramp('#f2a8bc', 6, { step: 0.11, hue: 5, sat: 0.05 }); // shells
const Gr = ['#5a5f78', '#8c91a8', '#b9bdd0', '#e2e5f0']; // gull grey
const FOAM = '#ffffff', FOAM2 = '#dffbff', BEAM = mix(Yl[4], '#ffffff', 0.55);

const lerp = (a, b, t) => a + (b - a) * t;
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
// Piecewise-linear level: flat steps with a narrow dithered seam between them (wide dither bands
// explode the SVG into single-pixel rects).
const level = (pts, t, x, y) => {
  let i = 0;
  while (i < pts.length - 2 && t > pts[i + 1][0]) i++;
  const [t0, v0] = pts[i], [t1, v1] = pts[i + 1], v = lerp(v0, v1, clamp((t - t0) / (t1 - t0), 0, 1));
  const k = Math.floor(v);
  return k + (clamp((v - k - 0.5) / 0.2 + 0.5, 0, 1) > bayer(x, y) ? 1 : 0);
};
// Cylinder shading across a span [x0, x0 + w): lit stripe left of center, darker toward the right.
const cyl = (R, base, x0, w, x, y) => {
  const t = (x + 0.5 - x0) / w, f = t < 0.1 ? 0 : t < 0.36 ? 1 : t < 0.64 ? 0 : t < 0.86 ? -1 : -2;
  const seam = (t >= 0.05 && t < 0.1) || (t >= 0.58 && t < 0.64) || (t >= 0.82 && t < 0.86);
  return R[clamp(base + f + (seam && bayer(x, y) < 0.5 ? 1 : 0), 0, R.length - 1)];
};

const GULL = [
  ['k.......k', 'kg.....gk', '.kg...gk.', '..kwwwk..', '...kwk...'], // wings up
  ['.........', '.........', '..kwwwk..', '.kg.w.gk.', 'k.......k'], // wings down
];

export default {
  id: 'px-ocean', name: 'Lighthouse Cove', theme: 'ocean', rarity: 'rare', translucent: false,
  collection: 'wild-pixels', license: 'CC-BY-4.0',
  desc: 'Play from a sunny cove where the lighthouse winks at you, a whale waves hello and a crab guards the sandy corner.',
  tags: ['ocean', 'lighthouse', 'beach', 'whale', 'animated', 'pixel'],
  css: '.w1{animation:w1 1.5s steps(1) infinite}.w2{animation:w2 1.5s steps(1) infinite}' +
    '@keyframes w1{0%,33.3%{opacity:0}33.4%,66.6%{opacity:1}66.7%,100%{opacity:0}}@keyframes w2{0%,66.6%{opacity:0}66.7%,100%{opacity:1}}' +
    '.bm{animation:bm 2.4s steps(1) infinite}@keyframes bm{0%,45%{opacity:1}46%,100%{opacity:0}}' +
    '.g0{animation:gl .7s steps(1) infinite}.g1{animation:gl .7s steps(1) -.35s infinite}@keyframes gl{50%{opacity:0}}' +
    '.sp{animation:sp 1.5s steps(1) infinite}@keyframes sp{0%,50%{opacity:0}51%,100%{opacity:1}}',
  draw() {
    const cv = new Canvas(W, H), rnd = rng(11);
    cv.use(Wa, Sa, Rk, Wh, Rd, Yl, Wd, Rp, Wl, Cb, Bz, Cl, Pk);

    // ---- sea: flat horizon on top, scalloped wave bellies along the bottom -------------------------
    let sea = cv.mask().rect(0, SEA, W, 160);
    for (let x = -12; x < W + 12; x += 26) sea = sea.or(cv.mask().oval(x, 186, 31, 28));
    sea = sea.clip(0, 0, W, H);
    cv.fill(sea, (x, y) => Wa[clamp(level([[0, 1.2], [0.15, 2.4], [0.5, 3.4], [0.8, 4.2], [1, 4.8]], (y - SEA) / (H - SEA), x, y), 0, 6)]);
    cv.rect(0, SEA, W, 1, Wa[0]).rect(0, SEA + 1, W, 1, Wa[1]);
    sea.each((x, y) => { // ripple dashes
      if (y < SEA + 4 || rnd() > 0.035) return;
      const w = 2 + Math.floor(rnd() * 4), up = rnd() < 0.7;
      for (let i = 0; i < w; i++) if (sea.has(x + i, y)) cv.set(x + i, y, cv.step(cv.get(x + i, y), up ? 1 : -1));
    });
    cv.fill(sea.edge().and(cv.mask().rect(0, 186, W, 30)), FOAM2); // bright lip on the bellies

    // ---- boulders on the left and the lighthouse on top of them ------------------------------------
    for (const [x, y, w, h] of [[-8, 146, 48, 38], [22, 156, 38, 32], [-6, 172, 40, 30], [28, 178, 32, 26], [4, 190, 48, 24], [0, 116, 46, 34]]) {
      const m = cv.mask().oval(x, y, w, h).clip(0, 0, W, H);
      part(cv, m, Rk, { top: [5], left: [4], bottom: [1], right: [2], fill: 3, dx: 1, dy: 2 });
      m.erode(2).each((px, py) => { const r = rnd(); if (r < 0.04) cv.set(px, py, Rk[4]); else if (r < 0.07) cv.set(px, py, Rk[2]); });
    }
    const slab = cv.mask().rect(7, 120, 35, 6);
    part(cv, slab, Rk, { top: [5], left: [4], bottom: [0], right: [1], fill: 2, dx: 1, dy: 1 });
    const CX = 24, TT = 40, TB = 122;
    const tower = cv.mask().poly([[CX - 9, TT], [CX + 10, TT], [CX + 14, TB], [CX - 13, TB]]);
    cv.cast(tower.dilate(1), 1, 2, -1);
    cv.fill(tower, (x, y) => {
      const hw = 9 + ((y - TT) / (TB - TT)) * 4, red = [[48, 60], [72, 84], [96, 108]].some(([a, b]) => y >= a && y < b);
      return cyl(red ? Rd : Wh, red ? 2 : 3, CX - hw, 2 * hw + 1, x, y);
    });
    for (const yb of [48, 60, 72, 84, 96, 108]) cv.fill(tower.and(cv.mask().rect(0, yb, W, 1)), (x, y, c) => cv.step(c, -1));
    cv.outline(INK, tower, { all: true });
    const door = cv.mask().rrect(CX - 3, 110, 7, 12, [3, 3, 0, 0]);
    cv.fill(door, Wa[1]).outline(INK, door, { all: true });
    cv.rect(CX - 1, 113, 3, 2, Yl[3]).set(CX + 1, 117, Yl[2]);
    for (const wy of [64, 88]) { // portholes
      const p = cv.mask().circle(CX, wy, 2);
      cv.fill(p, Wa[5]).outline(INK, p, { all: true }).set(CX - 1, wy - 1, FOAM);
    }
    // Gallery with railing, lantern room, red cone roof, finial.
    const gal = cv.mask().rect(CX - 15, 36, 31, 4);
    part(cv, gal, Rk, { top: [5], left: [4], bottom: [0], right: [1], fill: 2, dx: 1, dy: 1 });
    for (const x of [CX - 14, CX - 11, CX + 11, CX + 14]) cv.rect(x, 31, 1, 5, Rk[1]);
    cv.rect(CX - 15, 30, 31, 1, INK).rect(CX - 14, 31, 29, 1, Rk[4]);
    const glass = cv.mask().rect(CX - 8, 22, 17, 13);
    cv.outline(INK, glass, { all: true });
    cv.grad(glass, [Yl[4], Yl[3], Yl[2]], { soft: 0.6 });
    cv.rect(CX - 3, 22, 1, 13, INK).rect(CX + 3, 22, 1, 13, INK).rect(CX - 8, 28, 17, 1, INK);
    cv.rect(CX - 1, 26, 3, 3, FOAM).set(CX, 27, '#fffbe0');
    part(cv, cv.mask().rect(CX - 10, 19, 21, 3), Rk, { top: [5], left: [4], bottom: [0], right: [1], fill: 2, shadow: false });
    const roof = cv.mask().poly([[CX - 11, 19], [CX + 12, 19], [CX + 0.5, 9]]);
    cv.fill(roof, (x, y) => { const hw = 11 * ((y - 9) / 10) + 1; return cyl(Rd, 2, CX + 0.5 - hw, 2 * hw, x, y); });
    cv.outline(INK, roof, { all: true });
    cv.rect(CX, 4, 1, 5, Rk[1]).set(CX, 4, Rk[4]);
    part(cv, cv.mask().circle(CX, 3, 1), Yl, { top: [4], left: [3], bottom: [1], right: [2], fill: 2, shadow: false });

    // ---- sandy corner, bottom-right -----------------------------------------------------------------
    const sand = cv.mask().poly([[204, H], [216, 198], [232, 188], [252, 181], [276, 177], [W, 175], [W, H]]).or(cv.mask().oval(214, 186, 44, 26)).clip(0, 0, W, H);
    part(cv, sand, Sa, { top: [5, 4], left: [4], bottom: [2], right: [2], fill: 3, shadow: false });
    cv.fill(sand.sub(sand.erode(4)).sub(sand.edge()), (x, y, c) => (bayer(x, y) < 0.6 ? Sa[2] : c)); // wet strip
    sand.erode(5).each((x, y) => { const r = rnd(); if (r < 0.04) cv.set(x, y, Sa[1]); else if (r < 0.08) cv.set(x, y, Sa[5]); });
    for (const [x, y] of [[226, 206], [246, 210], [296, 190]]) sprite(cv, x, y, ['.ab', 'abb'], { a: Rk[5], b: Rk[2] });

    // ---- the sign-board bezel ---------------------------------------------------------------------
    const [hx, hy, hw, hh] = HOLE;
    const board = cv.mask().rrect(hx - 14, hy - 14, hw + 28, hh + 28, 9);
    part(cv, board, Bz, { top: [5], left: [4], bottom: [1], right: [2], fill: 3, dx: 2, dy: 3 });
    cv.fill(cv.mask().rrect(hx - 10, hy - 10, hw + 20, hh + 20, 6).edge(), Wa[3]);
    inset(cv, ...HOLE, HR, { rim: INK, top: Bz[1], left: Bz[2], bottom: Bz[5], right: Bz[4] }, 2);
    const SC = [Bz[0], Bz[1], Bz[3], Bz[5]];
    for (const [x, y] of [[hx - 12, hy - 12], [hx + hw + 7, hy - 12], [hx - 12, hy + hh + 7], [hx + hw + 7, hy + hh + 7]]) screw(cv, x, y, SC);

    // ---- pier post with rope coils, a lifebuoy and a hanging loop ----------------------------------
    cv.tone(cv.mask().oval(262, 182, 26, 8).and(sea), -1, 0.7);
    const post = cv.mask().rect(270, 74, 10, 112);
    part(cv, post, Wd, { top: [5], left: [4], bottom: [1], right: [2], fill: 3, dx: 1, dy: 1 });
    for (let y = 80; y < 182; y += 9) { const x = 272 + ((y / 9) % 3 | 0) * 2; cv.rect(x, y, 1, 3 + ((y / 9) % 2 | 0) * 2, Wd[2]); }
    part(cv, cv.mask().rect(268, 71, 14, 4), Wd, { top: [5], left: [4], bottom: [1], right: [2], fill: 3, dx: 1, dy: 1 });
    const coil = cv.mask().rrect(268, 82, 14, 11, 2);
    part(cv, coil, Rp, { top: [4], left: [3], bottom: [1], right: [2], fill: 2, dx: 1, dy: 1 });
    for (const y of [85, 89]) cv.rect(269, y, 12, 1, Rp[0]).rect(269, y + 1, 12, 1, Rp[4]);
    let rope = cv.mask();
    for (const [a, b] of [[[280, 95], [287, 118]], [[287, 118], [294, 118]], [[294, 118], [298, 98]]]) rope = rope.or(cv.mask().capsule(a[0], a[1], b[0], b[1], 1.05));
    part(cv, rope, Rp, { top: [4], left: [3], bottom: [1], right: [2], fill: 2, dx: 1, dy: 1 });
    rope.erode(1).each((x, y) => { if ((x + y) % 3 === 0) cv.set(x, y, Rp[1]); });
    const ring = cv.mask().circle(275, 126, 8).sub(cv.mask().circle(275, 126, 3));
    cv.cast(ring.dilate(1), 1, 2, -1);
    cv.fill(ring, (x, y) => ((x < 275) === (y < 126) ? Rd[2] : Wh[3]));
    cv.fill(ring.and(ring.not().dilate(1).shift(-1, -1).not().not()).and(ring.sub(ring.shift(1, 1))), (x, y, c) => cv.step(c, 1));
    cv.fill(ring.sub(ring.shift(-1, -1)), (x, y, c) => cv.step(c, -1));
    cv.outline(INK, ring, { all: true });
    cv.rect(274, 116, 3, 3, INK).rect(275, 117, 1, 1, Rp[3]);

    // ---- striped buoy bobbing bottom-left ---------------------------------------------------------
    cv.tone(cv.mask().oval(74, 184, 24, 7).and(sea), -1, 0.7);
    const buoy = cv.mask().rrect(78, 170, 14, 14, [6, 6, 3, 3]);
    cv.cast(buoy.dilate(1), 1, 1, -1);
    cv.fill(buoy, (x, y) => cyl(y < 175 || y >= 180 ? Rd : Wh, y < 175 || y >= 180 ? 2 : 3, 78, 14, x, y));
    cv.outline(INK, buoy, { all: true });
    part(cv, cv.mask().rect(84, 162, 2, 8), Rk, { top: [4], left: [3], bottom: [1], right: [1], fill: 2, shadow: false });
    part(cv, cv.mask().circle(85, 160, 2), Yl, { top: [4], left: [3], bottom: [1], right: [2], fill: 2, shadow: false });
    cv.fill(cv.mask().oval(75, 182, 20, 5).edge().and(sea).and(cv.mask().rect(0, 184, W, 4)), FOAM);

    // ---- whale tail with a splash -----------------------------------------------------------------
    cv.tone(cv.mask().oval(126, 190, 44, 8).and(sea), -1, 0.7);
    const fluke = cv.mask().oval(126, 166, 24, 15).or(cv.mask().oval(146, 166, 24, 15)).or(cv.mask().poly([[141, 174], [155, 174], [153, 194], [143, 194]]));
    part(cv, fluke, Wl, { top: [5], left: [4], bottom: [1], right: [2], fill: 3, dx: 1, dy: 2 });
    cv.fill(fluke.and(cv.mask().rect(128, 167, 40, 4)).sub(fluke.edge()), (x, y, c) => (bayer(x, y) < 0.5 ? cv.step(c, 1) : c));
    for (const [x, y] of [[134, 170], [158, 169], [140, 180], [150, 184]]) cv.rect(x, y, 2, 1, Wl[5]);
    cv.fill(cv.mask().oval(132, 189, 32, 6).edge().and(sea).and(cv.mask().rect(0, 190, W, 4)), FOAM);
    const drops = (l, pts) => { for (const [x, y, big] of pts) { l.set(x, y, FOAM); if (big) l.set(x + 1, y, FOAM2).set(x, y + 1, FOAM2); } };
    drops(cv, [[124, 172, 1], [172, 170, 1], [136, 161, 0], [162, 160, 0], [120, 180, 0]]);

    // ---- crab, starfish, spiral shell and the scallop mascot on the sand ---------------------------
    const crab = cv.mask().oval(254, 196, 15, 9);
    cv.cast(crab.dilate(1), 1, 1, -1);
    for (const [x, y] of [[250, 194], [270, 194]]) part(cv, cv.mask().circle(x, y, 3), Cb, { top: [4], left: [3], bottom: [1], right: [2], fill: 2, dx: 1, dy: 1 });
    cv.set(249, 194, Cb[0]).set(271, 194, Cb[0]);
    for (const [x, y] of [[254, 203], [258, 204], [263, 204], [267, 203]]) cv.rect(x, y, 1, 3, INK);
    part(cv, crab, Cb, { top: [4], left: [3], bottom: [1], right: [2], fill: 2, shadow: false });
    for (const x of [258, 264]) cv.rect(x, 191, 1, 4, INK).rect(x, 190, 2, 2, FOAM).set(x + 1, 190, INK).set(x + 1, 191, INK), cv.set(x, 190, FOAM);
    cv.set(260, 199, Cb[0]).set(262, 199, Cb[0]).rect(259, 201, 5, 1, Cb[0]).set(260, 201, Cb[4]).set(262, 201, Cb[4]);
    sprite(cv, 230, 196, ['..k..', '.koK.', 'kooOk', '.kok.', 'k.k.k'], { k: INK, o: Cb[2], O: Cb[4], K: INK });
    sprite(cv, 240, 206, ['.kkk.', 'kpPPk', 'kpkPk', 'kppkk', '.kkk.'], { k: INK, p: Pk[2], P: Pk[4] });
    const sh = scallop(cv, 288, 212, 9, Pk);
    cv.cast(sh.dilate(1), 1, 1, -1);
    cv.outline(INK, sh, { all: true });
    scallop(cv, 288, 212, 9, Pk);

    // ---- sailboat on the horizon, sun and a cloud in the sky -----------------------------------------
    const hull = cv.mask().poly([[265, 37], [293, 37], [289, 43], [269, 43]]);
    cv.fill(cv.mask().oval(266, 43, 26, 3).and(sea), Wa[1]);
    part(cv, hull, Wh, { top: [4], left: [3], bottom: [1], right: [2], fill: 3, shadow: false });
    cv.rect(266, 39, 26, 1, Rd[2]);
    cv.rect(279, 14, 1, 23, Wd[1]);
    const main = cv.mask().poly([[280, 15], [280, 36], [292, 36]]), jib = cv.mask().poly([[278, 19], [278, 36], [268, 36]]);
    part(cv, main, Wh, { top: [4], left: [3], bottom: [1], right: [2], fill: 3, shadow: false });
    cv.fill(main.and(cv.mask().rect(280, 26, 13, 3)).sub(main.edge()), Wa[3]);
    part(cv, jib, Wh, { top: [4], left: [3], bottom: [1], right: [2], fill: 2, shadow: false });
    sprite(cv, 280, 11, ['rrr', 'rr.'], { r: Rd[2] });
    const sun = cv.mask().circle(224, 15, 8);
    part(cv, sun, Yl, { top: [4], left: [3], bottom: [1], right: [2], fill: 2, shadow: false });
    cv.px([[220, 11], [221, 10], [221, 11]], Yl[4]);
    for (const [dx, dy] of [[0, -12], [0, 12], [-12, 0], [12, 0], [-9, -9], [9, -9], [-9, 9], [9, 9]]) cv.set(224 + dx, 15 + dy, Yl[3]).set(224 + dx + Math.sign(dx), 15 + dy + Math.sign(dy), Yl[2]);
    const puffs = [[158, 18, 7], [170, 13, 10], [184, 16, 8], [195, 20, 6]];
    const U = (dy, k = 1) => puffs.reduce((m, [x, y, r]) => m.circle(x, Math.round(y - dy * r), Math.round(r * k)), cv.mask()).clip(0, 0, W, 26);
    const cm = U(0);
    cv.fill(cm, Cl[2]).fill(cm.and(U(0.3, 0.97)), Cl[3]).fill(cm.and(U(0.55, 0.95)), Cl[4]);
    cv.fill(cm.sub(cm.shift(1, 2)).and(U(0.55, 0.95)), FOAM);

    // ---- foam: rolling crest lines and the shore wash, three stepped frames -----------------------
    const isWater = (c) => Wa.includes(c), isSand = (c) => Sa.includes(c);
    const vis = cv.mask().plot((x, y) => isWater(cv.get(x, y)));
    const shoreZone = cv.mask().plot((x, y) => isWater(cv.get(x, y)) || isSand(cv.get(x, y)), 196, 164, W - 1, H - 1);
    const frame = (k) => {
      const m = cv.mask(), wet = cv.mask();
      for (const [y0, sp] of [[168, 0.21], [181, 0.25], [196, 0.23]]) {
        for (let x = 0; x < W; x++) {
          const s = Math.sin((x + k * 9) * sp + y0), yy = y0 + Math.round(s * 2.4);
          if (s > -0.15) { m.put(x, yy); if (s > 0.6) m.put(x, yy + 1); }
        }
      }
      const rings = [cv.mask().rrect(0, 0, 0, 0, 0), sand.dilate(2).sub(sand.dilate(1)), sand.dilate(1).sub(sand), sand.edge(), sand.erode(1).edge()];
      const r = rings[3 - k];
      r.each((x, y) => { if ((x * 7 + y * 3 + k * 5) % 11 > 3) m.put(x, y); });
      rings[4 - k].each((x, y) => { if ((x + y + k) % 2 === 0) wet.put(x, y); });
      return { m: m.and(vis.or(shoreZone)), wet: wet.and(shoreZone) };
    };
    const frames = [0, 1, 2].map(frame);
    const base = cv.p.slice();
    const paint = (l, f) => { l.fill(f.wet, (x, y) => (isSand(base[y * W + x]) ? Sa[2] : FOAM2)); l.fill(f.m, (x, y) => (vis.has(x, y) && f.m.has(x, y - 1) ? FOAM2 : FOAM)); };
    const region = frames.reduce((m, f) => m.or(f.m).or(f.wet), cv.mask());
    paint(cv, frames[0]);
    for (const k of [1, 2]) {
      const l = cv.layer(`w${k}`);
      l.fill(region, (x, y) => base[y * W + x]);
      paint(l, frames[k]);
      region.each((x, y) => { if (l.get(x, y) === cv.get(x, y)) l.set(x, y, null); }); // keep only what differs from frame 0
    }

    // ---- gulls (two wing frames), lighthouse beam, extra splash drops -----------------------------
    const G = [cv.layer('g0'), cv.layer('g1')];
    for (const [x, y] of [[62, 6], [120, 10], [104, 30], [250, 24]]) G.forEach((l, i) => sprite(l, x, y, GULL[i], { k: INK, g: Gr[2], w: Gr[3] }));
    const bm = cv.layer('bm');
    const wedge = cv.mask().poly([[CX + 9, 25], [146, 0], [146, 24], [CX + 9, 30]]);
    bm.fill(wedge, (x, y) => { const t = (x - CX - 9) / 110; return bayer(x, y) > t * 1.15 ? (t < 0.4 ? '#fffbe6' : BEAM) : undefined; });
    bm.fill(glass.sub(cv.mask().rect(CX - 3, 22, 1, 13)).sub(cv.mask().rect(CX + 3, 22, 1, 13)).sub(cv.mask().rect(CX - 8, 28, 17, 1)), (x, y) => (Math.abs(x - CX) < 2 && Math.abs(y - 27) < 2 ? FOAM : Yl[4]));
    const sp = cv.layer('sp');
    drops(sp, [[128, 166, 0], [168, 164, 1], [146, 158, 1], [176, 178, 0], [118, 174, 0]]);

    cv.outline(INK);
    return cv.punch(...HOLE, HR);
  },
};
