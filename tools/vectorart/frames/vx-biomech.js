'use strict';
// Biomech: a dark sci-fi housing grown as much as built. A ribbed gunmetal carapace holds the screen in a
// smooth, quiet bezel; a vertebral column arches over the top to a ridged cranial node with an amber visor
// slit, and a second column sags beneath it around a toothed intake grille. Ribs of wet chrome curl out
// of both columns and cage the sides, corrugated hoses and cables run down behind them and loop at the
// bottom corners, hydraulic pistons brace the corners and faint amber lamps glow in the joints. Original
// Kayboro artwork, CC BY 4.0.
const L = require('../lib');
const { rr, path, g, lg, rg, circle, ellipse, tf, rng, lip } = L;

const W = 1600, H = 1200, hole = { x: 320, y: 330, w: 960, h: 540 }, radius = 12;
const CX = W / 2, CY = hole.y + hole.h / 2;
const DARK = '#08090b';

const n1 = (v) => +(+v).toFixed(1);
const P1 = (...v) => v.map(n1).join(' ');
const P0 = (...v) => v.map(Math.round).join(' ');
const mirror = (...kids) => g({}, ...kids) + g({ transform: `translate(${W} 0) scale(-1 1)` }, ...kids);

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
function frames(pts) {
  return pts.map((p, i) => {
    const a = pts[Math.max(0, i - 1)], b = pts[Math.min(pts.length - 1, i + 1)], l = Math.hypot(b[0] - a[0], b[1] - a[1]) || 1;
    const tx = (b[0] - a[0]) / l, ty = (b[1] - a[1]) / l;
    return { x: p[0], y: p[1], tx, ty, nx: -ty, ny: tx, a: Math.atan2(ty, tx) * 180 / Math.PI };
  });
}
function qthrough(pts, move = true) {
  let d = `${move ? 'M' : 'L'}${P0(...pts[0])}`;
  for (let i = 1; i < pts.length - 1; i++) {
    const [x, y] = pts[i], [x2, y2] = pts[i + 1], last = i === pts.length - 2;
    d += `Q${P0(x, y)} ${P0(last ? x2 : (x + x2) / 2, last ? y2 : (y + y2) / 2)}`;
  }
  return d;
}
/** Tapered closed shape along pts with width profile shape(t). Returns { d, left, right }. */
function sweep(pts, w, shape, m = 18) {
  const F = frames(resample(pts, m)), left = [], right = [];
  F.forEach((f, i) => { const h = (w * shape(i / (m - 1))) / 2; left.push([f.x + f.nx * h, f.y + f.ny * h]); right.push([f.x - f.nx * h, f.y - f.ny * h]); });
  return { d: `${qthrough(left)}${qthrough([...right].reverse(), false)}Z`, left, right, F };
}

// ---- materials ----------------------------------------------------------------------------------
/** A cylinder along any path: dark body, lit flank toward the top left, a wet specular line and an
 *  optional corrugation (ribbed hose). */
function tube(d, w, { base = '#2b3036', lite = '#6d7883', spec = '#e6eef5', rib = 0, glossy = 0.75 } = {}) {
  const o = (k) => `translate(${n1(-w * k)} ${n1(-w * k)})`;
  return path(d, { fill: 'none', stroke: DARK, strokeWidth: w + 4, strokeLinecap: 'round', strokeLinejoin: 'round' })
    + path(d, { fill: 'none', stroke: base, strokeWidth: w, strokeLinecap: 'round', strokeLinejoin: 'round' })
    + path(d, { fill: 'none', stroke: lite, strokeWidth: w * 0.42, strokeOpacity: 0.75, strokeLinecap: 'round', transform: o(0.14) })
    + (rib ? path(d, { fill: 'none', stroke: DARK, strokeWidth: w + 1, strokeOpacity: 0.55, strokeDasharray: `${n1(rib * 0.35)} ${n1(rib * 0.65)}` }) : '')
    + path(d, { fill: 'none', stroke: spec, strokeWidth: Math.max(1.2, w * 0.1), strokeOpacity: glossy, strokeLinecap: 'round', transform: o(0.24) });
}
/** Amber lamp: a dark socket, a hot lens and a soft halo (alpha under 0.4). */
function lamp(x, y, r, halo = 3.2) {
  return path(circle(x, y, r * halo), { fill: 'url(#bmHalo)' })
    + path(circle(x, y, r + 3), { fill: DARK })
    + path(circle(x, y, r), { fill: 'url(#bmAmber)' })
    + path(circle(x - r * 0.35, y - r * 0.35, r * 0.28), { fill: '#fff6dc', fillOpacity: 0.9 });
}

// ---- vertebrae ----------------------------------------------------------------------------------
/** One vertebra in local coordinates: the column runs along x, outward is -y. */
function vertebra(k, amber) {
  const s = (v) => n1(v * k);
  const body = `M${s(-19)} ${s(-15)}C${s(-23)} ${s(-4)} ${s(-23)} ${s(6)} ${s(-18)} ${s(16)}L${s(18)} ${s(16)}C${s(23)} ${s(6)} ${s(23)} ${s(-4)} ${s(19)} ${s(-15)}Z`;
  const spine = `M${s(-15)} ${s(-12)}C${s(-17)} ${s(-38)} ${s(-6)} ${s(-60)} ${s(16)} ${s(-74)}C${s(8)} ${s(-54)} ${s(10)} ${s(-34)} ${s(15)} ${s(-12)}Z`;
  const wing = `M${s(12)} ${s(-8)}C${s(30)} ${s(-12)} ${s(44)} ${s(-26)} ${s(52)} ${s(-44)}C${s(46)} ${s(-24)} ${s(34)} ${s(-8)} ${s(16)} ${s(4)}Z`;
  return path(wing, { fill: 'url(#bmMetalD)', stroke: DARK, strokeWidth: 1.6 })
    + path(spine, { fill: 'url(#bmMetal)', stroke: DARK, strokeWidth: 1.8 })
    + path(`M${s(-13)} ${s(-16)}C${s(-14)} ${s(-38)} ${s(-5)} ${s(-56)} ${s(12)} ${s(-69)}`, { fill: 'none', stroke: '#dfe8f0', strokeOpacity: 0.55, strokeWidth: 1.6, strokeLinecap: 'round' })
    + path(body, { fill: 'url(#bmMetal)', stroke: DARK, strokeWidth: 2 })
    + path(`M${s(-21)} ${s(-5)}H${s(21)}M${s(-21)} ${s(6)}H${s(21)}`, { stroke: DARK, strokeOpacity: 0.7, strokeWidth: 1.6 })
    + path(`M${s(-16)} ${s(-12)}Q${s(0)} ${s(-16)} ${s(16)} ${s(-12)}`, { fill: 'none', stroke: '#eef4fa', strokeOpacity: 0.6, strokeWidth: 1.4, strokeLinecap: 'round' })
    + (amber ? lamp(0, s(0.5), s(4), 2.6) : path(circle(0, s(0.5), s(3.5)), { fill: DARK }));
}
/** A column of vertebrae along pts (outward side away from the screen), with the spinal cord under it. */
function column(pts, count, kFn, flipHalf = true) {
  const F = frames(resample(pts, count));
  let out = tube(qthrough(resample(pts, 12)), 22, { base: '#1b1e22', lite: '#3e464f', rib: 7, glossy: 0.4 });
  F.forEach((f, i) => {
    const t = i / (count - 1), out1 = (f.x + f.nx - CX) ** 2 + (f.y + f.ny - CY) ** 2 > (f.x - f.nx - CX) ** 2 + (f.y - f.ny - CY) ** 2;
    const flip = flipHalf && t > 0.5 ? ' scale(-1 1)' : '';
    const up = out1 ? ' scale(1 -1)' : ''; // local -y must point outward
    out += g({ transform: `translate(${P1(f.x, f.y)}) rotate(${n1(f.a)})${up}${flip}` }, vertebra(kFn(t), i % 4 === 2));
  });
  return out;
}

// ---- ribs, cables, pistons ---------------------------------------------------------------------
/** A rib: a tapered chrome-and-bone limb with joint collars along it. */
function rib(pts, w) {
  const r = sweep(pts, w, (t) => 1 - 0.75 * t ** 1.3, 20);
  const hiPts = r.left.slice(1, -2).map((p, i) => { const f = r.F[i + 1]; return [p[0] - f.nx * 4, p[1] - f.ny * 4]; });
  let collars = '';
  for (const t of [0.18, 0.42, 0.66]) {
    const i = Math.round(t * 19), a = r.left[i], b = r.right[i], f = r.F[i];
    collars += `M${P0(a[0] + f.nx * 3, a[1] + f.ny * 3)}L${P0(b[0] - f.nx * 3, b[1] - f.ny * 3)}`;
  }
  return path(r.d, { fill: '#000', fillOpacity: 0.35, transform: 'translate(6 9)' })
    + path(r.d, { fill: 'url(#bmChrome)', stroke: DARK, strokeWidth: 2.5, strokeLinejoin: 'round' })
    + path(qthrough(hiPts), { fill: 'none', stroke: '#f2f7fb', strokeOpacity: 0.7, strokeWidth: 2, strokeLinecap: 'round' })
    + path(collars, { stroke: DARK, strokeWidth: 9, strokeLinecap: 'round' })
    + path(collars, { stroke: '#7c8792', strokeWidth: 5, strokeLinecap: 'round' })
    + path(collars, { stroke: '#e9f0f6', strokeOpacity: 0.6, strokeWidth: 1.5, strokeLinecap: 'round', transform: 'translate(-1.5 -1.5)' });
}
/** Hydraulic piston between a (cylinder end) and b (rod end). */
function piston(a, b, w = 22) {
  const m = [a[0] + (b[0] - a[0]) * 0.58, a[1] + (b[1] - a[1]) * 0.58];
  const cyl = `M${P0(...a)}L${P0(...m)}`, rod = `M${P0(...m)}L${P0(...b)}`;
  return tube(rod, w * 0.42, { base: '#8d98a3', lite: '#e3eaf1', spec: '#ffffff', glossy: 0.9 })
    + tube(cyl, w, { base: '#252a30', lite: '#5d6873', rib: 0 })
    + path(circle(...m, w * 0.55), { fill: '#1a1d21', stroke: '#7c8792', strokeWidth: 2 })
    + path(circle(...a, w * 0.62), { fill: 'url(#bmMetal)', stroke: DARK, strokeWidth: 2 }) + path(circle(...a, w * 0.22), { fill: DARK })
    + path(circle(...b, w * 0.45), { fill: 'url(#bmMetal)', stroke: DARK, strokeWidth: 2 });
}

// ---- carapace ---------------------------------------------------------------------------------------
// The main housing around the screen: a ribbed shell, wider at the shoulders, pinched at the waist.
const SHELL = [[250, 250], [520, 214], [800, 226], [1080, 214], [1350, 250], [1410, 420], [1396, 600], [1410, 780], [1350, 950],
  [1080, 990], [800, 978], [520, 990], [250, 950], [190, 780], [204, 600], [190, 420]];

function carapace() {
  const shell = cr(SHELL, { closed: true });
  // ridge plates: concentric grooves following the shell, drawn between the shell and the bezel
  let grooves = '';
  for (const k of [0.25, 0.45, 0.65, 0.82]) {
    const pts = SHELL.map(([x, y]) => [CX + (x - CX) * (1 - k * 0.17), CY + (y - CY) * (1 - k * 0.27)]);
    grooves += cr(pts, { closed: true });
  }
  // radial ribs from the bezel out to the shell edge, like the segments of an exoskeleton
  let ribsD = '';
  for (let i = 0; i < 64; i++) {
    const a = (i / 64) * Math.PI * 2, c = Math.cos(a), s = Math.sin(a);
    const r0x = hole.w / 2 + 60, r0y = hole.h / 2 + 60;
    const x0 = CX + c * r0x * 1.02, y0 = CY + s * r0y * 1.05, x1 = CX + c * 640, y1 = CY + s * 420;
    ribsD += `M${P0(x0, y0)}L${P0(x1, y1)}`;
  }
  return g({},
    path(shell, { fill: '#000', fillOpacity: 0.38, transform: 'translate(10 16)' }),
    path(shell, { fill: 'url(#bmShell)', stroke: DARK, strokeWidth: 4 }),
    g({ clipPath: 'url(#bmShellClip)' },
      path(ribsD, { stroke: DARK, strokeOpacity: 0.55, strokeWidth: 5 }),
      path(ribsD, { stroke: '#65707b', strokeOpacity: 0.25, strokeWidth: 1.6, transform: 'translate(-2.5 -2.5)' }),
      path(grooves, { fill: 'none', stroke: DARK, strokeOpacity: 0.7, strokeWidth: 5 }),
      path(grooves, { fill: 'none', stroke: '#8792a0', strokeOpacity: 0.3, strokeWidth: 1.5, transform: 'translate(-2 -3)' }),
      path(shell, { fill: 'none', stroke: '#c9d4de', strokeOpacity: 0.25, strokeWidth: 3, transform: 'translate(3 5)' }),
      path(shell, { fill: 'url(#bmSheen)' })));
}

/** The calm bezel right around the screen: smooth gunmetal, a fine chrome bead and a dark lip. */
function bezel() {
  const b = 50, outer = rr(hole.x - b, hole.y - b, hole.w + 2 * b, hole.h + 2 * b, 44);
  const holeD = rr(hole.x, hole.y, hole.w, hole.h, radius);
  return g({},
    path(outer, { fill: '#000', fillOpacity: 0.4, transform: 'translate(0 8)' }),
    path(outer, { fill: 'url(#bmBezel)', stroke: DARK, strokeWidth: 3 }),
    path(rr(hole.x - b + 5, hole.y - b + 5, hole.w + 2 * b - 10, hole.h + 2 * b - 10, 40), { fill: 'none', stroke: '#aab6c2', strokeOpacity: 0.28, strokeWidth: 2 }),
    path(rr(hole.x - 10, hole.y - 10, hole.w + 20, hole.h + 20, radius + 8), { fill: 'none', stroke: '#11141a', strokeWidth: 12 }),
    path(rr(hole.x - 16, hole.y - 16, hole.w + 32, hole.h + 32, radius + 12), { fill: 'none', stroke: 'url(#bmBead)', strokeWidth: 3 }),
    lip(holeD, '#000', [[8, 0.3], [3, 0.55]]));
}

/** Cranial node over the top column: a ridged dome with swept tusks and an amber visor slit. */
function cranium() {
  const x = CX, y = 168;
  const dome = `M${x - 96} ${y + 52}C${x - 104} ${y - 10} ${x - 64} ${y - 78} ${x} ${y - 92}C${x + 64} ${y - 78} ${x + 104} ${y - 10} ${x + 96} ${y + 52}C${x + 50} ${y + 70} ${x - 50} ${y + 70} ${x - 96} ${y + 52}Z`;
  let ridges = '';
  for (let k = -3; k <= 3; k++) ridges += `M${x + k * 24} ${y + 50}C${x + k * 26} ${y + 10} ${x + k * 20} ${y - 40} ${x + k * 8} ${y - 84 + Math.abs(k) * 8}`;
  const tusk = (s) => sweep([[x + s * 70, y + 30], [x + s * 150, y + 10], [x + s * 230, y - 30], [x + s * 290, y - 96]], 34, (t) => 1 - 0.92 * t, 16).d;
  const visor = `M${x - 62} ${y + 18}C${x - 30} ${y + 30} ${x + 30} ${y + 30} ${x + 62} ${y + 18}C${x + 34} ${y + 40} ${x - 34} ${y + 40} ${x - 62} ${y + 18}Z`;
  return g({},
    path(tusk(-1) + tusk(1), { fill: 'url(#bmChrome)', stroke: DARK, strokeWidth: 2.5 }),
    path(`M${x - 80} ${y + 26}C${x - 160} ${y + 6} ${x - 230} ${y - 34} ${x - 282} ${y - 90}M${x + 80} ${y + 26}C${x + 160} ${y + 6} ${x + 230} ${y - 34} ${x + 282} ${y - 90}`, { fill: 'none', stroke: '#f2f7fb', strokeOpacity: 0.55, strokeWidth: 2, strokeLinecap: 'round' }),
    path(dome, { fill: '#000', fillOpacity: 0.35, transform: 'translate(6 10)' }),
    path(dome, { fill: 'url(#bmDome)', stroke: DARK, strokeWidth: 3 }),
    path(ridges, { fill: 'none', stroke: DARK, strokeWidth: 6, strokeLinecap: 'round' }),
    path(ridges, { fill: 'none', stroke: '#c6d1dc', strokeOpacity: 0.45, strokeWidth: 1.8, strokeLinecap: 'round', transform: 'translate(-3 -1)' }),
    path(ellipse(x, y + 25, 140, 40), { fill: 'url(#bmHaloWide)' }),
    path(visor, { fill: '#1a0d02', stroke: DARK, strokeWidth: 3 }),
    path(visor, { fill: 'url(#bmVisor)' }),
    path(`M${x - 50} ${y + 22}Q${x} ${y + 32} ${x + 50} ${y + 22}`, { fill: 'none', stroke: '#fff2cf', strokeOpacity: 0.8, strokeWidth: 1.6 }),
    path(ellipse(x - 30, y - 50, 22, 10), { fill: '#ffffff', fillOpacity: 0.35, transform: `rotate(-24 ${x - 30} ${y - 50})` }));
}

/** Intake grille under the bottom column: a jaw of ribbed plates with an amber glow deep behind. */
function intake() {
  const x = CX, y = 990;
  const mouth = `M${x - 170} ${y - 30}C${x - 120} ${y + 40} ${x + 120} ${y + 40} ${x + 170} ${y - 30}C${x + 150} ${y + 110} ${x - 150} ${y + 110} ${x - 170} ${y - 30}Z`;
  let teeth = '';
  for (let k = -6; k <= 6; k++) {
    const tx = x + k * 22, top = y + 16 + Math.abs(k) ** 2 * 0.6 - 8, bot = y + 84 - Math.abs(k) ** 2 * 0.9;
    teeth += `M${tx - 7} ${n1(top)}L${tx + 7} ${n1(top)}L${tx + 4} ${n1(bot)}L${tx - 4} ${n1(bot)}Z`;
  }
  return g({},
    path(mouth, { fill: '#000', fillOpacity: 0.35, transform: 'translate(6 10)' }),
    path(mouth, { fill: 'url(#bmMetalD)', stroke: DARK, strokeWidth: 3 }),
    path(ellipse(x, y + 46, 130, 30), { fill: '#120802' }),
    path(ellipse(x, y + 46, 110, 22), { fill: 'url(#bmDeepGlow)' }),
    path(teeth, { fill: 'url(#bmMetal)', stroke: DARK, strokeWidth: 1.6 }),
    path(`M${x - 160} ${y - 22}C${x - 110} ${y + 40} ${x + 110} ${y + 40} ${x + 160} ${y - 22}`, { fill: 'none', stroke: '#e2eaf2', strokeOpacity: 0.45, strokeWidth: 2 }));
}

function draw() {
  const defs = [
    lg('bmShell', [0, 0, 0.4, 1], [[0, '#3a4048'], [0.35, '#23272c'], [0.7, '#16191c'], [1, '#0d0f11']]),
    rg('bmSheen', [0.32, 0.12, 0.7], [[0, '#d8e3ee', 0.16], [1, '#d8e3ee', 0]]),
    lg('bmBezel', [0, 0, 0, 1], [[0, '#3a4048'], [0.5, '#22262b'], [1, '#14171a']]),
    lg('bmBead', [0, 0, 1, 1], [[0, '#e8f0f6'], [0.4, '#6b7682'], [0.6, '#bcc7d2'], [1, '#3a424a']]),
    lg('bmMetal', [0, 0, 0.6, 1], [[0, '#a3afbb'], [0.25, '#4f5a65'], [0.55, '#2a3037'], [0.8, '#59646f'], [1, '#1a1e22']]),
    lg('bmMetalD', [0, 0, 0.6, 1], [[0, '#5c6670'], [0.5, '#262b31'], [1, '#121519']]),
    lg('bmChrome', [0, 0, 1, 1], [[0, '#11141a'], [0.3, '#5c6670'], [0.46, '#dfe7ee'], [0.52, '#3b434b'], [0.78, '#8f9ba7'], [1, '#1a1d21']]),
    rg('bmDome', [0.4, 0.3, 0.8], [[0, '#8e9aa6'], [0.4, '#3d454e'], [1, '#121519']]),
    rg('bmAmber', [0.4, 0.4, 0.7], [[0, '#fff3d0'], [0.35, '#ffc154'], [0.8, '#d77a12'], [1, '#6a3404']]),
    rg('bmHalo', [0.5, 0.5, 0.5], [[0, '#ffb347', 0.38], [0.45, '#ff9a2a', 0.14], [1, '#ff9a2a', 0]]),
    rg('bmHaloWide', [0.5, 0.5, 0.5], [[0, '#ffb347', 0.3], [1, '#ffb347', 0]]),
    lg('bmVisor', [0, 0, 1, 0], [[0, '#6a3404'], [0.3, '#ffb347'], [0.5, '#fff0c8'], [0.7, '#ffb347'], [1, '#6a3404']]),
    rg('bmDeepGlow', [0.5, 0.4, 0.6], [[0, '#ffb347', 0.38], [1, '#ff8a1a', 0]]),
    `<clipPath id="bmShellClip"><path d="${cr(SHELL, { closed: true })}"/></clipPath>`,
  ].join('');

  // columns: top arches up to the cranium, bottom sags under the screen
  const topCol = column([[236, 286], [420, 206], [620, 176], [800, 178], [980, 176], [1180, 206], [1364, 286]], 26, (t) => 0.8 + 0.4 * Math.sin(Math.PI * t));
  const botCol = column([[236, 918], [420, 990], [620, 1012], [800, 1016], [980, 1012], [1180, 990], [1364, 918]], 24, (t) => 0.75 + 0.3 * Math.sin(Math.PI * t));

  // ribs cage each side: from the top column curling down, from the bottom column curling up
  const ribs = mirror(
    rib([[300, 246], [190, 300], [110, 420], [96, 560]], 40),
    rib([[262, 276], [170, 360], [140, 470], [150, 580]], 30),
    rib([[300, 952], [196, 900], [118, 790], [96, 650]], 40),
    rib([[264, 924], [180, 846], [146, 740], [150, 620]], 30));
  const cables = mirror(
    tube('M286 300C200 380 214 520 170 620C130 720 150 860 250 980C300 1040 380 1060 430 1036', 26, { rib: 8 }),
    tube('M300 320C236 420 248 540 214 640C186 740 200 850 276 950', 16, { base: '#3a2e24', lite: '#7a6250', rib: 6 }),
    tube('M250 300C150 360 60 480 64 620C66 760 120 900 210 990', 12, { base: '#1d2126', lite: '#4a535d' }));
  const pistons = mirror(piston([258, 260], [150, 170], 24), piston([258, 940], [150, 1046], 24));

  const art = [
    // hoses loop behind everything at the bottom corners and over the shoulders
    cables,
    mirror(tube('M120 1000C140 1110 300 1140 420 1100C520 1066 560 1020 600 1010', 20, { rib: 7 })),
    pistons,
    carapace(),
    ribs,
    botCol,
    intake(),
    topCol,
    cranium(),
    mirror(lamp(200, 600, 9), lamp(268, 286, 6), lamp(268, 916, 6)),
    bezel(),
    // a faint amber pilot light in each bezel corner
    mirror(lamp(hole.x - 24, hole.y - 24, 4.5, 3), lamp(hole.x - 24, hole.y + hole.h + 24, 4.5, 3)),
  ].join('\n');
  return { defs, body: art };
}

module.exports = {
  W, H, hole, radius, draw,
  meta: {
    name: 'Biomech', theme: 'biomechanical', rarity: 'epic', translucent: false,
    collection: 'midnight-atelier', license: 'CC-BY-4.0',
    desc: 'Ribbed gunmetal, wet chrome ribs and a living spine wrap your game while amber lamps pulse in the dark.',
    tags: ['biomech', 'sci-fi', 'dark', 'chrome', 'vertebrae', 'cables', 'horror', 'mature'],
  },
};
