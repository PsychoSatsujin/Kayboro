'use strict';
// 70s walnut console TV: brushed-aluminium control panel, chrome knobs, slatted speaker, rabbit ears,
// and a snake plant in a mustard pot with a pothos vine trailing down the side.
const L = require('../lib');
const { rr, path, g, lg, rg, circle, ellipse, smooth, tf, rng, lip, n } = L;

const DY = 70; // everything below is drawn 70px higher and shifted down so the plant has headroom
const W = 1600, H = 1370, hole = { x: 200, y: 400 + DY, w: 800, h: 600 }, radius = 24;

function grain() {
  const rnd = rng(7), out = [];
  for (let y = 312; y < 1108; y += 9 + rnd() * 9) {
    const pts = [], amp = 2 + rnd() * 5, ph = rnd() * 6, f = 0.004 + rnd() * 0.004;
    for (let x = 80; x <= 1520; x += 60) {
      let dy = amp * Math.sin(x * f + ph);
      for (const [kx, ky, kr] of [[560, 340, 70], [1180, 1080, 60]]) { // bend around two knots
        const d = Math.hypot(x - kx, (y - ky) * 2);
        if (d < kr * 3) dy += Math.sign(y - ky || 1) * (kr * 3 - d) * 0.25;
      }
      pts.push([x, y + dy]);
    }
    const dark = rnd() < 0.7;
    out.push(path(smooth(pts), { fill: 'none', stroke: dark ? '#2a1408' : '#d79a63', strokeOpacity: n(dark ? 0.12 + rnd() * 0.2 : 0.06 + rnd() * 0.08), strokeWidth: n(1 + rnd() * 3.5) }));
  }
  for (const [kx, ky, kr] of [[560, 340, 70], [1180, 1080, 60]])
    for (let i = 1; i <= 4; i++) out.push(path(ellipse(kx, ky, kr * 0.22 * i, kr * 0.09 * i), { fill: 'none', stroke: '#2a1408', strokeOpacity: n(0.35 - i * 0.05), strokeWidth: 2 }));
  return out.join('');
}

function knob(cx, cy, r, angle, ticks) {
  const t = [];
  if (ticks) for (let i = 0; i < 13; i++) {
    const a = ((-225 + i * 22.5) * Math.PI) / 180, r1 = r + 14, r2 = r + (i % 3 ? 24 : 32);
    t.push(path(`M${n(cx + r1 * Math.cos(a))} ${n(cy + r1 * Math.sin(a))}L${n(cx + r2 * Math.cos(a))} ${n(cy + r2 * Math.sin(a))}`, { stroke: '#3b3a40', strokeWidth: i % 3 ? 3 : 5, strokeLinecap: 'round' }));
  }
  const knurl = [];
  for (let i = 0; i < 48; i++) {
    const a = (i / 48) * Math.PI * 2;
    knurl.push(`M${n(cx + (r - 1) * Math.cos(a))} ${n(cy + (r - 1) * Math.sin(a))}L${n(cx + (r - 9) * Math.cos(a))} ${n(cy + (r - 9) * Math.sin(a))}`);
  }
  const a = (angle * Math.PI) / 180;
  return t.join('')
    + path(circle(cx + 3, cy + 8, r + 4), { fill: '#000', fillOpacity: 0.28 })
    + path(circle(cx, cy, r), { fill: 'url(#chrome)', stroke: '#2a2a2e', strokeWidth: 3 })
    + path(knurl.join(''), { stroke: '#4a4a52', strokeOpacity: 0.55, strokeWidth: 2 })
    + path(circle(cx, cy, r * 0.72), { fill: 'url(#chromeCap)', stroke: '#6d6d75', strokeWidth: 2 })
    + path(`M${n(cx + r * 0.2 * Math.cos(a))} ${n(cy + r * 0.2 * Math.sin(a))}L${n(cx + r * 0.66 * Math.cos(a))} ${n(cy + r * 0.66 * Math.sin(a))}`, { stroke: '#e0641e', strokeWidth: n(r * 0.1), strokeLinecap: 'round' })
    + path(ellipse(cx - r * 0.25, cy - r * 0.35, r * 0.32, r * 0.14), { fill: '#fff', fillOpacity: 0.55, transform: `rotate(-25 ${n(cx - r * 0.25)} ${n(cy - r * 0.35)})` });
}

function snakePlant() {
  const leaves = [[1250, -16, 225, 34], [1280, -4, 250, 38], [1310, 9, 238, 36], [1338, 24, 190, 30], [1226, -32, 170, 28], [1296, 2, 140, 26]];
  return leaves.map(([x, rot, len, w], i) => {
    const d = `M0 0C${n(w * 0.9)} ${n(-len * 0.35)} ${n(w * 0.5)} ${n(-len * 0.8)} 0 ${-len}C${n(-w * 0.55)} ${n(-len * 0.8)} ${n(-w * 0.9)} ${n(-len * 0.35)} 0 0Z`;
    const bands = [0.22, 0.38, 0.54, 0.7].map((k) => `M${n(-w)} ${n(-len * k)}Q0 ${n(-len * k - 14)} ${n(w)} ${n(-len * k)}`).join('');
    return g({ transform: tf(x, 190, rot) },
      `<clipPath id="snakeLeaf${i}"><path d="${d}"/></clipPath>`,
      path(d, { fill: `url(#snake${i % 2})` }),
      path(bands, { fill: 'none', stroke: '#a8d18a', strokeOpacity: 0.35, strokeWidth: 5, clipPath: `url(#snakeLeaf${i})` }),
      path(d, { fill: 'none', stroke: '#e3d46a', strokeWidth: 4 }),
      path(`M0 -6Q${n(w * 0.12)} ${n(-len * 0.5)} 0 ${n(-len + 8)}`, { fill: 'none', stroke: '#0e3b22', strokeOpacity: 0.45, strokeWidth: 2 }));
  }).join('');
}

const pothosLeaf = 'M0 6C-14 -6 -38 4 -36 28C-34 46 -14 58 0 66C14 58 34 46 36 28C38 4 14 -6 0 6Z';

function pothos() {
  const vine = [[1350, 190], [1420, 200], [1480, 240], [1515, 320], [1528, 420], [1522, 520], [1534, 610], [1526, 700]];
  const leaves = [[1405, 196, -60, 1], [1462, 226, 40, 0], [1500, 285, -50, 1], [1520, 360, 50, 0], [1528, 440, -40, 1], [1520, 515, 45, 0], [1530, 590, -35, 1], [1526, 668, 30, 0], [1524, 712, 5, 1]];
  return path(smooth(vine), { fill: 'none', stroke: '#3f6b2a', strokeWidth: 5, strokeLinecap: 'round' })
    + leaves.map(([x, y, rot, k], i) => g({ transform: tf(x, y, rot, 0.85 + (i % 3) * 0.1) },
      path(pothosLeaf, { fill: `url(#pothos${k})`, stroke: '#24501c', strokeWidth: 2.5 }),
      path('M0 6Q4 30 0 58', { fill: 'none', stroke: '#e9f2a6', strokeOpacity: 0.6, strokeWidth: 2 }))).join('');
}

function draw() {
  const holeD = rr(hole.x, hole.y - DY, hole.w, hole.h, radius);
  const defs = [
    lg('walnut', [0, 0, 0, 1], [[0, '#8a5530'], [0.45, '#6a3b1d'], [1, '#43230f']]),
    lg('walnutEdge', [0, 0, 1, 1], [[0, '#b5794a'], [0.5, '#6a3b1d'], [1, '#2b1508']]),
    lg('varnish', [0, 0, 0, 1], [[0, '#fff', 0.22], [0.18, '#fff', 0.05], [0.5, '#fff', 0], [1, '#000', 0.15]]),
    lg('surround', [0, 0, 0, 1], [[0, '#3a2516'], [1, '#160c06']]),
    lg('surroundEdge', [0, 0, 1, 1], [[0, '#6b4a33'], [1, '#0a0503']]),
    lg('glass', [0, 0, 1, 1], [[0, '#2a2d33'], [0.5, '#0b0c0f'], [1, '#000']]),
    lg('alu', [0, 0, 1, 0], [[0, '#b9b6ae'], [0.15, '#e9e6de'], [0.5, '#cfcbc2'], [0.85, '#ebe8e1'], [1, '#a9a59c']]),
    lg('chrome', [0, 0, 0, 1], [[0, '#ffffff'], [0.45, '#c9c9cf'], [0.55, '#7b7b84'], [1, '#e2e2e8']]),
    lg('chromeCap', [0, 0, 1, 1], [[0, '#fbfbfd'], [0.5, '#b6b6be'], [1, '#6c6c74']]),
    lg('slat', [0, 0, 1, 0], [[0, '#4a2712'], [0.35, '#9a6337'], [0.7, '#7a4826'], [1, '#3a1d0c']]),
    lg('brass', [0, 0, 0, 1], [[0, '#fff1b8'], [0.4, '#d8a943'], [1, '#8a5e17']]),
    lg('leg', [0, 0, 1, 0], [[0, '#2f170a'], [0.4, '#7a4826'], [1, '#2a1408']]),
    lg('pot', [0, 0, 1, 0], [[0, '#a8650c'], [0.3, '#f2b844'], [0.55, '#e7a531'], [1, '#8a4f08']]),
    lg('potRim', [0, 0, 0, 1], [[0, '#ffd47a'], [1, '#b8740f']]),
    lg('snake0', [0, 0, 1, 0], [[0, '#1d5c34'], [0.5, '#3f8f52'], [1, '#1a4d2c']]),
    lg('snake1', [0, 0, 1, 0], [[0, '#22663a'], [0.5, '#4fa062'], [1, '#1d5531']]),
    lg('pothos0', [0, 0, 1, 1], [[0, '#8fd16a'], [1, '#3d8a2e']]),
    lg('pothos1', [0, 0, 1, 1], [[0, '#b3e07a'], [0.5, '#5aa83c'], [1, '#2f7426']]),
    lg('fabric', [0, 0, 0, 1], [[0, '#1e130c'], [1, '#0d0805']]),
    rg('floor', [0.5, 0.5, 0.5], [[0, '#000', 0.45], [1, '#000', 0]]),
    rg('lamp', [0.5, 0.5, 0.5], [[0, '#ffe2a0'], [0.35, '#ff9a2e'], [1, '#ff6a00', 0]]),
    `<clipPath id="cab"><path d="${rr(90, 300, 1420, 810, 46)}"/></clipPath>`,
  ].join('');

  const legs = [[250, 1], [1350, -1]].map(([x, s]) => {
    const d = `M${x - 26} 1100L${x + 26} 1100L${x + 14 - s * 26} 1262L${x - 12 - s * 26} 1262Z`;
    return path(d, { fill: 'url(#leg)', stroke: '#1e0e05', strokeWidth: 3 })
      + path(`M${x - 13 - s * 25} 1240L${x + 14 - s * 25} 1240L${x + 14 - s * 26} 1270L${x - 12 - s * 26} 1270Z`, { fill: 'url(#brass)', stroke: '#6a4510', strokeWidth: 2 });
  }).join('');

  const antenna = g({},
    path('M412 286L238 26', { stroke: '#2b2b30', strokeWidth: 11, strokeLinecap: 'round' }),
    path('M412 286L238 26', { stroke: 'url(#chrome)', strokeWidth: 6, strokeLinecap: 'round' }),
    path('M448 286L660 44', { stroke: '#2b2b30', strokeWidth: 11, strokeLinecap: 'round' }),
    path('M448 286L660 44', { stroke: 'url(#chrome)', strokeWidth: 6, strokeLinecap: 'round' }),
    path('M412 286L340 180M448 286L540 180', { stroke: '#e8e8ee', strokeWidth: 9, strokeLinecap: 'round' }),
    path(circle(238, 26, 11), { fill: 'url(#chromeCap)', stroke: '#2b2b30', strokeWidth: 3 }),
    path(circle(660, 44, 11), { fill: 'url(#chromeCap)', stroke: '#2b2b30', strokeWidth: 3 }),
    path('M360 302C360 250 500 250 500 302Z', { fill: 'url(#chromeCap)', stroke: '#2b2b30', strokeWidth: 3 }),
    path('M384 280C400 262 440 258 466 266', { fill: 'none', stroke: '#fff', strokeOpacity: 0.7, strokeWidth: 5, strokeLinecap: 'round' }));

  const pot = g({},
    path(ellipse(1290, 302, 120, 10), { fill: '#000', fillOpacity: 0.3 }),
    path('M1204 170L1376 170L1352 300L1228 300Z', { fill: 'url(#pot)', stroke: '#7a4306', strokeWidth: 3 }),
    path('M1213 222L1367 222L1362 248L1218 248Z', { fill: '#fff4dc', fillOpacity: 0.92 }),
    path('M1218 236h144', { stroke: '#e07a1f', strokeWidth: 5, strokeDasharray: '10 8' }),
    path(rr(1192, 150, 196, 28, 10), { fill: 'url(#potRim)', stroke: '#7a4306', strokeWidth: 3 }),
    path('M1228 186L1240 286', { stroke: '#fff', strokeOpacity: 0.35, strokeWidth: 8, strokeLinecap: 'round' }),
    path(ellipse(1290, 154, 86, 7), { fill: '#3b2412' }));

  const slats = Array.from({ length: 9 }, (_, i) => path(rr(1140 + i * 30, 802, 20, 196, 6), { fill: 'url(#slat)' })).join('');

  const body = [
    path(ellipse(800, 1272, 760, 22), { fill: 'url(#floor)' }),
    legs,
    antenna,
    // cabinet
    path(rr(90, 300, 1420, 810, 46), { fill: 'url(#walnutEdge)', stroke: '#241106', strokeWidth: 4 }),
    path(rr(104, 314, 1392, 782, 36), { fill: 'url(#walnut)' }),
    g({ clipPath: 'url(#cab)' }, grain()),
    path(rr(104, 314, 1392, 782, 36), { fill: 'url(#varnish)' }),
    path('M140 316H1460', { stroke: '#ffd3a1', strokeOpacity: 0.45, strokeWidth: 3, strokeLinecap: 'round' }),
    // screen surround + glass lip
    path(rr(144, 346, 912, 712, 44), { fill: '#1a0d05', fillOpacity: 0.45 }),
    path(rr(150, 350, 900, 700, 42), { fill: 'url(#surroundEdge)' }),
    path(rr(158, 358, 884, 684, 36), { fill: 'url(#surround)' }),
    path(rr(180, 380, 840, 640, 32), { fill: 'url(#glass)', stroke: '#000', strokeWidth: 3 }),
    lip(holeD, '#000', [[10, 0.25], [5, 0.4], [2, 0.7]]),
    path('M188 520V420Q188 388 220 388H420', { fill: 'none', stroke: '#fff', strokeOpacity: 0.16, strokeWidth: 4, strokeLinecap: 'round' }),
    path('M164 1044H1036', { stroke: '#fff', strokeOpacity: 0.08, strokeWidth: 2 }),
    // brass badge
    path(rr(540, 1062, 120, 28, 14), { fill: 'url(#brass)', stroke: '#6a4510', strokeWidth: 2 }),
    path('M562 1076h76', { stroke: '#7a5418', strokeWidth: 3, strokeDasharray: '14 6', strokeLinecap: 'round' }),
    // control panel
    path(rr(1094, 356, 352, 690, 26), { fill: '#1a0d05', fillOpacity: 0.5 }),
    path(rr(1100, 360, 340, 680, 22), { fill: 'url(#alu)', stroke: '#5f5c56', strokeWidth: 3 }),
    path(Array.from({ length: 60 }, (_, i) => `M1104 ${370 + i * 11}H1436`).join(''), { stroke: '#fff', strokeOpacity: 0.12, strokeWidth: 1.5 }),
    knob(1270, 520, 86, -60, true),
    knob(1196, 700, 46, 30, false),
    knob(1344, 700, 46, 150, false),
    path(circle(1270, 640, 26), { fill: 'url(#lamp)' }),
    path(circle(1270, 640, 9), { fill: '#ffcf7a', stroke: '#7a3d00', strokeWidth: 2 }),
    path(rr(1130, 790, 280, 220, 14), { fill: 'url(#fabric)', stroke: '#3a2a20', strokeWidth: 3 }),
    slats,
    path(rr(1130, 790, 280, 220, 14), { fill: 'none', stroke: '#000', strokeOpacity: 0.35, strokeWidth: 6 }),
    // plant
    snakePlant(),
    pot,
    pothos(),
  ].join('\n');
  return { defs, body: g({ transform: `translate(0 ${DY})` }, body) };
}

module.exports = {
  W, H, hole, radius, draw,
  meta: { name: 'Cozy Wood TV', theme: 'retro-home', rarity: 'common', translucent: false,
    desc: 'A walnut 70s console set with chrome knobs, rabbit ears and a very happy snake plant.', tags: ['tv', '70s', 'wood', 'plant', 'cozy'] },
};
