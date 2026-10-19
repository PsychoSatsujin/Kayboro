// Dungeon window: a deep stone opening under a voussoir arch with a skull keystone and faintly glowing
// runes on the outer course, two flickering wall torches washing the stones in warm light, royal banners
// hung outside the pillars, manacle chains, ivy and moss, a chain swag under the sill, bones and mushrooms
// on one side and an open treasure chest (with its slime guard) on the other. The reveal around the
// opening stays plain dark stone.
import { Canvas, rng, bayer, mix } from '../pixel.mjs';
import { INK, inset, part, sprite, spriteMask } from '../kit.mjs';

const W = 304, H = 216, HOLE = [56, 64, 192, 108]; // 16:9
const S = ['#1c1826', '#2e2a3b', '#454055', '#5f5a70', '#7c778e', '#9c98ac', '#c4c1d0']; // stone
const SW = ['#2a1c20', '#4a3330', '#6e4f42', '#957056', '#bb946a', '#dfb985', '#fbe0a8'].map((c, i) => mix(S[i], c, 0.65)); // torch-lit stone
const Mo = ['#1f3b2c', '#2f5e3a', '#4c8a45', '#7dbb55', '#b6e07a']; // moss / ivy
const Wd = ['#2e1a12', '#4f2e1c', '#74452a', '#9a6438', '#c48a52']; // wood
const Fe = ['#14121a', '#262330', '#3b3748', '#565166', '#7c7790']; // iron
const Cl = ['#2e0a16', '#561428', '#86213a', '#b33a48', '#d8645e']; // banner cloth
const Gd = ['#6a3c0e', '#a8701c', '#e0a83a', '#ffd166', '#fff3b0']; // gold
const Bn = ['#4a4236', '#857a64', '#c2b89c', '#ece4cc']; // bone
const RUNE = ['#2a5e66', '#4fb8b0', '#9af0e0']; // rune glow (dim)
const FL = { 1: '#d8401a', 2: '#ff7a1f', 3: '#ffb52e', 4: '#ffe36b', 5: '#fff8d0' };
const FLAMES = [
  ['....1....', '...11....', '...121...', '..1221...', '..12321..', '.122321..', '.1234321.', '.1234321.', '123454321', '123454321', '123555321', '.1234321.', '..12321..'],
  ['.....1...', '....11...', '....121..', '...1221..', '...12321.', '..123321.', '.1234321.', '.1234321.', '123454321', '123454321', '123555321', '.1234321.', '..12321..'],
];
const CX = 152, CY = 290, RO = 280, RI = 248, RM = 264; // segmental arch
const PL = 22, PR = 248, PW = 34, SILL = 172; // pillars and sill top
const RUNES = [['#.#', '##.', '#.#', '.#.', '.#.'], ['.#.', '###', '.#.', '#.#', '#.#'], ['##.', '#.#', '##.', '#..', '#..'], ['#..', '##.', '#.#', '.##', '..#']];

/** Iron chain stamped along a list of points: face-on rings alternating with edge-on links. */
function chain(cv, pts) {
  pts.forEach(([x, y], i) => {
    if (i % 2) sprite(cv, x - 1, y - 1, ['kkk', 'kak', 'kkk'], { k: INK, a: Fe[3] });
    else sprite(cv, x - 2, y - 2, ['.kkk.', 'kbabk', 'kb.ak', 'kbbak', '.kkk.'], { k: INK, a: Fe[4], b: Fe[2] });
  });
}

/** Chain swag along a curve: face-on rings alternating with edge-on links, outlined as one piece. */
function swag(cv, pts) {
  const m = cv.mask();
  pts.forEach(([x, y], i) => {
    const rows = i % 2 ? ['aab'] : ['.aaa.', 'a...b', '.bbb.'], ox = i % 2 ? 1 : 2, oy = i % 2 ? 0 : 1;
    sprite(cv, x - ox, y - oy, rows, { a: Fe[4], b: Fe[2] });
    rows.forEach((r, j) => [...r].forEach((ch, k) => ch !== '.' && m.put(x - ox + k, y - oy + j)));
  });
  cv.outline(INK, m, {});
  return m;
}

/** Swallowtail banner hanging from an iron pole that juts out of the pillar; dir -1 = pole points left. */
function banner(cv, px, py, dir) {
  const x0 = dir < 0 ? px - 19 : px + 3, w = 16, top = py + 2, bot = py + 50;
  const pole = cv.mask().rect(Math.min(px, px + dir * 22), py, 23, 2);
  part(cv, pole, Fe, { top: [4], left: [3], bottom: [0], right: [1], fill: 2, shadow: false });
  part(cv, cv.mask().circle(px + dir * 22, py, 1), Fe, { top: [4], left: [4], bottom: [1], right: [1], fill: 3, shadow: false });
  const cloth = cv.mask().rect(x0, top, w, bot - top).sub(cv.mask().poly([[x0 + 2, bot + 0.5], [x0 + w / 2, bot - 7], [x0 + w - 2, bot + 0.5]]));
  cv.cast(cloth.dilate(1), 1, 1, -1);
  // folds: lit and shaded vertical bands
  cv.fill(cloth, (x, y) => { const k = (x - x0) % 8; return Cl[k < 2 ? 3 : k < 5 ? 2 : k < 7 ? 1 : 2]; });
  cv.fill(cloth.edge().and(cv.mask().rect(x0, top + 2, w, bot - top)), Gd[2]);
  cv.fill(cloth.and(cv.mask().rect(x0, top, w, 3)), Gd[1]);
  cv.rect(x0, top, w, 1, Gd[3]);
  for (let i = 1; i < w; i += 3) cv.set(x0 + i, top + 1, Gd[0]); // rings on the pole
  // emblem: a crowned shield
  const ex = x0 + 4, ey = top + 12;
  sprite(cv, ex, ey, ['g.g.g.g', 'ggggggg', '.......', 'GGGGGGG', 'GyyyyyG', 'GyRRRyG', 'GyRRRyG', '.GyRyG.', '..GyG..', '...G...'],
    { g: Gd[3], G: Gd[1], y: Gd[3], R: Cl[0] });
  cv.outline(INK, cloth.or(pole), { all: false });
  return cloth;
}

export default {
  id: 'px-dungeon', name: 'Dungeon Window', theme: 'fantasy', rarity: 'rare', translucent: false,
  desc: 'A torch-lit dungeon window with a skull keystone, royal banners and a guarded treasure chest.',
  tags: ['fantasy', 'dungeon', 'stone', 'torch', 'rpg', 'animated', 'widescreen', 'pixel'],
  css: '.fa{animation:fl .42s steps(1) infinite}.fb{animation:fl .42s steps(1) -.21s infinite}' +
    '@keyframes fl{50%{opacity:0}}',
  draw() {
    const cv = new Canvas(W, H), rnd = rng(7);
    cv.use(S, SW, Mo, Wd, Fe, Cl, Gd, Bn);
    const d = (x, y) => Math.hypot(x + 0.5 - CX, y + 0.5 - CY);
    const outer = cv.mask().plot((x, y) => d(x, y) <= RO && y < SILL + 4, PL, 0, PR + PW, SILL + 4);
    const below = (x, y) => d(x, y) < RI;

    // Every stone is its own mask; whatever stone area no block claims is mortar.
    const blocks = [], outerCourse = [];
    const stone = (m, list) => { if (m.bbox()) { blocks.push(m); if (list) list.push(m); } };
    for (let k = -12; k <= 12; k++) for (const [r0, r1, off] of [[RI, RM, 0], [RM, RO + 6, 0.5]]) { // voussoirs, two courses
      const a0 = (k - 0.5 + off) * 0.052, a1 = a0 + 0.052, key = k === 0 && !off;
      stone(cv.mask().plot((x, y) => {
        const a = Math.atan2(x + 0.5 - CX, CY - y - 0.5), r = d(x, y);
        if (key) return Math.abs(a) * r < 6.5 + (r - RI) * 0.16 && r >= RI - 6 && r <= RO + 5;
        return a > a0 && a < a1 && (a - a0) * r > 0.8 && (a1 - a) * r > 0.6 && r > r0 + 0.6 && r < r1 - 0.4 && r <= RO && Math.abs(a) * r > 7.5 + (r - RI) * 0.16;
      }, 0, 0, W, 94), off ? outerCourse : null);
    }
    for (let row = 0; row < 4; row++) { // tympanum bricks under the arch
      const y = 57 - row * 7, off = row % 2 ? 9 : 0;
      for (let x = HOLE[0] - off; x < HOLE[0] + HOLE[2]; x += 19) {
        const x0 = Math.max(x, HOLE[0]);
        stone(cv.mask().rect(x0, y, Math.min(18, HOLE[0] + HOLE[2] - x0) - (x < HOLE[0] ? HOLE[0] - x : 0), 6).and(cv.mask().plot((i, j) => d(i, j) < RI - 1.5, HOLE[0] - 10, 0, HOLE[0] + HOLE[2] + 10, 64)));
      }
    }
    for (const x0 of [PL, PR]) { // pillars, running bond
      let y = SILL, row = 0;
      while (y > 34) {
        const h = 12 + Math.floor(rnd() * 4), cut = row % 2 ? [x0, x0 + PW] : [x0, x0 + 15 + Math.floor(rnd() * 6), x0 + PW];
        for (let i = 0; i + 1 < cut.length; i++) stone(cv.mask().rect(cut[i] + (i ? 1 : 0), y - h + 1, cut[i + 1] - cut[i] - (i ? 1 : 0), h - 1).and(cv.mask().plot(below, x0, 0, x0 + PW, SILL)));
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

    // Faint runes carved into every third stone of the outer course (away from the opening).
    outerCourse.forEach((b, i) => {
      const bb = b.bbox(), k = Math.round((bb.x + bb.w / 2 - CX) / 14);
      if (Math.abs(k) < 3 || i % 3) return;
      const rx = bb.x + (bb.w >> 1) - 1, ry = bb.y + (bb.h >> 1) - 2, rows = RUNES[i % RUNES.length];
      const m = spriteMask(cv, rx, ry, rows);
      cv.fill(m.dilate(1).sub(m).and(b), (x, y, c) => (bayer(x, y) < 0.5 ? RUNE[0] : c));
      cv.fill(m, RUNE[1]);
      cv.set(rx + 1, ry + 1, RUNE[2]);
    });

    // Skull keystone.
    const skull = ['.aabba.', 'abbbbbc', 'bkkbkkc', 'bkkbkkc', 'bbbkbbc', '.bcccc.', '.b.c.c.'];
    cv.outline(INK, spriteMask(cv, 149, 15, skull), { all: true });
    sprite(cv, 149, 15, skull, { a: Bn[3], b: Bn[2], c: Bn[1], k: INK });

    // Moss tufts on the arch's outer edge, thickest at the shoulders.
    outer.edge().each((x, y) => {
      if (y > 60 || d(x, y) < RO - 2) return;
      const t = Math.abs(x - CX) / 130, n = Math.sin(x * 0.31) + Math.sin(x * 0.13 + 2);
      if (n > 1.4 - t * 1.2) { cv.set(x, y, Mo[3]); if (bayer(x, y) < 0.5) cv.set(x, y + 1, Mo[2]); if (n > 1.8 - t) cv.set(x, y - 1, Mo[4]); }
    });

    // Sill slab and corbels.
    const sill = cv.mask().rrect(PL - 6, SILL, PR + PW - PL + 12, 13, 2);
    cv.fill(sill, S[0]);
    const sx0 = PL - 6, sx1 = PR + PW + 6, third = Math.round((sx1 - sx0) / 3);
    for (const [a, b] of [[sx0, sx0 + third], [sx0 + third + 1, sx0 + 2 * third], [sx0 + 2 * third + 1, sx1]]) {
      const m = cv.mask().rect(a + (a === sx0 ? 1 : 0), SILL + 1, b - a - 1 - (b === sx1 ? 1 : 0), 11).and(sill);
      cv.shade(m, S, { top: [6, 5], left: [4], bottom: [1], right: [2], fill: 3 });
    }
    const corbels = [42, 238];
    for (const x of corbels) {
      const c = cv.mask().rect(x, SILL + 13, 24, 5).rect(x + 3, SILL + 18, 18, 4).rect(x + 7, SILL + 22, 10, 4);
      cv.shade(c, S, { top: [2], left: [4], bottom: [0], right: [1], fill: 3 });
    }

    // Deep reveal: shadowed lintel and jamb, sill catching light.
    inset(cv, ...HOLE, 0, { rim: INK, top: S[0], left: S[1], bottom: S[4], right: S[2] }, 3);

    // Torches: iron sconce, wooden haft, cup; warm light washes the stone; two flame frames flicker.
    const torches = [[PL + 17, 108], [PR + 17, 108]];
    const lit = cv.mask().rect(0, 0, W, H).and(cv.opaque());
    for (const [x, y] of torches) {
      cv.fill(lit, (px, py, c) => {
        const i = S.indexOf(c), t = Math.hypot(px + 0.5 - x, (py + 0.5 - y + 8) * 1.1) / 42;
        if (i < 0 || t >= 1) return c;
        const k = (1 - t) ** 1.3 * 2.1, step = Math.floor(k) + (k % 1 > bayer(px, py) ? 1 : 0);
        return step ? SW[Math.min(6, i + step - 1)] : c;
      });
    }

    // Banners outside the pillars and manacle chains on the pillar faces (drawn before the torch base snapshot).
    banner(cv, PL - 1, 50, -1);
    banner(cv, PR + PW, 50, 1);
    for (const x of [PL + 6, PR + PW - 7]) {
      const pts = [];
      for (let y = 134; y <= 146; y += 3) pts.push([x, y]);
      sprite(cv, x - 2, 130, ['.kkk.', 'kaaak', '.kkk.'], { k: INK, a: Fe[3] }); // wall ring
      chain(cv, pts);
      sprite(cv, x - 3, 147, ['.kkkkk.', 'kbaaabk', 'kb...bk', 'kbbbbbk', '.kkkkk.'], { k: INK, a: Fe[4], b: Fe[2] }); // manacle
    }

    const base = cv.p.slice();
    for (const [x, y] of torches) {
      part(cv, cv.mask().rrect(x - 4, y + 10, 9, 15, 2), Fe, { top: [4], left: [3], bottom: [0], right: [1], fill: 2 });
      cv.set(x, y + 13, Fe[4]).set(x, y + 21, Fe[4]);
      part(cv, cv.mask().rect(x - 1, y + 2, 3, 20), Wd, { top: [4], left: [3], bottom: [0], right: [1], fill: 2, shadow: false });
      part(cv, cv.mask().rect(x - 3, y + 14, 7, 3), Fe, { top: [4], left: [3], bottom: [0], right: [1], fill: 2, shadow: false });
      part(cv, cv.mask().poly([[x - 5, y - 1], [x + 6, y - 1], [x + 4, y + 4], [x - 3, y + 4]]), Fe, { top: [4], left: [3], bottom: [0], right: [1], fill: 2, shadow: false });
    }
    torches.forEach(([x, y], k) => {
      const [A, B] = k ? [FLAMES[1], FLAMES[0]] : FLAMES;
      const fy = y - 14, l = cv.layer(k ? 'fb' : 'fa');
      sprite(cv, x - 4, fy, A, FL);
      l.fill(spriteMask(cv, x - 4, fy, A).sub(spriteMask(cv, x - 4, fy, B)), (px, py) => base[py * W + px]);
      sprite(l, x - 4, fy, B, FL);
    });

    // Ivy down the left pillar and from the right shoulder, moss on the sill.
    const ivy = (x0, y0, y1, flip) => {
      let vx = x0;
      for (let y = y0; y < y1; y++) {
        vx += Math.round(Math.sin(y * 0.19) * 0.7);
        cv.set(vx, y, Mo[1]);
        if (y % 4 === 0) sprite(cv, (y / 4) % 2 ? vx + 1 : vx - 3, y - 1, ['.ab', 'abb', '.b.'], { a: Mo[4], b: Mo[2] }, { flip: ((y / 4) % 2 === 0) !== flip });
      }
    };
    ivy(PL + 24, 36, 92, false);
    ivy(PR + 26, 40, 78, true);
    for (let x = PL - 4; x < PR + PW + 4; x++) {
      const n = Math.sin(x * 0.11) + Math.sin(x * 0.37 + 1) * 0.6;
      if (n > 0.6) { cv.set(x, SILL, Mo[3]); cv.set(x, SILL + 1, bayer(x, 0) < 0.5 ? Mo[2] : Mo[3]); if (n > 1.1) cv.set(x, SILL + 2, Mo[1]); }
      if (n > 1.1 && x % 3 === 0) cv.set(x, SILL - 1, Mo[4]);
    }

    // Left sill: mushrooms and a little pile of bones.
    for (const [x, y, m] of [[PL + 2, SILL - 8, 0], [PL + 11, SILL - 6, 1]]) {
      const cap = m ? ['.rrr.', 'rwrrr', 'rrrwr', '..s..', '..s..', '..s..'] : ['..rrr..', '.rwrrr.', 'rrrrwrr', '...s...', '...s...', '...s...', '...s...'];
      const mm = cv.mask();
      cap.forEach((r, j) => [...r].forEach((ch, i) => ch !== '.' && mm.put(x + i, y - (m ? 0 : 1) + j)));
      cv.outline(INK, mm, { all: true });
      sprite(cv, x, y - (m ? 0 : 1), cap, { r: '#e0283f', w: '#ffe9e0', s: '#efe2c8' });
    }
    const bones = ['.......aab.', 'ab....abbbc', 'bbbbbbbbc..', '.c.abbbbbbc', '...bc...bc.'];
    cv.outline(INK, spriteMask(cv, PL + 19, SILL - 5, bones), { all: true });
    sprite(cv, PL + 19, SILL - 5, bones, { a: Bn[3], b: Bn[2], c: Bn[1] });

    // Right sill: the slime guarding an open treasure chest, with spilled coins and a gem.
    const slime = ['....kkkk....', '..kkggggkk..', '.kgGggggggk.', 'kgGgggggggk.', 'kggwkggwkggk', 'kggkkggkkggk', 'kgggggbggggk', 'kdgggggggggk', '.kkkkkkkkkk.'];
    sprite(cv, PR + 3, SILL - 9, slime, { k: INK, g: '#5fd06a', G: '#c4ffb0', w: '#ffffff', b: '#2a6a3a', d: '#3a9a4c' });
    const chest = [
      '.kkkkkkkkkkkk.', 'kWddddddddddWk', 'kWddddddddddWk', 'kWddddddddddWk', 'kkkkkkkkkkkkkk', '.kgyGgGyGgGgk.', 'kgGgGgGgGgGgGk',
      'kiiiiiiiiiiiik', 'kwwwwwllwwwwwk', 'kwwwwwlLwwwwwk', 'kiiiiiiiiiiiik', 'kwwwwwwwwwwwwk', 'kkkkkkkkkkkkkk'];
    sprite(cv, PR + 17, SILL - 13, chest, { k: INK, W: Wd[3], d: Wd[1], w: Wd[2], g: Gd[2], G: Gd[3], y: Gd[4], i: Fe[3], l: Gd[1], L: Gd[3] });
    cv.px([[PR + 15, SILL - 1], [PR + 16, SILL - 2], [PR + 31, SILL - 1], [PR + 32, SILL - 1]], Gd[3]).px([[PR + 15, SILL - 2], [PR + 32, SILL - 2]], Gd[1]);
    sprite(cv, PR + 13, SILL - 3, ['.a.', 'abc', '.c.'], { a: '#e8fdff', b: '#7af0ff', c: '#1b6f9a' });

    // Chain swag hung between the corbels under the sill.
    const [c0, c1] = [corbels[0] + 12, corbels[1] + 12], sw = [];
    for (let x = c0; x <= c1; x += 4) sw.push([x, SILL + 27 + Math.round(Math.sin(((x - c0) / (c1 - c0)) * Math.PI) * 12)]);
    swag(cv, sw);

    cv.outline(INK);
    return cv.punch(...HOLE);
  },
};
