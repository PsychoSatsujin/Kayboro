// Dino Pal: a chubby baby dinosaur that is the virtual pet itself. Round green body with the screen
// set in its cream tummy, orange plates along the head and back, little arms gripping the bezel, a
// curling tail with a 2-frame tip wag, big sparkly eyes, three leaf buttons and stubby feet.
import { Canvas, bayer } from '../pixel.mjs';
import { INK, inset, part, sprite, spriteMask, sparkle, SHAPES } from '../kit.mjs';

const W = 224, H = 208, HOLE = [44, 80, 112, 84], HR = 4; // 4:3
const G = ['#1f4f4a', '#2a7255', '#38965c', '#56b866', '#7fd474', '#b2ec8e', '#e2fcb6']; // dino green
const O = ['#8a2a1c', '#c8501f', '#f27f2e', '#ffab4a', '#ffd479']; // back plates
const Cr = ['#8c6a52', '#c2a07a', '#e8d3a4', '#f8ecc8', '#fffae6']; // tummy cream
const L = ['#2c6a2e', '#4e9a34', '#7fc63e', '#b8ea5c', '#ecffa0']; // leaf buttons
const T = ['#0f1418', '#1a2328', '#26333a', '#34454c', '#485c62']; // dark glass lip
const PK = ['#b83a5e', '#ff7f9f', '#ffb3c6'];
const CX = 100, CY = 106; // body centre
const CURL = [193, 150]; // centre the tail curls around
const SH = '#2a2140'; // soft floor-shadow ink

// Plump superellipse whose half-width swells toward the bottom (narrower head, chubby belly).
const egg = (cv, cx, cy, a, b, k = 0.1, p = 2.3) => cv.mask().plot((x, y) => {
  const u = (x + 0.5 - cx) / a, v = (y + 0.5 - cy) / b;
  return Math.abs(u / (1 + k * v)) ** p + Math.abs(v) ** p <= 1;
});

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
  return out.concat([P[P.length - 1]]);
}

// Rounded spike pointing along (dx, dy) from base point (x, y): half-width w, height h.
const plate = (cv, x, y, dx, dy, w, h) => {
  const tx = -dy, ty = dx, P = (a, b) => [x + dx * a + tx * b, y + dy * a + ty * b];
  const m = cv.mask().poly([P(-5, w), P(h * 0.45, w * 0.8), P(h * 0.82, w * 0.42), P(h, 0), P(h * 0.82, -w * 0.42), P(h * 0.45, -w * 0.8), P(-5, -w)]);
  return Object.assign(m, { px: x, py: y, tx, ty });
};
// Two-tone plate: the face turned toward the top-left light is lighter, a ridge runs up the middle.
const shadePlate = (cv, m) => {
  cv.outline(INK, m, { all: true });
  cv.shade(m, O, { top: [4], left: [3], bottom: [1], right: [1], fill: 2 });
  const lit = m.tx * -1 + m.ty * -1 > 0 ? 1 : -1;
  cv.fill(m.erode(1), (x, y, c) => {
    const s = ((x + 0.5 - m.px) * m.tx + (y + 0.5 - m.py) * m.ty) * lit;
    return s > 0.8 ? O[3] : s > -0.8 ? O[4] : c;
  });
};

// Leaf: lens shape along angle a (radians), length len, max width wid.
const leaf = (cv, cx, cy, len, wid, a) => {
  const c = Math.cos(a), s = Math.sin(a);
  return cv.mask().plot((x, y) => {
    const px = x + 0.5 - cx, py = y + 0.5 - cy, u = (px * c + py * s) / (len / 2), v = -px * s + py * c;
    return Math.abs(u) <= 1 && Math.abs(v) <= (wid / 2) * (1 - u * u) ** 0.8;
  }, cx - len, cy - len, cx + len, cy + len);
};

// A whole tail (with its plates) on its own canvas, so the wag frames can be diffed.
function tailCanvas(cv, P) {
  const t = new Canvas(W, H);
  t.ramps = cv.ramps;
  const path = spline(P), m = t.mask(), n = path.length;
  path.forEach(([x, y], i) => m.circle(Math.round(x), Math.round(y), Math.max(2.5, 9.5 - (i / n) * 7.5)));
  // plates along the top (inner) side of the curl
  for (const [f, s] of [[0.16, 6], [0.32, 6], [0.47, 5]]) {
    const i = Math.round(f * (n - 1)), [x, y] = path[i], [nx, ny] = path[i + 1];
    const l = Math.hypot(nx - x, ny - y) || 1;
    let dx = (ny - y) / l, dy = -(nx - x) / l;
    if (dx * (x - CURL[0]) + dy * (y - CURL[1]) > 0) { dx = -dx; dy = -dy; }
    const r = Math.max(2.5, 9.5 - (i / n) * 7.5);
    shadePlate(t, plate(t, x + dx * (r - 1), y + dy * (r - 1), dx, dy, s, s + 3));
  }
  t.outline(INK, m, { all: true });
  t.shade(m, G, { top: [5], left: [4], bottom: [1], right: [2], fill: 3 });
  // round it off: a lit ridge along the top side, a darker band above the cream underside
  const band = (side, off, lo, hi) => {
    const out = t.mask();
    path.forEach(([x, y], i) => {
      if (i < n * lo || i > n * hi) return;
      const [nx, ny] = path[Math.min(n - 1, i + 1)], l = Math.hypot(nx - x, ny - y) || 1;
      let dx = (ny - y) / l, dy = -(nx - x) / l;
      if ((dx * (x - CURL[0]) + dy * (y - CURL[1])) * side < 0) { dx = -dx; dy = -dy; }
      const r = Math.max(2.5, 9.5 - (i / n) * 7.5);
      out.put(Math.round(x + dx * (r - off)), Math.round(y + dy * (r - off)));
    });
    return out;
  };
  t.fill(band(-1, 3, 0.08, 0.6).and(m.erode(1)), G[5]);
  t.fill(band(1, 2, 0.1, 0.8).dilate(1).and(m.erode(1)), (x, y, c) => (c === G[1] ? Cr[1] : Cr[2]));
  return t;
}

export default {
  id: 'px-dino-pal', name: 'Dino Pal', theme: 'dinosaur', rarity: 'common', translucent: false,
  collection: 'pocket-pals', license: 'CC-BY-4.0',
  desc: 'A chubby baby dino hugs your game in its tummy and wags its tail while you play.',
  tags: ['dinosaur', 'virtual-pet', 'kawaii', 'handheld', 'animated', 'pixel'],
  css: '.wa{animation:wa 1.8s steps(1) infinite}@keyframes wa{60%{opacity:0}}' +
    '.wb{opacity:0;animation:wb 1.8s steps(1) infinite}@keyframes wb{60%{opacity:1}}',
  draw() {
    const cv = new Canvas(W, H);
    cv.use(G, O, Cr, L, T, PK);

    // Compact floor shadow: a solid core with one ring of checker dither.
    const soft = (x, y, w, h) => {
      const core = cv.mask().oval(x + 4, y + 1, w - 8, h - 2), outer = cv.mask().oval(x, y, w, h);
      cv.fill(core, SH).fill(outer.sub(core), (px, py, c) => (bayer(px, py) < 0.5 ? SH : c));
    };
    soft(48, 195, 158, 10);

    // Tail (behind the body) in two poses; the frames differ only near the tip.
    const base = [[150, 178], [175, 186], [196, 182], [209, 168], [213, 150]];
    const tA = tailCanvas(cv, [...base, [210, 134], [200, 125], [190, 128], [188, 136]]);
    const tB = tailCanvas(cv, [...base, [213, 134], [209, 121], [200, 115], [193, 119]]);
    tA.opaque().each((x, y) => cv.set(x, y, tA.get(x, y)));

    // Back plates along the head and down the back.
    const body = egg(cv, CX, CY, 82, 88, 0.12);
    const plates = cv.mask();
    for (const [deg, s] of [[-132, 7], [-112, 9], [-90, 11], [-68, 11], [-46, 10], [-24, 9], [-3, 7]]) {
      const a = (deg * Math.PI) / 180, dx = Math.cos(a), dy = Math.sin(a);
      let r = 40;
      while (body.has(Math.round(CX + dx * r), Math.round(CY + dy * r))) r++;
      const m = plate(cv, CX + dx * r, CY + dy * r, dx, dy, s, s * 1.15 + 2);
      shadePlate(cv, m);
      m.each((x, y) => plates.put(x, y));
    }

    // Body.
    cv.outline(INK, body, { all: true });
    cv.shade(body, G, { top: [6, 5], left: [5], bottom: [1, 2], right: [2], fill: 3 });
    const crescent = (m, dx, dy) => m.sub(m.shift(dx, dy));
    const bi = body.erode(2);
    cv.tone(crescent(bi, 4, 4), 1).tone(crescent(bi, 6, 6).sub(crescent(bi, 4, 4)), 1, 0.5); // lit top-left
    cv.tone(crescent(bi, -4, -4), -1).tone(crescent(bi, -6, -6).sub(crescent(bi, -4, -4)), -1, 0.5); // shaded bottom-right
    cv.tone(body.dilate(2).sub(body).and(plates), -1); // plates tuck in behind the body
    // Cute lighter patches on the flanks and crown (kept out of the face), each with a darker underside.
    for (const [x, y, r] of [[36, 80, 2], [29, 96, 2], [44, 58, 2], [166, 80, 3], [160, 60, 2], [94, 26, 2], [105, 24, 1]]) {
      const sp = cv.mask().circle(x, y, r).and(body.erode(2));
      cv.tone(sp, 1).tone(sp.shift(0, 1).sub(sp).and(body.erode(2)), -1);
    }
    const wedge = (a0, a1) => cv.mask().plot((x, y) => { const a = (Math.atan2(y + 0.5 - CY, x + 0.5 - CX) * 180) / Math.PI; return a > a0 && a < a1; });
    cv.fill(body.erode(4).edge().and(wedge(-142, -116)), G[6]); // gloss

    // Cream tummy that doubles as the screen bezel.
    const tummy = egg(cv, CX, 129, 72, 64, 0.06, 3.4).and(body.erode(2)); // runs down to the body's bottom rim
    part(cv, tummy, Cr, { top: [4, 3], left: [3], bottom: [0, 1], right: [1], fill: 2, dy: 1 });
    cv.tone(tummy.erode(2).sub(tummy.erode(2).shift(2, 2)), 1);
    cv.shade(cv.mask().rrect(39, 75, 122, 94, 7), T, { top: [0], left: [0], bottom: [3], right: [2], fill: 1 });
    inset(cv, ...HOLE, HR, { rim: INK, top: T[0], bottom: T[3], right: T[2] }, 1);
    cv.px([[41, 82], [41, 81], [42, 80], [42, 79], [43, 78], [44, 77], [45, 77]], T[4]);
    cv.fill(cv.mask().rrect(39, 75, 122, 94, 7).ring(), (x, y, c) => (y > 120 || (x > 150 && y > 90) ? Cr[4] : c)); // lip catches light low-right

    // Big sparkly eyes, blush and a happy mouth.
    const EYE = ['.....kkkk.....', '...kkkkkkkk...', '..kkkkkkkkkk..', '.kkwwwkkkkkkk.', '.kwwwwwkkkkkk.', 'kkwwwwwkkkkkkk', 'kkwwwwwkkkkkkk',
      'kkkwwwkkkkkkkk', 'kkkkkkkkkkkkkk', 'kkkkkkkkkkwwkk', 'kkkkkkkkkkwwkk', 'kbkkkkkkkkkkbk', '.kbbkkkkkkbbk.', '..kbbbbbbbbk..', '...kkbbbbkk...', '.....kkkk.....'];
    for (const x of [CX - 33, CX + 19]) sprite(cv, x, 38, EYE, { k: INK, w: '#ffffff', b: '#5560b8' });
    for (const x of [CX - 47, CX + 35]) cv.dither(cv.mask().oval(x, 52, 12, 5), PK[1], PK[2], 0.25);
    sprite(cv, CX - 4, 52, ['k.......k', '.kkkkkkk.', '..kpppk..', '...kkk...'], { k: INK, p: PK[1] });

    // Little arms gripping the bezel sides.
    const mx = (s, x) => (s < 0 ? x : 2 * CX - 1 - x); // mirror across the body's centre
    for (const s of [-1, 1]) {
      // shoulder crease: the upper arm rising out of the flank
      for (let y = 101; y <= 113; y++) cv.set(mx(s, 20 + Math.round(5 * ((y - 101) / 12) ** 1.6)), y, G[2]);
      const arm = cv.mask().rrect(s < 0 ? 15 : 165, 115, 20, 14, 6);
      part(cv, arm, G, { top: [5], left: [4], bottom: [1], right: [2], fill: 3, dy: 1 });
      cv.tone(arm.erode(1).sub(arm.erode(1).shift(3, 3)), 1).tone(arm.erode(1).sub(arm.erode(1).shift(-3, -3)), -1);
      // three fingers (ink creases) whose cream claw tips hook over the bezel
      for (const y of [119, 123]) for (let x = 31; x <= 34; x++) cv.set(mx(s, x), y, x === 31 ? G[1] : INK);
      for (const y of [117, 121, 125]) sprite(cv, s < 0 ? 35 : 162, y - 1, ['kk.', 'Cck', 'kk.'], { k: INK, C: Cr[4], c: Cr[2] }, { flip: s > 0 });
    }

    // Three leaf buttons under the screen, fanned out like a sprout.
    for (const [x, y, a, len] of [[CX - 21, 178, -2.5, 17], [CX, 180, -Math.PI / 2, 15], [CX + 21, 178, -0.64, 17]]) {
      cv.shade(leaf(cv, x, y, len, 10, a), Cr, { top: [0], left: [0], bottom: [3], right: [3], fill: 1 });
      const m = leaf(cv, x, y - 1, len - 3, 8, a);
      part(cv, m, L, { top: [4], left: [3], bottom: [0], right: [1], fill: 2, shadow: false });
      const c = Math.cos(a), s = Math.sin(a);
      for (let k = -3; k <= 3; k++) cv.set(Math.round(x - 0.5 + c * k), Math.round(y - 1.5 + s * k), L[1]);
    }

    // Stubby feet with cream claws.
    for (const x of [CX - 45, CX + 13]) {
      const foot = cv.mask().rrect(x, 186, 32, 14, [7, 7, 5, 5]);
      part(cv, foot, G, { top: [5], left: [4], bottom: [1], right: [2], fill: 3, dy: 1 });
      cv.tone(foot.erode(1).sub(foot.erode(1).shift(3, 3)), 1).tone(foot.erode(1).sub(foot.erode(1).shift(-4, -3)), -1);
      for (const cx of [x + 7, x + 15, x + 23]) sprite(cv, cx, 196, ['.cc.', 'cCCc'], { c: Cr[2], C: Cr[4] });
    }

    // A sparkle by the upper-left plate and a little heart by the head plates.
    sparkle(cv, 24, 30, 2, O[4], '#ffffff');
    const heart = spriteMask(cv, 172, 22, SHAPES.heart);
    cv.outline(INK, heart).shade(heart, PK, { top: [2], left: [1], bottom: [0], right: [0], fill: 1 });
    cv.set(174, 24, '#ffffff');

    // Tail tip wag: move the differing pixels of frame A onto layer wa, frame B onto layer wb.
    const wa = cv.layer('wa'), wb = cv.layer('wb');
    for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
      const a = tA.get(x, y), b = tB.get(x, y);
      if (a === b || cv.get(x, y) !== a) continue;
      wa.set(x, y, a); wb.set(x, y, b); cv.set(x, y, null);
    }

    return cv.punch(...HOLE, HR);
  },
};
