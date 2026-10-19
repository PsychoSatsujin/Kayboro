// Sci-fi console: a riveted, plated gunmetal hull around a plain dark armored bezel with dim HUD corners.
// The busy parts live on the outer silhouette: an antenna array with a blinking beacon, a radar dish and a
// robot buddy peeking over the top; a porthole onto a ringed planet in the left pod; blinking light banks,
// a keypad and a dial in the right pod; a brass nameplate, hazard-striped feet and a slung cable below.
import { Canvas } from '../pixel.mjs';
import { INK, inset, part, screw, slots } from '../kit.mjs';

const W = 320, H = 224, HOLE = [64, 60, 192, 108]; // 16:9
const M = ['#141a28', '#222b3f', '#334058', '#4a5a76', '#677a96', '#8fa3bd', '#c4d2e2']; // hull
const B = ['#07080f', '#0e1220', '#171d30', '#222a42', '#30395a', '#45507a']; // bezel
const Cy = ['#0b3f4a', '#13707e', '#22a7b5', '#56d9e0', '#b0fbff']; // teal accents
const Hz = ['#5a3a08', '#a8740f', '#ffc21a', '#ffe27a']; // hazard yellow
const Br = ['#3e2a10', '#7a5a22', '#b08a40', '#dcc078']; // brass
const Pl = ['#3a1630', '#7a2e4a', '#c4564e', '#f08a52', '#ffc27a']; // planet
const LED = { r: ['#5a1a24', '#ff4d5e'], g: ['#1a4a30', '#5dff9a'], a: ['#5a3a10', '#ffb02e'], c: ['#12405a', '#7af0ff'] };
const oct = (cv, x, y, w, h, c) => cv.mask().poly([[x + c, y], [x + w - c, y], [x + w, y + c], [x + w, y + h - c], [x + w - c, y + h], [x + c, y + h], [x, y + h - c], [x, y + c]]);
const phase = (n, i) => `.p${i}{animation:ph ${n * 0.35}s steps(1) ${(-i * 0.35).toFixed(2)}s infinite}`;
const rivet = (cv, x, y) => cv.set(x, y, M[5]).set(x + 1, y + 1, M[1]);

export default {
  id: 'px-space-console', name: 'Star Console', theme: 'sci-fi', rarity: 'epic', translucent: false,
  desc: 'A riveted starship console with a planet porthole, an antenna array and a robot pal peeking over the top.',
  tags: ['sci-fi', 'space', 'console', 'robot', 'blinking-lights', 'animated', 'widescreen', 'pixel'],
  css: [0, 1, 2, 3].map((i) => phase(4, i)).join('') + '@keyframes ph{0%,24%{opacity:1}25%,100%{opacity:0}}' +
    '.blink{animation:bl 1.1s steps(1) infinite}@keyframes bl{50%{opacity:0}}',
  draw() {
    const cv = new Canvas(W, H);
    cv.use(M, B, Cy, Hz, Pl, Br);
    const lay = [0, 1, 2, 3].map((i) => cv.layer(`p${i}`)), blink = cv.layer('blink');
    const bulb = (x, y, k, n) => { cv.rect(x, y, 2, 2, LED[k][0]); if (n != null) lay[n % 4].rect(x, y, 2, 2, LED[k][1]).set(x, y, '#ffffff'); };
    const panel = (x, y, w, h) => cv.shade(cv.mask().rrect(x, y, w, h, 2), B, { top: [0], left: [0], bottom: [4], right: [3], fill: 1 });

    // Antenna array (right): a lattice mast with crossbars, two whips and a blinking beacon on the tallest.
    part(cv, cv.mask().rect(246, 6, 3, 26), M, { top: [6], left: [5], bottom: [1], right: [2], fill: 4, shadow: false });
    for (const [y, w] of [[12, 13], [18, 11], [24, 9]]) cv.rect(247 - (w >> 1), y, w, 2, M[3]).rect(247 - (w >> 1), y, w, 1, M[5]);
    for (const [x, top] of [[258, 14], [266, 20]]) {
      cv.rect(x, top, 1, 32 - top, M[4]).rect(x + 1, top, 1, 32 - top, M[2]);
      part(cv, cv.mask().circle(x, top - 1, 1), Cy, { top: [4], left: [4], bottom: [1], right: [2], fill: 3, shadow: false });
    }
    cv.fill(cv.mask().circle(247, 3, 2), LED.r[0]);
    blink.fill(cv.mask().circle(247, 3, 2), LED.r[1]).set(246, 2, '#ffffff');
    // Radar dish (left).
    const dish = cv.mask().oval(52, 8, 30, 16).sub(cv.mask().oval(52, 4, 30, 16));
    part(cv, cv.mask().rect(66, 20, 3, 11), M, { top: [5], left: [5], bottom: [1], right: [2], fill: 3, shadow: false });
    cv.shade(dish, M, { top: [6], left: [5], bottom: [1], right: [2], fill: 4 });
    cv.fill(cv.mask().line(67, 19, 76, 8), M[1]).fill(cv.mask().circle(76, 8, 1), Cy[3]);

    // Side pods with thruster nozzles underneath, feet.
    for (const x of [6, 290]) {
      const noz = cv.mask().poly([[x, 180], [x + 24, 180], [x + 21, 190], [x + 3, 190]]);
      part(cv, noz, M, { top: [4], left: [4], bottom: [0], right: [1], fill: 2, shadow: false });
      cv.rect(x + 5, 188, 14, 2, Cy[1]).rect(x + 7, 189, 10, 1, Cy[2]);
      for (let i = x + 4; i < x + 21; i += 4) cv.set(i, 183, M[1]).set(i, 184, M[1]);
    }
    for (const [x, y] of [[0, 86], [280, 86]]) part(cv, cv.mask().rrect(x, y, 40, 96, 5), M, { top: [6], left: [5], bottom: [1], right: [2], fill: 3, shadow: false });
    for (const x of [72, 212]) {
      const foot = cv.mask().rrect(x, 194, 36, 22, [0, 0, 4, 4]);
      part(cv, foot, M, { top: [4], left: [4], bottom: [0], right: [1], fill: 2, shadow: false });
      cv.fill(cv.mask().rect(x + 3, 206, 30, 6), (px, py) => ((px + py) % 8 < 4 ? Hz[2] : INK));
      cv.rect(x + 3, 206, 30, 1, Hz[3]).rect(x + 3, 211, 30, 1, Hz[0]);
    }
    // Robot buddy peeking over the top edge (head behind the hull, hands in front).
    const head = cv.mask().rrect(150, 13, 20, 20, 4);
    part(cv, head, M, { top: [6], left: [5], bottom: [2], right: [3], fill: 4, shadow: false });
    cv.fill(cv.mask().rrect(153, 16, 14, 8, 2), B[1]);
    for (const x of [156, 163]) { cv.rect(x, 18, 2, 4, Cy[3]); cv.set(x, 18, Cy[4]); }
    cv.rect(159, 7, 2, 6, M[4]).rect(159, 7, 1, 6, M[5]).fill(cv.mask().circle(160, 5, 2), LED.a[0]);
    blink.fill(cv.mask().circle(160, 5, 2), LED.a[1]).set(159, 4, '#ffffff');
    cv.outline(INK, head.or(cv.mask().rect(159, 7, 2, 6)).or(cv.mask().circle(160, 5, 2)), {});

    // Hull: plated, with seams and rivet rows.
    const hull = oct(cv, 28, 28, 264, 168, 16);
    part(cv, hull, M, { top: [6, 5], left: [5], bottom: [0, 1], right: [1], fill: 3, shadow: false });
    const seam = (x, y, w, h) => { cv.rect(x, y, w, h, M[1]); if (w > h) cv.rect(x, y + 1, w, 1, M[4]); else cv.rect(x + 1, y, 1, h, M[4]); };
    seam(44, 40, 232, 1); seam(44, 184, 232, 1); seam(42, 46, 1, 132); seam(277, 46, 1, 132);
    for (const y of [92, 136]) { seam(30, y, 12, 1); seam(279, y, 12, 1); }
    for (const x of [100, 220]) { seam(x, 30, 1, 10); seam(x, 186, 1, 9); }
    for (let x = 50; x < 272; x += 7) { rivet(cv, x, 35); rivet(cv, x, 189); }
    for (let y = 52; y < 176; y += 7) if (y < 92 || y > 150) { rivet(cv, 35, y); rivet(cv, 284, y); }
    for (const [x, y] of [[33, 33], [281, 33], [33, 186], [281, 186]]) screw(cv, x, y, [M[0], M[1], M[3], M[5]]);
    // alternate plates a shade darker so the hull reads as bolted panels
    for (const [x, y, w, h] of [[101, 29, 119, 11], [44, 186, 56, 9], [221, 186, 55, 9], [29, 93, 13, 43], [278, 93, 13, 43]])
      cv.fill(cv.mask().rect(x, y, w, h).and(hull.erode(2)), (px, py, c) => (c === M[3] ? M[2] : c === M[5] ? M[4] : c));
    // conduit along the top edge with clamps
    for (let x = 40; x < 98; x++) cv.set(x, 30, M[5]).set(x, 31, M[4]);
    for (let x = 223; x < 280; x++) cv.set(x, 30, M[5]).set(x, 31, M[4]);
    for (const x of [52, 70, 88, 232, 250, 268]) cv.rect(x, 29, 2, 4, M[2]).set(x, 29, M[6]);

    // Cable slung between the feet.
    for (let x = 108; x <= 212; x++) {
      const y = 202 + Math.round(Math.sin(((x - 108) / 104) * Math.PI) * 9);
      cv.set(x, y - 1, INK).set(x, y, Cy[2]).set(x, y + 1, Cy[1]).set(x, y + 2, INK);
    }

    // Armored bezel: plain and dark, with a dim trim and dim HUD corners.
    const bezel = oct(cv, 52, 48, 216, 132, 8);
    cv.fill(bezel.ring(), Cy[0]);
    part(cv, bezel, B, { top: [5], left: [4], bottom: [0], right: [1], fill: 2, dy: 2 });
    inset(cv, ...HOLE, 0, { rim: INK, top: B[0], bottom: B[4], right: B[3] }, 2);
    for (const [x, y, sx, sy] of [[57, 53, 1, 1], [262, 53, -1, 1], [57, 174, 1, -1], [262, 174, -1, -1]]) {
      cv.rect(sx > 0 ? x : x - 6, y, 7, 1, Cy[1]).rect(x, sy > 0 ? y : y - 6, 1, 7, Cy[1]);
    }

    // Top strip: a short chase-light row on the left, static status lights on the right.
    for (let i = 0; i < 10; i++) bulb(54 + i * 5, 32, 'c', i);
    for (const [i, k] of [[0, 'g'], [1, 'g'], [2, 'a']]) { cv.rect(232 + i * 6, 32, 3, 3, LED[k][0]); cv.set(232 + i * 6, 32, LED[k][1]); }
    for (const x of [143, 172]) part(cv, cv.mask().rrect(x, 25, 5, 6, 2), M, { top: [6], left: [5], bottom: [2], right: [3], fill: 4 }); // robot's hands

    // Brass nameplate with glyph strokes and a star, centered under the screen on the bottom strip.
    const plate = cv.mask().rrect(132, 185, 56, 10, 1);
    cv.shade(plate, Br, { top: [3], left: [3], bottom: [0], right: [1], fill: 2 }).outline(INK, plate, { all: true });
    for (const [x, w] of [[146, 6], [154, 3], [159, 8], [169, 4], [175, 6]]) cv.rect(x, 189, w, 2, Br[0]);
    cv.px([[138, 188], [137, 189], [138, 189], [139, 189], [138, 190], [136, 189], [140, 189]], Br[0]);
    cv.set(134, 190, Br[1]).set(185, 190, Br[1]);

    // Left pod: porthole onto a ringed planet, vents below.
    const pcx = 14, pcy = 114, pr = 11;
    cv.fill(cv.mask().circle(pcx, pcy, pr + 3), M[1]);
    part(cv, cv.mask().circle(pcx, pcy, pr + 2).sub(cv.mask().circle(pcx, pcy, pr)), M, { top: [6], left: [5], bottom: [1], right: [2], fill: 4, shadow: false });
    const glass = cv.mask().circle(pcx, pcy, pr - 1);
    cv.grad(glass, ['#0a0820', '#141038', '#221a50'], { dir: { cx: pcx + 4, cy: pcy + 4, r: pr * 1.6 } });
    for (const [x, y] of [[pcx - 7, pcy - 4], [pcx + 6, pcy - 7], [pcx - 4, pcy + 7], [pcx + 8, pcy + 3], [pcx - 1, pcy - 9]]) cv.set(x, y, '#ffffff');
    const planet = cv.mask().circle(pcx + 1, pcy + 1, 5).and(glass);
    cv.shade(planet, Pl, { top: [4], left: [3], bottom: [0], right: [1], fill: 2 });
    cv.fill(cv.mask().rect(pcx - 4, pcy + 1, 11, 1).and(planet), Pl[1]);
    const ring = cv.mask().oval(pcx - 8, pcy - 1, 19, 5).sub(cv.mask().oval(pcx - 6, pcy, 15, 3)).and(glass)
      .sub(cv.mask().circle(pcx + 1, pcy + 1, 5).and(cv.mask().rect(0, 0, W, pcy + 1)));
    cv.fill(ring, Cy[3]);
    cv.set(pcx - 5, pcy - 6, '#ffffff').set(pcx - 6, pcy - 5, Cy[4]); // glint on the glass
    for (let k = 0; k < 8; k++) { const a = (k * Math.PI) / 4; cv.set(Math.round(pcx + Math.cos(a) * (pr + 1)), Math.round(pcy + Math.sin(a) * (pr + 1)), M[6]); }
    panel(5, 92, 22, 7);
    for (let i = 0; i < 6; i++) bulb(7 + i * 3, 94, i % 3 ? 'c' : 'a', i);
    slots(cv, 5, 136, 21, 6, 5, M[0], M[5]);

    // Right pod: blinking light banks, keypad and a dial.
    panel(293, 92, 22, 30);
    'rgacg agrcg crgaa gacrc'.split(' ').forEach((row, j) => [...row].forEach((k, i) => bulb(295 + i * 4, 95 + j * 7, k, (i * 3 + j * 2) % 4)));
    panel(293, 126, 22, 26);
    for (let j = 0; j < 3; j++) for (let i = 0; i < 4; i++) {
      const k = cv.mask().rect(295 + i * 5, 129 + j * 7, 4, 5);
      cv.shade(k, j === 2 && i === 3 ? Cy : M, { top: [4], left: [4], bottom: [0], right: [1], fill: 3 });
    }
    cv.fill(cv.mask().circle(304, 166, 7), B[1]);
    part(cv, cv.mask().circle(304, 166, 5), M, { top: [6], left: [5], bottom: [0], right: [1], fill: 4 });
    cv.fill(cv.mask().line(304, 166, 307, 163), Cy[3]);

    // Hull side strips: static indicators and a few slots, kept dim next to the bezel.
    for (const x of [33, 283]) {
      for (const [y, k] of [[98, 'g'], [104, 'g'], [110, 'a']]) cv.rect(x, y, 3, 3, LED[k][0]).set(x, y, LED[k][1]);
      slots(cv, x - 1, 124, 6, 5, 4, M[1], M[4]);
    }

    cv.outline(INK);
    return cv.punch(...HOLE);
  },
};
