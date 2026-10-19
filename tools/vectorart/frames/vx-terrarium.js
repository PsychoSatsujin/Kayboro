'use strict';
// Terrarium: a glass bell-jar garden. The screen hangs in a polished brass frame staked into a mossy
// mound inside a clear domed cloche: fern fronds arch up the sides and over the top, a curled fiddlehead
// unrolls, a heart-leaf clump and a pancake plant fill the corners, red-capped and tan mushrooms, smooth
// pebbles, a ladybug and a little snail sit on the moss above layered soil, charcoal and gravel, all under
// glass with glare streaks and beads of condensation. Brass collar and finial, walnut plinth with a
// blank brass plaque. Original Kayboro artwork, CC BY 4.0.
const L = require('../lib');
const { rr, path, g, lg, rg, circle, ellipse, tf, rng, lip } = L;

const W = 1400, H = 1550, hole = { x: 340, y: 446, w: 720, h: 540 }, radius = 26;
const INK = '#1f2a1d';
const CX = W / 2;
// glass dome: walls x 140..1260, shoulders at y 620, crown at y 150
const DX0 = 140, DX1 = 1260, DY = 620, DRY = 470, DBOT = 1316, DR = (DX1 - DX0) / 2;
const DOME = `M${DX0} ${DBOT}V${DY}A${DR} ${DRY} 0 0 1 ${DX1} ${DY}V${DBOT}Z`;
const BZ = 30; // brass bezel width around the screen
const SOIL = 1196; // top of the soil layer

// ---- helpers -------------------------------------------------------------------------------------
const n1 = (v) => +(+v).toFixed(1);
const P1 = (...v) => v.map(n1).join(' ');
function cr(pts, { closed = false, move = true } = {}) {
  const k = 1 / 6, p = closed ? [pts[pts.length - 1], ...pts, pts[0], pts[1]] : [pts[0], ...pts, pts[pts.length - 1]];
  let d = `${move ? 'M' : 'L'}${P1(...pts[0])}`;
  for (let i = 1; i < p.length - 2; i++) {
    const [x0, y0] = p[i - 1], [x1, y1] = p[i], [x2, y2] = p[i + 1], [x3, y3] = p[i + 2];
    d += `C${P1(x1 + (x2 - x0) * k, y1 + (y2 - y0) * k, x2 - (x3 - x1) * k, y2 - (y3 - y1) * k, x2, y2)}`;
  }
  return closed ? `${d}Z` : d;
}
function resample(pts, m) {
  const p = [pts[0], ...pts, pts[pts.length - 1]], dense = [];
  for (let i = 1; i < p.length - 2; i++) {
    const [a, b, c, d] = [p[i - 1], p[i], p[i + 1], p[i + 2]];
    for (let s = 0; s < 1; s += 1 / 20) {
      const s2 = s * s, s3 = s2 * s;
      dense.push([0, 1].map((j) => 0.5 * ((2 * b[j]) + (-a[j] + c[j]) * s + (2 * a[j] - 5 * b[j] + 4 * c[j] - d[j]) * s2 + (-a[j] + 3 * b[j] - 3 * c[j] + d[j]) * s3)));
    }
  }
  dense.push(pts[pts.length - 1]);
  const len = [0];
  for (let i = 1; i < dense.length; i++) len.push(len[i - 1] + Math.hypot(dense[i][0] - dense[i - 1][0], dense[i][1] - dense[i - 1][1]));
  const out = [], tot = len[len.length - 1];
  for (let k = 0, j = 0; k < m; k++) {
    const t = (tot * k) / (m - 1);
    while (j < len.length - 2 && len[j + 1] < t) j++;
    const u = (t - len[j]) / (len[j + 1] - len[j] || 1);
    out.push([dense[j][0] + (dense[j + 1][0] - dense[j][0]) * u, dense[j][1] + (dense[j + 1][1] - dense[j][1]) * u]);
  }
  return out;
}
const inBezel = (x, y, pad = 0) => x > hole.x - BZ - pad && x < hole.x + hole.w + BZ + pad && y > hole.y - BZ - pad && y < hole.y + hole.h + BZ + pad;
/** Local frame helper: T(u, v) maps along-angle coordinates to absolute "x y". */
const frame = (x, y, a) => { const c = Math.cos(a), s = Math.sin(a); return (u, v) => P1(x + u * c - v * s, y + u * s + v * c); };

// ---- plants --------------------------------------------------------------------------------------
/** A slender pointed leaflet from (x, y) along angle a (radians), length l, half-width w, bending by b. */
const leafD = (x, y, a, l, w, b = 0.15) => {
  const T = frame(x, y, a);
  return `M${T(0, 0)}C${T(l * 0.25, -w * 1.1)} ${T(l * 0.7, -w * 0.9 + l * b * 0.5)} ${T(l, l * b)}C${T(l * 0.7, w * 0.9 + l * b * 0.5)} ${T(l * 0.25, w * 1.1)} ${T(0, 0)}Z`;
};

/** Fern frond along a rachis through pts: paired leaflets, longest low down, tapering to the tip. */
function frond(pts, leaf, { pairs = 18, angle = 58, fill = 'url(#fern)', fiddle = 0 } = {}) {
  const m = pairs + 2, R = resample(pts, m), sp = (angle * Math.PI) / 180;
  let leaves = '', veins = '';
  for (let i = 1; i < m - 1; i++) {
    const [x, y] = R[i], [x2, y2] = R[i + 1], t = i / (m - 1), a = Math.atan2(y2 - y, x2 - x);
    const l = leaf * Math.sin(Math.PI * (0.14 + 0.84 * t)) ** 0.55 * (1 - t * 0.45), w = l * 0.27;
    leaves += leafD(x, y, a - sp, l, w, -0.12) + leafD(x, y, a + sp, l, w, 0.12);
    for (const s of [-1, 1]) veins += `M${P1(x, y)}L${P1(x + Math.cos(a + s * sp) * l * 0.8, y + Math.sin(a + s * sp) * l * 0.8)}`;
  }
  let curl = '';
  if (!fiddle) { // a terminal leaflet so the rachis does not end bare
    const [ex, ey] = R[m - 1], [px, py] = R[m - 2], l = leaf * 0.3;
    leaves += leafD(px, py, Math.atan2(ey - py, ex - px), Math.hypot(ex - px, ey - py) + l, l * 0.26, 0);
  }
  if (fiddle) { // young frond tip rolled into a crozier
    const [ex, ey] = R[m - 1], [px, py] = R[m - 2], a0 = Math.atan2(ey - py, ex - px), sg = Math.sign(fiddle), r0 = Math.abs(fiddle);
    const cx = ex + Math.cos(a0 + sg * Math.PI / 2) * r0, cy = ey + Math.sin(a0 + sg * Math.PI / 2) * r0, st = Math.atan2(ey - cy, ex - cx), spiral = [];
    for (let k = 0; k <= 30; k++) { const t = k / 30, r = r0 * (1 - t * 0.82), a = st + sg * t * 5.4; spiral.push([cx + Math.cos(a) * r, cy + Math.sin(a) * r]); }
    const d = `M${spiral.map((q) => P1(...q)).join('L')}`;
    curl = path(d, { fill: 'none', stroke: INK, strokeWidth: 12, strokeLinecap: 'round', strokeLinejoin: 'round' })
      + path(d, { fill: 'none', stroke: '#8ccf5a', strokeWidth: 6.5, strokeLinecap: 'round', strokeLinejoin: 'round' });
  }
  const stem = cr(R);
  return g({},
    path(leaves, { fill, stroke: INK, strokeWidth: 2.2, strokeLinejoin: 'round' }),
    path(veins, { fill: 'none', stroke: '#d6f2a8', strokeOpacity: 0.45, strokeWidth: 1.6, strokeLinecap: 'round' }),
    path(stem, { fill: 'none', stroke: INK, strokeWidth: 7, strokeLinecap: 'round' }),
    path(stem, { fill: 'none', stroke: '#6a9a3a', strokeWidth: 3.5, strokeLinecap: 'round' }),
    curl);
}

/** Grass-like blades from a base point: [angle deg, length, half-width, bend]. */
function blades(x, y, list) {
  return list.map(([a, l, w, b]) => {
    const T = frame(x, y, (a * Math.PI) / 180);
    return `M${T(0, -w)}Q${T(l * 0.5, -w * 0.8 + b * 0.3)} ${T(l, b)}Q${T(l * 0.5, w * 0.8 + b * 0.3)} ${T(0, w)}Z`;
  }).join('');
}

/** A pothos-like clump: stems from (x, y) ending in heart leaves [stem angle, stem length, leaf angle, size]. */
function heartPlant(x, y, list) {
  let stems = '', leaves = '', veins = '';
  for (const [a, sl, la, s] of list) {
    const r = (a * Math.PI) / 180, ex = x + Math.cos(r) * sl, ey = y + Math.sin(r) * sl;
    stems += `M${P1(x, y)}Q${P1(x + Math.cos(r) * sl * 0.5 + 12, y + Math.sin(r) * sl * 0.5)} ${P1(ex, ey)}`;
    const T = frame(ex, ey, (la * Math.PI) / 180);
    leaves += `M${T(0, 0)}C${T(-s * 0.2, -s * 0.52)} ${T(s * 0.45, -s * 0.74)} ${T(s, 0)}C${T(s * 0.45, s * 0.74)} ${T(-s * 0.2, s * 0.52)} ${T(0, 0)}Z`;
    veins += `M${T(s * 0.03, 0)}Q${T(s * 0.5, s * 0.03)} ${T(s * 0.88, 0)}`;
    for (const k of [0.2, 0.42, 0.62]) for (const sg of [-1, 1]) veins += `M${T(s * k, 0)}Q${T(s * (k + 0.1), sg * s * 0.12)} ${T(s * (k + 0.2), sg * s * 0.3)}`;
  }
  return path(stems, { fill: 'none', stroke: INK, strokeWidth: 7, strokeLinecap: 'round' })
    + path(stems, { fill: 'none', stroke: '#5f9a3a', strokeWidth: 3.5, strokeLinecap: 'round' })
    + path(leaves, { fill: 'url(#heart)', stroke: INK, strokeWidth: 3, strokeLinejoin: 'round' })
    + path(veins, { fill: 'none', stroke: '#e6f7b8', strokeOpacity: 0.55, strokeWidth: 2.2, strokeLinecap: 'round' });
}

/** A pancake-leaf plant: round leaves [x, y, r] on thin stalks from (x, y). */
function coinPlant(x, y, list) {
  let stalks = '', leaves = '', spokes = '', glints = '';
  for (const [ex, ey, r] of list) {
    stalks += `M${P1(x, y)}Q${P1((x + ex) / 2 + 8, Math.max(y, ey) - 10)} ${P1(ex, ey + r * 0.12)}`;
    leaves += ellipse(ex, ey, r, r * 0.86);
    for (let k = 0; k < 7; k++) { const a = (k / 7) * Math.PI * 2 + 0.3; spokes += `M${P1(ex, ey + r * 0.12)}L${P1(ex + Math.cos(a) * r * 0.7, ey + r * 0.12 + Math.sin(a) * r * 0.6)}`; }
    glints += `M${P1(ex - r * 0.6, ey - r * 0.2)}Q${P1(ex - r * 0.5, ey - r * 0.6, ex - r * 0.1, ey - r * 0.7)}`;
  }
  return path(stalks, { fill: 'none', stroke: INK, strokeWidth: 6, strokeLinecap: 'round' })
    + path(stalks, { fill: 'none', stroke: '#79a84a', strokeWidth: 3, strokeLinecap: 'round' })
    + path(leaves, { fill: 'url(#coin)', stroke: INK, strokeWidth: 3 })
    + path(spokes, { fill: 'none', stroke: '#2f6a2a', strokeOpacity: 0.35, strokeWidth: 1.8, strokeLinecap: 'round' })
    + path(glints, { fill: 'none', stroke: '#fff', strokeOpacity: 0.55, strokeWidth: 3, strokeLinecap: 'round' });
}

function ladybug(x, y, rot, s = 1) {
  return g({ transform: tf(x, y, rot, s) },
    path(circle(-12, 0, 7), { fill: INK }),
    path(ellipse(2, 0, 14, 12), { fill: 'url(#capRed)', stroke: INK, strokeWidth: 2.5 }),
    path('M-10 0H15', { stroke: INK, strokeWidth: 2 }),
    path(circle(4, -6, 2.6) + circle(4, 6, 2.6) + circle(10, -2, 2) + circle(10, 3, 2), { fill: INK }),
    path(ellipse(0, -6, 4, 2), { fill: '#fff', fillOpacity: 0.7 }));
}

/** A cushion of moss along the mound line: overlapping puffs in three greens with speckle texture. */
function moss(line, seed) {
  const rnd = rng(seed), pts = resample(line, 64);
  const back = [], mid = [], front = [], spk = [];
  for (const [x, y] of pts) {
    back.push(circle(x + (rnd() - 0.5) * 20, y + 4 + rnd() * 8, 22 + rnd() * 18));
    mid.push(circle(x + (rnd() - 0.5) * 24, y + 24 + rnd() * 10, 18 + rnd() * 14));
    front.push(circle(x + (rnd() - 0.5) * 24, y + 46 + rnd() * 12, 16 + rnd() * 12));
    for (let k = 0; k < 2; k++) spk.push(`M${P1(x + (rnd() - 0.5) * 40, y + rnd() * 56)}h0`);
  }
  return g({},
    path(back.join(''), { fill: '#3e7a2e', stroke: INK, strokeWidth: 3 }),
    path(back.join(''), { fill: '#3e7a2e' }),
    path(mid.join(''), { fill: 'url(#mossMid)' }),
    path(front.join(''), { fill: 'url(#mossFront)' }),
    path(spk.join(''), { stroke: '#c8ee8a', strokeOpacity: 0.7, strokeWidth: 4, strokeLinecap: 'round' }));
}

function mushroom(x, y, h, cw, kind = 'red', lean = 0) {
  const ch = cw * 0.62, red = kind === 'red';
  const stem = `M${P1(x - cw * 0.16, y)}C${P1(x - cw * 0.2, y - h * 0.5, x - cw * 0.1, y - h * 0.85, x - cw * 0.12, y - h)}H${n1(x + cw * 0.12)}C${P1(x + cw * 0.1, y - h * 0.85, x + cw * 0.2, y - h * 0.5, x + cw * 0.16, y)}Z`;
  const capD = `M${P1(x - cw * 0.5, y - h + 4)}C${P1(x - cw * 0.52, y - h - ch * 1.1, x + cw * 0.52, y - h - ch * 1.1, x + cw * 0.5, y - h + 4)}Q${P1(x, y - h - ch * 0.12, x - cw * 0.5, y - h + 4)}Z`;
  const spots = [[-0.24, -0.55, 0.07], [0.08, -0.72, 0.09], [0.28, -0.42, 0.06], [-0.05, -0.36, 0.05]].map(([u, v, r]) => circle(x + u * cw, y - h + v * ch, r * cw)).join('');
  return g({ transform: lean ? `rotate(${lean} ${x} ${y})` : null },
    path(stem, { fill: 'url(#stem)', stroke: INK, strokeWidth: 3 }),
    path(`M${P1(x - cw * 0.3, y - h + 2)}Q${P1(x, y - h + ch * 0.16, x + cw * 0.3, y - h + 2)}`, { fill: 'none', stroke: '#b9a27c', strokeWidth: 3 }),
    path(capD, { fill: red ? 'url(#capRed)' : 'url(#capTan)', stroke: INK, strokeWidth: 3.5, strokeLinejoin: 'round' }),
    red ? path(spots, { fill: '#fff6e4' })
      : path(`M${P1(x - cw * 0.3, y - h - ch * 0.3)}Q${P1(x, y - h - ch * 0.62, x + cw * 0.3, y - h - ch * 0.3)}`, { fill: 'none', stroke: '#fff1d0', strokeOpacity: 0.6, strokeWidth: 3, strokeLinecap: 'round' }),
    path(`M${P1(x - cw * 0.34, y - h - ch * 0.42)}Q${P1(x - cw * 0.22, y - h - ch * 0.7, x - cw * 0.04, y - h - ch * 0.78)}`, { fill: 'none', stroke: '#fff', strokeOpacity: 0.75, strokeWidth: 3.5, strokeLinecap: 'round' }));
}

function pebble(x, y, rx, ry, tone = 'pebble', rot = 0) {
  return g({ transform: rot ? `rotate(${rot} ${x} ${y})` : null },
    path(ellipse(x, y, rx, ry), { fill: `url(#${tone})`, stroke: INK, strokeWidth: 3 }),
    path(ellipse(x - rx * 0.3, y - ry * 0.4, rx * 0.32, ry * 0.18), { fill: '#fff', fillOpacity: 0.55 }));
}

function snail(x, y, s = 1) {
  const sp = [];
  for (let k = 0; k <= 40; k++) { const t = k / 40, a = -0.4 + t * 9.6, r = 40 * (1 - t * 0.9); sp.push([8 + Math.cos(a) * r, -44 + Math.sin(a) * r]); }
  return g({ transform: tf(x, y, 0, s) },
    path(ellipse(4, 4, 84, 8), { fill: INK, fillOpacity: 0.25 }),
    // slime trail glint behind
    path('M70 0Q120 -2 170 4', { fill: 'none', stroke: '#fff', strokeOpacity: 0.55, strokeWidth: 3, strokeLinecap: 'round' }),
    // foot and head with eye stalks (crawling left)
    path('M70 2C40 6 -20 6 -58 0C-76 -2 -86 -14 -84 -28C-82 -44 -66 -52 -54 -46C-46 -42 -44 -30 -40 -20C-20 -16 30 -14 70 -10Q82 -4 70 2Z', { fill: 'url(#snailBody)', stroke: INK, strokeWidth: 3.5, strokeLinejoin: 'round' }),
    path('M-66 -46Q-74 -66 -84 -80M-56 -48Q-58 -70 -60 -86', { fill: 'none', stroke: INK, strokeWidth: 7, strokeLinecap: 'round' }),
    path('M-66 -46Q-74 -66 -84 -80M-56 -48Q-58 -70 -60 -86', { fill: 'none', stroke: '#d9d9a6', strokeWidth: 3.5, strokeLinecap: 'round' }),
    path(circle(-84, -82, 6) + circle(-60, -88, 6), { fill: '#d9d9a6', stroke: INK, strokeWidth: 3 }),
    path(circle(-70, -30, 3.6), { fill: INK }), path(circle(-69, -31, 1.3), { fill: '#fff' }),
    path('M-78 -18Q-73 -13 -68 -18', { fill: 'none', stroke: INK, strokeWidth: 2.4, strokeLinecap: 'round' }),
    path(ellipse(-60, -22, 6, 3.5), { fill: '#ff8f8f', fillOpacity: 0.55 }),
    // shell
    path(circle(8, -44, 46), { fill: 'url(#shell)', stroke: INK, strokeWidth: 4 }),
    path(`M${sp.map((q) => P1(...q)).join('L')}`, { fill: 'none', stroke: '#7a3e14', strokeWidth: 4, strokeLinecap: 'round' }),
    path('M-22 -70A40 40 0 0 1 20 -86', { fill: 'none', stroke: '#fff', strokeOpacity: 0.7, strokeWidth: 5, strokeLinecap: 'round' }));
}

/** Layered soil seen through the glass: earth, charcoal and gravel under the moss. */
function strata() {
  const rnd = rng(17), y1 = SOIL + 58, y2 = SOIL + 80;
  const soilTop = [[DX0, SOIL - 10], [320, SOIL + 4], [520, SOIL - 2], [700, SOIL + 8], [880, SOIL], [1080, SOIL + 6], [DX1, SOIL - 8]];
  const soil = `${cr(soilTop)}V${DBOT}H${DX0}Z`;
  const char = `M${DX0} ${y1}Q420 ${y1 - 8} ${CX} ${y1 + 2}T${DX1} ${y1 - 2}V${DBOT}H${DX0}Z`;
  const grav = `M${DX0} ${y2}Q440 ${y2 - 6} ${CX} ${y2 + 2}T${DX1} ${y2 - 2}V${DBOT}H${DX0}Z`;
  const stones = [], chunks = [], specks = [];
  for (let x = DX0 + 10; x < DX1; x += 16 + rnd() * 10) stones.push(ellipse(x, y2 + 16 + rnd() * (DBOT - y2 - 24), 9 + rnd() * 7, 7 + rnd() * 4));
  for (let x = DX0 + 10; x < DX1; x += 22 + rnd() * 18) chunks.push(`M${P1(x, y1 + 8 + rnd() * 6)}l${P1(6 + rnd() * 8, -4)}l4 7l-9 3Z`);
  for (let i = 0; i < 80; i++) specks.push(`M${P1(DX0 + rnd() * (DX1 - DX0), SOIL + 18 + rnd() * 36)}h0`);
  return g({},
    path(soil, { fill: 'url(#soil)' }),
    path(specks.join(''), { stroke: '#a77a4c', strokeOpacity: 0.6, strokeWidth: 4, strokeLinecap: 'round' }),
    path(char, { fill: '#2a2628' }),
    path(chunks.join(''), { fill: '#4a4448' }),
    path(grav, { fill: '#6f7a80' }),
    path(stones.join(''), { fill: 'url(#gravel)', stroke: '#3b4448', strokeWidth: 2 }));
}

// ---- glass, brass and wood -----------------------------------------------------------------------
function droplets() {
  const rnd = rng(41), body = [], hi = [], sh = [];
  let placed = 0;
  for (let i = 0; i < 900 && placed < 110; i++) {
    const x = DX0 + 18 + rnd() * (DX1 - DX0 - 36), y = 170 + rnd() * 1080;
    const dy = (y - DY) / DRY, dx = (x - CX) / DR;
    if (y < DY && dx * dx + dy * dy > 0.88) continue; // stay on the dome
    if (inBezel(x, y, 14)) continue;
    if (rnd() > (y < 520 ? 1 : 0.3)) continue; // denser fog toward the crown
    const r = 3.5 + rnd() * rnd() * 10;
    body.push(circle(x, y, r));
    if (r > 6) sh.push(`M${P1(x + r * 0.75, y - r * 0.45)}A${P1(r, r)} 0 0 1 ${P1(x - r * 0.6, y + r * 0.75)}`);
    hi.push(`M${P1(x - r * 0.35, y - r * 0.38)}h0`);
    placed++;
  }
  const D = [[206, 600, 80], [1196, 720, 96], [1170, 400, 58], [232, 900, 64], [1214, 1000, 70]];
  const trails = D.map(([x, y, l]) => `M${P1(x, y)}Q${P1(x + 2, y + l * 0.5, x, y + l)}`).join('');
  const drops = D.map(([x, y, l]) => `M${P1(x, y + l - 6)}C${P1(x + 3, y + l, x + 8, y + l + 4, x + 8, y + l + 9)}A8 8 0 0 1 ${P1(x - 8, y + l + 9)}C${P1(x - 8, y + l + 4, x - 3, y + l, x, y + l - 6)}Z`).join('');
  const dropHi = D.map(([x, y, l]) => `M${P1(x - 3, y + l + 6)}h0`).join('');
  return g({},
    path(body.join(''), { fill: '#ffffff', fillOpacity: 0.3 }),
    path(sh.join(''), { fill: 'none', stroke: '#1e4a3a', strokeOpacity: 0.38, strokeWidth: 1.8, strokeLinecap: 'round' }),
    path(hi.join(''), { stroke: '#fff', strokeOpacity: 0.95, strokeWidth: 3, strokeLinecap: 'round' }),
    path(trails, { fill: 'none', stroke: '#fff', strokeOpacity: 0.3, strokeWidth: 5, strokeLinecap: 'round' }),
    path(drops, { fill: '#ffffff', fillOpacity: 0.4, stroke: '#1e4a3a', strokeOpacity: 0.3, strokeWidth: 1.6 }),
    path(dropHi, { stroke: '#fff', strokeOpacity: 0.95, strokeWidth: 3.5, strokeLinecap: 'round' }));
}

function glassFront() {
  return g({},
    path(DOME, { fill: 'url(#glassEdge)' }),
    path(`M${DX0} 0H${DX1}V560H${DX0}Z`, { fill: 'url(#fog)', clipPath: 'url(#domeClip)' }),
    // key glare (left), a softer bounce (right) and a crown arc
    path(`M198 1250V660A500 420 0 0 1 400 300`, { fill: 'none', stroke: '#fff', strokeOpacity: 0.5, strokeWidth: 26, strokeLinecap: 'round' }),
    path('M240 1210V720', { fill: 'none', stroke: '#fff', strokeOpacity: 0.35, strokeWidth: 8, strokeLinecap: 'round' }),
    path('M460 222A520 420 0 0 1 690 176', { fill: 'none', stroke: '#fff', strokeOpacity: 0.7, strokeWidth: 14, strokeLinecap: 'round' }),
    path('M1208 1210V780', { fill: 'none', stroke: '#fff', strokeOpacity: 0.28, strokeWidth: 12, strokeLinecap: 'round' }),
    path('M1150 360A520 440 0 0 1 1206 490', { fill: 'none', stroke: '#fff', strokeOpacity: 0.45, strokeWidth: 9, strokeLinecap: 'round' }),
    droplets(),
    path(DOME, { fill: 'none', stroke: INK, strokeWidth: 7 }),
    path(`M${DX0 + 9} ${DBOT - 10}V${DY}A${DR - 9} ${DRY - 9} 0 0 1 ${DX1 - 9} ${DY}V${DBOT - 10}`, { fill: 'none', stroke: '#fff', strokeOpacity: 0.35, strokeWidth: 3 }));
}

function finial() {
  return g({},
    path(ellipse(CX, 156, 90, 16), { fill: INK, fillOpacity: 0.25 }),
    path(`M${CX - 86} 160Q${CX - 80} 120 ${CX} 116Q${CX + 80} 120 ${CX + 86} 160Z`, { fill: 'url(#brass)', stroke: INK, strokeWidth: 5, strokeLinejoin: 'round' }),
    path(`M${CX - 62} 140Q${CX - 30} 126 ${CX + 10} 126`, { fill: 'none', stroke: '#fff7d6', strokeOpacity: 0.8, strokeWidth: 4, strokeLinecap: 'round' }),
    path(rr(CX - 16, 82, 32, 40, 8), { fill: 'url(#brassV)', stroke: INK, strokeWidth: 4 }),
    path(circle(CX, 62, 30), { fill: 'url(#brassBall)', stroke: INK, strokeWidth: 5 }),
    path(ellipse(CX - 10, 50, 10, 6), { fill: '#fff', fillOpacity: 0.85, transform: `rotate(-30 ${CX - 10} 50)` }),
    path(ellipse(CX, 92, 26, 7), { fill: 'url(#brass)', stroke: INK, strokeWidth: 3.5 }));
}

function bezel() {
  const o = BZ, f = rr(hole.x - o, hole.y - o, hole.w + 2 * o, hole.h + 2 * o, radius + o);
  const corners = [[hole.x - o / 2, hole.y - o / 2], [hole.x + hole.w + o / 2, hole.y - o / 2], [hole.x - o / 2, hole.y + hole.h + o / 2], [hole.x + hole.w + o / 2, hole.y + hole.h + o / 2]];
  return g({},
    path(rr(hole.x - o + 6, hole.y - o + 12, hole.w + 2 * o, hole.h + 2 * o, radius + o), { fill: INK, fillOpacity: 0.32 }),
    path(f, { fill: 'url(#brass)', stroke: INK, strokeWidth: 6 }),
    path(rr(hole.x - o + 8, hole.y - o + 8, hole.w + 2 * o - 16, hole.h + 2 * o - 16, radius + o - 8), { fill: 'none', stroke: '#fff3c4', strokeOpacity: 0.55, strokeWidth: 2.5 }),
    path(rr(hole.x - 10, hole.y - 10, hole.w + 20, hole.h + 20, radius + 10), { fill: 'url(#brassIn)', stroke: '#6b4a14', strokeWidth: 2.5 }),
    path(rr(hole.x - 3, hole.y - 3, hole.w + 6, hole.h + 6, radius + 3), { fill: '#1a1a14' }),
    lip(rr(hole.x, hole.y, hole.w, hole.h, radius), '#000', [[6, 0.28], [2.5, 0.55]]),
    corners.map(([x, y]) => path(circle(x, y, 7), { fill: 'url(#rivet)', stroke: INK, strokeWidth: 2.5 })).join(''),
    path(`M${hole.x - o + 14} ${hole.y + 160}V${hole.y + radius - 4}Q${hole.x - o + 14} ${hole.y - o + 14} ${hole.x + radius - 4} ${hole.y - o + 14}H${hole.x + 200}`, { fill: 'none', stroke: '#fffbe6', strokeOpacity: 0.85, strokeWidth: 5, strokeLinecap: 'round' }));
}

function base() {
  const y0 = DBOT - 18, py = DBOT + 20, pb = py + 142;
  return g({},
    path(ellipse(CX, pb + 34, 600, 16), { fill: INK, fillOpacity: 0.3 }),
    // brass feet
    ...[190, W - 190].map((x) => path(`M${x - 42} ${pb - 10}H${x + 42}L${x + 32} ${pb + 26}Q${x} ${pb + 36} ${x - 32} ${pb + 26}Z`, { fill: 'url(#brassV)', stroke: INK, strokeWidth: 4, strokeLinejoin: 'round' })),
    // walnut plinth
    path(`M110 ${py}H${W - 110}Q${W - 84} ${py} ${W - 86} ${py + 24}L${W - 98} ${pb - 22}Q${W - 100} ${pb} ${W - 124} ${pb}H124Q100 ${pb} 98 ${pb - 22}L86 ${py + 24}Q84 ${py} 110 ${py}Z`, { fill: 'url(#wood)', stroke: INK, strokeWidth: 6, strokeLinejoin: 'round' }),
    path(`M118 ${py + 16}H${W - 118}`, { stroke: '#e0a874', strokeOpacity: 0.35, strokeWidth: 4, strokeLinecap: 'round' }),
    path(`M140 ${py + 60}C400 ${py + 52} 640 ${py + 72} 980 ${py + 58}S1240 ${py + 66} 1270 ${py + 60}M150 ${py + 100}C420 ${py + 94} 760 ${py + 110} 1250 ${py + 98}`, { fill: 'none', stroke: '#2a1408', strokeOpacity: 0.3, strokeWidth: 2.5 }),
    // blank brass plaque
    path(rr(CX - 110, py + 46, 220, 62, 10), { fill: 'url(#brass)', stroke: INK, strokeWidth: 4 }),
    path(rr(CX - 98, py + 56, 196, 42, 6), { fill: 'none', stroke: '#7a5418', strokeOpacity: 0.6, strokeWidth: 2.5 }),
    path(circle(CX - 90, py + 77, 4) + circle(CX + 90, py + 77, 4), { fill: '#7a5418' }),
    // brass collar the dome sits in
    path(rr(DX0 - 24, y0, DX1 - DX0 + 48, 46, 16), { fill: 'url(#brassV)', stroke: INK, strokeWidth: 6 }),
    path(`M${DX0 - 8} ${y0 + 12}H${DX1 + 8}`, { stroke: '#fff7d6', strokeOpacity: 0.75, strokeWidth: 4, strokeLinecap: 'round' }),
    [0, 1, 2, 3, 4, 5].map((i) => path(circle(DX0 + 40 + i * ((DX1 - DX0 - 80) / 5), y0 + 28, 6), { fill: 'url(#rivet)', stroke: INK, strokeWidth: 2.5 })).join(''));
}

function draw() {
  const defs = [
    lg('glass', [0, 0, 1, 1], [[0, '#ffffff', 0.42], [0.5, '#d8f3ea', 0.26], [1, '#9fd6c4', 0.4]]),
    rg('glassEdge', [0.5, 0.55, 0.62], [[0.72, '#bfeee0', 0], [0.94, '#5aa68e', 0.16], [1, '#24584a', 0.34]]),
    lg('fog', [0, 0, 0, 1], [[0, '#ffffff', 0.24], [1, '#ffffff', 0]]),
    lg('fern', [0, 0, 1, 1], [[0, '#a6dc6a'], [0.5, '#5fae42'], [1, '#2f7a34']]),
    lg('fern2', [1, 0, 0, 1], [[0, '#b8e57a'], [0.55, '#6cbc48'], [1, '#3a8a3a']]),
    lg('blade', [0, 0, 0, 1], [[0, '#c7ec8a'], [1, '#4c9a3c']]),
    lg('heart', [0, 0, 1, 1], [[0, '#9fdc6a'], [0.5, '#4fa244'], [1, '#2a6e36']]),
    rg('coin', [0.4, 0.35, 0.75], [[0, '#b8ea7c'], [0.6, '#6fb84a'], [1, '#3c7e34']]),
    lg('mossMid', [0, 0, 0, 1], [[0, '#7cc04a'], [1, '#4f9636']]),
    lg('mossFront', [0, 0, 0, 1], [[0, '#a3d860'], [1, '#62a83e']]),
    lg('stem', [0, 0, 1, 0], [[0, '#fff6e2'], [1, '#d9c8a4']]),
    rg('capRed', [0.38, 0.3, 0.8], [[0, '#ff8f6e'], [0.55, '#e3473a'], [1, '#a82a2a']]),
    rg('capTan', [0.38, 0.3, 0.8], [[0, '#f2cf96'], [0.55, '#c98d4e'], [1, '#8a5a2c']]),
    rg('pebble', [0.38, 0.32, 0.8], [[0, '#e4e8ea'], [0.6, '#a9b3ba'], [1, '#6f7c86']]),
    rg('pebbleW', [0.38, 0.32, 0.8], [[0, '#fbf2e4'], [0.6, '#d8c8b0'], [1, '#a8957a']]),
    rg('shell', [0.42, 0.36, 0.7], [[0, '#ffd28a'], [0.55, '#e0903e'], [1, '#a85a20']]),
    lg('snailBody', [0, 0, 0, 1], [[0, '#ecebc0'], [1, '#bdbb84']]),
    lg('soil', [0, 0, 0, 1], [[0, '#6a4428'], [1, '#4a2e1a']]),
    rg('gravel', [0.4, 0.35, 0.8], [[0, '#c9d1d6'], [1, '#7c888f']]),
    lg('brass', [0, 0, 1, 1], [[0, '#fff0b0'], [0.3, '#f0c860'], [0.62, '#b8862e'], [0.85, '#e2b85a'], [1, '#8a6020']]),
    lg('brassV', [0, 0, 0, 1], [[0, '#fff0b0'], [0.4, '#e6bb52'], [0.6, '#b8862e'], [1, '#e2b85a']]),
    lg('brassIn', [0, 0, 1, 1], [[0, '#8a6020'], [0.5, '#c99a40'], [1, '#fff0b0']]),
    rg('brassBall', [0.38, 0.32, 0.75], [[0, '#fff6cc'], [0.45, '#e9bf58'], [1, '#8a6020']]),
    rg('rivet', [0.4, 0.35, 0.7], [[0, '#fff6cc'], [1, '#9a6e24']]),
    lg('wood', [0, 0, 0, 1], [[0, '#8a5634'], [0.45, '#6b3f22'], [1, '#43260f']]),
    `<clipPath id="domeClip"><path d="${DOME}"/></clipPath>`,
  ].join('');

  const by = hole.y + hole.h + BZ; // bezel bottom
  const stakes = [hole.x + 120, hole.x + hole.w - 120].map((x) => path(rr(x - 7, by - 10, 14, 120, 7), { fill: 'url(#brassV)', stroke: INK, strokeWidth: 3.5 })).join('');
  const back = g({},
    // tall fronds arching up behind the screen and over its top corners
    frond([[220, SOIL - 40], [196, 960], [206, 760], [262, 560], [356, 412], [480, 314], [600, 270]], 108, { pairs: 25 }),
    frond([[1180, SOIL - 40], [1204, 960], [1194, 760], [1138, 560], [1044, 412], [920, 314], [800, 270]], 104, { pairs: 25, fill: 'url(#fern2)' }),
    // fronds leaning out along the glass
    frond([[246, SOIL - 30], [214, 1040], [190, 900], [186, 770], [204, 660]], 72, { pairs: 14, fill: 'url(#fern2)' }),
    frond([[1156, SOIL - 30], [1190, 1040], [1210, 910], [1206, 800]], 64, { pairs: 12 }),
    frond([[1110, SOIL - 30], [1100, 1060], [1098, 980], [1124, 910]], 40, { pairs: 9, fiddle: -24 }),
    stakes,
    path(blades(166, SOIL - 20, [[-96, 200, 10, -14], [-80, 160, 9, 12], [-112, 140, 8, -10]]) + blades(1236, SOIL - 20, [[-84, 190, 10, 14], [-100, 150, 9, -12], [-68, 128, 8, 10]]), { fill: 'url(#blade)', stroke: INK, strokeWidth: 2.4, strokeLinejoin: 'round' }),
    ladybug(176, 980, -64, 0.9));

  const floor = g({},
    // corner plants: a heart-leaf clump (left) and a pancake plant (right)
    heartPlant(250, SOIL - 50, [[-112, 120, -140, 80], [-146, 76, -168, 70], [-92, 170, -104, 72], [-58, 96, -34, 62]]),
    coinPlant(1150, SOIL - 50, [[1116, 1030, 32], [1184, 990, 36], [1222, 1070, 28], [1100, 1100, 24]]),
    moss([[DX0 - 10, 1040], [210, 1076], [300, 1104], [420, 1118], [560, 1112], [700, 1122], [840, 1114], [980, 1118], [1100, 1100], [1190, 1074], [DX1 + 10, 1040]], 3),
    pebble(586, 1170, 34, 20), pebble(642, 1178, 24, 15, 'pebbleW', -8), pebble(790, 1172, 28, 17, 'pebble', 6),
    mushroom(268, 1146, 124, 100, 'red', -5), mushroom(350, 1158, 76, 64, 'red', 9), mushroom(206, 1170, 50, 44, 'red', -14),
    mushroom(1080, 1146, 96, 76, 'tan', 6), mushroom(1136, 1164, 58, 48, 'tan', -8),
    snail(906, 1170, 1.05));

  const body = [
    base(),
    path(DOME, { fill: 'url(#glass)' }),
    g({ clipPath: 'url(#domeClip)' }, strata(), back, bezel(), floor),
    glassFront(),
    finial(),
  ].join('\n');
  return { defs, body };
}

module.exports = {
  W, H, hole, radius, draw,
  meta: {
    name: 'Terrarium', theme: 'glass-garden', rarity: 'epic', translucent: true,
    desc: 'Your game grows in a tiny glass garden where ferns unfurl, mushrooms pop up and a sleepy snail keeps score.',
    tags: ['terrarium', 'nature', 'plants', 'glass', 'cozy'],
    collection: 'wild-tuneful', license: 'CC-BY-4.0',
  },
};
