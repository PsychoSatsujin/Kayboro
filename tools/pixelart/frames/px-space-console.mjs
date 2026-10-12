// Sci-fi console: chamfered gunmetal hull, armored bezel with HUD corner brackets, blinking LED banks,
// a chase light, keypad, hazard stripes, antenna, radar dish and a little robot peeking over the top.
import { Canvas } from '../pixel.mjs';
import { INK, inset, part, screw, slots } from '../kit.mjs';

const W = 296, H = 208, HOLE = [52, 52, 192, 108]; // 16:9
const M = ['#141a28', '#222b3f', '#334058', '#4a5a76', '#677a96', '#8fa3bd', '#c4d2e2']; // hull
const B = ['#07080f', '#0e1220', '#171d30', '#222a42', '#30395a', '#45507a']; // bezel
const Cy = ['#0b3f4a', '#13707e', '#22a7b5', '#56d9e0', '#b0fbff']; // teal accents
const Hz = ['#5a3a08', '#a8740f', '#ffc21a', '#ffe27a']; // hazard yellow
const LED = { r: ['#5a1a24', '#ff4d5e'], g: ['#1a4a30', '#5dff9a'], a: ['#5a3a10', '#ffb02e'], c: ['#12405a', '#7af0ff'] };
const oct = (cv, x, y, w, h, c) => cv.mask().poly([[x + c, y], [x + w - c, y], [x + w, y + c], [x + w, y + h - c], [x + w - c, y + h], [x + c, y + h], [x, y + h - c], [x, y + c]]);
const phase = (n, i) => `.p${i}{animation:ph ${n * 0.35}s steps(1) ${(-i * 0.35).toFixed(2)}s infinite}`;

export default {
  id: 'px-space-console', name: 'Star Console', theme: 'sci-fi', rarity: 'epic', translucent: false,
  tags: ['sci-fi', 'space', 'console', 'robot', 'blinking-lights', 'animated', 'widescreen', 'pixel'],
  css: [0, 1, 2, 3].map((i) => phase(4, i)).join('') + '@keyframes ph{0%,24%{opacity:1}25%,100%{opacity:0}}' +
    '.blink{animation:bl 1.1s steps(1) infinite}@keyframes bl{50%{opacity:0}}',
  draw() {
    const cv = new Canvas(W, H);
    cv.use(M, B, Cy, Hz);
    const lay = [0, 1, 2, 3].map((i) => cv.layer(`p${i}`)), blink = cv.layer('blink');
    const bulb = (x, y, k, n) => { cv.rect(x, y, 2, 2, LED[k][0]); if (n != null) lay[n % 4].rect(x, y, 2, 2, LED[k][1]).set(x, y, '#ffffff'); };

    // Antenna mast with a blinking beacon, and a radar dish.
    part(cv, cv.mask().rect(243, 8, 3, 22), M, { top: [6], left: [5], bottom: [1], right: [2], fill: 4, shadow: false });
    cv.rect(239, 14, 11, 2, M[3]).rect(240, 20, 9, 2, M[3]).rect(239, 14, 11, 1, M[5]).rect(240, 20, 9, 1, M[5]);
    cv.fill(cv.mask().circle(244, 5, 2), LED.r[0]);
    blink.fill(cv.mask().circle(244, 5, 2), LED.r[1]).set(243, 4, '#ffffff');
    const dish = cv.mask().oval(46, 6, 30, 16).sub(cv.mask().oval(46, 2, 30, 16));
    part(cv, cv.mask().rect(60, 18, 3, 11), M, { top: [5], left: [5], bottom: [1], right: [2], fill: 3, shadow: false });
    cv.shade(dish, M, { top: [6], left: [5], bottom: [1], right: [2], fill: 4 });
    cv.fill(cv.mask().line(61, 17, 70, 6), M[1]).fill(cv.mask().circle(70, 6, 1), Cy[3]);

    // Side pods, hull, feet.
    for (const [x, y] of [[4, 92], [258, 92]]) part(cv, cv.mask().rrect(x, y, 34, 84, 4), M, { top: [6], left: [5], bottom: [1], right: [2], fill: 3, shadow: false });
    for (const x of [62, 198]) {
      part(cv, cv.mask().rrect(x, 182, 36, 18, [0, 0, 4, 4]), M, { top: [4], left: [4], bottom: [0], right: [1], fill: 2, shadow: false });
      cv.rect(x + 6, 194, 24, 2, Cy[1]).rect(x + 7, 194, 8, 1, Cy[3]);
    }
    // Robot buddy peeking over the top edge (head behind the hull, hands in front).
    const head = cv.mask().rrect(121, 11, 20, 20, 4);
    part(cv, head, M, { top: [6], left: [5], bottom: [2], right: [3], fill: 4, shadow: false });
    cv.fill(cv.mask().rrect(124, 14, 14, 8, 2), B[1]);
    for (const x of [127, 134]) { cv.rect(x, 16, 2, 4, Cy[3]); cv.set(x, 16, Cy[4]); }
    cv.rect(130, 5, 2, 6, M[4]).rect(130, 5, 1, 6, M[5]).fill(cv.mask().circle(131, 3, 2), LED.a[0]);
    blink.fill(cv.mask().circle(131, 3, 2), LED.a[1]).set(130, 2, '#ffffff');
    cv.outline(INK, head.or(cv.mask().rect(130, 5, 2, 6)).or(cv.mask().circle(131, 3, 2)), {});

    const hull = oct(cv, 24, 26, 248, 158, 14);
    part(cv, hull, M, { top: [6, 5], left: [5], bottom: [0, 1], right: [1], fill: 3, shadow: false });
    for (const y of [38, 170]) cv.rect(38, y, 220, 1, M[1]).rect(38, y + 1, 220, 1, M[5]);
    for (const [x, y] of [[29, 31], [262, 31], [29, 174], [262, 174]]) screw(cv, x, y, [M[0], M[1], M[3], M[5]]);

    // Cable slung between the feet.
    for (let x = 98; x <= 198; x++) {
      const y = 190 + Math.round(Math.sin(((x - 98) / 100) * Math.PI) * 9);
      cv.set(x, y - 1, INK).set(x, y, Cy[2]).set(x, y + 1, Cy[1]).set(x, y + 2, INK);
    }

    // Armored bezel with a glowing trim and HUD brackets.
    const bezel = oct(cv, 42, 42, 212, 128, 8);
    cv.fill(bezel.dilate(2).sub(bezel.dilate(1)).and(hull.erode(2)), (x, y) => ((x + y) % 2 ? Cy[1] : M[3]));
    cv.fill(bezel.ring(), Cy[2]);
    part(cv, bezel, B, { top: [5], left: [4], bottom: [0], right: [1], fill: 2, dy: 2 });
    inset(cv, ...HOLE, 0, { rim: INK, top: B[0], bottom: B[4], right: B[3] }, 2);
    for (const [x, y, sx, sy] of [[46, 46, 1, 1], [249, 46, -1, 1], [46, 165, 1, -1], [249, 165, -1, -1]]) {
      cv.rect(sx > 0 ? x : x - 8, y, 9, 1, Cy[3]).rect(x, sy > 0 ? y : y - 8, 1, 9, Cy[3]);
    }
    cv.text('CH-01', 148 - (cv.textWidth('CH-01') >> 1), 163, Cy[2]);

    // Top strip: chase lights, robot, ID plate.
    for (let i = 0; i < 12; i++) bulb(48 + i * 5, 31, 'c', i);
    const plate = cv.mask().rect(196, 29, 34, 9);
    cv.shade(plate, Hz, { top: [3], left: [3], bottom: [0], right: [1], fill: 2 }).outline(INK, plate, { all: true });
    cv.text('SC-01', 199, 31, INK);
    for (const x of [114, 143]) part(cv, cv.mask().rrect(x, 23, 5, 6, 2), M, { top: [6], left: [5], bottom: [2], right: [3], fill: 4 }); // robot's hands

    // Power meters in the side margins: four phases step the level up and down.
    for (const x of [30, 262]) {
      cv.shade(cv.mask().rrect(x - 2, 54, 8, 108, 2), B, { top: [0], left: [0], bottom: [4], right: [3], fill: 1 });
      for (let k = 0; k < 13; k++) {
        const y = 156 - k * 8, c = k < 7 ? LED.g : k < 11 ? LED.a : LED.r;
        cv.rect(x, y, 4, 5, c[0]);
        [5, 9, 13, 8].forEach((lvl, i) => { if (k < lvl - (x > 100 ? 2 : 0)) lay[(i + (x > 100 ? 2 : 0)) % 4].rect(x, y, 4, 5, c[1]).rect(x, y, 4, 1, '#ffffff'); });
      }
    }

    // Hazard band along the bottom.
    cv.fill(cv.mask().rect(40, 173, 216, 7), (x, y) => ((x + y) % 8 < 4 ? Hz[2] : INK));
    cv.rect(40, 173, 216, 1, Hz[3]).rect(40, 179, 216, 1, Hz[0]);

    // Left pod: LED bank + vents. Right pod: keypad + dial.
    const panel = (x, y, w, h) => cv.shade(cv.mask().rrect(x, y, w, h, 2), B, { top: [0], left: [0], bottom: [4], right: [3], fill: 1 });
    panel(7, 100, 15, 38);
    'rgac agrc crga gacr'.split(' ').forEach((row, j) => [...row].forEach((k, i) => bulb(9 + i * 3, 104 + j * 8, k, (i * 3 + j * 2) % 4)));
    slots(cv, 7, 146, 15, 5, 5, M[0], M[5]);
    panel(274, 100, 16, 34);
    for (let j = 0; j < 4; j++) for (let i = 0; i < 3; i++) {
      const k = cv.mask().rect(276 + i * 4, 103 + j * 8, 3, 5);
      cv.shade(k, j === 3 && i === 2 ? Cy : M, { top: [4], left: [4], bottom: [0], right: [1], fill: 3 });
    }
    cv.fill(cv.mask().circle(282, 154, 7), B[1]);
    part(cv, cv.mask().circle(282, 154, 5), M, { top: [6], left: [5], bottom: [0], right: [1], fill: 4 });
    cv.fill(cv.mask().line(282, 154, 285, 151), Cy[3]);

    cv.outline(INK);
    return cv.punch(...HOLE);
  },
};
