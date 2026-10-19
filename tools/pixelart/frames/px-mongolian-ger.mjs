// Steppe Ger: a felt ger on the open steppe. The screen is the painted wooden door (orange with gold
// lines and a teal meander band), under a rolled felt door flap, cream felt walls with twisted hair
// ropes, the shallow dome with its wooden crown ring and the folded-back urkh flap. A morin khuur
// leans by the door, a blue khadag flutters from the door post, a saddled horse grazes in front and
// clouds drift across a huge banded sky over rolling green hills.
import { Canvas, ramp, rng, bayer } from '../pixel.mjs';
import { INK, inset, part, sprite, spriteMask } from '../kit.mjs';

const W = 272, H = 248, HOLE = [64, 94, 144, 108]; // 4:3
const Sk = ['#2d5fb5', '#3b78cc', '#5595dd', '#78b3e9', '#a3cff2', '#cde6f8']; // sky, top -> horizon
const Cl = ['#a6c9ec', '#e2f0fb', '#ffffff']; // cloud underside, mid, top
const Fe = ramp('#e6dcc4', 7, { step: 0.085, hue: 8, sat: 0.05 }); // felt
const Or = ramp('#e06a2c', 6, { step: 0.11, hue: 10 }); // painted door frame
const Te = ramp('#2f8f8a', 5, { step: 0.12 }); // teal ornament ground
const Gd = ramp('#e9b63e', 5, { step: 0.1 }); // gold lines
const Wd = ramp('#8c5b34', 6, { step: 0.11 }); // wood
const Rp = ramp('#a67d48', 4, { step: 0.13 }); // hair rope
const Gr = ramp('#6aa84c', 7, { step: 0.09, hue: 8 }); // steppe grass
const Fh = ramp('#8ab996', 5, { step: 0.09, hue: 6, sat: 0.04 }); // far hills
const Hs = ramp('#a4633a', 6, { step: 0.11 }); // horse coat
const Mn = ramp('#4a2e1f', 4, { step: 0.12 }); // mane, tail, hooves
const Rd = ramp('#c93c32', 5, { step: 0.12 }); // saddle
const Kh = ramp('#4c8fe4', 5, { step: 0.12 }); // khadag silk
const WH = '#ffffff';

// Meander (Greek-key style "alkhan khee") unit: 6 wide, 5 tall, tiled along a band.
const PAT = ['######', '#.....', '#.###.', '#.#.#.', '###.#.'];
const pat = (along, across) => PAT[((across % 5) + 5) % 5][((along % 6) + 6) % 6] === '#';

// Twisted rope texture over a mask: diagonal twist, lit top row, dark bottom row.
const rope = (cv, m) => {
  const bb = m.bbox();
  cv.fill(m, (x, y) => {
    const tw = ((x + y * 2) % 5 + 5) % 5 < 2, r = y - bb.y;
    return r === 0 ? (tw ? Rp[3] : Rp[2]) : r === bb.h - 1 ? (tw ? Rp[1] : Rp[0]) : tw ? Rp[2] : Rp[1];
  });
};

// Ramp index from a continuous value: flat steps with a narrow dithered seam between them (wide dither
// bands explode the SVG into single-pixel rects).
const dIdx = (R, v, x, y) => {
  const k = Math.floor(v), f = Math.max(0, Math.min(1, (v - k - 0.5) / 0.22 + 0.5));
  return R[Math.max(0, Math.min(R.length - 1, k + (f > bayer(x, y) ? 1 : 0)))];
};

// Dome: half width at row y (crown at 32, eave at 64), slightly convex.
const CX = 136, DOME_T = 32, DOME_B = 64;
const hw = (y) => 22 + 88 * Math.pow(Math.max(0, Math.min(1, (y + 0.5 - DOME_T) / (DOME_B - DOME_T))), 0.85);

// Clouds: one period of P px, instances wrap so the drift loops seamlessly.
const P = 136, N = 34, SHIFT = P / N;
const CLOUDS = [
  [18, 8, [[0, 0, 4], [5, -2, 5], [11, 0, 4]]],
  [76, 14, [[0, 0, 5], [7, -3, 6], [15, -1, 5], [8, 3, 5]]],
  [112, 52, [[0, 0, 7], [9, -5, 8], [20, -2, 7], [28, 2, 5], [10, 4, 6]]],
  [40, 82, [[0, 0, 4], [6, -2, 5], [12, 0, 4]]],
  [96, 100, [[0, 0, 4], [7, -2, 5], [14, 0, 4]]],
];
function cloudMask(cv, shift) {
  const m = cv.mask();
  for (const [cx, cy, puffs] of CLOUDS) for (let rep = -1; rep <= 2; rep++) {
    const ax = cx + rep * P + shift;
    if (ax < -40 || ax > W + 40) continue;
    const c = cv.mask();
    for (const [dx, dy, r] of puffs) c.circle(ax + dx, cy + dy, r);
    m.d.set(c.clip(0, 0, W, cy + 3).d.map((v, i) => v | m.d[i])); // flat cumulus base
  }
  return m;
}

export default {
  id: 'px-mongolian-ger', name: 'Steppe Ger', theme: 'mongolian', rarity: 'rare', translucent: false,
  collection: 'world-tour', license: 'CC-BY-4.0',
  desc: 'Play through the painted door of a felt ger while clouds drift over the steppe and your horse grazes outside.',
  tags: ['mongolian', 'ger', 'steppe', 'horse', 'animated', 'pixel'],
  css: Array.from({ length: N - 1 }, (_, i) => {
    const k = i + 1, T = N * 0.5, edge = +(100 * (1 - k / N)).toFixed(3);
    return `.c${k}{animation:c${k} ${T}s steps(1) -${+((1 - k / N) * T).toFixed(3)}s infinite}@keyframes c${k}{0%{opacity:1}${edge}%,100%{opacity:0}}`;
  }).join('') + '.fl{animation:fl 1.6s steps(1) infinite}@keyframes fl{50%{opacity:0}}',
  draw() {
    const cv = new Canvas(W, H), rnd = rng(7);
    cv.use(Sk, Fe, Or, Te, Gd, Wd, Rp, Gr, Fh, Hs, Mn, Rd, Kh);

    // ---- sky, hills, meadow ---------------------------------------------------------------------
    const card = cv.mask().rrect(0, 0, W, H, 10);
    const skyRegion = card.clip(0, 0, W, 126);
    cv.grad(skyRegion, Sk, { soft: 0.001, from: 0, to: 118 }); // crisp bands: dithered seams cost every cloud frame
    const skyBase = cv.p.slice();
    const farTop = (x) => 112 + 4 * Math.sin(x / 26) + 2 * Math.sin(x / 9 + 1);
    const far = card.and(cv.mask().plot((x, y) => y + 0.5 >= farTop(x + 0.5), 0, 100, W, H));
    cv.fill(far, Fh[2]);
    cv.fill(far.edge().and(far.shift(0, 1)), Fh[3]);
    cv.fill(far.and(cv.mask().plot((x, y) => y + 0.5 >= farTop(x + 0.5) + 7 && y % 3 === 0, 0, 100, W, H)), Fh[1]); // furrows
    const nearTop = (x) => 130 + 5 * Math.sin(x / 35 + 2) + 2 * Math.sin(x / 13);
    const near = card.and(cv.mask().plot((x, y) => y + 0.5 >= nearTop(x + 0.5), 0, 118, W, H));
    cv.fill(near, Gr[4]);
    cv.fill(near.edge().and(near.shift(0, 1)), Gr[5]);
    const meadow = card.and(cv.mask().plot((x, y) => y + 0.5 >= nearTop(x + 0.5) + 18, 0, 130, W, H));
    cv.fill(meadow, (x, y) => (y > 240 ? Gr[2] : Gr[3])); // darker foreground strip
    cv.fill(meadow.edge().and(meadow.shift(0, 1)), Gr[4]);
    for (let i = 0; i < 70; i++) { // grass tufts
      const x = 2 + Math.floor(rnd() * (W - 4)), y = 150 + Math.floor(rnd() * 94);
      if (meadow.erode(1).has(x, y)) { cv.set(x, y, Gr[5]).set(x + 1, y - 1, Gr[5]).set(x - 1, y - 1, Gr[4]); }
    }
    // Distant ger on the left hill, sheep on the right.
    sprite(cv, 6, 104, ['....kkkk....', '..kkwwwwkk..', '.kwwwwwwwwk.', 'kwwwwwwwwwwk', 'kwwwwwwwwwwk', 'kwwwkwwwwwwk', 'kkkkkkkkkkkk'],
      { k: Fh[0], w: Fe[6], W: Fe[5] });
    cv.rect(7, 108, 4, 4, Fe[4]).rect(1, 111, 10, 1, Fh[1]);
    for (const [x, y] of [[244, 119], [256, 124], [262, 115]]) sprite(cv, x, y, ['.kkkk.', 'kwwwwk', 'kwwwwk', '.k..k.'], { k: Fh[0], w: Fe[6] });

    // ---- ger: wall, skirt, ropes, roof, trim, crown ---------------------------------------------
    const wall = cv.mask().rect(36, 72, 200, 140);
    cv.fill(wall, (x, y) => {
      const t = (x - 36) / 200, v = t < 0.3 ? 5.3 - (1.2 * (0.3 - t)) / 0.3 : 5.3 - 2.6 * Math.pow((t - 0.3) / 0.7, 1.3);
      return dIdx(Fe, v, x, y);
    });
    for (let i = 0; i < 60; i++) { const x = 37 + Math.floor(rnd() * 198), y = 73 + Math.floor(rnd() * 126); cv.set(x, y, cv.step(cv.get(x, y), -1)); }
    for (const sx of [86, 186]) cv.tone(cv.mask().rect(sx, 72, 1, 128), -1, 0.5); // felt seams
    const skirt = cv.mask().rect(36, 200, 200, 12);
    cv.fill(skirt, (x, y) => (y === 200 ? Fe[1] : y > 209 ? Fe[1] : Fe[2]));
    for (let x = 40; x < 236; x += 8) cv.rect(x, 205, 1, 2, Fe[1]);
    for (const ry of [122, 168]) { // hair-rope bands around the wall
      const band = cv.mask().rect(36, ry, 200, 3);
      cv.tone(band.shift(0, 3).sub(band), -1, 0.6);
      rope(cv, band);
    }

    const roof = cv.mask().plot((x, y) => Math.abs(x + 0.5 - CX) <= hw(y), 0, DOME_T, W, DOME_B + 1);
    const seams = [-0.78, -0.5, -0.22, 0.22, 0.5, 0.78];
    cv.fill(roof, (x, y) => {
      const a = (x + 0.5 - CX) / hw(y);
      let v = a > -0.2 ? 5.6 - 2.8 * Math.pow(a + 0.2, 1.2) : 5.6 - (1.0 * (-0.2 - a)) / 0.8;
      if (seams.some((s) => Math.abs(x + 0.5 - CX - s * hw(y)) < 0.6)) v -= 1;
      return dIdx(Fe, v, x, y);
    });
    for (const yr of [45, 56]) { // rope rings around the dome (front halves)
      const r = hw(yr), ry = Math.max(2, Math.round(r * 0.13));
      const ring = cv.mask().oval(CX - r, yr - ry, 2 * r, 2 * ry).edge().and(cv.mask().rect(0, yr, W, ry + 1)).and(roof);
      rope(cv, ring.or(ring.shift(0, 1)));
    }
    cv.fill(roof.edge().and(roof.shift(1, 0).not()), Fe[6]);
    // urkh ropes down the dome from the crown
    cv.fill(cv.mask().line(124, 30, 52, 63).or(cv.mask().line(150, 30, 222, 63)).and(roof), Rp[1]);
    // eave trim: orange edges, gold lines, teal meander
    const trim = cv.mask().rect(26, 62, 220, 10);
    cv.fill(trim, (x, y) => {
      const r = y - 62;
      if (r === 0) return Or[4]; if (r === 1 || r === 7) return Gd[3]; if (r === 8) return Or[2]; if (r === 9) return INK;
      return pat(x - 26, r - 2) ? Gd[3] : Te[2];
    });
    cv.rect(26, 62, 1, 10, INK).rect(245, 62, 1, 10, INK);
    // crown ring and the urkh flap folded back
    const ringO = cv.mask().oval(112, 22, 48, 12), ringI = cv.mask().oval(118, 25, 36, 6);
    cv.fill(ringI, Fe[1]);
    for (const sx of [127, 136, 145]) cv.fill(ringI.and(cv.mask().rect(sx, 25, 1, 6)), Wd[1]);
    part(cv, ringO.sub(ringI), Wd, { top: [5, 4], left: [4], bottom: [1], right: [2], fill: 3, shadow: false });
    cv.outline(INK, ringI, { all: true });
    const flap = cv.mask().rrect(127, 14, 24, 10, 3);
    part(cv, flap, Fe, { top: [6], left: [5], bottom: [2], right: [3], fill: 4, dy: 1 });
    cv.rect(133, 15, 1, 8, Rp[1]).rect(144, 15, 1, 8, Rp[1]);
    const gerMask = wall.or(roof).or(ringO).or(flap).or(trim);
    cv.outline(INK, gerMask, { all: true });
    cv.rect(36, 72, 1, 140, INK).rect(235, 72, 1, 140, INK); // wall edges
    cv.tone(cv.mask().rect(34, 212, 204, 3), -1, 0.5); // ground shadow under the wall

    // ---- door: rolled felt flap, painted frame, sill, recessed opening ---------------------------
    const roll = cv.mask().rrect(46, 72, 180, 10, 4);
    part(cv, roll, Fe, { top: [6, 5], left: [5], bottom: [1, 2], right: [3], fill: 4, dy: 1 });
    for (const x of [66, 136, 206]) cv.rect(x, 73, 2, 8, Rp[1]).rect(x, 73, 1, 8, Rp[2]);
    const frame = cv.mask().rect(48, 80, 176, 125);
    cv.fill(frame, (x, y) => {
      const dl = x - 48, dr = 223 - x, dt = y - 80, d = Math.min(dl, dr, dt);
      if (d === 0) return INK; if (d === 1) return Or[4]; if (d === 2 || d === 8) return Gd[3];
      if (d >= 3 && d <= 7) {
        const along = dt === d ? x - 48 : y - 80, across = dr === d ? 7 - d : d - 3;
        return pat(along, across) ? Gd[3] : Te[2];
      }
      return d === 9 ? Or[2] : Or[3];
    });
    for (const [x, y] of [[50, 82], [217, 82], [50, 196], [217, 196], [133, 82]]) { // rosettes
      const ro = cv.mask().rrect(x, y, 7, 7, 1);
      cv.shade(ro, Gd, { top: [4], left: [4], bottom: [1], right: [2], fill: 3 });
      cv.outline(INK, ro, { all: true });
      cv.rect(x + 2, y + 2, 3, 3, Rd[2]).set(x + 2, y + 2, Rd[3]);
    }
    const sill = cv.mask().rect(46, 205, 180, 5);
    part(cv, sill, Wd, { top: [5], left: [4], bottom: [0], right: [2], fill: 3, shadow: false });
    cv.rect(46, 209, 180, 1, INK);
    inset(cv, ...HOLE, 0, { rim: INK, top: Or[0], left: Or[1], bottom: Or[2], right: Or[2] }, 2);

    // ---- morin khuur leaning by the door --------------------------------------------------------
    const body = cv.mask().poly([[26, 215], [43, 215], [41, 198], [28, 198]]);
    const neck = cv.mask().capsule(34, 198, 33, 146, 1.4);
    const head = spriteMask(cv, 28, 134, ['.hh.....', 'hhhh.h..', 'hhhhhhh.', '.hhhhhhh', 'hhhhhhhh', 'hhhhhhh.', '.hhhhh..', '..hhhh..', '..hhhh..', '..hhhh..']);
    const pegs = cv.mask().rect(27, 147, 3, 2).rect(36, 150, 3, 2);
    const kh = body.or(neck).or(head).or(pegs);
    part(cv, kh, Wd, { top: [5], left: [4], bottom: [1], right: [2], fill: 3, dx: 2, dy: 2, shadow: -1 });
    cv.fill(body.erode(2), Wd[4]);
    cv.rect(30, 201, 9, 11, Wd[3]).rect(31, 202, 7, 9, Wd[4]); // face plate
    cv.rect(32, 209, 5, 1, Mn[0]).rect(33, 210, 3, 1, Wd[1]); // bridge
    cv.rect(33, 150, 1, 59, Fe[6]).rect(35, 150, 1, 59, Fe[5]); // strings
    cv.set(29, 137, WH).set(30, 137, INK); // carved horse eye
    cv.px([[28, 135], [29, 134]], Wd[1]);
    cv.rect(23, 176, 1, 38, Wd[2]).rect(24, 172, 1, 6, Wd[1]).rect(22, 176, 1, 38, Fe[5]); // bow resting beside

    // ---- khadag tied to the right door post (two flutter frames) -------------------------------
    const base0 = cv.p.slice();
    const drawKhadag = (c, ph) => {
      const wrap = c.mask().rect(209, 98, 15, 4);
      const knot = c.mask().circle(223, 100, 3);
      const tails = c.mask();
      for (let y = 103; y <= 136; y++) {
        const x1 = Math.round(221 + 2 * Math.sin((y - 103) / 6 + ph)), x2 = Math.round(227 + 2 * Math.sin((y - 103) / 6 + ph + 1.6));
        tails.rect(x1 - 1, y, 3, 1).rect(x2 - 1, y, 3, 1);
      }
      const m = wrap.or(knot).or(tails);
      c.cast(m.dilate(1), 1, 1, -1);
      c.shade(m, Kh, { top: [4], left: [3], bottom: [1], right: [2], fill: 3 });
      c.fill(tails.and(tails.shift(1, 0).not()).sub(knot), Kh[4]);
      c.fill(tails.and(tails.shift(-1, 0).not()).sub(knot), Kh[1]);
      c.set(222, 99, Kh[4]).set(209, 98, Kh[4]);
      c.outline(INK, m, { all: true });
      return m;
    };
    const k0 = drawKhadag(cv, 0);
    const fl = cv.layer('fl');
    const kRegion = k0.dilate(3);
    fl.fill(kRegion, (x, y) => base0[y * W + x]);
    drawKhadag(fl, 1.1);
    // layer only needs pixels that differ from the base
    kRegion.each((x, y) => { if (fl.get(x, y) === cv.get(x, y)) fl.set(x, y, null); });

    // ---- flowers in the meadow -------------------------------------------------------------------
    for (const [x, y] of [[12, 226], [60, 232], [102, 224], [150, 236], [180, 226], [268, 230], [40, 242], [122, 243]]) {
      if (!meadow.has(x, y)) continue;
      cv.px([[x - 1, y], [x + 1, y], [x, y - 1], [x, y + 1]], WH).set(x, y, Gd[3]);
      cv.set(x, y + 2, Gr[2]);
    }

    // ---- saddled horse grazing (bottom right) ---------------------------------------------------
    cv.fill(cv.mask().oval(206, 234, 56, 9).and(meadow), Gr[2]); // floor shadow
    const torso = cv.mask().oval(222, 204, 36, 18).or(cv.mask().circle(252, 212, 8)).or(cv.mask().circle(227, 213, 8));
    const hneck = cv.mask().capsule(228, 210, 216, 226, 4.5);
    const hhead = cv.mask().oval(204, 222, 17, 11).or(cv.mask().rect(204, 229, 7, 4));
    const legs = cv.mask().rect(226, 220, 3, 18).rect(231, 221, 3, 17).rect(247, 220, 3, 18).rect(252, 221, 3, 17);
    const ears = cv.mask().rect(214, 219, 2, 3).rect(218, 219, 2, 3);
    const horse = torso.or(hneck).or(hhead).or(legs).or(ears);
    part(cv, horse, Hs, { top: [5], left: [4], bottom: [1], right: [2], fill: 3, dx: 1, dy: 1 });
    cv.fill(cv.mask().rect(231, 221, 3, 17).or(cv.mask().rect(252, 221, 3, 17)).and(horse).erode(0), (x, y, c) => cv.step(c, -1)); // far legs darker
    cv.fill(legs.and(cv.mask().rect(0, 236, W, 2)), Mn[1]); // hooves
    cv.fill(legs.and(cv.mask().rect(0, 238, W, 1)), INK);
    const mane = cv.mask().capsule(229, 206, 216, 222, 2).and(hneck.or(torso)).or(cv.mask().rect(213, 221, 4, 2));
    cv.fill(mane, Mn[1]);
    cv.fill(mane.edge().and(mane.shift(1, 1)), Mn[2]);
    const tail = cv.mask().capsule(258, 208, 263, 229, 2.2).or(cv.mask().capsule(263, 229, 261, 236, 1.6));
    part(cv, tail, Mn, { top: [3], left: [2], bottom: [0], right: [1], fill: 1, dx: 1, dy: 1 });
    cv.rect(205, 224, 1, 7, Fe[6]); // blaze
    cv.set(211, 225, INK).set(211, 224, WH); // eye
    cv.set(206, 232, Mn[0]); // nostril
    cv.rect(239, 213, 2, 10, Mn[1]); // girth
    const pad = cv.mask().rrect(229, 200, 22, 11, 2);
    part(cv, pad, Te, { top: [4], left: [3], bottom: [0], right: [1], fill: 2, dy: 1 });
    for (let x = 231; x < 250; x += 3) cv.set(x, 209, Gd[3]); // fringe
    const seat = cv.mask().rrect(233, 199, 14, 6, 2).or(cv.mask().rect(233, 195, 3, 5)).or(cv.mask().rect(244, 195, 3, 5));
    part(cv, seat, Rd, { top: [4], left: [3], bottom: [1], right: [2], fill: 2, dy: 1 });
    cv.px([[234, 196], [245, 196], [237, 201], [242, 201]], Gd[4]); // silver studs
    cv.px([[236, 202], [241, 202]], Gd[2]);

    // ---- drifting clouds: base frame plus cumulative diff layers (seamless wrap) ----------------
    const skyMask = skyRegion.and(cv.mask().plot((x, y) => cv.p[y * W + x] === skyBase[y * W + x], 0, 0, W, 126));
    const cloudFrame = (shift) => {
      // Flat white puffs with a shaded underside and no dark rim: every edge pixel here is re-emitted in
      // each of the N frame layers, so the cloud look is kept deliberately simple.
      const m = cloudMask(cv, shift), out = new Array(W * H).fill(null);
      m.and(skyMask).each((x, y) => {
        const db = !m.has(x, y + 1) ? 1 : !m.has(x, y + 2) ? 2 : !m.has(x, y + 3) ? 3 : 9;
        out[y * W + x] = db <= 2 ? Cl[0] : db === 3 && m.has(x, y - 1) ? Cl[1] : Cl[2];
      });
      return out;
    };
    let prev = cloudFrame(0);
    skyMask.each((x, y) => { if (prev[y * W + x]) cv.set(x, y, prev[y * W + x]); });
    for (let k = 1; k < N; k++) {
      const fk = cloudFrame(k * SHIFT), l = cv.layer(`c${k}`);
      skyMask.each((x, y) => { const i = y * W + x; if (fk[i] !== prev[i]) l.set(x, y, fk[i] || skyBase[i]); });
      prev = fk;
    }

    cv.outline(INK);
    return cv.punch(...HOLE);
  },
};
