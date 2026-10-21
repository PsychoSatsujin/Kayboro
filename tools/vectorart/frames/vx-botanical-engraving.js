'use strict';
// Botanical Plate: a hand-coloured copperplate from a 19th-century natural-history folio. A passionflower
// vine roots in the lower left corner, climbs the margin and arches over the top, opening one great bloom
// in the corner (radiating corona filaments banded violet, white and blue, anthers and three clubbed
// stigmas) with a bud, coiled tendrils and three-lobed leaves engraved in true contour hatching: every
// hatch line follows the leaf's veins and lengthens into the shade. A ripe fruit hangs at the right, its
// rind built from stipple, beside a ruled circular inset of its cross-section. Along the foot lie the
// other specimens: an inset of a magnified pitted seed, a split milkweed pod spilling seeds on silk
// floss, a moth pinned through the thorax casting a faint shadow, a seed series and a scale bar. Cream
// laid paper, foxed, deckled, with the plate mark and a ruled double border; a plain mat around the
// screen. All shading is geometry (hatching and stipple, seeded), no pattern fills or displacement
// filters. No lettering anywhere. Original Kayboro artwork, CC BY 4.0.
const { getStroke } = require('perfect-freehand');
const { createNoise2D } = require('simplex-noise');
const L = require('../lib');
const { rr, path, g, lg, rg, circle, ellipse, rng, lip } = L;

const W = 1500, H = 1200, hole = { x: 310, y: 320, w: 880, h: 495 }, radius = 2;
const SEPIA = '#3e2412';
const PAPER = '#f1e5c8';
const PM = 54; // plate mark inset
const BR = 92; // ruled border inset

const n1 = (v) => +(+v).toFixed(1);
const P1 = (...v) => v.map(n1).join(' ');
const P0 = (...v) => v.map(Math.round).join(' ');
const add = (a, b, k = 1) => [a[0] + b[0] * k, a[1] + b[1] * k];
const rot = (x, y, a, r) => [x + Math.cos(a) * r, y + Math.sin(a) * r];
/** Blend two #rrggbb colours (a = weight of the second). */
const mix = (c1, c2, a) => '#' + [1, 3, 5].map((i) => Math.round(parseInt(c1.slice(i, i + 2), 16) * (1 - a) + parseInt(c2.slice(i, i + 2), 16) * a).toString(16).padStart(2, '0')).join('');
const LIGHT = (() => { const l = Math.hypot(1, 1.3); return [-1 / l, -1.3 / l]; })(); // light from the upper left

// ---- compact path writing -----------------------------------------------------------------------------
const fmt = (v) => String(v).replace(/^(-?)0\./, '$1.');
/** Join numbers SVG-style: no space before '-' or before '.' when the previous number already has a point. */
function joinNums(list) {
  let s = '';
  for (const t of list.map(fmt)) s += (s && t[0] !== '-' && !(t[0] === '.' && /\.\d*$/.test(s)) ? ' ' : '') + t;
  return s;
}
/** Smooth open (or closed) curve through pts, relative quadratic segments on a 0.1 grid. */
function curve(pts, closed = false, q = 2) {
  if (pts.length < 2) return '';
  const R = (p) => [Math.round(p[0] * q), Math.round(p[1] * q)], m = (a, b) => [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2];
  const nums = [];
  let start, cur;
  if (closed) {
    start = R(m(pts[0], pts[1])); cur = start;
    for (let i = 1; i <= pts.length; i++) {
      const a = R(pts[i % pts.length]), e = R(m(pts[i % pts.length], pts[(i + 1) % pts.length]));
      nums.push(a[0] - cur[0], a[1] - cur[1], e[0] - cur[0], e[1] - cur[1]); cur = e;
    }
  } else {
    start = R(pts[0]); cur = start;
    if (pts.length === 2) { const e = R(pts[1]); return `M${joinNums([start[0] / q, start[1] / q])}l${joinNums([(e[0] - cur[0]) / q, (e[1] - cur[1]) / q])}`; }
    for (let i = 1; i < pts.length - 1; i++) {
      const a = R(pts[i]), e = R(i === pts.length - 2 ? pts[i + 1] : m(pts[i], pts[i + 1]));
      nums.push(a[0] - cur[0], a[1] - cur[1], e[0] - cur[0], e[1] - cur[1]); cur = e;
    }
  }
  return `M${joinNums([start[0] / q, start[1] / q])}q${joinNums(nums.map((v) => v / q))}${closed ? 'Z' : ''}`;
}
/** Stipple dots as zero-length round-capped moves (relative): one path per dot size. */
function dotsD(list) {
  if (!list.length) return '';
  let d = '', cur = null;
  for (const [x, y] of list) {
    const p = [Math.round(x * 10), Math.round(y * 10)];
    d += cur ? `m${joinNums([(p[0] - cur[0]) / 10, (p[1] - cur[1]) / 10])}h0` : `M${joinNums([p[0] / 10, p[1] / 10])}h0`;
    cur = p;
  }
  return d;
}
/** Ramer-Douglas-Peucker on an open point list. */
function rdp(pts, eps) {
  if (pts.length < 4) return pts;
  const keep = new Uint8Array(pts.length); keep[0] = keep[pts.length - 1] = 1;
  const stack = [[0, pts.length - 1]];
  while (stack.length) {
    const [a, b] = stack.pop(); let best = -1, bi = -1;
    const [ax, ay] = pts[a], [bx, by] = pts[b], dx = bx - ax, dy = by - ay, l = Math.hypot(dx, dy) || 1;
    for (let i = a + 1; i < b; i++) { const d = Math.abs((pts[i][0] - ax) * dy - (pts[i][1] - ay) * dx) / l; if (d > best) { best = d; bi = i; } }
    if (best > eps) { keep[bi] = 1; stack.push([a, bi], [bi, b]); }
  }
  return pts.filter((_, i) => keep[i]);
}
/** Swelling burin line (perfect-freehand): thin at the ends, full in the middle. */
function burin(pts, w, seed = 0) {
  const N = createNoise2D(rng(seed + 1));
  const pp = pts.map((p, i) => { const t = i / (pts.length - 1); return [p[0], p[1], Math.max(0.15, Math.sin(Math.PI * t) ** 0.5 * (0.8 + 0.25 * N(t * 4, 0)))]; });
  const o = getStroke(pp, { size: w / 2, thinning: 1, smoothing: 0.2, streamline: 0.1, simulatePressure: false, last: true, start: { cap: true }, end: { cap: true } });
  return o.length > 2 ? curve(rdp(o, 0.4), true) : '';
}

// ---- layers --------------------------------------------------------------------------------------------
// tints (watercolour, offset a touch off the lines), fine hatching, heavier contours, stipple, highlights
const L_ = { tint: [], fine: '', mid: '', line: '', burin: '', stip: [], white: '' };
const tint = (d, color, a = 0.5) => L_.tint.push(path(d, { fill: color, fillOpacity: a }));
const fine = (d) => { L_.fine += d; };
const mid = (d) => { L_.mid += d; };
const line = (d) => { L_.line += d; };
const cut = (d) => { L_.burin += d; };
const solid = [];
/** Rejection-sampled stipple inside a bbox: density(x, y) in 0..1, minimum spacing sp (seeded). */
function stipple(x0, y0, x1, y1, density, sp, seed) {
  const rnd = rng(seed), cell = sp / Math.SQRT2, gw = Math.ceil((x1 - x0) / cell), gh = Math.ceil((y1 - y0) / cell), grid = new Int32Array(gw * gh).fill(-1), pts = [];
  const tries = Math.round(((x1 - x0) * (y1 - y0)) / (sp * sp) * 3);
  for (let k = 0; k < tries; k++) {
    const x = x0 + rnd() * (x1 - x0), y = y0 + rnd() * (y1 - y0), dn = density(x, y);
    if (dn <= 0 || rnd() > dn) continue;
    const gx = Math.floor((x - x0) / cell), gy = Math.floor((y - y0) / cell);
    let ok = true;
    for (let j = Math.max(0, gy - 2); ok && j <= Math.min(gh - 1, gy + 2); j++) for (let i = Math.max(0, gx - 2); i <= Math.min(gw - 1, gx + 2); i++) {
      const q = grid[j * gw + i]; if (q >= 0 && Math.hypot(pts[q][0] - x, pts[q][1] - y) < sp) { ok = false; break; }
    }
    if (!ok) continue;
    grid[gy * gw + gx] = pts.length; pts.push([x, y]);
  }
  // order the dots row by row so the relative moves stay short
  pts.sort((a, b) => Math.floor(a[1] / 12) - Math.floor(b[1] / 12) || (Math.floor(a[1] / 12) % 2 ? b[0] - a[0] : a[0] - b[0]));
  L_.stip.push(dotsD(pts));
}

// ---- leaves --------------------------------------------------------------------------------------------
/**
 * One leaf blade (or lobe) around a curved midrib from base b, direction a (radians), length len, half-width
 * hw, bending by bend over its length. Returns a point function P(u, v) (u 0..1 along, v -1..1 across) and
 * which side of the midrib turns away from the light.
 */
function blade(b, a, len, hw, bend = 0, shape = (u) => Math.sin(Math.PI * Math.min(1, u ** 0.72)) ** 0.85) {
  const m = 24, mids = [b], ang = [];
  for (let i = 1; i <= m; i++) { const t = i / m, an = a + bend * t; ang.push(an); mids.push(rot(...mids[i - 1], an, len / m)); }
  ang.unshift(a);
  const at = (u) => { const f = Math.min(m - 1e-6, Math.max(0, u * m)), i = Math.floor(f), s = f - i; return [mids[i][0] + (mids[i + 1][0] - mids[i][0]) * s, mids[i][1] + (mids[i + 1][1] - mids[i][1]) * s, ang[i] + (ang[i + 1] - ang[i]) * s]; };
  const P = (u, v) => { const [x, y, an] = at(Math.max(0, Math.min(1, u))); const w = hw * shape(Math.max(0, Math.min(1, u))) * v; return [x - Math.sin(an) * w, y + Math.cos(an) * w]; };
  const nx = -Math.sin(a + bend / 2), ny = Math.cos(a + bend / 2), shadeSide = nx * LIGHT[0] + ny * LIGHT[1] > 0 ? -1 : 1;
  return { P, shadeSide };
}
/** Engrave a blade: tinted, outlined with a swelling line, veined and contour-hatched into the shade. */
function engraveBlade(bl, { col = '#8ea05a', veins = 7, seed = 1, sp = 4.1, alpha = 0.55, opaque = '#e4dcb4' } = {}) {
  const { P, shadeSide: s } = bl, rnd = rng(seed), N = createNoise2D(rng(seed + 7));
  const edgeA = [], edgeB = [];
  for (let i = 0; i <= 15; i++) { const u = i / 15; edgeA.push(P(u, 1)); edgeB.push(P(u, -1)); }
  const outline = [...edgeA, ...edgeB.reverse().slice(1, -1)];
  const d = curve(outline, true);
  solid.push(path(d, { fill: mix(opaque, col, alpha) }));
  let hatch = '', vein = '';
  // contour hatching: lines that leave the midrib and sweep toward the tip like the veins, long in the
  // shaded half, short ticks along the midrib in the lit half
  const lenEst = Math.hypot(P(1, 0)[0] - P(0, 0)[0], P(1, 0)[1] - P(0, 0)[1]), du = sp / Math.max(60, lenEst);
  for (let u = 0.04; u < 0.97; u += du) {
    const reach = 0.45 + 0.5 * (0.5 + 0.5 * N(u * 3, 0));
    hatch += curve([0, 0.5, 1].map((k) => { const v = k * reach; return P(u + 0.16 * v * v, v * s); }), false, 1);
    if ((Math.round(u / du)) % 4 === 0) hatch += curve([P(u, -0.04 * s), P(u + 0.02, -0.24 * s)], false, 1);
  }
  // deep shade: a second set of lines running along the blade near the shaded edge
  for (const v of [0.8, 0.93]) { const q = []; for (let k = 0; k <= 4; k++) { const u = 0.16 + (k / 4) * 0.66; q.push(P(u, v * s)); } hatch += curve(q, false, 1); }
  // midrib and paired lateral veins
  vein += curve([0, 0.33, 0.66, 1].map((u) => P(u, 0)), false, 2);
  for (let k = 1; k <= veins; k++) {
    const u = k / (veins + 1);
    for (const side of [1, -1]) vein += curve([P(u - 0.02, 0), P(u + 0.06, 0.45 * side), P(u + 0.14 + rnd() * 0.02, 0.86 * side)], false, 1);
  }
  fine(hatch); mid(vein);
  cut(burin(edgeA, 2.6, seed) + burin(edgeB.slice().reverse(), 2.6, seed + 3));
}
/** A three-lobed passionflower leaf on a short stalk from point p along direction a, size s. */
function leaf(p, a, s, seed, bend = 0.15, spread = 0.62) {
  const tip = rot(...p, a, s * 0.35);
  mid(curve([p, rot(...p, a + 0.08, s * 0.18), tip]));
  engraveBlade(blade(tip, a - spread, s * 0.8, s * 0.2, -bend - 0.15), { seed: seed + 1, veins: 6 });
  engraveBlade(blade(tip, a + spread, s * 0.8, s * 0.2, bend + 0.15), { seed: seed + 2, veins: 6 });
  engraveBlade(blade(tip, a, s, s * 0.24, bend * 0.4), { seed: seed + 3, veins: 8 });
}
/** A coiled tendril: a loose run that winds into a tight spiral. */
function tendril(p, a, len, turns, dir, seed) {
  const rnd = rng(seed), pts = [p];
  let an = a, r = len / 10;
  for (let i = 1; i < 60; i++) { const t = i / 60; an += dir * (0.02 + t * t * turns * 0.35); r = len / 60 * (1 - t * 0.6); pts.push(rot(...pts[i - 1], an, r + rnd() * 0.3)); }
  mid(curve(pts.filter((_, i) => i % 2 === 0)));
}
/** A tapered stem along control points (Catmull-Rom), w0 -> w1, hatched along its shaded side. */
function stem(ctrl, w0, w1, seed) {
  const pts = [], m = 40, p = [ctrl[0], ...ctrl, ctrl[ctrl.length - 1]], seg = ctrl.length - 1;
  for (let k = 0; k <= m; k++) {
    const u = (k / m) * seg, i = Math.min(seg - 1, Math.floor(u)), s = u - i, [a, b, c, d] = [p[i], p[i + 1], p[i + 2], p[i + 3]], s2 = s * s, s3 = s2 * s;
    pts.push([0, 1].map((j) => 0.5 * ((2 * b[j]) + (-a[j] + c[j]) * s + (2 * a[j] - 5 * b[j] + 4 * c[j] - d[j]) * s2 + (-a[j] + 3 * b[j] - 3 * c[j] + d[j]) * s3)));
  }
  const left = [], right = [], shade = [];
  pts.forEach((q, i) => {
    const a = pts[Math.max(0, i - 1)], b = pts[Math.min(m, i + 1)], an = Math.atan2(b[1] - a[1], b[0] - a[0]), w = (w0 + (w1 - w0) * (i / m)) / 2;
    left.push(rot(...q, an - Math.PI / 2, w)); right.push(rot(...q, an + Math.PI / 2, w)); shade.push(rot(...q, an + Math.PI / 2, w * 0.45));
  });
  const d = curve([...left, ...right.slice().reverse()], true);
  solid.push(path(d, { fill: '#d9cf9e' }), path(d, { fill: '#7f8a46', fillOpacity: 0.5, transform: 'translate(1.5 1)' }));
  fine(curve(shade));
  let ticks = '';
  // short engraved ticks off the shaded edge (right[] runs base to tip before the reverse below)
  for (let i = 1; i < m; i += 2) { const r = right[i], l = left[i]; ticks += curve([r, [r[0] * 0.6 + l[0] * 0.4, r[1] * 0.6 + l[1] * 0.4]], false, 1); void seed; }
  fine(ticks);
  line(curve(left) + curve(right));
  return pts;
}

// ---- passionflower ---------------------------------------------------------------------------------------
/** The open bloom at (x, y), radius R, seen a little from below (squashed by k). */
function passionflower(x, y, R, k = 0.86, spin = 0) {
  const T = (px, py) => { const c = Math.cos(spin), s = Math.sin(spin), qy = py * k; return [x + px * c - qy * s, y + px * s + qy * c]; };
  const tepal = (a, len, w, col, seed) => {
    const pts = [], rib = [];
    for (let i = 0; i <= 14; i++) { const u = i / 14, hw = w * Math.sin(Math.PI * Math.min(1, u ** 0.8)) ** 0.7; rib.push(u); pts.push([u, hw]); }
    const P = (u, v) => { const r = 0.12 * R + u * len, hw = w * Math.sin(Math.PI * Math.min(1, Math.max(0, u) ** 0.8)) ** 0.7 * v; return T(Math.cos(a) * r - Math.sin(a) * hw, Math.sin(a) * r + Math.cos(a) * hw); };
    const out = [...pts.map(([u]) => P(u, 1)), ...pts.slice(1, -1).reverse().map(([u]) => P(u, -1))];
    const d = curve(out, true);
    solid.push(path(d, { fill: '#f6f1df' }), path(d, { fill: col, fillOpacity: 0.45, transform: 'translate(1.6 1.2)' }));
    let h = '';
    for (const v of [-0.55, 0.35, 0.6, 0.82]) h += curve([0.1, 0.5, 0.9].map((u) => P(u, v)));
    fine(h); mid(curve([0.05, 0.5, 0.97].map((u) => P(u, 0)))); cut(burin(out.slice(0, 15), 2, seed) + burin(out.slice(14).concat([out[0]]), 2, seed + 1));
  };
  for (let i = 0; i < 5; i++) tepal(spin * 0 + (i * 2 * Math.PI) / 5 + Math.PI / 5, R * 0.86, R * 0.15, '#9fb27a', 10 + i);
  for (let i = 0; i < 5; i++) tepal((i * 2 * Math.PI) / 5, R * 0.8, R * 0.14, '#d8c8e8', 20 + i);
  // corona bands (violet at the throat, a white ring, blue-violet toward the tips) and the filaments over them
  // the corona: wavy filaments banded violet at the throat, white, then blue-violet to the tips
  const rnd = rng(31), bands = ['', '', ''];
  let fil = '';
  for (let i = 0; i < 60; i++) {
    const a = (i / 60) * Math.PI * 2 + rnd() * 0.04, r1 = R * (0.66 + rnd() * 0.14), wob = (rnd() - 0.5) * 0.14;
    const pt = (q) => T(...rot(0, 0, a + wob * Math.sin(q * 6), 0.15 * R + (r1 - 0.15 * R) * q));
    bands[0] += curve([pt(0), pt(0.15), pt(0.3)]); bands[1] += curve([pt(0.3), pt(0.38), pt(0.46)]); bands[2] += curve([pt(0.46), pt(0.7), pt(0.86), pt(1)]);
    if (i % 2) fil += curve([pt(0), pt(0.5), pt(1)]);
  }
  solid.push(path(bands[0], { fill: 'none', stroke: '#5b2a6e', strokeWidth: 2.6, strokeLinecap: 'round' }),
    path(bands[1], { fill: 'none', stroke: '#fbf7ec', strokeWidth: 2.6, strokeLinecap: 'round' }),
    path(bands[2], { fill: 'none', stroke: '#6a70b6', strokeWidth: 2.2, strokeLinecap: 'round', strokeOpacity: 0.9 }));
  fine(fil);
  // operculum, column, five anthers and three clubbed stigmas
  const opc = []; for (let i = 0; i < 24; i++) opc.push(T(...rot(0, 0, (i / 24) * Math.PI * 2, 0.15 * R)));
  solid.push(path(curve(opc, true), { fill: '#d8e0b0' }));
  line(curve(opc, true));
  let anth = '', sty = '';
  for (let i = 0; i < 5; i++) {
    const a = (i / 5) * Math.PI * 2 + 0.3, b = T(...rot(0, 0, a, R * 0.05)), e = T(...rot(0, 0, a, R * 0.2));
    sty += curve([b, e]);
    const c = e, an = Math.atan2(e[1] - b[1], e[0] - b[0]) + Math.PI / 2, pts = [];
    for (let j = 0; j < 10; j++) { const t = (j / 10) * Math.PI * 2; pts.push(add(c, [Math.cos(an) * Math.cos(t) * R * 0.08 - Math.sin(an) * Math.sin(t) * R * 0.03, Math.sin(an) * Math.cos(t) * R * 0.08 + Math.cos(an) * Math.sin(t) * R * 0.03])); }
    anth += curve(pts, true);
  }
  solid.push(path(anth, { fill: '#e6c24a' }));
  line(anth);
  for (let i = 0; i < 3; i++) {
    const a = (i / 3) * Math.PI * 2 - 1.2, b = T(0, -R * 0.02), m1 = T(...rot(0, -R * 0.08, a, R * 0.12)), e = T(...rot(0, -R * 0.1, a, R * 0.24));
    sty += curve([b, m1, e]);
    solid.push(path(L.circle(e[0], e[1], R * 0.035), { fill: '#8a4a3a' }));
  }
  line(sty);
  solid.push(path(L.circle(...T(0, -R * 0.02), R * 0.05), { fill: '#b8c482' }));
}
/** A closed bud on a pedicel: a green teardrop with sepal seams and tiny horns, three leafy bracts. */
function bud(p, a, s, seed) {
  const tip = rot(...p, a, s), bl = blade(p, a, s, s * 0.3, 0, (u) => Math.sin(Math.PI * Math.min(1, u ** 0.55)) ** 0.9);
  engraveBlade(bl, { col: '#9fb27a', veins: 0, seed, sp: 3, opaque: '#e6e2c2' });
  for (const v of [-0.5, 0, 0.5]) mid(curve([0.1, 0.5, 0.95].map((u) => bl.P(u, v))));
  for (const sd of [-1, 1]) engraveBlade(blade(p, a + sd * 0.5, s * 0.42, s * 0.14, sd * 0.3), { veins: 2, seed: seed + 4 + sd, sp: 3 });
  void tip;
}

// ---- fruit -----------------------------------------------------------------------------------------------
/** A ripe passion fruit hanging from (x, y): stipple carries the whole form (dense in the shade, open in light). */
function fruit(x, y, rx, ry) {
  const cx = x, cy = y + ry + 14;
  mid(curve([[x, y - 30], [x + 4, y - 10], [cx, cy - ry]]));
  const d = ellipse(cx, cy, rx, ry);
  solid.push(path(d, { fill: '#efe2c6' }), path(d, { fill: '#7a3f66', fillOpacity: 0.55, transform: 'translate(2 1.5)' }));
  stipple(cx - rx, cy - ry, cx + rx, cy + ry, (px, py) => {
    const u = (px - cx) / rx, v = (py - cy) / ry, r2 = u * u + v * v;
    if (r2 > 1) return 0;
    const nz = Math.sqrt(1 - r2), lit = Math.max(0, Math.min(1, (u * LIGHT[0] + v * LIGHT[1]) * 0.75 + nz * 0.45));
    const hi = Math.hypot(u + 0.38, v + 0.42) < 0.2 ? 0 : 1;
    return hi * Math.min(1, 0.04 + (1 - lit) ** 1.6 * 1.1 + r2 ** 4 * 0.3);
  }, 2.9, 77);
  line(d);
  // the dried flower remains and three bracts at the stalk
  for (const sd of [-1, 0, 1]) engraveBlade(blade([cx, cy - ry + 4], -Math.PI / 2 + sd * 0.7, ry * 0.55, ry * 0.16, sd * 0.4), { col: '#9fb27a', veins: 3, seed: 90 + sd, sp: 3 });
}

// ---- insets ----------------------------------------------------------------------------------------------
const insets = [];
function insetFrame(cx, cy, r) {
  solid.push(path(L.circle(cx, cy, r), { fill: '#f6eed8' }));
  insets.push(path(L.circle(cx, cy, r), { fill: 'none', stroke: SEPIA, strokeWidth: 1.8 }) + path(L.circle(cx, cy, r + 5), { fill: 'none', stroke: SEPIA, strokeWidth: 0.7 }));
}
/** Cross-section of the fruit: hatched rind, white pith, pulp sacs and seeds in three placental clusters. */
function fruitSection(cx, cy, r) {
  insetFrame(cx, cy, r);
  const R = r * 0.82, rnd = rng(55);
  solid.push(path(L.circle(cx, cy, R), { fill: '#7a3f66', fillOpacity: 0.55 }), path(L.circle(cx, cy, R * 0.86), { fill: '#fbf6e8' }), path(L.circle(cx, cy, R * 0.66), { fill: '#e8b84a', fillOpacity: 0.55 }));
  let h = '';
  for (let i = 0; i < 64; i++) { const a = (i / 64) * Math.PI * 2; h += curve([rot(cx, cy, a, R * 0.87), rot(cx, cy, a + 0.02, R * 0.99)]); }
  fine(h);
  line(L.circle(cx, cy, R) + L.circle(cx, cy, R * 0.86));
  mid(L.circle(cx, cy, R * 0.66));
  let seeds = '', sacs = '';
  for (let c = 0; c < 3; c++) {
    const a0 = (c / 3) * Math.PI * 2 + 0.4;
    for (let i = 0; i < 7; i++) {
      const a = a0 + (rnd() - 0.5) * 1.3, rr0 = R * (0.18 + rnd() * 0.42), [sx, sy] = rot(cx, cy, a, rr0), an = a + (rnd() - 0.5) * 0.8;
      sacs += ellipseRot(sx, sy, R * 0.12, R * 0.085, an);
      seeds += ellipseRot(sx, sy, R * 0.06, R * 0.04, an);
    }
  }
  solid.push(path(sacs, { fill: '#f0cf72', fillOpacity: 0.7 }));
  mid(sacs);
  solid.push(path(seeds, { fill: '#2a1a10' }));
  stipple(cx - R * 0.66, cy - R * 0.66, cx + R * 0.66, cy + R * 0.66, (px, py) => { const q = Math.hypot(px - cx, py - cy) / (R * 0.66); return q < 1 ? 0.15 + q * 0.5 : 0; }, 3.2, 56);
}
function ellipseRot(cx, cy, rx, ry, a) {
  const pts = [];
  for (let i = 0; i < 8; i++) { const t = (i / 8) * Math.PI * 2, x = Math.cos(t) * rx, y = Math.sin(t) * ry; pts.push([cx + x * Math.cos(a) - y * Math.sin(a), cy + x * Math.sin(a) + y * Math.cos(a)]); }
  return curve(pts, true, 10);
}
/** A magnified seed: pitted (reticulate) coat, hatched into the shade, beside a life-size seed. */
function seedInset(cx, cy, r) {
  insetFrame(cx, cy, r);
  const rx = r * 0.42, ry = r * 0.62, sx = cx - r * 0.06, sy = cy;
  const d = ellipse(sx, sy, rx, ry);
  solid.push(path(d, { fill: '#6a4a2a', fillOpacity: 0.45 }));
  let pits = '';
  for (let j = -6; j <= 6; j++) for (let i = -4; i <= 4; i++) {
    const px = sx + (i + (j % 2 ? 0.5 : 0)) * rx * 0.22, py = sy + j * ry * 0.15, u = (px - sx) / rx, v = (py - sy) / ry;
    if (u * u + v * v > 0.8) continue;
    const sq = Math.sqrt(1 - u * u - v * v);
    pits += ellipseRot(px, py, rx * 0.085 * (0.6 + sq * 0.5), ry * 0.055 * (0.6 + sq * 0.5), 0);
  }
  mid(pits);
  let h = '';
  for (let k = -12; k <= 12; k++) { const yy = sy + (k / 13) * ry, half = rx * Math.sqrt(Math.max(0, 1 - (k / 13) ** 2)); if (half < 2) continue; h += curve([[sx + half * 0.35, yy], [sx + half * 0.7, yy + 2], [sx + half * 0.98, yy + 1]]); }
  fine(h);
  line(d);
  solid.push(path(ellipse(cx + r * 0.6, cy + r * 0.45, 3, 4.5), { fill: '#3a2414' }));
}

// ---- milkweed pod ------------------------------------------------------------------------------------------
/** A split milkweed pod lying from a to b, seeds lined up inside, three drifting away on silk floss. */
function milkweed(a, b, wPod, seed) {
  const rnd = rng(seed), an = Math.atan2(b[1] - a[1], b[0] - a[0]), len = Math.hypot(b[0] - a[0], b[1] - a[1]);
  const bl = blade(a, an, len, wPod, -0.22, (u) => Math.sin(Math.PI * Math.min(1, u ** 0.8)) ** 0.75);
  engraveBlade(bl, { col: '#9a9a5a', veins: 0, seed: seed + 1, sp: 3.2, opaque: '#e6dcb8' });
  // warty bumps on the outer shell
  let warts = '';
  for (let i = 0; i < 26; i++) { const u = 0.12 + rnd() * 0.76, v = 0.35 + rnd() * 0.5, p = bl.P(u, v * bl.shadeSide * -1), q = bl.P(u + 0.02, v * bl.shadeSide * -1 + 0.08); warts += curve([p, [(p[0] + q[0]) / 2 + 2, (p[1] + q[1]) / 2 - 2], q]); }
  mid(warts);
  // the split: a pale lining with flat seeds overlapping like scales
  const lin = []; for (let i = 0; i <= 12; i++) lin.push(bl.P(0.1 + (i / 12) * 0.82, -0.05)); for (let i = 12; i >= 0; i--) lin.push(bl.P(0.1 + (i / 12) * 0.82, -0.05 - 0.55 * Math.sin(Math.PI * i / 12)));
  solid.push(path(curve(lin, true), { fill: '#fbf5e2' }));
  line(curve(lin, true));
  let seeds = '';
  for (let i = 0; i < 9; i++) { const u = 0.18 + i * 0.075, p = bl.P(u, -0.3); seeds += ellipseRot(p[0], p[1], 11, 7.5, an - 0.22 + 0.4); }
  solid.push(path(seeds, { fill: '#8a5a2a', fillOpacity: 0.7 }));
  mid(seeds);
  // escaped seeds with fanned floss
  const out = [[b[0] + 70, b[1] - 4], [b[0] + 140, b[1] + 44], [b[0] + 60, b[1] + 78]];
  let floss = '', fs = '';
  out.forEach(([sx, sy], k) => {
    const fa = an - 0.9 + k * 0.5;
    fs += ellipseRot(sx, sy, 8, 5.5, fa + Math.PI);
    for (let i = 0; i < 15; i++) {
      const aa = fa - 0.7 + (i / 14) * 1.4, l = 46 + rnd() * 26, p1 = rot(sx, sy, aa, l * 0.5), e = rot(sx, sy, aa + (rnd() - 0.5) * 0.25, l);
      floss += curve([rot(sx, sy, fa, 6), [p1[0] + (rnd() - 0.5) * 4, p1[1] + (rnd() - 0.5) * 4], e]);
    }
  });
  fine(floss);
  solid.push(path(fs, { fill: '#8a5a2a', fillOpacity: 0.8 }));
  line(fs);
}

// ---- pinned moth ---------------------------------------------------------------------------------------------
/** A moth set and pinned: wings in polar outline from the base, hatched along the veins, banded, with
 *  eyespots, a feathered antenna pair, a stippled body and a pin through the thorax with its shadow. */
function moth(cx, cy, s) {
  const wings = [];
  const wing = (sx, th0, th1, Lw, rf, seed) => {
    const N = createNoise2D(rng(seed)), base = [cx + sx * 6 * s, cy + (th0 < 0 ? -8 : 2) * s], pts = [base], m = 34;
    const P = (t, f) => { const th = th0 + (th1 - th0) * t, r = Lw * s * rf(t) * f; return [base[0] + sx * Math.cos(th) * r, base[1] + Math.sin(th) * r]; };
    for (let i = 0; i <= m; i++) pts.push(P(i / m, 1));
    const d = curve(pts, true);
    wings.push({ d, P, N, m, sx });
    return { d, P };
  };
  const fore = (t) => 0.98 - 0.4 * t ** 1.4 + 0.06 * Math.sin(Math.PI * t) - 0.08 * (1 - Math.min(1, t * 8));
  const hind = (t) => 0.72 + 0.26 * Math.sin(Math.PI * t) ** 0.8;
  const set = [];
  for (const sx of [1, -1]) {
    set.push([wing(sx, 0.2, 1.5, 92, hind, 3 + sx), '#d9a066', 'hind']);
    set.push([wing(sx, -1.12, 0.22, 150, fore, 5 + sx), '#c47e4a', 'fore']);
  }
  // cast shadow of the whole insect on the paper (pinned a few millimetres proud of the sheet)
  solid.push(path(set.map(([w]) => w.d).join(''), { fill: '#3a2414', fillOpacity: 0.16, transform: `translate(${n1(9 * s)} ${n1(13 * s)})` }));
  for (const [w, col, kind] of set) {
    solid.push(path(w.d, { fill: '#f3e6c6' }), path(w.d, { fill: col, fillOpacity: 0.6, transform: 'translate(1.6 1.2)' }));
    let h = '', band = '', veins = '';
    const nv = kind === 'fore' ? 38 : 26;
    for (let i = 1; i < nv; i++) {
      const t = i / nv, q = 0.5 + 0.5 * wings[0].N(t * 5, kind === 'fore' ? 1 : 2);
      h += curve([w.P(t, 0.06), w.P(t, 0.24), w.P(t, 0.3 + q * 0.16)]);
      h += curve([w.P(t, 0.86), w.P(t, 0.99)]);
      if (i % 2) band += curve([w.P(t, 0.56), w.P(t, 0.68)]);
    }
    for (let i = 1; i < 7; i++) veins += curve([w.P(i / 7, 0.04), w.P(i / 7 + 0.01, 0.5), w.P(i / 7, 0.97)]);
    const pm = []; for (let i = 0; i <= 20; i++) pm.push(w.P(i / 20, 0.68 + 0.025 * Math.sin(i * 1.9)));
    const pm2 = []; for (let i = 0; i <= 20; i++) pm2.push(w.P(i / 20, 0.55 + 0.02 * Math.sin(i * 2.3)));
    solid.push(path(curve([...pm, ...pm2.reverse()], true), { fill: '#6a2a1a', fillOpacity: 0.35 }));
    fine(h + band); mid(veins + curve(pm) + curve(pm2.reverse()));
    line(w.d);
    // eyespot
    const e = w.P(0.5, kind === 'fore' ? 0.4 : 0.46), er = (kind === 'fore' ? 10 : 13) * s;
    solid.push(path(L.circle(...e, er), { fill: '#f6e8c0' }), path(L.circle(...e, er * 0.66), { fill: '#5a2a3a', fillOpacity: 0.85 }), path(L.circle(e[0] - er * 0.2, e[1] - er * 0.2, er * 0.18), { fill: '#fffaf0' }));
    line(L.circle(...e, er));
    // pale fringe dots along the outer edge
    let fr = '';
    for (let i = 2; i < 34; i += 3) { const p = w.P(i / 34, 0.93); fr += `M${P1(...p)}h0`; }
    L_.white += fr;
  }
  // body: abdomen, thorax, head; stippled, ringed
  const ab = ellipse(cx, cy + 34 * s, 9 * s, 34 * s), th = ellipse(cx, cy - 6 * s, 12 * s, 16 * s), hd = L.circle(cx, cy - 26 * s, 7 * s);
  solid.push(path(ab + th + hd, { fill: '#c08a5a' }));
  stipple(cx - 12 * s, cy - 34 * s, cx + 12 * s, cy + 68 * s, (px, py) => { const u = (px - cx) / (12 * s); return 0.25 + Math.max(0, u) * 0.7; }, 2.2, 88);
  let rings = ''; for (let i = 0; i < 6; i++) { const yy = cy + (12 + i * 9) * s, hw = 9 * s * Math.sqrt(Math.max(0, 1 - ((yy - cy - 34 * s) / (34 * s)) ** 2)); rings += curve([[cx - hw, yy], [cx, yy + 3 * s], [cx + hw, yy]]); }
  mid(rings); line(ab + th + hd);
  // feathered antennae
  let ant = '', barbs = '';
  for (const sx of [1, -1]) {
    const pts = []; for (let i = 0; i <= 10; i++) { const t = i / 10; pts.push([cx + sx * (4 + t * 34) * s, cy - (30 + t * 40 - t * t * 6) * s]); }
    ant += curve(pts);
    for (let i = 2; i < 10; i++) { const p = pts[i], l = (8 - Math.abs(i - 5)) * s; barbs += curve([p, [p[0] + sx * l * 0.5, p[1] - l]]) + curve([p, [p[0] + sx * l, p[1] - l * 0.2]]); }
  }
  line(ant); fine(barbs);
  // the pin: a black head with a highlight, its shaft's shadow falling down and right
  insets.push(path(`M${P1(cx + 2, cy - 6 * s)}l${P1(34 * s, 40 * s)}`, { stroke: '#2a1a10', strokeOpacity: 0.3, strokeWidth: 2.4, strokeLinecap: 'round' }));
  insets.push(path(L.circle(cx, cy - 6 * s, 7), { fill: 'url(#bpPin)', stroke: '#120a06', strokeWidth: 1 }));
}

// ---- small specimens ---------------------------------------------------------------------------------------
function seedSeries(x, y) {
  let d = '';
  [3, 4.5, 6.5, 9].forEach((r, i) => { const cx = x + i * 30; d += ellipseRot(cx, y, r * 0.75, r, 0.3); });
  solid.push(path(d, { fill: '#5a3a1e', fillOpacity: 0.8 }));
  line(d);
}
function scaleBar(x, y, w) {
  let blk = '';
  for (let i = 0; i < 5; i++) if (i % 2 === 0) blk += rr(x + (i * w) / 5, y, w / 5, 5, 0);
  solid.push(path(blk, { fill: SEPIA }));
  line(rr(x, y, w, 5, 0));
  let t = '';
  for (let i = 0; i <= 10; i++) t += `M${P1(x + (i * w) / 10, y)}v${i % 5 ? -4 : -8}`;
  mid(t);
}

// ---- paper -----------------------------------------------------------------------------------------------
function sheetPath() {
  const rnd = rng(3), pts = [], step = 22, edge = (a, b, f) => { for (let s = a; s < b; s += step) pts.push(f(s, (rnd() - 0.5) * 3)); };
  edge(12, W - 12, (s, j) => [s, 10 + j]); edge(12, H - 12, (s, j) => [W - 10 + j, s]);
  edge(12, W - 12, (s, j) => [W - s, H - 10 + j]); edge(12, H - 12, (s, j) => [10 + j, H - s]);
  return `M${pts.map((p) => P1(...p)).join('L')}Z`;
}
function foxing() {
  const rnd = rng(12);
  let d = '';
  for (let i = 0; i < 70; i++) {
    const x = 60 + rnd() * (W - 120), y = 60 + rnd() * (H - 120);
    if (x > hole.x - 50 && x < hole.x + hole.w + 50 && y > hole.y - 50 && y < hole.y + hole.h + 50) continue;
    d += L.circle(x, y, 0.8 + rnd() ** 3 * 5);
  }
  return d;
}

function draw() {
  Object.assign(L_, { tint: [], fine: '', mid: '', line: '', burin: '', stip: [], white: '' });
  solid.length = 0; insets.length = 0;
  const sheet = sheetPath();
  const holeD = rr(hole.x, hole.y, hole.w, hole.h, radius);

  // the vine: from the root in the lower left corner, up the margin, over the top, down the right
  const vine = [[150, 1092], [178, 980], [160, 860], [196, 720], [168, 580], [196, 430], [214, 300], [300, 196], [440, 168], [600, 186], [760, 158], [920, 176], [1080, 150], [1220, 170], [1320, 230], [1340, 330]];
  stem(vine.slice(0, 7), 11, 7, 1);
  stem(vine.slice(6), 7, 3.5, 2);
  // leaves (drawn under the bloom), tendrils, the bud
  leaf([166, 1030], -1.35, 170, 100, 0.2);
  leaf([180, 800], -1.85, 160, 120, -0.2);
  leaf([180, 560], -1.4, 150, 130, 0.15);
  leaf([440, 172], -0.2, 140, 140, 0.2);
  leaf([700, 174], 0.25, 134, 150, -0.2);
  leaf([960, 168], -0.2, 140, 160, 0.2);
  leaf([1150, 158], 0.3, 120, 170, -0.15);
  tendril([440, 168], -2.4, 120, 3, 1, 1); tendril([860, 168], 2.2, 110, 3.2, -1, 2); tendril([1240, 176], -2.0, 110, 3, 1, 3);
  tendril([196, 720], 3.6, 110, 3.4, 1, 4); tendril([170, 900], 3.4, 90, 3, -1, 5);
  bud([780, 160], -2.3, 74, 300);
  passionflower(204, 206, 124, 0.88, 0.2);
  fruit(1340, 330, 44, 58);
  fruitSection(1312, 662, 70);
  // leader rule from the fruit to its section
  insets.push(path('M1312 518V588', { stroke: SEPIA, strokeWidth: 0.8, strokeDasharray: '3 4' }));
  // the specimen row along the foot
  seedInset(412, 980, 74);
  milkweed([548, 1048], [790, 930], 34, 400);
  moth(1060, 970, 0.95);
  seedSeries(1226, 1060);
  scaleBar(1240, 1076, 140);

  const defs = [
    `<clipPath id="bpSheet"><path d="${sheet}"/></clipPath>`,
    `<clipPath id="bpInner"><path d="${rr(BR + 12, BR + 12, W - 2 * BR - 24, H - 2 * BR - 24, 0)}"/></clipPath>`,
    lg('bpPaper', [0, 0, 1, 1], [[0, '#f4e9cf'], [0.5, PAPER], [1, '#ebdcb8']]),
    rg('bpEdge', [0.5, 0.5, 0.72], [[0.62, '#a07838', 0], [1, '#8a6228', 0.32]]),
    rg('bpPin', [0.35, 0.3, 0.7], [[0, '#8a8a8a'], [0.35, '#2a2a2a'], [1, '#050505']]),
    // paper age: one slow fractal-noise mottle (the only filter on the plate)
    '<filter id="bpAge" x="0" y="0" width="100%" height="100%"><feTurbulence type="fractalNoise" baseFrequency="0.006 0.008" numOctaves="3" seed="21"/>'
      + '<feColorMatrix values="0 0 0 0 0.55 0 0 0 0 0.38 0 0 0 0 0.16 0 0 1.4 0 -0.62"/></filter>',
    '<pattern id="bpLaid" width="7" height="60" patternUnits="userSpaceOnUse"><path d="M0 0.5H7" stroke="#8a6a3a" stroke-opacity="0.06" stroke-width="1"/><path d="M3.5 0V60" stroke="#8a6a3a" stroke-opacity="0.025" stroke-width="2"/></pattern>',
  ].join('');

  const plate = rr(PM, PM, W - 2 * PM, H - 2 * PM, 6);
  const all = `M0 0H${W}V${H}H0Z`;
  const body = [
    path(sheet, { fill: '#000', fillOpacity: 0.3, transform: 'translate(8 12)' }),
    g({ clipPath: 'url(#bpSheet)' },
      path(all, { fill: 'url(#bpPaper)' }),
      path(all, { fill: '#000', filter: 'url(#bpAge)' }),
      path(all, { fill: 'url(#bpLaid)' }),
      path(foxing(), { fill: '#8a6236', fillOpacity: 0.28 }),
      path(plate, { fill: '#e9dbb8', fillOpacity: 0.45 }),
      path(plate, { fill: 'none', stroke: '#fffaf0', strokeOpacity: 0.8, strokeWidth: 3, transform: 'translate(-2 -2)' }),
      path(plate, { fill: 'none', stroke: '#8a6a3a', strokeOpacity: 0.35, strokeWidth: 2.5, transform: 'translate(1.5 1.5)' }),
      path(rr(BR, BR, W - 2 * BR, H - 2 * BR, 0), { fill: 'none', stroke: SEPIA, strokeWidth: 3.2 }),
      path(rr(BR + 9, BR + 9, W - 2 * BR - 18, H - 2 * BR - 18, 0), { fill: 'none', stroke: SEPIA, strokeWidth: 1 }),
      g({ clipPath: 'url(#bpInner)' },
        solid.join(''),
        path(L_.fine, { fill: 'none', stroke: SEPIA, strokeWidth: 0.65, strokeOpacity: 0.85, strokeLinecap: 'round' }),
        path(L_.mid, { fill: 'none', stroke: SEPIA, strokeWidth: 1, strokeLinecap: 'round' }),
        L_.stip.map((d) => path(d, { stroke: SEPIA, strokeWidth: 1.6, strokeLinecap: 'round', strokeOpacity: 0.9 })).join(''),
        path(L_.line, { fill: 'none', stroke: SEPIA, strokeWidth: 1.4, strokeLinejoin: 'round', strokeLinecap: 'round' }),
        path(L_.burin, { fill: SEPIA }),
        path(L_.white, { stroke: '#fbf3dc', strokeWidth: 3.2, strokeLinecap: 'round' }),
        insets.join('')),
      // the calm mat around the screen: plain paper and a single fine rule
      path(rr(hole.x - 20, hole.y - 20, hole.w + 40, hole.h + 40, 2), { fill: 'none', stroke: PAPER, strokeWidth: 36 }),
      path(rr(hole.x - 36, hole.y - 36, hole.w + 72, hole.h + 72, 0), { fill: 'none', stroke: SEPIA, strokeWidth: 1.4 }),
      lip(holeD, '#5a3a14', [[5, 0.12], [2, 0.3]]),
      path(all, { fill: 'url(#bpEdge)' })),
    path(sheet, { fill: 'none', stroke: '#b89a64', strokeOpacity: 0.6, strokeWidth: 1.5 }),
  ].join('\n');
  return { defs, body };
}

module.exports = {
  W, H, hole, radius, draw,
  meta: {
    name: 'Botanical Plate', theme: 'botanical-engraving', rarity: 'epic', translucent: false,
    collection: 'midnight-atelier', license: 'CC-BY-4.0',
    desc: 'A hand-coloured copperplate: a passionflower vine in contour hatching and stipple, a pinned moth, seed pods and dissection insets frame your game.',
    tags: ['botanical', 'engraving', 'vintage', 'passionflower', 'moth', 'seeds', 'paper', 'mature'],
  },
};
