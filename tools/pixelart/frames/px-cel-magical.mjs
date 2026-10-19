// Arcane Spellbook: a big enchanted tome standing open on a carved lectern, rendered in the Blue Cel
// style (dithered cobalt-to-cyan gradients under hard cel shadow bands, ice specular slivers). A
// glowing runed page-frame rises out of the open pages as the screen; floating candles with gold
// flames (the one warm accent), two potions and a crystal wand on the pages, a gold bookmark ribbon,
// a little owl familiar on the cover corner and a summoning circle glowing on the floor.
import { Canvas, bayer } from '../pixel.mjs';
import { INK, inset, sparkle, sprite, spriteMask } from '../kit.mjs';

const W = 272, H = 248, HOLE = [64, 34, 144, 108], HR = 5; // 4:3
const CX = 136;
// Shared Blue Cel ramps (same values as px-cel-crt / px-cel-pet).
const B = ['#0a1140', '#111d68', '#18308f', '#2149bb', '#2d6ade', '#4790f2', '#6cb8fd', '#a3dfff', '#e0f6ff']; // navy -> ice
const K = ['#04263a', '#0a4560', '#1fb2dc', '#7eefff', '#e6feff']; // magic cyan glow
const P = ['#2c3d78', '#5670ae', '#8aa4da', '#b8cdf2', '#dce8fd', '#f6faff']; // pearl-blue pages and wax
const Y = ['#7a4a10', '#c7861d', '#ffc23d', '#ffe38a', '#fff7d6']; // the one warm accent: flames, ribbon, owl eyes
const WHITE = '#ffffff';

/** Cel-shade a volume: dithered gradient, hard core-shadow band lower-right, lit top-left edge, ink. */
function cel(cv, m, grad, { shadow, k = 3, hi, rim, drop = true, ink = true, soft = 0.6, dir } = {}) {
  if (drop) cv.cast(m.dilate(1), 1, 1, -1);
  if (grad.length > 1) cv.grad(m, grad, { soft, dir }); else cv.fill(m, grad[0]);
  const core = m.sub(m.shift(-k, -k));
  if (shadow) cv.fill(core, shadow);
  if (rim) cv.fill(m.sub(m.shift(-1, 0)).and(core).sub(m.sub(m.shift(0, -1))), rim);
  if (hi) cv.fill(m.sub(m.shift(1, 1)).sub(core), hi);
  if (ink) cv.outline(INK, m, { all: true });
  return core;
}

// Original rune glyphs (5x5).
const RUNES = [
  ['..#..', '.#.#.', '#.#.#', '.#.#.', '..#..'],
  ['#...#', '.#.#.', '..#..', '.###.', '..#..'],
  ['.###.', '#...#', '#.#.#', '#...#', '.###.'],
  ['..#..', '.###.', '#.#.#', '..#..', '.#.#.'],
  ['###..', '..#..', '..###', '..#..', '###..'],
  ['#.#.#', '#.#.#', '.###.', '..#..', '..#..'],
  ['.##..', '#..#.', '#....', '#..#.', '.##..'],
  ['..#..', '#.#.#', '.###.', '#.#.#', '..#..'],
];

// Candle flame, two flicker frames (a dark edge -> d hot core).
const FLAME = [
  ['...a...', '...a...', '..aba..', '..aba..', '.abcba.', '.abcba.', 'abcdcba', 'abcdcba', 'abcdcba', '.abdba.', '..aba..'],
  ['....a..', '...aa..', '...aba.', '..abba.', '.abcba.', '.abcba.', 'abcdcba', 'abcdcba', 'abcdcba', '.abdba.', '..aba..'],
];
const FL = { a: Y[1], b: Y[2], c: Y[3], d: Y[4] };

// Open-book geometry: far (top) edge and near (front) edge of the page surfaces dip toward the spine.
const uu = (x) => Math.min(1, Math.abs(x + 0.5 - CX) / 128);
const yT = (x) => 148 + 18 * (1 - uu(x) ** 1.4);
const yN = (x) => 172 + 10 * (1 - uu(x) ** 1.4);

export default {
  id: 'px-cel-magical', name: 'Arcane Spellbook', theme: 'magic', rarity: 'rare', translucent: false,
  collection: 'blue-cel', license: 'CC-BY-4.0',
  desc: 'A cel-shaded spellbook opens a glowing portal page for your game, lit by floating candles while a little owl keeps watch.',
  tags: ['magic', 'spellbook', 'cel-shaded', 'blue', 'animated', 'pixel'],
  css: '.fa{animation:fl .5s steps(1) infinite}.fb{animation:fl .5s steps(1) -.25s infinite}@keyframes fl{50%{opacity:0}}' +
    '.rb{animation:rb 2s steps(1) infinite}@keyframes rb{50%{opacity:0}}' +
    '.tw{animation:tw 2.4s steps(1) infinite}@keyframes tw{0%,62%{opacity:1}63%,100%{opacity:0}}' +
    '.ob{opacity:0;animation:ob 4.5s steps(1) infinite}@keyframes ob{0%,93%{opacity:0}94%,100%{opacity:1}}',
  draw() {
    const cv = new Canvas(W, H);
    cv.use(B, K, P, Y);

    // ---- Runed portal page-frame: a tall arch rising out of the book -------------------------------
    const arch = cv.mask().plot((x, y) => {
      const u = (x + 0.5 - CX) / 96;
      if (Math.abs(u) > 1) return false;
      if (y >= 39) return y < 178;
      const v = (39 - (y + 0.5)) / 31;
      return Math.abs(u) ** 3 + v * v <= 1;
    });
    cel(cv, arch, [B[7], B[6], B[5], B[4], B[3]], { shadow: B[2], k: 6, hi: B[8], rim: B[4], drop: false, soft: 0.5 });
    // Specular sliver on the upper-left shoulder.
    const shoulder = arch.erode(2).sub(arch.erode(3)).and(cv.mask().plot((x, y) => y < 40 && x < 100));
    cv.fill(shoulder, B[8]);
    cv.fill(shoulder.and(cv.mask().rect(44, 16, 34, 20)), WHITE);
    cv.rect(41, 46, 1, 30, B[8]).rect(41, 80, 1, 3, B[8]);

    // Recessed rune groove following the arch.
    const groove = arch.erode(4).sub(arch.erode(11));
    cv.fill(groove, B[1]);
    cv.fill(groove.and(groove.shift(1, 1).not()).and(arch.erode(4).sub(arch.erode(5))), B[0]); // shadowed outer wall
    cv.fill(groove.sub(groove.shift(-1, -1)).and(arch.erode(10)), B[0]);
    cv.fill(arch.erode(11).ring().and(arch.erode(4)).and(cv.mask().plot((x, y) => x > CX - 40 || y > 60)), B[4]); // lit inner lip
    const runeSpots = [];
    for (let y = 46; y < 160; y += 9) runeSpots.push([45, y], [W - 50, y]);
    for (const cxr of [62, 76, 90, 104, 118, 154, 168, 182, 196, 210]) {
      let ys = [];
      for (let y = 0; y < 40; y++) if (groove.has(cxr, y)) ys.push(y);
      if (ys.length) runeSpots.push([cxr - 2, Math.round((ys[0] + ys[ys.length - 1]) / 2) - 2]);
    }
    const rb = cv.layer('rb');
    runeSpots.forEach(([x, y], i) => {
      const g = RUNES[(i * 5 + 3) % RUNES.length], m = spriteMask(cv, x, y, g).and(groove);
      cv.fill(m, i % 3 ? K[2] : K[3]);
      cv.fill(m.shift(1, 1).sub(m).and(groove), B[0]);
      if (i % 4 === 1) rb.fill(m, K[4]);
    });

    // Crest: a faceted cyan gem on an ice mount at the top of the arch.
    const mount = cv.mask().oval(122, 2, 29, 20);
    cel(cv, mount, [B[8], B[7], B[6]], { shadow: B[5], k: 2, hi: WHITE });
    const gem = cv.mask().poly([[CX + 0.5, 3], [CX + 8.5, 11], [CX + 0.5, 20], [CX - 7.5, 11]]);
    cv.fill(gem, (x, y) => (y < 11 ? (x <= CX ? K[4] : K[3]) : x <= CX ? K[2] : K[1]));
    cv.fill(gem.sub(gem.shift(-1, -1)), K[1]);
    cv.px([[CX - 2, 7], [CX - 3, 8], [CX - 2, 8]], WHITE);
    cv.outline(INK, gem, { all: true });

    // Ice bezel lip, dark portal tube and the recessed rim at the glass.
    const bezel = cv.mask().rrect(HOLE[0] - 8, HOLE[1] - 8, HOLE[2] + 16, HOLE[3] + 16, HR + 8);
    cel(cv, bezel, [B[8], B[7], B[6]], { shadow: B[4], k: 2, hi: WHITE });
    const tube = cv.mask().rrect(HOLE[0] - 5, HOLE[1] - 5, HOLE[2] + 10, HOLE[3] + 10, HR + 5);
    cv.fill(tube, (x, y) => ((x + y) % 2 ? K[0] : B[1]));
    cv.fill(tube.sub(tube.shift(2, 2)), B[0]);
    cv.fill(tube.sub(tube.shift(-1, -1)), K[1]);
    cv.outline(INK, tube, { all: true });
    inset(cv, ...HOLE, HR, { rim: INK, top: B[0], left: B[0], bottom: K[0], right: K[0] }, 2);
    // Glass glints on the bezel lip, clear of the opening.
    cv.rect(72, 28, 18, 1, WHITE).rect(93, 28, 3, 1, WHITE).rect(58, 44, 1, 14, WHITE);

    // ---- Lectern ------------------------------------------------------------------------------------
    const board = cv.mask().poly([[66, 184], [206, 184], [212, 198], [60, 198]]);
    cel(cv, board, [B[5], B[4], B[3]], { shadow: B[2], k: 2, hi: B[6] });
    const collar = cv.mask().rrect(110, 199, 52, 6, 2);
    cel(cv, collar, [B[5], B[4]], { shadow: B[2], k: 2, hi: B[7] });
    const shaft = cv.mask().rect(122, 205, 28, 14);
    cel(cv, shaft, [B[4], B[3], B[2]], { shadow: B[1], k: 4, hi: B[5] });
    const emblem = spriteMask(cv, 133, 208, RUNES[1]);
    cv.fill(emblem, K[2]).set(CX - 1, 209, K[4]);
    const collar2 = cv.mask().rrect(108, 219, 56, 5, 2);
    cel(cv, collar2, [B[5], B[4]], { shadow: B[2], k: 2, hi: B[7] });
    const base = cv.mask().rrect(92, 224, 88, 9, [4, 4, 1, 1]);
    cel(cv, base, [B[5], B[4], B[3]], { shadow: B[2], k: 3, hi: B[7] });

    // ---- Open book: cover boards, page block edges, page surfaces ----------------------------------
    const cover = cv.mask().plot((x, y) => x >= 4 && x <= W - 5 && y >= yT(x) + 2 && y < yN(x) + 10);
    cel(cv, cover, [B[5], B[4], B[3]], { shadow: B[2], k: 3, hi: B[7], drop: false });
    for (const [x, f] of [[4, 0], [W - 13, 1]]) { // ice corner fittings
      const y0 = Math.round(yN(x + 4)) + 3;
      const c = cv.mask().poly(f ? [[x + 9, y0], [x + 9, y0 + 8], [x, y0 + 8]] : [[x, y0], [x + 9, y0 + 8], [x, y0 + 8]]).and(cover);
      cv.fill(c, B[7]).fill(c.sub(c.shift(-1, -1)), B[5]);
    }
    const edges = cv.mask().plot((x, y) => x >= 10 && x <= W - 11 && y >= yN(x) && y < yN(x) + 6);
    cv.fill(edges, (x, y) => {
      const r = Math.floor(y - yN(x));
      return x > CX ? (r % 2 ? P[2] : P[3]) : r % 2 ? P[3] : P[4];
    });
    cv.fill(edges.sub(edges.shift(0, -1)), P[1]);
    cv.outline(INK, edges, { all: true });
    const pageL = cv.mask().plot((x, y) => x >= 10 && x < CX && y >= yT(x) && y < yN(x));
    const pageR = cv.mask().plot((x, y) => x >= CX && x <= W - 11 && y >= yT(x) && y < yN(x));
    cv.grad(pageL, [P[5], P[4], P[3]], { dir: 'h', soft: 0.6, from: 10, to: CX });
    cv.grad(pageR, [P[4], P[3], P[3]], { dir: 'h', soft: 0.6, from: CX, to: W - 11 });
    cv.fill(pageR.sub(pageR.shift(-3, -2)), P[2]); // hard cel band along the front of the right page
    // Gutter: pages curl down into the spine.
    cv.fill(pageL.and(cv.mask().rect(CX - 5, 0, 5, H)), P[3]).fill(pageL.and(cv.mask().rect(CX - 2, 0, 2, H)), P[2]);
    cv.fill(pageR.and(cv.mask().rect(CX, 0, 6, H)), P[2]).fill(pageR.and(cv.mask().rect(CX, 0, 2, H)), P[1]);
    // Lit far edges of the pages.
    cv.fill(pageL.sub(pageL.shift(0, 1)), WHITE).fill(pageR.sub(pageR.shift(0, 1)), P[5]);
    // Handwritten lines of spell text.
    let s = 11;
    const rnd = () => ((s = (s * 1103515245 + 12345) & 0x7fffffff) / 0x7fffffff);
    for (const [pg, x0, x1, c] of [[pageL, 54, CX - 8, P[2]], [pageR, CX + 9, 170, P[1]], [pageR, 200, W - 22, P[1]]]) {
      for (const j of [0.28, 0.5, 0.72]) {
        let x = x0 + Math.floor(rnd() * 4);
        while (x < x1) {
          const n = 3 + Math.floor(rnd() * 7);
          for (let i = 0; i < n && x < x1; i++, x++) {
            const y = Math.round(yT(x) + (yN(x) - yT(x)) * j);
            if (pg.has(x, y) && pg.has(x, y + 2)) cv.set(x, y, c);
          }
          x += 2;
        }
      }
    }
    const pages = pageL.or(pageR);
    cv.outline(INK, pages, { all: true });
    cv.rect(CX - 1, Math.round(yT(CX)) - 1, 2, Math.round(yN(CX) - yT(CX)) + 2, INK); // spine crease

    // Bookmark ribbon hanging from the spine over the lectern.
    const rib = cv.mask().rect(CX - 2, 180, 5, 28).sub(cv.mask().poly([[CX - 2, 208], [CX + 0.5, 204], [CX + 3, 208]]));
    cv.cast(rib.dilate(1), 1, 1, -1);
    cv.fill(rib, Y[2]).fill(rib.and(cv.mask().rect(CX - 2, 0, 1, H)), Y[3]).fill(rib.and(cv.mask().rect(CX + 2, 0, 1, H)), Y[1]);
    cv.fill(rib.and(cv.mask().rect(0, 188, W, 1)), Y[1]);
    cv.outline(INK, rib, { all: true });

    // ---- Potions on the left page --------------------------------------------------------------
    // Round flask of glowing cyan.
    const flaskB = cv.mask().circle(28, 156, 8), neck = cv.mask().rect(25, 141, 7, 8), lipM = cv.mask().rrect(23, 139, 11, 3, 1);
    const flask = flaskB.or(neck).or(lipM);
    cv.cast(flask.dilate(1), 2, 1, -1);
    cv.fill(flask, B[7]);
    const liq = flaskB.and(cv.mask().rect(0, 154, W, 20));
    cv.grad(liq, [K[3], K[2], K[1]], { soft: 0.6 });
    cv.fill(liq.sub(liq.shift(0, 1)), K[4]);
    cv.fill(flaskB.sub(flaskB.shift(-3, -3)).and(liq), K[0]); // cel band
    cv.fill(flaskB.and(cv.mask().rect(0, 148, W, 6)), (x, y) => (bayer(x, y) < 0.5 ? B[7] : B[8]));
    cv.px([[22, 152], [22, 153], [23, 150], [24, 149], [21, 155]], WHITE).set(31, 159, K[4]).set(26, 160, K[4]);
    cv.fill(neck, B[8]).fill(neck.and(cv.mask().rect(30, 0, 2, H)), B[6]);
    const cork = cv.mask().rect(26, 135, 5, 4);
    cv.fill(cork, Y[1]).set(26, 135, Y[2]).set(27, 135, Y[2]);
    cv.outline(INK, flask.or(cork), { all: true });
    // Tall slim bottle of deep starry blue.
    const bot = cv.mask().rrect(40, 143, 10, 21, 3), bneck = cv.mask().rect(42, 136, 6, 8);
    const bottle = bot.or(bneck);
    cv.cast(bottle.dilate(1), 2, 1, -1);
    cv.grad(bot, [B[5], B[3], B[2]], { soft: 0.6 });
    cv.fill(bot.sub(bot.shift(-3, -3)), B[1]);
    cv.fill(bot.and(cv.mask().rect(0, 143, W, 3)), B[7]);
    cv.px([[44, 151], [47, 155], [43, 158], [46, 160]], B[8]).set(45, 154, WHITE);
    cv.rect(41, 146, 1, 9, WHITE);
    cv.fill(bneck, B[7]).fill(bneck.and(cv.mask().rect(46, 0, 2, H)), B[5]);
    const cork2 = cv.mask().rrect(42, 131, 6, 5, [2, 2, 0, 0]);
    cv.fill(cork2, Y[1]).set(43, 132, Y[2]);
    cv.outline(INK, bottle.or(cork2), { all: true });

    // ---- Crystal wand on the right page -------------------------------------------------------
    const wand = cv.mask().capsule(176, 172, 218, 163, 1.1);
    cv.cast(wand.dilate(1), 1, 2, -1);
    cv.fill(wand, B[2]).fill(wand.sub(wand.shift(0, 1)), B[5]);
    for (const x of [184, 200]) cv.fill(wand.and(cv.mask().rect(x, 0, 2, H)), B[8]);
    cv.outline(INK, wand, { all: true });
    const cry = cv.mask().poly([[216, 163], [222, 154], [232, 151], [229, 160], [220, 166]]);
    cv.cast(cry.dilate(1), 1, 2, -1);
    cv.grad(cry, [K[4], K[3], K[2]], { dir: { cx: 222, cy: 154, r: 12 }, soft: 0.5 });
    cv.fill(cry.sub(cry.shift(-2, -2)), K[1]);
    cv.px([[222, 156], [223, 155], [224, 154]], WHITE);
    cv.outline(INK, cry, { all: true });

    // ---- Owl familiar perched on the right cover corner ---------------------------------------
    const ox = 236, oy = 124;
    const tufts = cv.mask().poly([[ox + 1, oy + 9], [ox + 1, oy - 1], [ox + 9, oy + 5]])
      .or(cv.mask().poly([[ox + 25, oy + 9], [ox + 25, oy - 1], [ox + 17, oy + 5]]));
    const owlBody = cv.mask().oval(ox, oy + 2, 26, 25).or(tufts);
    cel(cv, owlBody, [B[7], B[6], B[5], B[4]], { shadow: B[3], k: 3, hi: B[8] });
    const wings = cv.mask().oval(ox + 1, oy + 12, 7, 13).or(cv.mask().oval(ox + 18, oy + 12, 7, 13)).and(owlBody);
    cv.fill(wings, B[4]).fill(wings.and(cv.mask().rect(ox + 18, 0, 8, H)), B[3]);
    cv.fill(wings.sub(wings.shift(1, 1)), B[6]);
    const belly = cv.mask().oval(ox + 7, oy + 15, 12, 11).and(owlBody.erode(1));
    cv.fill(belly, B[8]);
    for (const [x, y] of [[ox + 10, oy + 18], [ox + 14, oy + 18], [ox + 12, oy + 21], [ox + 9, oy + 23], [ox + 15, oy + 23]]) cv.px([[x, y], [x + 1, y + 1], [x + 2, y]], B[6]);
    const disc = cv.mask().circle(ox + 8, oy + 10, 5).or(cv.mask().circle(ox + 17, oy + 10, 5));
    cv.fill(disc, B[8]).fill(disc.sub(disc.shift(0, -1)).and(cv.mask().rect(0, oy + 12, W, 4)), B[6]);
    for (const ex of [ox + 8, ox + 17]) {
      const eye = cv.mask().circle(ex, oy + 10, 3);
      cv.fill(eye, Y[2]).fill(eye.and(cv.mask().rect(0, oy + 7, W, 2)), Y[3]);
      cv.outline(INK, eye, { all: true });
      cv.rect(ex - 1, oy + 9, 2, 3, INK).set(ex - 1, oy + 9, WHITE);
    }
    cv.px([[ox + 12, oy + 13], [ox + 13, oy + 13], [ox + 12, oy + 14], [ox + 13, oy + 14], [ox + 12, oy + 15]], Y[1]).set(ox + 12, oy + 13, Y[3]);
    for (const fx of [ox + 7, ox + 15]) cv.px([[fx, oy + 27], [fx + 2, oy + 27], [fx + 4, oy + 27], [fx + 1, oy + 26], [fx + 3, oy + 26]], Y[1]);
    const ob = cv.layer('ob'); // blinking eyelids
    for (const ex of [ox + 8, ox + 17]) {
      const eye = cv.mask().circle(ex, oy + 10, 3);
      ob.fill(eye, B[6]).fill(eye.and(cv.mask().rect(0, oy + 10, W, 1)), INK);
    }

    // ---- Floating candles ---------------------------------------------------------------------
    const candles = [[19, 46, 30, 10], [26, 96, 18, 8], [250, 58, 28, 10]];
    const flames = [];
    for (const [x, y, h, w] of candles) {
      const body = cv.mask().rect(x - (w >> 1), y, w, h).or(cv.mask().rect(x - (w >> 1) + 2, y - 1, w - 4, 1));
      cel(cv, body, [P[5], P[4], P[3]], { shadow: P[2], k: 2, hi: WHITE });
      cv.rect(x - (w >> 1) + 1, y + 1, w - 3, 1, P[5]);
      cv.rect(x - (w >> 1) + 2, y + 2, 1, 4, P[5]).set(x - (w >> 1) + 2, y + 6, P[4]); // wax drip
      cv.rect(x + 1, y + 2, 1, 2, P[4]);
      const dish = cv.mask().oval(x - (w >> 1) - 3, y + h - 1, w + 6, 5);
      cel(cv, dish, [B[6], B[5], B[4]], { shadow: B[3], k: 2, hi: B[8] });
      cv.rect(x, y - 3, 1, 3, INK);
      flames.push([x - 3, y - 14]);
    }

    // ---- Global ink, then the glow effects that sit outside it ---------------------------------
    cv.outline(INK);
    const solid = cv.opaque();

    // Summoning circle glowing on the floor around the lectern base.
    const fc = { x: CX + 0.5, y: 233.5 };
    const ell = (rx, ry) => (x, y) => ((x + 0.5 - fc.x) / rx) ** 2 + ((y + 0.5 - fc.y) / ry) ** 2;
    const free = solid.not();
    const disk = cv.mask().plot((x, y) => ell(124, 13)(x, y) <= 1).and(free);
    cv.fill(disk, (x, y) => { const d = ell(124, 13)(x, y); return d < 0.5 || bayer(x, y) < 1.4 - d ? B[0] : undefined; });
    const ringAt = (rx, ry) => cv.mask().plot((x, y) => ell(rx, ry)(x, y) <= 1).edge(true).and(free);
    cv.fill(ringAt(124, 13), K[3]);
    cv.fill(ringAt(110, 10), K[2]);
    const hexa = cv.mask();
    for (const off of [0, Math.PI]) {
      const pts = [0, 1, 2].map((i) => {
        const a = off - Math.PI / 2 + (i * 2 * Math.PI) / 3;
        return [Math.round(fc.x + 108 * Math.cos(a)), Math.round(fc.y + 9.6 * Math.sin(a))];
      });
      for (let i = 0; i < 3; i++) hexa.line(...pts[i], ...pts[(i + 1) % 3]);
    }
    cv.fill(hexa.and(free), K[1]);
    const rbl = cv.layer('rb');
    for (let i = 0; i < 24; i++) {
      const a = (i / 24) * Math.PI * 2, x = Math.round(fc.x - 0.5 + 117 * Math.cos(a)), y = Math.round(fc.y - 0.5 + 11.5 * Math.sin(a));
      if (!free.has(x, y)) continue;
      cv.set(x, y, i % 2 ? K[2] : K[3]);
      if (i % 3 === 0) rbl.set(x, y, K[4]);
    }

    // Faint dithered aura around the portal arch.
    for (let d = 2; d <= 6; d++) {
      const ring = arch.dilate(d, true).sub(arch.dilate(d - 1, true)).and(free).clip(0, 0, W, 146);
      const t = [0, 0, 0.45, 0.3, 0.18, 0.1, 0.05][d];
      cv.fill(ring, (x, y) => (bayer(x, y) < t ? (d < 4 ? K[2] : B[5]) : undefined));
    }

    // Candle flames: two flicker frames on alternating layers.
    const fa = cv.layer('fa'), fb = cv.layer('fb');
    flames.forEach(([x, y], n) => {
      const [A, Bf] = n % 2 ? [FLAME[1], FLAME[0]] : FLAME;
      for (const [l, f] of [[fa, A], [fb, Bf]]) {
        sprite(l, x, y, f, FL);
        l.outline(INK, spriteMask(cv, x, y, f), { all: true });
      }
    });

    // Magic motes.
    for (const [x, y, n] of [[14, 22, 2], [252, 30, 2], [234, 102, 1], [8, 136, 1], [38, 8, 1], [228, 12, 1]]) sparkle(cv, x, y, n, B[7], WHITE);
    const tw = cv.layer('tw');
    for (const [x, y, n] of [[264, 96, 1], [6, 76, 1], [104, 4, 1], [170, 3, 1], [236, 150, 1]]) sparkle(tw, x, y, n, K[3], WHITE);

    return cv.punch(...HOLE, HR);
  },
};
