'use strict';
// Starter "Wide Pocket": a landscape pocket console with a faceted, chamfered-octagon body in glossy
// lagoon teal with mustard trim and a small keel under the chin. An octagonal navy screen plate echoes
// the body. On the left a big round jog dial (knurled mustard bezel, teal disc with a thumb dimple)
// above a mustard slider switch; on the right a crescent arc of three petal keys curling around a
// small hub button, a pair of round menu pips and a radial sunburst speaker. A ribbed scroll wheel
// peeks out of the right edge, mustard shoulder keys sit on the top edge, and a die-cut cloud-and-sun
// sticker rides on the chin. Top-left key light, warm mustard rim light, anime crescent glare and
// round glints. Original artwork, no marks or logos.
const L = require('../lib');
const { rr, path, g, lg, rg, circle, ellipse, sparkle, star, poly, n, P } = L;

const W = 1500, H = 960, CX = 750;
const INK = '#0f2e3a';
const hole = { x: 450, y: 206, w: 600, h: 400 }, radius = 10; // 3:2
const O = [CX, 486]; // body centre
// Chamfered octagon with a shallow keel under the chin (clockwise), and a fillet radius per corner.
const VERTS = [[226, 92], [1274, 92], [1464, 282], [1464, 664], [1250, 880], [920, 880], [750, 906], [580, 880], [250, 880], [36, 664], [36, 282]];
const RADII = [64, 64, 64, 90, 90, 160, 120, 160, 90, 90, 64];
const PL = { x: 398, y: 154, w: 704, h: 516, c: 46 }; // octagonal screen plate
const DIAL = [238, 456], SLIDER = [238, 724], HUB = [1218, 456], SPK = [1236, 728], PIPS = [[1190, 228], [1262, 228]];

// ---- outline helpers ----------------------------------------------------------------------------------
const r1 = (v) => Math.round(v * 10) / 10;
const pt = (p) => `${r1(p[0])} ${r1(p[1])}`;
const unit = ([x, y]) => { const l = Math.hypot(x, y) || 1; return [x / l, y / l]; };
/** Polygon with a circular fillet of radii[i] on each corner, as a dense point list. */
function roundPoly(verts, radii, dx = 0, dy = 0) {
  const out = [], N = verts.length;
  for (let i = 0; i < N; i++) {
    const p = verts[i], a = verts[(i - 1 + N) % N], b = verts[(i + 1) % N];
    const u1 = unit([a[0] - p[0], a[1] - p[1]]), u2 = unit([b[0] - p[0], b[1] - p[1]]);
    const th = Math.acos(Math.max(-1, Math.min(1, u1[0] * u2[0] + u1[1] * u2[1]))), r = radii[i];
    const t = r / Math.tan(th / 2), h = r / Math.sin(th / 2), bis = unit([u1[0] + u2[0], u1[1] + u2[1]]);
    const c = [p[0] + bis[0] * h, p[1] + bis[1] * h], t1 = [p[0] + u1[0] * t, p[1] + u1[1] * t], t2 = [p[0] + u2[0] * t, p[1] + u2[1] * t];
    const a1 = Math.atan2(t1[1] - c[1], t1[0] - c[0]);
    let d = Math.atan2(t2[1] - c[1], t2[0] - c[0]) - a1;
    while (d > Math.PI) d -= 2 * Math.PI;
    while (d < -Math.PI) d += 2 * Math.PI;
    for (let k = 0; k <= 20; k++) { const an = a1 + (d * k) / 20; out.push([c[0] + dx + r * Math.cos(an), c[1] + dy + r * Math.sin(an)]); }
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
const outline = (step = 14, dx = 0, dy = 0) => resample(roundPoly(VERTS, RADII, dx, dy), step);
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
/** Rounded octagon (chamfer c, fillet f) as a closed path. */
const octagon = (x, y, w, h, c, f = 14) => closed(resample(roundPoly(
  [[x + c, y], [x + w - c, y], [x + w, y + c], [x + w, y + h - c], [x + w - c, y + h], [x + c, y + h], [x, y + h - c], [x, y + c]], Array(8).fill(f)), 8));
/** Indices of outline points whose angle around c lies in [a0, a1] degrees (screen space), in order. */
function arcIdx(pts, a0, a1, c = O) {
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
/** Crescent inside a circle: outer arc on radius r from angle a0 to a1 (deg), t thick at the middle. */
function moon(cx, cy, r, a0, a1, t) {
  const rad = (a) => (a * Math.PI) / 180, p = (a) => [cx + r * Math.cos(rad(a)), cy + r * Math.sin(rad(a))];
  const half = rad(a1 - a0) / 2, c = 2 * r * Math.sin(half), s1 = r - r * Math.cos(half), s2 = Math.max(0.5, s1 - t);
  const R = (c * c / 4 + s2 * s2) / (2 * s2);
  return `M${P(...p(a0))}A${P(r, r)} 0 0 1 ${P(...p(a1))}A${P(R, R)} 0 0 0 ${P(...p(a0))}Z`;
}
/** Band along a circular arc (centre c, radius r, angles a0..a1), from r - inner to r + outer, round ends. */
function arcBand(cx, cy, r, a0, a1, inner, outer) {
  const rad = (a) => (a * Math.PI) / 180, at = (q, a) => [cx + q * Math.cos(rad(a)), cy + q * Math.sin(rad(a))];
  const ro = r + outer, ri = r - inner, cap = (inner + outer) / 2, large = a1 - a0 > 180 ? 1 : 0;
  return `M${P(...at(ri, a0))}A${P(cap, cap)} 0 0 1 ${P(...at(ro, a0))}A${P(ro, ro)} 0 ${large} 1 ${P(...at(ro, a1))}`
    + `A${P(cap, cap)} 0 0 1 ${P(...at(ri, a1))}A${P(ri, ri)} 0 ${large} 0 ${P(...at(ri, a0))}Z`;
}
const ray = (cx, cy, a, r0, r1_) => { const c = Math.cos((a * Math.PI) / 180), s = Math.sin((a * Math.PI) / 180); return `M${P(cx + r0 * c, cy + r0 * s)}L${P(cx + r1_ * c, cy + r1_ * s)}`; };

// ---- parts -------------------------------------------------------------------------------------------
/** Mustard shoulder keys on the top edge and a ribbed scroll wheel peeking out of the right side. */
function edgeParts() {
  const ribs = [];
  for (let y = 392; y <= 516; y += 14) ribs.push(`M1468 ${y}H1482`);
  return g({},
    [300, 1040].map((x) => path(rr(x, 66, 160, 52, 18), { fill: 'url(#wpMustard)', stroke: INK, strokeWidth: 6 })
      + path(`M${x + 20} ${80}H${x + 110}`, { stroke: '#fff', strokeOpacity: 0.9, strokeWidth: 5, strokeLinecap: 'round' })).join(''),
    path(rr(1440, 374, 48, 156, 18), { fill: 'url(#wpWheel)', stroke: INK, strokeWidth: 6 }),
    path(ribs.join(''), { stroke: '#8a5a10', strokeOpacity: 0.6, strokeWidth: 3.5, strokeLinecap: 'round' }),
    path('M1478 392V420', { stroke: '#fff', strokeOpacity: 0.8, strokeWidth: 3, strokeLinecap: 'round' }));
}

function plate() {
  const { x, y, w, h, c } = PL, holeD = rr(hole.x, hole.y, hole.w, hole.h, radius), cy = (hole.y + hole.h + y + h) / 2;
  const outer = octagon(x, y, w, h, c), inner = octagon(x + 10, y + 10, w - 20, h - 20, c - 4, 10);
  return g({},
    path(outer, { fill: INK, fillOpacity: 0.32, transform: 'translate(5 12)' }),
    path(outer, { fill: 'url(#wpPlateEdge)', stroke: INK, strokeWidth: 6 }),
    path(inner, { fill: 'url(#wpPlate)' }),
    path(inner, { fill: 'url(#wpPlateSheen)' }),
    path(rr(hole.x - 16, hole.y - 16, hole.w + 32, hole.h + 32, radius + 12), { fill: '#071419', stroke: '#3f7d88', strokeWidth: 3 }),
    [[8, 0.28], [3.5, 0.6]].map(([sw, a]) => path(holeD, { fill: 'none', stroke: '#000', strokeWidth: sw * 2, strokeOpacity: a })).join(''),
    // three tiny status lights in the top margin
    [['#7cf0dc', 1000], ['#ffd25a', 1022], ['#ff9a8a', 1044]].map(([col, lx]) => path(circle(lx, 180, 5.5), { fill: col, stroke: '#071419', strokeWidth: 2 })).join(''),
    path(circle(1000, 180, 14), { fill: 'url(#wpLedGlow)', class: 'wp-led' }),
    // chin: mustard pinstripes either side of a little gem
    path(`M${x + 80} ${cy}H${CX - 36}M${CX + 36} ${cy}H${x + w - 80}`, { stroke: '#ffd25a', strokeOpacity: 0.6, strokeWidth: 4, strokeLinecap: 'round' }),
    path(poly([[CX, cy - 15], [CX + 15, cy], [CX, cy + 15], [CX - 15, cy]]), { fill: 'url(#wpMustard)', stroke: '#071419', strokeWidth: 2.5, strokeLinejoin: 'round' }),
    path(poly([[CX - 3, cy - 9], [CX - 9, cy - 3], [CX - 4, cy - 3]]), { fill: '#fff', fillOpacity: 0.9 }),
    // key light on the plate rim, warm bounce opposite
    path(`M${x + 16} ${y + 170}V${y + c + 6}L${x + c + 6} ${y + 16}H${x + 280}`, { fill: 'none', stroke: '#fff', strokeOpacity: 0.5, strokeWidth: 5, strokeLinecap: 'round', strokeLinejoin: 'round' }),
    path(`M${x + w - 15} ${y + h - c - 140}V${y + h - c - 8}`, { stroke: '#ffd98a', strokeOpacity: 0.55, strokeWidth: 4, strokeLinecap: 'round' }));
}

function led() {
  const [x, y] = [DIAL[0], 216];
  return g({},
    path(circle(x, y, 26), { fill: 'url(#wpLedGlow)', class: 'wp-led' }),
    path(circle(x, y, 10.5), { fill: 'url(#wpLed)', stroke: INK, strokeWidth: 3.5 }),
    path(circle(x - 3, y - 3.5, 3), { fill: '#fff' }),
    path(`M${x + 26} ${y}H${x + 70}M${x - 70} ${y}H${x - 26}`, { stroke: INK, strokeOpacity: 0.22, strokeWidth: 5, strokeLinecap: 'round' }));
}

/** Big round jog dial: tick ring, knurled mustard bezel, teal disc with a thumb dimple. */
function dial() {
  const [cx, cy] = DIAL, ticks = [], knurl = [];
  for (let i = 0; i < 12; i++) ticks.push(ray(cx, cy, i * 30, 140, 152));
  for (let i = 0; i < 48; i++) knurl.push(ray(cx, cy, i * 7.5, 110, 121));
  return g({},
    path(circle(cx, cy, 164), { fill: 'url(#wpDish)' }),
    path(moon(cx, cy, 164, 20, 160, 5), { fill: '#fff', fillOpacity: 0.55 }),
    path(ticks.join(''), { stroke: INK, strokeOpacity: 0.4, strokeWidth: 5, strokeLinecap: 'round' }),
    path(circle(cx + 4, cy + 11, 126), { fill: INK, fillOpacity: 0.35 }),
    path(circle(cx, cy, 126), { fill: 'url(#wpMustard)', stroke: INK, strokeWidth: 6 }),
    path(knurl.join(''), { stroke: '#8a5a10', strokeOpacity: 0.5, strokeWidth: 3, strokeLinecap: 'round' }),
    path(moon(cx, cy, 121, 194, 270, 9), { fill: '#fff', fillOpacity: 0.95 }),
    path(circle(cx, cy, 100), { fill: 'url(#wpDisc)', stroke: INK, strokeWidth: 5 }),
    path(circle(cx, cy, 78) + circle(cx, cy, 54), { fill: 'none', stroke: '#0b3a40', strokeOpacity: 0.28, strokeWidth: 3 }),
    path(moon(cx, cy, 96, 200, 262, 12), { fill: '#fff', fillOpacity: 0.6 }),
    path(moon(cx, cy, 98, 20, 90, 6), { fill: '#ffe08a', fillOpacity: 0.5 }),
    // thumb dimple: dark on top, lit lower lip (concave)
    path(circle(cx - 30, cy - 28, 27), { fill: 'url(#wpDimple)', stroke: INK, strokeOpacity: 0.55, strokeWidth: 3 }),
    path(moon(cx - 30, cy - 28, 26, 25, 155, 5), { fill: '#fff', fillOpacity: 0.75 }),
    path(circle(cx + 44, cy + 46, 6.5), { fill: '#fff', fillOpacity: 0.8 }));
}

function slider() {
  const [cx, cy] = SLIDER;
  return g({},
    path(rr(cx - 108, cy - 38, 216, 76, 38), { fill: 'url(#wpDish)' }),
    path(`M${cx - 74} ${cy + 35}H${cx + 74}`, { stroke: '#fff', strokeOpacity: 0.5, strokeWidth: 4, strokeLinecap: 'round' }),
    path(rr(cx - 86, cy - 15, 172, 30, 15), { fill: '#0a2630', stroke: INK, strokeWidth: 5 }),
    path(circle(cx + 30, cy, 4.5) + circle(cx + 64, cy, 4.5), { fill: '#5fd6c6', fillOpacity: 0.7 }),
    path(rr(cx - 82 + 4, cy - 27 + 9, 66, 54, 20), { fill: INK, fillOpacity: 0.35 }),
    path(rr(cx - 82, cy - 27, 66, 54, 20), { fill: 'url(#wpMustard)', stroke: INK, strokeWidth: 5 }),
    path(`M${cx - 62} ${cy - 12}V${cy + 12}M${cx - 49} ${cy - 12}V${cy + 12}M${cx - 36} ${cy - 12}V${cy + 12}`, { stroke: '#8a5a10', strokeOpacity: 0.55, strokeWidth: 3.5, strokeLinecap: 'round' }),
    path(`M${cx - 70} ${cy - 18}H${cx - 40}`, { stroke: '#fff', strokeOpacity: 0.9, strokeWidth: 4, strokeLinecap: 'round' }));
}

/** A rounded petal key pointing outward along `deg`, centred on (cx, cy). */
function petalKey(cx, cy, deg, fill) {
  const d = 'M-32 0C-32 -25 -8 -31 12 -25C34 -18 44 -7 44 0C44 7 34 18 12 25C-8 31 -32 25 -32 0Z';
  return path(d, { fill: INK, fillOpacity: 0.35, transform: `translate(${n(cx + 4)} ${n(cy + 10)}) rotate(${deg}) scale(1.22)` })
    + g({ transform: `translate(${n(cx)} ${n(cy)}) rotate(${deg}) scale(1.22)` },
      path(d, { fill, stroke: INK, strokeWidth: 5.5, strokeLinejoin: 'round' }),
      path('M-22 -10Q-14 -20 4 -19', { fill: 'none', stroke: '#fff', strokeOpacity: 0.95, strokeWidth: 6, strokeLinecap: 'round' }),
      path(circle(26, 6, 3.5), { fill: '#fff', fillOpacity: 0.75 }));
}

/** Crescent arc of three petal keys curling around a small hub button. */
function crescentKeys() {
  const [cx, cy] = HUB, R = 118, angs = [-54, 0, 54], fills = ['url(#wpCreamKey)', 'url(#wpMustardR)', 'url(#wpCreamKey)'];
  const at = (a) => [cx + R * Math.cos((a * Math.PI) / 180), cy + R * Math.sin((a * Math.PI) / 180)];
  return g({},
    path(arcBand(cx, cy, R, -82, 82, 54, 54), { fill: 'url(#wpDish)' }),
    path(circle(cx, cy, 52), { fill: 'url(#wpDish)' }),
    path(circle(cx + 3, cy + 8, 33), { fill: INK, fillOpacity: 0.35 }),
    path(circle(cx, cy, 33), { fill: 'url(#wpHub)', stroke: INK, strokeWidth: 5 }),
    path(circle(cx, cy, 13), { fill: 'url(#wpMustardR)', stroke: INK, strokeWidth: 3 }),
    path(moon(cx, cy, 28, 198, 268, 6), { fill: '#fff', fillOpacity: 0.7 }),
    angs.map((a, i) => petalKey(...at(a), a, fills[i])).join(''));
}

function pips() {
  return PIPS.map(([x, y]) => path(circle(x, y, 26), { fill: 'url(#wpDish)' })
    + path(circle(x + 2, y + 6, 15), { fill: INK, fillOpacity: 0.35 })
    + path(circle(x, y, 15), { fill: 'url(#wpHub)', stroke: INK, strokeWidth: 4.5 })
    + path(moon(x, y, 12, 200, 268, 4), { fill: '#fff', fillOpacity: 0.75 })).join('');
}

/** Sunburst speaker: radial slots around a tiny hub. */
function speaker() {
  const [cx, cy] = SPK, d = [];
  for (let i = 0; i < 10; i++) d.push(ray(cx, cy, i * 36 + 18, 20, 48));
  const s = d.join('');
  return path(s, { stroke: '#fff', strokeOpacity: 0.45, strokeWidth: 11, strokeLinecap: 'round', transform: 'translate(1.5 3)' })
    + path(s, { stroke: INK, strokeOpacity: 0.7, strokeWidth: 10, strokeLinecap: 'round' })
    + path(circle(cx, cy, 8), { fill: INK, fillOpacity: 0.7 });
}

/** Die-cut sticker: a smiling cloud with a mustard sun peeking out. */
function sticker(cx, cy, deg) {
  const cloud = 'M-36 14C-52 14 -52 -8 -36 -10C-36 -30 -10 -34 -3 -18C3 -36 32 -34 32 -12C50 -12 52 14 34 14Z';
  return g({ transform: `translate(${cx} ${cy}) rotate(${deg})` },
    path(circle(24, -22, 18), { fill: INK, fillOpacity: 0.3, stroke: INK, strokeOpacity: 0.3, strokeWidth: 16, transform: 'translate(3 5)' }),
    path(cloud, { fill: INK, fillOpacity: 0.3, stroke: INK, strokeOpacity: 0.3, strokeWidth: 16, strokeLinejoin: 'round', transform: 'translate(3 5)' }),
    path(circle(24, -22, 18), { fill: '#fff', stroke: '#fff', strokeWidth: 14 }),
    path(cloud, { fill: '#fff', stroke: '#fff', strokeWidth: 14, strokeLinejoin: 'round' }),
    path(circle(24, -22, 18), { fill: 'url(#wpMustardR)', stroke: '#c98a1c', strokeWidth: 2 }),
    path(cloud, { fill: 'url(#wpCloud)', stroke: '#8fc8d8', strokeWidth: 2.5, strokeLinejoin: 'round' }),
    path('M-14 0Q-10 -5 -6 0M6 0Q10 -5 14 0M-5 6Q0 10 5 6', { fill: 'none', stroke: '#2a5a6a', strokeWidth: 3, strokeLinecap: 'round' }),
    path(ellipse(-20, 6, 4.5, 3) + ellipse(20, 6, 4.5, 3), { fill: '#ffa0a0', fillOpacity: 0.8 }),
    path('M-30 -4Q-28 -18 -16 -20', { fill: 'none', stroke: '#fff', strokeWidth: 4, strokeLinecap: 'round' }));
}

// ---- draw --------------------------------------------------------------------------------------------
function draw() {
  const pts = outline(), nrm = normals(pts), BODY = closed(pts);
  const SIDE = closed(outline(14, 8, 14));
  const defs = [
    lg('wpBody', [0, 0, 1, 1], [[0, '#d8fff6'], [0.13, '#8ff0de'], [0.5, '#3cc8b6'], [0.85, '#1f9a92'], [1, '#157a78']]),
    lg('wpSide', [0, 0, 1, 1], [[0, '#1a7d79'], [1, '#0c4a4e']]),
    lg('wpShade', [0, 0, 0, 1], [[0, '#fff', 0.3], [0.1, '#fff', 0.04], [0.55, '#fff', 0], [0.82, '#0b2a3a', 0.1], [1, '#0b2a3a', 0.3]]),
    lg('wpRim', [40, 92, 1460, 900], [[0, '#ffe08a', 0], [0.7, '#ffe08a', 0], [0.9, '#ffe08a', 0.75], [1, '#fff4c4', 1]], true),
    lg('wpKey', [40, 92, 1460, 900], [[0, '#fff', 0.85], [0.28, '#fff', 0.3], [0.42, '#fff', 0]], true),
    lg('wpSheen', [0, 0, 1, 0], [[0, '#fff', 0.85], [1, '#fff', 0.1]]),
    lg('wpMustard', [0, 0, 0, 1], [[0, '#fff3c4'], [0.45, '#ffd25a'], [1, '#df9f22']]),
    rg('wpMustardR', [0.38, 0.3, 0.85], [[0, '#fff6d2'], [0.45, '#ffd25a'], [1, '#d69420']]),
    rg('wpCreamKey', [0.35, 0.3, 0.85], [[0, '#ffffff'], [0.5, '#fff6e2'], [1, '#e8d2a8']]),
    lg('wpWheel', [0, 0, 1, 0], [[0, '#c98a1c'], [0.5, '#ffd25a'], [1, '#fff0b8']]),
    lg('wpPlateEdge', [0, 0, 1, 1], [[0, '#3f7a8a'], [0.5, '#1d4656'], [1, '#0c2a36']]),
    lg('wpPlate', [0, 0, 0, 1], [[0, '#1f4a5a'], [1, '#12313e']]),
    lg('wpPlateSheen', [0, 0, 1, 1], [[0.15, '#c8fff4', 0], [0.4, '#c8fff4', 0.12], [0.55, '#fff2c4', 0.08], [0.8, '#fff2c4', 0]]),
    rg('wpDish', [0.5, 0.62, 0.6], [[0, '#0b2a3a', 0.04], [0.75, '#0b2a3a', 0.12], [1, '#0b2a3a', 0.26]]),
    rg('wpDisc', [0.38, 0.32, 0.8], [[0, '#b8fff0'], [0.45, '#4fd2c0'], [1, '#1a7f7a']]),
    rg('wpDimple', [0.5, 0.62, 0.6], [[0, '#127068'], [0.8, '#239a90'], [1, '#3cc0b2']]),
    rg('wpHub', [0.38, 0.3, 0.85], [[0, '#6fd8cc'], [0.5, '#1f6f74'], [1, '#0f3e48']]),
    rg('wpLed', [0.4, 0.35, 0.7], [[0, '#fffbe6'], [0.5, '#ffd25a'], [1, '#e08a1c']]),
    rg('wpLedGlow', [0.5, 0.5, 0.5], [[0, '#ffd25a', 0.6], [1, '#ffd25a', 0]]),
    lg('wpCloud', [0, 0, 0, 1], [[0, '#ffffff'], [1, '#d4f2fb']]),
    rg('wpFloor', [0.5, 0.5, 0.5], [[0, INK, 0.32], [1, INK, 0]]),
    `<clipPath id="wpBodyClip"><path d="${BODY}"/></clipPath>`,
    '<style>.wp-led{animation:wp-led 3s ease-in-out infinite}.wp-tw{animation:wp-tw 3.4s ease-in-out infinite}.wp-tw2{animation:wp-tw 3.4s ease-in-out 1.7s infinite}'
      + '@keyframes wp-led{0%,100%{opacity:1}50%{opacity:.45}}@keyframes wp-tw{0%,100%{opacity:1}50%{opacity:.35}}'
      + '@media (prefers-reduced-motion:reduce){*{animation:none!important}}</style>',
  ].join('');

  const cut = (idx, a, b) => idx.slice(Math.round(idx.length * a), Math.round(idx.length * b));
  const left = arcIdx(pts, 158, 250);
  const body = [
    path(ellipse(CX + 20, 920, 660, 24), { fill: 'url(#wpFloor)' }),
    edgeParts(),
    path(SIDE, { fill: 'url(#wpSide)', stroke: INK, strokeWidth: 8 }),
    path(BODY, { fill: 'url(#wpBody)', stroke: INK, strokeWidth: 8 }),
    g({ clipPath: 'url(#wpBodyClip)' },
      path(BODY, { fill: 'url(#wpShade)' }),
      path(BODY, { fill: 'none', stroke: 'url(#wpRim)', strokeWidth: 12 }),
      path(BODY, { fill: 'none', stroke: 'url(#wpKey)', strokeWidth: 8 }),
      // facet lines along the chamfers
      path('M58 300L240 118M1442 300L1260 118M58 646L262 858M1442 646L1238 858', { stroke: '#fff', strokeOpacity: 0.16, strokeWidth: 4, strokeLinecap: 'round' }),
      // anime glare: soft sheen, sharp crescent and a thin echo, warm rims on the far side
      path(crescent(pts, nrm, left, 12, 70, 1.3, 0.62), { fill: 'url(#wpSheen)', fillOpacity: 0.4 }),
      path(crescent(pts, nrm, cut(left, 0.06, 0.94), 18, 22, 0.85, 0.6), { fill: '#fff', fillOpacity: 0.95 }),
      path(crescent(pts, nrm, cut(left, 0.3, 0.8), 50, 6, 1, 0.6), { fill: '#fff', fillOpacity: 0.8 }),
      path(crescent(pts, nrm, arcIdx(pts, 254, 280), 14, 9, 1), { fill: '#fff', fillOpacity: 0.85 }),
      path(crescent(pts, nrm, arcIdx(pts, 345, 400), 12, 16, 0.9), { fill: '#fff4c4', fillOpacity: 0.9 }),
      path(crescent(pts, nrm, arcIdx(pts, 62, 112), 12, 10, 1), { fill: '#fff4c4', fillOpacity: 0.6 }),
      // keel highlight
      path('M640 868Q750 886 860 868', { fill: 'none', stroke: '#ffe08a', strokeOpacity: 0.7, strokeWidth: 5, strokeLinecap: 'round' })),
    plate(),
    led(),
    dial(),
    slider(),
    pips(),
    crescentKeys(),
    speaker(),
    sticker(536, 786, -10),
    // round glints
    path(circle(330, 140, 8.5), { fill: '#fff' }),
    path(circle(353, 137, 4.5), { fill: '#fff', fillOpacity: 0.85 }),
    path(circle(60, 560, 6), { fill: '#fff', fillOpacity: 0.85 }),
    // sparkles around
    path(sparkle(58, 92, 24), { fill: '#fff4c9', stroke: INK, strokeWidth: 3, class: 'wp-tw' }),
    path(sparkle(1446, 104, 20), { fill: '#c9fff4', stroke: INK, strokeWidth: 3, class: 'wp-tw2' }),
    path(sparkle(1476, 850, 15), { fill: '#ffe1c9', stroke: INK, strokeWidth: 3 }),
    path(star(860, 40, 13, 5.5), { fill: '#ffe372', stroke: INK, strokeWidth: 3, strokeLinejoin: 'round' }),
    path(circle(560, 34, 4) + circle(28, 880, 3.5) + circle(1488, 640, 4) + circle(1180, 930, 3.5), { fill: '#fff', fillOpacity: 0.8 }),
  ].join('\n');
  return { defs, body };
}

module.exports = {
  W, H, hole, radius, draw,
  meta: { name: 'Wide Pocket', theme: 'classic', translucent: false,
    desc: 'A faceted lagoon-teal pocket console with a mustard jog dial, a crescent of petal keys and a cloud sticker.',
    tags: ['starter', 'handheld', 'console', 'retro', 'widescreen'] },
};
