// Blue Cel star chart: an antique-style night map board in cel-shaded blues. A dithered cobalt-to-ice
// molding with corner blocks and a striped neatline frames a deep navy field with a fine dotted grid,
// a compass rose and five original playful constellations (cat, teapot, whale, gamepad, rabbit) whose
// brightest stars glow gold. A title cartouche sits on top, a sliding planisphere dial on the bottom
// edge, and a little blue telescope on a tripod stands at the right. Stars twinkle in two phases.
import { Canvas, Mask, bayer, rng } from '../pixel.mjs';
import { INK, inset } from '../kit.mjs';

const W = 304, H = 200, HOLE = [56, 34, 160, 90], HR = 3; // 16:9
// Shared Blue Cel ramp: navy -> cobalt -> azure -> cyan -> ice (same values as px-cel-crt).
const B = ['#0a1140', '#111d68', '#18308f', '#2149bb', '#2d6ade', '#4790f2', '#6cb8fd', '#a3dfff', '#e0f6ff'];
const M = ['#252c52', '#4c5888', '#8693c0', '#c3cdec', '#f2f5ff']; // silver star lines
const Y = ['#7a4a10', '#c7861d', '#ffc23d', '#ffe38a', '#fff7d6']; // the one warm accent: brightest stars
const WHITE = '#ffffff';

/** Cel-shade a volume: dithered gradient, one hard core-shadow band lower-right, lit top-left edge, ink. */
function cel(cv, m, grad, { shadow, k = 3, hi, drop = true, ink = true, soft = 0.6, dir } = {}) {
  if (drop) cv.cast(m.dilate(1), 1, 1, -1);
  if (grad.length > 1) cv.grad(m, grad, { soft, ...(dir ? { dir } : {}) }); else cv.fill(m, grad[0]);
  const core = m.sub(m.shift(-k, -k));
  if (shadow) cv.fill(core, shadow);
  if (hi) cv.fill(m.sub(m.shift(1, 1)).sub(core), hi);
  if (ink) cv.outline(INK, m, { all: true });
  return core;
}

// Constellations (local coords from o): stars [x, y, size] (0 faint, 1 soft plus, 2 bright plus), star
// paths (indices), a figure silhouette built from primitives (m = local mask maker), and a gold star.
const CONST = {
  cat: { // sitting cat with pointy ears and a tail curled up its side; the gold star is its collar bell
    o: [14, 50],
    s: [[5, 14, 1], [7, 0, 2], [14, 7, 0], [20, 7, 0], [27, 0, 2], [28, 14, 1], [17, 24, 1], [6, 46, 1], [9, 68, 1], [26, 68, 1], [29, 46, 1], [1, 58, 0], [1, 47, 1], [12, 15, 0], [22, 15, 0]],
    p: [[0, 1, 2, 3, 4, 5, 6, 0], [6, 7, 8, 9, 10, 6], [8, 11, 12]],
    fig: (m) => m.oval(5, 6, 24, 18).poly([[6, 13], [7, 0], [16, 8]]).poly([[18, 8], [27.5, 0], [28.5, 13]])
      .oval(9, 18, 16, 14).oval(6, 26, 24, 44).capsule(9, 67, 2, 62, 1.6).capsule(2, 62, 1, 48, 1.6),
    gold: 6,
  },
  teapot: { // round teapot: lid knob on top, spout right, handle left
    o: [221, 19],
    s: [[17, 1, 1], [9, 7, 1], [25, 7, 1], [4, 15, 1], [30, 15, 0], [7, 26, 1], [27, 26, 1], [35, 4, 2], [0, 15, 0], [1, 21, 0]],
    p: [[1, 0, 2], [1, 3, 5, 6, 4, 2], [4, 7], [3, 8, 9, 5]],
    fig: (m) => m.oval(3, 8, 29, 20).oval(8, 4, 19, 7).circle(17, 2, 1.5).poly([[28, 16], [34, 3], [37, 5], [31, 22]])
      .or(new Mask(96, 96).oval(0, 11, 9, 13).sub(new Mask(96, 96).oval(2, 14, 4, 7))),
    gold: 0,
  },
  rabbit: { // sitting bunny facing left, long ears, puff tail
    o: [223, 58],
    s: [[3, 21, 1], [5, 0, 2], [12, 13, 0], [18, 1, 1], [20, 16, 1], [29, 39, 1], [24, 61, 1], [2, 60, 1], [8, 33, 0], [33, 48, 2], [9, 19, 1]],
    p: [[0, 1, 2, 3, 4, 5, 6, 7, 8, 0], [5, 9]],
    fig: (m) => m.capsule(6, 2, 9, 16, 2.4).capsule(17, 2, 15, 16, 2.4).oval(2, 13, 19, 15).oval(6, 24, 26, 38)
      .oval(1, 56, 15, 6).circle(32, 48, 2),
    gold: 10,
  },
  whale: { // round cartoon whale swimming left, tail flipped up, spouting
    o: [15, 131],
    s: [[0, 20, 1], [8, 10, 1], [30, 8, 1], [52, 13, 1], [49, 3, 1], [70, 1, 2], [57, 26, 1], [34, 32, 1], [8, 29, 0], [11, 17, 1], [12, 3, 0], [7, 1, 0], [17, 1, 0], [23, 34, 0]],
    p: [[0, 1, 2, 3, 4, 5, 3], [3, 6, 7, 8, 0], [1, 10, 11], [10, 12], [7, 13]],
    fig: (m) => m.oval(0, 8, 56, 26).capsule(47, 23, 58, 12, 3.6)
      .poly([[48, 3], [57, 8], [67, 0], [72, 2], [63, 13], [54, 13]])
      .poly([[19, 27], [29, 28], [23, 34]])
      .capsule(12, 8, 12, 4, 1).capsule(12, 4, 8, 2, 0.8).capsule(12, 4, 16, 2, 0.8),
    gold: 9,
    cut: (m) => m.line(3, 23, 7, 25).line(8, 25, 11, 24), // smile
  },
  pad: { // chunky gamepad: angled grips, a printed d-pad cross and two round buttons
    o: [184, 133],
    s: [[9, 2, 1], [63, 2, 1], [71, 18, 1], [64, 30, 1], [52, 21, 0], [20, 21, 0], [8, 30, 1], [1, 18, 1], [16, 6, 1], [16, 16, 1], [11, 11, 0], [21, 11, 0], [55, 14, 1], [60, 8, 2], [33, 12, 0], [39, 12, 0]],
    p: [[0, 1, 2, 3, 4, 5, 6, 7, 0], [8, 9], [10, 11]],
    fig: (m) => m.rrect(4, 2, 65, 20, 8).capsule(11, 16, 8, 27, 4.6).capsule(61, 16, 64, 27, 4.6),
    cut: (m) => m.rect(14, 8, 5, 7).rect(12, 10, 9, 3).circle(55, 14, 2).circle(60, 8, 2).rect(31, 12, 4, 1).rect(37, 12, 4, 1),
    gold: 12,
  },
};

export default {
  id: 'px-cel-constellation', name: 'Star Chart', theme: 'constellations', rarity: 'rare', translucent: false,
  collection: 'blue-cel', license: 'CC-BY-4.0',
  desc: 'An antique blue star map where a cat, a whale, a teapot, a rabbit and a gamepad twinkle around your game.',
  tags: ['constellations', 'stars', 'night-sky', 'cel-shaded', 'blue', 'animated'],
  css: '.twa{animation:tw 2s steps(1) infinite}.twb{animation:tw 2s steps(1) -1s infinite}@keyframes tw{50%{opacity:0}}',
  draw() {
    const cv = new Canvas(W, H);
    cv.use(B, M, Y);
    const twa = cv.layer('twa'), twb = cv.layer('twb');
    const R = rng(7);

    // Dithered floor shadow under the board and the tripod.
    const floor = cv.mask().oval(4, 186, 298, 10);
    cv.fill(floor, (x, y) => {
      const d = ((x + 0.5 - 153) / 149) ** 2 + ((y + 0.5 - 191) / 5) ** 2;
      return d < 0.45 || bayer(x, y) < 1.15 - d ? INK : undefined;
    });

    // Little bracket feet.
    for (const x of [22, 222]) cel(cv, cv.mask().rrect(x, 176, 28, 12, [0, 0, 5, 5]), [B[5], B[4], B[3]], { shadow: B[2], k: 2, hi: B[7] });

    // Board: cel-shaded molding (dithered ice -> cobalt), striped neatline, deep night field.
    const board = cv.mask().rrect(3, 7, 266, 170, 7);
    const innerN = cv.mask().rect(9, 13, 254, 158); // neatline + field
    const field = cv.mask().rect(13, 17, 246, 150);
    const mold = board.sub(innerN);
    cel(cv, mold, [B[8], B[7], B[6], B[5], B[4], B[3]], { shadow: B[2], k: 2, hi: WHITE, soft: 0.5, ink: false });
    // Bead run along the molding's middle.
    for (let x = 18; x < 256; x += 6) { cv.set(x, 9, B[5]).set(x, 10, B[4]).set(x + 1, 174, B[1]); }
    for (let y = 22; y < 166; y += 6) { cv.set(5, y, B[5]).set(6, y, B[4]).set(266, y + 1, B[1]); }
    cv.outline(INK, board, { all: true });
    // Neatline: ink rules with alternating ice / navy degree bars between.
    const neat = innerN.sub(field);
    cv.fill(neat, INK);
    const bars = neat.sub(neat.edge());
    cv.fill(bars, (x, y) => {
      const t = (y === 14 || y === 15 || y === 168 || y === 169) ? x : y;
      return Math.floor((t - 1) / 8) % 2 ? B[2] : B[7];
    });
    // Night field: deep cobalt fading to navy, with a soft light pool from the top-left.
    cv.grad(field, [B[1], B[1], B[0]], { soft: 0.5 });
    cv.glow(field, 18, 20, 52, 1);
    // Fine coordinate grid: hairlines one step lighter.
    const grid = cv.mask();
    for (let x = 23; x < 259; x += 12) grid.rect(x, 17, 1, 150);
    for (let y = 28; y < 167; y += 12) grid.rect(13, y, 246, 1);
    cv.tone(grid.and(field), 1);
    // Degree ticks on the inner side of the neatline.
    for (let x = 17; x < 256; x += 8) { cv.set(x, 17, B[4]).set(x, 166, B[3]); if ((x - 17) % 16 === 0) cv.set(x, 18, B[3]).set(x, 165, B[2]); }
    for (let y = 21; y < 164; y += 8) { cv.set(13, y, B[4]).set(258, y, B[3]); if ((y - 21) % 16 === 0) cv.set(14, y, B[3]).set(257, y, B[2]); }

    // Corner blocks: square rosettes with a four-point star inlay.
    for (const [x, y] of [[2, 6], [258, 6], [2, 166], [258, 166]]) {
      const blk = cv.mask().rect(x, y, 12, 12);
      cel(cv, blk, [B[7], B[6], B[5], B[4]], { shadow: B[3], k: 2, hi: B[8], drop: false });
      const cx = x + 5, cy = y + 5;
      cv.fill(cv.mask().rect(cx - 1, cy - 1, 3, 3), B[2]);
      for (let k = 2; k <= 3; k++) cv.set(cx - k, cy, B[2]).set(cx + k, cy, B[2]).set(cx, cy - k, B[2]).set(cx, cy + k, B[2]);
      cv.set(cx, cy, B[8]).set(cx - 1, cy - 1, B[6]);
    }

    // Screen bezel: a raised cel ring on the chart, dark recessed lip into the opening.
    const [hx, hy, hw, hh] = HOLE;
    const bez = cv.mask().rrect(hx - 6, hy - 6, hw + 12, hh + 12, HR + 5);
    cel(cv, bez, [B[8], B[7], B[6], B[5], B[4]], { shadow: B[3], k: 2, hi: WHITE, soft: 0.5 });
    inset(cv, ...HOLE, HR, { rim: INK, top: B[0], left: B[0], bottom: B[2], right: B[2] }, 2);
    // Specular sliver on the bezel's top-left corner.
    cv.rect(hx + 4, hy - 5, 22, 1, WHITE).rect(hx + 28, hy - 5, 3, 1, WHITE).rect(hx - 5, hy + 4, 1, 14, WHITE).rect(hx - 5, hy + 20, 1, 2, WHITE);

    // Compass rose in the top-left corner.
    {
      const cx = 31, cy = 34;
      const ring = cv.mask().circle(cx, cy, 11).sub(cv.mask().circle(cx, cy, 10));
      ring.each((x, y) => { if ((x + y) % 2 === 0) cv.set(x, y, M[2]); });
      const pt = (a, r, w) => { // one kite-shaped point, split into a lit and a shaded half
        const ca = Math.cos(a), sa = Math.sin(a), nx = -sa, ny = ca;
        const tip = [cx + 0.5 + ca * r, cy + 0.5 + sa * r], c = [cx + 0.5, cy + 0.5];
        const L = cv.mask().poly([c, tip, [c[0] + nx * w, c[1] + ny * w]]);
        const Rr = cv.mask().poly([c, tip, [c[0] - nx * w, c[1] - ny * w]]);
        return [L, Rr];
      };
      for (let i = 0; i < 4; i++) { // diagonals first (behind)
        const [a, b] = pt(Math.PI / 4 + (i * Math.PI) / 2, 8, 2.2);
        cv.fill(a, B[4]).fill(b, B[2]);
      }
      let all = cv.mask();
      for (let i = 0; i < 4; i++) {
        const [a, b] = pt((i * Math.PI) / 2 - Math.PI / 2, 13, 3);
        const lit = i === 0 || i === 3 ? a : b, dark = lit === a ? b : a;
        cv.fill(lit, B[8]).fill(dark, B[5]);
        all = all.or(a).or(b);
      }
      cv.outline(INK, all);
      cv.fill(cv.mask().circle(cx, cy, 1), B[2]).set(cx, cy, Y[3]);
      cv.set(cx, cy - 12, Y[2]); // north point tipped in gold
    }

    // Faint dust stars scattered over the field (kept off the bezel and figures).
    const keep = bez.dilate(3).or(cv.mask().circle(31, 34, 14));
    for (const c of Object.values(CONST)) keep.rect(c.o[0] - 2, c.o[1] - 2, 76, 70);
    for (let i = 0; i < 70; i++) {
      const x = 15 + Math.floor(R() * 242), y = 19 + Math.floor(R() * 146);
      const ok = !keep.has(x, y) || (R() < 0.25 && !bez.dilate(3).has(x, y));
      if (ok && field.has(x, y)) cv.set(x, y, R() < 0.3 ? B[6] : B[4]);
    }

    // Constellations: faint figure, dotted silver lines, white stars, one gold star each.
    let flip = 0;
    for (const c of Object.values(CONST)) {
      const [ox, oy] = c.o, P = c.s.map(([x, y, s]) => [ox + x, oy + y, s]);
      const fig = c.fig(new Mask(96, 96)), figM = cv.mask();
      fig.each((x, y) => figM.put(ox + x, oy + y));
      cv.fill(figM.and(field), B[2]);
      cv.fill(figM.edge().and(field), B[3]);
      if (c.cut) c.cut(new Mask(96, 96)).each((x, y) => cv.set(ox + x, oy + y, B[1]));
      const near = cv.mask();
      for (const [x, y] of P) near.rect(x - 2, y - 2, 5, 5);
      for (const path of c.p) for (let i = 0; i + 1 < path.length; i++) {
        const [x0, y0] = P[path[i]], [x1, y1] = P[path[i + 1]];
        cv.mask().line(x0, y0, x1, y1).sub(near).each((x, y) => { if ((x + y) % 2 === 0) cv.set(x, y, M[3]); });
      }
      P.forEach(([x, y, s], i) => {
        if (i === c.gold) {
          cv.set(x, y, Y[4]);
          for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) cv.set(x + dx, y + dy, Y[2]).set(x + 2 * dx, y + 2 * dy, Y[1]);
          for (const [dx, dy] of [[1, 1], [-1, 1], [1, -1], [-1, -1]]) cv.set(x + dx, y + dy, Y[0]);
          const L = flip++ % 2 ? twa : twb;
          for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) L.set(x + dx, y + dy, Y[3]).set(x + 2 * dx, y + 2 * dy, Y[2]).set(x + 3 * dx, y + 3 * dy, Y[1]);
          L.set(x, y, WHITE);
          return;
        }
        cv.set(x, y, s ? WHITE : B[8]);
        if (s) for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) cv.set(x + dx, y + dy, s > 1 ? B[7] : B[5]);
        if (s > 1) {
          const L = flip++ % 2 ? twa : twb;
          for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) L.set(x + 2 * dx, y + 2 * dy, B[6]);
        }
      });
    }

    // Title cartouche on the top edge: a scroll plate with the brand.
    {
      const plate = cv.mask().rrect(106, 1, 60, 13, 3);
      const curlL = cv.mask().circle(104, 9, 4), curlR = cv.mask().circle(167, 9, 4);
      cel(cv, curlL.or(curlR), [B[5], B[4], B[3]], { shadow: B[2], k: 2, hi: B[7] });
      cv.fill(cv.mask().circle(104, 9, 1), B[1]).fill(cv.mask().circle(167, 9, 1), B[1]);
      cel(cv, plate, [B[8], B[7], B[7], B[6]], { shadow: B[5], k: 2, hi: WHITE, soft: 0.5 });
      const t = cv.textMask('KAYBORO', 136, 4, { font: 5, align: 'center' });
      cv.fill(t.shift(1, 1).sub(t), B[6]).fill(t, B[2]);
    }

    // Sliding planisphere on the bottom edge: a pale cover plate with an oval window over a star wheel,
    // a date ring of ticks round the wheel, and a slider knob in a rail.
    {
      const cx = 136, cy = 163;
      const hous = cv.mask().rrect(92, 144, 88, 40, 12);
      cel(cv, hous, [B[6], B[5], B[4], B[3]], { shadow: B[2], k: 3, hi: B[8], soft: 0.5 });
      const wheel = cv.mask().circle(cx, cy, 16);
      cv.fill(wheel, B[2]);
      cv.fill(wheel.sub(wheel.shift(1, 1)), B[1]);
      cv.fill(wheel.sub(wheel.shift(-1, -1)), B[4]);
      for (let a = 0; a < 360; a += 15) {
        const t = (a * Math.PI) / 180, r = a % 45 ? 14 : 13;
        for (let rr = r; rr <= 15; rr++) cv.set(Math.round(cx + Math.cos(t) * rr), Math.round(cy + Math.sin(t) * rr), B[7]);
      }
      cv.outline(INK, wheel, { all: true });
      const win = cv.mask().oval(cx - 11, cy - 8, 23, 15);
      cv.grad(win, [B[1], B[0]], { soft: 0.8 });
      cv.fill(win.sub(win.shift(0, 2)), INK);
      for (const [x, y] of [[-6, -1], [-2, 3], [3, -3], [7, 1], [-8, 3], [1, 5]]) cv.set(cx + x, cy + y, B[7]);
      cv.px([[cx - 2, cy - 2]], Y[3]); cv.px([[cx - 3, cy - 2], [cx - 1, cy - 2], [cx - 2, cy - 3], [cx - 2, cy - 1]], Y[1]);
      cv.outline(INK, win, { all: true });
      cv.set(cx - 7, cy - 5, B[6]);
      // Rail with a slider knob on each side of the wheel.
      for (const [x0, kx] of [[98, 104], [157, 168]]) {
        cv.rect(x0, 167, 18, 3, INK).rect(x0 + 1, 168, 16, 1, B[1]);
        const knob = cv.mask().rrect(kx - 3, 162, 7, 11, 2);
        cel(cv, knob, [B[8], B[6], B[5]], { shadow: B[4], k: 1, hi: WHITE });
        cv.rect(kx - 1, 166, 3, 1, B[3]).rect(kx - 1, 168, 3, 1, B[3]);
      }
      cv.rect(100, 151, 8, 1, WHITE).set(97, 153, WHITE).set(97, 154, B[8]);
    }

    // Telescope on a tripod, standing in front of the right edge.
    {
      const ax = 285, ay = 114; // tripod head
      const legs = [[ax, ay, 269, 194], [ax, ay, 300, 194]];
      const back = cv.mask().capsule(ax, ay, 287, 190, 1);
      cv.fill(back, B[2]); cv.outline(INK, back, { all: true });
      for (const [x0, y0, x1, y1] of legs) {
        const lg = cv.mask().capsule(x0, y0, x1, y1, 1.2);
        cv.cast(lg.dilate(1), 1, 1, -1);
        cv.fill(lg, B[4]);
        cv.fill(lg.sub(lg.shift(1, 0)), B[6]);
        cv.fill(lg.sub(lg.shift(-1, 0)), B[3]);
        cv.outline(INK, lg, { all: true });
        cv.fill(cv.mask().rect(x1 - 2, y1, 5, 2), B[2]);
        cv.outline(INK, cv.mask().rect(x1 - 2, y1, 5, 2), { all: true });
      }
      // Spreader tray between the legs.
      cv.rect(276, 160, 19, 2, B[5]).rect(276, 160, 19, 1, B[7]);
      cv.outline(INK, cv.mask().rect(276, 160, 19, 2));
      // Tube: eyepiece end low-left, objective high-right.
      const ex = 270, ey = 124, ox = 297, oy = 82;
      const len = Math.hypot(ox - ex, oy - ey), ux = (ox - ex) / len, uy = (oy - ey) / len;
      const along = (x, y) => (x + 0.5 - ex) * ux + (y + 0.5 - ey) * uy;
      const tube = cv.mask().capsule(ex, ey, ox - 3, oy + 5, 4.2);
      const shield = cv.mask().capsule(ox - 4, oy + 7, ox, oy, 5.4);
      cel(cv, tube, [B[7], B[6], B[5]], { shadow: B[3], k: 3, hi: B[8], soft: 0.5 });
      // Darker cobalt bands round the tube, each with its own lit lip.
      for (const a of [9, 24]) {
        const band = tube.and(cv.mask().plot((x, y) => { const t = along(x, y); return t >= a && t < a + 3; }));
        cv.fill(band, B[3]).fill(band.and(tube.sub(tube.shift(-3, -3))), B[2]);
        cv.fill(band.and(cv.mask().plot((x, y) => along(x, y) >= a + 2)).sub(tube.sub(tube.shift(-3, -3))), B[5]);
      }
      cv.outline(INK, tube, { all: true });
      cel(cv, shield, [B[5], B[4], B[3]], { shadow: B[2], k: 2, hi: B[7], soft: 0.5 });
      const lens = cv.mask().oval(ox - 2, oy - 4, 5, 5);
      cv.fill(lens.and(shield), B[0]).set(ox - 1, oy - 3, B[7]).set(ox, oy - 2, B[2]);
      // Eyepiece sticking out of the back end.
      const eye = cv.mask().capsule(ex - ux * 4, ey - uy * 4, ex - ux * 8, ey - uy * 8, 1.8);
      cel(cv, eye, [B[4], B[3]], { shadow: B[2], k: 1, hi: B[6] });
      // Mount on the tripod head.
      const mount = cv.mask().rrect(ax - 4, ay - 10, 9, 12, 2);
      cel(cv, mount, [B[5], B[4], B[3]], { shadow: B[2], k: 2, hi: B[7] });
      cv.fill(cv.mask().circle(ax, ay - 6, 1), B[1]).set(ax - 1, ay - 7, B[7]);
      // Anime specular sliver along the tube's lit side.
      cv.fill(cv.mask().line(ex - 1, ey - 5, ox - 8, oy + 3).and(tube.erode(1)).and(cv.mask().plot((x, y) => { const t = along(x, y); return t > 3 && t < 8 || t > 13 && t < 22; })), WHITE);
    }

    // Sparkles off the board's top corners.
    sparkle4(cv, 284, 14, 2, B[7], WHITE);
    sparkle4(cv, 296, 34, 1, B[6], B[8]);
    sparkle4(twa, 186, 3, 1, B[7], WHITE);
    sparkle4(twb, 84, 3, 1, B[7], WHITE);

    cv.outline(INK);
    return cv.punch(...HOLE, HR);
  },
};

function sparkle4(cv, x, y, n, c, core) {
  for (let k = 1; k <= n; k++) for (const [dx, dy] of [[k, 0], [-k, 0], [0, k], [0, -k]]) cv.set(x + dx, y + dy, c);
  cv.set(x, y, core);
}
