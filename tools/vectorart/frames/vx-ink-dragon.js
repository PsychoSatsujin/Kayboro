'use strict';
// Ink Dragon: a sumi-e dragon painted in a single breath on aged silk. Its great horned head bursts in at
// the top left, jaws wide, roaring across an empty sky at a flaming pearl; the neck pours down the left
// margin in a hard S, the body dives in and out of a mist bank along the foot of the painting and the tail
// whips up past pale ink-wash peaks at the lower right, ending in a fan of flame-hair. The top right is
// left almost bare (a cinnabar sun, a few flicked drops) so the whole composition leans into that space.
// Brushwork is real geometry, not filters: pressure-sensitive tapered strokes (perfect-freehand, MIT),
// dry-brush "flying white" where the bristles split and skip (simplex noise, MIT), darker pooled ink at
// stroke starts and wet edges on the washes. A plain silk mat keeps the ring around the screen calm.
// Original Kayboro artwork, CC BY 4.0.
const { getStroke } = require('perfect-freehand');
const { createNoise2D } = require('simplex-noise');
const L = require('../lib');
const { rr, path, g, lg, rg, circle, ellipse, tf, rng, lip } = L;

const W = 1600, H = 1180, hole = { x: 336, y: 330, w: 928, h: 522 }, radius = 3;
const B = 44; // brocade mount
const INK = '#120f0c';
const GREY = '#5a544a';
const SILK = '#e4d4b0';
const CINNABAR = '#b8342a';

const n1 = (v) => +(+v).toFixed(1);
const P1 = (...v) => v.map(n1).join(' ');
const P0 = (...v) => v.map(Math.round).join(' ');
const rot = (x, y, a, r) => [x + Math.cos(a) * r, y + Math.sin(a) * r];
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));

// ---- curve helpers ------------------------------------------------------------------------------
function cr(pts, { closed = false, move = true } = {}) {
  const k = 1 / 6, p = closed ? [pts[pts.length - 1], ...pts, pts[0], pts[1]] : [pts[0], ...pts, pts[pts.length - 1]];
  let d = `${move ? 'M' : 'L'}${P0(...pts[0])}`;
  for (let i = 1; i < p.length - 2; i++) {
    const [x0, y0] = p[i - 1], [x1, y1] = p[i], [x2, y2] = p[i + 1], [x3, y3] = p[i + 2];
    d += `C${P0(x1 + (x2 - x0) * k, y1 + (y2 - y0) * k, x2 - (x3 - x1) * k, y2 - (y3 - y1) * k, x2, y2)}`;
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
const plen = (pts) => pts.slice(1).reduce((s, q, i) => s + Math.hypot(q[0] - pts[i][0], q[1] - pts[i][1]), 0);
function frames(pts) {
  return pts.map((p, i) => {
    const a = pts[Math.max(0, i - 1)], b = pts[Math.min(pts.length - 1, i + 1)], l = Math.hypot(b[0] - a[0], b[1] - a[1]) || 1;
    const tx = (b[0] - a[0]) / l, ty = (b[1] - a[1]) / l;
    return { x: p[0], y: p[1], tx, ty, nx: -ty, ny: tx };
  });
}
function qthrough(pts, move = true) {
  let d = `${move ? 'M' : 'L'}${P0(...pts[0])}`;
  if (pts.length < 3) return d + pts.slice(1).map((q) => `L${P0(...q)}`).join('');
  for (let i = 1; i < pts.length - 1; i++) {
    const [x, y] = pts[i], [x2, y2] = pts[i + 1], last = i === pts.length - 2;
    d += `Q${P0(x, y)} ${P0(last ? x2 : (x + x2) / 2, last ? y2 : (y + y2) / 2)}`;
  }
  return d;
}

// ---- brush engine ----------------------------------------------------------------------------------
/** Ramer-Douglas-Peucker on an open point list (keeps outlines small). */
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
/** Closed outline -> smooth path through midpoints (whole units, or tenths when fine). */
function outlineD(pts, fine = false) {
  pts = rdp(pts, fine ? 0.25 : 0.5);
  if (pts.length < 3) return '';
  // relative quadratic chain on a fixed grid (whole units, or tenths for fine strokes): the deltas are
  // taken between rounded absolute points so nothing drifts, and the result is about half the size
  const q = fine ? 10 : 1, R = (v) => Math.round(v * q), m = (a, b) => [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2];
  const num = (v) => { const s = String(v / q); return s.replace(/^(-?)0\./, '$1.'); };
  const s0 = m(pts[0], pts[1]).map(R);
  let cur = s0, toks = [];
  for (let i = 1; i <= pts.length; i++) {
    const a = pts[i % pts.length].map(R), e = m(pts[i % pts.length], pts[(i + 1) % pts.length]).map(R);
    toks.push(a[0] - cur[0], a[1] - cur[1], e[0] - cur[0], e[1] - cur[1]); cur = e;
  }
  let body = '';
  for (const t of toks.map(num)) body += (body && t[0] !== '-' && !(t[0] === '.' && /\.\d*$/.test(body)) ? ' ' : '') + t;
  return `M${num(s0[0])} ${num(s0[1])}q${body}Z`;
}
/** perfect-freehand stroke through [x, y, pressure] points; width at pressure 1 is w. */
function pf(points, w, { t0 = 0, t1 = 0, smooth = 0.3 } = {}) {
  const o = getStroke(points, { size: w / 2, thinning: 1, smoothing: smooth, streamline: 0.15, simulatePressure: false,
    start: { taper: t0, cap: true }, end: { taper: t1, cap: true }, last: true });
  return outlineD(o, w < 9);
}
const SPINDLE = (t) => Math.sin(Math.PI * t) ** 0.7;
const NAIL = (t) => Math.min(1, t * 5) ** 0.6 * (1 - t) ** 0.85; // pressed in, then lifted to a point
const ROOT = (t) => (1 - t) ** 0.9 + 0.04; // full width at the start, tapering to a point
const NOISE = createNoise2D(rng(2024));
/** A tapered brush stroke along pts (spline), pressure from shape(t) with a little hand tremor. */
function brush(pts, w, shape = SPINDLE, m) {
  const cnt = m || Math.max(6, Math.min(26, Math.round(plen(pts) / 12)));
  const R = resample(pts, cnt), s0 = pts[0][0] * 0.013 + pts[0][1] * 0.007;
  return pf(R.map((p, i) => { const t = i / (cnt - 1); return [p[0], p[1], clamp(shape(t) * (1 + 0.12 * NOISE(t * 3, s0)), 0.03, 1)]; }), w);
}
/**
 * Dry brush ("flying white"): the stroke is split into n bristle bundles that each follow the spine at
 * their own offset, and skip wherever noise says the brush ran dry; skips grow toward the end of the stroke
 * and toward its edges. A slim solid core keeps the head of the stroke wet.
 */
function dryBrush(pts, w, shape = NAIL, { n = 7, dry = 0.55, seed = 1, core = 0.55 } = {}) {
  const rnd = rng(seed), N = createNoise2D(rng(seed + 977)), len = plen(pts);
  const cnt = Math.max(8, Math.min(60, Math.round(len / 9))), F = frames(resample(pts, cnt));
  let d = core ? brush(pts, w * core, (t) => shape(t) * (1 - t * 0.55), Math.min(cnt, 24)) : '';
  for (let b = 0; b < n; b++) {
    const o = ((b + 0.5) / n - 0.5) * (0.92 + rnd() * 0.12), edge = Math.abs(o) * 2, bw = (w / n) * (1.7 + rnd() * 0.7);
    let seg = [];
    const flush = () => { if (seg.length >= 3) d += pf(seg, bw, { t0: 4, t1: bw * 2, smooth: 0.2 }); seg = []; };
    F.forEach((f, i) => {
      const t = i / (cnt - 1), s = shape(t), v = N((t * len) / 70, b * 1.9) * 0.5 + 0.5;
      if (s < 0.05 || v < dry * (0.15 + t ** 1.3 * 0.95 + edge * 0.35)) { flush(); return; }
      const off = o * w * s;
      seg.push([f.x + f.nx * off, f.y + f.ny * off, clamp(s * (0.7 + 0.4 * N(t * 9, b + 40)), 0.06, 1)]);
    });
    flush();
  }
  return d;
}
/** A blob outline with a noisy edge. */
function blob(cx, cy, rx, ry, seed, k = 12, q0 = 0.78, q1 = 0.36) {
  const rnd = rng(seed), pts = [];
  for (let i = 0; i < k; i++) { const a = (i / k) * Math.PI * 2, q = q0 + rnd() * q1; pts.push([cx + Math.cos(a) * rx * q, cy + Math.sin(a) * ry * q]); }
  return cr(pts, { closed: true });
}
/** Ink pooled where the brush first touched: a dark wet blot with a soft halo. */
const pool = (x, y, r) => blob(x, y, r, r * 0.8, Math.round(x * 7 + y));

// ---- the dragon ----------------------------------------------------------------------------------
// Spine from the back of the head, down the left margin in an S, along the foot through the mist, up the
// lower right to the tail tip.
const HEAD = [272, 222];
const SPINE = [[268, 236], [186, 296], [120, 380], [98, 500], [140, 620], [196, 724], [178, 840], [150, 940], [222, 1036], [360, 1086],
  [520, 1062], [650, 1012], [790, 1032], [930, 1084], [1080, 1076], [1210, 1022], [1330, 1000], [1420, 958], [1472, 880], [1460, 800], [1420, 752]];
const M = 130;
const width = (t) => (t < 0.1 ? 78 + 34 * (t / 0.1) : 6 + 106 * (1 - ((t - 0.1) / 0.9) ** 1.25)) * (1 + 0.06 * Math.sin(t * 29));
// Where the dragon plunges through cloud: spine t of each gap centre and half-length (in t).
const DIVES = [[0.585, 0.045], [0.31, 0.03]];
const HC = [hole.x + hole.w / 2, hole.y + hole.h / 2];

function bodyFrames() {
  const F = frames(resample(SPINE, M));
  const out = F.reduce((s, f) => s + (Math.hypot(f.x + f.nx - HC[0], f.y + f.ny - HC[1]) > Math.hypot(f.x - f.nx - HC[0], f.y - f.ny - HC[1]) ? 1 : -1), 0) > 0 ? 1 : -1;
  return F.map((f, i) => ({ ...f, t: i / (M - 1), w: width(i / (M - 1)), ox: f.nx * out, oy: f.ny * out }));
}
/** Point across the body: u = -0.5 (belly, toward the screen) .. 0.5 (back, outside); along moves toward the tail. */
const at = (f, u, along = 0) => [f.x + f.ox * f.w * u + f.tx * along, f.y + f.oy * f.w * u + f.ty * along];
function band(F, u0, u1, a = 0, b = F.length - 1) {
  const s = F.slice(a, b + 1);
  return `${cr(s.map((f) => at(f, u1)))}${cr(s.map((f) => at(f, u0)).reverse(), { move: false })}Z`;
}
const hidden = (t, pad = 0) => DIVES.some(([c, h]) => Math.abs(t - c) < h + pad);

function dragonBody(F) {
  const rnd = rng(7);
  const half = F.filter((_, i) => i % 2 === 0 || i === F.length - 1);
  // the back: a run of overlapping bold "bone" strokes, each pressed hard and dragged dry, so the spine
  // reads as rhythm (press, drag, lift) rather than a uniform tube
  let back = '', pools = '';
  const cuts = [0, 9, 20, 31, 44, 55, 66, 78, 90, 101, 112, 122, M - 1];
  for (let k = 0; k < cuts.length - 1; k++) {
    const a = Math.max(0, cuts[k] - 2), b = Math.min(M - 1, cuts[k + 1] + 1), s = F.slice(a, b + 1).filter((_, i, arr) => i % 2 === 0 || i === arr.length - 1);
    if (s.length < 3) continue;
    const wMid = F[Math.round((a + b) / 2)].w, u = 0.3 - (k % 2) * 0.04;
    back += dryBrush(s.map((f) => at(f, u)), wMid * (0.56 - k * 0.012), (t) => Math.min(1, t * 6) ** 0.5 * (1 - t * 0.45), { n: 6, dry: 0.42 + k * 0.03, seed: 30 + k, core: 0.55 });
    if (k % 3 === 0) { const p = at(F[a + 1], u); pools += pool(p[0], p[1], wMid * 0.16); }
  }
  // belly: a light, broken line with plate ticks
  let belly = '', plates = '';
  for (let i = 2; i < F.length - 12;) {
    const j = Math.min(F.length - 12, i + 5 + Math.floor(rnd() * 7));
    belly += brush(F.slice(i, j + 1).map((f) => at(f, -0.48)), 4.2, SPINDLE, 7);
    i = j + 1 + Math.floor(rnd() * 3);
  }
  for (let i = 4; i < F.length - 16; i++) {
    const f = F[i], a = at(f, -0.46), b = at(f, -0.28), q = at(f, -0.37, -f.w * 0.08);
    plates += `M${P0(...a)}Q${P0(...q)} ${P0(...b)}`;
  }
  // scales: quick hooked crescents in two loose rows on the back half, fewer and fainter toward the tail
  let sc = '', scL = '';
  for (const [u, off, sz] of [[0.12, 0, 0.16], [-0.12, 0.5, 0.14]]) {
    for (let i = 4 + off; i < F.length - 16; i += 1.1 + rnd() * 0.6) {
      const f = F[Math.floor(i)];
      if (rnd() < 0.3 + f.t * 0.4 || hidden(f.t, 0.02)) continue;
      const hw = f.w * sz * (0.7 + rnd() * 0.6), c = at(f, u + (rnd() - 0.5) * 0.1), back2 = f.w * (0.14 + rnd() * 0.12);
      const a = [c[0] - f.ox * hw, c[1] - f.oy * hw], b = [c[0] + f.ox * hw, c[1] + f.oy * hw];
      const q = [c[0] + f.tx * back2, c[1] + f.ty * back2], q2 = [c[0] + f.tx * back2 * 0.5, c[1] + f.ty * back2 * 0.5];
      const d = `M${P0(...a)}Q${P0(...q)} ${P0(...b)}Q${P0(...q2)} ${P0(...a)}Z`;
      if (u > 0.1) sc += d; else scL += d;
    }
  }
  // dorsal crest: swift flicked strokes sweeping back off the spine, longer over the shoulders
  let crest = '', crestL = '';
  for (let i = 3, k = 0; i < F.length - 6; i += 2, k++) {
    const f = F[i], f2 = F[Math.min(F.length - 1, i + 3)], h = f.w * (0.36 + rnd() * 0.22 + (k % 4 === 0 ? 0.22 : 0)) * (1 - f.t * 0.3);
    const s0 = at(f, 0.42), tip = at(f2, 0.42 + h / f.w, f.w * 0.35), mid = at(F[i + 1], 0.42 + (h / f.w) * 0.75, f.w * 0.05);
    const d = brush([s0, mid, tip], 10 + f.w * 0.1, NAIL, 6);
    if (k % 3 === 1) crestL += d; else crest += d;
  }
  // tail: a flame-shaped fan of hair at the tip, lobes curling the same way
  const e = F[F.length - 1], e2 = F[F.length - 6];
  let tailD = '', tailL = '';
  for (let k = 0; k < 7; k++) {
    const lift = -0.35 + k * 0.2, a = Math.atan2(e.ty + e.oy * lift, e.tx + e.ox * lift), s0 = [e2.x, e2.y];
    const len = (190 - Math.abs(k - 3) * 22) * (0.85 + rnd() * 0.3);
    const m1 = rot(s0[0], s0[1], a + 0.12, len * 0.4), m2 = rot(s0[0], s0[1], a, len * 0.75), end = rot(s0[0], s0[1], a - 0.2, len);
    const pts = [s0, m1, m2, end, rot(end[0], end[1], a - 2.1, 18 + len * 0.1)];
    const d = k % 2 ? brush(pts, 34 - Math.abs(k - 3) * 4, ROOT, 14) : dryBrush(pts, 40 - Math.abs(k - 3) * 4, ROOT, { n: 5, dry: 0.6, seed: 80 + k, core: 0.4 });
    if (k % 2) tailL += d; else tailD += d;
  }
  let bloom = '';
  for (let i = 2; i < F.length - 4; i += 4 + Math.floor(rnd() * 5)) {
    const f = F[i], c = at(f, -0.1 + rnd() * 0.5), d = blob(c[0], c[1], f.w * (0.3 + rnd() * 0.35), f.w * (0.25 + rnd() * 0.25), 900 + i, 9);
    if (rnd() < 0.6) bloom += d;
  }
  return g({},
    path(crestL, { fill: GREY, fillOpacity: 0.7 }),
    path(tailL, { fill: GREY, fillOpacity: 0.75 }), path(tailD, { fill: INK, fillOpacity: 0.9 }),
    path(crest, { fill: INK, fillOpacity: 0.9 }),
    // ink washes inside the body: a pale belly, a mid tone and a dark back, each with a wet (darker) edge
    path(band(half, -0.5, 0.5), { fill: '#7c7466', fillOpacity: 0.55 }),
    path(band(half, -0.5, -0.18), { fill: '#efe6cc', fillOpacity: 0.55 }),
    path(band(half, 0.02, 0.5), { fill: INK, fillOpacity: 0.32, stroke: INK, strokeOpacity: 0.25, strokeWidth: 3 }),
    path(band(half, 0.26, 0.5), { fill: INK, fillOpacity: 0.4 }),
    g({ clipPath: 'url(#idBodyClip)' }, path(bloom, { fill: INK, fillOpacity: 0.16 })),
    path(plates, { fill: 'none', stroke: INK, strokeOpacity: 0.5, strokeWidth: 2.2, strokeLinecap: 'round' }),
    path(scL, { fill: INK, fillOpacity: 0.5 }), path(sc, { fill: INK, fillOpacity: 0.85 }),
    path(pools, { fill: INK, fillOpacity: 0.6 }),
    path(back, { fill: INK }),
    path(belly, { fill: INK, fillOpacity: 0.8 }));
}

/** A clawed limb: shoulder, elbow, wrist, splayed toes with hooked nails, a flame tuft at the elbow. */
function limb(sh, el, wr, w, talonDir, s = 1) {
  const prof = (t) => (t < 0.5 ? 1 - 0.45 * (t / 0.5) ** 0.8 : 0.55 + 0.12 * Math.sin(Math.PI * ((t - 0.5) / 0.5) ** 0.7) - 0.18 * ((t - 0.5) / 0.5) ** 2);
  const spine = [sh, el, wr];
  let toes = '', nails = '', tuft = '';
  for (let k = 0; k < 4; k++) {
    const a = talonDir + (k - 1.5) * 0.42, l1 = (k === 0 ? 24 : 32) * s;
    const k1 = rot(wr[0], wr[1], a, l1), k2 = rot(k1[0], k1[1], a + 0.5, 22 * s);
    toes += brush([rot(wr[0], wr[1], a, -6 * s), k1, k2], 15 * s, (t) => 1 - t * 0.4, 6);
    nails += brush([k2, rot(k2[0], k2[1], a + 0.9, 15 * s), rot(k2[0], k2[1], a + 1.7, 24 * s)], 10 * s, ROOT, 6);
  }
  const da = Math.atan2(el[1] - sh[1], el[0] - sh[0]);
  for (let k = 0; k < 4; k++) {
    const a = da + Math.PI + 0.55 + k * 0.26, l = (80 - k * 12) * s;
    tuft += brush([el, rot(el[0], el[1], a, l * 0.55), rot(el[0], el[1], a + 0.4, l)], 13 * s, ROOT, 8);
  }
  return g({},
    path(tuft, { fill: INK, fillOpacity: 0.85 }),
    path(brush(spine, w, prof, 16), { fill: '#6e675a' }),
    path(dryBrush(spine, w * 0.5, (t) => prof(t) * 0.9, { n: 4, dry: 0.45, seed: Math.round(sh[0]), core: 0 }), { fill: INK, fillOpacity: 0.8 }),
    path(toes, { fill: '#6e675a', stroke: INK, strokeWidth: 2.2, strokeOpacity: 0.8 }),
    path(nails, { fill: INK }));
}

/** The head in local coordinates (facing -x, origin where the neck joins); mirrored when placed. */
function head() {
  const skull = 'M-20 -66C-50 -82 -76 -82 -92 -72C-110 -90 -136 -88 -146 -68C-166 -62 -184 -56 -204 -58C-224 -74 -252 -70 -260 -46'
    + 'C-270 -30 -262 -12 -248 -10L-238 -4C-210 0 -170 6 -130 12C-104 30 -62 48 -24 56C4 58 22 36 20 6C18 -30 6 -54 -20 -66Z';
  const jaw = 'M-122 16C-152 34 -196 56 -230 72C-244 78 -252 86 -244 98C-212 106 -160 100 -112 78C-90 68 -72 56 -60 44Z';
  const mouth = 'M-132 10C-172 4 -206 0 -230 0C-236 22 -232 50 -224 68C-194 54 -152 34 -122 16Z';
  let teeth = '';
  for (let i = 0; i < 6; i++) { const x = -146 - i * 15, y = 6 - i * 1.6; teeth += `M${P1(x, y)}L${P1(x - 5, y + 11)}L${P1(x - 10, y - 0.6)}Z`; }
  for (let i = 0; i < 5; i++) { const x = -140 - i * 17, y = 26 + i * 8.6; teeth += `M${P1(x, y)}L${P1(x - 5, y - 11)}L${P1(x - 11, y + 3)}Z`; }
  teeth += 'M-222 -4L-217 28L-209 -2ZM-216 66L-212 36L-203 62Z';
  const tongue = brush([[-150, 40], [-204, 52], [-262, 40], [-300, 8], [-292, -20]], 16, NAIL, 12);
  const antler = (dx, dy, k) => brush([[-70 + dx, -70 + dy], [-46 + dx, -124 + dy], [4 + dx, -158 + dy], [64 + dx, -172 + dy], [138 + dx, -164 + dy]], 24 * k, ROOT, 16)
    + brush([[-36 + dx, -134 + dy], [-60 + dx, -170 + dy], [-52 + dx, -206 + dy]], 13 * k, ROOT)
    + brush([[18 + dx, -160 + dy], [28 + dx, -200 + dy], [12 + dx, -234 + dy]], 13 * k, ROOT)
    + brush([[76 + dx, -170 + dy], [102 + dx, -208 + dy], [138 + dx, -222 + dy]], 12 * k, ROOT);
  // mane: long wet strands streaming back along the neck, some split dry at their ends
  const rnd = rng(17);
  let maneD = '', maneL = '';
  for (let i = 0; i < 13; i++) {
    const t = i / 12, sx = -60 + t * 70, sy = -74 + t * 140, len = 170 + rnd() * 110;
    const a = 0.2 + t * 0.6, p1 = rot(sx, sy, a - 0.35, len * 0.35), p2 = rot(sx, sy, a, len * 0.7), p3 = rot(sx, sy, a + 0.32, len);
    const pts = [[sx, sy], p1, p2, p3, rot(p3[0], p3[1], a + 1.6, 22)];
    if (i % 3 === 1) maneL += brush(pts, 26 - t * 8, ROOT, 14);
    else maneD += i % 3 === 0 ? dryBrush(pts, 30 - t * 8, ROOT, { n: 5, dry: 0.55, seed: 200 + i, core: 0.45 }) : brush(pts, 26 - t * 8, ROOT, 14);
  }
  let maneTop = '';
  for (let i = 0; i < 8; i++) {
    const t = i / 7, sx = -70 + t * 60 + rnd() * 10, sy = -66 + t * 118, len = 130 + rnd() * 80, a = 0.15 + t * 0.6;
    const p1 = rot(sx, sy, a - 0.3, len * 0.3), p2 = rot(sx, sy, a, len * 0.65), p3 = rot(sx, sy, a + 0.32, len);
    maneTop += brush([[sx, sy], p1, p2, p3, rot(p3[0], p3[1], a + 1.7, 16)], 20 - t * 6, NAIL, 14);
  }
  // long whiskers streaming forward and up, out across the empty sky
  const whiskers = brush([[-252, -34], [-320, -60], [-400, -52], [-470, -70], [-520, -110], [-536, -150]], 8, NAIL, 22)
    + brush([[-242, -14], [-310, -6], [-380, 6], [-450, 0], [-510, -24], [-560, -26]], 6.5, NAIL, 22)
    + brush([[-238, 88], [-268, 112], [-300, 116], [-334, 104]], 9, NAIL, 10);
  const contours = brush([[-262, -42], [-246, -64], [-222, -72], [-204, -58], [-180, -56], [-160, -62]], 8, NAIL, 12)
    + brush([[-250, -10], [-210, 0], [-170, 6], [-132, 12]], 7, SPINDLE, 10)
    + brush([[-132, 12], [-106, 28], [-92, 22], [-98, 10], [-108, 14]], 7, ROOT, 10)
    + brush([[-244, 96], [-206, 104], [-160, 98], [-112, 78], [-60, 46]], 11, NAIL, 12)
    + brush([[-104, 34], [-60, 50], [-20, 58], [16, 50]], 9, SPINDLE, 10);
  const brow = dryBrush([[-176, -46], [-146, -70], [-108, -74], [-80, -104], [-56, -142]], 24, NAIL, { n: 5, dry: 0.4, seed: 301, core: 0.6 })
    + brush([[-150, -76], [-120, -96], [-100, -128]], 11, NAIL, 8);
  const cheek = brush([[-90, 46], [-40, 66], [6, 96], [36, 122]], 20, ROOT) + brush([[-56, 32], [-6, 44], [44, 60], [80, 58]], 15, ROOT);
  const ridges = brush([[-176, -42], [-194, -38], [-212, -44]], 4, SPINDLE, 6) + brush([[-170, -28], [-190, -22], [-206, -28]], 4, SPINDLE, 6)
    + brush([[-96, -16], [-80, 0], [-86, 24]], 5, SPINDLE, 6) + brush([[-68, -26], [-48, -6], [-56, 24]], 5, SPINDLE, 6);
  const nostril = brush([[-238, -50], [-254, -42], [-250, -26], [-234, -30], [-236, -42]], 7, SPINDLE, 8);
  return g({},
    path(antler(28, -14, 0.85), { fill: '#8a8070', fillOpacity: 0.9 }),
    path(maneL, { fill: GREY, fillOpacity: 0.8 }),
    path(maneD, { fill: INK, fillOpacity: 0.92 }),
    path(antler(0, 0, 1), { fill: 'url(#idAntler)' }),
    path(jaw, { fill: 'url(#idHead)', stroke: INK, strokeOpacity: 0.35, strokeWidth: 3 }),
    path(mouth, { fill: '#2a1210' }),
    path(tongue, { fill: CINNABAR }),
    path(teeth, { fill: '#f1e8d2', stroke: INK, strokeWidth: 1.4, strokeLinejoin: 'round' }),
    path(skull, { fill: 'url(#idHead)', stroke: INK, strokeOpacity: 0.35, strokeWidth: 3 }),
    path(dryBrush([[-250, -30], [-200, -40], [-150, -30], [-90, -20], [-30, 0]], 40, SPINDLE, { n: 6, dry: 0.7, seed: 333, core: 0 }), { fill: INK, fillOpacity: 0.3 }),
    path(dryBrush([[-120, 30], [-70, 40], [-20, 30], [10, 0]], 46, SPINDLE, { n: 6, dry: 0.6, seed: 334, core: 0 }), { fill: INK, fillOpacity: 0.35 }),
    path(ellipse(-176, -50, 90, 14), { fill: '#efe5cc', fillOpacity: 0.55 }),
    path(ellipse(-40, 30, 70, 30), { fill: INK, fillOpacity: 0.28 }),
    path(ellipse(0, -10, 22, 50), { fill: INK, fillOpacity: 0.3 }),
    path(maneTop, { fill: INK, fillOpacity: 0.85 }),
    path(cheek, { fill: INK, fillOpacity: 0.88 }),
    path(contours + ridges + nostril, { fill: INK }),
    // the eye: cinnabar-ringed gold, slit pupil, a glint
    path('M-158 -42Q-132 -62 -102 -44Q-130 -26 -158 -42Z', { fill: '#e6b640', stroke: CINNABAR, strokeWidth: 2.5 }),
    path('M-158 -42Q-132 -62 -102 -44', { fill: 'none', stroke: INK, strokeWidth: 4.5, strokeLinecap: 'round' }),
    path(ellipse(-130, -43, 3.6, 8.5), { fill: INK }),
    path(circle(-125, -48, 1.8), { fill: '#fff8e6' }),
    path(brow, { fill: INK }),
    path(whiskers, { fill: INK, fillOpacity: 0.92 }));
}

/** The flaming pearl: a pale orb, flame tongues in ink and cinnabar leaning in the wind. */
function pearl(x, y, r) {
  let flames = '', red = '';
  // flame tongues streaming back from the orb (away from its flight, toward the dragon), ink over cinnabar
  for (let k = 0; k < 9; k++) {
    const a0 = -3.3 + k * 0.42, len = r * (3.6 - Math.abs(k - 4) * 0.42), b = rot(x, y, a0, r * 0.8), dir = -2.2 + (k - 4) * 0.13;
    const p1 = rot(b[0], b[1], dir + 0.35, len * 0.35), p2 = rot(b[0], b[1], dir - 0.05, len * 0.7), p3 = rot(b[0], b[1], dir + 0.25, len);
    const pts = [b, p1, p2, p3];
    if (k % 2) red += brush(pts, 24 - Math.abs(k - 4) * 2, NAIL, 12); else flames += dryBrush(pts, 22 - Math.abs(k - 4) * 2, NAIL, { n: 3, dry: 0.45, seed: 400 + k, core: 0.6 });
  }
  return g({},
    path(circle(x, y, r * 3), { fill: 'url(#idPearlGlow)' }),
    path(red, { fill: CINNABAR, fillOpacity: 0.85 }),
    path(flames, { fill: INK, fillOpacity: 0.85 }),
    path(circle(x, y, r), { fill: 'url(#idPearl)' }),
    path(brush([rot(x, y, 2.6, r), rot(x, y, 1.6, r * 1.02), rot(x, y, 0.6, r * 1.02), rot(x, y, -0.2, r)], 6, SPINDLE, 8), { fill: INK, fillOpacity: 0.75 }),
    path(`M${P1(x - r * 0.55, y - r * 0.15)}Q${P1(x - r * 0.4, y - r * 0.65, x + r * 0.15, y - r * 0.6)}`, { fill: 'none', stroke: '#fffaf0', strokeWidth: 3, strokeLinecap: 'round', strokeOpacity: 0.8 }));
}

// ---- landscape, mist, splashes, seals -------------------------------------------------------------------
/** Distant peaks: a jagged ridge filled with a wash that fades into mist, axe-cut texture strokes on top. */
function peaks(x0, x1, base, top, seed, tone, a) {
  const N = createNoise2D(rng(seed)), pts = [], cnt = Math.round((x1 - x0) / 14);
  for (let i = 0; i <= cnt; i++) {
    const t = i / cnt, x = x0 + (x1 - x0) * t, ridge = Math.sin(Math.PI * t) ** 0.8;
    pts.push([x, base - (base - top) * ridge * (0.62 + 0.38 * (N(t * 3.2, 0) * 0.5 + 0.5)) - Math.abs(N(t * 11, 3)) * 26 * ridge]);
  }
  let tex = '';
  for (let i = 2; i < pts.length - 2; i += 3) {
    const [x, y] = pts[i], l = (base - y) * 0.45;
    tex += brush([[x, y + 4], [x - l * 0.25, y + l * 0.5], [x - l * 0.2, y + l]], 7, NAIL, 6);
  }
  const ridgeD = qthrough(pts);
  return g({},
    path(`${ridgeD}L${P0(x1, base + 40)}L${P0(x0, base + 40)}Z`, { fill: `url(#${tone})`, fillOpacity: a }),
    path(ridgeD, { fill: 'none', stroke: INK, strokeOpacity: a * 0.55, strokeWidth: 2.5, strokeLinecap: 'round' }),
    path(tex, { fill: INK, fillOpacity: a * 0.35 }));
}
// Mist where the body dives: silk-coloured cloud masses with soft gradient fill and a few wind strokes.
function cloudBank(cx, cy, rx, ry, seed, dir = 1) {
  const rnd = rng(seed);
  let lines = '', wash = '';
  // three billows of falling size, each a brush curl that tightens into a spiral, and a long trailing stroke
  [[0, 1], [1.45, 0.72], [2.45, 0.5]].forEach(([off, sz], k) => {
    const r0 = ry * sz, bx = cx + dir * (off - 1) * ry * 1.2, by = cy + ry * 0.25 - r0 * 0.5 + (rnd() - 0.5) * 6, pts = [];
    for (let i = 0; i <= 22; i++) { const a = Math.PI * (1 + (i / 22) * 2.1) * dir, r = r0 * (1 - (i / 22) * 0.62); pts.push([bx + Math.cos(a) * r * dir, by + Math.sin(a) * r]); }
    lines += brush([[bx - r0 * 1.9 * dir, by + r0 * 0.95], [bx - r0 * 1.25 * dir, by + r0 * 0.6], ...pts], 8 * sz + 2, (t) => Math.min(1, t * 5) * (1 - t * 0.75) + 0.06, 26);
    wash += ellipse(bx, by + r0 * 0.15, r0 * 1.35, r0 * 1.05);
  });
  lines += brush([[cx - rx * 1.25 * dir, cy + ry * 0.75], [cx - rx * 0.3 * dir, cy + ry * 0.62], [cx + rx * 0.7 * dir, cy + ry * 0.8], [cx + rx * 1.3 * dir, cy + ry * 0.62]], 6, SPINDLE, 16);
  return path(wash, { fill: 'url(#idMist)' }) + path(lines, { fill: INK, fillOpacity: 0.6 });
}
function dots(list, color, a = 1) {
  const by = new Map();
  for (const [x, y, r] of list) { const k = Math.max(1, Math.round(r * 2)); by.set(k, (by.get(k) || '') + `M${P0(x, y)}h0`); }
  return [...by].map(([k, d]) => path(d, { stroke: color, strokeOpacity: a, strokeWidth: k, strokeLinecap: 'round' })).join('');
}
/** Ink flicked from a loaded brush: a ragged blot, thrown spikes, a spray of drops along a direction. */
function splash(cx, cy, r, seed, a0 = 0, spread = Math.PI * 2, color = INK) {
  const rnd = rng(seed), pts = [], drops = [];
  const inFan = (a) => Math.abs(((a - a0 + Math.PI * 3) % (Math.PI * 2)) - Math.PI) < spread / 2;
  for (let i = 0; i < 26; i++) {
    const a = (i / 26) * Math.PI * 2, spike = inFan(a) && rnd() < 0.32, q = spike ? 1.5 + rnd() * 0.9 : 0.8 + rnd() * 0.25;
    if (spike) pts.push(rot(cx, cy, a - 0.05, r * 0.95), rot(cx, cy, a, r * q), rot(cx, cy, a + 0.05, r * 0.95));
    else pts.push(rot(cx, cy, a, r * q));
    if (spike) for (let k = 0; k < 3; k++) drops.push([...rot(cx, cy, a + (rnd() - 0.5) * 0.1, r * (q + 0.5 + k * 0.6 + rnd() * 0.4)), r * (0.13 - k * 0.03) * (0.7 + rnd() * 0.6)]);
  }
  for (let i = 0; i < 22; i++) { const a = a0 + (rnd() - 0.5) * spread, d = r * (1.6 + rnd() * 3.6); drops.push([...rot(cx, cy, a, d), 0.8 + rnd() * r * 0.07]); }
  return path(cr(pts, { closed: true }), { fill: color, fillOpacity: 0.88 }) + dots(drops, color, 0.85);
}
/** Cinnabar seal: a stamped square or oval with an abstract carved mark (no lettering), ragged print. */
function seal(x, y, s, round = false, seed = 3) {
  const rnd = rng(seed), w = round ? s * 0.72 : s, outline = round ? rr(x, y, w, s, w / 2) : rr(x, y, s, s, 3);
  let mark;
  if (round) mark = `M${P1(x + w * 0.5, y + s * 0.2)}V${n1(y + s * 0.8)}M${P1(x + w * 0.24, y + s * 0.38)}Q${P1(x + w * 0.5, y + s * 0.24, x + w * 0.76, y + s * 0.38)}M${P1(x + w * 0.24, y + s * 0.62)}Q${P1(x + w * 0.5, y + s * 0.78, x + w * 0.76, y + s * 0.62)}`;
  else {
    mark = `M${P1(x + s * 0.2, y + s * 0.3)}H${n1(x + s * 0.8)}M${P1(x + s * 0.5, y + s * 0.3)}V${n1(y + s * 0.82)}`
      + `M${P1(x + s * 0.22, y + s * 0.58)}Q${P1(x + s * 0.34, y + s * 0.46, x + s * 0.44, y + s * 0.58)}T${P1(x + s * 0.66, y + s * 0.58)}T${P1(x + s * 0.8, y + s * 0.56)}`
      + `M${P1(x + s * 0.24, y + s * 0.76)}H${n1(x + s * 0.4)}M${P1(x + s * 0.6, y + s * 0.76)}H${n1(x + s * 0.78)}`;
  }
  let specks = '';
  for (let i = 0; i < 30; i++) specks += circle(x + rnd() * w, y + rnd() * s, 0.6 + rnd() * 1.7);
  return g({ transform: `rotate(${round ? 1.5 : -2} ${n1(x + w / 2)} ${n1(y + s / 2)})` },
    path(outline, { fill: CINNABAR, fillOpacity: 0.9 }),
    path(round ? rr(x + 5, y + 5, w - 10, s - 10, (w - 10) / 2) : rr(x + 6, y + 6, s - 12, s - 12, 2), { fill: 'none', stroke: '#f2e4c6', strokeWidth: 3 }),
    path(mark, { fill: 'none', stroke: '#f2e4c6', strokeWidth: round ? 4 : 4.5, strokeLinecap: 'square' }),
    path(specks, { fill: '#f2e4c6', fillOpacity: 0.7 }));
}
/** The cinnabar sun: a single loaded-brush disc with a rough edge and dry streaks dragged across it. */
function sun(x, y, r) {
  const N = createNoise2D(rng(55)), pts = [];
  for (let i = 0; i < 48; i++) { const a = (i / 48) * Math.PI * 2; pts.push(rot(x, y, a, r * (1 + 0.025 * N(Math.cos(a) * 2, Math.sin(a) * 2) + 0.012 * N(a * 6, 9)))); }
  const streak = dryBrush([[x - r * 1.5, y + r * 0.42], [x - r * 0.4, y + r * 0.3], [x + r * 0.6, y + r * 0.38], [x + r * 1.5, y + r * 0.22]], 34, SPINDLE, { n: 6, dry: 0.5, seed: 71, core: 0.5 })
    + dryBrush([[x - r * 1.1, y + r * 0.72], [x + r * 0.2, y + r * 0.64], [x + r * 1.2, y + r * 0.7]], 18, SPINDLE, { n: 4, dry: 0.55, seed: 72, core: 0.4 });
  return g({},
    path(circle(x, y, r * 1.7), { fill: 'url(#idSunHalo)' }),
    path(qthrough([...pts, pts[0], pts[1]]) + 'Z', { fill: 'url(#idSun)' }),
    path(streak, { fill: '#ece0c2', fillOpacity: 0.85 }));
}

// ---- silk and mount ----------------------------------------------------------------------------------
function silk() {
  const rnd = rng(19);
  let fox = '';
  for (let i = 0; i < 90; i++) {
    const x = B + rnd() * (W - 2 * B), y = B + rnd() * (H - 2 * B);
    if (x > hole.x - 40 && x < hole.x + hole.w + 40 && y > hole.y - 40 && y < hole.y + hole.h + 40) continue;
    fox += circle(x, y, 0.8 + rnd() ** 3 * 4.5);
  }
  const all = `M0 0H${W}V${H}H0Z`, creases = `M520 ${B}V${H - B}M1080 ${B}V${H - B}M${B} 760H${W - B}`;
  return g({},
    path(all, { fill: 'url(#idSilkTone)' }),
    path(all, { fill: '#000', filter: 'url(#idAge)' }),
    path(all, { fill: 'url(#idWeave)', fillOpacity: 0.7 }),
    path(creases, { stroke: '#7a5c34', strokeOpacity: 0.07, strokeWidth: 12 }),
    path(creases, { stroke: '#fff6e0', strokeOpacity: 0.14, strokeWidth: 2, transform: 'translate(-5 -4)' }),
    path(fox, { fill: '#8a6236', fillOpacity: 0.3 }),
    path(all, { fill: 'url(#idVignette)' }));
}
function mount() {
  const outer = rr(0, 0, W, H, 6), inner = rr(B, B, W - 2 * B, H - 2 * B, 0);
  return g({},
    path(`${outer}${inner}`, { fill: '#1e1a1b', fillRule: 'evenodd' }),
    path(`${outer}${inner}`, { fill: 'url(#idBrocade)', fillRule: 'evenodd' }),
    path(rr(B - 7, B - 7, W - 2 * B + 14, H - 2 * B + 14, 0), { fill: 'none', stroke: 'url(#idGilt)', strokeWidth: 6 }),
    path(rr(B - 2, B - 2, W - 2 * B + 4, H - 2 * B + 4, 0), { fill: 'none', stroke: '#0c0909', strokeWidth: 3 }),
    path(rr(B, B, W - 2 * B, H - 2 * B, 0), { fill: 'none', stroke: '#3a2a14', strokeOpacity: 0.28, strokeWidth: 14 }),
    path(rr(8, 8, W - 16, H - 16, 4), { fill: 'none', stroke: '#6a5a44', strokeOpacity: 0.35, strokeWidth: 1.5 }),
    path(outer, { fill: 'none', stroke: '#050404', strokeWidth: 3 }));
}
function brocadeTile() {
  const s = 'M14 44Q14 30 28 30Q40 30 40 40Q40 48 32 48Q26 48 26 42M40 40Q42 26 56 28Q66 30 64 40M10 50H66';
  return '<pattern id="idBrocade" width="72" height="72" patternUnits="userSpaceOnUse">'
    + path(s, { fill: 'none', stroke: '#8a744a', strokeOpacity: 0.2, strokeWidth: 2, strokeLinecap: 'round' })
    + path(s, { fill: 'none', stroke: '#8a744a', strokeOpacity: 0.11, strokeWidth: 2, strokeLinecap: 'round', transform: 'translate(36 36) scale(0.6)' })
    + '</pattern>';
}

function draw() {
  const F = bodyFrames();
  const holeD = rr(hole.x, hole.y, hole.w, hole.h, radius);
  const fr = (t) => F[Math.round(t * (M - 1))];
  const defs = [
    // age: slow brown mottling over the silk (the only turbulence left; everything else is geometry)
    '<filter id="idAge" x="0" y="0" width="100%" height="100%"><feTurbulence type="fractalNoise" baseFrequency="0.0045 0.006" numOctaves="3" seed="12"/>'
      + '<feColorMatrix values="0 0 0 0 0.42 0 0 0 0 0.29 0 0 0 0 0.14 0 0 1.5 0 -0.62"/></filter>',
    lg('idSilkTone', [0, 0, 1, 1], [[0, '#dcc89c'], [0.45, SILK], [1, '#d3bd92']]),
    rg('idVignette', [0.5, 0.5, 0.75], [[0.55, '#6a4a22', 0], [1, '#5a3c1a', 0.38]]),
    '<pattern id="idWeave" width="5" height="5" patternUnits="userSpaceOnUse">'
      + `${path('M0 0.5H5', { stroke: '#7a5a30', strokeOpacity: 0.07, strokeWidth: 1 })}${path('M2.5 0V5', { stroke: '#fff8e8', strokeOpacity: 0.09, strokeWidth: 1 })}</pattern>`,
    brocadeTile(),
    lg('idGilt', [0, 0, 1, 1], [[0, '#c9a868'], [0.5, '#8a6a34'], [1, '#b8955a']]),
    lg('idHead', [0, 0, 0, 1], [[0, '#a89e88'], [0.5, '#7e7666'], [1, '#3e3a32']]),
    lg('idAntler', [0, 0, 1, 1], [[0, '#5a5448'], [1, '#1e1b17']]),
    lg('idPeakFar', [0, 0, 0, 1], [[0, '#8a8274'], [0.6, '#a69c88', 0.4], [1, '#c8b896', 0]]),
    lg('idPeakNear', [0, 0, 0, 1], [[0, '#4a453c'], [0.55, '#6a6456', 0.45], [1, '#a89a7c', 0]]),
    rg('idMist', [0.5, 0.5, 0.5], [[0, '#efe4c8', 0.97], [0.55, '#ebdfc2', 0.85], [1, '#e8dbbc', 0]]),
    rg('idSun', [0.42, 0.4, 0.62], [[0, '#d24a32'], [0.75, '#bc3a28'], [1, '#a22e22']]),
    rg('idSunHalo', [0.5, 0.5, 0.5], [[0.55, '#c8543a', 0.18], [1, '#c8543a', 0]]),
    rg('idPearl', [0.38, 0.34, 0.75], [[0, '#fffaf0'], [0.6, '#e2d8c0'], [1, '#948a78']]),
    rg('idPearlGlow', [0.5, 0.5, 0.5], [[0, '#fff6dc', 0.38], [1, '#fff6dc', 0]]),
    // the dives: gradient fades on the body where it sinks into cloud (no blur filter needed)
    `<clipPath id="idBodyClip"><path d="${band(F.filter((_, i) => i % 2 === 0 || i === M - 1), -0.5, 0.5)}"/></clipPath>`,
    rg('idFadeG', [0.5, 0.5, 0.5], [[0, '#000'], [0.55, '#000'], [1, '#fff']]),
    `<mask id="idFade" maskUnits="userSpaceOnUse" x="0" y="0" width="${W}" height="${H}"><path d="M0 0H${W}V${H}H0Z" fill="#fff"/>`
      + DIVES.map(([c, h]) => { const f = fr(c), r = (h * plen(SPINE)) * 1.25; return path(ellipse(f.x, f.y, r * 1.15, r * 1.15), { fill: 'url(#idFadeG)' }); }).join('') + '</mask>',
  ].join('');

  const neck = fr(0.0);
  const hind = limb(at(fr(0.8), 0.1), [1296, 990], [1366, 944], 50, -1.0, 1);
  const mists = DIVES.map(([c], i) => { const f = fr(c); return i ? cloudBank(f.x - 30, f.y - 6, 70, 50, 61, 1) : cloudBank(f.x, f.y - 10, 160, 70, 60, 1); }).join('');

  const art = [
    silk(),
    sun(1380, 214, 112),
    // far and near ink-wash peaks at the lower right, fading into mist (atmospheric depth)
    peaks(1120, 1580, 1060, 600, 5, 'idPeakFar', 0.6),
    peaks(1300, 1590, 1120, 760, 9, 'idPeakNear', 0.85),
    // flicked ink in the corners; one cinnabar flick echoes the sun
    splash(1508, 470, 20, 3, 2.0, 1.6), splash(700, 92, 8, 12, 0.3, 2), splash(1540, 1100, 14, 8, -2.3, 2.0), splash(1180, 120, 6, 13, 2.8, 2.2, CINNABAR),
    pearl(1000, 150, 30),
    g({ mask: 'url(#idFade)' },
      hind,
      dragonBody(F)),
    mists,
    g({ transform: `${tf(HEAD[0], HEAD[1], -14)} scale(-1.3 1.3)` }, head()),
    seal(1484, 520, 58, false, 41), seal(1497, 590, 50, true, 42),
    // the mat around the screen: plain silk and a fine ink keyline
    path(rr(hole.x - 18, hole.y - 18, hole.w + 36, hole.h + 36, 4), { fill: 'none', stroke: '#ebddbd', strokeWidth: 30 }),
    path(rr(hole.x - 33, hole.y - 33, hole.w + 66, hole.h + 66, 6), { fill: 'none', stroke: INK, strokeOpacity: 0.85, strokeWidth: 2.5 }),
    path(rr(hole.x - 40, hole.y - 40, hole.w + 80, hole.h + 80, 8), { fill: 'none', stroke: INK, strokeOpacity: 0.4, strokeWidth: 1 }),
    lip(holeD, '#2a1c0c', [[6, 0.12], [2.5, 0.3]]),
    mount(),
  ].join('\n');
  void neck;
  return { defs, body: art };
}

module.exports = {
  W, H, hole, radius, draw,
  meta: {
    name: 'Ink Dragon', theme: 'sumi-e-dragon', rarity: 'legendary', translucent: false,
    collection: 'midnight-atelier', license: 'CC-BY-4.0',
    desc: 'A sumi-e dragon painted in one breath roars across an empty sky at its flaming pearl, diving through ink-wash cloud beneath a cinnabar sun.',
    tags: ['dragon', 'ink', 'sumi-e', 'asian', 'silk', 'clouds', 'art', 'mature'],
  },
};
