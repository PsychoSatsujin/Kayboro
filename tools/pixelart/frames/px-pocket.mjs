// Portrait handheld in see-through grape plastic: slate glass lens, d-pad, berry A/B, speaker slots.
import { Canvas, alpha } from '../pixel.mjs';
import { INK, SHAPES, inset, part, sprite, sticker } from '../kit.mjs';

const W = 176, H = 288, HOLE = [28, 34, 120, 108]; // 10:9
const P = ['#2a1850', '#45297f', '#6243ad', '#7f5fcb', '#9d7fe0', '#c0a8f2', '#e9ddff']; // grape clear plastic
const S = ['#13101c', '#221d2e', '#322b42', '#433b57', '#574e6e', '#7a7192', '#a39cba']; // slate lens
const D = ['#0f0c16', '#1d1828', '#2b2439', '#3d3550', '#564c6c']; // charcoal rubber
const M = ['#56103a', '#8f1d56', '#c93478', '#ee5c9a', '#ff95c0', '#ffd6e8']; // berry buttons
const Y = ['#a8561c', '#e08a1e', '#ffc23d', '#ffe27a', '#fff6c4']; // sticker gold

const recess = (cv, m) => cv.shade(m, P, { top: [1], left: [1], bottom: [5], right: [4], fill: 2 });

export default {
  id: 'px-pocket', name: 'Pixel Pocket', theme: 'handheld', rarity: 'common', translucent: true,
  tags: ['handheld', 'portrait', 'retro', 'clear-plastic', 'pixel'],
  draw() {
    const cv = new Canvas(W, H);
    cv.use(P, S, D, M, Y);
    const body = cv.mask().rrect(1, 1, W - 2, H - 2, [7, 7, 30, 9]);
    cv.shade(body, P, { top: [6, 5], left: [5], bottom: [1, 2], right: [2], fill: 3 });

    // Top seam with the power-switch legend.
    cv.rect(3, 12, W - 6, 1, P[1]).rect(3, 13, W - 6, 1, P[5]);
    cv.text('<OFF', 14, 4, P[1]).text('ON>', 33, 4, P[1]);

    // Glass lens with a two-step recess around the screen.
    const lens = cv.mask().rrect(12, 20, W - 24, 140, [5, 5, 20, 5]);
    part(cv, lens, S, { top: [5], left: [4], bottom: [1], right: [2], fill: 3, shadow: -1, ink: P[0] });
    cv.fill(cv.mask().capsule(13, 50, 43, 20, 0.7).or(cv.mask().capsule(13, 57, 50, 20, 0.5)).and(lens.erode(1)), S[4]); // glare
    inset(cv, ...HOLE, 0, { rim: INK, top: S[1], bottom: S[5], right: S[4] }, 2);
    const tw = cv.textWidth('PIXEL MATRIX');
    cv.text('PIXEL MATRIX', 88 - (tw >> 1), 24, S[6]);
    for (const [x0, x1] of [[18, 88 - (tw >> 1) - 4], [88 + (tw >> 1) + 4, W - 18]]) cv.rect(x0, 25, x1 - x0, 1, '#ff6ad5').rect(x0, 27, x1 - x0, 1, '#7af0ff');
    sprite(cv, 16, 58, ['.ab.', 'abbc', 'bbcc', '.cc.'], { a: '#ffd0e2', b: '#ff4f8b', c: '#b0195a' }); // battery LED
    cv.text('BAT', 13, 65, S[5]);

    // Logo, embossed.
    const logo = cv.textMask('SHELLCADE', 14, 168, { font: 5 });
    const sub = cv.textMask('POCKET', 72, 168, { font: 5, italic: 2 });
    cv.fill(logo.shift(1, 1).sub(logo), P[5]).fill(logo, P[0]);
    cv.fill(sub, M[2]);

    // D-pad in its well.
    const [dx, dy] = [42, 214];
    recess(cv, cv.mask().circle(dx, dy, 21));
    const cross = cv.mask().rect(dx - 5, dy - 16, 11, 33).rect(dx - 16, dy - 5, 33, 11);
    part(cv, cross, D, { top: [4], left: [3], bottom: [0], right: [1], fill: 2, dy: 2 });
    cv.px([[dx, dy - 13], [dx - 1, dy - 12], [dx, dy - 12], [dx + 1, dy - 12], [dx - 1, dy + 12], [dx, dy + 12], [dx + 1, dy + 12], [dx, dy + 13],
      [dx - 13, dy], [dx - 12, dy - 1], [dx - 12, dy], [dx - 12, dy + 1], [dx + 12, dy - 1], [dx + 12, dy], [dx + 12, dy + 1], [dx + 13, dy]], D[1]);
    sprite(cv, dx - 2, dy - 2, ['.aa.', 'abbc', 'abbc', '.cc.'], { a: D[1], b: D[2], c: D[3] });

    // A / B on a slanted pad.
    const B = [114, 226], A = [146, 210];
    recess(cv, cv.mask().capsule(...B, ...A, 14));
    for (const [x, y, l] of [[...B, 'B'], [...A, 'A']]) {
      part(cv, cv.mask().circle(x, y, 9), M, { top: [4], left: [3], bottom: [0], right: [1], fill: 2, dy: 2 });
      cv.px([[x - 5, y - 4], [x - 4, y - 5], [x - 3, y - 6], [x - 4, y - 4]], M[5]);
      cv.text(l, x - 1, y + 16, P[1]);
    }

    // Select / Start pills.
    for (const [x, l] of [[64, 'SELECT'], [92, 'START']]) {
      recess(cv, cv.mask().capsule(x, 256, x + 10, 252, 4.5));
      part(cv, cv.mask().capsule(x, 256, x + 10, 252, 2.5), S, { top: [5], left: [4], bottom: [1], right: [2], fill: 3 });
      cv.text(l, x + 5 - (cv.textWidth(l) >> 1), 264, P[1]);
    }

    // Speaker slots.
    for (let i = 0; i < 6; i++) {
      const s = cv.mask().capsule(118 + i * 7, 274, 127 + i * 7, 248, 1.6);
      cv.fill(s, D[1]).fill(s.sub(s.shift(-1, 0)), D[3]).fill(s.shift(1, 1).sub(s).and(body), P[5]);
    }

    // Star sticker with a face.
    sticker(cv, 146, 164, SHAPES.star, Y);
    cv.px([[149, 167], [151, 167], [149, 168], [151, 168]], '#3a1d10').px([[150, 169]], M[2]);

    // See-through pass: thick edges stay denser than the flat faces.
    const thick = body.edge().or(body.erode(1).edge());
    cv.fill(body, (x, y, c) => (P.includes(c) ? alpha(c, thick.has(x, y) ? 0.92 : 0.76) : c));

    cv.outline(INK);
    return cv.punch(...HOLE);
  },
};
