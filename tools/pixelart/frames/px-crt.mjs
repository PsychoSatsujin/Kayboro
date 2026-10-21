// Cherry-red portable CRT: cream bezel round a curved tube, channel + volume dials, rabbit-ear antenna.
import { Canvas } from '../pixel.mjs';
import { INK, SHAPES, inset, part, led, slots, sticker } from '../kit.mjs';

const W = 256, H = 240, HOLE = [28, 84, 160, 120], HR = 6; // 4:3, rounded tube corners
const R = ['#3b0d24', '#6e1631', '#a3243b', '#d23f45', '#ef6a55', '#ff9b78', '#ffd0b0']; // cherry plastic
const C = ['#6b5a4e', '#a08b78', '#c9b59c', '#e6d6bc', '#f7eedc', '#fffaf0']; // cream bezel
const T = ['#0e0b14', '#1c1724', '#2a2334', '#3a3146', '#4c4259', '#6a5f7c']; // tube glass
const G = ['#3a3a4e', '#6a6b82', '#9a9cb2', '#c8cadb', '#f2f3fb']; // chrome

function knob(cv, x, y, r) {
  part(cv, cv.mask().circle(x, y, r), C, { top: [5], left: [4], bottom: [0], right: [1], fill: 3, dy: 2 });
  cv.fill(cv.mask().circle(x, y, r - 1).sub(cv.mask().circle(x, y, r - 3)), (px, py, c) => {
    const a = Math.atan2(py - y, px - x);
    return Math.round((a / Math.PI) * 2 * r) % 2 ? cv.step(c, -1) : c; // grip ridges
  });
  cv.shade(cv.mask().circle(x, y, r - 4), C, { top: [5], left: [5], bottom: [2], right: [2], fill: 4 });
  return cv;
}

export default {
  id: 'px-crt', name: 'Rabbit-Ear CRT', theme: 'tv', rarity: 'common', translucent: false,
  tags: ['tv', 'crt', 'retro', 'antenna', 'pixel'],
  draw() {
    const cv = new Canvas(W, H);
    cv.use(R, C, T, G);

    // Rabbit ears: chrome telescoping rods with ball tips on a little dome.
    for (const [x0, y0, x1, y1] of [[180, 60, 120, 8], [188, 60, 238, 14]]) {
      const rod = cv.mask().line(x0, y0, x1, y1);
      cv.fill(rod, G[3]).fill(rod.shift(0, 1).sub(rod), G[1]);
      const mid = [Math.round((x0 + x1) / 2), Math.round((y0 + y1) / 2)];
      cv.fill(cv.mask().rect(mid[0] - 1, mid[1] - 1, 3, 3), G[2]).set(mid[0] - 1, mid[1] - 1, G[4]);
      const tip = cv.mask().circle(x1, y1, 2);
      cv.shade(tip, G, { top: [4], left: [3], bottom: [0], right: [1], fill: 2 });
    }
    const dome = cv.mask().oval(170, 52, 28, 22).clip(0, 0, W, 64);
    part(cv, dome, G, { top: [4], left: [3], bottom: [1], right: [1], fill: 2, shadow: false });

    // Feet and body.
    for (const x of [22, 210]) cv.shade(cv.mask().rrect(x, 222, 24, 12, [0, 0, 4, 4]), G, { top: [3], left: [3], bottom: [0], right: [1], fill: 2 });
    const body = cv.mask().rrect(6, 64, 244, 162, 12);
    cv.shade(body, R, { top: [6, 5], left: [5], bottom: [0, 1], right: [1], fill: 3 });
    cv.rect(10, 220, 236, 1, R[2]); // lower seam

    // Cream bezel, dark tube, curved glass.
    const bezel = cv.mask().rrect(16, 72, 184, 146, 6);
    part(cv, bezel, C, { top: [5], left: [4], bottom: [1], right: [2], fill: 3, ink: R[0] });
    const tube = cv.mask().rrect(22, 78, 172, 132, 10);
    cv.shade(tube, T, { top: [0, 1], left: [0], bottom: [4], right: [3], fill: 2 });
    inset(cv, ...HOLE, HR, { rim: INK, top: T[1], bottom: T[3], right: T[3] }, 1);
    cv.px([[26, 86], [26, 85], [27, 84], [27, 83], [28, 82], [29, 82], [30, 81]], T[5]).px([[33, 81], [34, 81]], T[4]); // glint
    cv.text('KAYBORO', 108 - (cv.textWidth('KAYBORO') >> 1), 211, C[1]);
    sticker(cv, 177, 71, SHAPES.heart, ['#7a1446', '#c22a6b', '#ff5c9a', '#ff9cc4', '#ffd8e8']);
    led(cv, 186, 211, ['#5c0a0a', '#e2352f', '#ff8a6a', '#ffe8d8'], { d: 3 });

    // Controls: channel dial with tick ring, volume, speaker, power.
    cv.text('VHF', 218, 74, R[5]);
    for (let k = 0; k < 12; k++) {
      const a = (k / 12) * Math.PI * 2;
      cv.set(Math.round(224 + Math.cos(a) * 17), Math.round(100 + Math.sin(a) * 17), k % 3 ? R[1] : R[6]);
    }
    knob(cv, 224, 100, 13);
    cv.fill(cv.mask().capsule(224, 100, 230, 91, 1.2), T[1]);
    knob(cv, 224, 136, 9);
    cv.fill(cv.mask().capsule(224, 136, 219, 130, 1), T[1]);
    const grille = cv.mask().rrect(209, 152, 31, 46, 3);
    cv.shade(grille, R, { top: [0], left: [1], bottom: [5], right: [4], fill: 2 });
    slots(cv, 212, 156, 25, 7, 6, T[0], R[1]);
    part(cv, cv.mask().rrect(210, 204, 14, 9, 2), T, { top: [5], left: [4], bottom: [0], right: [1], fill: 3 });
    led(cv, 232, 207, ['#0b3a22', '#2fd07a', '#9dffc8', '#f0fff6'], { d: 3 });
    cv.text('ON', 229, 213, R[5]);

    cv.outline(INK);
    return cv.punch(...HOLE, HR);
  },
};

// Palette arrays by name, for skins (tools/pixelart/skins) that redraw this shell in other colors.
export const PALETTES = { R, C, T, G };
