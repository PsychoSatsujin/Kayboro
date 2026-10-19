'use strict';
// Ink Dragon: a sumi-e ink-wash dragon coils all the way around the screen on a panel of aged silk. Its
// head rises at the top right against a cinnabar sun, jaws open toward a flaming pearl, antlers and mane
// swept back; the scaled body pours down the right side, sweeps under the screen, climbs the left and
// whips its flame-haired tail across the top. Mist swallows the body here and there, ink is flicked
// across the corners and two cinnabar seals (abstract marks, no lettering) sign the painting. Brushwork
// is drawn as tapered strokes with rough, dry edges (SVG turbulence filters) over graded washes; the silk
// is mottled with age and mounted in dark brocade, and a plain silk mat keeps the ring around the screen
// calm. Original Kayboro artwork, CC BY 4.0.
const L = require('../lib');
const { rr, path, g, lg, rg, circle, ellipse, tf, rng, lip } = L;

const W = 1600, H = 1180, hole = { x: 336, y: 330, w: 928, h: 522 }, radius = 3;
const B = 44; // brocade mount
const INK = '#17130f';
const GREY = '#5f584d';
const SILK = '#e2d2ae';
const CINNABAR = '#b8382a';
const HC = [hole.x + hole.w / 2, hole.y + hole.h / 2];

const n1 = (v) => +(+v).toFixed(1);
const P1 = (...v) => v.map(n1).join(' ');
const P0 = (...v) => v.map(Math.round).join(' '); // whole units for long brush outlines (keeps the file small)

// ---- curve helpers ------------------------------------------------------------------------------
/** Catmull-Rom spline through pts as cubic Beziers (absolute). */
function cr(pts, { closed = false, move = true } = {}) {
  const k = 1 / 6, p = closed ? [pts[pts.length - 1], ...pts, pts[0], pts[1]] : [pts[0], ...pts, pts[pts.length - 1]];
  let d = `${move ? 'M' : 'L'}${P0(...pts[0])}`;
  for (let i = 1; i < p.length - 2; i++) {
    const [x0, y0] = p[i - 1], [x1, y1] = p[i], [x2, y2] = p[i + 1], [x3, y3] = p[i + 2];
    d += `C${P0(x1 + (x2 - x0) * k, y1 + (y2 - y0) * k, x2 - (x3 - x1) * k, y2 - (y3 - y1) * k, x2, y2)}`;
  }
  return closed ? `${d}Z` : d;
}
/** Points along the Catmull-Rom spline through pts, resampled evenly by arc length (count m). */
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
/** Frames (point, unit tangent, unit normal) along evenly resampled points. */
function frames(pts) {
  return pts.map((p, i) => {
    const a = pts[Math.max(0, i - 1)], b = pts[Math.min(pts.length - 1, i + 1)], l = Math.hypot(b[0] - a[0], b[1] - a[1]) || 1;
    const tx = (b[0] - a[0]) / l, ty = (b[1] - a[1]) / l;
    return { x: p[0], y: p[1], tx, ty, nx: -ty, ny: tx };
  });
}
/** Quadratic chain through points via midpoints (smooth, compact). */
function qthrough(pts, move = true) {
  let d = `${move ? 'M' : 'L'}${P0(...pts[0])}`;
  if (pts.length < 3) return d + pts.slice(1).map((q) => `L${P0(...q)}`).join('');
  for (let i = 1; i < pts.length - 1; i++) {
    const [x, y] = pts[i], [x2, y2] = pts[i + 1], last = i === pts.length - 2;
    d += `Q${P0(x, y)} ${P0(last ? x2 : (x + x2) / 2, last ? y2 : (y + y2) / 2)}`;
  }
  return d;
}

// ---- brush ---------------------------------------------------------------------------------------
const SPINDLE = (t) => Math.sin(Math.PI * t) ** 0.7;
const NAIL = (t) => Math.min(1, t * 5) ** 0.6 * (1 - t) ** 0.85; // pressed in, then lifted to a point
const ROOT = (t) => (1 - t) ** 0.9 + 0.04; // starts at full width, tapers to a point
/** A tapered brush stroke along pts (closed path). */
function brush(pts, w, shape = SPINDLE, m) {
  const cnt = m || Math.max(6, Math.min(22, Math.round(plen(pts) / 14)));
  const F = frames(resample(pts, cnt)), left = [], right = [];
  F.forEach((f, i) => { const h = (w * shape(i / (cnt - 1))) / 2; left.push([f.x + f.nx * h, f.y + f.ny * h]); right.push([f.x - f.nx * h, f.y - f.ny * h]); });
  return `${qthrough(left)}${qthrough(right.reverse(), false)}Z`;
}
const rot = (x, y, a, r) => [x + Math.cos(a) * r, y + Math.sin(a) * r];

// ---- the dragon ----------------------------------------------------------------------------------
// Spine from the back of the head, clockwise around the screen, to the tail tip.
const SPINE = [[1318, 214], [1402, 270], [1442, 390], [1444, 560], [1424, 730], [1364, 880], [1244, 984], [1062, 1034], [840, 1046],
  [620, 1040], [430, 1004], [286, 920], [212, 790], [196, 620], [214, 452], [268, 322], [358, 226], [470, 166], [556, 148], [626, 154]];
const M = 118;
const width = (t) => (t < 0.12 ? 64 + 26 * (t / 0.12) : 5 + 85 * (1 - Math.max(0, (t - 0.3) / 0.7) ** 1.6)) * (1 + 0.05 * Math.sin(t * 31));

function bodyFrames() {
  const F = frames(resample(SPINE, M));
  const out = F.reduce((s, f) => s + (Math.hypot(f.x + f.nx - HC[0], f.y + f.ny - HC[1]) > Math.hypot(f.x - f.nx - HC[0], f.y - f.ny - HC[1]) ? 1 : -1), 0) > 0 ? 1 : -1;
  return F.map((f, i) => ({ ...f, t: i / (M - 1), w: width(i / (M - 1)), ox: f.nx * out, oy: f.ny * out }));
}
/** Point across the body: u = -0.5 (belly, toward the screen) .. 0.5 (back, outside); along moves toward the tail. */
const at = (f, u, along = 0) => [f.x + f.ox * f.w * u + f.tx * along, f.y + f.oy * f.w * u + f.ty * along];
/** Closed band of the body between across-positions u0 and u1 over frames a..b. */
function band(F, u0, u1, a = 0, b = F.length - 1) {
  const s = F.slice(a, b + 1);
  return `${cr(s.map((f) => at(f, u1)))}${cr(s.map((f) => at(f, u0)).reverse(), { move: false })}Z`;
}

function dragonBody(F) {
  const rnd = rng(7);
  const half = F.filter((_, i) => i % 2 === 0 || i === F.length - 1);
  // scales: crescent brush marks in offset rows, free edge toward the tail, in three ink tones
  const sc = ['', '', ''];
  for (const [u, off, sz] of [[0.3, 0, 0.13], [0.1, 0.5, 0.13], [-0.1, 0, 0.12], [-0.26, 0.5, 0.1]]) {
    for (let i = 3 + off; i < F.length - 8; i += 1) {
      const f = F[Math.floor(i)], hw = f.w * sz, c = at(f, u + (rnd() - 0.5) * 0.03), back = f.w * 0.2;
      const a = [c[0] - f.ox * hw, c[1] - f.oy * hw], b = [c[0] + f.ox * hw, c[1] + f.oy * hw];
      const q = [c[0] + f.tx * back, c[1] + f.ty * back], q2 = [c[0] + f.tx * back * 0.45, c[1] + f.ty * back * 0.45];
      sc[u > 0.2 ? 0 : rnd() < 0.5 ? 1 : 2] += `M${P0(...a)}Q${P0(...q)} ${P0(...b)}Q${P0(...q2)} ${P0(...a)}Z`;
    }
  }
  // belly plates: short curved ticks across the inner band
  let plates = '';
  for (let i = 3; i < F.length - 14; i++) {
    const f = F[i], a = at(f, -0.47), b = at(f, -0.31), q = at(f, -0.39, -f.w * 0.07);
    plates += `M${P0(...a)}Q${P0(...q)} ${P0(...b)}`;
  }
  // dorsal crest: a continuous ridge of swept-back flame points, a paler ridge staggered behind it
  const crest = (u, k0, hk, sweep) => {
    let d = '';
    for (let i = 1 + k0, k = 0; i < F.length - 5; i += 2, k++) {
      const f0 = F[i], f1 = F[i + 1], f2 = F[Math.min(F.length - 1, i + 2)], w = f1.w;
      const h = w * hk * (0.55 + rnd() * 0.5 + (k % 3 === 0 ? 0.35 : 0));
      const b0 = at(f0, u), b1 = at(f2, u), tip = at(f1, u + h / w, w * sweep);
      const c1 = at(f0, u + (h / w) * 0.7, w * 0.35), c2 = at(f2, u + (h / w) * 0.3, w * 0.25);
      d += `M${P0(...b0)}Q${P0(...c1)} ${P0(...tip)}Q${P0(...c2)} ${P0(...b1)}Z`;
    }
    return d;
  };
  // the back contour: a pressured stroke that thickens and lifts; the belly line is broken and light
  const backLine = brush(half.map((f) => at(f, 0.5)), 9, (t) => 0.35 + 0.65 * Math.abs(Math.sin(t * 17)) * (1 - t * 0.6), 54);
  let belly = '';
  for (let i = 2; i < F.length - 10;) {
    const j = Math.min(F.length - 10, i + 4 + Math.floor(rnd() * 6));
    belly += brush(F.slice(i, j + 1).map((f) => at(f, -0.5)), 3.4, SPINDLE, 6);
    i = j + 1 + Math.floor(rnd() * 2);
  }
  // dry-brush streaks along the body
  let dryL = '', dryD = '';
  for (const u of [-0.2, -0.04, 0.18, 0.38]) {
    for (let i = 1; i < F.length - 6;) {
      const j = Math.min(F.length - 6, i + 3 + Math.floor(rnd() * 8));
      if (rnd() < 0.6) { const s = F.slice(i, j + 1).filter((_, q) => q % 2 === 0).map((f) => at(f, u + (rnd() - 0.5) * 0.04)); if (s.length > 1) { if (u < 0.1) dryL += qthrough(s); else dryD += qthrough(s); } }
      i = j + 1 + Math.floor(rnd() * 3);
    }
  }
  // tail: a flame-shaped tuft at the tip, its lobes fanning a little and all curling the same way
  const e = F[F.length - 1], e2 = F[F.length - 5];
  let tailD = '', tailL = '';
  for (let k = 0; k < 6; k++) {
    const lift = -0.25 + k * 0.24, a = Math.atan2(e.ty + e.oy * lift, e.tx + e.ox * lift), s0 = [e2.x, e2.y];
    const len = (165 - Math.abs(k - 2.5) * 18) * (0.9 + rnd() * 0.2);
    const m1 = rot(s0[0], s0[1], a + 0.08, len * 0.4), m2 = rot(s0[0], s0[1], a, len * 0.75), end = rot(s0[0], s0[1], a - 0.12, len);
    const d = brush([s0, m1, m2, end, rot(end[0], end[1], Math.atan2(-e.oy, -e.ox) * 0 + a - 1.9, 14 + len * 0.1)], 40 - Math.abs(k - 2.5) * 4, ROOT, 12);
    if (k % 2) tailL += d; else tailD += d;
  }
  return g({},
    path(crest(0.38, 1, 0.4, 1.25), { fill: GREY, fillOpacity: 0.75 }),
    path(tailL, { fill: GREY, fillOpacity: 0.8 }), path(tailD, { fill: INK, fillOpacity: 0.88 }),
    path(crest(0.4, 0, 0.46, 1.05), { fill: INK, fillOpacity: 0.92 }),
    g({ clipPath: 'url(#idBodyClip)' },
      path(`M0 0H${W}V${H}H0Z`, { fill: 'url(#idBody)' }),
      g({ filter: 'url(#idSoft)' },
        path(band(half, -0.8, -0.24), { fill: '#efe4c8', fillOpacity: 0.8 }),
        path(band(half, 0.04, 0.8), { fill: INK, fillOpacity: 0.42 }),
        path(band(half, 0.28, 0.8), { fill: INK, fillOpacity: 0.55 })),
      path(plates, { fill: 'none', stroke: INK, strokeOpacity: 0.5, strokeWidth: 2.4, strokeLinecap: 'round' }),
      path(sc[2], { fill: INK, fillOpacity: 0.45 }), path(sc[1], { fill: INK, fillOpacity: 0.7 }), path(sc[0], { fill: INK, fillOpacity: 0.92 }),
      g({ filter: 'url(#idDry)' },
        path(dryL, { fill: 'none', stroke: '#f2e8cf', strokeOpacity: 0.35, strokeWidth: 5, strokeLinecap: 'round' }),
        path(dryD, { fill: 'none', stroke: INK, strokeOpacity: 0.45, strokeWidth: 7, strokeLinecap: 'round' }))),
    path(backLine, { fill: INK }),
    path(belly, { fill: INK, fillOpacity: 0.75 }));
}

/**
 * A clawed limb as one organic stroke: a thick shoulder narrowing to the elbow, a swelling forearm and
 * a slim wrist, a darker contour on its outer side, flame tufts at the elbow and four spread toes with
 * hooked black nails.
 */
function limb(sh, el, wr, w, talonDir, s = 1, tone = 'url(#idLimb)') {
  const prof = (t) => (t < 0.5 ? 1 - 0.45 * (t / 0.5) ** 0.8 : 0.55 + 0.12 * Math.sin(Math.PI * ((t - 0.5) / 0.5) ** 0.7) - 0.18 * ((t - 0.5) / 0.5) ** 2);
  const spine = [sh, el, wr], arm = brush(spine, w, prof, 16);
  const F = frames(resample(spine, 12)), edge = F.map((f, i) => { const h = (w * prof(i / 11)) / 2; return [f.x + f.nx * h * 0.92, f.y + f.ny * h * 0.92]; });
  let toes = '', nails = '', tuft = '', ticks = '';
  for (let k = 0; k < 4; k++) {
    const a = talonDir + (k - 1.5) * 0.4, l1 = (k === 0 ? 22 : 30) * s;
    const k1 = rot(wr[0], wr[1], a, l1), k2 = rot(k1[0], k1[1], a + 0.45, 20 * s);
    toes += brush([rot(wr[0], wr[1], a, -6 * s), k1, k2], 15 * s, (t) => 1 - t * 0.4, 6);
    nails += brush([k2, rot(k2[0], k2[1], a + 0.9, 14 * s), rot(k2[0], k2[1], a + 1.6, 22 * s)], 9 * s, ROOT, 6);
  }
  const da = Math.atan2(el[1] - sh[1], el[0] - sh[0]);
  for (let k = 0; k < 4; k++) {
    const a = da + Math.PI + 0.55 + k * 0.26, l = (74 - k * 12) * s;
    tuft += brush([el, rot(el[0], el[1], a, l * 0.55), rot(el[0], el[1], a + 0.4, l)], 13 * s, ROOT, 8);
  }
  for (let k = 2; k < 11; k += 2) {
    const f = F[k], h = (w * prof(k / 11)) / 2 * 0.7;
    ticks += `M${P0(f.x + f.nx * h, f.y + f.ny * h)}Q${P0(f.x + f.tx * 6, f.y + f.ty * 6)} ${P0(f.x - f.nx * h, f.y - f.ny * h)}`;
  }
  return g({},
    path(tuft, { fill: INK, fillOpacity: 0.85 }),
    path(arm, { fill: tone }),
    path(ticks, { fill: 'none', stroke: INK, strokeOpacity: 0.45, strokeWidth: 2.2, strokeLinecap: 'round' }),
    path(brush(edge, 7 * s, SPINDLE, 10), { fill: INK, fillOpacity: 0.85 }),
    path(toes, { fill: tone }),
    path(toes, { fill: 'none', stroke: INK, strokeWidth: 2, strokeOpacity: 0.7 }),
    path(nails, { fill: INK }));
}

/** The head in local coordinates (facing -x, origin where the neck joins). */
function head() {
  const skull = 'M-20 -66C-50 -82 -76 -82 -92 -72C-110 -90 -136 -88 -146 -68C-166 -62 -184 -56 -204 -58C-224 -74 -252 -70 -260 -46'
    + 'C-270 -30 -262 -12 -248 -10L-238 -4C-210 0 -170 6 -130 12C-104 30 -62 48 -24 56C4 58 22 36 20 6C18 -30 6 -54 -20 -66Z';
  const jaw = 'M-122 16C-152 30 -192 44 -228 56C-242 60 -252 66 -246 80C-214 92 -162 90 -112 72C-90 64 -72 54 -60 44Z';
  const mouth = 'M-132 10C-172 4 -210 -2 -238 -4L-230 56C-192 44 -152 30 -122 16Z';
  let teeth = '';
  for (let i = 0; i < 6; i++) { const x = -146 - i * 15, y = 6 - i * 1.6; teeth += `M${P1(x, y)}L${P1(x - 5, y + 10)}L${P1(x - 10, y - 0.6)}Z`; }
  for (let i = 0; i < 5; i++) { const x = -140 - i * 16, y = 24 + i * 5.4; teeth += `M${P1(x, y)}L${P1(x - 5, y - 10)}L${P1(x - 11, y + 3)}Z`; }
  teeth += 'M-222 -4L-218 24L-210 -2ZM-214 52L-210 26L-202 48Z';
  const tongue = brush([[-150, 34], [-200, 42], [-252, 32], [-284, 8], [-280, -12]], 15, NAIL, 12);
  const antler = (dx, dy, k) => brush([[-70 + dx, -70 + dy], [-46 + dx, -124 + dy], [4 + dx, -158 + dy], [64 + dx, -172 + dy], [128 + dx, -160 + dy]], 22 * k, ROOT, 16)
    + brush([[-36 + dx, -134 + dy], [-56 + dx, -168 + dy], [-50 + dx, -202 + dy]], 12 * k, ROOT)
    + brush([[18 + dx, -160 + dy], [26 + dx, -200 + dy], [12 + dx, -232 + dy]], 12 * k, ROOT)
    + brush([[76 + dx, -170 + dy], [100 + dx, -206 + dy], [134 + dx, -220 + dy]], 11 * k, ROOT);
  // mane: hair strands flowing back along the neck, alternating dark and pale
  const rnd = rng(17);
  let maneD = '', maneL = '';
  for (let i = 0; i < 13; i++) {
    const t = i / 12, sx = -60 + t * 70, sy = -74 + t * 140, len = 150 + rnd() * 90;
    const a = 0.25 + t * 0.55, p1 = rot(sx, sy, a - 0.35, len * 0.35), p2 = rot(sx, sy, a, len * 0.7), p3 = rot(sx, sy, a + 0.3, len);
    const d = brush([[sx, sy], p1, p2, p3, rot(p3[0], p3[1], a + 1.6, 20)], 26 - t * 8, ROOT, 14);
    if (i % 3 === 1) maneL += d; else maneD += d;
  }
  // a second layer of mane over the back of the skull: pointed at both ends so it grows out of the head
  let maneTop = '', maneTopL = '';
  for (let i = 0; i < 9; i++) {
    const t = i / 8, sx = -70 + t * 60 + rnd() * 10, sy = -66 + t * 118, len = 130 + rnd() * 80, a = 0.15 + t * 0.6;
    const p1 = rot(sx, sy, a - 0.3, len * 0.3), p2 = rot(sx, sy, a, len * 0.65), p3 = rot(sx, sy, a + 0.32, len);
    const d = brush([[sx, sy], p1, p2, p3, rot(p3[0], p3[1], a + 1.7, 16)], 20 - t * 6, NAIL, 14);
    if (i % 3 === 2) maneTopL += d; else maneTop += d;
  }
  const whiskers = brush([[-252, -34], [-300, -72], [-326, -128], [-302, -182], [-248, -198], [-212, -176]], 7, NAIL, 18)
    + brush([[-242, -12], [-296, 10], [-350, 8], [-386, -12], [-396, -40]], 6, NAIL, 18)
    + brush([[-238, 76], [-264, 118], [-248, 164], [-212, 180]], 11, NAIL, 12)
    + brush([[-206, 84], [-216, 128], [-196, 160]], 8, NAIL, 10)
    + brush([[-176, 86], [-180, 118], [-164, 140]], 6, NAIL, 8);
  // contour strokes, heavier where the shape turns away from the light
  const contours = brush([[-262, -42], [-246, -64], [-222, -72], [-204, -58], [-180, -56], [-160, -62]], 7, NAIL, 12)
    + brush([[-250, -10], [-210, 0], [-170, 6], [-132, 12]], 6, SPINDLE, 10)
    + brush([[-132, 12], [-106, 28], [-92, 22], [-98, 10], [-108, 14]], 7, ROOT, 10)
    + brush([[-248, 80], [-206, 90], [-160, 88], [-112, 72], [-60, 46]], 9, NAIL, 12)
    + brush([[-120, 18], [-160, 32], [-200, 46], [-228, 56]], 4, SPINDLE, 10)
    + brush([[-104, 34], [-60, 50], [-20, 58], [16, 50]], 8, SPINDLE, 10);
  const brow = brush([[-170, -48], [-142, -68], [-108, -72], [-80, -100], [-58, -136]], 18, NAIL, 12)
    + brush([[-150, -76], [-120, -94], [-100, -126]], 10, NAIL, 8);
  const cheek = brush([[-90, 46], [-40, 66], [6, 96], [36, 122]], 18, ROOT) + brush([[-56, 32], [-6, 44], [44, 60], [80, 58]], 14, ROOT);
  const ridges = brush([[-176, -42], [-194, -38], [-212, -44]], 4, SPINDLE, 6) + brush([[-170, -28], [-190, -22], [-206, -28]], 4, SPINDLE, 6)
    + brush([[-96, -16], [-80, 0], [-86, 24]], 5, SPINDLE, 6) + brush([[-68, -26], [-48, -6], [-56, 24]], 5, SPINDLE, 6);
  const nostril = brush([[-238, -50], [-254, -42], [-250, -26], [-234, -30], [-236, -42]], 7, SPINDLE, 8);
  return g({},
    path(antler(28, -14, 0.85), { fill: '#8a8070', fillOpacity: 0.9 }),
    path(maneL, { fill: GREY, fillOpacity: 0.85 }),
    path(maneD, { fill: INK, fillOpacity: 0.9 }),
    path(antler(0, 0, 1), { fill: 'url(#idAntler)' }),
    path(jaw, { fill: 'url(#idHead)' }),
    `<clipPath id="idJawClip"><path d="${jaw}"/></clipPath>`,
    g({ clipPath: 'url(#idJawClip)' }, path(ellipse(-170, 92, 110, 18), { fill: INK, fillOpacity: 0.5, filter: 'url(#idSoft)' })),
    path(mouth, { fill: '#2a1210' }),
    path(tongue, { fill: CINNABAR }),
    path(teeth, { fill: '#f1e8d2', stroke: INK, strokeWidth: 1.4, strokeLinejoin: 'round' }),
    `<clipPath id="idSkullClip"><path d="${skull}"/></clipPath>`,
    path(skull, { fill: 'url(#idHead)' }),
    g({ clipPath: 'url(#idSkullClip)' }, g({ filter: 'url(#idSoft)' },
      path(ellipse(-176, -52, 96, 16), { fill: '#e2d7bf', fillOpacity: 0.7 }),
      path(ellipse(-128, -38, 42, 22), { fill: INK, fillOpacity: 0.4 }),
      path(ellipse(-50, 44, 90, 26), { fill: INK, fillOpacity: 0.45 }),
      path(ellipse(10, -6, 26, 60), { fill: INK, fillOpacity: 0.5 }),
      path(ellipse(-200, -4, 50, 10), { fill: INK, fillOpacity: 0.3 }))),
    path(maneTopL, { fill: GREY, fillOpacity: 0.8 }),
    path(maneTop, { fill: INK, fillOpacity: 0.88 }),
    path(cheek, { fill: INK, fillOpacity: 0.85 }),
    path(contours + ridges + nostril, { fill: INK }),
    // the eye: pale gold, slit pupil, a glint
    path('M-156 -42Q-132 -60 -104 -44Q-130 -28 -156 -42Z', { fill: '#e6c470' }),
    path('M-156 -42Q-132 -60 -104 -44', { fill: 'none', stroke: INK, strokeWidth: 4, strokeLinecap: 'round' }),
    path(ellipse(-130, -43, 3.6, 8), { fill: INK }),
    path(circle(-125, -48, 1.8), { fill: '#fff8e6' }),
    path(brow, { fill: INK }),
    path(whiskers, { fill: INK, fillOpacity: 0.92 }));
}

/** The flaming pearl the dragon chases: a pale orb in a soft glow, with flame tongues rising off its top
 *  and leaning in the wind, and a couple of trailing wisps. */
function pearl(x, y, r) {
  let flames = '', pale = '';
  for (let k = 0; k < 6; k++) {
    const a = (k / 6) * Math.PI * 2 + 0.2, sc = 1 + (k % 3) * 0.22;
    const pts = [0, 0.4, 0.8, 1.2, 1.55].map((q, i) => rot(x, y, a + q * sc, r * (1 + i * 0.24 * sc)));
    const d = brush(pts, 15, NAIL, 12);
    if (k % 2) pale += d; else flames += d;
  }
  return g({},
    path(circle(x, y, r * 3.2), { fill: 'url(#idPearlGlow)' }),
    path(pale, { fill: GREY, fillOpacity: 0.6 }),
    path(flames, { fill: INK, fillOpacity: 0.82 }),
    path(circle(x, y, r), { fill: 'url(#idPearl)' }),
    path(brush([rot(x, y, 2.6, r), rot(x, y, 1.6, r * 1.02), rot(x, y, 0.6, r * 1.02), rot(x, y, -0.2, r)], 6, SPINDLE, 8), { fill: INK, fillOpacity: 0.75 }),
    path(`M${P1(x - r * 0.55, y - r * 0.15)}Q${P1(x - r * 0.4, y - r * 0.65, x + r * 0.15, y - r * 0.6)}`, { fill: 'none', stroke: '#fffaf0', strokeWidth: 3, strokeLinecap: 'round', strokeOpacity: 0.8 }));
}

// ---- mist, splashes, seals -------------------------------------------------------------------------
/** A blob outline around (cx, cy). */
function blob(cx, cy, rx, ry, seed, k = 10) {
  const rnd = rng(seed), pts = [];
  for (let i = 0; i < k; i++) { const a = (i / k) * Math.PI * 2, q = 0.78 + rnd() * 0.36; pts.push([cx + Math.cos(a) * rx * q, cy + Math.sin(a) * ry * q]); }
  return cr(pts, { closed: true });
}
// Where the dragon dives into mist: [cx, cy, rx, ry]. The body is faded out there with a mask (so the silk
// shows through), then a few drifting washes and fine wind strokes are laid over the gap.
const MISTS = [[820, 1044, 150, 64, 650, 1010], [196, 668, 110, 46, 70, 250], [1440, 706, 110, 44, 1320, 1530]];
function mistMask() {
  return `<mask id="idFade" maskUnits="userSpaceOnUse" x="0" y="0" width="${W}" height="${H}"><path d="M0 0H${W}V${H}H0Z" fill="#fff"/>`
    + g({ filter: 'url(#idFog)' }, MISTS.map(([x, y, rx, ry], i) => path(blob(x, y, rx * 0.8, ry * 0.8, 50 + i), { fill: '#000' })).join('')) + '</mask>';
}
function mists() {
  let wash = '', lines = '';
  MISTS.forEach(([cx, cy, rx, ry, lx0, lx1], i) => {
    const rnd = rng(60 + i);
    for (let k = 0; k < 3; k++) wash += ellipse(cx + (rnd() - 0.5) * rx * 0.8, cy + (k - 1) * ry * 0.55, rx * (0.7 + rnd() * 0.5), ry * 0.18);
    for (let k = 0; k < 2; k++) {
      const y = cy + (k ? ry * 0.35 : -ry * 0.2), x0 = lx0 + (k ? 24 : 0), x1 = lx1 - (k ? 30 : 0), dir = (i + k) % 2 ? 1 : -1;
      const end = dir > 0 ? x1 : x0, st = dir > 0 ? x0 : x1;
      lines += brush([[st, y + 6], [(st * 2 + end) / 3, y - 6 + rnd() * 8], [(st + end * 2) / 3, y + 4], [end, y - 4]], 4.5 - k * 1.2, NAIL, 12);
    }
  });
  return g({},
    path(wash, { fill: GREY, fillOpacity: 0.22, filter: 'url(#idSoft)' }),
    path(lines, { fill: INK, fillOpacity: 0.5, filter: 'url(#idRough)' }));
}
/** Round dots as zero-length round-capped strokes: [[x, y, r]] (tiny markup). */
function dots(list, color, a = 1) {
  const by = new Map();
  for (const [x, y, r] of list) { const k = Math.max(1, Math.round(r * 2)); by.set(k, (by.get(k) || '') + `M${P0(x, y)}h0`); }
  return [...by].map(([k, d]) => path(d, { stroke: color, strokeOpacity: a, strokeWidth: k, strokeLinecap: 'round' })).join('');
}
/** Ink splash: a blot with thrown spikes and droplets. */
function splash(cx, cy, r, seed, a0 = 0, spread = Math.PI * 2) {
  const rnd = rng(seed), pts = [], drops = [];
  const inFan = (a) => Math.abs(((a - a0 + Math.PI * 3) % (Math.PI * 2)) - Math.PI) < spread / 2;
  for (let i = 0; i < 30; i++) {
    const a = (i / 30) * Math.PI * 2, spike = inFan(a) && rnd() < 0.3;
    const q = spike ? 1.5 + rnd() * 0.8 : 0.8 + rnd() * 0.25;
    if (spike) pts.push(rot(cx, cy, a - 0.05, r * 0.95), rot(cx, cy, a, r * q), rot(cx, cy, a + 0.05, r * 0.95));
    else pts.push(rot(cx, cy, a, r * q));
    if (spike) for (let k = 0; k < 3; k++) drops.push([...rot(cx, cy, a + (rnd() - 0.5) * 0.1, r * (q + 0.5 + k * 0.6 + rnd() * 0.4)), r * (0.13 - k * 0.03) * (0.7 + rnd() * 0.6)]);
  }
  for (let i = 0; i < 26; i++) { const a = a0 + (rnd() - 0.5) * spread, d = r * (1.6 + rnd() * 3.4); drops.push([...rot(cx, cy, a, d), 0.8 + rnd() * r * 0.07]); }
  return path(cr(pts, { closed: true }), { fill: INK, fillOpacity: 0.85 }) + dots(drops, INK, 0.85);
}
/** Cinnabar seal: a stamped square or oval with an abstract carved mark (no lettering). */
function seal(x, y, s, round = false, seed = 3) {
  const rnd = rng(seed), w = round ? s * 0.72 : s, outline = round ? rr(x, y, w, s, w / 2) : rr(x, y, s, s, 3);
  let mark;
  if (round) mark = `M${P1(x + w * 0.5, y + s * 0.2)}V${n1(y + s * 0.8)}M${P1(x + w * 0.24, y + s * 0.38)}Q${P1(x + w * 0.5, y + s * 0.24, x + w * 0.76, y + s * 0.38)}M${P1(x + w * 0.24, y + s * 0.62)}Q${P1(x + w * 0.5, y + s * 0.78, x + w * 0.76, y + s * 0.62)}`;
  else {
    mark = `M${P1(x + s * 0.2, y + s * 0.3)}H${n1(x + s * 0.8)}M${P1(x + s * 0.5, y + s * 0.3)}V${n1(y + s * 0.82)}`
      + `M${P1(x + s * 0.22, y + s * 0.58)}Q${P1(x + s * 0.34, y + s * 0.46, x + s * 0.44, y + s * 0.58)}T${P1(x + s * 0.66, y + s * 0.58)}T${P1(x + s * 0.8, y + s * 0.56)}`
      + `M${P1(x + s * 0.24, y + s * 0.76)}H${n1(x + s * 0.4)}M${P1(x + s * 0.6, y + s * 0.76)}H${n1(x + s * 0.78)}M${P1(x + s * 0.32, y + s * 0.16)}L${P1(x + s * 0.42, y + s * 0.24)}M${P1(x + s * 0.68, y + s * 0.16)}L${P1(x + s * 0.58, y + s * 0.24)}`;
  }
  let specks = '';
  for (let i = 0; i < 26; i++) specks += circle(x + rnd() * w, y + rnd() * s, 0.6 + rnd() * 1.6);
  return g({ transform: `rotate(${round ? 1.5 : -2} ${n1(x + w / 2)} ${n1(y + s / 2)})`, filter: 'url(#idRough)' },
    path(outline, { fill: CINNABAR, fillOpacity: 0.9 }),
    path(round ? rr(x + 5, y + 5, w - 10, s - 10, (w - 10) / 2) : rr(x + 6, y + 6, s - 12, s - 12, 2), { fill: 'none', stroke: '#f2e4c6', strokeWidth: 3 }),
    path(mark, { fill: 'none', stroke: '#f2e4c6', strokeWidth: round ? 4 : 4.5, strokeLinecap: 'square' }),
    path(specks, { fill: '#f2e4c6', fillOpacity: 0.6 }));
}

// ---- silk and mount ----------------------------------------------------------------------------------
function silk() {
  const rnd = rng(19);
  let fox = '';
  for (let i = 0; i < 80; i++) {
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
  // a tonal cloud-scroll on dark silk, 72 x 72
  const s = 'M14 44Q14 30 28 30Q40 30 40 40Q40 48 32 48Q26 48 26 42M40 40Q42 26 56 28Q66 30 64 40M10 50H66';
  return '<pattern id="idBrocade" width="72" height="72" patternUnits="userSpaceOnUse">'
    + path(s, { fill: 'none', stroke: '#8a744a', strokeOpacity: 0.2, strokeWidth: 2, strokeLinecap: 'round' })
    + path(s, { fill: 'none', stroke: '#8a744a', strokeOpacity: 0.11, strokeWidth: 2, strokeLinecap: 'round', transform: 'translate(36 36) scale(0.6)' })
    + '</pattern>';
}

function draw() {
  const F = bodyFrames();
  const holeD = rr(hole.x, hole.y, hole.w, hole.h, radius);
  const defs = [
    '<filter id="idSoft" x="-40%" y="-40%" width="180%" height="180%"><feGaussianBlur stdDeviation="9"/></filter>',
    '<filter id="idFog" x="-60%" y="-60%" width="220%" height="220%"><feGaussianBlur stdDeviation="20"/></filter>',
    '<filter id="idWash" x="-50%" y="-50%" width="200%" height="200%"><feGaussianBlur stdDeviation="22"/></filter>',
    // brush edges: a little turbulence pushes every edge about so strokes read as ink on silk
    '<filter id="idRough" x="-5%" y="-5%" width="110%" height="110%"><feTurbulence type="fractalNoise" baseFrequency="0.045" numOctaves="2" seed="3"/>'
      + '<feDisplacementMap in="SourceGraphic" scale="6" xChannelSelector="R" yChannelSelector="G"/></filter>',
    // dry brush: speckled gaps where the bristles skipped
    '<filter id="idDry" x="-5%" y="-5%" width="110%" height="110%"><feTurbulence type="fractalNoise" baseFrequency="0.09 0.5" numOctaves="2" seed="8"/>'
      + '<feColorMatrix values="0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 -4 2.4"/><feComposite in="SourceGraphic" operator="in"/></filter>',
    // age: slow brown mottling over the silk
    '<filter id="idAge" x="0" y="0" width="100%" height="100%"><feTurbulence type="fractalNoise" baseFrequency="0.0045 0.006" numOctaves="4" seed="12"/>'
      + '<feColorMatrix values="0 0 0 0 0.42 0 0 0 0 0.29 0 0 0 0 0.14 0 0 1.5 0 -0.62"/></filter>',
    lg('idSilkTone', [0, 0, 1, 1], [[0, '#d8c398'], [0.45, SILK], [1, '#d3bd92']]),
    rg('idVignette', [0.5, 0.5, 0.75], [[0.55, '#6a4a22', 0], [1, '#5a3c1a', 0.36]]),
    '<pattern id="idWeave" width="5" height="5" patternUnits="userSpaceOnUse">'
      + `${path('M0 0.5H5', { stroke: '#7a5a30', strokeOpacity: 0.07, strokeWidth: 1 })}${path('M2.5 0V5', { stroke: '#fff8e8', strokeOpacity: 0.09, strokeWidth: 1 })}</pattern>`,
    brocadeTile(),
    lg('idGilt', [0, 0, 1, 1], [[0, '#c9a868'], [0.5, '#8a6a34'], [1, '#b8955a']]),
    lg('idBody', [0, 0, 1, 1], [[0, '#80786a'], [0.5, '#6e675b'], [1, '#5a544a']]),
    lg('idLimb', [0, 0, 1, 1], [[0, '#8a8272'], [1, '#4a443a']]),
    lg('idLimbFar', [0, 0, 1, 1], [[0, '#a59c8a'], [1, '#7a7264']]),
    lg('idHead', [0, 0, 0, 1], [[0, '#b0a690'], [0.5, '#8a8170'], [1, '#4e483e']]),
    lg('idAntler', [0, 0, 1, 1], [[0, '#6a6254'], [1, '#2a2620']]),
    rg('idMist', [0.5, 0.5, 0.5], [[0, '#ede2c6'], [0.75, '#e6d9b8'], [1, '#e0d0ac']]),
    rg('idSun', [0.42, 0.4, 0.62], [[0, '#cf4a33'], [0.7, '#bd3c2a'], [1, '#a83224']]),
    rg('idSunHalo', [0.5, 0.5, 0.5], [[0.5, '#c8543a', 0.2], [1, '#c8543a', 0]]),
    rg('idPearl', [0.38, 0.34, 0.75], [[0, '#fbf5e6'], [0.6, '#ddd2ba'], [1, '#948a78']]),
    rg('idPearlGlow', [0.5, 0.5, 0.5], [[0, '#fff6dc', 0.38], [1, '#fff6dc', 0]]),
    `<clipPath id="idBodyClip"><path d="${band(F, -0.5, 0.5)}"/></clipPath>`,
    mistMask(),
  ].join('');

  const fr = (t) => F[Math.round(t * (M - 1))];
  const front = limb(at(fr(0.1), 0.2), [1534, 360], [1522, 276], 54, -1.9);
  const frontFar = limb(at(fr(0.05), 0.1), [1474, 296], [1486, 228], 38, -2.0, 0.8, 'url(#idLimbFar)');
  const hind = limb(at(fr(0.64), 0.2), [100, 790], [96, 884], 54, 1.8);

  const art = [
    silk(),
    // the cinnabar sun, its edge softened, banded by mist
    path(circle(1392, 168, 200), { fill: 'url(#idSunHalo)' }),
    g({ filter: 'url(#idRough)' }, path(circle(1392, 168, 116), { fill: 'url(#idSun)' })),
    // distant washes give the sky some weather
    g({ filter: 'url(#idWash)' },
      path(ellipse(260, 1070, 280, 70), { fill: GREY, fillOpacity: 0.22 }),
      path(ellipse(1280, 1090, 320, 60), { fill: GREY, fillOpacity: 0.2 }),
      path(ellipse(880, 110, 320, 56), { fill: GREY, fillOpacity: 0.14 }),
      path(ellipse(1510, 560, 60, 260), { fill: GREY, fillOpacity: 0.14 }),
      path(ellipse(100, 400, 56, 200), { fill: GREY, fillOpacity: 0.14 })),
    g({ filter: 'url(#idRough)' },
      splash(116, 112, 30, 3, 0.75, 2.2), splash(1500, 1102, 22, 8, -2.3, 2.0), splash(1000, 1116, 10, 11, -1.6, 2), splash(330, 92, 8, 12, 0.5, 2)),
    path(ellipse(1390, 236, 210, 14), { fill: '#ece0c2', fillOpacity: 0.85, filter: 'url(#idSoft)' }),
    path(ellipse(1430, 140, 130, 9), { fill: '#ece0c2', fillOpacity: 0.7, filter: 'url(#idSoft)' }),
    g({ filter: 'url(#idRough)', mask: 'url(#idFade)' },
      pearl(868, 152, 30),
      frontFar,
      dragonBody(F),
      front, hind,
      g({ transform: `${tf(F[0].x, F[0].y, 8)} scale(1.12)` }, head())),
    // mist the body plunges through
    mists(),
    seal(1470, 968, 60, false, 41), seal(1486, 1038, 52, true, 42),
    // the mat around the screen: plain silk and a fine ink keyline
    path(rr(hole.x - 18, hole.y - 18, hole.w + 36, hole.h + 36, 4), { fill: 'none', stroke: '#e9dbbb', strokeWidth: 30 }),
    path(rr(hole.x - 33, hole.y - 33, hole.w + 66, hole.h + 66, 6), { fill: 'none', stroke: INK, strokeOpacity: 0.85, strokeWidth: 2.5 }),
    path(rr(hole.x - 40, hole.y - 40, hole.w + 80, hole.h + 80, 8), { fill: 'none', stroke: INK, strokeOpacity: 0.4, strokeWidth: 1 }),
    lip(holeD, '#2a1c0c', [[6, 0.12], [2.5, 0.3]]),
    mount(),
  ].join('\n');
  return { defs, body: art };
}

module.exports = {
  W, H, hole, radius, draw,
  meta: {
    name: 'Ink Dragon', theme: 'sumi-e-dragon', rarity: 'legendary', translucent: false,
    collection: 'midnight-atelier', license: 'CC-BY-4.0',
    desc: 'A sumi-e dragon coils around your game through ink-wash mist, chasing its flaming pearl beneath a cinnabar sun on aged silk.',
    tags: ['dragon', 'ink', 'sumi-e', 'asian', 'silk', 'clouds', 'art', 'mature'],
  },
};
