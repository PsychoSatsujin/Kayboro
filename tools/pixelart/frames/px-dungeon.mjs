// Dungeon window: a deep stone opening under a voussoir arch with a keystone, two flickering wall
// torches washing the stones in warm light, ivy, a mossy sill, a slime and some mushrooms.
import { Canvas, rng, bayer, mix } from '../pixel.mjs';
import { INK, inset, part, sprite, spriteMask } from '../kit.mjs';

const W = 272, H = 200, HOLE = [40, 60, 192, 108]; // 16:9
const S = ['#1c1826', '#2e2a3b', '#454055', '#5f5a70', '#7c778e', '#9c98ac', '#c4c1d0']; // stone
const SW = ['#2a1c20', '#4a3330', '#6e4f42', '#957056', '#bb946a', '#dfb985', '#fbe0a8'].map((c, i) => mix(S[i], c, 0.65)); // torch-lit stone
const Mo = ['#1f3b2c', '#2f5e3a', '#4c8a45', '#7dbb55', '#b6e07a']; // moss / ivy
const Wd = ['#2e1a12', '#4f2e1c', '#74452a', '#9a6438', '#c48a52']; // wood
const Fe = ['#14121a', '#262330', '#3b3748', '#565166', '#7c7790']; // iron
const FL = { 1: '#d8401a', 2: '#ff7a1f', 3: '#ffb52e', 4: '#ffe36b', 5: '#fff8d0' };
const FLAMES = [
  ['....1....', '...11....', '...121...', '..1221...', '..12321..', '.122321..', '.1234321.', '.1234321.', '123454321', '123454321', '123555321', '.1234321.', '..12321..'],
  ['.....1...', '....11...', '....121..', '...1221..', '...12321.', '..123321.', '.1234321.', '.1234321.', '123454321', '123454321', '123555321', '.1234321.', '..12321..'],
];
const CX = 136, CY = 286, RO = 280, RI = 248, RM = 264; // segmental arch

export default {
  id: 'px-dungeon', name: 'Dungeon Window', theme: 'fantasy', rarity: 'rare', translucent: false,
  tags: ['fantasy', 'dungeon', 'stone', 'torch', 'rpg', 'animated', 'widescreen', 'pixel'],
  css: '.fa{animation:fl .42s steps(1) infinite}.fb{animation:fl .42s steps(1) -.21s infinite}' +
    '@keyframes fl{50%{opacity:0}}',
  draw() {
    const cv = new Canvas(W, H), rnd = rng(7);
    cv.use(S, SW, Mo, Wd, Fe);
    const d = (x, y) => Math.hypot(x + 0.5 - CX, y + 0.5 - CY);
    const outer = cv.mask().plot((x, y) => d(x, y) <= RO && y < 172, 6, 0, W - 6, 172);
    const below = (x, y) => d(x, y) < RI;

    // Every stone is its own mask; whatever stone area no block claims is mortar.
    const blocks = [];
    const stone = (m) => { if (m.bbox()) blocks.push(m); };
    for (let k = -12; k <= 12; k++) for (const [r0, r1, off] of [[RI, RM, 0], [RM, RO + 6, 0.5]]) { // voussoirs, two courses
      const a0 = (k - 0.5 + off) * 0.052, a1 = a0 + 0.052, key = k === 0 && !off;
      stone(cv.mask().plot((x, y) => {
        const a = Math.atan2(x + 0.5 - CX, CY - y - 0.5), r = d(x, y);
        if (key) return Math.abs(a) * r < 6.5 + (r - RI) * 0.16 && r >= RI - 6 && r <= RO + 5;
        return a > a0 && a < a1 && (a - a0) * r > 0.8 && (a1 - a) * r > 0.6 && r > r0 + 0.6 && r < r1 - 0.4 && r <= RO && Math.abs(a) * r > 7.5 + (r - RI) * 0.16;
      }, 0, 0, W, 90));
    }
    for (let row = 0; row < 4; row++) { // tympanum bricks under the arch
      const y = 53 - row * 7, off = row % 2 ? 9 : 0;
      for (let x = 40 - off; x < 232; x += 19) stone(cv.mask().rect(Math.max(x, 40), y, Math.min(18, 232 - Math.max(x, 40)) - (x < 40 ? 40 - x : 0), 6).and(cv.mask().plot((i, j) => d(i, j) < RI - 1.5, 30, 0, 242, 60)));
    }
    for (const x0 of [6, 232]) { // pillars, running bond
      let y = 168, row = 0;
      while (y > 30) {
        const h = 12 + Math.floor(rnd() * 4), cut = row % 2 ? [x0, x0 + 34] : [x0, x0 + 15 + Math.floor(rnd() * 6), x0 + 34];
        for (let i = 0; i + 1 < cut.length; i++) stone(cv.mask().rect(cut[i] + (i ? 1 : 0), y - h + 1, cut[i + 1] - cut[i] - (i ? 1 : 0), h - 1).and(cv.mask().plot(below, x0, 0, x0 + 34, 168)));
        y -= h; row++;
      }
    }
    cv.fill(outer, S[0]);
    for (const b of blocks) {
      const f = rnd() < 0.2 ? 2 : rnd() < 0.2 ? 4 : 3;
      cv.shade(b, S, { top: [Math.min(6, f + 2)], left: [f + 1], bottom: [Math.max(0, f - 2)], right: [f - 1], fill: f });
      b.erode(1).each((x, y) => { const r = rnd(); if (r < 0.05) cv.set(x, y, S[f - 1]); else if (r < 0.08) cv.set(x, y, S[f + 1]); });
      if (rnd() < 0.18) { const bb = b.bbox(); let x = bb.x + 3 + Math.floor(rnd() * Math.max(1, bb.w - 6)), y = bb.y + 2; while (b.has(x, y + 1) && y < bb.y + bb.h - 3) { cv.set(x, y, S[1]); y++; x += Math.round(rnd() * 2 - 1); } }
    }

    const gem = ['..a..', '.abc.', 'abbcd', '.cdd.', '..d..'];
    cv.outline(INK, spriteMask(cv, 134, 14, gem), { all: true });
    sprite(cv, 134, 14, gem, { a: '#e8fdff', b: '#7af0ff', c: '#3fb6d8', d: '#1b6f9a' });

    // Sill slab and corbels.
    const sill = cv.mask().rrect(0, 168, W, 13, 2);
    cv.fill(sill, S[0]);
    for (const [a, b] of [[0, 90], [91, 181], [182, W]]) {
      const m = cv.mask().rect(a + (a ? 0 : 1), 169, b - a - 1 - (b === W ? 1 : 0), 11).and(sill);
      cv.shade(m, S, { top: [6, 5], left: [4], bottom: [1], right: [2], fill: 3 });
    }
    for (const x of [26, 222]) {
      const c = cv.mask().rect(x, 181, 24, 5).rect(x + 3, 186, 18, 4).rect(x + 7, 190, 10, 4);
      cv.shade(c, S, { top: [2], left: [4], bottom: [0], right: [1], fill: 3 });
    }

    // Deep reveal: shadowed lintel and jamb, sill catching light.
    inset(cv, ...HOLE, 0, { rim: INK, top: S[0], left: S[1], bottom: S[4], right: S[2] }, 3);

    // Torches: iron sconce, wooden haft, cup; warm light washes the stone; two flame frames flicker.
    const torches = [[23, 104], [249, 104]];
    const lit = cv.mask().rect(0, 0, W, H).and(cv.opaque());
    for (const [x, y] of torches) {
      cv.fill(lit, (px, py, c) => {
        const i = S.indexOf(c), t = Math.hypot(px + 0.5 - x, (py + 0.5 - y + 8) * 1.1) / 42;
        if (i < 0 || t >= 1) return c;
        const k = (1 - t) ** 1.3 * 2.1, step = Math.floor(k) + (k % 1 > bayer(px, py) ? 1 : 0);
        return step ? SW[Math.min(6, i + step - 1)] : c;
      });
    }
    const base = cv.p.slice();
    for (const [x, y] of torches) {
      part(cv, cv.mask().rrect(x - 4, y + 10, 9, 15, 2), Fe, { top: [4], left: [3], bottom: [0], right: [1], fill: 2 });
      cv.set(x, y + 13, Fe[4]).set(x, y + 21, Fe[4]);
      part(cv, cv.mask().rect(x - 1, y + 2, 3, 20), Wd, { top: [4], left: [3], bottom: [0], right: [1], fill: 2, shadow: false });
      part(cv, cv.mask().rect(x - 3, y + 14, 7, 3), Fe, { top: [4], left: [3], bottom: [0], right: [1], fill: 2, shadow: false });
      part(cv, cv.mask().poly([[x - 5, y - 1], [x + 6, y - 1], [x + 4, y + 4], [x - 3, y + 4]]), Fe, { top: [4], left: [3], bottom: [0], right: [1], fill: 2, shadow: false });
    }
    torches.forEach(([x, y], n) => {
      const [A, B] = n ? [FLAMES[1], FLAMES[0]] : FLAMES;
      const fy = y - 14, l = cv.layer(n ? 'fb' : 'fa');
      sprite(cv, x - 4, fy, A, FL);
      l.fill(spriteMask(cv, x - 4, fy, A).sub(spriteMask(cv, x - 4, fy, B)), (px, py) => base[py * W + px]);
      sprite(l, x - 4, fy, B, FL);
    });

    // Ivy down the left pillar, moss on the sill, mushrooms and a slime.
    let vx = 30;
    for (let y = 30; y < 150; y++) {
      vx += Math.round(Math.sin(y * 0.19) * 0.7);
      cv.set(vx, y, Mo[1]);
      if (y % 4 === 0) sprite(cv, (y / 4) % 2 ? vx + 1 : vx - 3, y - 1, ['.ab', 'abb', '.b.'], { a: Mo[4], b: Mo[2] }, { flip: (y / 4) % 2 === 0 });
    }
    for (let x = 2; x < W - 2; x++) {
      const n = Math.sin(x * 0.11) + Math.sin(x * 0.37 + 1) * 0.6;
      if (n > 0.6) { cv.set(x, 168, Mo[3]); cv.set(x, 169, bayer(x, 0) < 0.5 ? Mo[2] : Mo[3]); if (n > 1.1) cv.set(x, 170, Mo[1]); }
      if (n > 1.1 && x % 3 === 0) cv.set(x, 167, Mo[4]);
    }
    for (const [x, y, m] of [[10, 160, 0], [19, 162, 1]]) {
      const cap = m ? ['.rrr.', 'rwrrr', 'rrrwr', '..s..', '..s..', '..s..'] : ['..rrr..', '.rwrrr.', 'rrrrwrr', '...s...', '...s...', '...s...', '...s...'];
      const mm = cv.mask();
      cap.forEach((r, j) => [...r].forEach((ch, i) => ch !== '.' && mm.put(x + i, y - (m ? 0 : 1) + j)));
      cv.outline(INK, mm, { all: true });
      sprite(cv, x, y - (m ? 0 : 1), cap, { r: '#e0283f', w: '#ffe9e0', s: '#efe2c8' });
    }
    const slime = ['....kkkk....', '..kkggggkk..', '.kgGggggggk.', 'kgGgggggggk.', 'kggwkggwkggk', 'kggkkggkkggk', 'kgggggbggggk', 'kdgggggggggk', '.kkkkkkkkkk.'];
    sprite(cv, 238, 159, slime, { k: INK, g: '#5fd06a', G: '#c4ffb0', w: '#ffffff', b: '#2a6a3a', d: '#3a9a4c' });

    cv.outline(INK);
    return cv.punch(...HOLE);
  },
};
