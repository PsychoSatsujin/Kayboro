'use strict';
// Gold Edition skin for the CRT TV starter: the grape-soda plastic is recast in polished gold, the candy
// pinks become rubies, the cyan rim light turns to diamond white, and a little jewelled crown sits on
// the antenna dome with extra gold glints around the set.
const base = require('../starters/crt-tv.js');
const { path, g, lg, star, sparkle, circle, n } = require('../lib');
const { recolorSvg, hueBand, chain, exact } = require('../skinlib');

const GOLD = [[0, '#1a0f04'], [0.12, '#3a2208'], [0.3, '#7a4a10'], [0.5, '#b8801c'], [0.7, '#e8b438'], [0.85, '#f8d870'], [1, '#fff8dc']];
const RUBY = [[0, '#3a0610'], [0.35, '#9a1028'], [0.6, '#e02840'], [0.85, '#ff8090'], [1, '#ffe0e4']];
const DIAMOND = [[0, '#1a2a3a'], [0.5, '#8ab8d8'], [0.8, '#dff4ff'], [1, '#ffffff']];
const INK = '#2a1606';

const tint = chain(
  exact({ '#221245': INK, '#06040c': '#0a0603', '#ffd166': '#fff2b0' }),
  hueBand(258, 40, GOLD, { minSat: 0.05 }), // grape plastic, panel, trims, chrome tints
  hueBand(318, 30, RUBY), // candy pink knobs, badge, sticker, LED
  hueBand(190, 20, DIAMOND), // cyan rim light, ball, meter
);

function crown(cx, y) {
  const d = `M${cx - 44} ${y + 40}L${cx - 50} ${y + 2}L${cx - 24} ${y + 22}L${cx} ${y - 10}L${cx + 24} ${y + 22}L${cx + 50} ${y + 2}L${cx + 44} ${y + 40}Z`;
  return g({},
    path(d, { fill: INK, fillOpacity: 0.35, transform: 'translate(3 6)' }),
    path(d, { fill: 'url(#goldCrown)', stroke: INK, strokeWidth: 5, strokeLinejoin: 'round' }),
    path(`M${cx - 44} ${y + 30}H${cx + 44}`, { stroke: INK, strokeWidth: 4 }),
    path(`M${cx - 38} ${y + 10}L${cx - 30} ${y + 26}M${cx - 4} ${y + 2}L${cx - 2} ${y + 22}`, { stroke: '#fff', strokeOpacity: 0.7, strokeWidth: 4, strokeLinecap: 'round' }),
    path(circle(cx - 50, y + 2, 7) + circle(cx, y - 10, 8) + circle(cx + 50, y + 2, 7), { fill: 'url(#goldPearl)', stroke: INK, strokeWidth: 3.5 }),
    path(circle(cx, y + 35, 7), { fill: '#e02840', stroke: INK, strokeWidth: 3 }),
    path(circle(cx - 26, y + 35, 5) + circle(cx + 26, y + 35, 5), { fill: '#3a6ae8', stroke: INK, strokeWidth: 3 }),
    path(circle(cx - 2, y + 32, 2.2), { fill: '#fff' }));
}

function draw() {
  const b = base.draw();
  const AX = 450, BY = 164;
  const defs = recolorSvg(b.defs, tint)
    + lg('goldCrown', [0, 0, 0, 1], [[0, '#fff2b0'], [0.45, '#f0c040'], [1, '#a86a10']])
    + `<radialGradient id="goldPearl" cx="0.35" cy="0.3" r="0.8"><stop offset="0" stop-color="#ffffff"/><stop offset="0.6" stop-color="#f4eadc"/><stop offset="1" stop-color="#c8b48c"/></radialGradient>`;
  const glints = [[60, 300, 14], [1000, 280, 12], [990, 880, 16], [40, 760, 10], [700, 40, 12], [300, 60, 9]]
    .map(([x, y, s], i) => path(i % 2 ? star(x, y, s, s * 0.45) : sparkle(x, y, s), { fill: '#ffe27a', stroke: INK, strokeWidth: 2.5, strokeLinejoin: 'round' })).join('');
  const body = recolorSvg(b.body, tint) + '\n' + crown(AX, BY - 74) + glints
    + path(circle(n(AX + 70), BY - 70, 3) + circle(160, 120, 3.5) + circle(900, 220, 3), { fill: '#fff8dc' });
  return { defs, body };
}

module.exports = {
  id: 'skin-crt-tv-gold', frame: 'crt-tv', base, draw, name: 'Gold Edition', rarity: 'epic',
  desc: 'The starter CRT recast in polished gold, with ruby knobs, diamond highlights and a little crown on the antenna.',
  tags: ['gold', 'luxury', 'tv', 'crt', 'retro', 'starter'],
};
