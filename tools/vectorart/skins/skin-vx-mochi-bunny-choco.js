'use strict';
// Choco Bunny skin for the Mochi Bunny: the starch-dusted mochi becomes a milk-chocolate bunny, the
// pastel trims melt to cocoa while the strawberry pinks stay bright, a white-chocolate drizzle runs over
// the crown with rainbow sprinkles, and the starch dust turns to cocoa powder.
const base = require('../frames/vx-mochi-bunny.js');
const { path, g, rng, n } = require('../lib');
const { recolorSvg, hsv, lum, along, chain, exact } = require('../skinlib');

const INK = '#3a2016';
const COCOA = [[0, '#2a140c'], [0.35, '#5a3020'], [0.62, '#8a5434'], [0.82, '#b07a4c'], [1, '#dcae7e']];

const tint = chain(
  exact({ '#5b3550': INK, '#3a1f33': '#24120a', '#ffffff': '#fff4e4' }),
  (c) => { // pastel pinks and pink-tinted whites -> chocolate; saturated strawberry pinks stay
    const [h, s] = hsv(c);
    const pinkish = (h >= 300 || h <= 20) && s < 0.42;
    return pinkish ? along(COCOA, (lum(c) - 0.35) / 0.78) : null;
  },
  (c) => { // the cream / butter yellows -> caramel
    const [h, s] = hsv(c);
    return h > 35 && h < 60 && s > 0.1 && s < 0.45 ? along([[0, '#8a5420'], [1, '#ffd89a']], lum(c)) : null;
  },
);

function drizzle() {
  const r = rng(12), y0 = (x) => 300 + ((x - 700) / 560) ** 2 * 130 + Math.sin(x * 0.02) * 6;
  const drips = Array.from({ length: 14 }, (_, i) => [180 + i * 76 + r() * 30, 10 + r() * 34, 11 + r() * 7]);
  const drip = (x) => drips.reduce((m, [xc, L, w]) => Math.max(m, L * Math.sqrt(Math.max(0, 1 - ((x - xc) / w) ** 2))), 0);
  const top = [], bot = [];
  for (let x = 120; x <= 1280; x += 6) { top.push(`${n(x)} ${n(y0(x) - 12)}`); bot.unshift(`${n(x)} ${n(y0(x) + 10 + drip(x))}`); }
  const d = `M${top.join('L')}L${bot.join('L')}Z`;
  const shine = `M${Array.from({ length: 60 }, (_, i) => 260 + i * 15).map((x) => `${n(x)} ${n(y0(x) - 5)}`).join('L')}`;
  const sprinkles = [];
  const COLORS = ['#ff6aa2', '#7af0b0', '#ffd166', '#8ab0ff', '#ffffff', '#c98cff'];
  for (let i = 0; i < 40; i++) {
    const x = 200 + r() * 1000, y = y0(x) - 6 + (r() - 0.5) * 20, a = r() * 180, c = COLORS[i % COLORS.length];
    sprinkles.push(path(`M${n(x - 8)} ${n(y)}H${n(x + 8)}`, { stroke: INK, strokeWidth: 10, strokeLinecap: 'round', transform: `rotate(${n(a)} ${n(x)} ${n(y)})` })
      + path(`M${n(x - 8)} ${n(y)}H${n(x + 8)}`, { stroke: c, strokeWidth: 6, strokeLinecap: 'round', transform: `rotate(${n(a)} ${n(x)} ${n(y)})` }));
  }
  return g({ clipPath: 'url(#mochiClip)' },
    g({ clipPath: 'url(#chocoTop)' },
      path(d, { fill: INK, fillOpacity: 0.3, transform: 'translate(4 9)' }),
      path(d, { fill: '#fff4e0', stroke: INK, strokeWidth: 5, strokeLinejoin: 'round' }),
      path(shine, { fill: 'none', stroke: '#ffffff', strokeWidth: 5, strokeLinecap: 'round', strokeLinejoin: 'round' }),
      sprinkles.join('')));
}

function draw() {
  const b = base.draw();
  // The drizzle stays on the crown, above the screen bezel.
  const defs = recolorSvg(b.defs, tint) + '<clipPath id="chocoTop"><path d="M0 0H1400V392H0Z"/></clipPath>';
  return { defs, body: recolorSvg(b.body, tint) + '\n' + drizzle() };
}

module.exports = {
  id: 'skin-vx-mochi-bunny-choco', frame: 'vx-mochi-bunny', base, draw, name: 'Choco Bunny', rarity: 'rare',
  desc: 'The mochi bunny dipped in milk chocolate, with a white chocolate drizzle, sprinkles and its strawberry charm.',
  tags: ['bunny', 'chocolate', 'sweets', 'virtual-pet', 'cute'],
};
