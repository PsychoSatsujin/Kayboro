// Kitty monitor: cream retro CRT with ginger tabby ears, whiskers, a pink nose on the chin, paws on
// the stand, a curling tail, a fish sticker and a blinking power LED.
import { Canvas } from '../pixel.mjs';
import { INK, inset, part, sprite, spriteMask, slots, led } from '../kit.mjs';

const W = 256, H = 232, HOLE = [36, 48, 160, 120], HR = 4; // 4:3
const Cr = ['#5a4636', '#8f765c', '#c2a882', '#e3d0ae', '#f4e8d0', '#fffaf0']; // cream plastic
const Gi = ['#6a2a14', '#a8481e', '#e0762e', '#ff9f4a', '#ffc58a']; // ginger
const Pk = ['#8a2a4a', '#d0507a', '#ff8fb0', '#ffc2d4']; // pink
const T = ['#0e0b14', '#1c1724', '#2a2334', '#3a3146', '#4c4259']; // glass
const Fi = ['#1b4f7a', '#2f86b8', '#5cc2e8', '#a8ecff']; // fish sticker

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

const ear = (cv, tip, a, b, inner) => {
  const m = cv.mask().poly([tip, a, b]);
  cv.outline(INK, m, { all: true });
  cv.shade(m, Gi, { top: [4], left: [3], bottom: [1], right: [1], fill: 2 });
  const k = cv.mask().poly(inner);
  cv.grad(k, [Pk[1], Pk[2], Pk[3]], { soft: 0.6 });
  return m;
};

export default {
  id: 'px-cat-monitor', name: 'Kitty Monitor', theme: 'cat', rarity: 'rare', translucent: false,
  tags: ['cat', 'kawaii', 'monitor', 'retro', 'animated', 'pixel'],
  css: '.led{animation:led 2s steps(1) infinite}@keyframes led{0%,80%{opacity:1}81%,100%{opacity:0}}' +
    '',
  draw() {
    const cv = new Canvas(W, H);
    cv.use(Cr, Gi, Pk, T, Fi);

    // Tail curling up from behind the stand.
    const path = spline([[166, 214], [204, 220], [232, 212], [243, 192], [244, 170], [248, 153], [243, 142]]);
    const tail = cv.mask();
    path.forEach(([x, y], i) => tail.circle(Math.round(x), Math.round(y), i > path.length * 0.9 ? 4 : 5));
    cv.outline(INK, tail, { all: true });
    cv.shade(tail, Gi, { top: [4], left: [3], bottom: [0], right: [1], fill: 2 });
    for (const f of [0.42, 0.55, 0.68, 0.8]) { // tabby bands across the tail
      const [x, y] = path[Math.round(f * (path.length - 1))], [nx, ny] = path[Math.round(f * (path.length - 1)) + 1];
      const l = Math.hypot(nx - x, ny - y) || 1, px = -(ny - y) / l * 6, py = (nx - x) / l * 6;
      cv.fill(cv.mask().capsule(Math.round(x - px), Math.round(y - py), Math.round(x + px), Math.round(y + py), 0.8).and(tail.erode(1)), Gi[1]);
    }
    const tip = tail.and(cv.mask().circle(244, 143, 6));
    cv.fill(tip, Cr[4]).fill(tip.edge().and(cv.mask().rect(0, 146, W, 9)), Cr[2]);

    // Stand: neck, base, paws with toe beans.
    part(cv, cv.mask().rect(96, 190, 40, 14), Cr, { top: [2], left: [3], bottom: [1], right: [1], fill: 2, shadow: false });
    part(cv, cv.mask().rrect(58, 202, 116, 20, 7), Cr, { top: [5], left: [4], bottom: [1], right: [2], fill: 3 });
    for (const x of [94, 138]) {
      const paw = cv.mask().oval(x - 9, 210, 19, 14);
      part(cv, paw, Cr, { top: [5], left: [5], bottom: [2], right: [3], fill: 4, dy: 1 });
      cv.rect(x - 3, 211, 1, 4, Cr[2]).rect(x + 3, 211, 1, 4, Cr[2]);
      sprite(cv, x - 4, 215, ['.p.p.p.', '.......', '..ppp..', '.ppppp.'], { p: Pk[2] });
    }

    // Ears, then the monitor body.
    ear(cv, [40, 2], [24, 40], [84, 34], [[41, 12], [32, 34], [70, 32]]);
    ear(cv, [192, 2], [148, 34], [208, 40], [[191, 12], [162, 32], [200, 34]]);
    const body = cv.mask().rrect(14, 28, 204, 164, 14);
    part(cv, body, Cr, { top: [5, 4], left: [4], bottom: [0, 1], right: [1], fill: 3, shadow: false });
    sprite(cv, 64, 24, ['kkk.....kkk', 'kPpkk.kkppk', 'kPppkkkpppk', 'kpppkPkpppk', 'kpppkkkpppk', 'kppkk.kkpdk', 'kkk.....kkk'],
      { k: INK, p: Pk[2], P: Pk[3], d: Pk[1] }); // bow
    slots(cv, 30, 32, 14, 2, 3, Cr[1], Cr[5]);
    slots(cv, 188, 32, 14, 2, 3, Cr[1], Cr[5]);

    // Recessed bezel and glass.
    const bezel = cv.mask().rrect(26, 40, 180, 138, 9);
    cv.shade(bezel, Cr, { top: [1], left: [1], bottom: [5], right: [4], fill: 2 });
    cv.shade(cv.mask().rrect(31, 44, 170, 129, 7), T, { top: [0], left: [0], bottom: [3], right: [2], fill: 1 });
    inset(cv, ...HOLE, HR, { rim: INK, top: T[1], bottom: T[3], right: T[2] }, 1);
    cv.px([[33, 50], [33, 49], [34, 48], [35, 47], [36, 46], [37, 46]], T[4]);

    // Chin: nose, mouth, blush, floppy slot, power LED.
    sprite(cv, 113, 179, ['kkkkkkk', 'kpppPpk', '.kpppk.', '..kpk..', '...k...'], { k: INK, p: Pk[2], P: Pk[3] });
    sprite(cv, 113, 184, ['...k...', 'k..k..k', '.kk.kk.'], { k: INK });
    for (const x of [90, 132]) cv.dither(cv.mask().oval(x, 182, 10, 5), Cr[3], Pk[2], 0.5);
    cv.rect(160, 181, 34, 5, Cr[1]).rect(161, 182, 32, 3, T[1]).rect(162, 183, 30, 1, INK);
    part(cv, cv.mask().rect(186, 187, 6, 3), Cr, { top: [5], left: [4], bottom: [1], right: [2], fill: 3 });
    led(cv, 32, 182, ['#0b3a22', '#2fd07a', '#9dffc8', '#f0fff6'], { d: 3 });
    cv.layer('led').fill(cv.mask().oval(31, 181, 5, 5, 1.6), '#9dffc8').set(32, 182, '#ffffff');
    cv.text('NEKO', 38, 182, Cr[1]);

    // Fish sticker on the brow.
    const fish = ['...####.....', '.#########.#', '#e#########.', '############', '.#########.#', '...####.....'];
    const fm = spriteMask(cv, 160, 30, fish), die = fm.dilate(1);
    cv.cast(die, 1, 1, -2).fill(die, '#f6f0ff');
    cv.shade(fm, Fi, { top: [3], left: [2], bottom: [0], right: [1], fill: 2 });
    sprite(cv, 160, 30, fish, { e: INK });

    cv.outline(INK);
    // Whiskers poke out past the cheeks (drawn after the outline so they stay 1px).
    for (const s of [-1, 1]) for (const [y0, y1] of [[150, 144], [155, 155], [160, 166]]) {
      const x0 = s < 0 ? 20 : 211, x1 = s < 0 ? 2 : 229;
      cv.fill(cv.mask().line(x0, y0, x1, y1), INK);
    }
    return cv.punch(...HOLE, HR);
  },
};
