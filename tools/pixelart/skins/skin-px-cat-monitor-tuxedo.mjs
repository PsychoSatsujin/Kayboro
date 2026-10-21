// Tuxedo skin for the Kitty Monitor: glossy black plastic and black fur, a white muzzle bib on the chin,
// white socks on the paws and a white tail tip, snowy whiskers, a red bow on the ear and a red bow tie
// on the stand.
import base, { PALETTES } from '../frames/px-cat-monitor.mjs';
import { INK, part, sprite } from '../kit.mjs';
import { withPalette, repunch, remapIn } from '../skinkit.mjs';

const BLACK = ['#0c0a12', '#1a1722', '#282432', '#383344', '#4c475c', '#686380']; // black plastic (replaces cream)
const FUR = ['#08070e', '#14111c', '#221e2c', '#343046', '#4a4562']; // black fur (replaces ginger)
const WHITE = ['#5c5c74', '#8e8ea8', '#c4c4d8', '#e2e2ee', '#f4f4fa', '#ffffff'];
const RED = ['#5a0a1a', '#a3172f', '#e0283f', '#ff6a6a'];

export default {
  id: 'skin-px-cat-monitor-tuxedo', frame: 'px-cat-monitor', name: 'Tuxedo', rarity: 'rare',
  desc: 'The Kitty Monitor dressed for a gala: black fur, white socks and bib, snowy whiskers and a red bow tie.',
  tags: ['cat', 'tuxedo', 'black-cat', 'kawaii', 'monitor', 'animated', 'pixel'],
  css: base.css,
  draw() {
    const cv = withPalette(PALETTES, { Cr: BLACK, Gi: FUR }, () => base.draw());
    cv.use(BLACK, FUR, WHITE, RED);
    // White bib on the chin, white socks, white tail tip.
    const body = cv.mask().rrect(14, 28, 204, 164, 14);
    const bib = cv.mask().oval(80, 178, 72, 26).and(body).sub(cv.mask().rrect(26, 40, 180, 138, 9));
    remapIn(cv, bib, BLACK, WHITE);
    for (const x of [94, 138]) remapIn(cv, cv.mask().oval(x - 9, 210, 19, 14), BLACK, WHITE);
    const tip = cv.mask().circle(244, 143, 7).or(cv.mask().circle(245, 150, 5));
    remapIn(cv, tip, FUR, WHITE.slice(1));
    remapIn(cv, tip, BLACK, WHITE);
    // The bow on the ear turns red.
    remapIn(cv, cv.mask().rect(64, 24, 11, 7), PALETTES.Pk, RED);
    // Snowy whiskers over the ink ones.
    for (const s of [-1, 1]) for (const [y0, y1] of [[150, 144], [155, 155], [160, 166]]) {
      const x0 = s < 0 ? 20 : 211, x1 = s < 0 ? 2 : 229;
      cv.fill(cv.mask().line(x0, y0, x1, y1), '#e8e8f4');
    }
    // Piano-black gloss: a glare streak along the brow and down the left cheek.
    const shine = cv.mask().rect(84, 30, 66, 1).or(cv.mask().rect(80, 31, 3, 1)).or(cv.mask().rect(17, 52, 1, 70)).or(cv.mask().rect(18, 46, 1, 4));
    cv.fill(shine.and(body).sub(cv.mask().rrect(26, 40, 180, 138, 9)), (x, y, c) => (c === BLACK[3] || c === BLACK[4] || c === BLACK[2] ? BLACK[5] : c));
    // A red bow tie on the stand.
    const tie = ['kk.......kk', 'kbkk...kkak', 'kbbbkkkaaak', 'kbbbkcckaak', 'kbbbkkkaaak', 'kbkk...kkak', 'kk.......kk'];
    sprite(cv, 111, 192, tie, { k: INK, a: RED[2], b: RED[1], c: RED[3] });
    cv.set(119, 194, RED[3]).set(112, 194, RED[3]);
    // A tiny gold bell under it.
    part(cv, cv.mask().circle(116, 201, 2), ['#6a3c0e', '#a8701c', '#e0a83a', '#ffd166', '#fff3b0'], { top: [4], left: [3], bottom: [0], right: [1], fill: 2, shadow: false });
    cv.set(116, 202, INK);
    return repunch(cv);
  },
};
