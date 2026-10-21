'use strict';
// Calico Night skin for the Neko TV: the calico fur goes moonlit lavender with deep amber and ink-black
// patches, the ribbon turns midnight blue, and the cat dozes under a big crescent moon and stars, with
// a few sleepy Z's drifting off its ear.
const base = require('../frames/vx-neko-tv.js');
const { path, g, lg, rg, circle, star, sparkle } = require('../lib');
const { recolorSvg, exact } = require('../skinlib');

const INK = '#45304a';
const tint = exact({
  '#fffaf2': '#e8eafa', '#fbeedd': '#d0d4ee', '#efd9c1': '#aab0d6', // fur
  '#c9a88a': '#8c90bc', '#9b6f52': '#565a8c', // fur shade
  '#ffb867': '#e8933e', '#f08a2e': '#b45c1c', '#c9661a': '#7a3a14', // amber patches + tail stripes
  '#7a5240': '#3a3248', '#4a2f25': '#1c1626', // black patches
  '#ff7fb6': '#8494ff', '#e2477f': '#3a46c4', '#ff6aa2': '#5a6aee', // midnight ribbon, knot, fish knob
  '#ffd3e5': '#d8dcff', '#bdf0ff': '#fff2b0', // knobs
  '#ff8fc7': '#b8c4ff', '#7af0ff': '#fff2b0', // background sparkle and heart
  '#c9f1ff': '#e8dcff', '#7fd3f2': '#a690f0', '#3e9cc6': '#5a44b0', '#2f86ad': '#3e2e90', // glow-in-the-dark yarn
});

const zee = (x, y, s) => `M${x} ${y}H${x + s}L${x} ${y + s}H${x + s}`;

function draw() {
  const b = base.draw();
  const defs = recolorSvg(b.defs, tint)
    + rg('nightMoon', [0.35, 0.3, 0.8], [[0, '#fffbe0'], [0.6, '#ffe48a'], [1, '#e0a83a']])
    + rg('nightMoonGlow', [0.5, 0.5, 0.5], [[0, '#ffe48a', 0.35], [1, '#ffe48a', 0]])
    + lg('nightZ', [0, 0, 1, 1], [[0, '#ffffff'], [1, '#c8d0ff']]);
  const moon = `M150 70A92 92 0 1 0 210 240A74 74 0 1 1 150 70Z`;
  const stars = [[60, 380, 12], [230, 40, 10], [40, 860, 9], [1360, 620, 11], [1220, 1180, 8], [620, 60, 9], [960, 90, 7]]
    .map(([x, y, s], i) => path(i % 2 ? star(x, y, s, s * 0.45) : sparkle(x, y, s * 1.4), { fill: '#fff2b0', stroke: INK, strokeWidth: 3, strokeLinejoin: 'round' })).join('');
  const zs = [[1236, 128, 26], [1282, 74, 34], [1334, 30, 24]]
    .map(([x, y, s]) => path(zee(x, y, s), { fill: 'none', stroke: INK, strokeWidth: 15, strokeLinejoin: 'round', strokeLinecap: 'round' })
      + path(zee(x, y, s), { fill: 'none', stroke: 'url(#nightZ)', strokeWidth: 7, strokeLinejoin: 'round', strokeLinecap: 'round' })).join('');
  const sky = g({},
    path(circle(130, 160, 120), { fill: 'url(#nightMoonGlow)' }),
    path(moon, { fill: 'url(#nightMoon)', stroke: INK, strokeWidth: 7, strokeLinejoin: 'round' }),
    path(circle(96, 170, 9) + circle(128, 218, 6) + circle(84, 124, 5), { fill: '#e0a83a', fillOpacity: 0.55 }),
    path('M118 96Q84 120 82 170', { fill: 'none', stroke: '#fff', strokeOpacity: 0.8, strokeWidth: 7, strokeLinecap: 'round' }),
    stars, zs);
  return { defs, body: sky + '\n' + recolorSvg(b.body, tint) };
}

module.exports = {
  id: 'skin-vx-neko-tv-calico-night', frame: 'vx-neko-tv', base, draw, name: 'Calico Night', rarity: 'rare',
  desc: 'The Neko TV dozing under a crescent moon in moonlit calico fur, with a midnight ribbon and glowing yarn.',
  tags: ['cat', 'night', 'moon', 'stars', 'kawaii', 'tv'],
};
