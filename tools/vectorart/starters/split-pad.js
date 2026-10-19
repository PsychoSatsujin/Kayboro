'use strict';
// Starter "Glider Pad": a wide one-piece console shaped like a glider, its plum body sweeping out into
// two drooping wing grips that are moulded in one with the screen section. Both wings match: plum with
// copper trim and copper fins on the swept shoulders. On the left wing a ribbed copper rotary knob with
// a pointer and tick ring, and two flip toggles below it; on the right wing a vertical tower of three
// faceted hex gem keys (copper, rose and champagne) and a curved-slot speaker. A dark plum screen plate
// with a copper pinstripe, a tiny status light and a die-cut paper-plane sticker. Top-left key light,
// warm copper rim light, anime crescent glare and round glints. Original artwork, no marks or logos.
const L = require('../lib');
const { rr, path, g, lg, rg, circle, ellipse, sparkle, star, poly, n, P } = L;

const W = 1740, H = 850, CX = 870;
const INK = '#220c2e';
const hole = { x: 390, y: 132, w: 960, h: 540 }, radius = 10; // 16:9
const O = [CX, 420]; // body centre
// One-piece glider outline (clockwise from the top-left of the screen section), fillet radius per corner.
const VERTS = [[470, 44], [1270, 44], [1560, 108], [1716, 330], [1696, 620], [1610, 806], [1462, 800], [1356, 748], [1180, 778], [870, 790],
  [560, 778], [384, 748], [278, 800], [130, 806], [44, 620], [24, 330], [180, 108]];
const RADII = [120, 120, 170, 150, 140, 60, 60, 80, 200, 300, 200, 80, 60, 60, 140, 150, 170];
const PL = { x: 350, y: 92, w: 1040, h: 620, r: 34 }; // screen plate
const KNOB = [192, 316], TOGGLES = [[146, 560], [240, 560]], TOWER = { x: 1548, y0: 236, dy: 106 }, SPK = [1548, 640];

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
const ray = (cx, cy, a, r0, r1_) => { const c = Math.cos((a * Math.PI) / 180), s = Math.sin((a * Math.PI) / 180); return `M${P(cx + r0 * c, cy + r0 * s)}L${P(cx + r1_ * c, cy + r1_ * s)}`; };

// ---- parts -------------------------------------------------------------------------------------------
/** Copper fins riding the swept shoulders (both wings alike). */
function fins(pts, nrm) {
  return [arcIdx(pts, 203, 222), arcIdx(pts, 318, 337)].map((idx, k) =>
    path(bump(pts, nrm, idx, 26, 30), { fill: 'url(#gpCopper)', stroke: INK, strokeWidth: 6, strokeLinejoin: 'round' })
    + path(crescent(pts, nrm, idx.slice(3, -3), -17, 5, 1), { fill: '#fff', fillOpacity: k ? 0.6 : 0.95 })).join('');
}

function plate() {
  const { x, y, w, h, r } = PL, holeD = rr(hole.x, hole.y, hole.w, hole.h, radius), cy = (hole.y + hole.h + y + h) / 2;
  return g({},
    path(rr(x + 5, y + 12, w, h, r), { fill: INK, fillOpacity: 0.35 }),
    path(rr(x, y, w, h, r), { fill: 'url(#gpPlateEdge)', stroke: INK, strokeWidth: 6 }),
    path(rr(x + 9, y + 9, w - 18, h - 18, r - 8), { fill: 'url(#gpPlate)' }),
    path(rr(x + 9, y + 9, w - 18, h - 18, r - 8), { fill: 'url(#gpPlateSheen)' }),
    path(rr(hole.x - 14, hole.y - 14, hole.w + 28, hole.h + 28, radius + 10), { fill: '#0e0612', stroke: '#7a4a8a', strokeWidth: 3 }),
    [[7, 0.3], [3, 0.6]].map(([sw, a]) => path(holeD, { fill: 'none', stroke: '#000', strokeWidth: sw * 2, strokeOpacity: a })).join(''),
    // status light and copper pinstripes on the chin
    path(`M${x + 60} ${cy}H${CX - 40}M${CX + 40} ${cy}H${x + w - 60}`, { stroke: '#f0a066', strokeOpacity: 0.6, strokeWidth: 4, strokeLinecap: 'round' }),
    path(circle(CX, cy, 16), { fill: 'url(#gpLedGlow)', class: 'gp-led' }),
    path(circle(CX, cy, 6.5), { fill: '#ffe2c4', stroke: '#0e0612', strokeWidth: 2.5 }),
    // three chevron vents in the top margin
    [CX - 30, CX, CX + 30].map((vx) => path(`M${vx - 10} ${y + 16}L${vx} ${y + 26}L${vx + 10} ${y + 16}`, { fill: 'none', stroke: '#f0a066', strokeOpacity: 0.55, strokeWidth: 4, strokeLinecap: 'round', strokeLinejoin: 'round' })).join(''),
    // key light on the plate rim, warm bounce opposite
    path(`M${x + 15} ${y + 200}V${y + r}Q${x + 15} ${y + 15} ${x + r} ${y + 15}H${x + 380}`, { fill: 'none', stroke: '#fff', strokeOpacity: 0.45, strokeWidth: 5, strokeLinecap: 'round' }),
    path(`M${x + w - 14} ${y + h - r - 200}V${y + h - r}`, { stroke: '#ffc89a', strokeOpacity: 0.55, strokeWidth: 4, strokeLinecap: 'round' }));
}

/** Rotary knob: copper tick ring, knurled copper skirt, plum cap with a pointer. */
function knob() {
  const [cx, cy] = KNOB, ticks = [], ribs = [];
  for (let a = -225; a <= 45; a += 30) ticks.push(ray(cx, cy, a, 98, a % 90 === 45 ? 116 : 110));
  for (let i = 0; i < 40; i++) ribs.push(ray(cx, cy, i * 9, 66, 80));
  return g({},
    path(circle(cx, cy, 124), { fill: 'url(#gpDish)' }),
    path(moon(cx, cy, 124, 20, 160, 5), { fill: '#fff', fillOpacity: 0.45 }),
    path(ticks.join(''), { stroke: '#ffd0a0', strokeWidth: 6, strokeLinecap: 'round' }),
    path(ticks.join(''), { stroke: INK, strokeOpacity: 0.35, strokeWidth: 6, strokeLinecap: 'round', transform: 'translate(1.5 3)' }),
    path(circle(cx + 4, cy + 11, 82), { fill: INK, fillOpacity: 0.4 }),
    path(circle(cx, cy, 82), { fill: 'url(#gpCopper)', stroke: INK, strokeWidth: 6 }),
    path(ribs.join(''), { stroke: '#7a3a18', strokeOpacity: 0.45, strokeWidth: 3.5, strokeLinecap: 'round' }),
    path(moon(cx, cy, 78, 196, 270, 9), { fill: '#fff', fillOpacity: 0.9 }),
    path(circle(cx, cy, 62), { fill: 'url(#gpCap)', stroke: INK, strokeWidth: 5 }),
    path(moon(cx, cy, 58, 200, 262, 10), { fill: '#fff', fillOpacity: 0.55 }),
    path(moon(cx, cy, 60, 20, 90, 5), { fill: '#ffc89a', fillOpacity: 0.5 }),
    path(ray(cx, cy, -55, 16, 50), { stroke: INK, strokeWidth: 13, strokeLinecap: 'round' }),
    path(ray(cx, cy, -55, 16, 50), { stroke: 'url(#gpCopperH)', strokeWidth: 7, strokeLinecap: 'round' }),
    path(circle(cx + 30, cy + 34, 5), { fill: '#fff', fillOpacity: 0.6 }));
}

/** Flip toggle on a small plate: `up` picks which way the lever is thrown. */
function toggle(cx, cy, up) {
  const tip = [cx, cy + (up ? -58 : 58)];
  return g({},
    path(rr(cx - 38, cy - 70, 76, 140, 26), { fill: 'url(#gpDish)' }),
    path(rr(cx - 30 + 3, cy - 52 + 8, 60, 104, 18), { fill: INK, fillOpacity: 0.35 }),
    path(rr(cx - 30, cy - 52, 60, 104, 18), { fill: 'url(#gpPlateEdge)', stroke: INK, strokeWidth: 5 }),
    path(circle(cx, cy - 38, 4) + circle(cx, cy + 38, 4), { fill: '#f0a066', fillOpacity: 0.8 }),
    path(rr(cx - 9, cy - 24, 18, 48, 9), { fill: '#0e0612' }),
    path(`M${cx - 18} ${cy - 44}H${cx + 10}`, { stroke: '#fff', strokeOpacity: 0.45, strokeWidth: 3.5, strokeLinecap: 'round' }),
    path(`M${cx} ${cy}L${tip[0]} ${tip[1]}`, { stroke: INK, strokeWidth: 20, strokeLinecap: 'round' }),
    path(`M${cx} ${cy}L${tip[0]} ${tip[1]}`, { stroke: 'url(#gpCopperH)', strokeWidth: 11, strokeLinecap: 'round' }),
    path(circle(tip[0] + 3, tip[1] + 7, 19), { fill: INK, fillOpacity: 0.35 }),
    path(circle(...tip, 19), { fill: 'url(#gpBall)', stroke: INK, strokeWidth: 5 }),
    path(moon(...tip, 15, 200, 268, 5), { fill: '#fff', fillOpacity: 0.95 }));
}

/** Faceted hexagonal gem key. */
function gem(cx, cy, r, fill, rim) {
  const hex = (rad) => poly([0, 60, 120, 180, 240, 300].map((a) => [cx + rad * Math.cos((a * Math.PI) / 180), cy + rad * Math.sin((a * Math.PI) / 180)]));
  return path(hex(r), { fill: INK, fillOpacity: 0.35, transform: 'translate(4 9)', stroke: INK, strokeOpacity: 0.35, strokeWidth: 8, strokeLinejoin: 'round' })
    + path(hex(r), { fill, stroke: INK, strokeWidth: 6, strokeLinejoin: 'round' })
    + path(hex(r * 0.56), { fill: '#fff', fillOpacity: 0.22, stroke: rim, strokeOpacity: 0.7, strokeWidth: 2.5, strokeLinejoin: 'round' })
    + path(poly([[cx - r + 8, cy - 2], [cx - r * 0.5 + 4, cy - r * 0.866 + 6], [cx - r * 0.28, cy - r * 0.866 + 6], [cx - r * 0.56 + 2, cy - 2]]), { fill: '#fff', fillOpacity: 0.85 })
    + path(circle(cx + r * 0.38, cy + r * 0.4, 3.5), { fill: '#fff', fillOpacity: 0.8 });
}

function tower() {
  const { x, y0, dy } = TOWER, ys = [0, 1, 2].map((i) => y0 + i * dy);
  const fills = [['url(#gpGemCopper)', '#ffe2c4'], ['url(#gpGemRose)', '#ffe0ea'], ['url(#gpGemChamp)', '#fffbe8']];
  return g({},
    path(rr(x - 64, y0 - 64, 128, 2 * dy + 128, 64), { fill: 'url(#gpDish)' }),
    path(`M${x + 50} ${y0 + 20}V${y0 + 2 * dy - 20}`, { stroke: '#fff', strokeOpacity: 0.45, strokeWidth: 4, strokeLinecap: 'round' }),
    path(`M${x} ${y0}V${y0 + 2 * dy}`, { stroke: INK, strokeOpacity: 0.3, strokeWidth: 10, strokeLinecap: 'round' }),
    ys.map((y, i) => gem(x, y, 42, ...fills[i])).join(''));
}

/** Speaker: a row of slots stepped like a little equaliser, in a copper-rimmed capsule. */
function speaker() {
  const [cx, cy] = SPK, hs = [18, 34, 50, 34, 18];
  const d = hs.map((h, i) => `M${cx + (i - 2) * 22} ${cy - h / 2}V${cy + h / 2}`).join('');
  return path(rr(cx - 76, cy - 46, 152, 92, 46), { fill: 'url(#gpDish)' })
    + path(rr(cx - 76, cy - 46, 152, 92, 46), { fill: 'none', stroke: '#f2a46a', strokeOpacity: 0.5, strokeWidth: 3 })
    + path(d, { fill: 'none', stroke: '#fff', strokeOpacity: 0.4, strokeWidth: 10, strokeLinecap: 'round', transform: 'translate(1.5 3)' })
    + path(d, { fill: 'none', stroke: INK, strokeOpacity: 0.72, strokeWidth: 9, strokeLinecap: 'round' });
}

/** Die-cut paper-plane sticker with a white border and a dashed flight trail. */
function sticker(cx, cy, deg) {
  const plane = 'M-34 6L34 -24L4 28L-4 12Z', fold = 'M-4 12L34 -24';
  return g({ transform: `translate(${cx} ${cy}) rotate(${deg})` },
    path(plane, { fill: INK, fillOpacity: 0.3, stroke: INK, strokeOpacity: 0.3, strokeWidth: 16, strokeLinejoin: 'round', transform: 'translate(3 5)' }),
    path(plane, { fill: '#fff', stroke: '#fff', strokeWidth: 14, strokeLinejoin: 'round' }),
    path(plane, { fill: 'url(#gpPaper)', stroke: '#b98ad0', strokeWidth: 2.5, strokeLinejoin: 'round' }),
    path('M-4 12L34 -24L-10 4Z', { fill: '#d9c2ef', fillOpacity: 0.8 }),
    path(fold, { stroke: '#9a6ab8', strokeWidth: 2.5, strokeLinecap: 'round' }),
    path('M-24 4L18 -14', { stroke: '#fff', strokeWidth: 3.5, strokeLinecap: 'round' }));
}

// ---- draw --------------------------------------------------------------------------------------------
function draw() {
  const pts = outline(), nrm = normals(pts), BODY = closed(pts);
  const SIDE = closed(outline(14, 7, 13));
  const defs = [
    lg('gpBody', [0, 0, 1, 1], [[0, '#f4dcff'], [0.12, '#cf98e2'], [0.5, '#9a5ab6'], [0.85, '#6c3488'], [1, '#4f2068']]),
    lg('gpSide', [0, 0, 1, 1], [[0, '#5a2672'], [1, '#2a0d3a']]),
    lg('gpShade', [0, 0, 0, 1], [[0, '#fff', 0.28], [0.1, '#fff', 0.04], [0.55, '#fff', 0], [0.82, '#1a0626', 0.1], [1, '#1a0626', 0.32]]),
    lg('gpRim', [24, 44, 1716, 806], [[0, '#ffc89a', 0], [0.7, '#ffc89a', 0], [0.9, '#ffc89a', 0.75], [1, '#ffe6cc', 1]], true),
    lg('gpKey', [24, 44, 1716, 806], [[0, '#fff', 0.85], [0.25, '#fff', 0.3], [0.4, '#fff', 0]], true),
    lg('gpSheen', [0, 0, 1, 0], [[0, '#fff', 0.85], [1, '#fff', 0.1]]),
    lg('gpCopper', [0, 0, 0, 1], [[0, '#ffe6cc'], [0.4, '#f2a46a'], [1, '#b0582a']]),
    lg('gpCopperH', [0, 0, 1, 1], [[0, '#ffe6cc'], [0.5, '#f2a46a'], [1, '#c0662e']]),
    rg('gpBall', [0.38, 0.3, 0.85], [[0, '#fff2e2'], [0.45, '#f2a46a'], [1, '#a5502a']]),
    rg('gpCap', [0.4, 0.32, 0.85], [[0, '#d9a6ec'], [0.5, '#8a4aa6'], [1, '#4a1c60']]),
    lg('gpPlateEdge', [0, 0, 1, 1], [[0, '#6a3c80'], [0.5, '#3a1a4a'], [1, '#22102c']]),
    lg('gpPlate', [0, 0, 0, 1], [[0, '#38204a'], [1, '#24122e']]),
    lg('gpPlateSheen', [0, 0, 1, 1], [[0.15, '#ffd8f4', 0], [0.4, '#ffd8f4', 0.13], [0.55, '#ffd8b8', 0.08], [0.8, '#ffd8b8', 0]]),
    rg('gpDish', [0.5, 0.62, 0.6], [[0, '#1a0626', 0.05], [0.75, '#1a0626', 0.14], [1, '#1a0626', 0.28]]),
    rg('gpGemCopper', [0.38, 0.3, 0.85], [[0, '#fff0de'], [0.45, '#f2a46a'], [1, '#a5502a']]),
    rg('gpGemRose', [0.38, 0.3, 0.85], [[0, '#fff0f4'], [0.45, '#ff9ab8'], [1, '#c24a74']]),
    rg('gpGemChamp', [0.38, 0.3, 0.85], [[0, '#fffdf2'], [0.45, '#f6dca0'], [1, '#c8963e']]),
    rg('gpLedGlow', [0.5, 0.5, 0.5], [[0, '#ffb070', 0.7], [1, '#ffb070', 0]]),
    lg('gpPaper', [0, 0, 1, 1], [[0, '#ffffff'], [1, '#efe2ff']]),
    rg('gpFloor', [0.5, 0.5, 0.5], [[0, INK, 0.32], [1, INK, 0]]),
    `<clipPath id="gpBodyClip"><path d="${BODY}"/></clipPath>`,
    '<style>.gp-led{animation:gp-led 3s ease-in-out infinite}.gp-tw{animation:gp-tw 3.4s ease-in-out infinite}.gp-tw2{animation:gp-tw 3.4s ease-in-out 1.7s infinite}'
      + '@keyframes gp-led{0%,100%{opacity:1}50%{opacity:.45}}@keyframes gp-tw{0%,100%{opacity:1}50%{opacity:.35}}'
      + '@media (prefers-reduced-motion:reduce){*{animation:none!important}}</style>',
  ].join('');

  const cut = (idx, a, b) => idx.slice(Math.round(idx.length * a), Math.round(idx.length * b));
  const left = arcIdx(pts, 170, 224);
  const body = [
    path(ellipse(CX + 20, 820, 820, 22), { fill: 'url(#gpFloor)' }),
    fins(pts, nrm),
    path(SIDE, { fill: 'url(#gpSide)', stroke: INK, strokeWidth: 8 }),
    path(BODY, { fill: 'url(#gpBody)', stroke: INK, strokeWidth: 8 }),
    g({ clipPath: 'url(#gpBodyClip)' },
      path(BODY, { fill: 'url(#gpShade)' }),
      path(BODY, { fill: 'none', stroke: 'url(#gpRim)', strokeWidth: 12 }),
      path(BODY, { fill: 'none', stroke: 'url(#gpKey)', strokeWidth: 8 }),
      // copper inlay lines tracing each wing
      path('M58 420Q60 640 150 770M1682 420Q1680 640 1590 770', { fill: 'none', stroke: '#f2a46a', strokeOpacity: 0.55, strokeWidth: 5, strokeLinecap: 'round' }),
      // anime glare: soft sheen, sharp crescent and a thin echo, warm rims on the far side
      path(crescent(pts, nrm, left, 12, 64, 1.3, 0.6), { fill: 'url(#gpSheen)', fillOpacity: 0.4 }),
      path(crescent(pts, nrm, cut(left, 0.05, 0.95), 18, 20, 0.85, 0.6), { fill: '#fff', fillOpacity: 0.95 }),
      path(crescent(pts, nrm, cut(left, 0.3, 0.8), 48, 6, 1, 0.6), { fill: '#fff', fillOpacity: 0.8 }),
      path(crescent(pts, nrm, arcIdx(pts, 236, 262), 14, 9, 1), { fill: '#fff', fillOpacity: 0.85 }),
      path(crescent(pts, nrm, arcIdx(pts, 345, 392), 12, 16, 0.9), { fill: '#ffe6cc', fillOpacity: 0.9 }),
      path(crescent(pts, nrm, arcIdx(pts, 150, 166), 12, 9, 1), { fill: '#ffe6cc', fillOpacity: 0.5 })),
    plate(),
    knob(),
    toggle(...TOGGLES[0], true),
    toggle(...TOGGLES[1], false),
    tower(),
    speaker(),
    sticker(214, 708, -14),
    // round glints
    path(circle(300, 92, 8), { fill: '#fff' }),
    path(circle(322, 90, 4.2), { fill: '#fff', fillOpacity: 0.85 }),
    path(circle(52, 470, 6), { fill: '#fff', fillOpacity: 0.85 }),
    // sparkles around
    path(sparkle(40, 40, 22), { fill: '#ffe6cc', stroke: INK, strokeWidth: 3, class: 'gp-tw' }),
    path(sparkle(1702, 38, 20), { fill: '#f0d0ff', stroke: INK, strokeWidth: 3, class: 'gp-tw2' }),
    path(sparkle(1712, 812, 14), { fill: '#fff4c9', stroke: INK, strokeWidth: 3 }),
    path(star(26, 790, 13, 5.5), { fill: '#ffe372', stroke: INK, strokeWidth: 3, strokeLinejoin: 'round' }),
    path(circle(600, 18, 4) + circle(1200, 20, 3.5) + circle(14, 200, 4) + circle(1728, 200, 3.5) + circle(870, 836, 3.5), { fill: '#fff', fillOpacity: 0.8 }),
  ].join('\n');
  return { defs, body };
}

module.exports = {
  W, H, hole, radius, draw,
  meta: { name: 'Glider Pad', theme: 'classic', translucent: false,
    desc: 'A one-piece plum glider with copper-trimmed wing grips, a rotary knob, flip toggles and a tower of gem keys.',
    tags: ['starter', 'handheld', 'console', 'hybrid', 'widescreen'] },
};
