// Blue Cel Robo Buddy: a friendly retro-futuristic robot whose face visor is the screen. Dome head
// with antenna ears and a little radar dish, bolted chrome-blue armour plates under dithered cobalt-to-
// cyan gradients and hard cel shadow bands, accordion-hose arms with claw hands holding the visor frame,
// a chest panel with a reel-to-reel memory window and orange indicator lights, jet-pack fins behind and
// chunky treads underneath.
import { Canvas, bayer } from '../pixel.mjs';
import { INK, inset, led, sparkle } from '../kit.mjs';

const W = 240, H = 272, HOLE = [56, 50, 128, 96], HR = 6; // 4:3
// navy -> cobalt -> azure -> cyan -> ice (shared with the Blue Cel set)
const B = ['#0a1140', '#111d68', '#18308f', '#2149bb', '#2d6ade', '#4790f2', '#6cb8fd', '#a3dfff', '#e0f6ff'];
const K = ['#04263a', '#0a4560', '#1fb2dc', '#7eefff', '#e6feff']; // cyan glass / readouts
const O = ['#5c1f08', '#c85a14', '#ff9636', '#ffd49a']; // the one warm accent: orange indicator lights
const WHITE = '#ffffff';

/**
 * Cel-shade a volume: dithered vertical gradient (top -> bottom colors), one hard flat core-shadow
 * crescent on the lower right, a 1px lit top-left edge, ink outline and a 1px drop shadow.
 */
function cel(cv, m, grad, { shadow, k = 3, hi, rim, drop = true, ink = true, soft = 0.6 } = {}) {
  if (drop) cv.cast(m.dilate(1), 1, 1, -1);
  if (grad.length > 1) cv.grad(m, grad, { soft }); else cv.fill(m, grad[0]);
  const core = m.sub(m.shift(-k, -k));
  if (shadow) cv.fill(core, shadow);
  if (rim) cv.fill(m.sub(m.shift(-1, 0)).and(core).sub(m.sub(m.shift(0, -1))), rim);
  if (hi) cv.fill(m.sub(m.shift(1, 1)).sub(core), hi);
  if (ink) cv.outline(INK, m, { all: true });
  return core;
}

/** Pixel arc (degrees, 0 = right, 90 = down) for specular slivers. */
function arc(cv, cx, cy, rx, ry, a0, a1, c, clip) {
  for (let a = a0; a <= a1; a += 0.5) {
    const t = (a * Math.PI) / 180, x = Math.round(cx + rx * Math.cos(t)), y = Math.round(cy + ry * Math.sin(t));
    if (!clip || clip.has(x, y)) cv.set(x, y, c);
  }
}

/** Little hex-ish bolt head, lit from the top-left. */
function bolt(cv, x, y) {
  cv.px([[x + 1, y], [x, y + 1]], B[8]).px([[x + 2, y], [x + 1, y + 1], [x, y + 2]], B[6]);
  cv.px([[x + 2, y + 1], [x + 1, y + 2]], B[3]).set(x + 2, y + 2, B[1]);
  cv.px([[x + 1, y + 3], [x + 3, y + 1], [x + 2, y + 3], [x + 3, y + 2]], B[2]);
}

/** Cubic bezier point. */
const bez = (p, t) => {
  const u = 1 - t;
  return [0, 1].map((i) => u * u * u * p[0][i] + 3 * u * u * t * p[1][i] + 3 * u * t * t * p[2][i] + t * t * t * p[3][i]);
};

/** Accordion hose along a bezier: stacked cel-shaded rings, each with a dark ridge on its lower right. */
function hose(cv, p, r) {
  const pts = [];
  let last = null;
  for (let i = 0; i <= 400; i++) {
    const q = bez(p, i / 400);
    if (!last || Math.hypot(q[0] - last[0], q[1] - last[1]) >= 3) { pts.push(q); last = q; }
  }
  let all = cv.mask();
  for (const [x, y] of pts) all = all.or(cv.mask().circle(Math.round(x), Math.round(y), r));
  cv.cast(all.dilate(1), 1, 1, -1);
  for (const [x, y] of pts) {
    const d = cv.mask().circle(Math.round(x), Math.round(y), r);
    cv.fill(d, B[5]);
    cv.fill(d.sub(d.shift(-2, -2)), B[3]);
    cv.fill(d.sub(d.shift(-1, -1)), B[1]);
    cv.fill(d.sub(d.shift(1, 1)).sub(d.sub(d.shift(-2, -2))), B[7]);
  }
  cv.outline(INK, all, { all: true });
  return all;
}

/** A claw hand (left side; mirrored for the right): wrist cuff, palm, and a pincer hooked over the head edge. */
function claw(cv, flip) {
  const fx = (m) => (flip ? m.mirror().sub(m) : m);
  const X = (x) => (flip ? W - 1 - x : x);
  const cuff = fx(cv.mask().rrect(6, 148, 14, 10, 3));
  cel(cv, cuff, [B[4], B[3]], { shadow: B[1], k: 2, hi: B[6] });
  const up = fx(cv.mask().capsule(16, 131, 28, 129, 3.4).or(cv.mask().capsule(28, 129, 35, 134, 2.6)));
  const lo = fx(cv.mask().capsule(16, 147, 28, 149, 3.4).or(cv.mask().capsule(28, 149, 35, 144, 2.6)));
  for (const m of [lo, up]) cel(cv, m, [B[8], B[6], B[5]], { shadow: B[3], k: 2, hi: WHITE });
  const palm = fx(cv.mask().rrect(4, 126, 18, 26, [9, 6, 6, 9]));
  cel(cv, palm, [B[8], B[7], B[6], B[5], B[4]], { shadow: B[3], k: 3, hi: WHITE });
  // Knuckle hinge pin and a glossy glint.
  const pin = fx(cv.mask().circle(14, 138, 3));
  cv.fill(pin, B[3]).fill(pin.sub(pin.shift(1, 1)), B[7]);
  cv.outline(INK, pin, { all: true });
  cv.set(X(14) - 1, 137, WHITE).set(X(14) + 1, 139, B[1]);
  const px0 = flip ? W - 22 : 4; // palm's top-left corner, lit on both sides
  cv.px([[px0 + 4, 129], [px0 + 3, 130], [px0 + 3, 131]], WHITE);
  cv.px([[X(30) - (flip ? 1 : 0), 130], [X(30) - (flip ? 1 : 0), 148]], B[8]);
}

export default {
  id: 'px-cel-scifi', name: 'Robo Buddy', theme: 'robot', rarity: 'rare', translucent: false,
  collection: 'blue-cel', license: 'CC-BY-4.0',
  desc: 'A cheerful cel-shaded robot pal holds its visor steady so your game can glow right on its face.',
  tags: ['robot', 'sci-fi', 'cel-shaded', 'blue', 'retro-future', 'animated'],
  css: '.blink{animation:bl 1.4s steps(1) infinite}@keyframes bl{50%{opacity:0}}' +
    '.sq{animation:sq 2s steps(1) infinite;opacity:0}@keyframes sq{0%,24%{opacity:1}25%,100%{opacity:0}}' +
    '.d1{animation-delay:.5s}.d2{animation-delay:1s}.d3{animation-delay:1.5s}',
  draw() {
    const cv = new Canvas(W, H);
    cv.use(B, K, O);

    // Dithered floor shadow under the treads.
    const floor = cv.mask().oval(30, 256, 180, 12);
    cv.fill(floor, (x, y) => {
      const d = ((x + 0.5 - 120) / 90) ** 2 + ((y + 0.5 - 262) / 6) ** 2;
      return d < 0.45 || bayer(x, y) < 1.15 - d ? INK : undefined;
    });

    // Antenna ears: thin rods rising from the ear caps to blinking orange tips.
    for (const flip of [false, true]) {
      const X = (x) => (flip ? W - 1 - x : x);
      const rod = cv.mask().line(X(16), 70, X(8), 24).or(cv.mask().line(X(17), 70, X(9), 24));
      cv.fill(rod, B[5]);
      cv.fill(cv.mask().line(X(16), 70, X(8), 24), flip ? B[4] : B[7]);
      cv.outline(INK, rod, { all: true });
      const tip = cv.mask().circle(X(8), 19, 4);
      cel(cv, tip, [O[2], O[1]], { shadow: O[0], k: 2, hi: O[3] });
      cv.set(X(8) - 1, 17, WHITE);
    }

    // Radar dish on a short mast, tipped toward the upper right with its feed horn sticking out.
    const mast = cv.mask().rect(117, 12, 6, 14);
    cel(cv, mast, [B[6], B[4]], { shadow: B[2], k: 2, hi: B[8], drop: false });
    cv.rect(113, 21, 14, 4, B[3]).rect(113, 21, 14, 1, B[7]).rect(113, 22, 1, 2, B[6]);
    cv.outline(INK, cv.mask().rect(113, 21, 14, 4), { all: true });
    const rot = (cx, cy, rx, ry, a) => cv.mask().plot((x, y) => {
      const dx = x + 0.5 - cx, dy = y + 0.5 - cy, c = Math.cos(a), s = Math.sin(a);
      return ((dx * c + dy * s) / rx) ** 2 + ((-dx * s + dy * c) / ry) ** 2 <= 1;
    });
    const tilt = -0.3;
    const dish = rot(120, 9, 16, 6.5, tilt);
    cel(cv, dish, [B[8], B[7], B[6], B[4]], { shadow: B[3], k: 2, hi: WHITE, drop: false });
    const face = rot(119, 7.5, 13, 4, tilt).and(dish.erode(1));
    cv.grad(face, [B[2], B[3], B[4], B[5]], { dir: 'h', soft: 0.8 });
    cv.fill(face.sub(face.shift(0, 1)), B[0]);
    cv.fill(face.sub(face.shift(0, -1)), B[5]);
    const feed = cv.mask().line(120, 8, 126, 3).or(cv.mask().line(121, 8, 127, 3));
    cv.fill(feed, B[7]);
    cv.outline(INK, feed, { all: true });
    const horn = cv.mask().circle(128, 2, 2);
    cv.fill(horn, B[6]).set(127, 1, WHITE).set(129, 3, B[3]);
    cv.outline(INK, horn, { all: true });

    // Jet-pack peeking out behind the torso: twin thrusters with swept fins.
    for (const flip of [false, true]) {
      const fx = (m) => (flip ? m.mirror().sub(m) : m);
      const fin = fx(cv.mask().poly([[54, 206], [34, 226], [32, 240], [40, 240], [56, 230]]));
      cel(cv, fin, [B[6], B[5], B[4]], { shadow: B[2], k: 3, hi: B[8] });
      const tank = fx(cv.mask().rrect(46, 198, 22, 38, 9));
      cel(cv, tank, [B[6], B[5], B[4], B[3]], { shadow: B[2], k: 4, hi: B[8] });
      const noz = fx(cv.mask().rrect(50, 236, 14, 6, [0, 0, 3, 3]));
      cel(cv, noz, [B[2], B[1]], { shadow: B[0], k: 1, hi: B[4] });
    }

    // Treads: dark rubber belt with lit cleats and bright hub wheels.
    const tread = cv.mask().rrect(48, 238, 144, 22, 11);
    cel(cv, tread, [B[2], B[1]], { shadow: B[0], k: 3, hi: B[4] });
    for (let x = 54; x < 188; x += 6) cv.fill(cv.mask().rect(x, 239, 3, 2).and(tread.erode(1)), B[3]);
    for (let x = 54; x < 188; x += 6) cv.fill(cv.mask().rect(x + 1, 256, 3, 2).and(tread.erode(1)), B[0]);
    for (const x of [62, 89, 116, 143, 170]) {
      const w = cv.mask().circle(x + 4, 249, 5);
      cel(cv, w, [B[7], B[5], B[4]], { shadow: B[3], k: 2, hi: B[8], drop: false });
      cv.fill(cv.mask().circle(x + 4, 249, 1), B[1]);
      cv.set(x + 3, 248, B[2]);
    }

    // Torso.
    const torso = cv.mask().rrect(64, 178, 112, 66, [12, 12, 18, 18]);
    cel(cv, torso, [B[7], B[6], B[5], B[4], B[3]], { shadow: B[2], k: 6, hi: B[8], rim: B[4] });
    cv.fill(torso.and(cv.mask().rect(64, 232, 112, 1)), B[2]);
    cv.fill(torso.and(cv.mask().rect(64, 233, 112, 1)).sub(torso.sub(torso.shift(-6, -6))), B[6]);
    // Chest panel: recessed, with the reel-to-reel memory window and indicator lights.
    const panel = cv.mask().rrect(78, 188, 84, 40, 6);
    cv.fill(panel, B[2]);
    cv.fill(panel.sub(panel.shift(2, 2)), B[0]);
    cv.fill(panel.sub(panel.shift(-1, -1)), B[6]);
    cv.outline(INK, panel, { all: true });
    const win = cv.mask().rrect(83, 193, 50, 24, 5);
    cv.fill(win, K[0]);
    cv.fill(win.sub(win.shift(1, 1)), INK);
    for (const [x, y] of [[96, 205], [120, 205]]) {
      const reel = cv.mask().circle(x, y, 8);
      cv.fill(reel, B[2]);
      cv.fill(reel.sub(cv.mask().circle(x, y, 6)), B[1]);
      cv.fill(cv.mask().circle(x, y, 2), B[6]).set(x, y, INK);
      for (const [dx, dy] of [[0, -4], [4, 2], [-4, 2]]) cv.fill(cv.mask().circle(x + dx, y + dy, 1), INK);
      cv.fill(reel.sub(reel.shift(1, 1)), B[4]);
    }
    cv.rect(96, 213, 25, 1, K[1]); // tape strand under the reels
    cv.px([[86, 196], [87, 196], [86, 197]], K[4]).rect(90, 195, 6, 1, K[2]);
    // Mini level meter beside the window.
    for (let i = 0; i < 3; i++) {
      const x = 139 + i * 7, h = [14, 9, 18][i];
      cv.rect(x, 194, 4, 20, INK);
      cv.rect(x + 1, 213 - h, 2, h, K[2]);
      cv.set(x + 1, 213 - h, K[4]);
    }
    // Orange indicator lights: dim base row, then a running sequence on top.
    for (let i = 0; i < 4; i++) {
      const x = 85 + i * 8;
      cv.fill(cv.mask().oval(x, 220, 5, 5, 1.1), O[0]);
      cv.set(x + 1, 221, O[1]);
      led(cv.layer(`sq d${i}`), x, 220, [O[1], O[2], O[3], WHITE], { d: 5 });
    }
    cv.text('KAYBORO', 125, 220, B[6]);
    // Shoulder joints and plate bolts.
    for (const x of [68, 167]) bolt(cv, x, 212);

    // Accordion-hose arms from the shoulders round to the claws.
    for (const flip of [false, true]) {
      const X = (x) => (flip ? W - 1 - x : x);
      hose(cv, [[X(66), 196], [X(34), 214], [X(8), 198], [X(14), 154]], 5);
      const sh = cv.mask().circle(X(66), 194, 7);
      cel(cv, sh, [B[7], B[5], B[4]], { shadow: B[2], k: 2, hi: B[8] });
      cv.set(X(66) - 2, 191, WHITE);
    }

    // Dome head.
    const head = cv.mask().rrect(20, 24, 200, 154, [64, 64, 22, 22]);
    cel(cv, head, [B[8], B[7], B[6], B[5], B[4], B[3]], { shadow: B[2], k: 8, hi: B[8], rim: B[4], soft: 0.5 });
    // Forehead armour plate seam with bolts.
    const seam = head.erode(3).and(cv.mask().rect(0, 34, W, 1));
    cv.fill(seam, B[4]).fill(seam.shift(0, 1).and(head.erode(3)), B[8]);
    for (const x of [52, 184]) bolt(cv, x, 38);
    for (const x of [30, 206]) bolt(cv, x, 108);
    // Anime gloss: a hard crescent sliver round the dome's top-left, plus glints.
    const band = head.erode(2);
    arc(cv, 80, 84, 56, 56, 196, 256, B[8], band);
    arc(cv, 80, 84, 55, 55, 200, 252, B[8], band);
    arc(cv, 80, 84, 56, 56, 212, 238, WHITE, band);
    cv.rect(92, 27, 22, 1, WHITE).rect(130, 27, 4, 1, WHITE).rect(137, 27, 1, 1, WHITE);
    cv.rect(23, 96, 1, 22, B[8]);

    // Ear caps over the antenna roots.
    for (const flip of [false, true]) {
      const fx = (m) => (flip ? m.mirror().sub(m) : m);
      const cap = fx(cv.mask().rrect(8, 66, 20, 34, 8));
      cel(cv, cap, [B[7], B[6], B[5], B[4]], { shadow: B[2], k: 3, hi: B[8] });
      const ring = fx(cv.mask().rrect(12, 72, 10, 22, 4));
      cv.fill(ring, B[2]).fill(ring.sub(ring.shift(1, 1)), B[1]).fill(ring.sub(ring.shift(-1, -1)), B[5]);
      cv.outline(INK, ring, { all: true });
      for (let y = 76; y < 92; y += 3) cv.fill(fx(cv.mask().rect(15, y, 4, 1)), B[0]);
    }

    // Visor: raised ice bezel, then the dark glass sloping into the screen.
    const bezel = cv.mask().rrect(44, 38, 152, 120, 16);
    cel(cv, bezel, [B[8], B[7], B[6]], { shadow: B[4], k: 2, hi: WHITE });
    const glass = cv.mask().rrect(48, 42, 144, 112, 13);
    cv.fill(glass, (x, y) => (y % 2 ? B[1] : '#0f1a5c'));
    cv.fill(glass.sub(glass.shift(2, 2)), B[0]);
    cv.fill(glass.sub(glass.shift(-1, -1)), B[3]);
    cv.outline(INK, glass, { all: true });
    inset(cv, ...HOLE, HR, { rim: INK, top: B[0], left: B[0], bottom: B[2], right: B[2] }, 2);
    const lip = glass.erode(1).sub(cv.mask().rrect(HOLE[0] - 4, HOLE[1] - 4, HOLE[2] + 8, HOLE[3] + 8, HR + 4));
    arc(cv, 60, 54, 10, 10, 190, 262, B[7], lip);
    arc(cv, 60, 54, 10, 10, 214, 240, WHITE, lip);
    cv.fill(lip.and(cv.mask().rect(78, 44, 14, 2)), B[5]).fill(lip.and(cv.mask().rect(96, 44, 4, 2)), B[5]);

    // Happy smile grille and glowing orange cheek lights under the visor.
    const smile = cv.mask();
    for (let x = 108; x <= 131; x++) {
      const y = 162 + Math.round(4 * (1 - ((x - 119.5) / 12) ** 2));
      smile.rect(x, y, 1, 2);
    }
    cv.fill(smile.shift(0, 1).sub(smile), B[6]).fill(smile, INK);
    for (const x of [62, 168]) {
      const ch = cv.mask().oval(x, 162, 10, 5, 1.1);
      cv.glow(cv.mask().oval(x - 3, 159, 16, 11).sub(ch), x + 5, 164.5, 8, 1);
      cv.fill(ch, O[2]).fill(ch.sub(ch.shift(-1, -1)), O[1]);
      cv.rect(x + 2, 162, 3, 1, O[3]).set(x + 1, 163, O[3]);
      cv.outline(INK, ch, { all: true });
    }

    // Claw hands gripping the visor frame.
    claw(cv, false);
    claw(cv, true);

    // Blinking antenna tips.
    const bl = cv.layer('blink');
    for (const x of [8, W - 9]) {
      bl.fill(cv.mask().circle(x, 19, 2), O[3]);
      bl.set(x - 1, 18, WHITE);
    }

    // Anime sparkles.
    sparkle(cv, 30, 8, 2, B[7], WHITE);
    sparkle(cv, 220, 40, 1, B[7], WHITE);
    sparkle(cv, 206, 10, 1, B[6], B[8]);

    cv.outline(INK);
    return cv.punch(...HOLE, HR);
  },
};
