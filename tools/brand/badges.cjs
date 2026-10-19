'use strict';
// Achievement badge art: one consistent 256 x 256 badge (dark rounded plate, coloured rim, cel-shaded motif
// glyph, optional pixel number) for the ten motifs in steam/achievements.json. Pure SVG string functions.
//
//   const { badgeSvg, MOTIFS } = require('./badges.cjs');
//   badgeSvg({ motif: 'level', value: 10, locked: false })   // 256 x 256 SVG string
//
// Motifs: shell, play, level, coin, collection, time, mod, preset, style, legend. Unknown motifs fall back
// to the mark's heart so a new achievement never ships blank. Locked badges are desaturated and darkened
// with an SVG filter and get a small padlock, so both states come from the same drawing.
const { P, rr, circle, poly, star, sparkle, heart, lg, rg, path, g } = require('../vectorart/lib.js');
const { PAL, wordPixels, pixelPaths, wordBox } = require('./art.cjs');

const INK = PAL.ink, SW = 7;
const MOTIFS = ['shell', 'play', 'level', 'coin', 'collection', 'time', 'mod', 'preset', 'style', 'legend'];
const TINT = { shell: PAL.pink, play: PAL.cyan, level: PAL.cyan, coin: PAL.coin, collection: '#c58cff', time: PAL.cyan,
  mod: '#6ee7a8', preset: PAL.pink, style: '#c58cff', legend: PAL.coin };

const o = (d, fill, extra = {}) => path(d, { fill, stroke: INK, strokeWidth: SW, strokeLinejoin: 'round', ...extra });

// Each glyph is drawn around (0, 0) inside roughly +-62 and returns an SVG fragment.
const GLYPH = {
  shell: () => [ // a tiny CRT with rabbit ears, the mark without Kay
    path(`M-18 -42L-40 -70M18 -42L40 -70`, { stroke: INK, strokeWidth: 12, strokeLinecap: 'round' }),
    path(`M-18 -42L-40 -70M18 -42L40 -70`, { stroke: '#b9a8d6', strokeWidth: 5, strokeLinecap: 'round' }),
    o(circle(-42, -72, 11), PAL.cyan), o(circle(42, -72, 11), PAL.coin),
    o(rr(-62, -40, 124, 96, 22), PAL.pink),
    path(rr(-48, -28, 96, 60, 12), { fill: PAL.pinkDeep }),
    path(rr(-44, -24, 88, 52, 10), { fill: PAL.cyan }),
    path(poly([[-44, -2], [-22, -24], [-8, -24], [-44, 12]]), { fill: '#fff', opacity: 0.35 }),
    path(heart(0, 44, 7), { fill: PAL.coin }),
    path(rr(-62, 56, 26, 14, 6), { fill: PAL.pinkDeep, stroke: INK, strokeWidth: 5 }), path(rr(36, 56, 26, 14, 6), { fill: PAL.pinkDeep, stroke: INK, strokeWidth: 5 }),
  ].join(''),
  play: () => [ // play button: cyan disc, pink triangle
    o(circle(0, 0, 62), PAL.cyan),
    path(`M-54 -8A58 58 0 0 1 -10 -56`, { fill: 'none', stroke: '#fff', strokeWidth: 8, strokeLinecap: 'round', opacity: 0.8 }),
    o(poly([[-20, -34], [34, 0], [-20, 34]]), PAL.pink, { strokeLinejoin: 'round' }),
  ].join(''),
  level: () => [ // two chevrons climbing, with a star on top
    o(poly([[-48, 30], [0, -10], [48, 30], [48, 54], [0, 14], [-48, 54]]), PAL.cyanLo),
    o(poly([[-48, -14], [0, -54], [48, -14], [48, 10], [0, -30], [-48, 10]]), PAL.cyan),
    path(sparkle(44, -56, 14), { fill: PAL.coin }),
  ].join(''),
  coin: () => [ // gold coin, K-less so it reads at 32 px
    o(circle(0, 0, 60), PAL.coin),
    path(circle(0, 0, 42), { fill: 'none', stroke: PAL.coinLo, strokeWidth: 8 }),
    path(rr(-7, -26, 14, 52, 5), { fill: PAL.coinLo }),
    path(`M-34 -20A42 42 0 0 1 8 -40`, { fill: 'none', stroke: '#fff3c4', strokeWidth: 9, strokeLinecap: 'round' }),
  ].join(''),
  collection: () => { // four shell tiles in a grid
    const tile = (x, y, c) => o(rr(x, y, 52, 52, 12), c) + path(rr(x + 10, y + 10, 32, 24, 5), { fill: PAL.cyan }) + path(rr(x + 10, y + 38, 32, 6, 3), { fill: PAL.ink, opacity: 0.35 });
    return tile(-60, -60, PAL.pink) + tile(8, -60, '#c58cff') + tile(-60, 8, PAL.coin) + tile(8, 8, '#6ee7a8');
  },
  time: () => [ // clock
    o(circle(0, 0, 60), '#eee9ff'),
    path(circle(0, 0, 48), { fill: 'none', stroke: PAL.cyan, strokeWidth: 6 }),
    ...[0, 90, 180, 270].map((a) => path(`M0 -44V-36`, { stroke: INK, strokeWidth: 6, strokeLinecap: 'round', transform: `rotate(${a})` })),
    path(`M0 0V-30M0 0L20 14`, { fill: 'none', stroke: INK, strokeWidth: 8, strokeLinecap: 'round' }),
    path(circle(0, 0, 6), { fill: PAL.pink }),
  ].join(''),
  mod: () => [ // puzzle piece
    o(`M-50 -30H-14A14 14 0 1 1 14 -30H50V6A14 14 0 1 0 50 34V60H14A14 14 0 1 1 -14 60H-50V34A14 14 0 1 0 -50 6Z`, '#6ee7a8'),
    path(`M-38 -18H-16`, { stroke: '#fff', strokeWidth: 7, strokeLinecap: 'round', opacity: 0.75 }),
  ].join(''),
  preset: () => [ // three sliders on a card
    o(rr(-56, -56, 112, 112, 18), PAL.pink),
    ...[-28, 0, 28].map((y, i) => path(`M-36 ${y}H36`, { stroke: PAL.pinkDeep, strokeWidth: 8, strokeLinecap: 'round' })
      + o(circle([-12, 16, -22][i], y, 11), [PAL.cyan, PAL.coin, '#eee9ff'][i])),
  ].join(''),
  style: () => [ // paint drop over a swatch fan
    o(rr(-60, 8, 120, 46, 14), '#eee9ff'),
    ...[PAL.pink, PAL.cyan, PAL.coin, '#6ee7a8'].map((c, i) => path(rr(-50 + i * 26, 16, 22, 30, 6), { fill: c })),
    o(`M0 -62C-6 -42 -34 -22 -34 2A34 34 0 0 0 34 2C34 -22 6 -42 0 -62Z`, '#c58cff'),
    path(circle(-12, 2, 7), { fill: '#fff', opacity: 0.85 }),
  ].join(''),
  legend: () => [ // crown with three gems
    o(poly([[-60, 44], [-60, -20], [-28, 8], [0, -48], [28, 8], [60, -20], [60, 44]]), PAL.coin),
    path(`M-60 44H60`, { stroke: PAL.coinLo, strokeWidth: 10 }),
    o(circle(0, 26, 10), PAL.pink, { strokeWidth: 5 }), o(circle(-32, 28, 7), PAL.cyan, { strokeWidth: 5 }), o(circle(32, 28, 7), PAL.cyan, { strokeWidth: 5 }),
    path(sparkle(0, -58, 10), { fill: '#fff' }),
  ].join(''),
};

/**
 * Text shown under the glyph, by motif: levels show the level ("10"), time shows hours ("10H"; values of 3600 and
 * up are seconds, as steam/achievements.json stores them), coins show the amount when it is more than one.
 * "First time" motifs and collections (whose value is just an index) show nothing.
 */
function valueLabel(value, motif) {
  if (value == null || value === '' || !Number.isFinite(+value)) return null;
  const v = +value;
  if (motif === 'level' || motif === 'legend') return `${Math.round(v)}`;
  if (motif === 'time') return `${Math.max(1, Math.round(v >= 3600 ? v / 3600 : v))}H`;
  if (motif === 'coin') return v > 1 ? `${Math.round(v)}` : null;
  return null;
}

/** The 256 x 256 badge. */
function badgeSvg({ motif = 'shell', value = null, locked = false } = {}, p = 'b') {
  const tint = TINT[motif] || PAL.pink, glyph = (GLYPH[motif] || (() => path(heart(0, 0, 56), { fill: PAL.pink, stroke: INK, strokeWidth: SW })))();
  const label = valueLabel(value, motif), gy = label ? 108 : 128;
  const defs = [
    lg(`${p}-plate`, [0, 0, 0, 1], [[0, '#2b2540'], [1, '#17141f']]),
    rg(`${p}-glow`, [0.5, 0.42, 0.55], [[0, tint, 0.35], [1, tint, 0]]),
    `<filter id="${p}-lock" color-interpolation-filters="sRGB"><feColorMatrix type="saturate" values="0.08"/><feComponentTransfer><feFuncR type="linear" slope=".42"/><feFuncG type="linear" slope=".42"/><feFuncB type="linear" slope=".5"/></feComponentTransfer></filter>`,
  ].join('');
  let body = [
    path(rr(26, 26, 204, 204, 46), { fill: `url(#${p}-plate)`, stroke: INK, strokeWidth: 8 }),
    path(rr(26, 26, 204, 204, 46), { fill: `url(#${p}-glow)` }),
    path(rr(34, 34, 188, 188, 40), { fill: 'none', stroke: tint, strokeWidth: 5 }),
    path(`M70 40H186`, { stroke: '#fff', strokeWidth: 4, strokeLinecap: 'round', opacity: 0.25 }),
    path(sparkle(52, 56, 9), { fill: '#fff', opacity: 0.8 }), path(sparkle(206, 200, 7), { fill: '#fff', opacity: 0.6 }),
    g({ transform: `translate(128 ${gy}) scale(${label ? 0.72 : 0.9})` }, glyph),
  ].join('');
  if (label) { // pixel number in a coin-coloured pill
    const wp = wordPixels(label, { face: ['#fff8dc', PAL.coin], side: PAL.coinLo }), u = 3, wb = wordBox(wp, u);
    const x = 128 - wb.w / 2, y = 186, px = 10;
    body += path(rr(x - px, y - 6, wb.w + 2 * px, wb.h + 10, 12), { fill: '#0f0d16', stroke: PAL.coinLo, strokeWidth: 3 })
      + `<g shape-rendering="crispEdges">${pixelPaths(wp, u, x, y)}</g>`;
  }
  if (locked) {
    body = `<g filter="url(#${p}-lock)">${body}</g>`
      + path(rr(176, 176, 50, 50, 14), { fill: '#17141f', stroke: '#6f6889', strokeWidth: 4 })
      + path(`M189 201V194A12 12 0 0 1 213 194V201`, { fill: 'none', stroke: '#b8b5c8', strokeWidth: 6, strokeLinecap: 'round' })
      + path(rr(184, 200, 34, 22, 6), { fill: '#b8b5c8' }) + path(circle(201, 210, 3.5), { fill: '#17141f' });
  }
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 256 256" width="256" height="256">\n<defs>${defs}</defs>\n${body}\n</svg>\n`;
}

module.exports = { MOTIFS, TINT, GLYPH, valueLabel, badgeSvg };
