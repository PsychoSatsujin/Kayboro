// Haunted skin for the Dungeon Window: cold moonlit stone, spectral green torch flames washing the walls
// in ghost-light, runes burning violet, faded purple banners and tarnished brass, a violet slime and
// glowing cyan toadstools, cobwebs in the arch corners, bats, and a friendly ghost bobbing by the arch.
import base, { PALETTES } from '../frames/px-dungeon.mjs';
import { INK, sprite, sparkle } from '../kit.mjs';
import { withPalette, repunch, recolor } from '../skinkit.mjs';

const STONE = ['#121620', '#1e2432', '#2c3446', '#3e4860', '#56627c', '#76829c', '#a2acc4'];
const GHOSTLIT = ['#142a28', '#1e3c38', '#2a564a', '#3a725c', '#4e9270', '#6eb88a', '#a8e4b0'];
const FLAME = { 1: '#16805a', 2: '#2fd08a', 3: '#6af0b0', 4: '#b8ffd8', 5: '#f0fff8' };
const MOSS = ['#18261f', '#243a2c', '#355238', '#4e6e44', '#728c58'];
const CLOTH = ['#1a0a24', '#2e1440', '#46205e', '#62327a', '#8a4e9c'];
const BRASS = ['#3a2a14', '#5e4620', '#86682e', '#aa8c44', '#d0b46a'];
const RUNE = ['#4a2a8a', '#a060ff', '#e8d4ff'];
const WEB = '#9aa2b8', WEB2 = '#c8cede';

const GHOST = [
  '.....kkkkk.....', '...kkwwwwwkk...', '..kwwwwwwwwwk..', '.kwwwwwwwwwwwk.', '.kwwkkwwwkkwwk.', 'kwwwkkwwwkkwwwk', 'kwwwkewwwkewwwk',
  'kwppwwwwwwwppwk', 'kwwwwwkkkwwwwwk', 'kwwwwwkmkwwwwwk', 'kwwwwwwkwwwwwsk', 'kwwwwwwwwwwwwsk', 'kswwwwwwwwwwssk', 'kswwwwwwwwwwssk',
];
const TAILS = [['kswwk.kwwk.kwsk', '.kkk...kk...kk.'], ['kswk.kwwk.kwwsk', '.kk...kk...kkk.']];
const BAT = ['k.........k', 'kk.k...k.kk', 'kbbkk.kkbbk', '.kbbkkkbbk.', '..kkbebkk..', '....kkk....'];

/** Radial cobweb in a corner: spokes from (x, y) into the quadrant (dx, dy), joined by sagging threads. */
function cobweb(cv, x, y, dx, dy, r) {
  const m = cv.mask(), angles = [0, 0.25, 0.5, 0.75, 1].map((t) => t * Math.PI / 2);
  for (const a of angles) m.line(x, y, Math.round(x + dx * Math.cos(a) * r), Math.round(y + dy * Math.sin(a) * r));
  for (const k of [0.35, 0.6, 0.85]) {
    for (let i = 0; i + 1 < angles.length; i++) {
      const p = (a, s = 1) => [Math.round(x + dx * Math.cos(a) * r * k * s), Math.round(y + dy * Math.sin(a) * r * k * s)];
      const [x0, y0] = p(angles[i]), [x1, y1] = p(angles[i + 1]), [mx, my] = p((angles[i] + angles[i + 1]) / 2, 0.86);
      m.line(x0, y0, mx, my).line(mx, my, x1, y1);
    }
  }
  const free = m.and(cv.opaque().not());
  cv.fill(free, (px, py) => ((px + py) % 3 ? WEB : WEB2));
  return free;
}

export default {
  id: 'skin-px-dungeon-haunted', frame: 'px-dungeon', name: 'Haunted', rarity: 'epic',
  desc: 'The dungeon window after midnight: ghost-green torches, glowing runes, cobwebs, bats and a friendly ghost.',
  tags: ['haunted', 'halloween', 'ghost', 'dungeon', 'fantasy', 'animated', 'widescreen', 'pixel'],
  css: base.css + '.gha{animation:gh 1.4s steps(1) infinite}.ghb{animation:gh 1.4s steps(1) -.7s infinite}@keyframes gh{50%{opacity:0}}',
  draw() {
    const cv = withPalette(PALETTES, { S: STONE, SW: GHOSTLIT, FL: FLAME, Mo: MOSS, Cl: CLOTH, Gd: BRASS, RUNE }, () => base.draw());
    cv.use(STONE, GHOSTLIT, MOSS, CLOTH, BRASS);
    // The slime turns violet, the toadstools glow cyan, the gem on the sill burns green.
    recolor(cv, {
      '#5fd06a': '#a070e0', '#c4ffb0': '#ecdcff', '#2a6a3a': '#43207e', '#3a9a4c': '#6a44b8',
      '#e0283f': '#2ab8b8', '#ffe9e0': '#d8fff8', '#efe2c8': '#b8c8d0',
      '#e8fdff': '#e8fff0', '#7af0ff': '#6af0b0', '#1b6f9a': '#16805a',
    });

    // Cobwebs where the arch meets the sky.
    cobweb(cv, 20, 34, 1, -1, 22);
    cobweb(cv, 283, 34, -1, -1, 22);
    // Bats over the arch.
    sprite(cv, 30, 4, BAT, { k: INK, b: '#6a5a8e', e: '#ff4a6a' });
    sprite(cv, 52, 14, BAT.map((r) => r), { k: INK, b: '#6a5a8e', e: '#ff4a6a' });
    sprite(cv, 252, 8, BAT, { k: INK, b: '#6a5a8e', e: '#ff4a6a' });
    // A friendly ghost bobbing beside the arch: two frames a pixel apart, swapping.
    const a = cv.layer('gha'), b = cv.layer('ghb');
    [[a, 0], [b, 1]].forEach(([l, k]) => {
      const y = 44 + k * 2, x = 272;
      sprite(l, x, y, [...GHOST, ...TAILS[k]], { k: INK, w: '#eef0ff', s: '#b8c0e0', e: '#ffffff', p: '#ffb0c8', m: '#ff7090' });
    });
    sparkle(cv, 266, 40, 1, '#b8ffd8', '#ffffff');
    sparkle(cv, 290, 72, 1, '#b8ffd8', '#ffffff');
    return repunch(cv);
  },
};
