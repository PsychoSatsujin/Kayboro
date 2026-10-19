'use strict';
// Elven Arch: a slender pointed gateway of moon-white stone. The screen is the doorway under a calm
// silver transom; above it a moon window with leaf-and-vine tracery (two lancets, an oculus holding a
// crescent moon, little star-flowers). The archivolt carries a running vine and curled leaf crockets
// and ends in a faceted star gem; vine-wrapped columns with leaf capitals hold it up, strands of silver
// leaves hang beside them, moon lilies grow at their feet and a lavender moonlit haze glows behind.
const L = require('../lib');
const { rr, path, g, lg, rg, circle, ellipse, sparkle, tf, rng, lip, smooth, poly, n, P } = L;

const W = 1400, H = 1540, hole = { x: 252, y: 886, w: 896, h: 504 }, radius = 12;
const CX = W / 2;
const INK = '#463d74';
const YS = hole.y - 30; // spring line of the arch = top of the door bezel
const MAIN = { cx: CX, ys: YS, hs: 478, e: 128 }; // inner arch: half-span, arc centres at cx +- e on the spring line
const BAND = 84; // archivolt width
const COL = { cx: 181, w: 54, top: YS + 76, bot: hole.y + hole.h + 4 }; // left column (mirrored for the right)
const STEP_Y = COL.bot + 50;

// ---- pointed-arch geometry ---------------------------------------------------------------------
const rad = (A, d) => A.hs + A.e + d;
const apexY = (d, A = MAIN) => A.ys - Math.sqrt(rad(A, d) ** 2 - A.e * A.e);
/** Open pointed-arch outline offset d outward, from the left springer over the apex to the right one. */
const archD = (d, A = MAIN) => { const r = rad(A, d); return `M${P(A.cx - A.hs - d, A.ys)}A${P(r, r)} 0 0 1 ${P(A.cx, apexY(d, A))}A${P(r, r)} 0 0 1 ${P(A.cx + A.hs + d, A.ys)}`; };
/** Closed band between offsets d0 < d1. */
function bandD(d0, d1, A = MAIN) {
  const r0 = rad(A, d0);
  return `${archD(d1, A)}H${n(A.cx + A.hs + d0)}A${P(r0, r0)} 0 0 0 ${P(A.cx, apexY(d0, A))}A${P(r0, r0)} 0 0 0 ${P(A.cx - A.hs - d0, A.ys)}Z`;
}
/** Point, outward normal and tangent (toward the apex) on the LEFT arc at offset d; t = 0 springer .. 1 apex. */
function arcAt(d, t, A = MAIN) {
  const r = rad(A, d), h = Math.sqrt(r * r - A.e * A.e), th1 = Math.atan2(-h, -A.e), th = -Math.PI + (th1 + Math.PI) * t;
  return { x: A.cx + A.e + r * Math.cos(th), y: A.ys + r * Math.sin(th), nx: Math.cos(th), ny: Math.sin(th), tx: -Math.sin(th), ty: Math.cos(th) };
}
const deg = (x, y) => (Math.atan2(x, -y) * 180) / Math.PI; // rotation that turns "up" into direction (x, y)
const mirror = (...kids) => g({}, ...kids) + g({ transform: `translate(${W} 0) scale(-1 1)` }, ...kids);

// ---- leaves & vines ----------------------------------------------------------------------------
/** Maps local leaf coordinates (tip toward -y) to the page. */
const xf = (x, y, rot) => { const a = (rot * Math.PI) / 180, c = Math.cos(a), s = Math.sin(a); return (px, py) => [x + px * c - py * s, y + px * s + py * c]; };
const C = (m, ...xy) => { const out = []; for (let i = 0; i < xy.length; i += 2) out.push(...m(xy[i], xy[i + 1])); return P(...out); };
/** Willow-like leaf from the origin; bend shifts the tip sideways. */
const leafD = (m, len, w, bend = 0) => `M${C(m, 0, 0)}C${C(m, w * 1.15, -len * 0.18, w * 0.95 + bend * 0.6, -len * 0.68, bend, -len)}`
  + `C${C(m, -w * 0.95 + bend * 0.6, -len * 0.68, -w * 1.15, -len * 0.18, 0, 0)}Z`;
const veinD = (m, len, bend = 0) => `M${C(m, 0, -len * 0.1)}Q${C(m, bend * 0.25, -len * 0.55, bend * 0.8, -len * 0.88)}`;
/** A batch of leaves [x, y, rot, len, w, bend] sharing one fill: one element each, veins merged into one path. */
function leaves(list, fill = 'url(#leaf)', ink = 1.6) {
  let body = '', veins = '';
  for (const [x, y, rot, len, w, bend = 0] of list) {
    const m = xf(x, y, rot);
    body += `<path d="${leafD(m, len, w, bend)}"/>`;
    veins += veinD(m, len, bend);
  }
  return g({ fill, stroke: INK, strokeWidth: ink, strokeLinejoin: 'round' }, body)
    + path(veins, { fill: 'none', stroke: '#fff', strokeOpacity: 0.85, strokeWidth: 1.4, strokeLinecap: 'round' });
}
/** Two-tone vine stroke (ink under silver). */
function vine(d, w = 3.5, col = 'url(#silverV)') {
  return path(d, { fill: 'none', stroke: INK, strokeWidth: w + 3, strokeLinecap: 'round', strokeLinejoin: 'round' })
    + path(d, { fill: 'none', stroke: col, strokeWidth: w, strokeLinecap: 'round', strokeLinejoin: 'round' });
}
/** Spiral tendril curl starting at (x, y) heading along rot. */
function curlD(x, y, r, dir = 1, rot = 0) {
  const pts = [], m = xf(x, y, rot);
  for (let i = 0; i <= 14; i++) { const t = i / 14, a = dir * t * Math.PI * 1.7, rr0 = r * (1 - t * 0.72); pts.push(m(dir * (r - rr0 * Math.cos(a)), -rr0 * Math.sin(a) * dir)); }
  return smooth(pts);
}

/** Star gem: faceted eight-point crystal with a soft halo. */
function starGem(cx, cy, R) {
  const pts = [];
  for (let i = 0; i < 16; i++) { const a = ((-90 + i * 22.5) * Math.PI) / 180, r = i % 2 ? R * 0.4 : (i % 4 ? R * 0.68 : R); pts.push([cx + r * Math.cos(a), cy + r * Math.sin(a)]); }
  let lit = '', dark = '';
  for (let i = 0; i < 16; i++) {
    const a = pts[i], b = pts[(i + 1) % 16], d = `M${P(cx, cy)}L${P(...a)}L${P(...b)}Z`;
    const mx = (a[0] + b[0]) / 2 - cx, my = (a[1] + b[1]) / 2 - cy;
    if ((mx * -0.6 + my * -0.8 > 0) === (i % 2 === 0)) lit += d; else dark += d;
  }
  return {
    back: g({},
      g({ class: 'ea-tw' }, path(circle(cx, cy, R * 2.8), { fill: 'url(#gemHalo)' })),
      path(sparkle(cx, cy, R * 2.6, 0.05), { fill: '#fff', fillOpacity: 0.3 }),
      path(sparkle(cx, cy, R * 1.8, 0.06), { fill: '#fff', fillOpacity: 0.26, transform: `rotate(45 ${cx} ${cy})` })),
    front: g({},
    path(poly(pts), { fill: 'url(#gem)' }),
    path(lit, { fill: '#fff', fillOpacity: 0.6 }),
    path(dark, { fill: '#5a3fb8', fillOpacity: 0.3 }),
    path(poly(pts), { fill: 'none', stroke: INK, strokeWidth: 2.5, strokeLinejoin: 'round' }),
    path(circle(cx, cy, R * 0.15), { fill: '#fff' }),
    path(sparkle(cx - R * 0.3, cy - R * 0.38, R * 0.32), { fill: '#fff' })),
  };
}

/** Moon lily: a little white star-flower with a glowing heart. */
function lily(x, y, s, rot = 0) {
  let petals = '';
  for (let i = 0; i < 6; i++) petals += `<path d="${leafD(xf(x, y, rot + i * 60), s, s * 0.32)}"/>`;
  return path(circle(x, y, s * 1.6), { fill: 'url(#lilyGlow)' })
    + g({ fill: 'url(#petal)', stroke: INK, strokeWidth: 1.4, strokeLinejoin: 'round' }, petals)
    + path(circle(x, y, s * 0.22), { fill: '#fff8c8', stroke: INK, strokeWidth: 1 });
}

// ---- parts -------------------------------------------------------------------------------------
/** The moon window filling the arch above the transom. */
function moonWindow() {
  const win = `${archD(-18)}Z`, ly = YS - 44;
  const rnd = rng(11), dots = [], twinkles = [];
  const OC = { x: CX, y: YS - 404, r: 112 };
  for (let i = 0; i < 80; i++) {
    const x = 250 + rnd() * 900, y = YS - 560 + rnd() * 520;
    if (Math.hypot(x - CX, y - OC.y) < 124) continue;
    if (i % 10 === 0) twinkles.push(sparkle(x, y, 5 + rnd() * 4)); else dots.push(circle(x, y, 0.8 + rnd() * 1.5));
  }
  // tracery: two pointed lancets under the oculus, a mullion and the oculus ring
  const lhs = 222, lcL = CX - 8 - lhs, lcR = CX + 8 + lhs;
  const LA = (cx) => ({ cx, ys: ly, hs: lhs, e: 70 });
  const tracery = archD(0, LA(lcL)) + archD(0, LA(lcR)) + circle(OC.x, OC.y, OC.r) + `M${CX} ${ly}V${n(OC.y + OC.r)}`;
  // crescent moon in the oculus
  const mr = 64, dx = 30, r2 = 58, xi = (mr * mr - r2 * r2 + dx * dx) / (2 * dx), yi = Math.sqrt(mr * mr - xi * xi);
  const crescent = `M${P(xi, -yi)}A${P(mr, mr)} 0 1 0 ${P(xi, yi)}A${P(r2, r2)} 0 0 1 ${P(xi, -yi)}Z`;
  // interlaced vine: rises up the mullion, then wraps the oculus both ways
  const vy = (t) => ly - t * (ly - OC.y - OC.r);
  const stem = smooth(Array.from({ length: 9 }, (_, i) => [CX + (i % 2 ? 14 : -14) * (i ? 1 : 0), vy(i / 8)]));
  const ringPt = (i, dir) => { const a = Math.PI / 2 + dir * (i / 12) * Math.PI * 0.96, r = OC.r + (i % 2 ? 13 : -13); return [OC.x + r * Math.cos(a), OC.y + r * Math.sin(a), a]; };
  const ring = (dir) => smooth(Array.from({ length: 13 }, (_, i) => ringPt(i, dir).slice(0, 2)));
  const lv = [];
  for (let i = 1; i < 12; i++) for (const dir of [-1, 1]) {
    const [x, y, a] = ringPt(i, dir);
    lv.push([x, y, deg(-Math.sin(a) * dir, Math.cos(a) * dir) + (i % 2 ? 50 : -50) * dir, 22, 7]);
  }
  for (let i = 1; i < 8; i++) lv.push([CX + (i % 2 ? 14 : -14), vy(i / 8), i % 2 ? 50 : -50, 22, 7]);
  // tendrils hugging the lancet heads (inside), with leaves and a curl where they start
  const lanceVines = [], lanceCurls = [];
  for (const lc of [lcL, lcR]) for (const side of [-1, 1]) {
    const pts = [];
    for (let i = 0; i <= 10; i++) {
      const p = arcAt(-17 + (i % 2 ? 5 : -5), 0.12 + i * 0.086, LA(lc));
      const x = side < 0 ? p.x : 2 * lc - p.x;
      pts.push([x, p.y]);
      if (i && i < 10 && i % 2) lv.push([x, p.y, deg(side * p.tx, p.ty) + side * 60, 18, 6]);
    }
    lanceVines.push(smooth(pts)); lanceCurls.push(curlD(pts[0][0], pts[0][1], 9, side, 180));
  }
  const flowers = [[CX - 262, YS - 420, 15], [CX + 262, YS - 420, 15], [CX - 160, YS - 520, 11], [CX + 160, YS - 520, 11], [CX - 330, YS - 330, 9], [CX + 330, YS - 330, 9], [CX, YS - 404 - 112, 13]];
  return g({},
    path(win, { fill: 'url(#sky)' }),
    g({ clipPath: 'url(#winClip)' },
      path(ellipse(CX, ly, 520, 210), { fill: 'url(#mist)' }),
      path(circle(OC.x, OC.y, 180), { fill: 'url(#moonGlow)' }),
      path(dots.join(''), { fill: '#fff', fillOpacity: 0.8 }),
      path(twinkles.join(''), { fill: '#efe8ff' }),
      g({ transform: `${tf(OC.x + 10, OC.y - 4)} rotate(-28)` }, path(crescent, { fill: 'url(#moon)', stroke: '#b7a8ec', strokeWidth: 1.5 })),
      // lancet glass: a tall leaf of pale lavender in each
      ...[lcL, lcR].map((cx) => path(leafD(xf(cx, ly - 16, 0), 236, 40), { fill: 'url(#pane)', stroke: '#d9cfff', strokeOpacity: 0.75, strokeWidth: 2 })
        + path(`M${cx} ${ly - 30}V${ly - 236}${[0.25, 0.42, 0.59, 0.76].map((u) => { const y = ly - 16 - 236 * u, hw = 40 * Math.sin(Math.PI * (u * 0.9 + 0.05)) * 0.8; return `M${n(cx - hw)} ${n(y + 14)}L${cx} ${n(y - 6)}L${n(cx + hw)} ${n(y + 14)}`; }).join('')}`,
          { fill: 'none', stroke: '#e9e2ff', strokeOpacity: 0.5, strokeWidth: 2, strokeLinejoin: 'round', strokeLinecap: 'round' })),
      path(tracery, { fill: 'none', stroke: INK, strokeWidth: 20, strokeLinejoin: 'round' }),
      path(tracery, { fill: 'none', stroke: 'url(#silverD)', strokeWidth: 14, strokeLinejoin: 'round' }),
      path(tracery, { fill: 'none', stroke: '#fff', strokeOpacity: 0.7, strokeWidth: 2.5, transform: 'translate(-2.5 -2.5)' }),
      vine(ring(1) + ring(-1) + stem), vine(lanceVines.join(''), 2.4), vine(lanceCurls.join(''), 2),
      leaves(lv),
      flowers.map(([x, y, s]) => lily(x, y, s, 15)).join('')),
    path(win, { fill: 'none', stroke: INK, strokeWidth: 3 }));
}

/** Silver transom over the doorway with a moonstone clasp. */
function transom() {
  const x0 = 212, x1 = W - 212, y0 = YS - 44, y1 = YS;
  return g({},
    path(rr(x0, y0 + 6, x1 - x0, y1 - y0, 6), { fill: INK, fillOpacity: 0.3 }),
    path(rr(x0, y0, x1 - x0, y1 - y0 + 4, 6), { fill: 'url(#stoneH)', stroke: INK, strokeWidth: 3 }),
    path(`M${x0 + 10} ${y0 + 7}H${x1 - 10}`, { stroke: '#fff', strokeOpacity: 0.9, strokeWidth: 3, strokeLinecap: 'round' }),
    path(`M${x0 + 30} ${y0 + 26}H${CX - 70}M${CX + 70} ${y0 + 26}H${x1 - 30}`, { stroke: '#a49cc8', strokeWidth: 2, strokeLinecap: 'round' }),
    path(ellipse(CX, y0 + 23, 42, 17), { fill: 'url(#stoneH)', stroke: INK, strokeWidth: 2.5 }),
    path(ellipse(CX, y0 + 23, 17, 11), { fill: 'url(#moonstone)', stroke: INK, strokeWidth: 2 }),
    path(ellipse(CX - 5, y0 + 19, 5, 3), { fill: '#fff', fillOpacity: 0.9 }),
    leaves([[CX - 42, y0 + 23, -96, 28, 7], [CX + 42, y0 + 23, 96, 28, 7]]));
}

/** The doorway bezel: the calm silver ring right around the screen. */
function bezel() {
  const holeD = rr(hole.x, hole.y, hole.w, hole.h, radius);
  return g({},
    path(rr(hole.x - 30, hole.y - 30, hole.w + 60, hole.h + 60, 26), { fill: 'url(#bezel)', stroke: INK, strokeWidth: 3 }),
    path(rr(hole.x - 22, hole.y - 22, hole.w + 44, hole.h + 44, 20), { fill: 'none', stroke: '#fff', strokeOpacity: 0.75, strokeWidth: 2 }),
    path(rr(hole.x - 11, hole.y - 11, hole.w + 22, hole.h + 22, 16), { fill: '#2a2450', stroke: '#8e86bd', strokeWidth: 2 }),
    lip(holeD, '#0c0820', [[5, 0.35], [2, 0.6]]));
}

/** Vine-wrapped column with a leaf capital and a moulded base (left; mirrored for the right). */
function column() {
  const { cx, w, top, bot } = COL, x0 = cx - w / 2;
  // spiral vine: back halves under the shaft, front halves over it
  const back = [], front = [], fl = [];
  const turns = 6, N = 96, A = w / 2 + 3;
  let seg = [], segFront = null;
  for (let i = 0; i <= N; i++) {
    const t = i / N, ph = t * turns * Math.PI * 2, y = bot - 30 - t * (bot - 30 - top - 6), x = cx + A * Math.sin(ph), isF = Math.cos(ph) > 0;
    if (segFront === null) segFront = isF;
    if (isF !== segFront) { (segFront ? front : back).push(seg); seg = [seg[seg.length - 1]]; segFront = isF; }
    seg.push([x, y]);
    if (i % 16 === 0 && i > 4 && i < N - 4) fl.push([x, y, -58, 24, 7.5, 4], [x, y, 44, 20, 6.5, -3]);
  }
  (segFront ? front : back).push(seg);
  const capY = YS + 14;
  const bell = `M${P(cx - w / 2, top)}C${P(cx - w / 2, top - 30, cx - 50, capY + 26, cx - 52, capY)}H${n(cx + 52)}C${P(cx + 50, capY + 26, cx + w / 2, top - 30, cx + w / 2, top)}Z`;
  const cap = [[-16, -56, 40, 10], [16, 56, 40, -10], [-9, -28, 48, 6], [9, 28, 48, -6], [0, 0, 52, 0]].map(([dx, rot, len, bend]) => [cx + dx, top + 6, rot, len, 11, bend]);
  return g({},
    path(rr(x0 + 10, top, w, bot - top, 4), { fill: '#1a1438', fillOpacity: 0.3 }),
    vine(back.map((s) => smooth(s)).join(''), 3.5, '#8e86bd'),
    path(rr(x0, top - 2, w, bot - top + 4, 3), { fill: 'url(#shaft)', stroke: INK, strokeWidth: 3 }),
    path(`M${x0 + 11} ${top + 10}V${bot - 10}`, { stroke: '#fff', strokeOpacity: 0.8, strokeWidth: 3, strokeLinecap: 'round' }),
    path(`M${x0 + w - 12} ${top + 10}V${bot - 10}`, { stroke: '#7e76aa', strokeOpacity: 0.6, strokeWidth: 2, strokeLinecap: 'round' }),
    vine(front.map((s) => smooth(s)).join(''), 3.5),
    leaves(fl),
    path(bell, { fill: 'url(#shaft)', stroke: INK, strokeWidth: 3 }),
    leaves(cap, 'url(#leafB)'),
    vine(curlD(cx - 46, capY + 30, 11, -1, 0) + curlD(cx + 46, capY + 30, 11, 1, 0), 2.4),
    path(rr(cx - 60, YS - 2, 120, 18, 5), { fill: 'url(#stoneH)', stroke: INK, strokeWidth: 3 }),
    path(`M${cx - 52} ${YS + 3}H${cx + 52}`, { stroke: '#fff', strokeOpacity: 0.9, strokeWidth: 2.5, strokeLinecap: 'round' }),
    path(rr(cx - 36, bot - 12, 72, 18, 9), { fill: 'url(#stoneH)', stroke: INK, strokeWidth: 3 }),
    path(rr(cx - 44, bot + 4, 88, 20, 6), { fill: 'url(#stoneH)', stroke: INK, strokeWidth: 3 }),
    path(rr(cx - 52, bot + 22, 104, 30, 5), { fill: 'url(#stoneV)', stroke: INK, strokeWidth: 3 }),
    path(`M${cx - 44} ${bot + 28}H${cx + 44}`, { stroke: '#fff', strokeOpacity: 0.8, strokeWidth: 2.5, strokeLinecap: 'round' }));
}

/** Left half of the archivolt ornament (mirrored): running vine, moonstones, curled-leaf crockets. */
function archHalf() {
  const pts = [], lv = [];
  for (let i = 0; i <= 22; i++) {
    const t = 0.02 + i * 0.0432, s = i % 2 ? 1 : -1, p = arcAt(BAND * 0.52 + s * 10, t);
    pts.push([p.x, p.y]);
    if (i && i < 22) lv.push([p.x, p.y, deg(p.tx, p.ty) + s * 50, 21, 6.5]);
  }
  const stones = [0.22, 0.5, 0.78].map((t) => { const p = arcAt(BAND * 0.52, t); return path(circle(p.x, p.y, 7.5), { fill: 'url(#moonstone)', stroke: INK, strokeWidth: 2 }) + path(circle(p.x - 2, p.y - 2.5, 2), { fill: '#fff' }); });
  // crockets: a sprig of three slender leaves fanning out from the outer edge, leaning toward the apex
  const crk = [], crk2 = [], curls = [];
  for (let i = 0; i < 8; i++) {
    const t = 0.07 + i * 0.112, p = arcAt(BAND - 8, t), rot = deg(p.nx * 0.7 + p.tx * 0.7, p.ny * 0.7 + p.ty * 0.7);
    crk.push([p.x, p.y, rot, 50, 10, -12]);
    crk2.push([p.x, p.y, rot - 46, 36, 8, 6], [p.x, p.y, rot + 34, 30, 7, -8]);
    curls.push(curlD(p.x + p.nx * 10, p.y + p.ny * 10, 9, -1, rot - 120));
  }
  return g({}, vine(smooth(pts), 3), leaves(lv), stones.join(''), vine(curls.join(''), 2.2), leaves(crk2), leaves(crk, 'url(#leafB)'));
}

function archivolt() {
  const band = bandD(0, BAND), top = apexY(BAND), keyY = apexY(0);
  const mould = (d, col, w, a = 1) => path(archD(d), { fill: 'none', stroke: col, strokeOpacity: a, strokeWidth: w });
  const gy = top - 76, gem = starGem(CX, gy, 56);
  // a small crescent cradling the star gem (horns up)
  const cr = 58, cdx = 22, cr2 = 52, cxi = (cr * cr - cr2 * cr2 + cdx * cdx) / (2 * cdx), cyi = Math.sqrt(cr * cr - cxi * cxi);
  const cradle = `M${P(cxi, -cyi)}A${P(cr, cr)} 0 1 0 ${P(cxi, cyi)}A${P(cr2, cr2)} 0 0 1 ${P(cxi, -cyi)}Z`;
  return g({},
    path(band, { fill: '#1a1438', fillOpacity: 0.3, transform: 'translate(8 10)' }),
    path(band, { fill: 'url(#stone)', stroke: INK, strokeWidth: 3, strokeLinejoin: 'round' }),
    mould(14, INK, 1.5, 0.45), mould(17, '#fff', 2.5, 0.85),
    mould(BAND - 14, '#fff', 2.5, 0.85), mould(BAND - 11, INK, 1.5, 0.45),
    mirror(archHalf()),
    gem.back,
    // apex: a leafy finial on a slender stem lifts the crescent and the star gem, over a carved keystone
    vine(`M${CX} ${n(top + 16)}V${n(gy + 30)}`, 4),
    leaves([[CX - 6, top + 26, -58, 78, 15, -18], [CX + 6, top + 26, 58, 78, 15, 18]], 'url(#leafB)'),
    leaves([[CX - 4, top + 18, -24, 56, 11, -6], [CX + 4, top + 18, 24, 56, 11, 6]]),
    path(cradle, { fill: 'url(#moon)', stroke: INK, strokeWidth: 2.5, transform: `${tf(CX, gy + 20)} rotate(-90)` }),
    path(`M${P(CX - 24, keyY - 16)}L${P(CX, top + 4)}L${P(CX + 24, keyY - 16)}L${P(CX, keyY + 14)}Z`, { fill: 'url(#stoneH)', stroke: INK, strokeWidth: 2.5, strokeLinejoin: 'round' }),
    path(ellipse(CX, (top + keyY) / 2 + 2, 9, 14), { fill: 'url(#moonstone)', stroke: INK, strokeWidth: 2 }),
    path(ellipse(CX - 3, (top + keyY) / 2 - 3, 3, 4), { fill: '#fff' }),
    gem.front);
}

/** Strands of silver leaves hanging outside the columns from the arch shoulders. */
function hangingLeaves() {
  // each strand starts at a crocket and swings out beside the column before it drops
  const strands = [[0.07, 400, 30], [0.182, 560, 64], [0.294, 330, 92]], out = [], lv = [];
  strands.forEach(([t, len, swing], k) => {
    const p = arcAt(BAND + 6, t), x0 = p.x, y0 = p.y, pts = [];
    for (let i = 0; i <= 12; i++) { const u = i / 12; pts.push([x0 - swing * Math.sin(Math.min(1, u * 2.2) * Math.PI / 2) + 7 * Math.sin(u * 8 + k), y0 + 20 + len * u]); }
    out.push(vine(smooth(pts), 2.4));
    for (let i = 1; i <= 11; i++) {
      const [x, y] = pts[i], s = i % 2 ? 1 : -1;
      lv.push([x, y, 180 + s * (36 + 12 * Math.sin(i * 1.7 + k)), 30 - i * 0.9, 9, s * 4]);
    }
    const [ex, ey] = pts[12];
    out.push(g({ class: k % 2 ? 'ea-tw2' : 'ea-tw' }, path(circle(ex, ey + 12, 16), { fill: 'url(#dropGlow)' })),
      path(`M${P(ex, ey)}Q${P(ex + 8, ey + 12, ex, ey + 22)}Q${P(ex - 8, ey + 12, ex, ey)}Z`, { fill: 'url(#moonstone)', stroke: INK, strokeWidth: 1.5 }),
      path(circle(ex - 2, ey + 10, 1.8), { fill: '#fff' }));
  });
  return mirror(...out, leaves(lv));
}

/** Stepped stone landing with moon lilies and fern fronds. */
function steps() {
  const y = STEP_Y;
  const fern = (x, y0, s, rot) => {
    const m = xf(x, y0, rot), stem = smooth([m(0, 0), m(8 * s, -44 * s), m(0, -90 * s)]);
    const lv = [0.2, 0.36, 0.52, 0.68, 0.84].map((u, i) => { const [px, py] = m(4 * s * Math.sin(u * 3), -90 * s * u); return [px, py, rot + (i % 2 ? 1 : -1) * 66, (26 - i * 3) * s, 6 * s]; });
    return vine(stem, 2.4) + leaves(lv);
  };
  return g({},
    path(rr(118, y, W - 236, 40, 8), { fill: 'url(#stoneV)', stroke: INK, strokeWidth: 3 }),
    path(`M130 ${y + 6}H1270`, { stroke: '#fff', strokeOpacity: 0.85, strokeWidth: 3, strokeLinecap: 'round' }),
    path(rr(72, y + 34, W - 144, 44, 10), { fill: 'url(#stoneV)', stroke: INK, strokeWidth: 3 }),
    path(`M86 ${y + 40}H1314`, { stroke: '#fff', strokeOpacity: 0.85, strokeWidth: 3, strokeLinecap: 'round' }),
    path([400, 560, 840, 1000].map((x) => `M${x} ${y + 42}V${y + 74}`).join(''), { stroke: '#9d96c0', strokeWidth: 2 }),
    mirror(fern(104, y + 18, 1, -26), fern(126, y + 14, 0.7, 8),
      lily(92, y + 22, 17, 10), lily(140, y + 26, 11, -20), lily(96, y + 60, 12, 30)));
}

function draw() {
  const defs = [
    '<style>.ea-tw,.ea-tw2{animation:ea-tw 4s ease-in-out infinite}.ea-tw2{animation-delay:-2s}'
      + '@keyframes ea-tw{0%,100%{opacity:1}50%{opacity:.5}}@media (prefers-reduced-motion:reduce){*{animation:none!important}}</style>',
    lg('stone', [0, 0, 1, 1], [[0, '#ffffff'], [0.35, '#ece9f7'], [0.75, '#c9c3e2'], [1, '#a59ec8']]),
    lg('stoneH', [0, 0, 0, 1], [[0, '#ffffff'], [0.5, '#e4e0f2'], [1, '#aea8cf']]),
    lg('stoneV', [0, 0, 0, 1], [[0, '#f6f4fc'], [0.6, '#d8d3ec'], [1, '#a7a0c9']]),
    lg('shaft', [0, 0, 1, 0], [[0, '#c3bddc'], [0.25, '#ffffff'], [0.6, '#e2deef'], [1, '#9890be']]),
    lg('bezel', [0, 0, 1, 1], [[0, '#ffffff'], [0.45, '#e3dff1'], [1, '#b3acd2']]),
    lg('wall', [0, 0, 0, 1], [[0, '#7d75ab'], [1, '#544c88']]),
    lg('silverV', [0, 0, 1, 1], [[0, '#ffffff'], [0.5, '#dcd8ee'], [1, '#a7a0cb']]),
    lg('silverD', [0, 0, 1, 1], [[0, '#ffffff'], [0.4, '#e2def2'], [1, '#9f98c6']]),
    lg('leaf', [0, 0, 1, 1], [[0, '#ffffff'], [0.5, '#dedaf0'], [1, '#a9a2cc']]),
    lg('leafB', [0, 0, 1, 1], [[0, '#ffffff'], [0.45, '#e8e3f8'], [1, '#b6a6ee']]),
    lg('petal', [0, 0, 0, 1], [[0, '#ffffff'], [1, '#e2d9ff']]),
    lg('sky', [0, YS - 580, 0, YS - 40], [[0, '#1b1640'], [0.55, '#2f2766'], [1, '#6d5cb0']], true),
    lg('pane', [0, 0, 0, 1], [[0, '#c4b4ff', 0.4], [1, '#7d68d8', 0.18]]),
    rg('moon', [0.35, 0.35, 0.8], [[0, '#ffffff'], [0.6, '#f3efff'], [1, '#cfc4f6']]),
    rg('moonGlow', [0.5, 0.5, 0.5], [[0, '#e6dcff', 0.55], [0.5, '#b9a6ff', 0.2], [1, '#b9a6ff', 0]]),
    rg('mist', [0.5, 0.5, 0.5], [[0, '#c9b8ff', 0.45], [1, '#c9b8ff', 0]]),
    rg('moonHaze', [0.5, 0.42, 0.5], [[0, '#c7b6ff', 0.34], [0.55, '#a48ef0', 0.14], [1, '#a48ef0', 0]]),
    rg('floorGlow', [0.5, 0.5, 0.5], [[0, '#3a2f7a', 0.35], [1, '#3a2f7a', 0]]),
    rg('gem', [0.4, 0.35, 0.75], [[0, '#ffffff'], [0.45, '#e4dbff'], [1, '#9a80f0']]),
    rg('gemHalo', [0.5, 0.5, 0.5], [[0, '#efe8ff', 0.38], [0.4, '#c3b0ff', 0.18], [1, '#c3b0ff', 0]]),
    rg('moonstone', [0.38, 0.32, 0.8], [[0, '#ffffff'], [0.45, '#dcd2ff'], [1, '#8f78e6']]),
    rg('dropGlow', [0.5, 0.5, 0.5], [[0, '#e6dcff', 0.38], [1, '#e6dcff', 0]]),
    rg('lilyGlow', [0.5, 0.5, 0.5], [[0, '#fff6c8', 0.38], [1, '#fff6c8', 0]]),
    `<clipPath id="winClip"><path d="${archD(-18)}Z"/></clipPath>`,
  ].join('');

  const rnd = rng(5), motes = [];
  for (let i = 0; i < 30; i++) {
    const x = rnd() * W, y = 40 + rnd() * (STEP_Y - 60);
    if (x > 110 && x < W - 110 && y > apexY(BAND) + Math.abs(x - CX) * 0.6) continue;
    motes.push(i % 4 ? circle(x, y, 1.5 + rnd() * 2) : sparkle(x, y, 7 + rnd() * 6));
  }
  const body = [
    path(ellipse(CX, YS - 200, 700, 760), { fill: 'url(#moonHaze)' }),
    path(ellipse(CX, STEP_Y + 64, 640, 60), { fill: 'url(#floorGlow)' }),
    path(motes.join(''), { fill: '#f1ecff', fillOpacity: 0.9 }),
    path(rr(150, YS, W - 300, STEP_Y + 10 - YS, 0), { fill: 'url(#wall)' }),
    path(`${archD(0)}Z`, { fill: 'url(#stone)' }),
    moonWindow(),
    bezel(),
    mirror(column()),
    transom(),
    archivolt(),
    hangingLeaves(),
    steps(),
    path(sparkle(64, 300, 16), { fill: '#fff' }), path(sparkle(1336, 230, 12), { fill: '#e6dcff' }),
    path(sparkle(1352, 640, 9), { fill: '#fff' }), path(sparkle(44, 760, 10), { fill: '#e6dcff' }),
  ].join('\n');
  // one decimal is plenty for path data at this size
  return { defs, body: body.replace(/ d="[^"]*"/g, (m) => m.replace(/(\.\d)\d+/g, '$1')) };
}

module.exports = {
  W, H, hole, radius, draw,
  meta: {
    name: 'Elven Arch', theme: 'high-fantasy', rarity: 'legendary', translucent: false, collection: 'legends-dread', license: 'CC-BY-4.0',
    desc: 'Step through a moon-white elven gateway where silver leaves whisper, vines weave the tracery and a star gem keeps watch.',
    tags: ['fantasy', 'elven', 'moonlight', 'silver', 'lavender', 'arch', 'nature'],
  },
};
