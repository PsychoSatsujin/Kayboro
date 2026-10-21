// Autumn skin for Mossy Hollow: the canopy turns to patches of amber, scarlet and gold, the ivy blushes
// red, the moss dries to straw, pumpkins sit among the roots, leaves pile up on the mossy base and the
// fireflies give way to leaves tumbling down past the screen.
import base, { PALETTES } from '../frames/px-forest.mjs';
import { INK, part, sprite } from '../kit.mjs';
import { ramp, rng } from '../pixel.mjs';
import { withPalette, repunch, recolor, clearLayer, noise1 } from '../skinkit.mjs';

const AMBER = ramp('#d8742a', 7, { step: 0.11, hue: 6, sat: 0.05 }); // the canopy (replaces the green leaves)
const SCARLET = ramp('#c83a2e', 7, { step: 0.11, hue: 6, sat: 0.05 });
const GOLDEN = ramp('#e0a830', 7, { step: 0.11, hue: 6, sat: 0.05 });
const STRAW = ramp('#a88a3a', 5, { step: 0.12, hue: 6, sat: 0.05 }); // dried moss / grass
const PUMP = ramp('#e8822a', 5, { step: 0.13, hue: 6, sat: 0.05 });
const STEM = ['#3a2a14', '#5e4a20', '#86742e'];
const LEAF = [{ a: '#ffd08a', b: '#e8822a', c: '#9a3a16' }, { a: '#ffe08a', b: '#f2b23a', c: '#c27a1c' }, { a: '#ff9a7a', b: '#d8402e', c: '#7a1a1a' }];
const LEAVES = [['..ab.', '.abbc', 'abbc.', '.c...'], ['.aa..', 'abbb.', '.bbbc', '...cc'], ['..a..', 'a.b.a', 'abbbb', '.bbb.', '..c..'], ['a....', '.abb.', '.bbbc', '..bc.']];

function pumpkin(cv, x, y, w, h) { // x, y = top-left of the body
  const body = cv.mask().oval(x, y, w, h);
  part(cv, body, PUMP, { top: [4], left: [3], bottom: [0], right: [1], fill: 2, dy: 1 });
  for (const k of [0.3, 0.5, 0.7]) { // ribs
    const rx = Math.round(x + w * k);
    cv.fill(cv.mask().oval(rx - 1, y + 1, 2, h - 2).and(body.erode(1)), PUMP[1]);
    cv.fill(cv.mask().rect(rx + 1, y + 2, 1, h - 5).and(body.erode(1)), PUMP[3]);
  }
  const st = cv.mask().rect(x + (w >> 1) - 1, y - 3, 2, 4).or(cv.mask().rect(x + (w >> 1) + 1, y - 4, 2, 1));
  cv.outline(INK, st, { all: false });
  cv.fill(st, STEM[1]).set(x + (w >> 1) - 1, y - 3, STEM[2]);
  cv.set(x + 2, y + 2, PUMP[4]).set(x + 3, y + 1, PUMP[4]);
  return body;
}

export default {
  id: 'skin-px-forest-autumn', frame: 'px-forest', name: 'Autumn', rarity: 'rare',
  desc: 'The old hollow tree in full autumn blaze, with pumpkins in the roots and leaves tumbling past your game.',
  tags: ['autumn', 'fall', 'forest', 'pumpkin', 'leaves', 'cozy', 'animated', 'pixel'],
  css: base.css,
  draw() {
    const cv = withPalette(PALETTES, { Lf: AMBER, Ms: STRAW }, () => base.draw());
    cv.use(AMBER, SCARLET, GOLDEN, STRAW, PUMP);
    // Patches of the canopy (and the ivy, the ferns) turn scarlet or gold instead of amber.
    const n = noise1(21), m = noise1(5);
    const idx = new Map(AMBER.map((c, i) => [c, i]));
    recolor(cv, (c, x, y) => {
      if (!idx.has(c)) return c;
      const v = n(x * 0.07 + y * 0.05) * 0.7 + m(x * 0.21 - y * 0.13) * 0.3;
      return v < 0.36 ? SCARLET[idx.get(c)] : v > 0.62 ? GOLDEN[idx.get(c)] : c;
    });

    // The fireflies give way to leaves drifting down (two frames swapping, plus a twinkling set).
    for (const l of ['ffa', 'ffb', 'ffc']) clearLayer(cv, l);
    const la = cv.layers.find((l) => l.cls === 'ffa').cv, lb = cv.layers.find((l) => l.cls === 'ffb').cv, lc = cv.layers.find((l) => l.cls === 'ffc').cv;
    [[14, 112], [32, 168], [236, 146], [244, 74], [198, 192], [54, 192], [10, 52], [248, 196]].forEach(([x, y], i) => {
      const rows = LEAVES[i % LEAVES.length], pal = LEAF[i % LEAF.length];
      if (i < 6) { sprite(la, x, y, rows, pal); sprite(lb, x + (i % 2 ? 2 : -2), y + 3, LEAVES[(i + 1) % LEAVES.length], pal, { flip: true }); }
      else sprite(lc, x, y, rows, pal);
    });

    // Pumpkins among the roots, and leaves heaped on the mossy base.
    const r = rng(17);
    pumpkin(cv, 26, 224, 22, 14);
    pumpkin(cv, 48, 230, 12, 9);
    pumpkin(cv, 216, 222, 16, 11);
    for (let i = 0; i < 34; i++) {
      const x = 6 + Math.floor(r() * 244), y = 220 + Math.floor(r() * 22);
      if (Math.abs(x - 128) < 12 && y < 230) continue; // keep the little door clear
      if (!cv.get(x, y) || !cv.get(x + 2, y + 2)) continue;
      sprite(cv, x, y, LEAVES[i % LEAVES.length], LEAF[Math.floor(r() * LEAF.length)], { flip: r() < 0.5 });
    }
    // A few leaves caught on the hollow's lip.
    for (const [x, y, k] of [[58, 60, 0], [142, 58, 2], [176, 62, 1], [96, 58, 3]]) sprite(cv, x, y, LEAVES[k], LEAF[k % 3]);
    return repunch(cv);
  },
};
