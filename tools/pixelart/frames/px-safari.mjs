// Safari cruiser: the front of a rugged open-top 4x4 seen head-on. Its windshield is the screen; a bull
// bar, round headlights and a muddy bumper below, a spare tyre, jerrycans and a bedroll on the roof rack,
// a giraffe resting its chin on the rack, a flat-topped acacia against a low sun, a zebra and an
// elephant calf at the sides, golden savanna grass underfoot.
import { Canvas, ramp, rng, bayer } from '../pixel.mjs';
import { INK, inset, part, sprite } from '../kit.mjs';

const W = 304, H = 240, HOLE = [72, 58, 160, 90], HR = 3; // 16:9

const Ol = ramp('#7f8f45', 7, { step: 0.11, hue: 8 }); // olive body paint
const Gm = ['#16141e', '#24222f', '#363443', '#4c4a5b', '#686779', '#8e8ea0']; // gunmetal (bars, rack)
const Rb = ['#0f0d14', '#1a1820', '#27242f', '#38343f', '#4d4856']; // rubber
const Gl = ['#8a4a22', '#b4702e', '#d49a3e', '#e8bd5a', '#f5d77e', '#fff0b0']; // golden grass
const Mu = ['#3a2416', '#5a3a22', '#7c5532', '#9c7346']; // mud
const Or = ramp('#e0602e', 5, { step: 0.13 }); // jerrycans / indicators
const Cv = ramp('#c9b483', 5, { step: 0.12 }); // canvas bedroll
const Lf = ramp('#4f7d3c', 5, { step: 0.12, hue: 14 }); // acacia leaves
const Bk = ramp('#6e4a32', 5, { step: 0.11 }); // bark
const Su = ['#e8603a', '#f5833f', '#ffa94a', '#ffcf6a', '#ffeaa0']; // low sun
const Gi = ramp('#e9a24c', 5, { step: 0.12 }); // giraffe
const Sp = ['#7a3e1c', '#94532a']; // giraffe patches
const Ze = ['#6d6a86', '#a4a2bc', '#d8d6e8', '#f2f0fa', '#ffffff']; // zebra white
const ZS = '#2a2334'; // zebra stripes
const El = ramp('#9890ac', 6, { step: 0.11, hue: 10 }); // elephant
const Pk = ['#b0506e', '#e07a96', '#ffb0c4']; // blush / inner ears
const Hl = ['#7a5a1a', '#e0b040', '#fff0a0', '#fffbe6']; // headlight glass

// Catmull-Rom through points, ~1px steps.
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
const tube = (cv, pts, r) => spline(pts).reduce((m, [x, y]) => m.circle(Math.round(x), Math.round(y), r), cv.mask());
const eye = (cv, x, y) => cv.rect(x, y, 2, 3, INK).set(x, y, '#ffffff');

function tyre(cv, x, y, w, h) {
  const m = cv.mask().rrect(x, y, w, h, 6);
  part(cv, m, Rb, { top: [3], left: [3], bottom: [0], right: [1], fill: 2, shadow: false });
  for (let j = y + 3; j < y + h - 2; j += 4) { cv.rect(x + 2, j, w - 4, 1, Rb[1]); cv.rect(x + 3 + ((j >> 2) % 2) * 4, j + 1, 6, 1, Rb[3]); }
  return m;
}

export default {
  id: 'px-safari', name: 'Safari Cruiser', theme: 'safari', rarity: 'rare', translucent: false,
  collection: 'wild-pixels', license: 'CC-BY-4.0',
  desc: 'Roll out across the golden savanna while a curious giraffe rests its chin on your roof rack.',
  tags: ['safari', 'animals', 'savanna', 'jeep', 'animated', 'pixel'],
  css: '.bk{animation:bk 4.2s steps(1) infinite}@keyframes bk{0%,91%{opacity:0}92%,96%{opacity:1}97%,100%{opacity:0}}' +
    '.sw{animation:sw 1.6s steps(1) infinite}@keyframes sw{50%{opacity:0}}' +
    '.fa{animation:fa .9s steps(1) infinite}@keyframes fa{50%{opacity:0}}.fb{opacity:0;animation:fb .9s steps(1) infinite}@keyframes fb{50%{opacity:1}}',
  draw() {
    const cv = new Canvas(W, H), rnd = rng(11);
    cv.use(Ol, Gm, Rb, Gl, Mu, Or, Cv, Lf, Bk, Su, Gi, Ze, El);

    // ---- backdrop: low sun and a flat-topped acacia -------------------------------------------
    const sun = cv.mask().circle(42, 36, 27);
    cv.grad(sun, [Su[4], Su[3], Su[2], Su[1]], { soft: 0.7 });
    cv.outline(INK, sun, { all: true });
    const trunk = tube(cv, [[30, 170], [32, 140], [34, 110], [36, 70], [34, 44], [28, 26]], 2).or(tube(cv, [[30, 172], [32, 130]], 3))
      .or(tube(cv, [[35, 66], [44, 44], [58, 24]], 1)).or(tube(cv, [[34, 50], [20, 34], [12, 22]], 1)).or(tube(cv, [[44, 44], [42, 26]], 1));
    cv.outline(INK, trunk, { all: true });
    cv.shade(trunk, Bk, { top: [3], left: [3], bottom: [1], right: [0], fill: 2 });
    const canopy = [[-6, 14, 44, 13], [18, 8, 56, 13], [52, 13, 42, 12], [4, 4, 40, 10], [36, 2, 44, 10]]
      .reduce((m, [x, y, w, h]) => m.oval(x, y, w, h), cv.mask());
    cv.outline(INK, canopy, { all: true });
    cv.fill(canopy, (x, y) => {
      const below = !canopy.has(x, y + 2) ? 0 : !canopy.has(x, y + 4) ? 1 : 2;
      const lit = !canopy.has(x, y - 2) ? 4 : !canopy.has(x, y - 4) ? 3 : 2;
      return Lf[Math.min(below, lit)] ?? Lf[2];
    });
    for (let i = 0; i < 70; i++) { // leafy clumps
      const x = Math.floor(rnd() * 100), y = 4 + Math.floor(rnd() * 20);
      if (canopy.erode(1).has(x, y)) cv.set(x, y, bayer(x, y) < 0.5 ? Lf[4] : Lf[1]);
    }

    // ---- giraffe resting its chin on the rack --------------------------------------------------
    const gx = 214;
    const neck = cv.mask().rect(gx - 7, 26, 14, 10);
    const head = cv.mask().oval(gx - 12, 7, 24, 22);
    const snout = cv.mask().oval(gx - 10, 19, 20, 14);
    const ears = cv.mask().oval(gx - 21, 11, 11, 6).oval(gx + 10, 11, 11, 6);
    const horns = cv.mask().rect(gx - 6, 1, 3, 9).rect(gx + 3, 1, 3, 9);
    const knobs = cv.mask().circle(gx - 5, 2, 2).circle(gx + 4, 2, 2);
    const gall = neck.or(head).or(snout).or(ears).or(horns).or(knobs);
    cv.cast(gall.dilate(1), 1, 1, -1);
    cv.outline(INK, gall, { all: true });
    cv.shade(neck, Gi, { top: [2], left: [2], bottom: [1], right: [1], fill: 1 });
    cv.shade(ears, Gi, { top: [4], left: [3], bottom: [1], right: [1], fill: 2 });
    cv.fill(cv.mask().oval(gx - 19, 13, 6, 3).oval(gx + 13, 13, 6, 3), Pk[1]);
    cv.shade(horns, Gi, { top: [3], left: [3], bottom: [1], right: [1], fill: 2 });
    cv.shade(knobs, Bk, { top: [2], left: [2], bottom: [0], right: [0], fill: 1 });
    cv.set(gx - 6, 1, Bk[3]).set(gx + 3, 1, Bk[3]);
    cv.shade(head, Gi, { top: [4], left: [4, 3], bottom: [1], right: [1], fill: 3 });
    for (const [x, y, w, h] of [[gx - 4, 9, 7, 5], [gx - 10, 15, 5, 4], [gx + 6, 14, 5, 5], [gx - 2, 15, 4, 3]])
      cv.fill(cv.mask().oval(x, y, w, h, 1.2).and(head.erode(1)), (px, py) => Sp[py < y + 1 && px < x + 2 ? 1 : 0]);
    for (const [x, y] of [[gx - 3, 28], [gx + 2, 30]]) cv.fill(cv.mask().oval(x, y, 4, 3, 1.3).and(neck), Sp[0]);
    cv.outline(INK, snout, { all: true });
    cv.shade(snout, Cv, { top: [4], left: [4], bottom: [1], right: [2], fill: 3 });
    cv.px([[gx - 5, 25], [gx - 4, 25], [gx + 3, 25], [gx + 4, 25]], Bk[1]);
    cv.px([[gx - 2, 28], [gx - 1, 29], [gx, 29], [gx + 1, 28]], Bk[0]);
    eye(cv, gx - 8, 16); eye(cv, gx + 6, 16);
    cv.dither(cv.mask().rect(gx - 12, 21, 3, 2).rect(gx + 9, 21, 3, 2), Gi[3], Pk[2], 0.5);
    const blink = cv.layer('bk');
    for (const x of [gx - 8, gx + 6]) blink.rect(x, 16, 2, 2, Gi[3]).rect(x, 18, 2, 1, INK);

    // ---- roof rack cargo: spare tyre, jerrycans, bedroll ---------------------------------------
    const spare = cv.mask().circle(96, 19, 14);
    cv.cast(spare.dilate(1), 1, 1, -1);
    cv.outline(INK, spare, { all: true });
    cv.shade(spare, Rb, { top: [4, 3], left: [3], bottom: [0], right: [1], fill: 2 });
    for (let a = 0; a < 24; a++) { const t = (a / 24) * Math.PI * 2; cv.set(Math.round(96 + Math.cos(t) * 12.5), Math.round(19 + Math.sin(t) * 12.5), Rb[1]); }
    const rim = cv.mask().circle(96, 19, 7);
    cv.outline(INK, rim, { all: true });
    cv.shade(rim, Ol, { top: [6], left: [5], bottom: [1], right: [2], fill: 4 });
    part(cv, cv.mask().circle(96, 19, 2), Gm, { top: [5], left: [4], bottom: [1], right: [2], fill: 3, shadow: false });
    for (const [dx, dy] of [[0, -5], [5, 0], [0, 5], [-5, 0]]) cv.set(96 + dx, 19 + dy, Ol[1]);

    for (const x of [116, 131]) {
      const can = cv.mask().rrect(x, 12, 14, 22, 2);
      part(cv, can, Or, { top: [4], left: [3], bottom: [0], right: [1], fill: 2 });
      cv.fill(cv.mask().line(x + 2, 15, x + 11, 30).or(cv.mask().line(x + 11, 15, x + 2, 30)).and(can.erode(2)), Or[1]);
      cv.fill(cv.mask().line(x + 3, 15, x + 11, 29).and(can.erode(2)), Or[3]);
      part(cv, cv.mask().rect(x + 2, 8, 9, 3), Gm, { top: [5], left: [4], bottom: [1], right: [2], fill: 3, shadow: false });
      cv.rect(x + 4, 9, 5, 1, INK);
      part(cv, cv.mask().rect(x + 10, 7, 3, 4), Gm, { top: [5], left: [4], bottom: [1], right: [2], fill: 3, shadow: false });
    }
    const roll = cv.mask().rrect(150, 20, 40, 14, 6);
    part(cv, roll, Cv, { top: [4], left: [3], bottom: [0], right: [1], fill: 2 });
    for (let x = 156; x < 186; x += 7) cv.rect(x, 22, 1, 10, Cv[1]);
    for (const x of [160, 177]) { cv.rect(x, 19, 3, 16, Mu[1]); cv.rect(x, 20, 1, 14, Mu[3]); cv.rect(x, 26, 3, 2, Gm[4]); }

    // ---- roof rack ----------------------------------------------------------------------------
    const rack = cv.mask().rect(62, 32, 180, 4).rect(62, 40, 180, 3);
    for (let x = 62; x <= 238; x += 16) rack.rect(x, 32, 3, 11);
    rack.rect(62, 28, 3, 6).rect(239, 28, 3, 6);
    part(cv, rack, Gm, { top: [5], left: [4], bottom: [1], right: [2], fill: 3 });

    // ---- windshield frame ---------------------------------------------------------------------
    const frame = cv.mask().rrect(58, 44, 188, 118, 6);
    part(cv, frame, Ol, { top: [6, 5], left: [5], bottom: [1], right: [2], fill: 4, shadow: false });
    const seal = cv.mask().rrect(66, 52, 172, 102, 5).sub(cv.mask().rrect(...HOLE, HR));
    cv.shade(cv.mask().rrect(66, 52, 172, 102, 5), Rb, { top: [0], left: [0], bottom: [3], right: [2], fill: 1 });
    cv.fill(seal.and(cv.mask().rect(0, 52, W, 1)), Rb[0]);
    inset(cv, ...HOLE, HR, { rim: INK, top: Rb[0], bottom: Rb[3], right: Rb[2] }, 1);
    cv.px([[68, 58], [68, 57], [69, 56], [70, 55], [71, 54]], Rb[4]);
    for (const [x, y] of [[62, 48], [239, 48], [62, 155], [239, 155]]) sprite(cv, x, y, ['ab', 'bc'], { a: Gm[5], b: Gm[3], c: Gm[1] });
    for (let y = 66; y < 148; y += 14) for (const x of [62, 241]) sprite(cv, x, y, ['ab', 'bc'], { a: Ol[6], b: Ol[4], c: Ol[2] });
    for (const x of [100, 204]) { // hinges on the top bar
      part(cv, cv.mask().rect(x - 5, 45, 11, 4), Gm, { top: [5], left: [4], bottom: [1], right: [2], fill: 3, shadow: false });
    }

    // Snorkel up the right pillar.
    const snork = cv.mask().rect(247, 60, 5, 108).rrect(244, 52, 11, 12, 3);
    part(cv, snork, Rb, { top: [4], left: [4], bottom: [0], right: [1], fill: 2 });
    for (let y = 70; y < 166; y += 22) cv.rect(246, y, 7, 2, Gm[3]);
    cv.rect(246, 55, 7, 6, Rb[0]);
    for (let y = 56; y < 61; y += 2) cv.rect(247, y, 5, 1, Rb[2]);

    // ---- body: hood, front panel, fenders, tyres ----------------------------------------------
    tyre(cv, 50, 196, 36, 34);
    tyre(cv, 218, 196, 36, 34);
    const under = cv.mask().rect(86, 206, 132, 18);
    cv.fill(under, Rb[0]);
    cv.rect(86, 214, 132, 2, Gm[1]).rect(86, 214, 132, 1, Gm[2]);
    part(cv, cv.mask().oval(140, 210, 24, 12), Gm, { top: [3], left: [2], bottom: [0], right: [0], fill: 1, shadow: false });
    const hood = cv.mask().rrect(52, 156, 200, 12, [5, 5, 0, 0]);
    part(cv, hood, Ol, { top: [6], left: [5], bottom: [3], right: [3], fill: 5, dy: 1 });
    cv.rect(140, 159, 24, 1, Ol[3]).rect(140, 160, 24, 1, Ol[6]);
    const face = cv.mask().rect(54, 168, 196, 34);
    const fenders = cv.mask().rrect(40, 164, 50, 36, [6, 3, 0, 0]).rrect(214, 164, 50, 36, [3, 6, 0, 0]);
    part(cv, face, Ol, { top: [2], left: [3], bottom: [0], right: [1], fill: 2, shadow: false });
    part(cv, fenders, Ol, { top: [6, 5], left: [5], bottom: [1], right: [2], fill: 4 });
    for (const [x, y, w] of [[38, 196, 54], [212, 196, 54]]) {
      const flare = cv.mask().rrect(x, y, w, 6, 2);
      part(cv, flare, Rb, { top: [4], left: [3], bottom: [0], right: [1], fill: 2 });
    }

    // Grille with vertical slots.
    const grille = cv.mask().rrect(110, 170, 84, 22, 3);
    part(cv, grille, Gm, { top: [0], left: [0], bottom: [4], right: [3], fill: 1, shadow: false });
    for (let x = 115; x < 190; x += 6) { cv.rect(x, 172, 3, 18, Ol[3]); cv.rect(x, 172, 1, 18, Ol[5]); cv.rect(x + 2, 173, 1, 17, Ol[1]); }

    // Round headlights with chrome rings, amber indicators.
    for (const cx of [70, 234]) {
      const ring = cv.mask().circle(cx, 180, 9);
      part(cv, ring, Gm, { top: [5], left: [5], bottom: [1], right: [2], fill: 4, dy: 1 });
      const lens = cv.mask().circle(cx, 180, 6);
      cv.outline(INK, lens, { all: true });
      cv.grad(lens, [Hl[3], Hl[2], Hl[1]], { dir: { cx: cx - 2, cy: 177, r: 9 }, soft: 0.7 });
      cv.fill(cv.mask().circle(cx, 180, 3).sub(cv.mask().circle(cx, 180, 2)), (x, y, c) => (bayer(x, y) < 0.5 ? cv.step(c, -1) : c));
      cv.px([[cx - 3, 177], [cx - 2, 176], [cx - 3, 178], [cx - 2, 177]], '#ffffff');
      const ind = cv.mask().rrect(cx < 152 ? 86 : 206, 175, 12, 5, 2);
      part(cv, ind, Or, { top: [4], left: [4], bottom: [1], right: [2], fill: 3, shadow: false });
      cv.set(cx < 152 ? 88 : 208, 176, '#fff4d0');
    }

    // Bumper with a winch and a plate.
    const bumper = cv.mask().rrect(34, 202, 236, 11, 2);
    part(cv, bumper, Gm, { top: [5], left: [4], bottom: [0], right: [1], fill: 3, dy: 1 });
    for (const x of [44, 82, 218, 256]) sprite(cv, x, 206, ['ab', 'bc'], { a: Gm[5], b: Gm[2], c: Gm[0] });
    const drum = cv.mask().rrect(134, 204, 36, 12, 3);
    part(cv, drum, Gm, { top: [4], left: [3], bottom: [0], right: [1], fill: 2, dy: 1 });
    for (let y = 206; y < 215; y += 2) cv.rect(140, y, 24, 1, Mu[2]);
    for (let y = 207; y < 215; y += 2) cv.rect(140, y, 24, 1, Mu[1]);
    cv.rect(151, 214, 2, 5, Gm[4]);
    sprite(cv, 149, 218, ['.aa.', 'a..a', '.aa.'], { a: Gm[4] });
    const plate = cv.mask().rrect(136, 193, 32, 9, 1);
    part(cv, plate, Cv, { top: [4], left: [4], bottom: [1], right: [2], fill: 4, shadow: false });
    cv.text('KAYBORO', 139, 195, Gm[1]);

    // Bull bar: uprights, a curved top hoop and a crossbar.
    const bar = cv.mask()
      .or(tube(cv, [[104, 214], [104, 176], [108, 166], [120, 163], [184, 163], [196, 166], [200, 176], [200, 214]], 1))
      .or(tube(cv, [[82, 196], [104, 196]], 1)).or(tube(cv, [[200, 196], [222, 196]], 1));
    part(cv, bar, Gm, { top: [5], left: [4], bottom: [1], right: [2], fill: 3, dy: 2 });
    for (const x of [104, 200]) cv.set(x - 1, 172, Gm[5]).set(x - 1, 173, Gm[5]);

    // Mud: a dithered dirt band creeping up the lower body, plus a few splats with drips.
    const lower = cv.opaque().and(cv.mask().rect(34, 184, 236, 32)).sub(grille).sub(plate).sub(drum).sub(bar);
    const dirt = lower.and(cv.mask().plot((x, y) => (y - 188 - Math.sin(x * 0.31) * 2 - Math.sin(x * 0.13) * 3) / 12 > bayer(x, y) + 0.2
      && (x < 100 || x > 204), 34, 184, 270, 202));
    cv.fill(dirt, (x, y, c) => (Gm.includes(c) || Rb.includes(c) ? Mu[1] : Mu[2]));
    const splat = cv.mask();
    for (const [x, y, r] of [[52, 192, 2], [60, 197, 1], [90, 190, 2], [80, 186, 1], [46, 186, 1], [100, 200, 1], [118, 206, 1],
      [208, 190, 2], [222, 186, 1], [246, 192, 2], [256, 188, 1], [214, 199, 1], [188, 207, 1], [262, 198, 1]]) {
      splat.circle(x, y, r, 1.3).put(x + r + 1, y - r - 1).put(x - r - 2, y - 1);
      if (r > 1) splat.rect(x, y + r, 1, 3);
    }
    const sp = splat.and(lower);
    cv.fill(sp, (x, y) => (sp.has(x, y - 1) ? Mu[1] : Mu[3]));

    // ---- savanna grass and floor shadow -------------------------------------------------------
    const ground = cv.mask().plot((x, y) => y >= 222 + Math.round(Math.sin(x * 0.07) * 1.5 + Math.sin(x * 0.23) * 1), 0, 210, W, H - 1);
    cv.grad(ground, [Gl[4], Gl[3], Gl[3], Gl[2]], { soft: 0.6 });
    for (let i = 0; i < 90; i++) { const x = Math.floor(rnd() * W), y = 224 + Math.floor(rnd() * 14); if (ground.has(x, y)) cv.rect(x, y, 2 + Math.floor(rnd() * 3), 1, rnd() < 0.5 ? Gl[2] : Gl[5]); }
    cv.tone(cv.mask().oval(34, 222, 236, 11).and(ground), -1, 1);
    cv.tone(cv.mask().oval(56, 223, 192, 8).and(ground), -1, 0.5);
    cv.tone(cv.mask().oval(0, 222, 62, 9).and(ground), -1, 0.5);
    cv.tone(cv.mask().oval(250, 221, 56, 9).and(ground), -1, 0.5);

    // ---- zebra, left --------------------------------------------------------------------------
    const zb = cv.mask().oval(3, 170, 42, 26);
    const zlegs = cv.mask().rrect(7, 188, 6, 34, 2).rrect(16, 190, 6, 32, 2).rrect(29, 190, 6, 32, 2).rrect(37, 188, 6, 34, 2);
    const zneck = cv.mask().poly([[30, 178], [44, 186], [52, 150], [40, 146]]);
    const zhead = cv.mask().oval(33, 128, 24, 22).or(cv.mask().oval(45, 140, 14, 13));
    const zear = cv.mask().poly([[37, 133], [34, 120], [43, 130]]).or(cv.mask().poly([[47, 130], [51, 119], [54, 132]]));
    const zall = zb.or(zlegs).or(zneck).or(zhead).or(zear);
    cv.cast(zall.dilate(1), 1, 1, -1);
    cv.outline(INK, zall, { all: true });
    cv.shade(zlegs, Ze, { top: [3], left: [3], bottom: [0], right: [1], fill: 2 });
    for (const x of [7, 16, 29, 37]) { cv.rect(x, 218, 6, 4, ZS); for (let y = 196; y < 216; y += 5) cv.rect(x + 1, y, 5, 2, ZS); }
    cv.shade(zb.or(zneck), Ze, { top: [4], left: [4, 3], bottom: [1], right: [1], fill: 3 });
    const zst = zb.or(zneck).erode(1);
    cv.fill(zst.and(cv.mask().plot((x, y) => (((x * 0.42 + Math.sin(y * 0.25) * 1.6) % 4) + 4) % 4 < 1.6, 0, 140, 60, 200)), ZS);
    cv.shade(zear, Ze, { top: [4], left: [3], bottom: [1], right: [1], fill: 3 });
    cv.fill(cv.mask().poly([[38, 131], [36, 124], [41, 130]]).or(cv.mask().poly([[48, 129], [51, 123], [53, 130]])), Pk[1]);
    cv.shade(zhead, Ze, { top: [4], left: [4], bottom: [1], right: [2], fill: 3 });
    for (const [x0, y0, x1, y1] of [[36, 132, 41, 133], [36, 135, 40, 136], [44, 131, 47, 133], [50, 132, 53, 131], [34, 140, 36, 142], [34, 144, 37, 146]])
      cv.fill(cv.mask().line(x0, y0, x1, y1).and(zhead.erode(1)), ZS);
    const muzzle = cv.mask().oval(46, 142, 13, 10).and(zhead.erode(1));
    cv.fill(muzzle, (x, y) => (muzzle.has(x, y - 1) ? '#5a5270' : '#7a7290'));
    cv.px([[51, 146], [55, 146]], INK).px([[52, 149], [53, 149], [54, 149]], '#3a3346');
    eye(cv, 42, 136); eye(cv, 51, 136);
    cv.dither(cv.mask().rect(39, 141, 3, 2), Ze[3], Pk[2], 0.5);
    const mane = cv.mask().poly([[40, 121], [46, 125], [35, 168], [29, 170]]);
    cv.fill(mane, (x, y) => (Math.floor(y / 3) % 2 ? ZS : Ze[3]));
    cv.outline(INK, mane, {});
    // Tail swish (two frames).
    const tailA = tube(cv, [[4, 176], [1, 186], [2, 194]], 0), tailB = tube(cv, [[4, 176], [3, 187], [6, 195]], 0);
    cv.fill(tailA, INK).rect(1, 193, 3, 5, ZS);
    const sw = cv.layer('sw'), base = cv.p.slice();
    sw.fill(tailA.or(cv.mask().rect(1, 193, 3, 5)).sub(zall), (x, y) => base[y * W + x] || null);
    sw.fill(tailB, INK).rect(5, 194, 3, 5, ZS);

    // ---- elephant calf, right: trunk up in a happy toot ---------------------------------------
    const eb = cv.mask().oval(260, 174, 46, 34);
    const elegs = cv.mask().rrect(265, 196, 10, 27, 3).rrect(291, 196, 10, 27, 3).rrect(277, 198, 9, 24, 3);
    const ehead = cv.mask().oval(248, 160, 30, 28);
    const etrunk = tube(cv, [[252, 180], [247, 176], [245, 168], [246, 161], [250, 158]], 2);
    const eear = cv.mask().oval(266, 156, 24, 32);
    const eall = eb.or(elegs).or(ehead).or(etrunk).or(eear);
    cv.cast(eall.dilate(1), 1, 1, -1);
    cv.outline(INK, eall, { all: true });
    cv.shade(eb.or(elegs), El, { top: [4], left: [3], bottom: [0], right: [1], fill: 2 });
    for (const x of [265, 277, 291]) cv.rect(x + 2, 220, 5, 1, El[4]);
    cv.shade(etrunk, El, { top: [5], left: [4], bottom: [1], right: [2], fill: 3 });
    for (const y of [164, 168, 172]) cv.set(247, y, El[2]).set(248, y, El[2]);
    cv.shade(ehead, El, { top: [5], left: [5, 4], bottom: [1], right: [2], fill: 3 });
    cv.outline(INK, eear, { all: true });
    cv.shade(eear, El, { top: [4], left: [4], bottom: [0], right: [1], fill: 2 });
    cv.grad(cv.mask().oval(270, 161, 16, 22), [Pk[2], Pk[1]], { soft: 0.7 });
    eye(cv, 258, 168);
    cv.set(256, 166, INK).set(257, 165, INK);
    cv.dither(cv.mask().rect(255, 175, 4, 2), El[3], Pk[2], 0.5);
    cv.px([[255, 180], [256, 181], [257, 181], [258, 180]], INK);
    cv.rect(302, 186, 1, 6, El[1]).rect(301, 191, 2, 3, INK);

    // ---- birds gliding over the plain (two wing poses) ------------------------------------------
    const fa = cv.layer('fa'), fb = cv.layer('fb');
    for (const [x, y] of [[262, 12], [280, 22], [292, 8]]) {
      cv.rect(x + 2, y + 2, 1, 1, INK);
      sprite(fa, x, y, ['k...k', '.k.k.', '.....'], { k: INK });
      sprite(fb, x, y, ['.....', 'kk.kk', '.....'], { k: INK });
    }

    // ---- front grass tufts --------------------------------------------------------------------
    const blades = cv.mask();
    for (let x = 0; x < W; x += 2 + Math.floor(rnd() * 3)) {
      const h = 4 + Math.floor(rnd() * 10), lean = rnd() < 0.5 ? -1 : 1, y0 = 236;
      for (let k = 0; k < h; k++) blades.put(x + Math.round((k * k * lean) / (h * 2.2)), y0 - k);
    }
    for (const [cx, n] of [[24, 14], [96, 10], [210, 12], [282, 14]]) for (let i = 0; i < n; i++) {
      const x = cx - 12 + Math.floor(rnd() * 24), h = 8 + Math.floor(rnd() * 12), lean = rnd() < 0.5 ? -1 : 1;
      for (let k = 0; k < h; k++) blades.put(x + Math.round((k * k * lean) / (h * 2.5)), 232 - k);
    }
    cv.fill(blades, (x, y) => (y < 222 ? Gl[4] : y < 228 ? Gl[3] : Gl[2]));
    cv.fill(blades.sub(blades.shift(1, 0)).and(cv.mask().rect(0, 0, W, 226)), Gl[5]);

    cv.outline(INK);
    return cv.punch(...HOLE, HR);
  },
};
