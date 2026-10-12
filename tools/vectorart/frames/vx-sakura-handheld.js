'use strict';
// Pastel clear-pink handheld (translucent shell shows the equipped fill), pearl screen plate, candy
// ABXY buttons with tiny glyphs, a blooming cherry branch and a sakura charm on a strap.
const L = require('../lib');
const { rr, path, g, lg, rg, circle, ellipse, sparkle, star, heart, petal, blossom, tf, rng, lip, n } = L;

const W = 1600, H = 1000, hole = { x: 380, y: 130, w: 840, h: 560 }, radius = 12;
const SHELL = 'M300 60H1300C1470 60 1560 250 1560 470C1560 710 1480 900 1320 900H280C120 900 40 710 40 470C40 250 130 60 300 60Z';
const INK = '#b2477a';

function dpad(cx, cy) {
  const a = 36, l = 104;
  const d = `M${cx - a} ${cy - l}H${cx + a}V${cy - a}H${cx + l}V${cy + a}H${cx + a}V${cy + l}H${cx - a}V${cy + a}H${cx - l}V${cy - a}H${cx - a}Z`;
  const arrow = (dx, dy) => path(L.poly([[cx + dx * 78, cy + dy * 78], [cx + dx * 62 - dy * 12, cy + dy * 62 - dx * 12], [cx + dx * 62 + dy * 12, cy + dy * 62 + dx * 12]]), { fill: '#e7a6c4' });
  return path(circle(cx, cy, 142), { fill: '#d4588f', fillOpacity: 0.28 })
    + path(circle(cx, cy, 142), { fill: 'none', stroke: '#fff', strokeOpacity: 0.55, strokeWidth: 3 })
    + path(d, { fill: '#7d2a55', fillOpacity: 0.35, transform: 'translate(4 10)' })
    + path(d, { fill: 'url(#pearl)', stroke: INK, strokeWidth: 5, strokeLinejoin: 'round' })
    + arrow(0, -1) + arrow(0, 1) + arrow(-1, 0) + arrow(1, 0)
    + path(circle(cx, cy, 22), { fill: '#f3d3e2' })
    + path(`M${cx - a + 8} ${cy - l + 12}H${cx + a - 8}`, { stroke: '#fff', strokeWidth: 6, strokeLinecap: 'round' });
}

function button(cx, cy, col, glyph) {
  return path(circle(cx + 3, cy + 9, 44), { fill: '#7d2a55', fillOpacity: 0.35 })
    + path(circle(cx, cy, 44), { fill: `url(#btn-${col})`, stroke: INK, strokeWidth: 5 })
    + path(ellipse(cx - 12, cy - 18, 20, 10), { fill: '#fff', fillOpacity: 0.75, transform: `rotate(-20 ${cx - 12} ${cy - 18})` })
    + path(glyph, { fill: '#fff', fillOpacity: 0.95, transform: `translate(${cx} ${cy + 4})` });
}

function circuitry() {
  const rnd = rng(11), out = [];
  for (let i = 0; i < 26; i++) {
    const left = i % 2, x0 = left ? 80 + rnd() * 140 : 1380 + rnd() * 140, y0 = 160 + rnd() * 640;
    const dx = (left ? 1 : -1) * (40 + rnd() * 90), dy = (rnd() - 0.5) * 120;
    out.push(`M${n(x0)} ${n(y0)}H${n(x0 + dx)}L${n(x0 + dx + Math.sign(dx) * Math.abs(dy) * 0.6)} ${n(y0 + dy)}`);
  }
  return path(out.join(''), { fill: 'none', stroke: '#fff', strokeOpacity: 0.28, strokeWidth: 3, strokeLinecap: 'round' })
    + [[120, 220], [1480, 220], [120, 760], [1480, 760], [800, 840]].map(([x, y]) => path(circle(x, y, 13), { fill: '#fff', fillOpacity: 0.35, stroke: INK, strokeOpacity: 0.5, strokeWidth: 3 })
      + path(`M${x - 7} ${y}H${x + 7}M${x} ${y - 7}V${y + 7}`, { stroke: INK, strokeOpacity: 0.55, strokeWidth: 3 })).join('');
}

function branch() {
  const twig = (d, w) => path(d, { fill: 'none', stroke: '#5b3346', strokeWidth: w, strokeLinecap: 'round' });
  return g({},
    twig('M10 330C90 250 170 190 300 150C380 126 450 120 520 96', 16),
    twig('M150 222C170 160 210 120 262 90', 9), twig('M330 144C370 110 420 80 470 64', 8), twig('M520 96C560 84 600 86 640 74', 7),
    path('M30 316C110 244 190 190 310 152', { fill: 'none', stroke: '#fff', strokeOpacity: 0.25, strokeWidth: 4, strokeLinecap: 'round' }),
    blossom(150, 260, 54, 10), blossom(262, 92, 44, 30), blossom(306, 150, 56, -8), blossom(470, 64, 40, 20),
    blossom(560, 78, 42, 40), blossom(640, 66, 30, 0), blossom(60, 318, 40, 15),
    path(circle(212, 186, 14), { fill: '#ffc0da', stroke: '#e0679e', strokeWidth: 3 }), path(circle(420, 104, 12), { fill: '#ffc0da', stroke: '#e0679e', strokeWidth: 3 }));
}

function petals() {
  const list = [[700, 40, 30, 16], [880, 28, -40, 13], [1130, 46, 70, 15], [24, 560, 110, 14], [1580, 300, -20, 14], [1520, 120, 40, 18], [60, 880, 160, 15], [1100, 960, -60, 16], [500, 960, 30, 13]];
  return list.map(([x, y, r, s]) => g({ transform: tf(x, y, r) }, path(petal(s * 2), { fill: 'url(#petal)', stroke: '#e0679e', strokeWidth: 1.5 }))).join('');
}

function charm() {
  return g({},
    path('M1420 860C1440 900 1446 930 1440 958', { fill: 'none', stroke: '#ff8fc0', strokeWidth: 7, strokeLinecap: 'round' }),
    path('M1420 860C1440 900 1446 930 1440 958', { fill: 'none', stroke: '#fff', strokeOpacity: 0.6, strokeWidth: 2, strokeDasharray: '6 6' }),
    path(circle(1440, 958, 9), { fill: 'url(#gold)', stroke: '#9b6a1b', strokeWidth: 3 }),
    blossom(1440, 962, 34, 12, 'petalDeep', '#c2306f'));
}

function draw() {
  const holeD = rr(hole.x, hole.y, hole.w, hole.h, radius);
  const defs = [
    rg('shell', [0.5, 0.45, 0.75], [[0, '#ffd6e8', 0.42], [0.7, '#ffb0d2', 0.55], [1, '#ff8cc0', 0.78]]),
    lg('shellGloss', [0, 0, 0, 1], [[0, '#fff', 0.6], [0.35, '#fff', 0.08], [1, '#fff', 0]]),
    lg('plate', [0, 0, 0, 1], [[0, '#fff9fc'], [0.6, '#f9e8f1'], [1, '#eccfe0']]),
    lg('plateEdge', [0, 0, 1, 1], [[0, '#ffffff'], [1, '#c98aab']]),
    lg('pearl', [0, 0, 1, 1], [[0, '#ffffff'], [0.5, '#fbeef5'], [1, '#e9c3d6']]),
    lg('shoulder', [0, 0, 0, 1], [[0, '#ffe3ef'], [1, '#f39cc3']]),
    lg('gold', [0, 0, 0, 1], [[0, '#fff2b8'], [1, '#d39b2a']]),
    rg('petal', [0.5, 1, 1], [[0, '#ffffff'], [0.55, '#ffd3e6'], [1, '#ff9cc8']]),
    rg('petalDeep', [0.5, 1, 1], [[0, '#fff0f6'], [0.5, '#ff9cc8'], [1, '#ff5f9e']]),
    rg('btn-pink', [0.4, 0.35, 0.7], [[0, '#ffd1e6'], [1, '#ff6fae']]),
    rg('btn-mint', [0.4, 0.35, 0.7], [[0, '#d8fff0'], [1, '#4fd6a6']]),
    rg('btn-lilac', [0.4, 0.35, 0.7], [[0, '#efe0ff'], [1, '#a77bff']]),
    rg('btn-peach', [0.4, 0.35, 0.7], [[0, '#ffe8cf'], [1, '#ffa45c']]),
    rg('led', [0.5, 0.5, 0.5], [[0, '#fff'], [0.3, '#ff5f9e'], [1, '#ff5f9e', 0]]),
    rg('floor', [0.5, 0.5, 0.5], [[0, '#7d2a55', 0.35], [1, '#7d2a55', 0]]),
    `<clipPath id="shellClip"><path d="${SHELL}"/></clipPath>`,
  ].join('');

  const speaker = [];
  for (let i = 0; i < 5; i++) for (let k = 1; k <= 3; k++) {
    const a = ((i * 72 - 90) * Math.PI) / 180, r = k * 17;
    speaker.push(circle(1330 + r * Math.cos(a), 790 + r * Math.sin(a), 5.5 - k * 0.6));
  }

  const body = [
    path(ellipse(800, 940, 700, 26), { fill: 'url(#floor)' }),
    // shoulder buttons
    path(rr(150, 34, 330, 80, 36), { fill: 'url(#shoulder)', stroke: INK, strokeWidth: 5 }),
    path(rr(1120, 34, 330, 80, 36), { fill: 'url(#shoulder)', stroke: INK, strokeWidth: 5 }),
    path('M190 48H440M1160 48H1410', { stroke: '#fff', strokeOpacity: 0.85, strokeWidth: 6, strokeLinecap: 'round' }),
    // clear shell
    path(SHELL, { fill: 'url(#shell)' }),
    g({ clipPath: 'url(#shellClip)' }, circuitry(),
      path('M40 470C40 250 130 60 300 60H1300C1470 60 1560 250 1560 470C1200 300 400 300 40 470Z', { fill: 'url(#shellGloss)' })),
    path(SHELL, { fill: 'none', stroke: INK, strokeWidth: 6 }),
    path('M64 470C64 270 150 84 300 84H1300C1450 84 1536 270 1536 470', { fill: 'none', stroke: '#fff', strokeOpacity: 0.65, strokeWidth: 5, strokeLinecap: 'round' }),
    // pearl screen plate
    path(rr(334, 90, 932, 740, 44), { fill: '#7d2a55', fillOpacity: 0.25, transform: 'translate(0 8)' }),
    path(rr(330, 86, 940, 740, 46), { fill: 'url(#plateEdge)', stroke: INK, strokeWidth: 5 }),
    path(rr(340, 96, 920, 720, 38), { fill: 'url(#plate)' }),
    path(rr(366, 116, 868, 588, 20), { fill: '#3a2234' }),
    lip(holeD, '#000', [[8, 0.3], [3, 0.6]]),
    path('M372 200V140Q372 122 390 122H560', { fill: 'none', stroke: '#fff', strokeOpacity: 0.3, strokeWidth: 4, strokeLinecap: 'round' }),
    path(circle(402, 760, 22), { fill: 'url(#led)' }), path(circle(402, 760, 8), { fill: '#fff' }),
    path('M436 752h70M436 768h46', { stroke: '#d99bbb', strokeWidth: 6, strokeLinecap: 'round' }),
    blossom(800, 762, 30, 0, 'petalDeep', '#c2306f'),
    path('M680 762h60M860 762h60', { stroke: '#e8b8cf', strokeWidth: 4, strokeLinecap: 'round' }),
    [1110, 1150, 1190].map((x, i) => path(heart(x, 762, 15), { fill: i < 2 ? '#ff6fae' : '#fff', stroke: INK, strokeWidth: 3 })).join(''),
    // controls
    dpad(190, 450),
    button(1410, 362, 'pink', heart(0, -2, 16)),
    button(1490, 450, 'mint', star(0, -2, 20, 9)),
    button(1330, 450, 'lilac', 'M6 -17A18 18 0 1 0 6 17A20 20 0 0 1 6 -17Z'),
    button(1410, 538, 'peach', sparkle(0, -2, 20, 0.22)),
    path(rr(586, 856, 120, 30, 15), { fill: 'url(#pearl)', stroke: INK, strokeWidth: 4, transform: 'rotate(-12 646 871)' }),
    path(rr(894, 856, 120, 30, 15), { fill: 'url(#pearl)', stroke: INK, strokeWidth: 4, transform: 'rotate(-12 954 871)' }),
    path(speaker.join(''), { fill: '#7d2a55', fillOpacity: 0.55 }),
    path(circle(1330, 790, 6), { fill: '#7d2a55', fillOpacity: 0.55 }),
    // decor
    branch(),
    charm(),
    petals(),
    path(sparkle(1270, 30, 20), { fill: '#fff', stroke: '#ff9cc8', strokeWidth: 2 }),
    path(sparkle(1560, 640, 16), { fill: '#fff', stroke: '#ff9cc8', strokeWidth: 2 }),
    path(sparkle(32, 680, 14), { fill: '#fff', stroke: '#ff9cc8', strokeWidth: 2 }),
  ].join('\n');
  return { defs, body };
}

module.exports = {
  W, H, hole, radius, draw,
  meta: { name: 'Sakura Handheld', theme: 'anime', rarity: 'rare', translucent: true,
    desc: 'A clear-pink pocket console in full bloom. Your shell fill glows through the see-through plastic.', tags: ['handheld', 'sakura', 'pastel', 'anime', 'clear'] },
};
