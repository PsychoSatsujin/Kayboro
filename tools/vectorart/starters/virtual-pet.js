'use strict';
// Starter "Virtual Pet": a chubby keychain pet toy with round bear ears, moulded in clear
// strawberry-milk plastic. The shell fill glows through the body; screws, a coin cell, a piezo
// speaker and gold traces show through the plastic. Pearl screen bezel with a tiny life meter on
// the chin, a paw-print button cluster (three toe-bean buttons over a speaker pad), a satin strap
// with a star charm, and layered anime glare: soft sheen, sharp crescents and round glints.
const L = require('../lib');
const { rr, path, g, lg, rg, circle, ellipse, sparkle, star, heart, tf, rng, lip } = L;

const W = 1040, H = 1340, CX = 520;
const hole = { x: CX - 265, y: 384, w: 530, h: 530 }, radius = 58;
const O = [CX, 772]; // body centre
const INK = '#5a1f4c';

// ---- body: a tapered squircle (narrower crown, fuller base) unioned with two round ears ----------
const SE = { a: 452, b: 518, n: 2.8, k: 0.06 };
const r1 = (v) => Math.round(v * 10) / 10;
const pt = (p) => `${r1(p[0])} ${r1(p[1])}`;

function rBody(phi) {
  const c = Math.cos(phi), s = Math.sin(phi);
  let r = 420;
  for (let i = 0; i < 10; i++) {
    const a = SE.a * (1 + (SE.k * r * s) / SE.b);
    r = Math.pow(Math.pow(Math.abs(c / a), SE.n) + Math.pow(Math.abs(s / SE.b), SE.n), -1 / SE.n);
  }
  return r;
}
const onBody = (deg, dr = 0) => { const p = (deg * Math.PI) / 180, r = rBody(p) + dr; return [O[0] + r * Math.cos(p), O[1] + r * Math.sin(p)]; };
const EARS = [227, 313].map((deg) => { const [x, y] = onBody(deg, 30); return { x: r1(x), y: r1(y), r: 98, deg }; });

/** Far intersection of the ray from O at angle phi with circle e (0 if missed). */
function rCircle(phi, e) {
  const ux = Math.cos(phi), uy = Math.sin(phi), dx = e.x - O[0], dy = e.y - O[1];
  const p = dx * ux + dy * uy, q = e.r * e.r - (dx * dx + dy * dy - p * p);
  return q > 0 && p > 0 ? p + Math.sqrt(q) : 0;
}
/** Smooth max: blends the ears into the head with soft fillets. */
const smax = (vals, k = 0.075) => Math.log(vals.reduce((s, v) => s + (v > 0 ? Math.exp(k * (v - 400)) : 0), 0)) / k + 400;

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
function outline(step = 13) {
  const raw = [];
  for (let i = 0; i < 2880; i++) {
    const phi = -Math.PI / 2 + (i / 2880) * Math.PI * 2;
    const r = smax([rBody(phi), ...EARS.map((e) => rCircle(phi, e))]);
    raw.push([O[0] + r * Math.cos(phi), O[1] + r * Math.sin(phi)]);
  }
  return resample(raw, step);
}
/** Outward unit normals of a clockwise (screen space) closed polyline. */
const normals = (pts) => pts.map((_, i) => {
  const a = pts[(i - 1 + pts.length) % pts.length], b = pts[(i + 1) % pts.length];
  const dx = b[0] - a[0], dy = b[1] - a[1], l = Math.hypot(dx, dy) || 1;
  return [dy / l, -dx / l];
});
const mid = (a, b) => [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2];
/** Closed curve through a polyline (quadratic segments via midpoints). */
function closed(pts) {
  let d = `M${pt(mid(pts[pts.length - 1], pts[0]))}`;
  for (let i = 0; i < pts.length; i++) d += `Q${pt(pts[i])} ${pt(mid(pts[i], pts[(i + 1) % pts.length]))}`;
  return `${d}Z`;
}
/** Open curve through a polyline; `lead` continues a path with L instead of M. */
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
/** Crescent hugging the outline: outer edge inset by `inset`, thickness swelling to `w` (sin^pow taper). */
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
/** Inset copy of part of the outline as an open curve. */
const insetLine = (pts, nrm, idx, inset) => open(idx.map((i) => [pts[i][0] - nrm[i][0] * inset, pts[i][1] - nrm[i][1] * inset]));

// ---- parts -------------------------------------------------------------------------------------------
const BZ = { sx: 46, top: 46, chin: 88, r: 122 };
const BOX = { x: hole.x - BZ.sx, y: hole.y - BZ.top, w: hole.w + 2 * BZ.sx, h: hole.h + BZ.top + BZ.chin };
const CHIN = hole.y + hole.h + BZ.chin / 2 + 2;

function screw(x, y, rot = 20, s = 1) {
  return g({ transform: tf(x, y, rot, s) },
    path(circle(0, 0, 17), { fill: '#7b6a86' }),
    path(circle(0, 0, 14), { fill: 'url(#vpMetal)' }),
    path('M-8 0H8M0 -8V8', { stroke: '#5c4b66', strokeWidth: 3.5, strokeLinecap: 'round' }),
    path('M-9 -6A11 11 0 0 1 -2 -11', { fill: 'none', stroke: '#fff', strokeWidth: 2.2, strokeLinecap: 'round' }));
}

/** Parts seen through the clear plastic: gold traces, a coin cell in its clip, a piezo disc, screws. */
function internals() {
  const bx = BOX.x, by = BOX.y + BOX.h, bw = BOX.x + BOX.w;
  const trace = (d, w = 4) => path(d, { fill: 'none', stroke: '#ffcf6e', strokeOpacity: 0.5, strokeWidth: w, strokeLinecap: 'round', strokeLinejoin: 'round' });
  const cell = [CX - 252, 1150], pz = [CX + 252, 1150];
  const lt = `M${bx - 18} 540V900L${bx + 27} 945V1094M${bx - 38} 600V910L${bx + 5} 953V1100`
    + `M${cell[0] + 52} ${cell[1]}H${CX - 160}L${CX - 128} ${cell[1] - 32}H${CX - 104}`;
  const mirror = (d) => d.replace(/([ML])([\d.]+)/g, (m, c, x) => `${c}${2 * CX - x}`).replace(/H([\d.]+)/g, (m, x) => `H${2 * CX - x}`);
  const vias = [[bx - 18, 540], [bx - 38, 600], [CX - 104, cell[1] - 32]].flatMap(([x, y]) => [circle(x, y, 6), circle(2 * CX - x, y, 6)]).join('');
  return g({ opacity: 0.85 },
    trace(lt + mirror(lt), 4),
    path(vias, { fill: '#ffe39a', fillOpacity: 0.7, stroke: '#c48a2a', strokeOpacity: 0.6, strokeWidth: 2 }),
    // coin cell with solder tabs
    path(rr(cell[0] - 72, cell[1] - 9, 144, 18, 4), { fill: 'url(#vpMetal)', stroke: '#6f6380', strokeWidth: 2.5 }),
    path(circle(cell[0] + 3, cell[1] + 6, 52), { fill: '#3b2a44', fillOpacity: 0.3 }),
    path(circle(...cell, 52), { fill: 'url(#vpCell)', stroke: '#6f6380', strokeWidth: 3 }),
    path(circle(...cell, 40), { fill: 'none', stroke: '#8d84a3', strokeOpacity: 0.6, strokeWidth: 3 }),
    path(`M${cell[0] - 38} ${cell[1] - 32}A50 50 0 0 1 ${cell[0] - 6} ${cell[1] - 49}`, { fill: 'none', stroke: '#fff', strokeWidth: 5, strokeLinecap: 'round' }),
    path(`M${cell[0] + 12} ${cell[1] + 18}h16M${cell[0] + 20} ${cell[1] + 10}v16`, { stroke: '#8d84a3', strokeOpacity: 0.8, strokeWidth: 3, strokeLinecap: 'round' }),
    // piezo speaker disc
    path(circle(...pz, 50), { fill: 'url(#vpBrass)', stroke: '#a26e22', strokeWidth: 3 }),
    path(circle(...pz, 32), { fill: '#f4f1f6', stroke: '#c9b7d4', strokeWidth: 3 }),
    path(circle(...pz, 11), { fill: '#d8cde2' }),
    path(`M${pz[0] - 38} ${pz[1] - 22}A44 44 0 0 1 ${pz[0] - 14} ${pz[1] - 42}`, { fill: 'none', stroke: '#fff7d6', strokeWidth: 4, strokeLinecap: 'round' }),
        screw(bx - 24, 470, 20), screw(bw + 24, 470, -30), screw(CX - 150, 1252, 40, 0.9), screw(CX + 150, 1252, 10, 0.9));
}

function strap() {
  // satin ribbon loop rising from the split ring, leaning right
  const base = [CX, 214], loop = [], a = (14 * Math.PI) / 180;
  for (let i = 0; i <= 60; i++) {
    const t = 0.32 + (i / 60) * (2 * Math.PI - 0.64);
    const x = -66 * Math.sin(t) * Math.pow(Math.sin(t / 2), 0.7), y = (-158 * (1 - Math.cos(t))) / 2;
    loop.push([base[0] + x * Math.cos(a) - y * Math.sin(a), base[1] + x * Math.sin(a) + y * Math.cos(a)]);
  }
  const d = open(loop);
  return g({},
    path(d, { fill: 'none', stroke: INK, strokeOpacity: 0.3, strokeWidth: 38, strokeLinecap: 'round', transform: 'translate(4 9)' }),
    path(d, { fill: 'none', stroke: INK, strokeWidth: 36, strokeLinecap: 'round' }),
    path(d, { fill: 'none', stroke: 'url(#vpRibbon)', strokeWidth: 27, strokeLinecap: 'round' }),
    path(d, { fill: 'none', stroke: '#fff', strokeOpacity: 0.8, strokeWidth: 2.5, strokeDasharray: '8 7' }),
    path(open(loop.slice(8, 26).map(([x, y]) => [x - 5, y - 4])), { fill: 'none', stroke: '#fff', strokeOpacity: 0.75, strokeWidth: 5, strokeLinecap: 'round' }));
}

function ringAndTab(topY) {
  const ring = (d) => path(d, { fill: 'none', stroke: INK, strokeWidth: 13, strokeLinecap: 'round' }) + path(d, { fill: 'none', stroke: 'url(#vpMetal)', strokeWidth: 6.5, strokeLinecap: 'round' });
  const ty = topY - 34, t = rr(CX - 31, ty, 62, 54, [27, 27, 10, 10]);
  return g({},
    ring(circle(CX, ty - 4, 23)),
    path(t, { fill: INK, fillOpacity: 0.3, transform: 'translate(3 6)' }),
    path(t, { fill: 'url(#vpPearlEdge)', stroke: INK, strokeWidth: 5 }),
    path(ellipse(CX, ty + 18, 9, 8), { fill: INK }),
    path(`M${CX - 18} ${ty + 22}Q${CX - 18} ${ty + 10} ${CX - 8} ${ty + 6}`, { fill: 'none', stroke: '#fff', strokeWidth: 3.5, strokeLinecap: 'round' }),
    ring(`M${CX} ${ty + 19}A23 23 0 0 1 ${CX - 23} ${ty - 4}`));
}

/** A little clear-acrylic star charm on a jump ring, hanging off the split ring. */
function charm(topY) {
  const ry = topY - 38, jx = CX - 64, jy = ry - 20, cx = CX - 114, cy = ry - 28, d = star(cx, cy, 44, 22, 5, 9);
  const chain = `M${CX - 21} ${ry - 7}Q${CX - 36} ${ry - 20} ${jx + 9} ${jy - 1}`;
  return g({},
    path(chain, { fill: 'none', stroke: INK, strokeWidth: 9, strokeLinecap: 'round' }),
    path(chain, { fill: 'none', stroke: 'url(#vpMetal)', strokeWidth: 4, strokeLinecap: 'round' }),
    path(d, { fill: INK, fillOpacity: 0.28, transform: 'translate(4 8)' }),
    path(d, { fill: 'url(#vpCharm)', stroke: INK, strokeWidth: 5.5, strokeLinejoin: 'round' }),
    path(star(cx, cy, 28, 14, 5, 9), { fill: '#fff', fillOpacity: 0.25 }),
    path(`M${cx - 17} ${cy + 5}Q${cx - 18} ${cy - 9} ${cx - 6} ${cy - 17}`, { fill: 'none', stroke: '#fff', strokeWidth: 5.5, strokeLinecap: 'round' }),
    path(circle(cx + 10, cy + 9, 4.5), { fill: '#fff' }),
    path(circle(jx, jy, 11), { fill: 'none', stroke: INK, strokeWidth: 9 }),
    path(circle(jx, jy, 11), { fill: 'none', stroke: 'url(#vpMetal)', strokeWidth: 4 }));
}

function earPads() {
  return EARS.map((e) => {
    const a = (e.deg * Math.PI) / 180, x = r1(e.x + Math.cos(a) * 4), y = r1(e.y + Math.sin(a) * 4 + 6);
    return path(circle(x, y, 44), { fill: 'url(#vpEarPad)', stroke: INK, strokeOpacity: 0.5, strokeWidth: 3.5 })
      + path(`M${x - 30} ${y - 6}A32 32 0 0 1 ${x - 8} ${y - 31}`, { fill: 'none', stroke: '#fff', strokeOpacity: 0.9, strokeWidth: 5.5, strokeLinecap: 'round' });
  }).join('');
}

function bezel() {
  const holeD = rr(hole.x, hole.y, hole.w, hole.h, radius), { x: ox, y: oy, w: ow, h: oh } = BOX, orad = BZ.r;
  const paw = (x, y, s) => path(ellipse(x, y + 3 * s, 7 * s, 5.6 * s) + circle(x - 7 * s, y - 4 * s, 2.6 * s) + circle(x - 2.4 * s, y - 7.4 * s, 2.6 * s)
    + circle(x + 2.4 * s, y - 7.4 * s, 2.6 * s) + circle(x + 7 * s, y - 4 * s, 2.6 * s), { fill: '#e46aa0' });
  return g({},
    path(rr(ox + 4, oy + 14, ow, oh, orad), { fill: INK, fillOpacity: 0.35 }),
    path(rr(ox, oy, ow, oh, orad), { fill: 'url(#vpPearlEdge)', stroke: INK, strokeWidth: 6 }),
    path(rr(ox + 9, oy + 9, ow - 18, oh - 18, orad - 9), { fill: 'url(#vpPearl)' }),
    path(rr(ox + 9, oy + 9, ow - 18, oh - 18, orad - 9), { fill: 'url(#vpPearlSheen)' }),
    // recessed screen well
    path(rr(hole.x - 18, hole.y - 18, hole.w + 36, hole.h + 36, radius + 16), { fill: 'url(#vpWell)', stroke: '#c48fb4', strokeWidth: 3 }),
    path(rr(hole.x - 18, hole.y - 18, hole.w + 36, hole.h + 36, radius + 16), { fill: 'none', stroke: INK, strokeOpacity: 0.7, strokeWidth: 2.5, transform: 'translate(0 -2)' }),
    lip(holeD, '#000', [[8, 0.3], [3.5, 0.55]]),
    // chin: paw badge, a tiny LED and a life meter
    paw(ox + 80, CHIN, 1.15),
    path(`M${ox + 112} ${CHIN}H${ox + 190}`, { stroke: '#ecc3da', strokeWidth: 5, strokeLinecap: 'round' }),
    [0, 1, 2].map((i) => path(heart(ox + ow - 168 + i * 42, CHIN, 13), { fill: i < 2 ? '#ff6f9f' : '#fff', stroke: '#c43f78', strokeWidth: 3 })).join(''),
    path(circle(CX, CHIN, 17), { fill: 'url(#vpLed)', class: 'vp-led' }),
    path(circle(CX, CHIN, 6.5), { fill: '#fff', class: 'vp-led' }),
    // pearl rim highlights (key light top left, cool light bottom right)
    path(`M${ox + 20} ${oy + orad + 100}V${oy + orad}Q${ox + 20} ${oy + 20} ${ox + orad} ${oy + 20}H${ox + orad + 50}`, { fill: 'none', stroke: '#fff', strokeOpacity: 0.95, strokeWidth: 7, strokeLinecap: 'round' }),
    path(`M${ox + ow - 18} ${oy + oh - orad - 70}V${oy + oh - orad + 10}`, { fill: 'none', stroke: '#fff', strokeOpacity: 0.6, strokeWidth: 4, strokeLinecap: 'round' }));
}

function bean(cx, cy, rx, ry, rot, id) {
  const T = { transform: `rotate(${rot} ${cx} ${cy})` };
  return path(ellipse(cx + 3, cy + 10, rx, ry), { fill: INK, fillOpacity: 0.4, ...T })
    + path(ellipse(cx, cy, rx, ry), { fill: `url(#${id})`, stroke: INK, strokeWidth: 5.5, ...T })
    + path(`M${cx - rx * 0.64} ${cy - ry * 0.02}A${rx * 0.66} ${ry * 0.66} 0 0 1 ${cx - rx * 0.12} ${cy - ry * 0.64}`,
      { fill: 'none', stroke: '#fff', strokeOpacity: 0.95, strokeWidth: 6, strokeLinecap: 'round', ...T })
    + path(circle(cx + rx * 0.42, cy + ry * 0.36, 4.5), { fill: '#fff', fillOpacity: 0.8 });
}

function pawButtons() {
  const y0 = BOX.y + BOX.h; // bottom of the bezel
  const py = y0 + 168; // speaker pad centre
  const pad = `M${CX} ${py - 58}C${CX + 60} ${py - 58} ${CX + 104} ${py - 26} ${CX + 104} ${py + 14}C${CX + 104} ${py + 48} ${CX + 72} ${py + 60} ${CX + 40} ${py + 54}`
    + `C${CX + 20} ${py + 50} ${CX + 12} ${py + 44} ${CX} ${py + 44}C${CX - 12} ${py + 44} ${CX - 20} ${py + 50} ${CX - 40} ${py + 54}`
    + `C${CX - 72} ${py + 60} ${CX - 104} ${py + 48} ${CX - 104} ${py + 14}C${CX - 104} ${py - 26} ${CX - 60} ${py - 58} ${CX} ${py - 58}Z`;
  const holes = [[-48, 0], [-24, 0], [0, 0], [24, 0], [48, 0], [-36, 22], [-12, 22], [12, 22], [36, 22], [-24, -22], [0, -22], [24, -22]]
    .map(([dx, dy]) => circle(CX + dx, py + dy, 5)).join('');
  return g({},
    path(pad, { fill: INK, fillOpacity: 0.35, transform: 'translate(3 9)' }),
    path(pad, { fill: 'url(#vpPearlEdge)', stroke: INK, strokeWidth: 5.5 }),
    path(holes, { fill: INK, fillOpacity: 0.75 }),
    path(`M${CX - 72} ${py - 30}Q${CX - 44} ${py - 50} ${CX - 8} ${py - 52}`, { fill: 'none', stroke: '#fff', strokeWidth: 5, strokeLinecap: 'round' }),
    bean(CX - 104, y0 + 64, 42, 34, -24, 'vpBtnA'), bean(CX, y0 + 44, 44, 36, 0, 'vpBtnB'), bean(CX + 104, y0 + 64, 42, 34, 24, 'vpBtnC'));
}

// ---- draw --------------------------------------------------------------------------------------------
function draw() {
  const pts = outline(), nrm = normals(pts), BODY = closed(pts), topY = Math.round(Math.min(...pts.filter((p) => Math.abs(p[0] - CX) < 40).map((p) => p[1])));
  const defs = [
    lg('vpPlastic', [0.1, 0, 0.9, 1], [[0, '#ffdcec', 0.36], [0.5, '#ffa6cc', 0.38], [1, '#e2609f', 0.56]]),
    rg('vpKey', [0.22, 0.18, 0.55], [[0, '#fff', 0.4], [1, '#fff', 0]]),
    rg('vpCool', [0.88, 0.92, 0.55], [[0, '#a98cff', 0.45], [1, '#a98cff', 0]]),
    lg('vpSheen', [0, 0, 1, 0], [[0, '#fff', 0.85], [1, '#fff', 0.1]]),
    rg('vpCaustic', [0.5, 1, 0.62], [[0, '#ffe0ef', 0.7], [0.45, '#ffc2de', 0.3], [1, '#ffc2de', 0]]),
    lg('vpPearlEdge', [0, 0, 1, 1], [[0, '#ffffff'], [0.5, '#f4d3e4'], [1, '#c98fb2']]),
    lg('vpPearl', [0, 0, 1, 1], [[0, '#fffafd'], [0.55, '#fbe9f2'], [1, '#efcfe0']]),
    lg('vpPearlSheen', [0, 0, 1, 1], [[0.25, '#d9f1ff', 0], [0.5, '#d9f1ff', 0.4], [0.62, '#ffe2f6', 0.35], [0.85, '#ffe2f6', 0]]),
    lg('vpWell', [0, 0, 0, 1], [[0, '#2a1230'], [1, '#43204a']]),
    lg('vpMetal', [0, 0, 1, 1], [[0, '#ffffff'], [0.5, '#d6cfe4'], [1, '#8a7fa6']]),
    rg('vpCell', [0.4, 0.35, 0.75], [[0, '#ffffff'], [0.6, '#d9d6e6'], [1, '#9f99b8']]),
    rg('vpBrass', [0.4, 0.35, 0.8], [[0, '#fff2c0'], [0.6, '#e8b85a'], [1, '#b17a26']]),
    lg('vpRibbon', [0, 0, 1, 1], [[0, '#fff1c4'], [0.5, '#ffd36e'], [1, '#f2a83c']]),
    lg('vpCharm', [0, 0, 1, 1], [[0, '#d7fff4', 0.85], [0.5, '#8fe8d6', 0.75], [1, '#4fc4c0', 0.9]]),
    rg('vpBlush', [0.5, 0.5, 0.5], [[0, '#ff4f8a', 0.85], [0.55, '#ff7aa8', 0.55], [1, '#ff8fb8', 0]]),
    rg('vpEarPad', [0.4, 0.35, 0.75], [[0, '#fff6fa'], [0.7, '#ffd2e4'], [1, '#f6a8c8']]),
    rg('vpBtnA', [0.38, 0.3, 0.8], [[0, '#e0fff4'], [0.55, '#7ee8c6'], [1, '#2fb98f']]),
    rg('vpBtnB', [0.38, 0.3, 0.8], [[0, '#fff6d0'], [0.55, '#ffd963'], [1, '#f2a22a']]),
    rg('vpBtnC', [0.38, 0.3, 0.8], [[0, '#e8f4ff'], [0.55, '#8cc8ff'], [1, '#4a8be8']]),
    rg('vpLed', [0.5, 0.5, 0.5], [[0, '#fff'], [0.35, '#ff7aa8'], [1, '#ff7aa8', 0]]),
    rg('vpFloor', [0.5, 0.5, 0.5], [[0, INK, 0.4], [1, INK, 0]]),
    `<clipPath id="vpBody"><path d="${BODY}"/></clipPath>`,
    '<style>.vp-tw{animation:vp-tw 3.2s ease-in-out infinite}.vp-tw2{animation:vp-tw 3.2s ease-in-out 1.6s infinite}'
      + '.vp-led{animation:vp-led 2.4s steps(1) infinite}'
      + '@keyframes vp-tw{0%,100%{opacity:1}50%{opacity:.35}}@keyframes vp-led{0%,70%{opacity:1}80%{opacity:.3}90%{opacity:1}}'
      + '@media (prefers-reduced-motion:reduce){*{animation:none!important}}</style>',
  ].join('');

  // glitter suspended in the plastic, kept off the bezel
  const rnd = rng(41), dots = [], twinkles = [];
  for (let i = 0; i < 90; i++) {
    const x = 60 + rnd() * 920, y = 220 + rnd() * 1080;
    if (x > BOX.x - 20 && x < BOX.x + BOX.w + 20 && y > BOX.y - 20 && y < BOX.y + BOX.h + 20) continue;
    if (i % 8 === 0) twinkles.push(sparkle(x, y, 6 + rnd() * 5)); else dots.push(circle(x, y, 1.3 + rnd() * 2.2));
  }

  const left = arcIdx(pts, 140, 214), crown = arcIdx(pts, 246, 262), right = arcIdx(pts, 6, 76);
  const earL = arcIdx(pts, 188, 250, [EARS[0].x, EARS[0].y]), earR = arcIdx(pts, 226, 268, [EARS[1].x, EARS[1].y]);
  const cut = (idx, a, b) => idx.slice(Math.round(idx.length * a), Math.round(idx.length * b));
  const all = [...pts.keys()];

  const body = [
    path(ellipse(CX, H - 34, 380, 22), { fill: 'url(#vpFloor)' }),
    strap(),
    // clear body: internals first so the tinted plastic sits over them
    g({ clipPath: 'url(#vpBody)' }, internals()),
    path(BODY, { fill: 'url(#vpPlastic)' }),
    g({ clipPath: 'url(#vpBody)' },
      `<rect width="${W}" height="${H}" fill="url(#vpKey)"/><rect width="${W}" height="${H}" fill="url(#vpCool)"/>`,
      path(dots.join(''), { fill: '#fff', fillOpacity: 0.8 }),
      path(twinkles.join(''), { fill: '#fff4c9', fillOpacity: 0.9 }),
      // denser plastic towards the edges
      path(BODY, { fill: 'none', stroke: '#d0458a', strokeOpacity: 0.16, strokeWidth: 96 }),
      path(BODY, { fill: 'none', stroke: '#a8307a', strokeOpacity: 0.24, strokeWidth: 30 }),
      // wall thickness: a bright inner contour
      path(insetLine(pts, nrm, all, 21), { fill: 'none', stroke: '#fff', strokeOpacity: 0.32, strokeWidth: 3 }),
      // light gathered in the plastic near the base (caustic), opposite the key light
      path(crescent(pts, nrm, arcIdx(pts, 48, 132), 16, 90, 1.2), { fill: 'url(#vpCaustic)' }),
      // cool rim light (bottom right)
      path(crescent(pts, nrm, right, 11, 15, 0.8), { fill: '#d8eeff', fillOpacity: 0.8 }),
      // anime glare: big soft sheen, sharp crescent + a thin echo, crown and ear crescents
      path(crescent(pts, nrm, left, 14, 104, 1.3, 0.62), { fill: 'url(#vpSheen)', fillOpacity: 0.5 }),
      path(crescent(pts, nrm, cut(left, 0.14, 0.95), 28, 24, 0.9, 0.62), { fill: '#fff', fillOpacity: 0.95 }),
      path(crescent(pts, nrm, cut(left, 0.3, 0.86), 62, 7, 1, 0.6), { fill: '#fff', fillOpacity: 0.8 }),
      path(crescent(pts, nrm, arcIdx(pts, 250, 300), 12, 30, 1.2, 0.4), { fill: '#fff', fillOpacity: 0.28 }),
      path(crescent(pts, nrm, crown, 16, 13, 0.9), { fill: '#fff', fillOpacity: 0.85 }),
      // small double glint on the right shoulder
      path(crescent(pts, nrm, arcIdx(pts, 330, 346), 20, 9, 1), { fill: '#fff', fillOpacity: 0.8 }),
      path(crescent(pts, nrm, arcIdx(pts, 334, 343), 38, 5, 1), { fill: '#fff', fillOpacity: 0.65 }),
      path(crescent(pts, nrm, earL, 13, 18, 1), { fill: '#fff', fillOpacity: 0.9 }),
      path(crescent(pts, nrm, earR, 13, 10, 1), { fill: '#fff', fillOpacity: 0.6 })),
    path(BODY, { fill: 'none', stroke: INK, strokeWidth: 9, strokeLinejoin: 'round' }),
    earPads(),
    // rosy cheeks printed on the plastic
    path(ellipse(CX - 212, 1046, 38, 21) + ellipse(CX + 212, 1046, 38, 21), { fill: 'url(#vpBlush)' }),
    ringAndTab(topY),
    charm(topY),
    bezel(),
    pawButtons(),
    // round glints on the plastic
    path(circle(140, 470, 13), { fill: '#fff', class: 'vp-tw' }),
    path(circle(168, 440, 6.5), { fill: '#fff' }),
    path(circle(884, 1080, 7), { fill: '#fff', fillOpacity: 0.9 }),
    path(sparkle(112, 540, 22, 0.16), { fill: '#fff', class: 'vp-tw2' }),
    // sparkles around the toy
    path(sparkle(64, 230, 24), { fill: '#fff4c9', stroke: INK, strokeWidth: 3, class: 'vp-tw' }),
    path(sparkle(988, 440, 18), { fill: '#c9f0ff', stroke: INK, strokeWidth: 3, class: 'vp-tw2' }),
    path(sparkle(990, 1180, 16), { fill: '#ffd0e4', stroke: INK, strokeWidth: 3 }),
    path(heart(52, 1230, 13), { fill: '#ff8fb8', stroke: INK, strokeWidth: 3 }),
    path(star(900, 150, 15, 6.5), { fill: '#ffe372', stroke: INK, strokeWidth: 3, strokeLinejoin: 'round' }),
  ].join('\n');
  return { defs, body };
}

module.exports = {
  W, H, hole, radius, draw,
  meta: { name: 'Virtual Pet', theme: 'classic', translucent: true,
    desc: 'A chubby clear-pink keychain pet with bear ears and paw buttons, glowing with your shell fill.',
    tags: ['starter', 'virtual-pet', 'keychain', 'clear', 'cute'] },
};
