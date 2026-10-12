// Clear bubblegum virtual-pet egg on a key ring: pearl screen plate with care icons, three lemon
// buttons and the little sprout pet printed under them.
import { Canvas, alpha } from '../pixel.mjs';
import { INK, SHAPES, inset, part, sprite, sparkle } from '../kit.mjs';

const W = 180, H = 248, HOLE = [42, 64, 96, 96], HR = 4; // 1:1
const E = ['#6e1d4f', '#a8336f', '#d9548f', '#f47fb0', '#ffa9cb', '#ffd3e4', '#fff1f6']; // clear pink shell
const Pl = ['#4f3f63', '#8a7aa3', '#bdb0d3', '#e1d8ef', '#f5f1fb', '#ffffff']; // pearl plate
const Y = ['#8a5a12', '#d0951f', '#ffc83d', '#ffe27a', '#fff6c4']; // lemon buttons
const G = ['#3a3a4e', '#6a6b82', '#9a9cb2', '#c8cadb', '#f2f3fb']; // key ring

// Egg: a plump superellipse whose half-width swells toward the bottom.
const egg = (cv, cx, cy, a, b, k = 0.08) => cv.mask().plot((x, y) => {
  const u = (x + 0.5 - cx) / a, v = (y + 0.5 - cy) / b;
  return Math.abs(u / (1 + k * v)) ** 2.5 + Math.abs(v) ** 2.2 <= 1;
});

const ICONS = [
  ['..#..', '.###.', '#####', '#####', '.###.'], // apple
  ['.###.', '#####', '#####', '.###.', '..#..'], // light
  ['.###.', '#.#.#', '#####', '#.#.#', '.###.'], // game
  ['..#..', '..#..', '#####', '..#..', '..#..'], // medicine
  ['.##..', '###..', '.####', '.####', '..##.'], // duck
  SHAPES.heart5, // love (active)
  ['..#..', '.###.', '#####', '.###.', '.#.#.'], // star
  ['..###', '..#.#', '..#.#', '###.#', '##...'], // music
];

export default {
  id: 'px-pet-egg', name: 'Pixel Pet Egg', theme: 'virtual-pet', rarity: 'common', translucent: true,
  tags: ['virtual-pet', 'egg', 'kawaii', 'clear-plastic', 'pixel', 'square'],
  draw() {
    const cv = new Canvas(W, H);
    cv.use(E, Pl, Y, G);
    const shell = egg(cv, 90, 133, 84, 111);

    // Loop nub + key ring.
    part(cv, cv.mask().rrect(81, 14, 19, 14, 4), E, { top: [6], left: [5], bottom: [1], right: [2], fill: 4, shadow: false });
    const ring = cv.mask().circle(90, 10, 8).sub(cv.mask().circle(90, 10, 4));
    cv.shade(ring, G, { top: [4], left: [3], bottom: [0], right: [1], fill: 2 });
    cv.fill(ring.and(cv.mask().rect(83, 15, 15, 6)), (x, y, c) => cv.step(c, -1));

    // Shell: raised rim around a recessed face.
    cv.shade(shell, E, { top: [6, 5], left: [5], bottom: [1, 2], right: [2], fill: 4 });
    const face = egg(cv, 90, 134, 77, 103);
    cv.shade(face, E, { top: [2], left: [2], bottom: [5], right: [5], fill: 3 });

    for (let t = 236; t <= 264; t += 0.5) { // gloss streak on the face
      const a = (t * Math.PI) / 180, x = Math.round(90 + 74 * Math.cos(a)), y = Math.round(134 + 98 * Math.sin(a));
      cv.set(x, y, E[6]).set(x, y + 1, t < 242 || t > 258 ? E[4] : E[5]);
    }

    // Pearl plate with care icons and the LCD window.
    const plate = cv.mask().rrect(30, 52, 120, 120, 14);
    part(cv, plate, Pl, { top: [5], left: [4], bottom: [1], right: [2], fill: 3, dy: 2, ink: E[0] });
    inset(cv, ...HOLE, HR, { rim: INK, top: Pl[1], bottom: Pl[4], right: Pl[4] }, 2);
    ICONS.forEach((ic, i) => sprite(cv, 55 + (i % 4) * 22, i < 4 ? 55 : 165, ic, { '#': i === 5 ? E[2] : Pl[1] }));

    // Three lemon buttons on a smile.
    for (const [x, y] of [[62, 191], [90, 196], [118, 191]]) {
      cv.shade(cv.mask().circle(x, y, 10), E, { top: [2], left: [2], bottom: [5], right: [5], fill: 3 });
      part(cv, cv.mask().circle(x, y, 7), Y, { top: [4], left: [3], bottom: [0], right: [1], fill: 2, dy: 2 });
      cv.px([[x - 3, y - 4], [x - 4, y - 3], [x - 3, y - 3]], '#ffffff');
    }

    // Printed sprout pet, sparkles and hearts.
    const pet = cv.mask().oval(80, 218, 21, 16);
    cv.outline(E[0], pet, { all: true });
    cv.shade(pet, Pl, { top: [5], left: [5], bottom: [2], right: [3], fill: 4 });
    sprite(cv, 87, 211, ['ll...ll', 'lLl.lLl', '.lLsLl.', '...s...', '...s...', '...s...'], { l: '#2f9a5e', L: '#8fe39a', s: '#2b7a4c' });
    sprite(cv, 85, 224, ['..e.....e..', '..e.....e..', 'b....m....b'], { e: INK, b: E[3], m: E[1] });
    sparkle(cv, 24, 96, 2, E[6], '#ffffff');
    sparkle(cv, 157, 70, 1, E[6], '#ffffff');
    sparkle(cv, 152, 136, 2, E[6], '#ffffff');
    sparkle(cv, 34, 214, 1, E[6], '#ffffff');
    sprite(cv, 20, 168, SHAPES.heart5, { '#': E[5] });
    sprite(cv, 150, 214, SHAPES.heart5, { '#': E[5] });

    // See-through pass: thick edges stay denser than the flat faces.
    const thick = shell.edge().or(shell.erode(1).edge());
    cv.fill(shell, (x, y, c) => (E.includes(c) ? alpha(c, thick.has(x, y) ? 0.94 : 0.8) : c));

    cv.outline(INK);
    return cv.punch(...HOLE, HR);
  },
};
