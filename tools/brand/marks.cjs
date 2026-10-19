'use strict';
// Hand-tuned pixel versions of the Kayboro mark (Kay peeking out of a pink CRT) for 16, 24 and 32 px, where the
// vector mark turns to mush. One character per pixel; edit the grids directly, then re-run tools/brand/build.cjs.
// gridSvg() emits run-merged rects with shape-rendering="crispEdges" (same output style as tools/pixelart).

const KEY = {
  o: '#2a0b22', // ink
  P: '#ff6ad5', h: '#ffa6ea', p: '#d9459f', q: '#9e2b80', // shell pink: base, light, shade, deep
  C: '#7af0ff', H: '#c9fbff', c: '#3fc0e6', // screen: base, top, bottom
  w: '#ffffff', Y: '#ffd166', y: '#e0962f', a: '#b9a8d6', // glint, coin bulb, antenna rod
  K: '#fff3fa', k: '#e2c6f0', b: '#ff8fcf', // Kay: fur, shade, blush
};

const GRIDS = {
  16: [
    '.w............Y.',
    '.Cq..........qy.',
    '...q........q...',
    '.oooooooooooooo.',
    'ohhPPPPPPPPPPPPo',
    'ohqqqqqqqqqqqqpo',
    'ohqHHHHHHHHHHqpo',
    'oPqCKCCCCCCKCqpo',
    'oPqCKKKKKKKKCqpo',
    'oPqCKKoKKoKKCqpo',
    'oPqcKbKooKbkcqpo',
    'oPqqKKqqqqKKqqpo',
    'oPPPPPPYPPPPPPpo',
    '.oppppppppppppo.',
    '..oooooooooooo..',
    '..qq........qq..',
  ],
  24: [
    '..oo................oo..',
    '.owCo..............owYo.',
    '.occo..............oYyo.',
    '..ooa..............aoo..',
    '.....a............a.....',
    '......a..oooooo..a......',
    '.......aopPPPPpoa.......',
    '.oooooooooooooooooooooo.',
    'ohhhhhPPPPPPPPPPPPPPPPPo',
    'ohPooooooooooooooooooPpo',
    'ohPoqqqqqqqqqqqqqqqqoPpo',
    'oPPoqHwooHHHHHHooHHqoPpo',
    'oPPoqCobKooooooKboCqoPpo',
    'oPPoqCoKKKKKKKKKkoCqoPpo',
    'oPPoqCoKoKKKKKKokoCqoPpo',
    'oPPoqcoKoKKKKKKokocqoPpo',
    'oPPoqcobKKoKKoKKbocqoPpo',
    'oPPoqcoKKKKooKKKkocqoPpo',
    'oPPoqcoKKKKKKKKKkocqoPpo',
    'oPPoqqoKKoqqqqoKkoqqoPpo',
    'oPPPoooKKooooooKkoooPPpo',
    'oPPPPPPooPPYYPPooPPPPPpo',
    '.oooooooooooooooooooooo.',
    '...oqqo..........oqqo...',
  ],
  32: [
    '................................',
    '....ooo..................ooo....',
    '...owCCo................owYYo...',
    '...oCCCo................oYYYo...',
    '...occco................oyyyo...',
    '....oooa................aooo....',
    '........a..............a........',
    '.........a............a.........',
    '..........a..oooooo..a..........',
    '...........aopPPPPpoa...........',
    '...oooooooooooooooooooooooooo...',
    '..ohhhhhhhPPPPPPPPPPPPPPPPPPPo..',
    '.ohhhPPPPPPPPPPPPPPPPPPPPPPPPpo.',
    '.ohhPooooooooooooooooooooooPPpo.',
    '.ohPoqqqqqqqqqqqqqqqqqqqqqqoPpo.',
    '.ohPoqHwHHHHHHHHHHHHHHHHHHqoPpo.',
    '.oPPoqCCCCoooCCCCCCoooCCCCqoPpo.',
    '.oPPoqCCCoKbKooooooKbkoCCCqoPpo.',
    '.oPPoqCCCoKKKKKKKKKKKkoCCCqoPpo.',
    '.oPPoqCCCoKKKKKKKKKKKkoCCCqoPpo.',
    '.oPPoqCCCoKKKoKKKKoKKkoCCCqoPpo.',
    '.oPPoqcCCoKKKoKKKKoKKkoCCcqoPpo.',
    '.oPPoqcCCoKbbKoKKoKbbkoCCcqoPpo.',
    '.oPPoqcCCoKKKKKooKKKKkoCCcqoPpo.',
    '.oPPoqcCCoKKKKKKKKKKKkoCCcqoPpo.',
    '.oPPoqqqqoKKKoqqqqoKKkoqqqqoPpo.',
    '.oPPPoooooKKKooooooKKkoooooPPpo.',
    '.oPPPPPPPPoooPPYYPPoooPPPPPPPpo.',
    '..oppppppppppppppppppppppppppo..',
    '...oooooooooooooooooooooooooo...',
    '....oqqqqo............oqqqqo....',
    '.....oooo..............oooo.....',
  ],
};

/** Parse a grid into { w, h, px: [[x, y, color]] }; throws on ragged rows or unknown keys. */
function parse(rows, key = KEY) {
  const h = rows.length, w = rows[0].length, px = [];
  rows.forEach((r, y) => {
    if (r.length !== w) throw new Error(`row ${y} is ${r.length} wide, expected ${w}`);
    [...r].forEach((ch, x) => {
      if (ch === '.') return;
      if (!key[ch]) throw new Error(`unknown pixel "${ch}" at ${x},${y}`);
      px.push([x, y, key[ch]]);
    });
  });
  return { w, h, px };
}

/** Run-merged path data per colour: { '#rrggbb': 'M0 0h2v1h-2z...' } (horizontal runs, then grown down). */
function runs({ w, h, px }) {
  const grid = Array.from({ length: h }, () => new Array(w).fill(null)), used = grid.map((r) => r.map(() => false)), out = {};
  for (const [x, y, c] of px) grid[y][x] = c;
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
    const c = grid[y][x];
    if (!c || used[y][x]) continue;
    let x1 = x;
    while (x1 < w && grid[y][x1] === c && !used[y][x1]) x1++;
    let y1 = y + 1;
    grow: for (; y1 < h; y1++) for (let k = x; k < x1; k++) if (grid[y1][k] !== c || used[y1][k]) break grow;
    for (let j = y; j < y1; j++) for (let k = x; k < x1; k++) used[j][k] = true;
    (out[c] = out[c] || []).push(`M${x} ${y}h${x1 - x}v${y1 - y}h-${x1 - x}z`);
  }
  return Object.fromEntries(Object.entries(out).sort(([a], [b]) => a.localeCompare(b)).map(([c, d]) => [c, d.join('')]));
}

const pathsOf = (g) => Object.entries(runs(g)).map(([c, d]) => `<path fill="${c}" d="${d}"/>`).join('');

/** Stand-alone SVG of a pixel grid (size n), drawn at `scale` css px per pixel. */
function gridSvg(n, scale = 1) {
  const g = parse(GRIDS[n]);
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${g.w} ${g.h}" width="${g.w * scale}" height="${g.h * scale}" shape-rendering="crispEdges">${pathsOf(g)}</svg>\n`;
}

/** Just the <path>s of a grid, for the inline <symbol id="i-logo*"> sprites in src/renderer/index.html. */
const spritePaths = (n) => pathsOf(parse(GRIDS[n]));

/** The <symbol id="i-logo"> for the inline sprite in src/renderer/index.html (16 x 16). */
const spriteSymbol = () => `<symbol id="i-logo" viewBox="0 0 16 16" shape-rendering="crispEdges">${spritePaths(16)}</symbol>`;

module.exports = { KEY, GRIDS, parse, runs, gridSvg, spritePaths, spriteSymbol };
