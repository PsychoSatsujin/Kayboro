// Portrait handheld in frosted sea-glass plastic: an arched dome top with the smoky lens following the
// curve, a pinched waist and a round symmetric bottom. Controls: a dimpled dial pad, a ribbed thumbwheel
// in its slot, a vertical tower of two buttons, a round sunburst speaker flanked by two slider switches.
import { Canvas, alpha, bayer } from '../pixel.mjs';
import { INK, SHAPES, inset, led, part, sprite, sticker } from '../kit.mjs';

const W = 176, H = 288, HOLE = [28, 34, 120, 108]; // 10:9
const CX = 88; // symmetry axis (pixel-edge coordinate)
const P = ['#0b2a40', '#134a68', '#1d6c8e', '#2c8fb2', '#4cb1d0', '#8dd5e8', '#d6f5ff']; // frosted sea-glass
const S = ['#0f1116', '#191c24', '#252a34', '#333945', '#454c5b', '#626a7c', '#959db0']; // smoky lens
const D = ['#11141a', '#1e222c', '#2d323f', '#414857', '#5b6376', '#7f889c']; // charcoal rubber
const C = ['#5e1a12', '#9e3020', '#e0553a', '#ff8a5e', '#ffbb94', '#ffe6d6']; // coral button
const Y = ['#8a4a0c', '#cf8a18', '#ffc43a', '#ffe17a', '#fff4c4', '#fffbe8']; // sun button + sticker

// Silhouette half-width per row: arched dome, straight shoulders, a soft waist pinch, round bottom corners.
function halfW(y) {
  const yc = y + 0.5;
  if (yc < 72) { const t = (72 - yc) / 71; return t >= 1 ? -1 : 87 * Math.sqrt(1 - t * t); }
  if (yc < 150) return 87;
  if (yc < 190) return 87 - 6 * Math.sin((Math.PI * (yc - 150)) / 40);
  if (yc < 230) return 87;
  const d = yc - 230;
  return d > 56 ? -1 : 87 - (56 - Math.sqrt(56 * 56 - d * d));
}

const recess = (cv, m) => cv.shade(m, P, { top: [1], left: [1], bottom: [5], right: [4], fill: 2 });

export default {
  id: 'px-pocket', name: 'Pixel Pocket', theme: 'handheld', rarity: 'common', translucent: true,
  desc: 'A frosty sea-glass pocket console with a dimpled dial and a thumbwheel for scrolling through snacks.',
  tags: ['handheld', 'portrait', 'retro', 'clear-plastic', 'pixel'],
  draw() {
    const cv = new Canvas(W, H);
    cv.use(P, S, D, C, Y);
    const body = cv.mask().plot((x, y) => Math.abs(x + 0.5 - CX) <= halfW(y));
    cv.shade(body, P, { top: [6, 5], left: [5], bottom: [1, 2], right: [2], fill: 3 });

    // Arched smoky lens following the dome, squared off below the screen with rounded corners.
    const lens = body.erode(9).and(cv.mask().rrect(9, 0, W - 18, 154, [0, 0, 14, 14]));
    part(cv, lens, S, { top: [5], left: [4], bottom: [1], right: [2], fill: 3, shadow: -1, ink: P[0] });
    inset(cv, ...HOLE, 0, { rim: INK, top: S[1], bottom: S[5], right: S[4] }, 2);
    // Glare: two parallel streaks across the dome glass, kept off the screen rim.
    const glare = cv.mask().capsule(14, 70, 62, 12, 0.7).or(cv.mask().capsule(18, 80, 74, 12, 0.5));
    cv.fill(glare.and(lens.erode(1)).sub(cv.mask().rect(HOLE[0] - 3, HOLE[1] - 3, HOLE[2] + 6, HOLE[3] + 6)), S[4]);

    // Dome crown: a little sunrise glyph with rays, a power LED on the left, three level ticks on the right.
    const sun = cv.mask().circle(CX, 30, 4).and(cv.mask().rect(0, 0, W, 30));
    cv.fill(sun, S[6]);
    for (const [x, y] of [[CX - 8, 26], [CX + 8, 26], [CX - 5, 21], [CX + 5, 21], [CX, 19]]) cv.set(x, y, S[5]);
    for (const [x0, x1] of [[50, CX - 10], [CX + 11, 126]]) cv.rect(x0, 29, x1 - x0, 1, S[4]);
    led(cv, 40, 27, ['#5a1410', '#e0553a', '#ff9a74', '#ffe6d6'], { d: 3 });
    [0, 1, 2].forEach((i) => cv.rect(130 + i * 3, 29 - i, 2, 1 + i, i < 2 ? '#7fe0c8' : S[4]));

    // Dial pad: a round charcoal disk with four notches and a thumb dimple, in a frosted well.
    const [dx, dy] = [44, 206];
    recess(cv, cv.mask().circle(dx, dy, 25));
    const disk = cv.mask().circle(dx, dy, 21);
    part(cv, disk, D, { top: [5, 4], left: [4], bottom: [0], right: [1], fill: 3, dy: 2 });
    const ringM = cv.mask().circle(dx, dy, 15).edge(true);
    cv.fill(ringM, (x, y) => (x + y < dx + dy ? D[1] : D[4]));
    for (const [ox, oy, rows] of [[-2, -19, ['..#..', '.###.', '#####']], [-2, 17, ['#####', '.###.', '..#..']],
      [-19, -2, ['..#', '.##', '###', '.##', '..#']], [17, -2, ['#..', '##.', '###', '##.', '#..']]]) {
      sprite(cv, dx + ox, dy + oy, rows, { '#': D[1] });
    }
    const dimple = cv.mask().circle(dx, dy, 6);
    cv.shade(dimple, D, { top: [0, 1], left: [1], bottom: [5], right: [4], fill: 2 });
    cv.px([[dx - 14, dy - 8], [dx - 13, dy - 10], [dx - 12, dy - 11], [dx - 10, dy - 13], [dx - 8, dy - 14]], D[5]);

    // Thumbwheel: ribbed charcoal roller peeking out of a slot between the dial and the buttons.
    const slot = cv.mask().rrect(CX - 8, 184, 16, 46, 6);
    recess(cv, slot);
    cv.fill(slot.edge(), INK);
    const wheel = cv.mask().rrect(CX - 5, 188, 10, 38, 4);
    cv.fill(wheel, (x, y) => {
      const t = Math.abs(y + 0.5 - 207) / 19, i = t > 0.85 ? 0 : t > 0.6 ? 1 : t > 0.3 ? 2 : 3;
      return D[x === CX - 5 ? Math.min(5, i + 1) : x >= CX + 3 ? Math.max(0, i - 1) : i];
    });
    for (let y = 190; y < 226; y += 3) cv.fill(cv.mask().rect(CX - 5, y, 10, 1).and(wheel), (x, yy, c) => cv.step(c, -1));

    // Button tower: two big round keys stacked straight up and down in a pill-shaped well.
    const tx = 132;
    recess(cv, cv.mask().capsule(tx, 190, tx, 224, 15));
    for (const [y, R, g] of [[190, C, 'up'], [224, Y, 'dot']]) {
      part(cv, cv.mask().circle(tx, y, 10), R, { top: [4], left: [3], bottom: [0], right: [1], fill: 2, dy: 2 });
      cv.px([[tx - 6, y - 4], [tx - 5, y - 5], [tx - 4, y - 6], [tx - 5, y - 4]], R[5]);
      if (g === 'up') sprite(cv, tx - 2, y - 1, ['..#..', '.###.', '#####'], { '#': R[1] });
      else cv.fill(cv.mask().circle(tx, y, 2, 1.4), R[1]);
    }

    // Sunburst speaker: concentric rings of round holes on the bottom centre.
    const [sx, sy] = [CX, 260];
    const holes = [[0, 0]];
    for (let k = 0; k < 6; k++) holes.push([Math.round(6 * Math.cos((k * Math.PI) / 3)), Math.round(6 * Math.sin((k * Math.PI) / 3))]);
    for (let k = 0; k < 12; k++) holes.push([Math.round(12 * Math.cos(((k + 0.5) * Math.PI) / 6)), Math.round(12 * Math.sin(((k + 0.5) * Math.PI) / 6))]);
    recess(cv, cv.mask().circle(sx, sy, 16));
    for (const [ox, oy] of holes) {
      const x = sx + ox - 1, y = sy + oy - 1;
      cv.rect(x, y, 2, 2, INK).set(x + 2, y + 1, P[5]).set(x + 1, y + 2, P[5]);
    }

    // Two slider switches flanking the speaker, each with a tiny glyph above.
    for (const [x, on, glyph] of [[22, false, ['..#..', '#.#.#', '#.#.#', '#...#', '.###.']], [124, true, ['..#', '.##', '###', '.##', '..#']]]) {
      const track = cv.mask().rrect(x, 258, 30, 8, 4);
      recess(cv, track.dilate(1));
      cv.fill(track, D[0]).fill(track.and(cv.mask().rect(0, 265, W, 1)), D[2]);
      const kx = on ? x + 17 : x + 1;
      part(cv, cv.mask().rrect(kx, 256, 12, 12, 3), D, { top: [5], left: [4], bottom: [0], right: [1], fill: 3, dy: 1 });
      for (const i of [3, 6, 9]) cv.rect(kx + i - 1, 259, 1, 6, D[1]).rect(kx + i, 259, 1, 6, D[4]);
      sprite(cv, x + 12, 247, glyph, { '#': P[1] });
      cv.set(on ? x + 26 : x + 4, 249, on ? '#7fe0c8' : P[1]);
    }

    // Gloss streaks down the left shoulder and around the dome edge.
    cv.fill(cv.mask().capsule(5, 84, 5, 140, 0.5).or(cv.mask().capsule(5, 150, 5, 156, 0.5)).and(body.erode(2)), P[6]);

    // Star sticker on the right shoulder above the controls.
    sticker(cv, 150, 160, SHAPES.star, Y);
    cv.px([[153, 163], [155, 163], [153, 164], [155, 164]], '#3a1d10').px([[154, 165]], C[2]);

    // Frost speckle on the flat faces, then the see-through pass: thick edges denser than the faces.
    const face = body.erode(3).sub(lens.dilate(2));
    cv.fill(face, (x, y, c) => (c === P[3] && bayer(x * 3 + 1, y * 5 + 2) < 0.06 ? P[4] : c));
    const thick = body.edge().or(body.erode(1).edge());
    cv.fill(body, (x, y, c) => (P.includes(c) ? alpha(c, thick.has(x, y) ? 0.92 : 0.6) : c));

    cv.outline(INK);
    return cv.punch(...HOLE);
  },
};
