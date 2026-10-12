'use strict';
// Anime mecha cockpit: gunmetal bezel with tricolour armour plates and a gold V-fin, cyan HUD tapes,
// corner brackets, compass ribbon, warning chevrons, radar, power gauge and segmented meters.
const L = require('../lib');
const { rr, path, lg, rg, circle, chamfer, poly, glowStroke, rng, lip, n } = L;

const W = 1600, H = 1000, hole = { x: 160, y: 130, w: 1280, h: 720 }, radius = 0;
const CYAN = '#4ff0ff', ORANGE = '#ff8a2a', INK = '#07090d';

const bolt = (x, y, r = 9) => path(circle(x, y, r), { fill: 'url(#bolt)', stroke: INK, strokeWidth: 2 })
  + path(`M${x - r * 0.55} ${y}H${x + r * 0.55}`, { stroke: INK, strokeOpacity: 0.7, strokeWidth: 2 });

function tape(x, dir) {
  const ticks = [], marks = [];
  for (let y = 210, i = 0; y <= 770; y += 20, i++) {
    const major = i % 5 === 0;
    ticks.push(`M${x}  ${y}h${dir * (major ? 34 : 16)}`);
    if (major) marks.push(`M${x + dir * 44} ${y - 5}h${dir * 30}v10h${-dir * 30}Z`);
  }
  return glowStroke(ticks.join(''), CYAN, 2.5, [[3.5, 0.15], [1, 0.95]])
    + path(marks.join(''), { fill: CYAN, fillOpacity: 0.55 })
    + path(`M${x + dir * 4} 488l${dir * 40} -16v32Z`, { fill: ORANGE });
}

function compass() {
  const t = [];
  for (let x = 592, i = 0; x <= 1008; x += 26, i++) t.push(`M${x} ${i % 4 ? 88 : 80}V98`);
  return glowStroke(t.join(''), CYAN, 2.5, [[3.5, 0.15], [1, 0.95]]) + path('M800 84l-8 -10h16Z', { fill: ORANGE });
}

function chevrons(x, dir) {
  return [0, 1, 2].map((i) => path(`M${x + dir * i * 26} 80l${dir * 16} 12l${-dir * 16} 12h${dir * 11}l${dir * 16} -12l${-dir * 16} -12Z`, { fill: ORANGE, fillOpacity: 1 - i * 0.25 })).join('');
}

function radar(cx, cy, r) {
  const sweep = `M${cx} ${cy}L${cx + r} ${cy}A${r} ${r} 0 0 0 ${n(cx + r * Math.cos(-0.9))} ${n(cy + r * Math.sin(-0.9))}Z`;
  return path(circle(cx, cy, r + 8), { fill: 'url(#plate)', stroke: INK, strokeWidth: 3 })
    + path(circle(cx, cy, r), { fill: '#04161b', stroke: CYAN, strokeOpacity: 0.7, strokeWidth: 2 })
    + path(`${circle(cx, cy, r * 0.66)}${circle(cx, cy, r * 0.33)}M${cx - r} ${cy}H${cx + r}M${cx} ${cy - r}V${cy + r}`, { fill: 'none', stroke: CYAN, strokeOpacity: 0.35, strokeWidth: 1.5 })
    + path(sweep, { fill: 'url(#sweep)' })
    + path(circle(cx + r * 0.4, cy - r * 0.3, 4), { fill: ORANGE }) + path(circle(cx - r * 0.5, cy + r * 0.2, 3.5), { fill: CYAN });
}

function gauge(cx, cy, r, val) {
  const arc = [], a0 = Math.PI * 0.8, a1 = Math.PI * 2.2;
  for (let i = 0; i <= 14; i++) {
    const a = a0 + (a1 - a0) * (i / 14), r1 = r - 6, r2 = r - (i % 7 === 0 ? 20 : 13);
    arc.push(`M${n(cx + r1 * Math.cos(a))} ${n(cy + r1 * Math.sin(a))}L${n(cx + r2 * Math.cos(a))} ${n(cy + r2 * Math.sin(a))}`);
  }
  const na = a0 + (a1 - a0) * val;
  return path(circle(cx, cy, r + 8), { fill: 'url(#plate)', stroke: INK, strokeWidth: 3 })
    + path(circle(cx, cy, r), { fill: '#0a0c12', stroke: '#3a4150', strokeWidth: 2 })
    + path(arc.join(''), { stroke: CYAN, strokeWidth: 2.5, strokeLinecap: 'round' })
    + path(`M${n(cx + (r - 8) * Math.cos(a1 - 0.5))} ${n(cy + (r - 8) * Math.sin(a1 - 0.5))}A${r - 8} ${r - 8} 0 0 1 ${n(cx + (r - 8) * Math.cos(a1))} ${n(cy + (r - 8) * Math.sin(a1))}`, { fill: 'none', stroke: '#ff4d4d', strokeWidth: 5 })
    + glowStroke(`M${cx} ${cy}L${n(cx + (r - 14) * Math.cos(na))} ${n(cy + (r - 14) * Math.sin(na))}`, ORANGE, 4, [[3, 0.2], [1, 1]])
    + path(circle(cx, cy, 8), { fill: 'url(#bolt)', stroke: INK, strokeWidth: 2 });
}

function meters() {
  const rows = [[0.8, CYAN], [0.55, CYAN], [0.35, ORANGE]], out = [];
  rows.forEach(([v, c], r) => {
    for (let i = 0; i < 20; i++) {
      const on = i / 20 < v;
      out.push(path(`M${616 + i * 19} ${886 + r * 26}h14v16h-14Z`, { fill: on ? c : '#1d2430', fillOpacity: on ? 0.95 - i * 0.012 : 1 }));
    }
  });
  return path(chamfer(596, 874, 408, 92, 12), { fill: '#06080c', stroke: '#3a4150', strokeWidth: 2 }) + out.join('');
}

function glyphs(x, y, dir, rows) {
  const rnd = rng(x + y), out = [];
  for (let r = 0; r < rows; r++) {
    let cx = x;
    for (let k = 0; k < 4; k++) { const w = 8 + Math.floor(rnd() * 22); out.push(`M${dir > 0 ? cx : cx - w} ${y + r * 14}h${w}v6h${-w}Z`); cx += dir * (w + 6); }
  }
  return path(out.join(''), { fill: CYAN, fillOpacity: 0.6 });
}

function draw() {
  const holeD = rr(hole.x, hole.y, hole.w, hole.h, radius);
  const defs = [
    lg('metal', [0, 0, 0, 1], [[0, '#4a5262'], [0.08, '#323947'], [0.6, '#1e232d'], [1, '#12151c']]),
    lg('plate', [0, 0, 0, 1], [[0, '#5a6375'], [1, '#262c37']]),
    lg('inner', [0, 0, 0, 1], [[0, '#0d1016'], [1, '#161a22']]),
    lg('armor', [0, 0, 0, 1], [[0, '#ffffff'], [0.6, '#e4e8f0'], [1, '#aab3c4']]),
    lg('vfin', [0, 0, 1, 0], [[0, '#ffe680'], [0.5, '#ffc21a'], [1, '#b87d00']]),
    rg('bolt', [0.35, 0.3, 0.8], [[0, '#c9d0de'], [1, '#3a4150']]),
    rg('sensor', [0.4, 0.35, 0.7], [[0, '#ffd1d1'], [0.4, '#ff3b3b'], [1, '#7a0000']]),
    rg('sweep', [0, 0.5, 1], [[0, CYAN, 0.05], [1, CYAN, 0.55]]),
    lg('hazard', [0, 0, 1, 1], [[0, '#ffcc00'], [1, '#e0a800']]),
    rg('floor', [0.5, 0.5, 0.5], [[0, '#000', 0.45], [1, '#000', 0]]),
  ].join('');

  const base = chamfer(24, 56, 1552, 930, [80, 80, 60, 60]);
  const stripes = [];
  for (let i = 0; i < 4; i++) stripes.push(`M${100 + i * 36} 984L${124 + i * 36} 956H${142 + i * 36}L${118 + i * 36} 984Z`, `M${1500 - i * 36} 984L${1476 - i * 36} 956H${1458 - i * 36}L${1482 - i * 36} 984Z`);
  const vents = (x) => path(Array.from({ length: 6 }, (_, i) => `M${x} ${790 + i * 14}h40l-8 7h-40Z`).join(''), { fill: INK, fillOpacity: 0.8 });
  const brackets = [[-1, -1], [1, -1], [-1, 1], [1, 1]].map(([sx, sy]) => {
    const x = sx < 0 ? hole.x - 12 : hole.x + hole.w + 12, y = sy < 0 ? hole.y - 12 : hole.y + hole.h + 12;
    return `M${x} ${y - sy * 70}V${y}H${x - sx * 70}`;
  }).join('');

  const body = [
    path(L.ellipse(800, 990, 760, 14), { fill: 'url(#floor)' }),
    // main frame
    path(base, { fill: 'url(#metal)', stroke: INK, strokeWidth: 4 }),
    path(chamfer(30, 62, 1540, 918, [76, 76, 56, 56]), { fill: 'none', stroke: '#8c96aa', strokeOpacity: 0.35, strokeWidth: 2 }),
    path(base, { fill: 'none', stroke: CYAN, strokeOpacity: 0.3, strokeWidth: 2 }),
    path('M24 400H150M24 640H150M1450 400H1576M1450 640H1576M566 868L560 986M1034 868L1040 986', { stroke: INK, strokeOpacity: 0.8, strokeWidth: 3 }),
    path('M24 403H150M24 643H150M1450 403H1576M1450 643H1576', { stroke: '#8c96aa', strokeOpacity: 0.25, strokeWidth: 1.5 }),
    // armour plates (white / red / blue)
    path(poly([[40, 140], [40, 120], [106, 54], [500, 54], [530, 84], [530, 112], [200, 112], [170, 140]]), { fill: 'url(#armor)', stroke: INK, strokeWidth: 3 }),
    path(poly([[1560, 140], [1560, 120], [1494, 54], [1100, 54], [1070, 84], [1070, 112], [1400, 112], [1430, 140]]), { fill: 'url(#armor)', stroke: INK, strokeWidth: 3 }),
    path(poly([[124, 62], [484, 62], [494, 72], [134, 72]]), { fill: '#e8332f' }),
    path(poly([[1476, 62], [1116, 62], [1106, 72], [1466, 72]]), { fill: '#2f62e8' }),
    path('M110 58H496', { stroke: '#fff', strokeWidth: 2 }), path('M1104 58H1490', { stroke: '#fff', strokeWidth: 2 }),
    chevrons(400, 1), chevrons(1200, -1),
    // visor housing
    path(poly([[540, 128], [560, 40], [600, 16], [1000, 16], [1040, 40], [1060, 128]]), { fill: 'url(#plate)', stroke: INK, strokeWidth: 3 }),
    path('M604 22H996', { stroke: '#a9b3c6', strokeOpacity: 0.6, strokeWidth: 2 }),
    path(chamfer(576, 70, 448, 34, 8), { fill: '#04161b', stroke: '#3a4150', strokeWidth: 2 }),
    compass(),
    // V-fin + sensor crest
    path('M800 60L626 4H654L800 36L946 4H974Z', { fill: '#000', fillOpacity: 0.35, transform: 'translate(3 5)' }),
    path('M800 60L626 4H654L800 36L946 4H974Z', { fill: 'url(#vfin)', stroke: '#6b4800', strokeWidth: 3, strokeLinejoin: 'round' }),
    path('M790 40L654 8M810 40L946 8', { stroke: '#fff7cc', strokeOpacity: 0.75, strokeWidth: 3, strokeLinecap: 'round' }),
    path('M778 24H822L834 42L800 64L766 42Z', { fill: '#e4e8f0', stroke: INK, strokeWidth: 3, strokeLinejoin: 'round' }),
    path('M788 32H812L818 42L800 54L782 42Z', { fill: 'url(#sensor)', stroke: INK, strokeWidth: 2 }),
    path(circle(800, 42, 20), { fill: '#ff3b3b', fillOpacity: 0.16 }),
    // side columns
    path(chamfer(40, 150, 108, 690, [0, 20, 20, 0]), { fill: 'url(#plate)', stroke: INK, strokeWidth: 3, fillOpacity: 0.5 }),
    path(chamfer(1452, 150, 108, 690, [20, 0, 0, 20]), { fill: 'url(#plate)', stroke: INK, strokeWidth: 3, fillOpacity: 0.5 }),
    tape(136, -1), tape(1464, 1),
    glyphs(52, 168, 1, 2), glyphs(1548, 168, -1, 2),
    vents(64), vents(1490),
    // inner bezel + screen lip
    path(chamfer(hole.x - 22, hole.y - 22, hole.w + 44, hole.h + 44, 26), { fill: 'url(#inner)', stroke: '#3a4150', strokeWidth: 2 }),
    lip(holeD, '#000', [[8, 0.3], [3, 0.6]]),
    glowStroke(brackets, CYAN, 4, [[4, 0.12], [2, 0.3], [1, 1]], { strokeLinecap: 'square', strokeLinejoin: 'miter' }),
    // dashboard
    path(poly([[150, 980], [180, 868], [1420, 868], [1450, 980]]), { fill: 'url(#plate)', stroke: INK, strokeWidth: 3, fillOpacity: 0.35 }),
    radar(300, 920, 46), gauge(1300, 922, 46, 0.62),
    meters(),
    glyphs(372, 888, 1, 4), glyphs(1236, 888, -1, 4),
    path(stripes.join(''), { fill: 'url(#hazard)' }),
    [1030, 1062, 1094].map((x, i) => path(rr(x, 884, 22, 62, 6), { fill: '#0a0c12', stroke: '#3a4150', strokeWidth: 2 })
      + path(rr(x + 3, i === 1 ? 914 : 888, 16, 28, 4), { fill: i === 1 ? ORANGE : CYAN })).join(''),
    path(circle(480, 960, 6), { fill: '#6eff8a' }), path(circle(500, 960, 6), { fill: ORANGE }), path(circle(520, 960, 6), { fill: '#3a4150' }),
    [[70, 100], [1530, 100], [60, 950], [1540, 950], [560, 112], [1040, 112], [200, 860], [1400, 860], [94, 860], [1506, 860]].map(([x, y]) => bolt(x, y)).join(''),
  ].join('\n');
  return { defs, body };
}

module.exports = {
  W, H, hole, radius, draw,
  meta: { name: 'Mecha HUD', theme: 'mecha', rarity: 'epic', translucent: false,
    desc: 'Cockpit bezel of a hero mecha: V-fin, tricolour armour and a live-looking tactical HUD.', tags: ['mecha', 'anime', 'hud', 'sci-fi', 'cockpit'] },
};
