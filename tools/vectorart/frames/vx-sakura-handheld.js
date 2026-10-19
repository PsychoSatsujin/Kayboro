'use strict';
// Sakura Handheld: a wide clear-pink pocket console with a cloud-scalloped silhouette (the translucent
// shell shows the equipped fill). Pearl screen plate, a five-petal flower dial pad on the left, a
// crescent of three petal keys on the right, a petal slide switch, two bud keys, a blooming cherry
// branch, drifting petals and a sakura charm on a strap. Original Kayboro artwork.
const L = require('../lib');
const { rr, path, g, lg, rg, circle, ellipse, sparkle, heart, petal, blossom, tf, rng, lip, n } = L;

const W = 1600, H = 1000, hole = { x: 380, y: 130, w: 840, h: 560 }, radius = 12;
const INK = '#b2477a';

/** Cloud-scalloped outline: evenly spaced bumps around a rounded-rect envelope (clockwise from top centre). */
const SHELL = (() => {
  const x0 = 60, y0 = 76, x1 = 1540, y1 = 880, r = 250, pts = [];
  const arc = (cx, cy, a0) => { for (let k = 0; k <= 24; k++) { const a = ((a0 + (k * 90) / 24) * Math.PI) / 180; pts.push([cx + r * Math.cos(a), cy + r * Math.sin(a)]); } };
  pts.push([800, y0]);
  arc(x1 - r, y0 + r, -90); arc(x1 - r, y1 - r, 0); arc(x0 + r, y1 - r, 90); arc(x0 + r, y0 + r, 180);
  pts.push([800, y0]);
  const cum = [0];
  for (let i = 1; i < pts.length; i++) cum.push(cum[i - 1] + Math.hypot(pts[i][0] - pts[i - 1][0], pts[i][1] - pts[i - 1][1]));
  const total = cum[cum.length - 1], N = 28, at = (t) => {
    let i = 1;
    while (cum[i] < t && i < cum.length - 1) i++;
    const k = (t - cum[i - 1]) / (cum[i] - cum[i - 1] || 1);
    return [pts[i - 1][0] + (pts[i][0] - pts[i - 1][0]) * k, pts[i - 1][1] + (pts[i][1] - pts[i - 1][1]) * k];
  };
  const s = [];
  for (let i = 0; i < N; i++) s.push(at(((i + 0.5) / N) * total));
  let d = `M${n(s[0][0])} ${n(s[0][1])}`;
  for (let i = 0; i < N; i++) {
    const a = s[i], b = s[(i + 1) % N], rad = Math.hypot(b[0] - a[0], b[1] - a[1]) * 0.6;
    d += `A${n(rad)} ${n(rad)} 0 0 1 ${n(b[0])} ${n(b[1])}`;
  }
  return `${d}Z`;
})();
const INSET = 'translate(800 478) scale(0.972 0.952) translate(-800 -478)';

/** One petal-shaped key, centred on (cx, cy), tip pointing along `deg` (0 = up). */
function petalKey(cx, cy, deg, len, fill) {
  const d = petal(len);
  return g({ transform: `${tf(cx, cy, deg)} translate(0 ${n(len / 2)})` },
    path(d, { fill: '#7d2a55', fillOpacity: 0.35, transform: `rotate(${n(-deg)}) translate(3 9) rotate(${n(deg)})` }),
    path(d, { fill, stroke: INK, strokeWidth: 5, strokeLinejoin: 'round' }),
    path(d, { fill: 'url(#petalSheen)' }),
    path(`M0 ${n(-len * 0.18)}V${n(-len * 0.62)}`, { stroke: '#fff', strokeOpacity: 0.55, strokeWidth: 3, strokeLinecap: 'round' }),
    path(ellipse(-len * 0.17, -len * 0.7, len * 0.08, len * 0.14), { fill: '#fff', fillOpacity: 0.8, transform: `rotate(-20 ${n(-len * 0.17)} ${n(-len * 0.7)})` }));
}

/** Five-petal flower dial pad: each petal is a direction key around a round pistil key. */
function flowerPad(cx, cy) {
  let keys = '';
  for (let i = 0; i < 5; i++) {
    const deg = i * 72, a = ((deg - 90) * Math.PI) / 180, rr0 = 24 + 46;
    keys += petalKey(cx + rr0 * Math.cos(a), cy + rr0 * Math.sin(a), deg, 92, 'url(#pearlPetal)');
  }
  const stamens = [];
  for (let i = 0; i < 10; i++) {
    const a = ((i * 36 + 18) * Math.PI) / 180;
    stamens.push(circle(cx + 30 * Math.cos(a), cy + 30 * Math.sin(a), 4));
  }
  return path(circle(cx, cy, 138), { fill: '#d4588f', fillOpacity: 0.24 })
    + path(circle(cx, cy, 138), { fill: 'none', stroke: '#fff', strokeOpacity: 0.5, strokeWidth: 3 })
    + path(`M${cx - 98} ${cy + 98}A138 138 0 0 0 ${cx + 98} ${cy + 98}`, { fill: 'none', stroke: '#fff', strokeOpacity: 0.6, strokeWidth: 5, strokeLinecap: 'round' })
    + keys
    + path(stamens.join(''), { fill: '#ffd96a', stroke: '#c98a2a', strokeWidth: 1.5 })
    + path(circle(cx + 3, cy + 7, 24), { fill: '#7d2a55', fillOpacity: 0.35 })
    + path(circle(cx, cy, 24), { fill: 'url(#btn-rose)', stroke: INK, strokeWidth: 4 })
    + path(ellipse(cx - 7, cy - 9, 8, 5), { fill: '#fff', fillOpacity: 0.85, transform: `rotate(-25 ${cx - 7} ${cy - 9})` });
}

/** Crescent groove holding three petal keys that fan out around an imaginary centre to their right. */
function petalCrescent(cx, cy) {
  const R = 128, p = (a) => [n(cx + R * Math.cos((a * Math.PI) / 180)), n(cy + R * Math.sin((a * Math.PI) / 180))];
  const arc = `M${p(126).join(' ')}A${R} ${R} 0 0 1 ${p(234).join(' ')}`;
  const keys = [[138, 'url(#btn-blush)'], [180, 'url(#btn-rose)'], [222, 'url(#btn-plum)']].map(([a, fill]) => {
    const [x, y] = p(a);
    return petalKey(x, y, a + 90, 104, fill);
  }).join('');
  return path(arc, { fill: 'none', stroke: '#d4588f', strokeOpacity: 0.26, strokeWidth: 128, strokeLinecap: 'round' })
    + path(arc, { fill: 'none', stroke: '#fff', strokeOpacity: 0.45, strokeWidth: 3, transform: 'translate(-4 0)' })
    + keys
    + path(circle(cx + 6, cy, 12), { fill: 'url(#gold)', stroke: '#9b6a1b', strokeWidth: 3 });
}

/** Small slide switch with a petal-shaped thumb. */
function slide(cx, cy) {
  return path(rr(cx - 74, cy - 15, 148, 30, 15), { fill: '#d4588f', fillOpacity: 0.3, stroke: INK, strokeOpacity: 0.6, strokeWidth: 4 })
    + path(rr(cx - 62, cy - 4, 124, 8, 4), { fill: '#7d2a55', fillOpacity: 0.45 })
    + g({ transform: `${tf(cx + 40, cy, 90)} translate(0 22)` },
      path(petal(44), { fill: 'url(#pearlPetal)', stroke: INK, strokeWidth: 4, strokeLinejoin: 'round' }))
    + path(circle(cx - 48, cy + 30, 5) + circle(cx, cy + 30, 5), { fill: '#7d2a55', fillOpacity: 0.4 })
    + path(circle(cx + 48, cy + 30, 5), { fill: '#ff5f9e' });
}

/** Round bud key with green sepals. */
function bud(cx, cy) {
  return path(circle(cx + 3, cy + 7, 20), { fill: '#7d2a55', fillOpacity: 0.3 })
    + path(`M${cx - 20} ${cy + 6}Q${cx - 14} ${cy + 26} ${cx} ${cy + 22}Q${cx + 14} ${cy + 26} ${cx + 20} ${cy + 6}`, { fill: '#8fd6a0', stroke: '#3f8a57', strokeWidth: 3, strokeLinejoin: 'round' })
    + path(circle(cx, cy, 19), { fill: 'url(#btn-blush)', stroke: INK, strokeWidth: 4 })
    + path(`M${cx} ${cy - 15}V${cy + 6}`, { stroke: INK, strokeOpacity: 0.35, strokeWidth: 2.5, strokeLinecap: 'round' })
    + path(ellipse(cx - 6, cy - 7, 6, 3.5), { fill: '#fff', fillOpacity: 0.85, transform: `rotate(-25 ${cx - 6} ${cy - 7})` });
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
    rg('btn-blush', [0.4, 0.3, 0.8], [[0, '#fff3f8'], [0.6, '#ffc6dc'], [1, '#ff8fbd']]),
    rg('btn-rose', [0.4, 0.3, 0.8], [[0, '#ffd8ea'], [0.6, '#ff7fb2'], [1, '#e0447f']]),
    rg('btn-plum', [0.4, 0.3, 0.8], [[0, '#f6e6ff'], [0.6, '#d9a6f5'], [1, '#a866d6']]),
    rg('pearlPetal', [0.5, 0.25, 0.9], [[0, '#ffffff'], [0.55, '#fde9f2'], [1, '#f3b6d1']]),
    lg('petalSheen', [0, 0, 1, 1], [[0, '#fff', 0.4], [0.4, '#fff', 0], [1, '#ffd0e6', 0.2]]),
    rg('led', [0.5, 0.5, 0.5], [[0, '#fff'], [0.3, '#ff5f9e'], [1, '#ff5f9e', 0]]),
    rg('floor', [0.5, 0.5, 0.5], [[0, '#7d2a55', 0.35], [1, '#7d2a55', 0]]),
    `<clipPath id="shellClip"><path d="${SHELL}"/></clipPath>`,
    '<clipPath id="topHalf"><path d="M0 0H1600V360H0Z"/></clipPath><clipPath id="lowHalf"><path d="M0 640H1600V1000H0Z"/></clipPath>',
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
      path('M0 0H1600V470C1200 300 400 300 0 470Z', { fill: 'url(#shellGloss)' }),
      path(SHELL, { fill: 'none', stroke: '#fff', strokeOpacity: 0.55, strokeWidth: 5, transform: INSET, clipPath: 'url(#topHalf)' }),
      path(SHELL, { fill: 'none', stroke: INK, strokeOpacity: 0.25, strokeWidth: 4, transform: INSET, clipPath: 'url(#lowHalf)' })),
    path(SHELL, { fill: 'none', stroke: INK, strokeWidth: 6 }),
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
    flowerPad(200, 450),
    slide(200, 690),
    petalCrescent(1480, 440),
    bud(700, 866), bud(900, 866),
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
    desc: 'A cloud-edged clear-pink pocket console in full bloom, with a flower dial and petal keys. Your shell fill glows through the see-through plastic.', tags: ['handheld', 'sakura', 'pastel', 'anime', 'clear'] },
};
