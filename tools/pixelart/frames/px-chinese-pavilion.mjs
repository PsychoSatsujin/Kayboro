// Lantern pavilion: a classical garden pavilion window. A teal glazed-tile roof with upturned eaves,
// curled ridge ends and gold eave-tile ends; a painted beam with a cloud-scroll medallion; red lacquer
// pillars on stone plinths; a carved key-fret lattice window around the screen with cloud-scroll
// brackets; red silk lanterns with gold tassels; a blue-and-white meiping vase holding a flowering
// plum branch, and a holey garden rock, all on a stone terrace.
import { Canvas, ramp, bayer, rng } from '../pixel.mjs';
import { INK, inset, part, sprite, spriteMask } from '../kit.mjs';

const W = 304, H = 256, HOLE = [56, 98, 192, 108], HR = 2; // 16:9
const Rd = ramp('#c22a34', 7, { step: 0.11, hue: 7, mid: 3 }); // red lacquer
const Tl = ramp('#24907e', 6, { step: 0.12, hue: 6, sat: 0.08 }); // teal glazed tiles
const Gd = ramp('#d89a2a', 6, { step: 0.1, hue: 5, sat: 0.1 }); // gold leaf
const Wd = ramp('#6e3324', 6, { step: 0.11, hue: 6 }); // rosewood lattice
const St = ramp('#8a8ea0', 7, { step: 0.12, hue: 8, sat: 0.03 }); // stone
const Bl = ramp('#2a4ea8', 5, { step: 0.13, hue: 6 }); // cobalt
const Pk = ramp('#ee86a8', 5, { step: 0.09, hue: 6, sat: 0.08 }); // plum blossom
const Bm = ramp('#235f8c', 6, { step: 0.11, hue: 6 }); // painted beam blue
const Po = ramp('#dfe6ee', 5, { step: 0.08, hue: 8, sat: 0.03, mid: 3 }); // porcelain
const SH = '#2a1f33'; // floor shadow

const FX = 38, FY = 80, FW = 228, FH = 144; // window frame between the pillars

// Cylinder shading across a span: lit stripe left of center, falling off to the right.
const cyl = (R, x0, w, base) => (x, y) => {
  const t = (x + 0.5 - x0) / w;
  const f = t < 0.12 ? 0 : t < 0.38 ? 1 : t < 0.66 ? 0 : t < 0.86 ? -1 : -2;
  const seam = (t > 0.36 && t < 0.42) || (t > 0.64 && t < 0.7) ? 0.5 : 0;
  return R[base + f + (seam && bayer(x, y) < seam ? (t < 0.5 ? -1 : -1) : 0)];
};

// Roof profile (front view): flat main ridge, concave hip slopes, eaves that sweep up at the corners.
const eaveB = (dx) => 60 - 16 * Math.max(0, (dx - 104) / 46) ** 2;
const roofT = (dx) => (dx <= 80 ? 20 : 20 + 30 * Math.sqrt((dx - 80) / 70));

// Auspicious cloud scroll (xiangyun): two curls on a flat base with a trailing tail.
const CLOUD = [
  '..XXX...XXX....',
  '.XdddX.XdddX...',
  'XdXXdXXdXXdX...',
  'XdXdXXXXdXdXXX.',
  'XXdXXXXXXdXXddX',
  '.XXXXXXXXXXXXXX',
];
function cloud(cv, x, y, R, { flip = false, lo = 1, hi = 3, line = 0 } = {}) {
  const m = spriteMask(cv, x, y, CLOUD, { flip });
  cv.fill(m, (px, py) => (py === y || !m.has(px, py - 1) ? R[hi] : R[hi - 1]));
  cv.fill(m.and(m.shift(0, -1)).sub(m.shift(0, 1)), R[lo]);
  sprite(cv, x, y, CLOUD, { d: R[line] }, { flip });
  return m;
}

export default {
  id: 'px-chinese-pavilion', name: 'Lantern Pavilion', theme: 'chinese', rarity: 'epic', translucent: false,
  collection: 'world-tour', license: 'CC-BY-4.0',
  desc: 'Play beneath glowing red lanterns in a garden pavilion with a carved lattice window, a plum branch in bloom and a teal tiled roof.',
  tags: ['chinese', 'pavilion', 'lantern', 'garden', 'plum-blossom', 'pixel'],
  css: '.gl{animation:gl 1.8s steps(1) infinite}@keyframes gl{0%,55%{opacity:1}56%,100%{opacity:0}}' +
    '.pa{animation:pt 3s steps(1) infinite}.pb{animation:pt 3s steps(1) -1.5s infinite}@keyframes pt{50%{opacity:0}}',
  draw() {
    const cv = new Canvas(W, H), rnd = rng(11);
    cv.use(Rd, Tl, Gd, Wd, St, Bl, Pk, Bm, Po);
    const dxOf = (x) => Math.abs(x + 0.5 - W / 2);

    // ---- stone terrace + floor shadow -------------------------------------------------------------
    const shade = cv.mask().oval(2, 246, W - 4, 10);
    cv.fill(shade.erode(2), SH).fill(shade.sub(shade.erode(2)), (x, y, c) => (bayer(x, y) < 0.5 ? SH : c));
    const terrace = cv.mask().rect(6, 236, W - 12, 15);
    cv.fill(terrace, St[0]);
    cv.shade(cv.mask().rect(6, 236, W - 12, 4), St, { top: [6], left: [5], bottom: [3], right: [4], fill: 5 });
    for (let x = 6, k = 0; x < W - 6; x += 37, k++) {
      const w = Math.min(36, W - 7 - x), m = cv.mask().rect(x + (k ? 1 : 0), 241, w - (k ? 1 : 0), 10);
      cv.shade(m, St, { top: [4], left: [4], bottom: [1], right: [2], fill: 3 });
      m.erode(1).each((px, py) => { const r = rnd(); if (r < 0.05) cv.set(px, py, St[2]); else if (r < 0.08) cv.set(px, py, St[4]); });
    }

    // ---- carved skirt panel under the window ------------------------------------------------------
    const skirt = cv.mask().rect(FX, FY + FH, FW, 12);
    cv.shade(skirt, Rd, { top: [2], left: [4], bottom: [1], right: [2], fill: 3 });
    for (const [x, w] of [[44, 64], [112, 80], [196, 64]]) {
      const pn = cv.mask().rect(x, FY + FH + 2, w, 8);
      cv.shade(pn, Rd, { top: [1], left: [1], bottom: [5], right: [4], fill: 2 });
      cv.fill(pn.ring().and(skirt), (px, py, c) => (py < FY + FH + 2 || px < x ? Gd[2] : Gd[4]));
      cloud(cv, x + (w >> 1) - 7, FY + FH + 3, Gd, { line: 1, hi: 3, lo: 1, flip: x > 150 });
    }

    // ---- window frame: moulding, key-fret lattice, gold bead, deep reveal --------------------------
    const frame = cv.mask().rect(FX, FY, FW, FH);
    cv.shade(frame, Wd, { top: [5, 4], left: [4, 4], bottom: [0, 1], right: [1, 2], fill: 3 });
    const dOf = (x, y) => Math.min(x - FX, FX + FW - 1 - x, y - FY, FY + FH - 1 - y);
    // Lattice band 3..10 px in from the frame edge: rails at v = 0 and 7, a hooked fret between.
    const FRET = ['#.....', '#.###.', '#.#.#.', '#...#.', '#####.', '......'];
    const band = frame.and(cv.mask().plot((x, y) => { const d = dOf(x, y); return d >= 3 && d <= 10; }));
    cv.fill(band, (x, y) => {
      const v = dOf(x, y) - 3;
      const hx = x - FX >= 3 && x - FX <= 10, hx2 = FX + FW - 1 - x >= 3 && FX + FW - 1 - x <= 10;
      const vy = y - FY >= 3 && y - FY <= 10, vy2 = FY + FH - 1 - y >= 3 && FY + FH - 1 - y <= 10;
      if ((hx || hx2) && (vy || vy2)) return null; // corner blocks drawn below
      if (v === 0 || v === 7) return Wd[3];
      const side = x - FX === dOf(x, y) || FX + FW - 1 - x === dOf(x, y);
      const u = side ? y - FY - 11 : x - FX - 11;
      return FRET[v - 1][((u % 6) + 6) % 6] === '#' ? Wd[3] : Wd[0];
    });
    // Light the lattice bars from the top-left: bar pixels next to a gap above/left glow, below/right dim.
    const bars = band.and(cv.mask().plot((x, y) => cv.get(x, y) === Wd[3]));
    const gaps = band.and(cv.mask().plot((x, y) => cv.get(x, y) === Wd[0]));
    cv.fill(bars.and(gaps.shift(0, -1).or(gaps.shift(-1, 0))), Wd[2]);
    cv.fill(gaps.and(bars.shift(0, 1)).and(bars.shift(1, 0)), Wd[1]);
    cv.fill(bars.and(gaps.shift(0, 1)), Wd[4]);
    for (const [x, y] of [[FX + 3, FY + 3], [FX + FW - 11, FY + 3], [FX + 3, FY + FH - 11], [FX + FW - 11, FY + FH - 11]]) {
      const blk = cv.mask().rect(x, y, 8, 8);
      cv.shade(blk, Wd, { top: [4], left: [4], bottom: [0], right: [1], fill: 2 });
      const boss = cv.mask().oval(x + 1, y + 1, 6, 6, 1.2);
      cv.shade(boss, Gd, { top: [4], left: [4], bottom: [1], right: [1], fill: 2 });
      cv.set(x + 3, y + 3, Rd[2]).set(x + 4, y + 3, Rd[3]).set(x + 3, y + 4, Rd[2]).set(x + 4, y + 4, Rd[1]);
      cv.set(x + 2, y + 2, Gd[5]);
    }
    // Inner moulding: gold bead, then lacquer red step down to the reveal.
    const inner = frame.and(cv.mask().plot((x, y) => dOf(x, y) >= 11));
    cv.fill(inner, (x, y) => {
      const d = dOf(x, y), tl = y - FY === d || x - FX === d;
      if (d === 11) return tl ? Gd[4] : Gd[2];
      if (d === 12) return tl ? Gd[2] : Gd[1];
      return tl ? Rd[4] : Rd[2];
    });
    inset(cv, ...HOLE, HR, { rim: INK, top: Wd[0], left: Wd[1], bottom: Wd[3], right: Wd[2] }, 2);

    // ---- red lacquer pillars on drum plinths -------------------------------------------------------
    for (const x of [24, W - 38]) {
      const p = cv.mask().rect(x, 66, 14, 166);
      cv.cast(p.dilate(1), 1, 0, -1);
      cv.fill(p, cyl(Rd, x, 14, 3)).outline(INK, p, { all: true });
      const plinth = cv.mask().rrect(x - 4, 228, 22, 9, [3, 3, 0, 0]);
      part(cv, plinth, St, { top: [6], left: [5], bottom: [2], right: [3], fill: 4, dy: 0 });
      cv.fill(plinth.and(cv.mask().rect(0, 232, W, 1)), St[3]);
      const ring = cv.mask().rect(x, 225, 14, 3);
      cv.fill(ring, cyl(Gd, x, 14, 2)).outline(INK, ring, { all: true });
    }

    // ---- cloud-scroll corner brackets (queti) under the beam ---------------------------------------
    const QT = [
      'XXXXXXXXXXXXXXXXXX',
      'XXXXXXXXXXXXXXXXX.',
      'XXXXXXXXXXXXXX....',
      'XXXXXXXXXXXX......',
      'XXXXXXXXXX........',
      'XXXXXXXXX.........',
      'XXXXXXX...........',
      'XXXXXX............',
      'XXXX..............',
      'XXX...............',
    ];
    for (const flip of [false, true]) {
      const x = flip ? FX + FW - 18 : FX;
      const q = spriteMask(cv, x, FY, QT, { flip });
      part(cv, q, Rd, { top: [5], left: [4], bottom: [1], right: [2], fill: 3, dx: flip ? -1 : 1, dy: 1 });
      sprite(cv, x + (flip ? 4 : 1), FY + 1, ['..ggg.......', '.g...g.gg...', 'g.gg.gg..g..', 'g.g...g.g...', '.g....g.....'], { g: Gd[3] }, { flip });
    }

    // ---- painted beam with a cloud medallion --------------------------------------------------------
    const beam = cv.mask().rect(16, 66, W - 32, 14);
    part(cv, beam, Bm, { top: [4], left: [4], bottom: [0], right: [1], fill: 2, dy: 1 });
    cv.rect(17, 68, W - 34, 1, Gd[3]).rect(17, 77, W - 34, 1, Gd[1]);
    for (const x of [24, W - 38]) cv.rect(x - 2, 69, 18, 8, Tl[2]).rect(x - 2, 69, 18, 1, Tl[4]).rect(x - 2, 76, 18, 1, Tl[1]);
    for (const x of [21, 41, W - 42, W - 22]) cv.rect(x, 69, 1, 8, Gd[2]);
    for (const [x, flip] of [[52, false], [W - 52 - 15, true]]) {
      cv.fill(cv.mask().rect(x - 4, 69, 23, 8), Bm[2]);
      cloud(cv, x, 70, Gd, { flip, line: 1, hi: 3, lo: 1 });
    }
    const med = cv.mask().rrect(110, 67, 84, 12, 4);
    cv.fill(med.ring().and(beam), Gd[2]);
    cv.shade(med, Rd, { top: [4], left: [4], bottom: [1], right: [2], fill: 3 });
    cv.fill(med.edge(), (x, y) => (y < 70 ? Gd[4] : Gd[2]));
    cloud(cv, 136, 70, Gd, { line: 1, hi: 4, lo: 2 });
    cloud(cv, 153, 70, Gd, { line: 1, hi: 4, lo: 2, flip: true });

    // ---- eave soffit with rafter ends ---------------------------------------------------------------
    const soffit = cv.mask().plot((x, y) => { const dx = dxOf(x); return dx < 141 && y + 0.5 >= eaveB(dx) - 1 && y < 67; }, 0, 30, W, 67);
    cv.fill(soffit, Bm[0]);
    for (let x = 12; x < W - 12; x += 4) {
      const y = Math.round(eaveB(dxOf(x + 1))) + 1;
      if (y > 63) continue;
      cv.rect(x, y, 2, 2, (x / 4) % 2 ? Tl[2] : Bm[3]).set(x, y, Gd[4]);
    }

    // ---- glazed-tile roof ---------------------------------------------------------------------------
    const roof = cv.mask().plot((x, y) => { const dx = dxOf(x); return y + 0.5 >= roofT(dx) && y + 0.5 < eaveB(dx); }, 0, 0, W, 64);
    cv.fill(roof, (x, y) => {
      const dx = dxOf(x), top = roofT(dx), bot = eaveB(dx), t = (y + 0.5 - top) / Math.max(1, bot - top);
      if (y + 0.5 >= bot - 3) { // eave tile ends: gold discs over a dark drip row
        const k = ((x % 5) + 5) % 5;
        if (y + 0.5 >= bot - 1) return k === 2 ? Gd[1] : Tl[0];
        return k >= 1 && k <= 3 ? (y + 0.5 < bot - 2 ? Gd[4] : Gd[2]) : Tl[0];
      }
      const k = ((x % 5) + 5) % 5;
      const base = t < 0.25 ? 4 : t < 0.55 ? 3 : 2;
      const b = base - (t > 0.2 && t < 0.3 && bayer(x, y) < 0.5 ? 1 : 0) - (t > 0.5 && t < 0.6 && bayer(x, y) < 0.5 ? 1 : 0);
      if (k === 0) return Tl[Math.max(0, b - 2)];
      if (k === 1) return Tl[Math.min(5, b + 1)];
      return Tl[b];
    });
    // Hip ridges along the top of each slope and the main ridge with gold trim.
    const hip = cv.mask().plot((x, y) => { const dx = dxOf(x); return dx > 76 && y + 0.5 >= roofT(dx) - 3 && y + 0.5 < roofT(dx) + 1 && y + 0.5 < eaveB(dx) - 3; }, 0, 0, W, 60);
    cv.fill(hip, (x, y) => (y + 0.5 < roofT(dxOf(x)) - 2 ? Tl[4] : Tl[1]));
    const ridge = cv.mask().rrect(70, 11, W - 140, 9, 2);
    cv.shade(ridge, Tl, { top: [5, 4], left: [4], bottom: [0], right: [1], fill: 2 });
    cv.rect(72, 16, W - 144, 1, Gd[3]).rect(72, 17, W - 144, 1, Gd[1]);
    for (let x = 80; x < W - 80; x += 12) cv.rect(x, 13, 2, 2, Tl[1]);
    // Curled ridge ends: a rising scroll that turns back toward the centre.
    const RE = [
      '...XXXX.....',
      '..XXXXXX....',
      '.XXddddXX...',
      '.XdXXXXdX...',
      'XXdXXddXX...',
      'XXdXdXXXX...',
      'XXXdXXXXX...',
      'XXXXdddXXXX.',
      '.XXXXXXXXXXX',
      '..XXXXXXXXXX',
      '..XXXXXXXXXX',
      '...XXXXXXXXX',
    ];
    for (const flip of [false, true]) {
      const x = flip ? W - 66 - 12 + 2 : 64, m = spriteMask(cv, x, 1, RE, { flip });
      part(cv, m, Tl, { top: [5], left: [4], bottom: [1], right: [1], fill: 3, shadow: false });
      sprite(cv, x, 1, RE, { d: Tl[1] }, { flip });
    }
    cv.outline(INK, roof.or(ridge), {});
    // Little upturned tips at the very eave corners.
    for (const flip of [false, true]) sprite(cv, flip ? W - 9 : 3, 40, ['....g.', '...gg.', '..gg..', '.gT...', 'gT....'], { g: Gd[3], T: Tl[2] }, { flip });

    // ---- red silk lanterns with gold tassels --------------------------------------------------------
    const glow = cv.layer('gl');
    for (const lx of [13, W - 14]) {
      cv.rect(lx, 48, 1, 30, INK).rect(lx - 1, 50, 3, 1, Gd[2]);
      const cap = (y) => part(cv, cv.mask().rrect(lx - 5, y, 11, 3, 1), Gd, { top: [4], left: [4], bottom: [1], right: [1], fill: 3, shadow: false });
      const body = cv.mask().oval(lx - 9, 80, 19, 24);
      cv.cast(body.dilate(1), 1, 1, -1);
      cv.shade(body, Rd, { top: [4], left: [4], bottom: [1], right: [2], fill: 3 });
      cv.glow(body, lx - 1, 91, 9, 2.2);
      for (let y = 81; y < 103; y++) { // silk ribs follow the round body
        const v = (y + 0.5 - 92) / 12, hw = 9.5 * Math.sqrt(Math.max(0, 1 - v * v));
        for (const k of [-0.55, 0, 0.55]) { const x = Math.round(lx + k * hw); if (body.has(x, y)) cv.set(x, y, cv.step(cv.get(x, y), -1)); }
      }
      cv.outline(INK, body, { all: true });
      cap(78); cap(103);
      glow.fill(cv.mask().oval(lx - 4, 86, 7, 10).and(body), (x, y) => cv.step(cv.get(x, y), 1));
      // Knot and tassel.
      sprite(cv, lx - 3, 106, [
        '..kgk..', '.kgGgk.', '..kgk..', '.kgggk.', 'kgGggg k', 'kgGgggk', 'kgGgggk', 'kgggggk', 'kgggggk', 'kgg.ggk', 'kg...gk', '.k...k.',
      ].map((r) => r.replace(' ', '')), { k: INK, g: Gd[2], G: Gd[4] });
      cv.set(lx, 116, Gd[1]).set(lx, 117, Gd[1]).set(lx - 1, 115, Gd[1]).set(lx + 1, 115, Gd[1]);
    }

    // ---- blue-and-white meiping vase with a flowering plum branch ----------------------------------
    const vx = 15, vy = 198, vh = 38;
    const hwOf = (t) => (t < 0.06 ? 3.5 : t < 0.12 ? 2.5 : t < 0.32 ? 2.5 + 8 * Math.sin(((t - 0.12) / 0.2) * Math.PI / 2) : 10.5 - 4.5 * ((t - 0.32) / 0.68) ** 1.4);
    const vase = cv.mask().plot((x, y) => Math.abs(x + 0.5 - vx - 0.5) <= hwOf((y - vy) / (vh - 1)), 0, vy, 40, vy + vh);
    // Plum branch first, so it rises out of the vase mouth behind the lip.
    const twig = cv.mask();
    const limb = (pts, r) => { for (let i = 0; i + 1 < pts.length; i++) twig.or(cv.mask().capsule(...pts[i], ...pts[i + 1], r)).each((x, y) => twig.put(x, y)); };
    limb([[15, 200], [17, 188], [13, 176], [18, 162], [15, 150], [19, 138]], 1.2);
    limb([[17, 188], [26, 180], [33, 176]], 0.6);
    limb([[13, 176], [6, 168], [4, 158]], 0.6);
    limb([[18, 162], [27, 154], [30, 146]], 0.6);
    limb([[15, 150], [9, 144], [8, 136]], 0.5);
    limb([[19, 138], [22, 130], [21, 124]], 0.5);
    cv.outline(INK, twig, { all: true });
    cv.fill(twig, (x, y) => (!twig.has(x - 1, y) || !twig.has(x, y - 1) ? Wd[3] : Wd[1]));
    const blooms = [[33, 175], [26, 179], [4, 157], [7, 166], [30, 145], [27, 153], [8, 135], [10, 143], [21, 123], [22, 130], [14, 160], [20, 148], [17, 186], [12, 174]];
    blooms.forEach(([x, y], i) => {
      const m = spriteMask(cv, x - 2, y - 2, ['.#.#.', '#####', '.###.', '#####', '.#.#.']);
      if (i % 3 === 2) { cv.outline(INK, cv.mask().rect(x - 1, y - 1, 3, 3), { all: true }); cv.rect(x - 1, y - 1, 3, 3, Pk[2]).set(x - 1, y - 1, Pk[4]); return; }
      cv.outline(INK, m, { all: true });
      cv.shade(m, Pk, { top: [4], left: [3], bottom: [0], right: [1], fill: 2 });
      cv.set(x, y, Gd[4]).set(x - 1, y - 1, Pk[4]);
    });
    part(cv, vase, Po, { top: [4], left: [4], bottom: [0], right: [1], fill: 3, dy: 1 });
    cv.fill(vase, cyl(Po, vx - 10, 22, 3));
    cv.fill(vase.and(cv.mask().rect(0, vy, W, 2)), Po[4]);
    // Cobalt decoration: ruyi-collar lappets on the shoulder, a scroll band, upright petals at the foot.
    const blue = (x, y) => { const c = cv.get(x, y), i = Po.indexOf(c); return Bl[Math.max(0, Math.min(4, i - 1))]; };
    const deco = cv.mask();
    for (let x = vx - 9; x <= vx + 9; x += 4) deco.pts([[x, 206], [x + 1, 206], [x + 2, 206], [x, 207], [x + 1, 207], [x + 2, 207], [x + 1, 208]]);
    deco.rect(vx - 10, 205, 21, 1);
    for (let x = vx - 9; x <= vx + 9; x++) { const s = Math.round(Math.sin((x - vx) * 0.9) * 1.5); deco.put(x, 216 + s); if ((x - vx) % 4 === 0) deco.put(x, 215 + s - Math.sign(s || 1)); }
    deco.rect(vx - 9, 213, 19, 1).rect(vx - 9, 220, 19, 1).rect(vx - 8, 228, 17, 1);
    for (let x = vx - 7; x <= vx + 7; x += 3) deco.rect(x, 229, 1, 4).put(x + 1, 229);
    cv.fill(deco.and(vase.erode(1)), blue);
    cv.outline(INK, vase, { all: true });
    cv.set(vx - 5, 210, Po[4]).set(vx - 6, 211, Po[4]).set(vx - 6, 212, Po[4]);

    // ---- garden rock with holes and a tuft of grass ------------------------------------------------
    const rock = cv.mask().oval(272, 196, 22, 24).or(cv.mask().oval(268, 210, 30, 28)).or(cv.mask().oval(281, 186, 16, 20)).or(cv.mask().oval(286, 214, 16, 22));
    part(cv, rock, St, { top: [5], left: [4], bottom: [1], right: [2], fill: 3, dx: -1, dy: 1 });
    cv.glow(rock.erode(2), 277, 200, 18, 1);
    for (const [x, y, w, h] of [[284, 193, 5, 6], [276, 214, 6, 5], [289, 222, 4, 6], [279, 203, 3, 3]]) {
      const hl = cv.mask().oval(x, y, w, h, 1.2);
      cv.fill(hl, St[0]).fill(hl.and(hl.shift(1, 1).not()).and(hl.shift(0, 1)), St[1]);
      cv.fill(hl.ring().and(rock).and(hl.shift(0, 1)).sub(hl), St[5]);
    }
    for (const [x0, y0, x1, y1] of [[271, 212, 278, 207], [290, 206, 295, 212], [273, 228, 281, 225]]) cv.fill(cv.mask().line(x0, y0, x1, y1).and(rock.erode(1)), St[2]);
    for (const [x, h, lean] of [[266, 9, -3], [269, 12, -1], [272, 8, 2], [298, 10, 2], [295, 7, -2]]) {
      const g = cv.mask().line(x, 236, x + lean, 236 - h);
      cv.fill(g, '#4c8a45').set(x + lean, 236 - h, '#7dbb55');
    }

    cv.outline(INK);

    // Drifting plum petals (two positions taking turns).
    const pa = cv.layer('pa'), pb = cv.layer('pb');
    for (const [l, pts] of [[pa, [[40, 120], [6, 186], [44, 160]]], [pb, [[36, 132], [2, 198], [46, 172]]]]) {
      for (const [x, y] of pts) l.set(x, y, Pk[3]).set(x + 1, y, Pk[2]);
    }
    return cv.punch(...HOLE, HR);
  },
};
