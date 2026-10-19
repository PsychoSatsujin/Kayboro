'use strict';
// Starter "Sleek Portable": an asymmetric widescreen portable in soft pearl mint and lavender. A big
// round lavender lobe swells out of the left end and the body tapers through a slim waist into a
// rounded tail fin on the right. A pearl-white screen bezel with a lavender lip. In the lobe a flower
// pad of five petal keys around a mint gem, a little arc of three status lights and a pearl slider;
// on the tail fin a ribbed vertical scroll wheel, a small round key and a big moon button with a
// crescent inlay. Wavy speaker slot on the chin, lavender shoulder pads, and a die-cut ringed-planet
// sticker. Top-left key light, lilac rim light, anime crescent glare and round glints. Original
// artwork, no marks or logos.
const L = require('../lib');
const { rr, path, g, lg, rg, circle, ellipse, sparkle, star, n, P } = L;

const W = 1800, H = 870, CX = 900, CY = 436;
const INK = '#232046';
const hole = { x: 420, y: 156, w: 960, h: 540 }, radius = 10; // 16:9
const LOBE = [230, 440], FIN = [1600, 436]; // centres used for glare / shoulder placement
// Spline knots around the body (clockwise from the left end of the lobe).
const KNOTS = [[22, 440], [62, 228], [196, 70], [410, 18], [620, 60], [760, 82], [1100, 86], [1430, 88], [1620, 132], [1736, 254],
  [1784, 430], [1740, 606], [1620, 724], [1430, 784], [1100, 788], [760, 788], [620, 810], [410, 852], [196, 806], [62, 652]];
const PL = { x: 380, y: 116, w: 1040, h: 620, r: 34 }; // pearl screen bezel
const PAD = [212, 440], SLIDER = [212, 694], WHEEL = { x: 1548, y: 250, h: 210 }, MOON = [1596, 590], SMALL = [1672, 330];

// ---- outline helpers ----------------------------------------------------------------------------------
const r1 = (v) => Math.round(v * 10) / 10;
const pt = (p) => `${r1(p[0])} ${r1(p[1])}`;
/** Closed centripetal Catmull-Rom spline through the knots, as a dense point list. */
function spline(knots, dx = 0, dy = 0, seg = 28) {
  const N = knots.length, out = [];
  const tj = (a, b) => Math.pow(Math.hypot(b[0] - a[0], b[1] - a[1]), 0.5) || 1e-3;
  for (let i = 0; i < N; i++) {
    const p0 = knots[(i - 1 + N) % N], p1 = knots[i], p2 = knots[(i + 1) % N], p3 = knots[(i + 2) % N];
    const t1 = tj(p0, p1), t2 = t1 + tj(p1, p2), t3 = t2 + tj(p2, p3);
    for (let k = 0; k < seg; k++) {
      const t = t1 + ((t2 - t1) * k) / seg;
      const lerp = (a, b, ta, tb) => [0, 1].map((j) => ((tb - t) / (tb - ta)) * a[j] + ((t - ta) / (tb - ta)) * b[j]);
      const A1 = lerp(p0, p1, 0, t1), A2 = lerp(p1, p2, t1, t2), A3 = lerp(p2, p3, t2, t3);
      const B1 = lerp(A1, A2, 0, t2), B2 = lerp(A2, A3, t1, t3), C = lerp(B1, B2, t1, t2);
      out.push([C[0] + dx, C[1] + dy]);
    }
  }
  return out;
}
/** Evenly spaced closed polyline (by arc length). */
function resample(pts, step) {
  const N = pts.length, cum = [0];
  for (let i = 0; i < N; i++) { const a = pts[i], b = pts[(i + 1) % N]; cum.push(cum[i] + Math.hypot(b[0] - a[0], b[1] - a[1])); }
  const total = cum[N], count = Math.round(total / step), out = [];
  let j = 0;
  for (let i = 0; i < count; i++) {
    const t = (i * total) / count;
    while (cum[j + 1] < t) j++;
    const a = pts[j], b = pts[(j + 1) % N], f = (t - cum[j]) / (cum[j + 1] - cum[j] || 1);
    out.push([a[0] + (b[0] - a[0]) * f, a[1] + (b[1] - a[1]) * f]);
  }
  return out;
}
const outline = (step = 14, dx = 0, dy = 0) => resample(spline(KNOTS, dx, dy), step);
const normals = (pts) => pts.map((_, i) => {
  const a = pts[(i - 1 + pts.length) % pts.length], b = pts[(i + 1) % pts.length];
  const dx = b[0] - a[0], dy = b[1] - a[1], l = Math.hypot(dx, dy) || 1;
  return [dy / l, -dx / l];
});
const mid = (a, b) => [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2];
function closed(pts) {
  let d = `M${pt(mid(pts[pts.length - 1], pts[0]))}`;
  for (let i = 0; i < pts.length; i++) d += `Q${pt(pts[i])} ${pt(mid(pts[i], pts[(i + 1) % pts.length]))}`;
  return `${d}Z`;
}
function open(pts, lead = 'M') {
  let d = `${lead}${pt(pts[0])}`;
  for (let i = 1; i < pts.length - 1; i++) d += `Q${pt(pts[i])} ${pt(mid(pts[i], pts[i + 1]))}`;
  return `${d}L${pt(pts[pts.length - 1])}`;
}
/** Indices of outline points whose angle around c lies in [a0, a1] degrees (screen space), in order. */
function arcIdx(pts, a0, a1, c) {
  const ang = (p) => { let a = (Math.atan2(p[1] - c[1], p[0] - c[0]) * 180) / Math.PI; while (a < a0) a += 360; return a; };
  return pts.map((p, i) => [ang(p), i]).filter(([a]) => a <= a1).sort((x, y) => x[0] - y[0]).map(([, i]) => i);
}
/** Crescent hugging the outline: outer edge inset by `inset`, thickness swelling to `w` (sin^pow taper, peak at `skew`). */
function crescent(pts, nrm, idx, inset, w, pow = 1, skew = 0.5) {
  const outer = [], inner = [];
  idx.forEach((i, k) => {
    const u = k / (idx.length - 1), v = u < skew ? (u / skew) * 0.5 : 0.5 + ((u - skew) / (1 - skew)) * 0.5;
    const t = w * Math.pow(Math.sin(Math.PI * v), pow), [x, y] = pts[i], [nx, ny] = nrm[i];
    outer.push([x - nx * inset, y - ny * inset]);
    inner.push([x - nx * (inset + t), y - ny * (inset + t)]);
  });
  return `${open(outer)}${open(inner.reverse(), 'L')}Z`;
}
/** A part bulging out of the outline by up to h (flat topped), tucked `tuck` px under the body. */
function bump(pts, nrm, idx, h, tuck = 24, pow = 0.35) {
  const outer = [], inner = [];
  idx.forEach((i, k) => {
    const t = h * Math.pow(Math.sin((Math.PI * k) / (idx.length - 1)), pow), [x, y] = pts[i], [nx, ny] = nrm[i];
    outer.push([x + nx * t, y + ny * t]);
    inner.push([x - nx * tuck, y - ny * tuck]);
  });
  return `${open(outer)}${open(inner.reverse(), 'L')}Z`;
}
/** Crescent inside a circle: outer arc on radius r from angle a0 to a1 (deg), t thick at the middle. */
function moon(cx, cy, r, a0, a1, t) {
  const rad = (a) => (a * Math.PI) / 180, p = (a) => [cx + r * Math.cos(rad(a)), cy + r * Math.sin(rad(a))];
  const half = rad(a1 - a0) / 2, c = 2 * r * Math.sin(half), s1 = r - r * Math.cos(half), s2 = Math.max(0.5, s1 - t);
  const R = (c * c / 4 + s2 * s2) / (2 * s2);
  return `M${P(...p(a0))}A${P(r, r)} 0 0 1 ${P(...p(a1))}A${P(R, R)} 0 0 0 ${P(...p(a0))}Z`;
}
const polar = (c, r, a) => [c[0] + r * Math.cos((a * Math.PI) / 180), c[1] + r * Math.sin((a * Math.PI) / 180)];

// ---- parts -------------------------------------------------------------------------------------------
function shoulders(pts, nrm) {
  return [arcIdx(pts, 236, 268, LOBE), arcIdx(pts, 262, 292, FIN)].map((idx, k) =>
    path(bump(pts, nrm, idx, 22, 30), { fill: 'url(#slLav)', stroke: INK, strokeWidth: 6, strokeLinejoin: 'round' })
    + path(crescent(pts, nrm, idx.slice(4, -4), -14, 5, 1), { fill: '#fff', fillOpacity: k ? 0.6 : 0.95 })).join('');
}

function bezel() {
  const { x, y, w, h, r } = PL, holeD = rr(hole.x, hole.y, hole.w, hole.h, radius);
  return g({},
    path(rr(x + 5, y + 12, w, h, r), { fill: INK, fillOpacity: 0.3 }),
    path(rr(x, y, w, h, r), { fill: 'url(#slPearl)', stroke: INK, strokeWidth: 6 }),
    path(rr(x + 8, y + 8, w - 16, h - 16, r - 7), { fill: 'url(#slPearlSheen)' }),
    path(rr(hole.x - 22, hole.y - 22, hole.w + 44, hole.h + 44, radius + 16), { fill: 'url(#slLip)', stroke: INK, strokeOpacity: 0.6, strokeWidth: 3 }),
    path(rr(hole.x - 10, hole.y - 10, hole.w + 20, hole.h + 20, radius + 6), { fill: '#16142c', stroke: '#6a5aa8', strokeWidth: 2.5 }),
    [[7, 0.3], [3, 0.6]].map(([sw, a]) => path(holeD, { fill: 'none', stroke: '#000', strokeWidth: sw * 2, strokeOpacity: a })).join(''),
    // pearl highlights: key light along the top-left, lilac bounce bottom-right
    path(`M${x + 14} ${y + 220}V${y + r}Q${x + 14} ${y + 14} ${x + r} ${y + 14}H${x + 420}`, { fill: 'none', stroke: '#fff', strokeWidth: 6, strokeLinecap: 'round' }),
    path(`M${x + w - 14} ${y + h - r - 220}V${y + h - r}`, { stroke: '#d8c4ff', strokeWidth: 5, strokeLinecap: 'round' }),
    path(`M${x + w - 360} ${y + h - 14}H${x + w - r - 10}`, { stroke: '#b9a2ec', strokeOpacity: 0.8, strokeWidth: 4, strokeLinecap: 'round' }));
}

/** Petal key pointing outward along `deg` from the pad centre. */
function petal(c, deg) {
  const d = 'M42 0C42 -20 60 -34 84 -32C110 -30 120 -14 120 0C120 14 110 30 84 32C60 34 42 20 42 0Z';
  const T = `translate(${n(c[0])} ${n(c[1])}) rotate(${deg})`;
  return path(d, { fill: INK, fillOpacity: 0.32, transform: `translate(${n(c[0] + 4)} ${n(c[1] + 9)}) rotate(${deg})` })
    + g({ transform: T },
      path(d, { fill: 'url(#slPetal)', stroke: INK, strokeWidth: 5.5, strokeLinejoin: 'round' }),
      path('M56 -12Q66 -26 88 -24', { fill: 'none', stroke: '#fff', strokeWidth: 6, strokeLinecap: 'round' }),
      path(circle(104, 8, 3.5), { fill: '#fff', fillOpacity: 0.8 }));
}

/** Flower pad: five petal keys around a mint gem, in a lavender dish. */
function flowerPad() {
  const c = PAD;
  return g({},
    path(circle(c[0], c[1], 150), { fill: 'url(#slDish)' }),
    path(moon(c[0], c[1], 150, 20, 160, 5), { fill: '#fff', fillOpacity: 0.6 }),
    [-90, -18, 54, 126, 198].map((a) => petal(c, a)).join(''),
    path(circle(c[0] + 3, c[1] + 8, 36), { fill: INK, fillOpacity: 0.35 }),
    path(circle(c[0], c[1], 36), { fill: 'url(#slGem)', stroke: INK, strokeWidth: 5 }),
    path(star(c[0], c[1], 15, 6, 4, -90), { fill: '#fff', fillOpacity: 0.55 }),
    path(moon(c[0], c[1], 31, 196, 268, 8), { fill: '#fff', fillOpacity: 0.95 }));
}

function lights() {
  const cols = [['#7cf0c8', 'slGlowM'], ['#ffc4a8', 'slGlowP'], ['#c9a8ff', 'slGlowL']];
  return [-122, -90, -58].map((a, i) => {
    const [x, y] = polar(PAD, 196, a);
    return path(circle(x, y, 20), { fill: `url(#${cols[i][1]})`, class: i === 0 ? 'sl-led' : null })
      + path(circle(x, y, 8), { fill: cols[i][0], stroke: INK, strokeWidth: 3 })
      + path(circle(x - 2.5, y - 2.5, 2.4), { fill: '#fff' });
  }).join('');
}

function slider() {
  const [cx, cy] = SLIDER;
  return g({},
    path(rr(cx - 104, cy - 34, 208, 68, 34), { fill: 'url(#slDish)' }),
    path(rr(cx - 84, cy - 13, 168, 26, 13), { fill: '#3a3266', stroke: INK, strokeWidth: 4.5 }),
    path(circle(cx - 50, cy, 4) + circle(cx - 18, cy, 4), { fill: '#c9a8ff', fillOpacity: 0.75 }),
    path(rr(cx + 14 + 4, cy - 24 + 8, 64, 48, 20), { fill: INK, fillOpacity: 0.35 }),
    path(rr(cx + 14, cy - 24, 64, 48, 20), { fill: 'url(#slPearl)', stroke: INK, strokeWidth: 4.5 }),
    path(`M${cx + 36} ${cy - 10}V${cy + 10}M${cx + 46} ${cy - 10}V${cy + 10}M${cx + 56} ${cy - 10}V${cy + 10}`, { stroke: '#9a88d0', strokeWidth: 3, strokeLinecap: 'round' }),
    path(`M${cx + 24} ${cy - 15}H${cx + 52}`, { stroke: '#fff', strokeWidth: 4, strokeLinecap: 'round' }));
}

/** Vertical scroll wheel: a ribbed drum in a slot, ribs bunching toward the ends. */
function wheel() {
  const { x, y, h } = WHEEL, ribs = [];
  for (let i = 1; i < 14; i++) { const yy = y + 14 + (h - 28) * (0.5 - 0.5 * Math.cos((Math.PI * i) / 14)); ribs.push(`M${x - 17} ${n(yy)}H${x + 17}`); }
  return g({},
    path(rr(x - 46, y - 26, 92, h + 52, 46), { fill: 'url(#slDish)' }),
    path(rr(x - 30, y - 8, 60, h + 16, 30), { fill: '#2a2450', stroke: INK, strokeWidth: 5 }),
    path(rr(x - 22, y, 44, h, 22), { fill: 'url(#slDrum)', stroke: INK, strokeWidth: 4 }),
    path(ribs.join(''), { stroke: '#5a4a9a', strokeOpacity: 0.55, strokeWidth: 3, strokeLinecap: 'round' }),
    path(`M${x - 10} ${y + 30}V${y + h * 0.45}`, { stroke: '#fff', strokeWidth: 4.5, strokeLinecap: 'round' }));
}

function roundKey([cx, cy], r, fill) {
  return path(circle(cx, cy, r + 16), { fill: 'url(#slDish)' })
    + path(circle(cx + 3, cy + 8, r), { fill: INK, fillOpacity: 0.35 })
    + path(circle(cx, cy, r), { fill, stroke: INK, strokeWidth: 5 })
    + path(moon(cx, cy, r * 0.82, 196, 270, r * 0.22), { fill: '#fff', fillOpacity: 0.95 })
    + path(circle(cx + r * 0.42, cy + r * 0.4, r * 0.09), { fill: '#fff', fillOpacity: 0.8 });
}

/** Big moon button: lavender dome with a mint crescent inlay. */
function moonButton() {
  const [cx, cy] = MOON;
  return g({},
    roundKey(MOON, 56, 'url(#slLavR)'),
    path(`M${cx + 6} ${cy - 30}A30 30 0 1 0 ${cx + 30} ${cy + 12}A24 24 0 1 1 ${cx + 6} ${cy - 30}Z`, { fill: 'url(#slGem)', stroke: INK, strokeOpacity: 0.6, strokeWidth: 2.5 }),
    path(star(cx + 22, cy - 18, 7, 3), { fill: '#fff', fillOpacity: 0.9 }));
}

function speaker() {
  let d = 'M760 762';
  for (let i = 0; i < 8; i++) d += `Q${775 + i * 30} ${i % 2 ? 772 : 752} ${790 + i * 30} 762`;
  const d2 = d.replace(/^M760 762/, 'M760 762').replace(/(\d+) (\d+)/g, (m, a, b) => `${+a + 300} ${b}`);
  return [d, d2].map((s) => path(s, { fill: 'none', stroke: '#fff', strokeOpacity: 0.55, strokeWidth: 7, strokeLinecap: 'round', transform: 'translate(1.5 3)' })
    + path(s, { fill: 'none', stroke: INK, strokeOpacity: 0.6, strokeWidth: 6, strokeLinecap: 'round' })).join('');
}

/** Die-cut sticker: a little ringed planet with a sleepy face. */
function sticker(cx, cy, deg) {
  const ring = ellipse(0, 4, 46, 13);
  return g({ transform: `translate(${cx} ${cy}) rotate(${deg})` },
    path(circle(0, 0, 26) + ring, { fill: INK, fillOpacity: 0.3, stroke: INK, strokeOpacity: 0.3, strokeWidth: 16, transform: 'translate(3 5)' }),
    path(circle(0, 0, 26) + ring, { fill: '#fff', stroke: '#fff', strokeWidth: 14 }),
    path(ring, { fill: 'none', stroke: '#c9a8ff', strokeWidth: 6 }),
    path(circle(0, 0, 26), { fill: 'url(#slPlanet)', stroke: '#8a6ad0', strokeWidth: 2 }),
    path('M-30 6A46 13 0 0 0 30 13', { fill: 'none', stroke: '#c9a8ff', strokeWidth: 6, strokeLinecap: 'round' }),
    path('M-12 -2Q-8 2 -4 -2M4 -2Q8 2 12 -2', { fill: 'none', stroke: '#3a3266', strokeWidth: 2.8, strokeLinecap: 'round' }),
    path(ellipse(-14, 6, 4, 2.5) + ellipse(14, 6, 4, 2.5), { fill: '#ff9ec7', fillOpacity: 0.8 }),
    path('M-18 -14Q-12 -21 -3 -22', { fill: 'none', stroke: '#fff', strokeWidth: 4, strokeLinecap: 'round' }));
}

// ---- draw --------------------------------------------------------------------------------------------
function draw() {
  const pts = outline(), nrm = normals(pts), BODY = closed(pts);
  const SIDE = closed(outline(14, 7, 13));
  const defs = [
    lg('slBody', [0, 0, 1, 1], [[0, '#f0fff9'], [0.14, '#bdf5e2'], [0.5, '#88e2c6'], [0.85, '#5bc2a7'], [1, '#41a68d']]),
    lg('slLobe', [0, 0, 1, 1], [[0, '#f8f2ff'], [0.2, '#dccbfc'], [0.6, '#b49bee'], [1, '#8a6cd0']]),
    lg('slSide', [0, 0, 1, 1], [[0, '#4a9c8a'], [1, '#2a5a62']]),
    lg('slShade', [0, 0, 0, 1], [[0, '#fff', 0.3], [0.1, '#fff', 0.04], [0.55, '#fff', 0], [0.82, '#2a1f5a', 0.1], [1, '#2a1f5a', 0.3]]),
    lg('slRim', [22, 26, 1784, 846], [[0, '#f0d0ff', 0], [0.7, '#f0d0ff', 0], [0.9, '#f0d0ff', 0.8], [1, '#fff0ff', 1]], true),
    lg('slKey', [22, 26, 1784, 846], [[0, '#fff', 0.9], [0.22, '#fff', 0.3], [0.36, '#fff', 0]], true),
    lg('slSheen', [0, 0, 1, 0], [[0, '#fff', 0.85], [1, '#fff', 0.1]]),
    lg('slLav', [0, 0, 0, 1], [[0, '#f6eeff'], [0.45, '#c9b0f8'], [1, '#8e70d4']]),
    rg('slLavR', [0.38, 0.3, 0.85], [[0, '#faf4ff'], [0.45, '#c9b0f8'], [1, '#8466cc']]),
    rg('slPetal', [0.3, 0.4, 0.9], [[0, '#ffffff'], [0.45, '#e6d8ff'], [1, '#a88ae6']]),
    rg('slGem', [0.38, 0.3, 0.85], [[0, '#f0fff9'], [0.45, '#7ee8c8'], [1, '#2a9e84']]),
    lg('slPearl', [0, 0, 1, 1], [[0, '#ffffff'], [0.4, '#f4f0ff'], [1, '#d6cdf2']]),
    lg('slPearlSheen', [0, 0, 1, 1], [[0.2, '#fff', 0], [0.45, '#ffe6f6', 0.5], [0.6, '#e0fff4', 0.4], [0.85, '#fff', 0]]),
    lg('slLip', [0, 0, 0, 1], [[0, '#b8a2ee'], [1, '#8a70d0']]),
    rg('slDish', [0.5, 0.62, 0.6], [[0, '#2a1f5a', 0.04], [0.75, '#2a1f5a', 0.12], [1, '#2a1f5a', 0.24]]),
    lg('slDrum', [0, 0, 1, 0], [[0, '#8e70d4'], [0.45, '#e6d8ff'], [1, '#a88ae6']]),
    rg('slGlowM', [0.5, 0.5, 0.5], [[0, '#7cf0c8', 0.7], [1, '#7cf0c8', 0]]),
    rg('slGlowP', [0.5, 0.5, 0.5], [[0, '#ffc4a8', 0.6], [1, '#ffc4a8', 0]]),
    rg('slGlowL', [0.5, 0.5, 0.5], [[0, '#c9a8ff', 0.6], [1, '#c9a8ff', 0]]),
    rg('slPlanet', [0.38, 0.32, 0.8], [[0, '#f0fff9'], [0.5, '#9eecd2'], [1, '#4fbf9f']]),
    rg('slFloor', [0.5, 0.5, 0.5], [[0, INK, 0.32], [1, INK, 0]]),
    `<clipPath id="slBodyClip"><path d="${BODY}"/></clipPath>`,
    '<style>.sl-led{animation:sl-led 3s ease-in-out infinite}.sl-tw{animation:sl-tw 3.4s ease-in-out infinite}.sl-tw2{animation:sl-tw 3.4s ease-in-out 1.7s infinite}'
      + '@keyframes sl-led{0%,100%{opacity:1}50%{opacity:.4}}@keyframes sl-tw{0%,100%{opacity:1}50%{opacity:.35}}'
      + '@media (prefers-reduced-motion:reduce){*{animation:none!important}}</style>',
  ].join('');

  const cut = (idx, a, b) => idx.slice(Math.round(idx.length * a), Math.round(idx.length * b));
  const left = arcIdx(pts, 140, 250, LOBE);
  const body = [
    path(ellipse(CX + 20, 846, 860, 22), { fill: 'url(#slFloor)' }),
    shoulders(pts, nrm),
    path(SIDE, { fill: 'url(#slSide)', stroke: INK, strokeWidth: 8 }),
    path(BODY, { fill: 'url(#slBody)', stroke: INK, strokeWidth: 8 }),
    g({ clipPath: 'url(#slBodyClip)' },
      // the lavender lobe, with a seam where it meets the mint body
      path('M0 0H560C470 220 470 650 560 870H0Z', { fill: 'url(#slLobe)' }),
      path('M560 0C470 220 470 650 560 870', { fill: 'none', stroke: INK, strokeOpacity: 0.45, strokeWidth: 4 }),
      path('M566 0C476 220 476 650 566 870', { fill: 'none', stroke: '#fff', strokeOpacity: 0.6, strokeWidth: 3 }),
      path(BODY, { fill: 'url(#slShade)' }),
      path(BODY, { fill: 'none', stroke: 'url(#slRim)', strokeWidth: 12 }),
      path(BODY, { fill: 'none', stroke: 'url(#slKey)', strokeWidth: 8 }),
      // anime glare on the lobe: soft sheen, sharp crescent, thin echo; lilac rim around the tail fin
      path(crescent(pts, nrm, left, 12, 74, 1.3, 0.6), { fill: 'url(#slSheen)', fillOpacity: 0.45 }),
      path(crescent(pts, nrm, cut(left, 0.06, 0.94), 18, 24, 0.85, 0.6), { fill: '#fff', fillOpacity: 0.95 }),
      path(crescent(pts, nrm, cut(left, 0.3, 0.8), 52, 6, 1, 0.6), { fill: '#fff', fillOpacity: 0.8 }),
      path(crescent(pts, nrm, arcIdx(pts, 254, 290, LOBE), 14, 9, 1), { fill: '#fff', fillOpacity: 0.85 }),
      path(crescent(pts, nrm, arcIdx(pts, -50, 50, FIN), 12, 18, 0.9), { fill: '#fff0ff', fillOpacity: 0.9 }),
      path(crescent(pts, nrm, arcIdx(pts, -20, 25, FIN), 40, 5, 1), { fill: '#fff', fillOpacity: 0.6 }),
      path(crescent(pts, nrm, arcIdx(pts, 70, 110, [1100, 300]), 10, 8, 1), { fill: '#f0d0ff', fillOpacity: 0.5 })),
    bezel(),
    flowerPad(),
    lights(),
    slider(),
    wheel(),
    roundKey(SMALL, 26, 'url(#slGem)'),
    moonButton(),
    speaker(),
    sticker(470, 792, -12),
    // round glints
    path(circle(300, 92, 8.5), { fill: '#fff' }),
    path(circle(323, 89, 4.5), { fill: '#fff', fillOpacity: 0.85 }),
    path(circle(50, 560, 5.5), { fill: '#fff', fillOpacity: 0.85 }),
    // sparkles around
    path(sparkle(40, 50, 24), { fill: '#e6d8ff', stroke: INK, strokeWidth: 3, class: 'sl-tw' }),
    path(sparkle(1750, 70, 20), { fill: '#c9fff0', stroke: INK, strokeWidth: 3, class: 'sl-tw2' }),
    path(sparkle(1764, 800, 15), { fill: '#ffd0e4', stroke: INK, strokeWidth: 3 }),
    path(star(36, 820, 13, 5.5), { fill: '#ffe372', stroke: INK, strokeWidth: 3, strokeLinejoin: 'round' }),
    path(circle(700, 24, 4) + circle(1240, 40, 3.5) + circle(1786, 200, 4) + circle(1300, 840, 3.5), { fill: '#fff', fillOpacity: 0.8 }),
  ].join('\n');
  return { defs, body };
}

module.exports = {
  W, H, hole, radius, draw,
  meta: { name: 'Sleek Portable', theme: 'classic', translucent: false,
    desc: 'A pearly mint widescreen portable with a lavender lobe, a five-petal flower pad, a scroll wheel and a moon button.',
    tags: ['starter', 'handheld', 'console', 'glossy', 'widescreen'] },
};
