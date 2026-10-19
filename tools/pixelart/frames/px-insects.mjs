// Bug terrarium: a honey-wood specimen case whose glass front is the screen. A dragonfly and a
// butterfly perch on the vented lid, a stag beetle and a ladybug climb the stiles, a fuzzy
// caterpillar munches a leaf, a bee buzzes by a daisy and a line of ants marches along the plinth.
import { Canvas, rng, bayer, ramp } from '../pixel.mjs';
import { INK, inset, part, sprite, spriteMask } from '../kit.mjs';

const W = 240, H = 232, HOLE = [48, 66, 144, 108], HR = 3; // 4:3
const Wd = ramp('#b07a4a', 7, { step: 0.1, hue: 5, sat: 0.06 }); // honey wood
const Lf = ramp('#4f9a46', 6, { step: 0.12, hue: 8 }); // leaves
const Mo = ramp('#78b040', 5, { step: 0.12, hue: 8 }); // moss
const Sl = ramp('#7a5238', 5, { step: 0.1, hue: 6 }); // soil
const Br = ramp('#d4a03c', 5, { step: 0.12, hue: 8 }); // brass
const Pb = ramp('#9c94a8', 5, { step: 0.13, hue: 6 }); // pebbles
const Rd = ramp('#e0383c', 5, { step: 0.13, hue: 8 }); // ladybug
const Bt = ramp('#4e4a9c', 5, { step: 0.14, hue: 10 }); // stag beetle
const Bf = ramp('#f080c0', 5, { step: 0.12, hue: 8 }); // butterfly
const Df = ramp('#30b0b8', 5, { step: 0.13, hue: 8 }); // dragonfly
const Ye = ramp('#ffbe3a', 5, { step: 0.12, hue: 8 }); // bee / daisy heart
const Cp = ramp('#94cc44', 5, { step: 0.12, hue: 8 }); // caterpillar
const Wg = ['#6f9cc0', '#9fcbe6', '#cdeefc', '#f0fbff']; // gauzy wings
const PK = '#ff8fb0', WH = '#ffffff', CREAM = '#fff4d6';
const ANT = { d: '#4a1e2a', h: '#a04848', k: INK };

const RAISED = (R, f = R.length - 3) => ({ top: [R.length - 1], left: [R.length - 2], bottom: [0], right: [1], fill: f });

/** Pointed leaf from base (x0, y0) to tip (x1, y1), half-width wd at its widest. */
function leafMask(cv, x0, y0, x1, y1, wd) {
  const dx = x1 - x0, dy = y1 - y0, L2 = dx * dx + dy * dy, L = Math.sqrt(L2);
  return cv.mask().plot((x, y) => {
    const px = x + 0.5 - x0, py = y + 0.5 - y0, t = (px * dx + py * dy) / L2;
    if (t < 0 || t > 1) return false;
    return Math.abs(px * dy - py * dx) / L <= wd * Math.sin(Math.PI * t ** 0.8) ** 0.7;
  }, Math.min(x0, x1) - wd - 1, Math.min(y0, y1) - wd - 1, Math.max(x0, x1) + wd + 2, Math.max(y0, y1) + wd + 2);
}
function leaf(cv, x0, y0, x1, y1, wd, { bite } = {}) {
  let m = leafMask(cv, x0, y0, x1, y1, wd);
  if (bite) for (const [x, y, r] of bite) m = m.sub(cv.mask().circle(x, y, r));
  part(cv, m, Lf, { top: [5], left: [4], bottom: [0], right: [1], fill: 3 });
  cv.fill(cv.mask().line(x0, y0, x1, y1).and(m.erode(1)), Lf[1]);
  const n = Math.hypot(x1 - x0, y1 - y0);
  for (let k = 0.25; k < 0.85; k += 0.18) { // side veins angled toward the tip
    const cx = Math.round(x0 + (x1 - x0) * k), cy = Math.round(y0 + (y1 - y0) * k);
    const ux = (x1 - x0) / n, uy = (y1 - y0) / n;
    for (const s of [-1, 1]) cv.fill(cv.mask().line(cx, cy, Math.round(cx + (ux - uy * s * 1.4) * wd * 0.55), Math.round(cy + (uy + ux * s * 1.4) * wd * 0.55)).and(m.erode(1)), Lf[2]);
  }
  return m;
}

/** Ant facing left; f = leg pose. */
const ANTS = [
  ['k.......', '.hd..hd.', 'dddkdddd', '.k.k.k..'],
  ['k.......', '.hd..hd.', 'dddkdddd', 'k.k.k...'],
];

function bee(l, x, y, up) {
  const body = l.mask().oval(x, y, 13, 10);
  const wings = up ? l.mask().oval(x + 4, y - 7, 6, 8).or(l.mask().oval(x + 8, y - 6, 6, 7))
    : l.mask().oval(x + 3, y - 4, 7, 5).or(l.mask().oval(x + 8, y - 3, 7, 5));
  l.fill(wings, Wg[2]);
  l.fill(wings.edge().and(wings.shift(1, 1)), Wg[1]);
  l.set(x + 6, y - (up ? 5 : 3), Wg[3]);
  l.outline(INK, wings, { all: true });
  l.shade(body, Ye, { top: [4], left: [3], bottom: [0], right: [1], fill: 2 });
  for (const sx of [x + 6, x + 9]) l.fill(l.mask().rect(sx, y, 2, 10).and(body.erode(1)), INK);
  l.outline(INK, body, { all: true });
  l.set(x + 13, y + 5, INK).set(x + 14, y + 5, INK);
  sprite(l, x + 2, y + 3, ['kw', 'kk', '..', 'p.'], { k: INK, w: WH, p: PK });
  l.set(x + 1, y + 7, INK);
  return body.or(wings);
}

export default {
  id: 'px-insects', name: 'Bug Terrarium', theme: 'insects', rarity: 'common', translucent: false,
  collection: 'wild-pixels', license: 'CC-BY-4.0',
  desc: 'Peek through the glass of a cozy wooden terrarium while beetles climb, butterflies rest and a line of ants marches by.',
  tags: ['insects', 'bugs', 'terrarium', 'nature', 'animated', 'pixel'],
  css: '.a0,.a1,.a2,.a3{animation:am .8s steps(1) infinite}.a1,.a2,.a3{opacity:0}' +
    '.a1{animation-delay:-.6s}.a2{animation-delay:-.4s}.a3{animation-delay:-.2s}@keyframes am{0%{opacity:1}25%,100%{opacity:0}}' +
    '.b0{animation:bz .5s steps(1) infinite}.b1{opacity:0;animation:bz .5s steps(1) -.25s infinite}@keyframes bz{0%{opacity:1}50%,100%{opacity:0}}',
  draw() {
    const cv = new Canvas(W, H), rnd = rng(11);
    cv.use(Wd, Lf, Mo, Sl, Br, Pb, Rd, Bt, Bf, Df, Ye, Cp);

    // Soft dithered floor shadow.
    cv.fill(cv.mask().oval(0, 214, W, 16), (x, y) => {
      const d = Math.hypot((x + 0.5 - 120) / 120, (y + 0.5 - 222) / 8);
      return bayer(x, y) < (d < 0.7 ? 1 : 0.6 - (d - 0.7) * 1.5) ? '#120c1c' : undefined;
    });

    // Back foliage: big leaves behind the left stile, grass and a daisy behind the right one.
    leaf(cv, 34, 150, 4, 80, 10);
    leaf(cv, 34, 176, 2, 136, 8);
    leaf(cv, 30, 104, 10, 56, 7);
    for (const [x0, x1, y1, w] of [[214, 236, 150, 3], [218, 232, 168, 3], [212, 228, 128, 2]]) {
      const blade = cv.mask().poly([[x0, 208], [x0 + w * 2, 208], [x1 + 1, y1]]);
      part(cv, blade, Lf, { top: [4], left: [4], bottom: [1], right: [1], fill: 2, shadow: false });
    }
    const stem = cv.mask().rect(227, 52, 2, 156);
    part(cv, stem, Lf, { top: [3], left: [3], bottom: [1], right: [1], fill: 2, shadow: false });
    leaf(cv, 228, 120, 238, 108, 3);
    const petals = cv.mask();
    for (let k = 0; k < 8; k++) { const a = (k * Math.PI) / 4; petals.circle(Math.round(228 + Math.cos(a) * 5), Math.round(46 + Math.sin(a) * 5), 2); }
    part(cv, petals, ['#9a8fb0', '#c8c0dc', '#ebe6f6', '#ffffff', '#ffffff'], { top: [3], left: [3], bottom: [0], right: [1], fill: 2, shadow: false });
    part(cv, cv.mask().circle(228, 46, 3), Ye, { top: [4], left: [3], bottom: [0], right: [1], fill: 2, shadow: false });

    // Lid handle (behind the lid).
    const handle = cv.mask().oval(106, 18, 29, 26).sub(cv.mask().oval(110, 22, 21, 18)).clip(0, 0, W, 34);
    part(cv, handle, Br, { top: [4], left: [3], bottom: [0], right: [1], fill: 2, shadow: false });

    // Case: stiles and rails with grain and seams.
    const stiles = [cv.mask().rect(24, 44, 24, 152), cv.mask().rect(192, 44, 24, 152)];
    const rails = [cv.mask().rect(48, 44, 144, 22), cv.mask().rect(48, 174, 144, 22)];
    for (const m of [...stiles, ...rails]) cv.shade(m, Wd, { top: [6], left: [5], bottom: [1], right: [2], fill: 4 });
    for (const m of stiles) {
      const bb = m.bbox();
      for (let i = 0; i < 9; i++) {
        const x = bb.x + 3 + Math.floor(rnd() * (bb.w - 6)), y = bb.y + 4 + Math.floor(rnd() * (bb.h - 30)), l = 8 + Math.floor(rnd() * 18);
        cv.fill(cv.mask().rect(x, y, 1, l).and(m.erode(2)), Wd[3]);
      }
    }
    for (const m of rails) {
      const bb = m.bbox();
      for (let i = 0; i < 10; i++) {
        const x = bb.x + 2 + Math.floor(rnd() * (bb.w - 30)), y = bb.y + 3 + Math.floor(rnd() * (bb.h - 6)), l = 10 + Math.floor(rnd() * 24);
        cv.fill(cv.mask().rect(x, y, l, 1).and(m.erode(2)), Wd[3]);
      }
    }
    cv.outline(INK, stiles[0].or(stiles[1]).or(rails[0]).or(rails[1]), { all: true });

    // Lid with air vents, then the plinth.
    const lid = cv.mask().rrect(18, 34, 204, 12, [4, 4, 1, 1]);
    part(cv, lid, Wd, { top: [6, 5], left: [5], bottom: [1], right: [2], fill: 4, dy: 2 });
    for (let x = 28; x < 214; x += 8) if (x < 104 || x > 136) sprite(cv, x, 38, ['kk', 'kd', '.l'], { k: Wd[0], d: Wd[1], l: Wd[6] });
    for (const x of [105, 131]) part(cv, cv.mask().rect(x, 31, 5, 4), Br, { top: [4], left: [3], bottom: [0], right: [1], fill: 2 });
    const plinth = cv.mask().rrect(14, 194, 212, 14, 3);
    part(cv, plinth, Wd, { top: [6, 5], left: [5], bottom: [0, 1], right: [1], fill: 4, dy: 1 });
    for (let i = 0; i < 8; i++) {
      const x = 20 + Math.floor(rnd() * 170), y = 199 + Math.floor(rnd() * 5);
      cv.fill(cv.mask().rect(x, y, 10 + Math.floor(rnd() * 20), 1).and(plinth.erode(2)), Wd[3]);
    }
    // Knot hole the ants come out of.
    cv.fill(cv.mask().oval(180, 197, 7, 6), Wd[1]).fill(cv.mask().oval(181, 198, 5, 4), INK).set(182, 202, Wd[6]).set(183, 202, Wd[6]);

    // Raised moulding round the glass, recessed dark lip.
    const mould = cv.mask().rrect(40, 58, 160, 124, 6);
    cv.shade(mould, Wd, { top: [6], left: [6], bottom: [1], right: [2], fill: 5 });
    cv.outline(INK, mould.edge().and(mould.shift(-1, -1).not()).and(cv.mask().rect(0, 0, W, H)), {});
    inset(cv, ...HOLE, HR, { rim: INK, top: Wd[0], left: Wd[1], bottom: Wd[3], right: Wd[2] }, 2);

    // Brass corner brackets and the specimen plate.
    for (const [x, y, sx, sy] of [[24, 44, 1, 1], [215, 44, -1, 1], [24, 195, 1, -1], [215, 195, -1, -1]]) {
      const m = cv.mask().rect(Math.min(x, x + sx * 11), Math.min(y, y + sy * 2), 12, 3).or(cv.mask().rect(Math.min(x, x + sx * 2), Math.min(y, y + sy * 11), 3, 12));
      part(cv, m, Br, { top: [4], left: [3], bottom: [0], right: [1], fill: 2 });
      cv.set(x + sx * 9, y + sy, Br[0]).set(x + sx, y + sy * 9, Br[0]);
    }
    const plate = cv.mask().rrect(94, 183, 52, 10, 2);
    part(cv, plate, Br, { top: [4], left: [3], bottom: [0], right: [1], fill: 2 });
    cv.text('INSECTA', 120, 186, Br[0], { align: 'center' });
    cv.set(97, 187, Br[0]).set(142, 187, Br[0]);

    // Ground: mossy mound with a cut-soil front, pebbles and clover.
    const ground = cv.mask().rrect(4, 208, 232, 15, [0, 0, 5, 5]);
    for (const [x, y, r] of [[10, 206, 9], [24, 210, 8], [52, 212, 9], [62, 208, 6], [96, 214, 8], [140, 214, 8], [176, 213, 7], [196, 210, 8], [214, 206, 9], [230, 208, 7]]) ground.circle(x, y, r);
    const g = ground.clip(0, 0, W, 223);
    cv.fill(g, (x, y) => (y >= 216 + Math.round(Math.sin(x * 0.3) * 1.2) ? Sl[y > 219 ? 1 : 2] : Mo[2]));
    cv.fill(g.sub(g.shift(0, 1)).or(g.sub(g.shift(0, 1)).shift(0, 1).and(g)).and(cv.mask().rect(0, 0, W, 216)), (x, y) => (g.has(x, y - 1) ? Mo[3] : Mo[4]));
    cv.fill(g.and(cv.mask().rect(0, 212, W, 4)), (x, y, c) => (c === Mo[2] && bayer(x, y) < 0.4 ? Mo[1] : c));
    cv.fill(g.and(cv.mask().rect(0, 222, W, 1)), Sl[0]);
    for (let i = 0; i < 26; i++) {
      const x = 8 + Math.floor(rnd() * 224), y = 218 + Math.floor(rnd() * 4);
      if (g.has(x, y) && g.has(x + 1, y)) cv.set(x, y, Sl[3]).set(x + 1, y, Sl[4]);
    }
    cv.outline(INK, g, { all: true });
    for (const [x, y, w, h] of [[66, 206, 7, 5], [74, 209, 5, 4], [150, 208, 8, 5], [168, 210, 5, 4], [204, 202, 7, 6], [44, 214, 5, 4], [124, 211, 6, 4]]) {
      part(cv, cv.mask().oval(x, y, w, h), Pb, { top: [4], left: [3], bottom: [0], right: [1], fill: 2 });
    }
    for (const [x, y] of [[88, 208], [112, 210], [186, 207], [138, 209]]) sprite(cv, x, y, ['.a.a.', 'aabaa', '.a.a.', '..s..'], { a: Mo[3], b: Mo[4], s: Mo[1] });

    // Leaf with a fuzzy caterpillar munching its edge (bottom left).
    leaf(cv, 62, 212, 2, 186, 11, { bite: [[18, 186, 3], [24, 184, 3]] });
    const segs = [[52, 203], [47, 200], [42, 198], [37, 197], [32, 197]];
    const body = cv.mask();
    for (const [x, y] of segs) body.circle(x, y, 3);
    const head = cv.mask().circle(25, 194, 4);
    cv.cast(body.or(head).dilate(1), 1, 1, -1);
    for (const [x, y] of [...segs].reverse()) {
      const m = cv.mask().circle(x, y, 3);
      cv.shade(m, Cp, { top: [4], left: [3], bottom: [0], right: [1], fill: 2 });
      cv.outline(INK, m, { all: true });
      cv.set(x - 1, y - 4, CREAM).set(x + 1, y - 5, CREAM).set(x, y - 4, INK);
      cv.set(x, y + 4, Lf[0]);
    }
    cv.shade(head, Cp, { top: [4], left: [4], bottom: [0], right: [1], fill: 3 });
    cv.outline(INK, head, { all: true });
    sprite(cv, 21, 186, ['k...k', '.k.k.'], { k: INK });
    sprite(cv, 22, 192, ['wk.wk', 'kk.kk', '.....', 'p.kp.'], { k: INK, w: WH, p: PK });

    // Ladybug climbing the left stile.
    const lbHead = cv.mask().oval(32, 112, 9, 6), lbShell = cv.mask().oval(30, 116, 13, 13);
    for (const [a, b] of [[30, 120], [30, 124], [31, 127]]) { cv.fill(cv.mask().line(a, b, a - 3, b + (b - 124)), INK); cv.fill(cv.mask().line(72 - a, b, 75 - a, b + (b - 124)), INK); }
    cv.cast(lbShell.or(lbHead).dilate(1), 1, 1, -1);
    cv.fill(lbHead, '#2c2340').set(34, 114, WH).set(38, 114, WH).set(33, 113, '#4a3f62');
    cv.outline(INK, lbHead, { all: true });
    cv.px([[33, 110], [32, 109], [39, 110], [40, 109]], INK);
    cv.shade(lbShell, Rd, { top: [4], left: [3], bottom: [0], right: [1], fill: 2 });
    cv.outline(INK, lbShell, { all: true });
    cv.rect(36, 116, 1, 13, INK);
    for (const [x, y] of [[32, 119], [39, 119], [32, 124], [39, 124]]) cv.rect(x, y, 2, 2, INK);
    cv.set(33, 117, Rd[4]).set(34, 117, Rd[4]);

    // Stag beetle climbing the right stile.
    const CX = 207, bt = cv.mask();
    const mand = cv.mask().capsule(204, 86, 200, 80, 1).or(cv.mask().capsule(200, 80, 202, 75, 0.8)).put(199, 80).mirror(2 * CX + 1);
    const bHead = cv.mask().oval(203, 84, 9, 7), pron = cv.mask().rrect(201, 90, 13, 9, 3), ely = cv.mask().oval(200, 98, 15, 19);
    for (const [a, b, c, d] of [[201, 93, 196, 89], [200, 102, 195, 101], [201, 110, 196, 115]]) {
      cv.fill(cv.mask().line(a, b, c, d).or(cv.mask().line(2 * CX - a, b, 2 * CX - c, d)), INK);
      cv.set(c, d - 1, INK).set(2 * CX - c, d - 1, INK);
    }
    bt.or(mand).or(bHead).or(pron).or(ely);
    const btAll = mand.or(bHead).or(pron).or(ely);
    cv.cast(btAll.dilate(1), 1, 1, -1);
    cv.shade(mand, Wd, { top: [3], left: [3], bottom: [0], right: [1], fill: 2 });
    cv.outline(INK, mand, { all: true });
    cv.shade(ely, Bt, { top: [4], left: [3], bottom: [0], right: [1], fill: 2 });
    cv.outline(INK, ely, { all: true });
    cv.rect(CX, 99, 1, 17, INK);
    cv.px([[202, 101], [202, 102], [203, 100], [204, 100], [203, 101]], Bt[4]).px([[209, 101], [210, 101]], Bt[3]);
    cv.shade(pron, Bt, { top: [4], left: [3], bottom: [0], right: [1], fill: 2 });
    cv.outline(INK, pron, { all: true });
    cv.px([[203, 91], [204, 91]], Bt[4]);
    cv.shade(bHead, Bt, { top: [3], left: [3], bottom: [0], right: [1], fill: 1 });
    cv.outline(INK, bHead, { all: true });
    sprite(cv, 203, 85, ['wk.....kw', 'kk.....kk'], { k: INK, w: WH });

    // Dragonfly perched on the left of the lid.
    const dw = cv.mask().capsule(60, 25, 46, 15, 2.2).or(cv.mask().capsule(58, 27, 40, 22, 2)).or(cv.mask().capsule(64, 25, 72, 13, 2)).or(cv.mask().capsule(66, 26, 80, 19, 1.8));
    cv.fill(dw, Wg[2]);
    cv.fill(dw.edge().and(dw.shift(1, 1)), Wg[1]);
    for (const [a, b, c, d] of [[60, 25, 47, 16], [58, 27, 42, 22], [64, 25, 71, 15], [66, 26, 78, 20]]) cv.fill(cv.mask().line(a, b, c, d).and(dw.erode(1)), Wg[3]);
    cv.outline(INK, dw, { all: true });
    const tail = cv.mask().capsule(58, 29, 34, 30, 1.2), thor = cv.mask().oval(57, 25, 11, 8), eye = cv.mask().circle(70, 27, 3);
    cv.px([[60, 32], [59, 33], [64, 32], [65, 33]], INK);
    cv.cast(tail.or(thor).or(eye).dilate(1), 1, 1, -1);
    cv.shade(tail, Df, { top: [4], left: [3], bottom: [0], right: [1], fill: 2 });
    for (let x = 36; x < 56; x += 4) cv.fill(cv.mask().rect(x, 28, 1, 4).and(tail), Df[0]);
    cv.shade(thor, Df, { top: [4], left: [3], bottom: [0], right: [1], fill: 2 });
    cv.shade(eye, Df, { top: [4], left: [4], bottom: [1], right: [2], fill: 3 });
    cv.outline(INK, tail.or(thor).or(eye), { all: true });
    sprite(cv, 70, 26, ['wk', 'kk'], { w: WH, k: INK });
    cv.set(72, 30, PK);

    // Butterfly perched on the right of the lid.
    const BX = 172, wl = cv.mask().oval(BX - 14, 10, 14, 13).or(cv.mask().oval(BX - 11, 21, 11, 10)).mirror(2 * BX + 1).sub(cv.mask().rect(BX, 0, 1, 34));
    cv.cast(wl.dilate(1), 1, 1, -1);
    cv.shade(wl, Bf, { top: [4], left: [3], bottom: [0], right: [1], fill: 2 });
    cv.fill(wl.edge(), (x, y) => (y < 14 ? Bf[1] : Bf[0]));
    for (const [x, y] of [[BX - 8, 15], [BX + 6, 15], [BX - 6, 25], [BX + 4, 25]]) cv.fill(cv.mask().oval(x, y, 3, 3, 1.4), y < 20 ? CREAM : Ye[3]);
    cv.outline(INK, wl, { all: true });
    const bfBody = cv.mask().rect(BX - 1, 18, 3, 14);
    cv.fill(bfBody, (x) => (x < BX ? '#5a3c5e' : '#3a2840')).outline(INK, bfBody, { all: true });
    cv.px([[BX - 2, 16], [BX - 3, 14], [BX - 4, 12], [BX + 2, 16], [BX + 3, 14], [BX + 4, 12]], INK).px([[BX - 5, 11], [BX + 5, 11]], INK);

    cv.outline(INK);

    // Ants marching out of the knot hole toward the leaf (4 steps, 3px apart, 12px period).
    const track = cv.mask().rect(66, 197, 113, 6);
    for (let k = 0; k < 4; k++) {
      const l = cv.layer('a' + k);
      for (let x = 52 - k * 3; x < 190; x += 12) {
        const m = spriteMask(l, x, 198, ANTS[k % 2]).and(track);
        sprite(l, x, 198, ANTS[k % 2], ANT);
        l.fill(spriteMask(l, x, 198, ANTS[k % 2]).sub(m), null);
      }
    }
    // Bee buzzing over the daisy (2 frames).
    bee(cv.layer('b0'), 214, 22, true);
    bee(cv.layer('b1'), 214, 23, false);

    return cv.punch(...HOLE, HR);
  },
};
