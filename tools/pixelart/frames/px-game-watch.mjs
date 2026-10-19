// Chunky 80s LCD game watch: black resin case with button guards, a gold minute bezel with printed
// button icons, a lacquered face plate around the square screen, and a red rubber strap with
// ribbed shoulders, a gold buckle, a row of strap holes and a gold star charm.
import { Canvas } from '../pixel.mjs';
import { INK, SHAPES, inset, part, sprite, spriteMask, sparkle, sticker } from '../kit.mjs';

const W = 176, H = 288, HOLE = [44, 100, 88, 88], HR = 3; // 1:1
const CX = 88, CY = 144; // screen center
const K = ['#0c0a13', '#16131f', '#221e2e', '#2f2a40', '#433c58', '#605878', '#8a82a6']; // black resin case
const P = ['#08070f', '#110f1b', '#1a1728', '#262238', '#363050', '#4c4570']; // lacquered face plate
const G = ['#5a370c', '#94601a', '#cf9426', '#f0c449', '#ffe486', '#fff6cf']; // gold
const R = ['#3e0718', '#6e0f25', '#a51932', '#d72a3c', '#f6585a', '#ff9c8e']; // red rubber strap

// Strap profile: lit left edge, flat middle, shaded right edge (the strap is a soft rounded band).
const strapFill = (x0, w) => (x) => {
  const u = x - x0;
  return u < 1 ? R[4] : u < 3 ? R[3] : u > w - 2 ? R[1] : u > w - 5 ? R[2] : R[3];
};

export default {
  id: 'px-game-watch', name: 'Wrist Arcade', theme: 'wristwatch', rarity: 'common', translucent: false,
  collection: 'pocket-pals', license: 'CC-BY-4.0',
  desc: 'Strap a whole arcade to your wrist and play until the alarm says it is game time.',
  tags: ['watch', 'lcd', 'retro', 'wearable', 'square', 'pixel'],
  css: '.blink{animation:blink 1.2s steps(1) infinite}@keyframes blink{50%{opacity:0}}',
  draw() {
    const cv = new Canvas(W, H);
    cv.use(K, P, G, R);

    // ---- strap: top half (ribbed shoulder, keeper, buckle), bottom half (ribs + holes) ----------
    const SX = 52, SW = 72;
    const top = cv.mask().rect(SX, 0, SW, 70), bot = cv.mask().rect(SX, 218, SW, H - 218);
    for (const m of [top, bot]) cv.fill(m, strapFill(SX, SW));
    const groove = (y) => cv.rect(SX + 1, y, SW - 2, 1, R[1]).rect(SX + 2, y + 1, SW - 4, 1, R[4]);
    for (let y = 40; y <= 52; y += 4) groove(y);
    for (let y = 236; y <= 248; y += 4) groove(y);
    // strap holes, each in a slightly raised grommet
    for (let y = 256; y < H + 4; y += 12) {
      const g = cv.mask().oval(CX - 4, y - 1, 9, 9), h = cv.mask().oval(CX - 2, y + 1, 5, 5);
      cv.fill(g.sub(h), (x, yy) => (x + yy < CX + y + 3 ? R[4] : R[2]));
      cv.fill(h, INK).set(CX + 1, y + 4, R[0]).set(CX + 2, y + 3, R[0]);
    }
    // die-cut stickers slapped on the strap
    sticker(cv, 103, 259, SHAPES.heart, G);
    // a gold star charm hanging on the strap
    sticker(cv, 62, 268, SHAPES.star, G);
    cv.px([[65, 271], [67, 271]], INK).set(66, 273, R[2]);
    // keeper loop under the buckle
    const keep = cv.mask().rrect(SX - 3, 30, SW + 6, 7, 2);
    part(cv, keep, R, { top: [4], left: [3], bottom: [0], right: [1], fill: 2 });
    // buckle: a gold frame around the strap with a tongue
    const frame = cv.mask().rrect(SX - 6, 6, SW + 12, 20, 5).sub(cv.mask().rrect(SX - 1, 10, SW + 2, 12, 2));
    part(cv, frame, G, { top: [5, 4], left: [4], bottom: [0], right: [1], fill: 2 });
    const tongue = cv.mask().rect(CX - 1, 8, 3, 18);
    part(cv, tongue, G, { top: [5], left: [4], bottom: [0], right: [1], fill: 3, shadow: -1 });

    // ---- lugs (case horns gripping each strap end) ---------------------------------------------
    const lugT = cv.mask().poly([[34, 80], [142, 80], [128, 56], [48, 56]]);
    const lugB = cv.mask().poly([[34, 208], [142, 208], [128, 232], [48, 232]]);
    for (const m of [lugT, lugB]) part(cv, m, K, { top: [6, 5], left: [5], bottom: [0], right: [1], fill: 3, dy: 2 });
    cv.rect(50, 59, 76, 1, K[2]).rect(50, 60, 76, 1, K[5]); // top lug pin seam
    cv.rect(50, 228, 76, 1, K[1]).rect(50, 229, 76, 1, K[4]); // bottom lug pin seam

    // ---- button guards + four side pushers ------------------------------------------------------
    const BTN = [[96, 'L'], [190, 'L'], [96, 'R'], [190, 'R']];
    for (const [y, s] of BTN) {
      const gx = s === 'L' ? 16 : W - 16 - 10;
      part(cv, cv.mask().rrect(gx, y - 11, 10, 23, 4), K, { top: [6], left: [5], bottom: [0], right: [1], fill: 3 });
    }
    for (const [y, s] of BTN) {
      const L = s === 'L', bx = L ? 6 : W - 6 - 10;
      const cap = cv.mask().rrect(bx, y - 5, 10, 11, L ? [3, 0, 0, 3] : [0, 3, 3, 0]);
      part(cv, cap, G, { top: [5], left: [4], bottom: [0], right: [1], fill: 3 });
      const cx0 = L ? bx + 7 : bx;
      cv.rect(cx0, y - 5, 3, 11, K[2]).rect(cx0, y - 5, 3, 1, K[5]).rect(cx0, y + 5, 3, 1, K[0]); // dark collar
      for (let k = 0; k < 9; k += 2) cv.set(L ? bx + 2 : bx + 7, y - 4 + k, G[2]); // knurling
    }

    // ---- case ------------------------------------------------------------------------------------
    const kase = cv.mask().rrect(22, 66, 132, 156, 20);
    part(cv, kase, K, { top: [6, 5], left: [5, 4], bottom: [0, 1], right: [1], fill: 3, dy: 2 });

    // ---- gold bezel ring: minute ticks, red 12 o'clock pip, engraved button legends ---------------
    const bezel = cv.mask().rrect(28, 72, 120, 144, 15);
    const plateM = cv.mask().rrect(38, 82, 100, 124, 8);
    const ring = bezel.sub(plateM);
    cv.cast(bezel.dilate(1), 1, 1, -1);
    // lit top/left runs, shaded bottom/right runs, split on the anti-diagonal like a pixel bevel
    const lit = (x, y) => (x + 0.5 - CX) * 144 + (y + 0.5 - CY) * 120 < 0;
    cv.shade(bezel, G, { top: [5, 4], left: [4], bottom: [0, 1], right: [1], fill: (x, y) => G[lit(x, y) ? 3 : 2] });
    cv.fill(plateM.ring(true).and(bezel), (x, y) => (lit(x, y) ? G[1] : G[4])); // bevel walls: top/left in shade, bottom/right lit

    // engraved button icons instead of words: light (sun), turbo (double chevron), mode (cycle), play (triangle)
    const icons = [
      [['#.#.#', '.###.', '##.##', '.###.', '#.#.#'], 46, 76], [['#..#..', '.#..#.', '..#..#', '.#..#.', '#..#..'], 125, 76],
      [['.###.', '#...#', '#.#.#', '#...#', '.###.'], 46, 208], [['##...', '####.', '#####', '####.', '##...'], 125, 208],
    ];
    let legendM = cv.mask();
    for (const [rows, x, y] of icons) legendM = legendM.or(spriteMask(cv, x, y, rows));
    cv.fill(legendM.shift(1, 1).sub(legendM).and(ring), (x, y, c) => cv.step(c, 1)).fill(legendM, G[0]); // engraved: dark letters, lit lip
    const keepOut = legendM.dilate(2, true);
    // minute track: ticks every 6px along the straight runs, a long ink tick every third one
    const tick = (x, y, horiz, major) => {
      const m = cv.mask();
      if (horiz) m.rect(x, y - (major ? 2 : 1), 1, major ? 5 : 3); else m.rect(x - (major ? 2 : 1), y, major ? 5 : 3, 1);
      if (m.and(keepOut).bbox()) return;
      cv.fill(m.shift(1, 1).sub(m).and(ring), (x, y, c) => cv.step(c, 1)).fill(m, (x, y, c) => (major ? INK : cv.step(c, -2)));
    };
    for (let k = 1; k <= 7; k++) for (const sg of [-1, 1]) for (const y of [77, 210]) tick(CX + sg * k * 6, y, true, k % 3 === 0);
    tick(CX, 210, true, true);
    for (let k = 0; k <= 9; k++) for (const sg of [-1, 1]) for (const x of [33, 142]) if (k || sg > 0) tick(x, CY + sg * k * 6, false, k % 3 === 0);
    // 12 o'clock: red triangle pip with a gold surround
    const pip = cv.mask().poly([[CX - 3.5, 74], [CX + 4.5, 74], [CX + 0.5, 80]]);
    cv.fill(pip.dilate(1).and(ring), G[1]).fill(pip, R[3]);
    cv.set(CX - 1, 75, R[5]).set(CX, 75, R[4]);

    // ---- lacquered face plate (recessed) -----------------------------------------------------------
    cv.shade(plateM, P, { top: [0, 1], left: [1], bottom: [4], right: [3], fill: 2 });
    inset(cv, ...HOLE, HR, { rim: INK, top: P[0], bottom: P[5], right: P[4] }, 2);
    const gw = 9; // a tiny joystick glyph stands in for a title
    sprite(cv, CX - 4, 86, ['...##....', '...##....', '....#....', '.#######.', '#########'], { '#': R[4] });
    for (const [x0, x1] of [[46, CX - (gw >> 1) - 3], [CX + (gw >> 1) + 3, 130]]) cv.rect(x0, 90, x1 - x0, 1, R[2]);
    // a row of five embossed gold pips where a wordmark would sit
    let pips = cv.mask();
    for (let i = -2; i <= 2; i++) pips = pips.or(cv.mask().poly([[CX + i * 10 - 3, 197.5], [CX + i * 10, 194.5], [CX + i * 10 + 3, 197.5], [CX + i * 10, 200.5]]));
    cv.fill(pips.shift(1, 1).sub(pips), G[0]).fill(pips, G[3]);
    cv.fill(pips.and(cv.mask().rect(0, 194, W, 3)), G[5]);
    sprite(cv, 48, 196, SHAPES.heart5, { '#': R[2] });
    cv.layer('blink').fill(spriteMask(cv, 48, 196, SHAPES.heart5), R[4]).set(49, 197, R[5]);
    // alarm bell (the alarm that says it is game time)
    sprite(cv, 124, 196, ['..o..', '.###.', '.###.', '#####', '..#..'], { '#': G[2], o: G[4] });

    // glints on the bezel
    sparkle(cv, 33, 83, 1, G[5], '#ffffff');

    cv.outline(INK);
    return cv.punch(...HOLE, HR);
  },
};
