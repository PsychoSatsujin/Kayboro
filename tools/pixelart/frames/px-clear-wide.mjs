// Landscape handheld in see-through tangerine plastic: a chamfered slab with round bumper lobes on both
// sides. The x-ray view shows the circuit board, chips, battery, screws, speaker and a ribbon cable
// inside; smoky lens, a dimpled dial pad on the left, a crescent of gem keys on the right, and a slider
// switch plus a ribbed thumb roller under the screen.
import { Canvas, alpha, bayer, rng } from '../pixel.mjs';
import { INK, SHAPES, inset, part, screw, sparkle, sprite, sticker } from '../kit.mjs';

const W = 288, H = 176, HOLE = [64, 26, 160, 90], HR = 3; // 16:9
const P = ['#4a1606', '#7c2a0a', '#b2440f', '#dc6418', '#f4872e', '#ffb066', '#ffe0bc']; // clear tangerine plastic
const G = ['#16163e', '#1e2556', '#283a66', '#314f74', '#44707e', '#64938c']; // circuit board (seen through)
const S = ['#0f1013', '#1a1c21', '#26292f', '#34383f', '#464b54', '#626872', '#9198a3']; // smoky lens
const D = ['#111216', '#1d1f26', '#2c2f39', '#3e424f', '#555a6a']; // charcoal rubber
const Dp = ['#17181e', '#2c2e38', '#444756', '#5c6072', '#767b90', '#9aa0b4']; // dial pad (lifted charcoal)
const K = ['#0f4a4a', '#1f8073', '#3ab7a0', '#7fe5c8', '#d6fff1']; // mint gem keys
const Au = ['#5a3a10', '#9a6a1c', '#d8a23a', '#f6d77a', '#fff4c8']; // gold pins
const Am = ['#4a1e10', '#8a3e18', '#c8692a', '#ee9a4a', '#ffd09a']; // amber flex cable
const Ch = ['#0d0b14', '#1a1724', '#2a2638', '#3d384f']; // chip epoxy
const Ag = ['#3a3a52', '#6c6e88', '#a3a6bf', '#dfe1f0']; // silver
const Lv = ['#5a3624', '#8c5e40', '#c48e66', '#ecc29a', '#fff0dc']; // cream slider knob + roller
const Cp = ['#141a3a', '#22306e', '#3a52a8', '#7c94e0']; // electrolytic cap can
const Pk = ['#4a1238', '#8a2860', '#d0508a', '#f27aac', '#ffb6d4']; // rose gem + sticker
const GLOSS = '#fff4e6', WIRE = '#4fd6ff';

export default {
  id: 'px-clear-wide', name: 'Crystal Wide', theme: 'clear-plastic', rarity: 'rare', translucent: true,
  collection: 'pocket-pals', license: 'CC-BY-4.0',
  desc: 'Peek inside a wide-screen handheld made of see-through tangerine plastic, chips, battery and all.',
  tags: ['handheld', 'clear-plastic', 'widescreen', 'x-ray', 'animated', 'pixel'],
  css: '.blink{animation:bl 1.6s steps(1) infinite}@keyframes bl{60%{opacity:0}}',
  draw() {
    const cv = new Canvas(W, H);
    cv.use(P, G, S, D, Dp, K, Au, Am, Ch, Ag, Lv, Cp, Pk);
    const R = rng(7);

    // Body: a chamfered slab with a round bumper lobe on each side.
    const c = 16;
    const slab = cv.mask().poly([[16 + c, 4], [272 - c, 4], [272, 4 + c], [272, 166 - c], [272 - c, 166], [16 + c, 166], [16, 166 - c], [16, 4 + c]]);
    const body = slab.or(cv.mask().oval(2, 24, 62, 128)).or(cv.mask().oval(224, 24, 62, 128));
    cv.shade(body, P, { top: [6, 5], left: [5], bottom: [1, 2], right: [2], fill: 3 });
    const inner = body.erode(3);

    // Molded inner wall a few px inside the edge: lit on the bottom-right inner face, shadowed top-left.
    const wall = body.erode(5);
    cv.fill(wall.edge(), (x, y, c) => (P.includes(c) ? (wall.has(x + 1, y + 1) ? P[2] : P[5]) : c));

    // ---- the insides (drawn under the plastic face) ----------------------------------------------
    const rib = (m) => { cv.fill(m.edge(), P[5]).fill(m.edge().and(m.shift(1, 1).not()).and(m.shift(0, 1).not()), P[2]); return m; };
    rib(cv.mask().rrect(242, 92, 38, 36, 3).and(inner)); // battery bay (right lobe)
    rib(cv.mask().circle(28, 112, 15).and(inner)); // speaker cup (left lobe)

    const pcb = cv.mask().rrect(44, 13, 200, 137, 6).or(cv.mask().rrect(10, 32, 44, 54, 6)).or(cv.mask().rrect(234, 30, 44, 52, 6)).and(inner);
    cv.cast(pcb, 1, 1, -1);
    cv.shade(pcb, G, { top: [0], left: [0], bottom: [4], right: [4], fill: 2 });
    cv.fill(pcb.erode(1).edge(), G[1]);
    const [dx, dy] = [32, 58];
    // Gem crescent: three keys on an arc that opens toward the screen.
    const [ox, oy, orad] = [234, 62, 22];
    const arc = (deg) => [Math.round(ox + orad * Math.cos((deg * Math.PI) / 180)), Math.round(oy + orad * Math.sin((deg * Math.PI) / 180))];
    let crescent = cv.mask();
    for (let a = -58; a < 58; a += 4) crescent = crescent.or(cv.mask().capsule(...arc(a), ...arc(a + 4), 10));
    const occ = cv.mask().rrect(52, 12, 184, 120, 6).or(cv.mask().circle(dx, dy, 20)).or(crescent.dilate(1)); // under the face parts
    const lineM = (pts) => { let m = cv.mask(); for (let i = 1; i < pts.length; i++) m = m.or(cv.mask().line(...pts[i - 1], ...pts[i])); return m; };
    const trace = (pts) => {
      const m = lineM(pts).and(pcb.erode(1)).sub(occ);
      cv.fill(m.shift(1, 1).and(pcb).sub(m), G[1]).fill(m, G[4]);
      for (const [ex, ey] of [pts[0], pts[pts.length - 1]]) if (m.has(ex, ey)) cv.set(ex, ey, Au[2]);
    };
    const bus = (n, f, gap = 3) => { for (let i = 0; i < n; i++) trace(f(i * gap)); };
    bus(4, (k) => [[15, 35 + k], [38 - k, 35 + k]]);
    bus(3, (k) => [[15, 82 - k], [24, 82 - k]]);
    bus(4, (k) => [[45 + k, 22], [45 + k, 120]], 2);
    bus(4, (k) => [[236 + k, 20], [236 + k, 100]], 2);
    bus(3, (k) => [[256, 79 - k], [274, 79 - k]]);
    bus(3, (k) => [[60 + k, 147], [60 + k, 136 + k], [64 + k, 132 + k], [72, 132 + k]]);
    bus(3, (k) => [[214 + k, 147], [214 + k, 136 + k], [218 + k, 132 + k], [232, 132 + k]]);

    // Chips: black epoxy with silver legs and a pin-1 dot.
    const chip = (x, y, w, h, legsX = true, legsY = true) => {
      cv.cast(cv.mask().rect(x - 1, y - 1, w + 2, h + 2), 1, 1, -1);
      if (legsY) for (let i = x + 1; i < x + w - 1; i += 2) cv.set(i, y - 1, Ag[2]).set(i, y + h, Ag[1]);
      if (legsX) for (let j = y + 1; j < y + h - 1; j += 2) cv.set(x - 1, j, Ag[2]).set(x + w, j, Ag[1]);
      cv.shade(cv.mask().rect(x, y, w, h), Ch, { top: [3], left: [2], bottom: [0], right: [1], fill: 1 });
      cv.set(x + 2, y + 2, Ch[3]);
    };
    chip(86, 135, 15, 10);

    // Electrolytic cap: a small blue can with a silver X on the top.
    {
      const [x, y] = [77, 142], m = cv.mask().circle(x, y, 2, 1.4);
      part(cv, m, Cp, { top: [2], left: [3], bottom: [0], right: [1], fill: 2 });
      cv.px([[x - 1, y - 1], [x + 1, y - 1], [x, y], [x - 1, y + 1], [x + 1, y + 1]], Ag[2]);
    }

    for (let i = 0; i < 160; i++) { // scatter tiny SMD parts on free board space
      const x = 12 + Math.floor(R() * 264), y = 15 + Math.floor(R() * 133), vert = R() < 0.4;
      const m = cv.mask().rect(x - 1, y - 1, vert ? 3 : 5, vert ? 5 : 3);
      let free = !m.sub(pcb.erode(1)).bbox() && !m.and(occ).bbox();
      if (free) m.each((px, py) => { if (!G.slice(1, 4).includes(cv.get(px, py))) free = false; });
      if (!free) continue;
      const c = R() < 0.5 ? Ch[2] : '#8a6a4a';
      if (vert) cv.set(x, y, Ag[3]).set(x, y + 1, c).set(x, y + 2, Ag[1]);
      else cv.set(x, y, Ag[3]).set(x + 1, y, c).set(x + 2, y, Ag[1]);
    }

    // A tiny critter silkscreened on the board corner (x-ray easter egg).
    cv.fill(cv.mask().rect(222, 140, 7, 1).rect(221, 141, 9, 4).rect(222, 145, 7, 1).rect(222, 139, 1, 1).rect(228, 139, 1, 1).sub(cv.mask().rect(223, 142, 1, 1).rect(227, 142, 1, 1)).and(pcb.erode(1)), G[5]);

    // Amber ribbon cable from the screen down into a board connector.
    const fl = cv.mask().rect(196, 128, 11, 12);
    cv.fill(fl, (x) => ((x - 196) % 3 === 2 ? Am[1] : Am[2])).fill(fl.and(cv.mask().rect(196, 128, 11, 1)), Am[3]);
    part(cv, cv.mask().rect(192, 140, 19, 5), D, { top: [4], left: [3], bottom: [0], right: [1], fill: 2 });
    cv.rect(194, 141, 15, 1, Au[3]);

    // Battery bay: two cells in the right lobe, wired to the board.
    for (const y of [97, 110]) {
      part(cv, cv.mask().rrect(247, y, 28, 10, 3), D, { top: [4], left: [3], bottom: [0], right: [1], fill: 2 });
      cv.rect(255, y + 1, 10, 8, Au[2]).rect(255, y + 1, 10, 1, Au[4]).rect(255, y + 8, 10, 1, Au[1]);
      cv.rect(244, y + 3, 2, 4, Ag[2]).set(244, y + 3, Ag[3]);
      cv.text('+', 268, y + 3, Au[3]);
    }

    // Speaker in the left lobe: a round magnet behind the grille holes, wired to the board.
    const [sx, sy] = [28, 112];
    const spk = cv.mask().circle(sx, sy, 11);
    cv.cast(spk.dilate(1), 1, 1, -1);
    cv.shade(spk, D, { top: [2], left: [2], bottom: [4], right: [4], fill: 3 }); // recessed cup
    cv.shade(cv.mask().circle(sx, sy, 3), Ag, { top: [3], left: [3], bottom: [0], right: [1], fill: 2 });
    cv.outline(INK, spk, { all: true });
    cv.rect(41, 106, 6, 1, WIRE).rect(41, 107, 6, 1, INK); // L-wire into the board
    cv.rect(40, 106, 1, 4, WIRE);

    // Screws in clear bosses.
    const SCREWS = [[36, 14], [252, 14], [40, 155], [246, 155], [72, 156], [214, 156]];
    for (const [x, y] of SCREWS) {
      const b = cv.mask().circle(x, y, 4);
      cv.fill(b, P[4]).fill(b.edge(), P[2]).fill(b.edge().and(b.shift(1, 1).not()), P[5]);
      screw(cv, x - 2, y - 2, [INK, Ag[0], Ag[2], Ag[3]]);
    }

    // ---- the plastic face -------------------------------------------------------------------------
    // Speaker grille: 2x2 holes on a 4px pitch over the magnet.
    for (let j = -2; j <= 2; j++) for (let i = -2; i <= 2; i++) {
      if (i * i + j * j > 5 || (!i && !j)) continue;
      const x = sx - 1 + i * 4, y = sy - 1 + j * 4;
      cv.rect(x, y, 2, 2, INK).set(x + 2, y + 2, Ag[2]);
    }

    // Lens.
    const lens = cv.mask().rrect(54, 14, 180, 116, 6);
    part(cv, lens, S, { top: [5], left: [4], bottom: [1], right: [2], fill: 3, ink: INK });
    inset(cv, ...HOLE, HR, { rim: INK, top: S[1], bottom: S[5], right: S[4] }, 2);
    cv.fill(cv.mask().capsule(56, 50, 88, 16, 0.7).or(cv.mask().capsule(56, 58, 96, 16, 0.5)).and(lens.erode(1)).sub(cv.mask().rect(61, 23, 166, 96)), S[4]); // glare
    // Top strip: a tiny gem glyph flanked by dot runs (no wordmark).
    sprite(cv, 141, 17, ['.###.', '#####', '.###.', '..#..'], { '#': S[6] });
    cv.set(142, 17, '#ffffff');
    for (let i = 0; i < 4; i++) for (const s of [-1, 1]) {
      const x = 144 + s * (7 + i * 4);
      cv.set(x, 19, i === 0 ? K[3] : i === 1 ? P[5] : S[5]);
    }
    cv.rect(66, 122, 3, 3, '#5a1830').set(66, 122, '#ff9ab8'); // power LED (dim base)
    cv.layer('blink').rect(66, 122, 3, 3, '#ff4f8b').set(66, 122, '#ffd0e2');
    sprite(cv, 72, 121, ['..#..', '#.#.#', '#.#.#', '#...#', '.###.'], { '#': S[5] }); // power glyph
    [0, 1, 2].forEach((i) => cv.rect(214 + i * 3, 125 - i, 2, 1 + i, i < 2 ? K[2] : S[4])); // level ticks

    // Dial pad: a round charcoal disk with four outward notches and a thumb dimple, in a clear well.
    const well = cv.mask().circle(dx, dy, 18);
    cv.fill(well, P[4]).fill(well.edge(), P[2]).fill(well.edge().and(well.shift(1, 1).not()), P[5]);
    const disk = cv.mask().circle(dx, dy, 15);
    part(cv, disk, Dp, { top: [5, 4], left: [4], bottom: [0], right: [1], fill: 3, dy: 2 });
    cv.fill(cv.mask().circle(dx, dy, 10).edge(true), (x, y) => (x + y < dx + dy ? Dp[1] : Dp[4]));
    for (const [px, py, rows] of [[-2, -14, ['..#..', '.###.']], [-2, 13, ['.###.', '..#..']],
      [-14, -2, ['.#', '##', '.#']], [13, -2, ['#.', '##', '#.']]]) {
      sprite(cv, dx + px, dy + py, rows, { '#': Dp[1] });
    }
    cv.shade(cv.mask().circle(dx, dy, 4), Dp, { top: [0, 1], left: [1], bottom: [5], right: [4], fill: 2 });
    cv.px([[dx - 10, dy - 6], [dx - 9, dy - 8], [dx - 8, dy - 9], [dx - 6, dy - 10]], Dp[5]);

    // Gem keys in a recessed crescent: faceted stones, the middle one rose, the outer two mint.
    cv.fill(crescent, P[4]).fill(crescent.edge(), P[2]).fill(crescent.edge().and(crescent.shift(1, 1).not()), P[5]);
    for (const [a, Rg] of [[-52, K], [0, Pk], [52, K]]) {
      const [x, y] = arc(a);
      const gem = cv.mask().poly([[x - 3, y - 7], [x + 4, y - 7], [x + 8, y - 3], [x + 8, y + 4], [x + 4, y + 8], [x - 3, y + 8], [x - 7, y + 4], [x - 7, y - 3]]);
      part(cv, gem, Rg, { top: [4], left: [3], bottom: [0], right: [1], fill: 2, dy: 2 });
      const table = cv.mask().poly([[x - 2.5, y - 3], [x + 3.5, y - 3], [x + 3.5, y + 4], [x - 2.5, y + 4]]);
      cv.fill(table, (px, py) => (px - x + py - y < 0 ? Rg[3] : Rg[2]));
      cv.fill(table.ring(), (px, py, cc) => (px < x && py < y + 1 ? Rg[4] : cc)); // lit crown facets
      cv.set(x - 1, y - 2, '#ffffff');
    }

    // Slider switch and a ribbed thumb roller under the lens, each in a recessed clear slot.
    const slotM = (m) => cv.fill(m, P[4]).fill(m.edge(), P[2]).fill(m.edge().and(m.shift(-1, -1).not()), P[5]);
    {
      const track = cv.mask().rrect(110, 134, 30, 9, 4);
      slotM(track.dilate(1));
      cv.fill(track, D[0]).fill(track.and(cv.mask().rect(0, 142, W, 1)), D[2]);
      part(cv, cv.mask().rrect(112, 132, 12, 13, 3), Lv, { top: [4], left: [3], bottom: [0], right: [1], fill: 2, dy: 1 });
      for (const i of [3, 6, 9]) cv.rect(111 + i, 135, 1, 7, Lv[1]).rect(112 + i, 135, 1, 7, Lv[4]);
    }
    {
      const slot = cv.mask().rrect(150, 132, 30, 13, 5);
      slotM(slot);
      const roll = cv.mask().rrect(153, 134, 24, 9, 3);
      cv.fill(roll, (x, y) => {
        const t = Math.abs(x + 0.5 - 165) / 12, i = t > 0.85 ? 0 : t > 0.55 ? 1 : t > 0.25 ? 2 : 3;
        return Lv[y === 134 ? Math.min(4, i + 1) : y === 142 ? Math.max(0, i - 1) : i];
      });
      for (let x = 155; x < 176; x += 3) cv.fill(cv.mask().rect(x, 134, 1, 9).and(roll), (px, py, cc) => cv.step(cc, -1));
      cv.outline(INK, roll, { all: true });
    }

    // Star sticker on the right lobe.
    sticker(cv, 252, 134, SHAPES.star, Pk);
    cv.px([[255, 137], [257, 137], [255, 138], [257, 138]], INK).px([[256, 139]], Pk[0]);
    sparkle(cv, 266, 130, 1, Au[3], '#ffffff');

    // Gloss: soft sheen in the top-left corner and two bright streaks on the plastic only.
    const sheen = cv.mask().poly([[0, 44], [44, 0], [64, 0], [0, 64]]).and(inner).sub(lens).sub(pcb);
    cv.fill(sheen, (x, y, c) => (P.includes(c) && bayer(x, y) < 0.5 ? cv.step(c, 1) : c));
    let bosses = cv.mask();
    for (const [x, y] of SCREWS) bosses = bosses.or(cv.mask().circle(x, y, 5));
    const plastic = body.erode(2).sub(pcb).sub(lens).sub(bosses);
    const diag = (x0, y0, x1, y1) => cv.mask().line(x0, y0, x1, y1);
    cv.fill(diag(8, 50, 40, 18).or(diag(9, 50, 41, 18)).and(plastic), GLOSS);
    cv.fill(diag(10, 58, 48, 20).and(plastic), GLOSS);
    cv.fill(diag(258, 162, 266, 154).and(body.erode(2)), GLOSS);

    // See-through pass: thick plastic edges stay dense, flat faces clear, the board nearly opaque.
    const thick = body.edge().or(body.erode(1).edge()).or(body.erode(2).edge());
    cv.fill(body, (x, y, c) => (P.includes(c) ? alpha(c, body.edge().has(x, y) && c === P[6] ? 1 : thick.has(x, y) ? 0.93 : 0.55) : G.includes(c) ? alpha(c, 0.95) : c));

    cv.outline(INK);
    return cv.punch(...HOLE, HR);
  },
};
