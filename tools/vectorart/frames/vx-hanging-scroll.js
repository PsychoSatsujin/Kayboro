'use strict';
// Hanging Scroll: a kakejiku. A plaited cord on two rings above a lacquered top rod; celadon silk "heaven"
// with two hanging strips; an indigo brocade border with tiny gold blossoms; gold brocade bands above and
// below the painting; aged silk painted with misty ink hills, a gnarled ink plum branch in red bloom with
// two little birds, a red-and-white koi with a dark companion among ink ripples, drifting petals and a red
// seal of abstract strokes; a weighted bottom roller with knobbed ends. The screen sits in the painting.
const L = require('../lib');
const { g, lg, rg, rng } = L;

const W = 1180, H = 1500;
const M = { x0: 60, x1: 1120 };                 // mount (fabric) edges
const PA = { x0: 140, x1: 1040, y0: 312, y1: 1262 }; // painting
const hole = { x: 230, y: 522, w: 720, h: 540 }, radius = 6;
const Y = { rod: 64, ten: 90, chu: 240, ichi: 290, ichiB: 1262, chuB: 1278, chi: 1318, roll: 1420 };
const CX = W / 2;
const INK = '#1d1b1a';
const PAPER = '#f2e8d2';

// ---- compact path output --------------------------------------------------------------------------------
const n = (v) => Math.round(v * 10) / 10;
const P = (...a) => a.map(n).join(' ');
const poly = (pts, close = true) => `M${pts.map((p) => P(...p)).join('L')}${close ? 'Z' : ''}`;
const circle = (cx, cy, r) => `M${P(cx - r, cy)}A${P(r, r)} 0 1 0 ${P(cx + r, cy)}A${P(r, r)} 0 1 0 ${P(cx - r, cy)}Z`;
const ellipse = (cx, cy, rx, ry) => `M${P(cx - rx, cy)}A${P(rx, ry)} 0 1 0 ${P(cx + rx, cy)}A${P(rx, ry)} 0 1 0 ${P(cx - rx, cy)}Z`;
const rect = (x, y, w, h) => `M${P(x, y)}H${n(x + w)}V${n(y + h)}H${n(x)}Z`;
function smooth(pts) {
  let d = `M${P(...pts[0])}`;
  for (let i = 1; i < pts.length - 1; i++) {
    const [x, y] = pts[i], [x2, y2] = pts[i + 1], last = i === pts.length - 2;
    d += `Q${P(x, y)} ${P(last ? x2 : (x + x2) / 2, last ? y2 : (y + y2) / 2)}`;
  }
  return d;
}
function nums(list) {
  let s = '';
  for (const v of list) {
    const t = String(n(v)).replace(/^(-?)0\./, '$1.');
    s += !s || t[0] === '-' || (t[0] === '.' && /\.\d*$/.test(s)) ? t : ` ${t}`;
  }
  return s;
}
/** Rewrite absolute path data (M L H V C Q A Z) as compact relative commands; rounding never accumulates. */
function toRel(d) {
  if (/[mlhvcqaz]/.test(d)) return d;
  let out = '', cx = 0, cy = 0, sx = 0, sy = 0;
  for (const [, c, args] of d.matchAll(/([MLHVCQAZ])([^MLHVCQAZ]*)/g)) {
    const v = (args.match(/-?\d*\.?\d+(?:e-?\d+)?/g) || []).map(Number);
    const step = (x, y) => { const dx = n(x - cx), dy = n(y - cy); cx = n(cx + dx); cy = n(cy + dy); return [dx, dy]; };
    const rel = (x, y) => [n(x - cx), n(y - cy)];
    if (c === 'Z') { out += 'z'; cx = sx; cy = sy; continue; }
    if (c === 'M') {
      for (let i = 0; i < v.length; i += 2) {
        if (!out) { cx = n(v[i]); cy = n(v[i + 1]); out += `M${nums([cx, cy])}`; } else out += (i ? 'l' : 'm') + nums(step(v[i], v[i + 1]));
        if (!i) { sx = cx; sy = cy; }
      }
    } else if (c === 'L') { const o = []; for (let i = 0; i < v.length; i += 2) o.push(...step(v[i], v[i + 1])); out += `l${nums(o)}`; }
    else if (c === 'H') { const o = v.map((x) => { const dx = n(x - cx); cx = n(cx + dx); return dx; }); out += `h${nums(o)}`; }
    else if (c === 'V') { const o = v.map((y) => { const dy = n(y - cy); cy = n(cy + dy); return dy; }); out += `v${nums(o)}`; }
    else if (c === 'C') { const o = []; for (let i = 0; i < v.length; i += 6) o.push(...rel(v[i], v[i + 1]), ...rel(v[i + 2], v[i + 3]), ...step(v[i + 4], v[i + 5])); out += `c${nums(o)}`; }
    else if (c === 'Q') { const o = []; for (let i = 0; i < v.length; i += 4) o.push(...rel(v[i], v[i + 1]), ...step(v[i + 2], v[i + 3])); out += `q${nums(o)}`; }
    else if (c === 'A') { const o = []; for (let i = 0; i < v.length; i += 7) o.push(v[i], v[i + 1], v[i + 2], v[i + 3], v[i + 4], ...step(v[i + 5], v[i + 6])); out += `a${nums(o)}`; }
  }
  return out;
}
const path = (d, a = {}) => L.path(toRel(d), a);

/** Dense points on a Catmull-Rom spline through the control points. */
function spline(ctrl, per = 8) {
  const out = [];
  for (let i = 0; i < ctrl.length - 1; i++) {
    const p0 = ctrl[Math.max(0, i - 1)], p1 = ctrl[i], p2 = ctrl[i + 1], p3 = ctrl[Math.min(ctrl.length - 1, i + 2)];
    for (let j = 0; j < per; j++) {
      const t = j / per, t2 = t * t, t3 = t2 * t;
      out.push([0, 1].map((k) => 0.5 * (2 * p1[k] + (-p0[k] + p2[k]) * t + (2 * p0[k] - 5 * p1[k] + 4 * p2[k] - p3[k]) * t2 + (-p0[k] + 3 * p1[k] - 3 * p2[k] + p3[k]) * t3)));
    }
  }
  out.push(ctrl[ctrl.length - 1]);
  return out;
}

// ---- the painting ---------------------------------------------------------------------------------------
/** Ink branch: a tapering, slightly knobbly brush stroke with dry-brush streaks and moss dots. */
function branch(ctrl, w0, w1, seed = 1) {
  const pts = spline(ctrl, 7), N = pts.length, rnd = rng(seed), left = [], right = [], streaks = [[], [], []];
  // knobbly width: slow swell plus a few knots
  const knots = [rnd() * 0.6 + 0.1, rnd() * 0.6 + 0.3];
  for (let i = 0; i < N; i++) {
    const t = i / (N - 1), a = pts[Math.max(0, i - 1)], b = pts[Math.min(N - 1, i + 1)], dx = b[0] - a[0], dy = b[1] - a[1], l = Math.hypot(dx, dy) || 1;
    const knot = knots.reduce((s, k) => s + 0.35 * Math.exp(-(((t - k) / 0.04) ** 2)), 0);
    const w = ((w0 + (w1 - w0) * t) / 2) * (0.9 + 0.18 * Math.sin(t * 17 + seed) + knot);
    const nx = -dy / l, ny = dx / l;
    left.push([pts[i][0] + nx * w, pts[i][1] + ny * w]); right.unshift([pts[i][0] - nx * w * 0.92, pts[i][1] - ny * w * 0.92]);
    [-0.45, 0.05, 0.4].forEach((o, k) => streaks[k].push([pts[i][0] + nx * w * o, pts[i][1] + ny * w * o]));
  }
  let moss = '';
  for (let i = 2; i < N - 2; i += 2) if (rnd() < 0.5) { const [x, y] = rnd() < 0.6 ? left[i] : right[N - 1 - i]; moss += ellipse(x + (rnd() - 0.5) * 3, y + (rnd() - 0.5) * 3, 1.4 + rnd() * 2.4 * (w0 / 20), 1 + rnd() * 1.4); }
  const dry = streaks.map((s, k) => path(smooth(s.slice(1, -2)), { fill: 'none', stroke: PAPER, strokeOpacity: [0.26, 0.18, 0.3][k], strokeWidth: n(Math.max(0.8, w0 * [0.05, 0.08, 0.04][k])), strokeDasharray: ['40 14 18 30', '22 40 30 18', '60 22 10 26'][k], strokeDashoffset: n(rnd() * 40), strokeLinecap: 'round' })).join('');
  return path(poly([...left, ...right]), { fill: 'url(#ink)' }) + dry + path(moss, { fill: INK });
}

/** Red plum blossom: five round petals, a dark eye, fine stamens tipped yellow. */
function blossom(cx, cy, r, rot = 0) {
  let pet = '', st = '', tips = '';
  for (let i = 0; i < 5; i++) {
    const a = ((rot + i * 72) * Math.PI) / 180;
    pet += circle(cx + Math.cos(a) * r * 0.52, cy + Math.sin(a) * r * 0.52, r * 0.5);
  }
  for (let i = 0; i < 9; i++) {
    const a = ((rot + i * 40 + 10) * Math.PI) / 180, l = r * (0.5 + (i % 2) * 0.16);
    st += `M${P(cx, cy)}L${P(cx + Math.cos(a) * l, cy + Math.sin(a) * l)}`;
    tips += circle(cx + Math.cos(a) * l, cy + Math.sin(a) * l, Math.max(1, r * 0.08));
  }
  return path(pet, { fill: 'url(#plum)' })
    + path(circle(cx, cy, r * 0.3), { fill: '#8e1016', fillOpacity: 0.8 })
    + path(st, { fill: 'none', stroke: '#5a0a0c', strokeWidth: n(Math.max(0.7, r * 0.05)), strokeLinecap: 'round' })
    + path(tips, { fill: '#f6cf55' });
}
const bud = (x, y, r) => path(circle(x, y, r), { fill: 'url(#plum)' }) + path(`M${P(x - r * 0.7, y + r * 0.5)}Q${P(x, y + r * 1.3, x + r * 0.7, y + r * 0.5)}`, { fill: 'none', stroke: INK, strokeWidth: n(r * 0.45), strokeLinecap: 'round' });

/** Little round bird perched facing left; c = [back, breast]. */
function bird(x, y, s, c, flip = 1) {
  const T = (d) => g({ transform: `translate(${n(x)} ${n(y)}) scale(${n(flip * s * 100) / 100} ${n(s * 100) / 100})` }, d);
  const body = 'M-22 -16C-22 -30 -8 -36 4 -32C16 -28 24 -18 26 -6C28 8 18 18 2 18C-12 18 -22 8 -22 -4Z';
  const breast = 'M-22 -6C-20 6 -10 16 2 17C-4 10 -6 0 -4 -10C-10 -14 -18 -12 -22 -6Z';
  const wing = 'M2 -20C14 -22 26 -14 30 -2C34 8 36 14 44 18C32 18 18 14 10 6C4 0 0 -10 2 -20Z';
  const tail = 'M24 6L52 14L50 20L22 14Z';
  const beak = 'M-21 -18L-31 -14L-21 -11Z';
  return T(path(tail, { fill: c[0], stroke: INK, strokeWidth: 1.4, strokeLinejoin: 'round' })
    + path(body, { fill: c[0], stroke: INK, strokeWidth: 1.6 })
    + path(breast, { fill: c[1] })
    + path(wing, { fill: c[2], stroke: INK, strokeWidth: 1.4, strokeLinejoin: 'round' })
    + path('M10 -8C18 -6 24 0 28 8M8 0C14 4 20 8 24 12', { fill: 'none', stroke: INK, strokeOpacity: 0.55, strokeWidth: 1.3, strokeLinecap: 'round' })
    + path(beak, { fill: '#3a3a3a' })
    + path(circle(-12, -19, 5.2), { fill: '#fff' }) + path(circle(-12, -19, 3.2), { fill: INK }) + path(circle(-13, -20.2, 1.1), { fill: '#fff' })
    + path(ellipse(-8, -2, 4, 2.4), { fill: '#f08a7a', fillOpacity: 0.5 })
    + path('M-4 17L-7 26M4 17L6 26', { fill: 'none', stroke: '#3a2a20', strokeWidth: 1.8, strokeLinecap: 'round' }));
}

/** Map every coordinate pair of absolute path data (M L C Q Z only) through fn. */
const mapPath = (d, fn) => d.replace(/([MLCQ])([^MLCQZ]*)/g, (all, c, args) => {
  const v = args.match(/-?\d*\.?\d+/g).map(Number), o = [];
  for (let i = 0; i < v.length; i += 2) o.push(P(...fn(v[i], v[i + 1])));
  return c + o.join(' ');
});
/** Closed smooth blob around (cx, cy). */
function blob(cx, cy, rx, ry, rnd, k = 9) {
  const pts = [];
  for (let i = 0; i < k; i++) { const a = (i / k) * 2 * Math.PI, f = 0.8 + rnd() * 0.4; pts.push([cx + rx * f * Math.cos(a), cy + ry * f * Math.sin(a)]); }
  let d = `M${P((pts[k - 1][0] + pts[0][0]) / 2, (pts[k - 1][1] + pts[0][1]) / 2)}`;
  for (let i = 0; i < k; i++) { const p = pts[i], q = pts[(i + 1) % k]; d += `Q${P(...p, (p[0] + q[0]) / 2, (p[1] + q[1]) / 2)}`; }
  return `${d}Z`;
}

const KOI_DEFS = [];
/**
 * Koi seen from above, head toward +x before rotating by `ang`; the body bends by `bend` (-1..1) toward the
 * tail. colors = [body, patches, fins]. Its patches are clipped to its own body outline.
 */
function koi(id, x, y, len, ang, bend, colors, seed = 3) {
  const s = len / 230, rnd = rng(seed);
  const B = (u, v) => { const t = Math.max(0, (80 - u) / 210); return [u, v + bend * t * t * 70]; };
  const body = mapPath('M96 0C96 -18 84 -30 60 -32C24 -35 -14 -26 -50 -13C-66 -7 -78 -3 -86 0C-78 3 -66 7 -50 13C-14 26 24 35 60 32C84 30 96 18 96 0Z', B);
  const tail = mapPath('M-80 0C-92 -10 -100 -28 -128 -42C-118 -30 -116 -18 -120 -8C-114 -4 -114 4 -120 8C-116 18 -118 30 -128 42C-100 28 -92 10 -80 0Z', B);
  const fins = mapPath('M48 24C54 40 46 58 26 64C16 58 20 40 32 28ZM48 -24C54 -40 46 -58 26 -64C16 -58 20 -40 32 -28Z'
    + 'M-26 15C-26 28 -34 36 -46 38C-46 30 -42 22 -36 14ZM-26 -15C-26 -28 -34 -36 -46 -38C-46 -30 -42 -22 -36 -14Z', B);
  const rays = mapPath('M-84 0L-124 -34M-84 0L-118 -14M-84 0L-118 14M-84 0L-124 34M40 30L28 56M44 30L40 58M40 -30L28 -56M44 -30L40 -58', B);
  const spots = mapPath(blob(70, -2, 24, 20, rnd) + blob(6, 4, 34, 22, rnd) + blob(-52, -4, 16, 10, rnd), B);
  const spine = mapPath('M50 0C20 0 -20 0 -70 0', B);
  KOI_DEFS.push(`<clipPath id="koiClip-${id}"><path d="${toRel(body)}"/></clipPath>`);
  return g({ transform: `translate(${n(x)} ${n(y)}) rotate(${ang}) scale(${n(s * 100) / 100})` },
    path(body, { fill: '#3a4a52', fillOpacity: 0.16, transform: 'translate(6 9)' }),
    path(tail + fins, { fill: colors[2], fillOpacity: 0.78, stroke: INK, strokeOpacity: 0.55, strokeWidth: 1.3, strokeLinejoin: 'round' }),
    path(rays, { fill: 'none', stroke: INK, strokeOpacity: 0.22, strokeWidth: 1.1, strokeLinecap: 'round' }),
    path(body, { fill: colors[0] }),
    g({ clipPath: `url(#koiClip-${id})` }, path(spots, { fill: colors[1] }), path(spine, { fill: 'none', stroke: '#fff', strokeOpacity: 0.35, strokeWidth: 10, strokeLinecap: 'round' })),
    path(body, { fill: 'none', stroke: INK, strokeWidth: 1.7 }),
    path(circle(78, -13, 3.4) + circle(78, 13, 3.4), { fill: INK }),
    path('M95 -6C104 -10 108 -18 106 -24M95 6C104 10 108 18 106 24', { fill: 'none', stroke: INK, strokeWidth: 1.2, strokeLinecap: 'round' }));
}

/** Stylised wave crests (indigo mounds with concentric foam lines) rising from the bottom of the painting. */
function waves(x0, yb, dir) {
  let d = '', foam = '';
  const crest = (cx, cy, r) => {
    d += `M${P(cx - r, yb)}V${n(cy)}A${P(r, r)} 0 0 1 ${P(cx + r, cy)}V${n(yb)}Z`;
    for (const k of [0.78, 0.56, 0.34]) foam += `M${P(cx - r * k, cy + 2)}A${P(r * k, r * k)} 0 0 1 ${P(cx + r * k, cy + 2)}`;
  };
  const list = [[0, 34, 34], [52, 52, 30], [100, 30, 36], [26, 6, 26], [78, 12, 24]];
  for (const [ox, oy, r] of list) crest(x0 + dir * ox, yb - oy, r);
  return path(d, { fill: '#2b3f6b', stroke: '#f2e8d2', strokeWidth: 2.2 }) + path(foam, { fill: 'none', stroke: '#f2e8d2', strokeOpacity: 0.85, strokeWidth: 1.8 });
}

/** A red seal of abstract strokes (no characters). */
function seal(x, y, s) {
  const strokes = `M${P(x + s * 0.2, y + s * 0.22)}H${n(x + s * 0.8)}M${P(x + s * 0.5, y + s * 0.22)}V${n(y + s * 0.8)}M${P(x + s * 0.24, y + s * 0.52)}H${n(x + s * 0.42)}`
    + `M${P(x + s * 0.62, y + s * 0.46)}L${P(x + s * 0.8, y + s * 0.62)}M${P(x + s * 0.22, y + s * 0.78)}H${n(x + s * 0.4)}V${n(y + s * 0.66)}M${P(x + s * 0.62, y + s * 0.8)}H${n(x + s * 0.8)}`;
  return path(L.rr(x, y, s, s, s * 0.06), { fill: '#c42a22', fillOpacity: 0.9 })
    + path(L.rr(x + s * 0.08, y + s * 0.08, s * 0.84, s * 0.84, s * 0.03), { fill: 'none', stroke: PAPER, strokeOpacity: 0.85, strokeWidth: n(s * 0.04) })
    + path(strokes, { fill: 'none', stroke: PAPER, strokeOpacity: 0.9, strokeWidth: n(s * 0.07), strokeLinecap: 'square' });
}

/** Short straight plum shoots along the main branch, each tipped with a bud or a blossom. */
function spurs() {
  const list = [[282, 462, -72, 42, 'b'], [404, 452, -104, 36, 'f'], [522, 452, 78, 30, 'b'], [652, 430, -62, 40, 'f'], [784, 434, 72, 30, 'b'],
    [902, 424, -84, 32, 'f'], [252, 476, 104, 28, 'f'], [474, 455, -52, 28, 'b'], [612, 428, 96, 26, 'f'], [960, 424, -40, 26, 'b']];
  return list.map(([x, y, a, l, kind], i) => {
    const r = (a * Math.PI) / 180, tx = x + Math.cos(r) * l, ty = y + Math.sin(r) * l;
    return branch([[x, y], [x + Math.cos(r) * l * 0.5 + 2, y + Math.sin(r) * l * 0.5], [tx, ty]], 5.5, 1.6, 20 + i)
      + (kind === 'f' ? blossom(tx, ty, 12, i * 23) : bud(tx, ty, 4.6));
  }).join('');
}

function painting() {
  const { x0, x1, y0, y1 } = PA, rnd = rng(9);
  // misty ink hills behind the branch
  const hills = `M${P(x0, 470)}C${P(240, 420, 300, 380, 380, 400)}C${P(450, 420, 520, 360, 610, 372)}C${P(700, 386, 760, 420, 840, 400)}C${P(920, 382, 980, 412, x1, 404)}V${n(520)}H${n(x0)}Z`;
  const hills2 = `M${P(x0, 500)}C${P(260, 470, 340, 452, 450, 466)}C${P(560, 480, 640, 440, 760, 452)}C${P(860, 462, 940, 480, x1, 470)}V${n(520)}H${n(x0)}Z`;
  let ripples = '';
  for (const [cx, cy, rx] of [[560, 1150, 150], [600, 1160, 220], [320, 1210, 90], [880, 1200, 70], [260, 1112, 60]]) ripples += `M${P(cx - rx, cy)}Q${P(cx, cy + rx * 0.14, cx + rx, cy)}`;
  const pad = (cx, cy, r, a) => ellipse(cx, cy, r, r * 0.42);
  const padNotch = (cx, cy, r, a) => `M${P(cx, cy)}L${P(cx + r * Math.cos((a * Math.PI) / 180), cy + r * 0.42 * Math.sin((a * Math.PI) / 180))}`;
  const pads = pad(450, 1104, 34, -60) + pad(840, 1238, 30, 200) + pad(905, 1112, 24, 120) + pad(250, 1158, 22, 30);
  let petals = '';
  for (const [px, py, r] of [[300, 1130, 5], [760, 1236, 4], [420, 1100, 4], [990, 1120, 4.5], [118 + 120, 760, 4], [1000, 640, 4]]) petals += ellipse(px, py, r, r * 0.7);
  const mainB = [[x0 - 6, 506], [230, 478], [330, 448], [460, 458], [590, 424], [710, 444], [830, 418], [930, 428], [985, 420]];
  return g({},
    path(rect(x0, y0, x1 - x0, y1 - y0), { fill: 'url(#silk)' }),
    path(rect(x0, y0, x1 - x0, y1 - y0), { fill: 'url(#age)' }),
    path(hills, { fill: 'url(#hillG)' }), path(hills2, { fill: 'url(#hillG2)' }),
    path(ellipse(560, 500, 420, 40), { fill: 'url(#mist)' }),
    // the plum tree
    branch([[x0 - 6, 506], [230, 478], [330, 448], [460, 458], [590, 424], [710, 444], [830, 418], [930, 428], [985, 420]], 38, 4, 4),
    branch([[330, 450], [356, 404], [404, 372], [430, 338]], 11, 3, 7),
    branch([[590, 426], [612, 386], [660, 360], [706, 352]], 9, 2.5, 8),
    branch([[214, 482], [196, 540], [206, 610], [186, 690], [196, 760]], 12, 3, 9),
    branch([[930, 428], [968, 470], [990, 540], [982, 600]], 8, 2.5, 10),
    branch([[460, 458], [500, 486], [540, 494]], 6, 2, 11),
    spurs(),
    [[300, 446, 15, 10], [356, 418, 13, 30], [404, 372, 14, 4], [432, 340, 11, 50], [470, 446, 12, 20], [520, 488, 11, 0],
      [560, 430, 15, 14], [620, 392, 13, 40], [664, 360, 12, 18], [706, 350, 10, 0], [760, 436, 11, 22], [870, 420, 14, 6], [930, 420, 11, 30],
      [208, 520, 13, 12], [198, 588, 12, 28], [204, 650, 11, 8], [190, 712, 10, 40], [974, 486, 12, 16], [990, 548, 10, 0], [250, 474, 12, 50]]
      .map(([x, y, r, rot]) => blossom(x, y, r, rot)).join(''),
    [[386, 392, 4.5], [446, 330, 4], [640, 376, 4], [690, 346, 4], [900, 414, 5], [188, 742, 4.5], [986, 578, 4], [540, 498, 4], [800, 420, 4]]
      .map(([x, y, r]) => bud(x, y, r)).join(''),
    bird(752, 420, 1.12, ['#5b7aa6', '#e8a45e', '#3f5d86']), bird(846, 400, 0.96, ['#8a9e52', '#f2e6c4', '#6c8040'], -1),
    // water: ripples, a red-and-white koi and a dark companion
    path(pads, { fill: '#6f8a5a', fillOpacity: 0.5 }),
    path(padNotch(450, 1104, 34, -60) + padNotch(840, 1238, 30, 200) + padNotch(905, 1112, 24, 120) + padNotch(250, 1158, 22, 30), { stroke: PAPER, strokeWidth: 2.4 }),
    path(ripples, { fill: 'none', stroke: '#5f7680', strokeOpacity: 0.45, strokeWidth: 2.2, strokeLinecap: 'round' }),
    koi('a', 690, 1150, 260, -10, 0.2, ['#fbf6ee', '#e0452a', '#fdf9f2'], 3),
    koi('b', 372, 1120, 150, 196, -0.4, ['#3a3a3c', '#d9a63e', '#5a5a5e'], 5),
    waves(PA.x0 + 34, PA.y1, 1), waves(PA.x1 - 34, PA.y1, -1),
    path(petals, { fill: '#d8262b', fillOpacity: 0.85 }),
    seal(974, 1092, 46), seal(986, 1150, 22),
    // the calm surround: a fine ink line and the screen's shadow on the silk
    path(L.rr(hole.x - 10, hole.y - 10, hole.w + 20, hole.h + 20, radius + 10), { fill: 'none', stroke: INK, strokeOpacity: 0.55, strokeWidth: 1.6 }),
    L.lip(L.rr(hole.x, hole.y, hole.w, hole.h, radius), '#3a2a18', [[5, 0.22], [2, 0.5]]));
}

// ---- the mounting ---------------------------------------------------------------------------------------
function mount() {
  const { x0, x1 } = M, fw = 54;
  const futai = [M.x0 + (M.x1 - M.x0) * 0.32, M.x0 + (M.x1 - M.x0) * 0.68].map((fx) => fx - fw / 2);
  return g({},
    // heaven and earth silk, indigo brocade border, gold bands
    path(rect(x0, Y.ten, x1 - x0, Y.chu - Y.ten), { fill: 'url(#tenG)' }),
    path(rect(x0, Y.chi, x1 - x0, Y.roll - Y.chi), { fill: 'url(#tenG)' }),
    path(rect(x0, Y.ten, x1 - x0, Y.chu - Y.ten) + rect(x0, Y.chi, x1 - x0, Y.roll - Y.chi), { fill: 'url(#weave)' }),
    path(rect(x0, Y.chu, x1 - x0, Y.chi - Y.chu), { fill: '#24304f' }),
    path(rect(x0, Y.chu, x1 - x0, Y.chi - Y.chu), { fill: 'url(#brocade)' }),
    path(rect(PA.x0, Y.ichi, PA.x1 - PA.x0, PA.y0 - Y.ichi) + rect(PA.x0, Y.ichiB, PA.x1 - PA.x0, Y.chuB - Y.ichiB), { fill: 'url(#goldB)' }),
    path(rect(PA.x0, Y.ichi, PA.x1 - PA.x0, PA.y0 - Y.ichi) + rect(PA.x0, Y.ichiB, PA.x1 - PA.x0, Y.chuB - Y.ichiB), { fill: 'url(#goldWeave)' }),
    path(`M${P(PA.x0, Y.ichi)}H${n(PA.x1)}M${P(PA.x0, PA.y0)}H${n(PA.x1)}M${P(PA.x0, Y.ichiB)}H${n(PA.x1)}M${P(PA.x0, Y.chuB)}H${n(PA.x1)}`, { stroke: '#5a4520', strokeOpacity: 0.6, strokeWidth: 1.4 }),
    path(rect(PA.x0, PA.y0, PA.x1 - PA.x0, PA.y1 - PA.y0), { fill: 'none', stroke: '#1a1f30', strokeOpacity: 0.5, strokeWidth: 2 }),
    // seams between the fabrics
    path(`M${P(x0, Y.chu)}H${n(x1)}M${P(x0, Y.chi)}H${n(x1)}`, { stroke: '#000', strokeOpacity: 0.25, strokeWidth: 2 }),
    // the two hanging strips (futai) with little dew tassels
    futai.map((fx) => path(rect(fx, Y.ten, fw, Y.chu - Y.ten - 6), { fill: '#24304f' }) + path(rect(fx, Y.ten, fw, Y.chu - Y.ten - 6), { fill: 'url(#brocade)' })
      + path(rect(fx + 5, Y.ten, 3, Y.chu - Y.ten - 6) + rect(fx + fw - 8, Y.ten, 3, Y.chu - Y.ten - 6), { fill: '#d9b968', fillOpacity: 0.85 })
      + path(rect(fx + 2, Y.chu - 12, fw, 8), { fill: '#000', fillOpacity: 0.18 })
      + path(circle(fx + 4, Y.chu - 6, 3) + circle(fx + fw - 4, Y.chu - 6, 3), { fill: '#f4efe4' })).join(''),
    // soft fold shading down the long sides
    path(rect(x0, Y.ten, 26, Y.roll - Y.ten), { fill: 'url(#foldL)' }),
    path(rect(x1 - 30, Y.ten, 30, Y.roll - Y.ten), { fill: 'url(#foldR)' }));
}

function rods() {
  const { x0, x1 } = M;
  const knob = (x, dir) => {
    const kx = dir < 0 ? x - 48 : x;
    return path(L.rr(kx, Y.roll - 8, 48, 48, 14), { fill: 'url(#knob)', stroke: '#1a0e08', strokeWidth: 1.6 })
      + path(rect(dir < 0 ? x - 10 : x + 2, Y.roll - 8, 8, 48), { fill: 'url(#brass)', stroke: '#1a0e08', strokeWidth: 1.2 })
      + path(`M${P(kx + 8, Y.roll + 2)}H${n(kx + 40)}`, { stroke: '#fff', strokeOpacity: 0.35, strokeWidth: 3, strokeLinecap: 'round' });
  };
  // the hanging cord: two rings on the rod, a plaited loop and a wrapped knot
  const rl = CX - 210, rr = CX + 210, cord = `M${P(rl, Y.rod + 2)}C${P(rl + 60, 40, CX - 70, 16, CX, 12)}C${P(CX + 70, 16, rr - 60, 40, rr, Y.rod + 2)}`;
  return g({},
    path(rect(x0 + 6, Y.rod + 30, x1 - x0, 12), { fill: '#000', fillOpacity: 0.2 }),
    path(cord, { fill: 'none', stroke: '#2a1420', strokeWidth: 8, strokeLinecap: 'round' }),
    path(cord, { fill: 'none', stroke: '#7a3a5c', strokeWidth: 5.5, strokeLinecap: 'round' }),
    path(cord, { fill: 'none', stroke: '#c98aa8', strokeOpacity: 0.7, strokeWidth: 2, strokeDasharray: '3 4', strokeLinecap: 'round' }),
    path(ellipse(CX, 13, 9, 6), { fill: '#7a3a5c', stroke: '#2a1420', strokeWidth: 1.6 }),
    [rl, rr].map((x) => path(circle(x, Y.rod - 4, 9), { fill: 'none', stroke: '#3a2a10', strokeWidth: 5 }) + path(circle(x, Y.rod - 4, 9), { fill: 'none', stroke: 'url(#brass)', strokeWidth: 3 })).join(''),
    // top rod (fabric-wrapped half round)
    path(L.rr(x0 - 4, Y.rod, x1 - x0 + 8, Y.ten - Y.rod + 4, 6), { fill: 'url(#rod)', stroke: '#1a0e08', strokeWidth: 1.6 }),
    path(`M${P(x0 + 4, Y.rod + 5)}H${n(x1 - 4)}`, { stroke: '#fff', strokeOpacity: 0.3, strokeWidth: 2.5 }),
    // bottom roller wrapped in the earth silk, its shadow, and the knobs
    path(L.rr(x0 + 10, Y.roll + 34, x1 - x0, 14, 7), { fill: '#000', fillOpacity: 0.25 }),
    path(L.rr(x0 - 2, Y.roll - 4, x1 - x0 + 4, 44, 18), { fill: 'url(#roller)', stroke: '#1a0e08', strokeWidth: 1.6 }),
    path(`M${P(x0 + 8, Y.roll + 4)}H${n(x1 - 8)}`, { stroke: '#fff', strokeOpacity: 0.28, strokeWidth: 3, strokeLinecap: 'round' }),
    knob(x0 - 2, -1), knob(x1 + 2, 1));
}

function draw() {
  const flower5 = (x, y, r) => { let d = ''; for (let i = 0; i < 5; i++) { const a = (i * 72 - 90) * Math.PI / 180; d += circle(x + Math.cos(a) * r * 0.55, y + Math.sin(a) * r * 0.55, r * 0.45); } return d; };
  const defs = [
    lg('hillG', [0, 0, 0, 1], [[0, '#8d8a84', 0.2], [0.7, '#8d8a84', 0.08], [1, '#8d8a84', 0]]),
    lg('hillG2', [0, 0, 0, 1], [[0, '#6f6c66', 0.18], [0.75, '#6f6c66', 0.05], [1, '#6f6c66', 0]]),
    lg('silk', [0, 0, 0, 1], [[0, '#f4ebd6'], [0.5, '#f1e6cd'], [1, '#e9dbbd']]),
    rg('age', [0.5, 0.5, 0.75], [[0.6, '#b08a50', 0], [1, '#b08a50', 0.2]]),
    rg('mist', [0.5, 0.5, 0.5], [[0, '#fbf6ea', 0.7], [1, '#fbf6ea', 0]]),
    lg('ink', [0, 0, 1, 1], [[0, '#4a4542'], [0.5, '#1d1b1a'], [1, '#2e2a28']]),
    rg('plum', [0.45, 0.4, 0.7], [[0, '#f0606a'], [0.6, '#d7262c'], [1, '#a5131a']]),
    lg('tenG', [0, 0, 1, 0], [[0, '#97a596'], [0.5, '#aebbab'], [1, '#8d9b8c']]),
    lg('goldB', [0, 0, 0, 1], [[0, '#e9cd7c'], [0.5, '#c9a24a'], [1, '#9c7a2e']]),
    lg('foldL', [0, 0, 1, 0], [[0, '#000', 0.22], [1, '#000', 0]]),
    lg('foldR', [0, 0, 1, 0], [[0, '#000', 0], [1, '#000', 0.26]]),
    lg('rod', [0, 0, 0, 1], [[0, '#6b4a34'], [0.4, '#4a2f1e'], [1, '#24150c']]),
    lg('roller', [0, 0, 0, 1], [[0, '#a3b0a1'], [0.35, '#8d9b8c'], [1, '#56604f']]),
    lg('knob', [0, 0, 0, 1], [[0, '#7a5238'], [0.35, '#4f3020'], [1, '#22130a']]),
    lg('brass', [0, 0, 0, 1], [[0, '#f6dd94'], [0.5, '#c9a24a'], [1, '#7a5a1e']]),
    `<pattern id="brocade" width="40" height="40" patternUnits="userSpaceOnUse" patternTransform="translate(${M.x0} ${Y.chu})">`
      + path(flower5(10, 10, 7) + flower5(30, 30, 7), { fill: '#d9b968', fillOpacity: 0.8 })
      + path(circle(10, 10, 1.6) + circle(30, 30, 1.6), { fill: '#24304f' })
      + path('M24 8Q28 4 32 8Q28 12 24 8ZM4 28Q8 24 12 28Q8 32 4 28Z', { fill: '#7d93b8', fillOpacity: 0.7 }) + '</pattern>',
    `<pattern id="weave" width="6" height="6" patternUnits="userSpaceOnUse">${path('M0 0H6M0 3H6', { stroke: '#fff', strokeOpacity: 0.07, strokeWidth: 1 })}</pattern>`,
    `<pattern id="goldWeave" width="12" height="12" patternUnits="userSpaceOnUse">${path('M0 6L6 0L12 6L6 12Z', { fill: 'none', stroke: '#7a5a1e', strokeOpacity: 0.35, strokeWidth: 1 })}${path(circle(6, 6, 1.2), { fill: '#fff4c4', fillOpacity: 0.6 })}</pattern>`,
  ].join('');
  KOI_DEFS.length = 0;
  const body = [
    // soft shadow of the scroll on the wall
    path(L.rr(M.x0 + 8, Y.rod + 14, M.x1 - M.x0, Y.roll - Y.rod + 30, 8), { fill: '#000', fillOpacity: 0.16 }),
    mount(),
    painting(),
    rods(),
  ].join('\n');
  return { defs: defs + KOI_DEFS.join(''), body };
}

module.exports = {
  W, H, hole, radius, draw,
  meta: {
    name: 'Hanging Scroll', theme: 'japanese ink painting', rarity: 'epic', translucent: false, collection: 'old-masters', license: 'CC-BY-4.0',
    desc: 'A silk hanging scroll where plum blossoms, two little birds and a lazy koi share the painting with your game.',
    tags: ['japanese', 'scroll', 'ink', 'plum blossom', 'koi', 'birds', 'calm'],
  },
};
