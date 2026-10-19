'use strict';
// Mecha cockpit canopy: the screen is the canopy glass, held in a plain dark inner bezel. Around it bolted
// armour pieces with dark seams: four diagonal canopy struts (the lower pair painted with warning stripes),
// tricolour top armour with chevrons, a crest housing with a compass ribbon under a gold V-fin, side
// consoles with louvred vents, a dial, a radar, segmented bar gauges and glowing panel lights, a dash with
// meters and toggles, and chrome hydraulic pistons along the outer flanks. Busy detail stays on the outer
// pieces; the ring hugging the picture is calm gunmetal with dim corner brackets.
const L = require('../lib');
const { rr, path, g, lg, rg, circle, chamfer, poly, glowStroke, rng, lip, n } = L;

const W = 1800, H = 1160, CX = W / 2, hole = { x: 260, y: 196, w: 1280, h: 720 }, radius = 0;
const CYAN = '#4ff0ff', ORANGE = '#ff8a2a', GREEN = '#6eff8a', RED = '#ff3b3b', INK = '#07090d';
const IB = { x: hole.x - 30, y: hole.y - 30, w: hole.w + 60, h: hole.h + 60 }; // inner bezel
const mirror = (pts) => pts.map(([x, y]) => [W - x, y]);

// Pieces, left half (mirrored for the right). The base silhouette shows through the gaps as seams.
// Left halves are chains from the top of the centre line round the left side to its bottom; symC() closes them.
const OUT = [[756, 22], [720, 60], [250, 60], [104, 150], [64, 330], [64, 770], [104, 960], [240, 1104]];
const STRUT_T = [[218, 206], [266, 158], [252, 66], [112, 160]];
const STRUT_B = [[218, 908], [266, 956], [254, 1098], [112, 958]];
const TOP = [[274, 66], [700, 66], [718, 84], [718, 158], [282, 158]];
const SIDE = [[72, 334], [114, 176], [210, 214], [210, 900], [114, 940], [72, 766]];
const DASH = [[284, 956], [274, 1098]];
const CREST = [[762, 28], [1038, 28], [1066, 58], [1066, 158], [734, 158], [734, 58]];

const symC = (chain) => [...chain.slice().reverse(), ...mirror(chain)];

const bolt = (x, y, r = 8) => path(circle(x, y, r), { fill: 'url(#bolt)', stroke: INK, strokeWidth: 2 })
  + path(`M${n(x - r * 0.55)} ${n(y - r * 0.2)}L${n(x + r * 0.55)} ${n(y + r * 0.2)}`, { stroke: INK, strokeOpacity: 0.7, strokeWidth: 2 });

function plate(pts, fill, { hi = true } = {}) {
  const d = poly(pts);
  return path(d, { fill, stroke: INK, strokeWidth: 3, strokeLinejoin: 'round' })
    + (hi ? path(`M${L.P(...pts[0])}L${L.P(...pts[1])}`, { stroke: '#fff', strokeOpacity: 0.35, strokeWidth: 2, transform: 'translate(0 3)' }) : '');
}

/** Warning stripes clipped to a polygon (clip id must be unique). */
function hazard(id, pts, step = 30) {
  const bb = pts.reduce((b, [x, y]) => [Math.min(b[0], x), Math.min(b[1], y), Math.max(b[2], x), Math.max(b[3], y)], [Infinity, Infinity, -Infinity, -Infinity]);
  const st = [];
  for (let x = bb[0] - (bb[3] - bb[1]); x < bb[2]; x += step) st.push(`M${n(x)} ${bb[3]}L${n(x + (bb[3] - bb[1]))} ${bb[1]}h${step / 2}L${n(x + step / 2)} ${bb[3]}Z`);
  return `<clipPath id="${id}"><path d="${poly(pts)}"/></clipPath>`
    + path(poly(pts), { fill: 'url(#hazard)' })
    + g({ clipPath: `url(#${id})` }, path(st.join(''), { fill: '#16130c' }))
    + path(poly(pts), { fill: 'none', stroke: INK, strokeWidth: 2.5 });
}

function vents(x, y, w, count, dir = 1) {
  const slots = Array.from({ length: count }, (_, i) => `M${x} ${y + i * 16}h${w}l${-dir * 10} 9h${-w}Z`).join('');
  return path(rr(x - 16, y - 12, w + 30, count * 16 + 14, 6), { fill: '#151920', stroke: INK, strokeWidth: 2 })
    + path(slots, { fill: '#050608' })
    + path(Array.from({ length: count }, (_, i) => `M${x - dir * 2} ${y + i * 16 + 10}h${w - 8}`).join(''), { stroke: '#8c96aa', strokeOpacity: 0.35, strokeWidth: 1.5 });
}

function gauge(cx, cy, r, val) {
  const arc = [], a0 = Math.PI * 0.8, a1 = Math.PI * 2.2;
  for (let i = 0; i <= 14; i++) {
    const a = a0 + (a1 - a0) * (i / 14), r1 = r - 6, r2 = r - (i % 7 === 0 ? 20 : 13);
    arc.push(`M${n(cx + r1 * Math.cos(a))} ${n(cy + r1 * Math.sin(a))}L${n(cx + r2 * Math.cos(a))} ${n(cy + r2 * Math.sin(a))}`);
  }
  const na = a0 + (a1 - a0) * val, rr8 = r - 8;
  return path(circle(cx, cy, r + 9), { fill: 'url(#plate)', stroke: INK, strokeWidth: 3 })
    + path(circle(cx, cy, r), { fill: '#0a0c12', stroke: '#3a4150', strokeWidth: 2 })
    + path(arc.join(''), { stroke: CYAN, strokeOpacity: 0.85, strokeWidth: 2.5, strokeLinecap: 'round' })
    + path(`M${n(cx + rr8 * Math.cos(a1 - 0.5))} ${n(cy + rr8 * Math.sin(a1 - 0.5))}A${rr8} ${rr8} 0 0 1 ${n(cx + rr8 * Math.cos(a1))} ${n(cy + rr8 * Math.sin(a1))}`, { fill: 'none', stroke: '#ff4d4d', strokeWidth: 5 })
    + glowStroke(`M${cx} ${cy}L${n(cx + (r - 14) * Math.cos(na))} ${n(cy + (r - 14) * Math.sin(na))}`, ORANGE, 4, [[3, 0.2], [1, 1]])
    + path(circle(cx, cy, 8), { fill: 'url(#bolt)', stroke: INK, strokeWidth: 2 });
}

function radar(cx, cy, r) {
  const sweep = `M${cx} ${cy}L${cx + r} ${cy}A${r} ${r} 0 0 0 ${n(cx + r * Math.cos(-0.9))} ${n(cy + r * Math.sin(-0.9))}Z`;
  return path(circle(cx, cy, r + 9), { fill: 'url(#plate)', stroke: INK, strokeWidth: 3 })
    + path(circle(cx, cy, r), { fill: '#04161b', stroke: CYAN, strokeOpacity: 0.6, strokeWidth: 2 })
    + path(`${circle(cx, cy, r * 0.66)}${circle(cx, cy, r * 0.33)}M${cx - r} ${cy}H${cx + r}M${cx} ${cy - r}V${cy + r}`, { fill: 'none', stroke: CYAN, strokeOpacity: 0.3, strokeWidth: 1.5 })
    + path(sweep, { fill: 'url(#sweep)' })
    + path(circle(cx + r * 0.4, cy - r * 0.3, 4), { fill: ORANGE }) + path(circle(cx - r * 0.5, cy + r * 0.2, 3.5), { fill: CYAN });
}

/** Vertical segmented bar gauge: n cells, the lowest `on` lit. */
function bar(x, y, w, h, cells, on, color) {
  const ch = h / cells, out = [path(rr(x - 5, y - 5, w + 10, h + 10, 4), { fill: '#06080c', stroke: '#3a4150', strokeWidth: 2 })];
  for (let i = 0; i < cells; i++) {
    const lit = i < on, c = i >= cells - 2 ? RED : color;
    out.push(path(`M${x} ${n(y + h - (i + 1) * ch + 2)}h${w}v${n(ch - 4)}h${-w}Z`, { fill: lit ? c : '#1d2430', fillOpacity: lit ? 0.85 : 1 }));
  }
  return out.join('');
}

/** Grid of square panel lights with a soft halo; pattern chars: c cyan, o orange, g green, r red, . off. */
function lights(x, y, rows, s = 12, gap = 8) {
  const col = { c: CYAN, o: ORANGE, g: GREEN, r: RED }, glow = [], lit = [], off = [];
  rows.forEach((row, j) => [...row].forEach((ch, i) => {
    const px = x + i * (s + gap), py = y + j * (s + gap), d = rr(px, py, s, s, 3);
    if (col[ch]) { lit.push(path(d, { fill: col[ch] })); glow.push(path(circle(px + s / 2, py + s / 2, s * 1.3), { fill: `url(#halo-${ch})` })); }
    else off.push(d);
  }));
  const w = rows[0].length * (s + gap) - gap, h = rows.length * (s + gap) - gap;
  return path(rr(x - 8, y - 8, w + 16, h + 16, 5), { fill: '#090b10', stroke: '#3a4150', strokeWidth: 2 })
    + path(off.join(''), { fill: '#1d2430' }) + glow.join('') + lit.join('');
}

function tape(x, y0, y1, dir) {
  const ticks = [];
  for (let y = y0, i = 0; y <= y1; y += 18, i++) ticks.push(`M${x} ${y}h${dir * (i % 5 ? 7 : 14)}`);
  return path(ticks.join(''), { stroke: CYAN, strokeOpacity: 0.55, strokeWidth: 2.5 }) + path(`M${x + dir * 2} ${(y0 + y1) / 2}l${dir * 16} -8v16Z`, { fill: ORANGE, fillOpacity: 0.9 });
}

function compass() {
  const t = [];
  for (let x = 790, i = 0; x <= 1010; x += 22, i++) t.push(`M${x} ${i % 4 ? 100 : 92}V112`);
  return path(chamfer(772, 84, 256, 40, 8), { fill: '#04161b', stroke: '#3a4150', strokeWidth: 2 })
    + path(t.join(''), { stroke: CYAN, strokeOpacity: 0.7, strokeWidth: 2.5 }) + path(`M${CX} 96l-8 -10h16Z`, { fill: ORANGE });
}

function chevrons(x, y, dir) {
  return [0, 1, 2].map((i) => path(`M${x + dir * i * 26} ${y}l${dir * 16} 12l${-dir * 16} 12h${dir * 11}l${dir * 16} -12l${-dir * 16} -12Z`, { fill: ORANGE, fillOpacity: 1 - i * 0.25 })).join('');
}

function glyphs(x, y, dir, rows, seed) {
  const rnd = rng(seed), out = [];
  for (let r = 0; r < rows; r++) {
    let cx = x;
    for (let k = 0; k < 3; k++) { const w = 8 + Math.floor(rnd() * 22); out.push(`M${dir > 0 ? cx : cx - w} ${y + r * 14}h${w}v6h${-w}Z`); cx += dir * (w + 6); }
  }
  return path(out.join(''), { fill: CYAN, fillOpacity: 0.45 });
}

/** Hydraulic piston on the outer flank: dark cylinder, bright rod, eye mounts bolted to the frame. */
function piston(x, y0, y1, dir = 1) {
  const mid = y0 + (y1 - y0) * 0.55;
  return [y0, y1].map((y) => path(poly([[x, y - 26], [x + dir * 44, y - 18], [x + dir * 44, y + 18], [x, y + 26]]), { fill: 'url(#plate)', stroke: INK, strokeWidth: 3 })).join('')
    + path(rr(x - 7, mid - 10, 14, y1 - mid + 4, 4), { fill: 'url(#rod)', stroke: INK, strokeWidth: 2.5 })
    + path(rr(x - 14, y0 + 6, 28, mid - y0, 8), { fill: 'url(#cyl)', stroke: INK, strokeWidth: 3 })
    + path(`M${x - 14} ${n(mid - 18)}h28M${x - 14} ${y0 + 34}h28`, { stroke: INK, strokeOpacity: 0.7, strokeWidth: 2 })
    + path(circle(x, y0, 15) + circle(x, y1, 15), { fill: 'url(#plate)', stroke: INK, strokeWidth: 3 })
    + bolt(x, y0, 7) + bolt(x, y1, 7);
}

function draw() {
  const holeD = rr(hole.x, hole.y, hole.w, hole.h, radius);
  const halo = (k, c) => rg(`halo-${k}`, [0.5, 0.5, 0.5], [[0, c, 0.45], [1, c, 0]]);
  const defs = [
    lg('metal', [0, 0, 0, 1], [[0, '#3e4555'], [0.5, '#232833'], [1, '#14171e']]),
    lg('plate', [0, 0, 0, 1], [[0, '#5e687b'], [1, '#2a303b']]),
    lg('strut', [0, 0, 1, 1], [[0, '#6c7689'], [0.5, '#434b5a'], [1, '#2a303b']]),
    lg('console', [0, 0, 0, 1], [[0, '#343b49'], [1, '#1f242d']]),
    lg('inner', [0, 0, 0, 1], [[0, '#0d1016'], [1, '#151920']]),
    lg('armor', [0, 0, 0, 1], [[0, '#ffffff'], [0.55, '#dfe4ed'], [1, '#98a2b6']]),
    lg('vfin', [0, 0, 1, 0], [[0, '#ffe680'], [0.5, '#ffc21a'], [1, '#b87d00']]),
    lg('hazard', [0, 0, 1, 1], [[0, '#ffcc00'], [1, '#d99e00']]),
    lg('cyl', [0, 0, 1, 0], [[0, '#2a303b'], [0.35, '#6c7689'], [0.6, '#3a4150'], [1, '#14171e']]),
    lg('rod', [0, 0, 1, 0], [[0, '#8c96aa'], [0.35, '#ffffff'], [0.6, '#c9d0de'], [1, '#5a6375']]),
    rg('bolt', [0.35, 0.3, 0.8], [[0, '#c9d0de'], [1, '#3a4150']]),
    rg('sensor', [0.4, 0.35, 0.7], [[0, '#ffd1d1'], [0.4, '#ff3b3b'], [1, '#7a0000']]),
    rg('sweep', [0, 0.5, 1], [[0, CYAN, 0.05], [1, CYAN, 0.5]]),
    rg('floor', [0.5, 0.5, 0.5], [[0, '#000', 0.45], [1, '#000', 0]]),
    halo('c', CYAN), halo('o', ORANGE), halo('g', GREEN), halo('r', RED),
  ].join('');

  const out = symC(OUT);
  const both = (pts, fn) => fn(pts, 'l') + fn(mirror(pts), 'r');
  const brackets = [[-1, -1], [1, -1], [-1, 1], [1, 1]].map(([sx, sy]) => {
    const x = sx < 0 ? hole.x - 14 : hole.x + hole.w + 14, y = sy < 0 ? hole.y - 14 : hole.y + hole.h + 14;
    return `M${x} ${y - sy * 54}V${y}H${x - sx * 54}`;
  }).join('');

  const body = [
    path(L.ellipse(CX, 1112, 820, 22), { fill: 'url(#floor)' }),
    // pistons sit behind the armour on the outer flanks
    piston(40, 300, 820, 1), piston(W - 40, 300, 820, -1),
    // base silhouette (shows through as seams)
    path(poly(out), { fill: '#0b0d12', stroke: INK, strokeWidth: 4, strokeLinejoin: 'round' }),
    path(poly(out), { fill: 'none', stroke: CYAN, strokeOpacity: 0.22, strokeWidth: 2 }),
    // corner struts, top armour, side consoles, dash, crest housing
    both(STRUT_T, (p) => plate(p, 'url(#strut)')),
    both(STRUT_B, (p, s) => { const lerp = (a, b, t) => [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t];
      return plate(p, 'url(#strut)') + hazard(`hz-${s}`, [lerp(p[0], p[3], 0.42), lerp(p[1], p[2], 0.42), lerp(p[1], p[2], 0.9), lerp(p[0], p[3], 0.9)], 26); }),
    both(TOP, (p) => plate(p, 'url(#armor)')),
    both(SIDE, (p) => plate(p, 'url(#console)')),
    plate(symC(DASH), 'url(#console)'),
    plate(CREST, 'url(#plate)'),
    // tricolour stripes, chevrons and panel lines on the top armour
    path(poly([[294, 74], [690, 74], [700, 84], [304, 84]]), { fill: '#e8332f' }),
    path(poly(mirror([[294, 74], [690, 74], [700, 84], [304, 84]])), { fill: '#2f62e8' }),
    path(`M330 120H560L580 140H690M${W - 330} 120H${W - 560}L${W - 580} 140H${W - 690}`, { fill: 'none', stroke: INK, strokeOpacity: 0.35, strokeWidth: 2.5 }),
    chevrons(596, 98, 1), chevrons(W - 596, 98, -1),
    lights(330, 96, ['cog'], 10, 8), lights(W - 384, 96, ['goc'], 10, 8),
    compass(),
    // V-fin + sensor crest
    path(`M${CX} 72L${CX - 236} 6H${CX - 200}L${CX} 46L${CX + 200} 6H${CX + 236}Z`, { fill: '#000', fillOpacity: 0.35, transform: 'translate(3 5)' }),
    path(`M${CX} 72L${CX - 236} 6H${CX - 200}L${CX} 46L${CX + 200} 6H${CX + 236}Z`, { fill: 'url(#vfin)', stroke: '#6b4800', strokeWidth: 3, strokeLinejoin: 'round' }),
    path(`M${CX - 10} 50L${CX - 196} 10M${CX + 10} 50L${CX + 196} 10`, { stroke: '#fff7cc', strokeOpacity: 0.75, strokeWidth: 3, strokeLinecap: 'round' }),
    path(`M${CX - 24} 30H${CX + 24}L${CX + 36} 50L${CX} 74L${CX - 36} 50Z`, { fill: '#e4e8f0', stroke: INK, strokeWidth: 3, strokeLinejoin: 'round' }),
    path(`M${CX - 13} 38H${CX + 13}L${CX + 20} 50L${CX} 64L${CX - 20} 50Z`, { fill: 'url(#sensor)', stroke: INK, strokeWidth: 2 }),
    path(circle(CX, 50, 22), { fill: RED, fillOpacity: 0.14 }),
    // side consoles: vents, dial / radar, bar gauges, tape, panel lights
    vents(104, 256, 70, 5, 1), vents(W - 174, 256, 70, 5, -1),
    gauge(136, 420, 44, 0.62), radar(W - 136, 420, 44),
    bar(96, 506, 16, 200, 10, 6, CYAN), bar(126, 506, 16, 200, 10, 8, CYAN), bar(156, 506, 16, 200, 10, 4, ORANGE),
    bar(W - 112, 506, 16, 200, 10, 7, CYAN), bar(W - 142, 506, 16, 200, 10, 5, CYAN), bar(W - 172, 506, 16, 200, 10, 3, ORANGE),
    lights(98, 750, ['cgo', 'g.c', 'oc.'], 12, 10), lights(W - 162, 750, ['ocg', 'c.g', '.co'], 12, 10),
    glyphs(96, 852, 1, 3, 11), glyphs(W - 96, 852, -1, 3, 23),
    tape(204, 300, 840, -1), tape(W - 204, 300, 840, 1),
    // dash: radar, meters, toggles, gauge, warning stripes along the bottom edge
    radar(400, 1014, 44), gauge(W - 400, 1014, 44, 0.4),
    (() => {
      const rows = [[0.8, CYAN], [0.55, CYAN], [0.35, ORANGE]], m = [];
      rows.forEach(([v, c], r) => { for (let i = 0; i < 22; i++) { const on = i / 22 < v; m.push(path(`M${686 + i * 19} ${988 + r * 24}h14v15h-14Z`, { fill: on ? c : '#1d2430', fillOpacity: on ? 0.85 - i * 0.012 : 1 })); } });
      return path(chamfer(668, 974, 450, 88, 12), { fill: '#06080c', stroke: '#3a4150', strokeWidth: 2 }) + m.join('');
    })(),
    [500, 532, 564, W - 586, W - 554, W - 522].map((x, i) => path(rr(x, 986, 22, 62, 6), { fill: '#0a0c12', stroke: '#3a4150', strokeWidth: 2 })
      + path(rr(x + 3, i % 3 === 1 ? 1016 : 990, 16, 28, 4), { fill: i % 3 === 1 ? ORANGE : '#8c96aa' })).join(''),
    hazard('hz-dash', [[300, 1070], [W - 300, 1070], [W - 296, 1092], [296, 1092]], 30),
    // calm inner bezel: plain gunmetal, a soft lip and dim corner brackets
    path(chamfer(IB.x, IB.y, IB.w, IB.h, 30), { fill: 'url(#inner)', stroke: '#2e3542', strokeWidth: 3 }),
    path(chamfer(IB.x + 8, IB.y + 8, IB.w - 16, IB.h - 16, 24), { fill: 'none', stroke: '#000', strokeOpacity: 0.35, strokeWidth: 2 }),
    lip(holeD, '#000', [[8, 0.3], [3, 0.6]]),
    path(brackets, { fill: 'none', stroke: CYAN, strokeOpacity: 0.45, strokeWidth: 4, strokeLinecap: 'square' }),
    // bolts on every piece
    [[286, 78], [688, 146], [W - 286, 78], [W - 688, 146], [134, 168], [W - 134, 168], [134, 952], [W - 134, 952], [222, 1084], [W - 222, 1084],
      [86, 350], [86, 750], [W - 86, 350], [W - 86, 750], [748, 72], [W - 748, 72], [748, 146], [W - 748, 146], [300, 970], [W - 300, 970]].map(([x, y]) => bolt(x, y)).join(''),
  ].join('\n');
  return { defs, body };
}

module.exports = {
  W, H, hole, radius, draw,
  meta: { name: 'Mecha HUD', theme: 'mecha', rarity: 'epic', translucent: false,
    desc: 'Cockpit canopy of a hero mecha: bolted tricolour armour, hydraulic struts, a gold V-fin and a live-looking HUD.', tags: ['mecha', 'anime', 'hud', 'sci-fi', 'cockpit'] },
};
