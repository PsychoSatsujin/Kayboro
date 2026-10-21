// Lottie's Bubble Tank: an original chibi axolotl girl peeks over the top of her clear aqua pet tank.
// Pink bob with clumped bangs and an anime shine ring, three feathery coral gill fronds fanned out on
// each side of her head (they flutter), big teal eyes that blink, blush and a wide axolotl smile; her
// hands grip the tank's rim. The tank is tinted see-through plastic (her chin and hair show through it,
// tinted), with a floating crescent glare band, round glints, seaweed, rising bubbles that twinkle and
// pink pearl buttons.
import { Canvas, alpha, mix } from '../pixel.mjs';
import { INK, SHAPES, inset, part, sprite, spriteMask, sparkle } from '../kit.mjs';

const W = 224, H = 284, HOLE = [40, 96, 144, 144], HR = 5; // 1:1
const CX = 112; // symmetry axis (pixel-edge coordinate)
const TY = 179, TA = 100, TB = 99, TP = 4.4; // tank: superellipse centre y, half-width, half-height, exponent

const E = ['#0b4256', '#11707f', '#1a9aa6', '#36c0c2', '#6edbd5', '#aef1e8', '#e6fffa']; // aqua plastic
const Hr = ['#7d3462', '#b9638f', '#e693b7', '#ffbfd6', '#fff0f6']; // pink hair
const Gl = ['#7c1438', '#bd2a58', '#ee4f7c', '#ff86a6', '#ffc0d0']; // coral gills, pearl buttons
const Sk = ['#b8685f', '#e6987f', '#ffcdb5', '#ffe6d8']; // skin
const Ey = ['#140f36', '#242a6a', '#1f6f96', '#2fb0b6', '#7fead6']; // teal anime eyes, top -> bottom
const Sw = ['#174a3a', '#23764f', '#3aa862', '#7ad67a']; // seaweed
const GL = '#ffffff', GL2 = '#d8fff6'; // opaque glare (kept out of the see-through pass)

// Tank: a plump superellipse ("mochi" tank), a touch wider at the bottom. d shrinks it inward.
const tankLvl = (x, y, d = 0) => {
  const v = (y + 0.5 - TY) / (TB - d), u = (x + 0.5 - CX) / ((TA - d) * (1 + 0.03 * v));
  return (Math.abs(u) ** TP + Math.abs(v) ** TP) ** (1 / TP);
};
const tank = (cv, d = 0) => cv.mask().plot((x, y) => tankLvl(x, y, d) <= 1);

// Pixel depth inside a mask (1 = edge), by repeated erosion.
function depthMap(m, max = 40) {
  const D = new Uint8Array(m.w * m.h);
  let cur = m;
  for (let k = 1; k <= max; k++) {
    cur.each((x, y) => { D[y * m.w + x] = k; });
    cur = cur.erode(1);
    if (!cur.bbox()) break;
  }
  return D;
}

// One feathery gill frond: a thin stalk that swells into a serrated leaf, bending by `bend`.
// core: just the central rib.
function frond(cv, bx, by, ang, L, w, bend = 0, core = false) {
  const c = Math.cos(ang), s = Math.sin(ang);
  return cv.mask().plot((x, y) => {
    const dx = x + 0.5 - bx, dy = y + 0.5 - by, u = dx * c + dy * s;
    if (u < 0 || u > L) return false;
    const f = u / L, v = -dx * s + dy * c - bend * f * f;
    if (core) return f < 0.82 && Math.abs(v) <= 0.6;
    const lens = w * Math.max(0, Math.sin(Math.PI * Math.min(1, Math.max(0, (f - 0.1) / 0.9)))) ** 0.55;
    const feather = 0.55 + 0.45 * Math.abs(Math.sin(u * 0.9));
    return Math.abs(v) <= Math.max(1.1, lens * feather);
  }, bx - L - w - 2, by - L - w - 2, bx + L + w + 2, by + L + w + 2);
}

// Piecewise-linear y at x through [[x, y], ...] (sorted by x).
const polyY = (P, x) => {
  if (x <= P[0][0]) return P[0][1];
  for (let i = 1; i < P.length; i++) if (x <= P[i][0]) {
    const [x0, y0] = P[i - 1], [x1, y1] = P[i];
    return y0 + ((y1 - y0) * (x - x0)) / (x1 - x0);
  }
  return P[P.length - 1][1];
};
// Bang clumps: alternating roots (high) and tips (low); longer between the eyes and at the temples.
const BANGS = [[64, 66], [70, 50], [74, 58], [79, 45], [85, 53], [90, 43], [95, 50], [99, 40], [105, 54], [109, 44],
  [113, 57], [117, 44], [122, 52], [126, 41], [131, 50], [136, 42], [141, 53], [146, 45], [150, 59], [154, 48], [160, 66]];

// Gill fronds (left side; mirrored): base x, y, angle (deg), length, half-width, bend.
const GILLS = [[74, 30, -138, 34, 6, -3], [68, 42, -166, 40, 6.5, -3], [68, 55, 168, 34, 6, 3]];

const BUB = {
  1: ['#'],
  2: ['.#.', '#o#', '.#.'],
  3: ['.##.', '#o.#', '#..#', '.##.'],
  4: ['.###.', '#o..#', '#...#', '#...#', '.###.'],
};

// pose 0 / 1: the gills at rest / lifted (the flutter frames).
function paint(pose) {
  const cv = new Canvas(W, H);
  cv.use(E, Hr, Gl, Sk, Ey, Sw);

  // ---- Lottie (behind the tank) ------------------------------------------------------------
  // Gills: three feathery fronds per side, fanned up, out and down.
  let gills = cv.mask(), ribs = cv.mask();
  for (const [bx, by, deg, L, w, bend] of GILLS) {
    const a = ((deg + pose * 6) * Math.PI) / 180, b = bend - pose * 1.5;
    const m = frond(cv, bx, by, a, L, w, b), r = frond(cv, bx, by, a, L, w, b, true);
    gills = gills.or(m).or(m.mirror());
    ribs = ribs.or(r).or(r.mirror());
  }
  cv.shade(gills, Gl, { top: [4], left: [3], bottom: [1], right: [1], fill: 2 });
  cv.fill(ribs.and(gills.erode(1)), Gl[1]);
  cv.outline(INK, gills, { all: true });

  // Hair: a boxy bob, face, bangs, side locks.
  const head = cv.mask().plot((x, y) => Math.abs((x + 0.5 - CX) / 51) ** 2.5 + Math.abs((y + 0.5 - 52) / 44) ** 2.2 <= 1);
  const face = cv.mask().oval(CX - 34, 34, 68, 56);
  const bangs = head.and(cv.mask().plot((x, y) => y + 0.5 < polyY(BANGS, x + 0.5)));
  const lockL = cv.mask().poly([[63, 40], [80, 46], [83, 64], [81, 84], [77, 100], [72, 90], [67, 70]]);
  const locks = lockL.or(lockL.mirror());
  const hair = head.sub(face).or(bangs).or(locks);
  const ahoge = cv.mask().capsule(111, 12, 113, 4, 1).or(cv.mask().capsule(113, 4, 119, 1, 1)).or(cv.mask().capsule(119, 1, 122, 5, 0.9));
  const hairAll = head.or(locks).or(ahoge);
  cv.outline(INK, hairAll, { all: true });
  cv.fill(hairAll, Hr[3]);
  // Cel bands on the hair: shadow toward the bottom-right, a lit rim top-left.
  cv.fill(hair.sub(hair.shift(-5, -4)), Hr[2]);
  cv.fill(hair.sub(hair.shift(2, 2)), Hr[4]);
  cv.fill(locks.and(cv.mask().rect(0, 70, W, 40)), (x, y, c) => (c === Hr[3] ? Hr[2] : c));
  // Strand lines down to the deeper roots between the bang clumps.
  for (let i = 1; i < BANGS.length - 1; i++) {
    const [x, y] = BANGS[i];
    if (y > BANGS[i - 1][1] || y > BANGS[i + 1][1] || i % 4 === 3) continue;
    const t = (x - CX) / 46;
    cv.fill(cv.mask().line(Math.round(CX - 0.5 + t * 34), 31, x, y - 1).and(bangs.erode(1)), Hr[2]);
  }
  // Anime shine ring across the crown, broken by the strands, with a soft shade under it.
  const ringM = cv.mask().oval(CX - 40, 18, 80, 50).sub(cv.mask().oval(CX - 37, 21, 74, 50)).and(cv.mask().rect(0, 0, W, 32));
  const lit = ringM.and(cv.mask().plot((x, y) => cv.get(x, y) !== Hr[2]));
  cv.fill(ringM.shift(0, 1).sub(ringM).and(head.erode(2)).and(cv.mask().plot((x, y) => cv.get(x, y) === Hr[3])), Hr[2]);
  cv.fill(lit, Hr[4]);
  cv.fill(lit.and(cv.mask().rect(CX - 26, 0, 16, H)), GL);

  // Face: skin, a dark hair line along the bangs and locks, the shadow they cast.
  const skin = face.sub(bangs).sub(locks);
  cv.fill(skin, Sk[2]);
  cv.fill(skin.and(bangs.shift(0, 2)), Sk[1]);
  cv.fill(skin.and(locks.dilate(1)), Sk[1]);
  cv.fill(hair.and(skin.dilate(1)), Hr[0]);
  cv.outline(INK, hairAll, { all: false });

  // Bubble hair clip on her right bangs.
  for (const [x, y] of [[142, 33], [147, 38]]) {
    const b = cv.mask().circle(x, y, 2, 1.3);
    cv.outline(INK, b, { all: true });
    cv.fill(b, E[4]).set(x, y + 1, E[2]).set(x + 1, y, E[3]).set(x - 1, y - 1, GL);
  }

  // Closed eyes (seen when the open ones blink off): soft happy arcs.
  const EX = [CX - 26, CX + 11], EW = 15, EYT = 50;
  for (const x of EX) sprite(cv, x, EYT + 11, ['...kkkkkkkk....', '.kk........kk..', 'k............k.'], { k: INK }, { flip: x > CX });
  // Blush with little hatch lines, and a wide axolotl smile.
  for (const x of [CX - 35, CX + 21]) {
    cv.dither(cv.mask().oval(x, 67, 14, 5), Gl[3], Gl[4], 0.4);
    for (const k of [4, 7, 10]) cv.set(x + k, 69, Gl[2]).set(x + k + 1, 68, Gl[2]);
  }
  sprite(cv, CX - 4, 73, ['k..kk..k', '.kk..kk.'], { k: INK });

  // ---- the tank ---------------------------------------------------------------------------
  const snap = cv.p.slice(); // what is behind the plastic
  const body = tank(cv), D = depthMap(body);
  cv.cast(body.dilate(1), 1, 2, -1);
  cv.grad(body, [E[5], E[4], E[4], E[3]], { dir: { cx: CX - 80, cy: TY - 80, r: 250 }, soft: 0.01 });
  cv.fill(body.sub(body.shift(-6, -5)), E[2]); // cel shadow band, bottom-right
  cv.fill(body.sub(body.shift(-2, -2)), E[1]);
  cv.fill(body.sub(body.shift(1, 1)), E[6]); // lit rim
  // Lottie seen through the plastic: tinted, opaque.
  body.each((x, y) => { const c = snap[y * W + x]; if (c) cv.set(x, y, mix(c, cv.get(x, y), 0.5)); });
  // See-through pass: the thick rim stays denser than the flat faces.
  cv.fill(body, (x, y, c) => (E.includes(c) ? alpha(c, D[y * W + x] <= 2 ? 0.95 : 0.72) : c));

  // Floating crescent glare band hugging the upper-left curve, tapering at both ends (bands between
  // two inset copies of the tank outline, so both edges stay parallel to the body).
  const ang = (x, y) => (Math.atan2(y + 0.5 - TY, x + 0.5 - CX) * 180) / Math.PI;
  const band = (a0, span, d0, tMax) => body.and(cv.mask().plot((x, y) => {
    const a = ang(x, y), f = ((((a - a0) % 360) + 360) % 360) / span;
    if (f > 1) return false;
    return tankLvl(x, y, d0) <= 1 && tankLvl(x, y, d0 + 0.5 + tMax * Math.sin(Math.PI * f) ** 0.8) > 1;
  }));
  cv.fill(band(176, 76, 4, 5.4), GL); // from just below the left middle round to -108deg
  cv.fill(band(-170, 26, 11.5, 1.2), GL); // a short second streak inside it
  // Reflected light: a thin arc on the lower right.
  cv.fill(body.and(cv.mask().plot((x, y) => { const a = ang(x, y); return a > 10 && a < 58 && D[y * W + x] === 4; })), GL2);
  // Round glints, upper right.
  cv.fill(cv.mask().oval(194, 104, 6, 8), GL);
  cv.rect(196, 117, 2, 2, GL);

  // Seaweed swaying up from the bottom corners.
  const weed = (x0, y0, len, ph, dir) => {
    const m = cv.mask();
    for (let k = 0; k <= len; k++) {
      const r = 2.1 - (1.1 * k) / len, x = x0 + dir * (Math.sin(k * 0.32 + ph) * 2.2 + k * 0.08);
      m.circle(Math.round(x), y0 - k, Math.max(0.6, r), 1.4);
    }
    return m.and(body.erode(3));
  };
  let weeds = cv.mask();
  for (const [x, y, l, p, d] of [[24, 268, 34, 0, 1], [31, 271, 20, 2, 1], [199, 268, 30, 1, -1], [192, 272, 16, 3, -1]]) weeds = weeds.or(weed(x, y, l, p, d));
  weeds = weeds.sub(cv.mask().rrect(HOLE[0] - 6, HOLE[1] - 6, HOLE[2] + 12, HOLE[3] + 12, HR + 6));
  cv.fill(weeds, Sw[2]);
  cv.fill(weeds.sub(weeds.shift(1, 0)), Sw[3]);
  cv.fill(weeds.sub(weeds.shift(-1, 0)), Sw[1]);

  // Screen bezel: a denser plastic lip and the recessed rim.
  const lip = cv.mask().rrect(HOLE[0] - 5, HOLE[1] - 5, HOLE[2] + 10, HOLE[3] + 10, HR + 5);
  cv.fill(lip, (x, y) => alpha(x + y < HOLE[0] + HOLE[1] + 70 ? E[5] : E[3], 0.94));
  cv.fill(lip.sub(lip.shift(1, 1)), GL2);
  inset(cv, ...HOLE, HR, { rim: INK, top: E[0], left: E[1], bottom: E[4], right: E[3] }, 2);

  // Bubbles rising in the plastic (some twinkle).
  const tw = cv.layer('tw'), tw2 = cv.layer('tw2');
  for (const [x, y, r, l] of [[18, 230, 4, 0], [25, 218, 2, 1], [19, 202, 3, 0], [26, 188, 1, 0], [27, 172, 2, 2], [29, 158, 1, 1], [27, 140, 3, 0],
    [199, 226, 3, 0], [196, 212, 2, 2], [198, 196, 4, 0], [197, 180, 1, 1], [200, 166, 2, 0], [197, 150, 3, 0], [199, 134, 1, 2],
    [60, 270, 2, 2], [166, 268, 3, 0]]) {
    const c = l === 1 ? tw : l === 2 ? tw2 : cv;
    sprite(c, x, y, BUB[r], { '#': r === 1 ? GL : alpha(E[6], 0.96), o: GL });
  }

  // Three pink pearl buttons: round, heart, round.
  for (const [x, y] of [[CX - 34, 260], [CX + 33, 260]]) {
    cv.fill(cv.mask().circle(x, y, 8), alpha(E[1], 0.9));
    part(cv, cv.mask().circle(x, y - 1, 6), Gl, { top: [4], left: [3], bottom: [0], right: [1], fill: 2, dy: 1 });
    cv.px([[x - 3, y - 5], [x - 4, y - 4], [x - 3, y - 4]], GL);
  }
  const heart = spriteMask(cv, CX - 5, 256, SHAPES.heart);
  cv.fill(heart.dilate(2), alpha(E[1], 0.9));
  part(cv, heart, Gl, { top: [4], left: [3], bottom: [0], right: [1], fill: 2, dy: 1 });
  cv.set(CX - 4, 257, GL);

  // Lottie's hands gripping the rim.
  for (const s of [-1, 1]) {
    const hx = s < 0 ? 51 : W - 51 - 16;
    const hand = cv.mask().rrect(hx, 73, 16, 13, [6, 6, 4, 4]);
    part(cv, hand, Sk, { top: [3], left: [3], bottom: [0], right: [1], fill: 2, dy: 1 });
    for (const k of [4, 8, 12]) cv.rect(hx + k, 80, 1, 5, Sk[0]);
  }

  // Twinkles in the air around her.
  sparkle(tw, 18, 14, 2, Gl[4], GL);
  sparkle(tw2, 206, 18, 2, E[5], GL);
  sparkle(cv, 36, 76, 1, E[5], GL);
  sparkle(cv, 190, 74, 1, Gl[4], GL);

  cv.outline(INK);
  // Open eyes on their own layer so they can blink off.
  const eyes = cv.layer('eyes');
  EX.forEach((x, i) => {
    const flip = i === 1, X = (k) => (flip ? x + EW - 1 - k : x + k);
    const eye = eyes.mask().oval(x, EYT, EW, 20);
    eyes.fill(eye, INK);
    eyes.grad(eye.erode(1), Ey.slice(1), { from: EYT + 4, to: EYT + 17, soft: 0.5 });
    eyes.fill(eye.sub(eye.shift(0, 3)), INK); // thick upper lash along the curve
    eyes.fill(eyes.mask().oval(x + 4, EYT + 6, 7, 9), Ey[0]); // pupil
    eyes.fill(eye.erode(1).sub(eye.erode(1).shift(0, -2)).and(eyes.mask().rect(0, EYT + 12, W, 9)), Ey[4]); // lit lower rim
    eyes.px([[X(-1), EYT + 3], [X(-2), EYT + 2], [X(-1), EYT + 2]], INK); // outer lash flick
    eyes.fill(eyes.mask().oval(X(3) - (flip ? 3 : 0), EYT + 4, 4, 6), GL);
    eyes.px([[X(10), EYT + 14], [X(11), EYT + 14], [X(10), EYT + 15], [X(11), EYT + 13]], GL);
    eyes.set(X(8), EYT + 6, GL);
  });
  return cv;
}

export default {
  id: 'px-pet-egg', name: "Lottie's Bubble Tank", theme: 'aquarium', rarity: 'common', translucent: true,
  desc: 'Lottie the axolotl girl peeks over her clear aqua pet tank, fluttering her gills and blinking at you while the bubbles twinkle.',
  tags: ['virtual-pet', 'axolotl', 'anime', 'kawaii', 'aquarium', 'clear-plastic', 'animated', 'pixel'],
  css: '.eyes{animation:bl 4.6s steps(1) infinite}@keyframes bl{0%,92%{opacity:1}93%,96%{opacity:0}97%{opacity:1}}' +
    '.tw{animation:tw 2.4s steps(1) infinite}.tw2{animation:tw 2.4s steps(1) -1.2s infinite}@keyframes tw{0%,58%{opacity:1}59%,100%{opacity:0}}' +
    '.ga{animation:ga 1.6s steps(1) infinite}@keyframes ga{50%{opacity:0}}' +
    '.gb{opacity:0;animation:gb 1.6s steps(1) infinite}@keyframes gb{50%{opacity:1}}',
  draw() {
    // Paint both gill poses; the pixels that differ move onto the two flutter layers.
    const cv = paint(0), b = paint(1), ga = cv.layer('ga'), gb = cv.layer('gb');
    for (let i = 0; i < cv.p.length; i++) {
      if (cv.p[i] === b.p[i]) continue;
      const x = i % W, y = (i - x) / W;
      ga.set(x, y, cv.p[i]); gb.set(x, y, b.p[i]); cv.p[i] = null;
    }
    return cv.punch(...HOLE, HR);
  },
};

// Palette arrays by name, for skins (tools/pixelart/skins) that redraw this shell in other colors.
export const PALETTES = { E, Hr, Gl, Sk, Ey, Sw };
