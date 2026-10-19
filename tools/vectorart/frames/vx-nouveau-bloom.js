'use strict';
// Nouveau Bloom: an 1890s Art Nouveau poster panel. A cream arch edged with a double band of mosaic tesserae
// and gold lines; a great mosaic halo rises behind the top of the screen; green whiplash stems climb both
// sides, coil into the spandrels and carry orange and yellow ring-petalled flowers and pointed leaves; a
// deep green plinth below holds a mosaic roundel between gold whiplash scrolls; a gold finial crowns the arch.
const L = require('../lib');
const { g, lg, rg } = L;

const DY = 40; // everything below the finial sits this far down
const W = 1400, H = 1400, hole = { x: 260, y: 430 + DY, w: 880, h: 660 }, radius = 18;
const CX = W / 2;
const PANEL = { x0: 40, x1: 1360, spring: 340 + DY, rx: 660, ry: 300, bottom: 1340 + DY };
const HALO = { cx: 700, cy: 450 + DY, r: 352 };
const PLINTH = { y0: 1150 + DY, y1: 1340 + DY };
const INK = '#4a3218';
const GOLD = '#d4a94c', GOLD_HI = '#f6e2a0';
const CREAM = '#f4e8c8';

// ---- compact path output --------------------------------------------------------------------------------
const n = (v) => Math.round(v * 10) / 10;
const P = (...a) => a.map(n).join(' ');
const poly = (pts, close = true) => `M${pts.map((p) => P(...p)).join('L')}${close ? 'Z' : ''}`;
const circle = (cx, cy, r) => `M${P(cx - r, cy)}A${P(r, r)} 0 1 0 ${P(cx + r, cy)}A${P(r, r)} 0 1 0 ${P(cx - r, cy)}Z`;
const ellipse = (cx, cy, rx, ry) => `M${P(cx - rx, cy)}A${P(rx, ry)} 0 1 0 ${P(cx + rx, cy)}A${P(rx, ry)} 0 1 0 ${P(cx - rx, cy)}Z`;
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
const rr = L.rr;
const mirrorAt = (x0, ...kids) => g({ transform: `translate(${n(2 * x0)} 0) scale(-1 1)` }, ...kids);

// ---- geometry helpers ---------------------------------------------------------------------------------
/** The panel outline (arch + sides + bottom) inset by d. */
function panelD(d, bottom = PANEL.bottom - d) {
  const { x0, x1, spring, rx, ry } = PANEL;
  return `M${P(x0 + d, bottom)}V${n(spring)}A${P(rx - d, ry - d)} 0 0 1 ${P(x1 - d, spring)}V${n(bottom)}Z`;
}
/** The open arch line (no bottom) inset by d, from y0 on the left up and over to y0 on the right. */
function archLine(d, y0) {
  const { x0, x1, spring, rx, ry } = PANEL;
  return `M${P(x0 + d, y0)}V${n(spring)}A${P(rx - d, ry - d)} 0 0 1 ${P(x1 - d, spring)}V${n(y0)}`;
}

/** Dense points on a Catmull-Rom spline through the control points. */
function spline(ctrl, per = 10) {
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

/** Whiplash stem: a tapering green band along a spline that ends in a coil (dir 1 = clockwise on screen). */
function vine(ctrl, w0, w1, coil = 0, R0 = 20) {
  const pts = spline(ctrl, 9);
  if (coil) {
    const [x, y] = pts[pts.length - 1], [px, py] = pts[pts.length - 2], a = Math.atan2(y - py, x - px);
    const cx = x - coil * Math.sin(a) * R0, cy = y + coil * Math.cos(a) * R0; // centre on the turning side
    const a0 = Math.atan2(y - cy, x - cx);
    for (let j = 1; j <= 16; j++) { const t = j / 16, r = R0 * (1 - 0.72 * t), th = a0 + coil * t * Math.PI * 1.7; pts.push([cx + r * Math.cos(th), cy + r * Math.sin(th)]); }
  }
  const N = pts.length, left = [], right = [];
  for (let i = 0; i < N; i++) {
    const a = pts[Math.max(0, i - 1)], b = pts[Math.min(N - 1, i + 1)], dx = b[0] - a[0], dy = b[1] - a[1], l = Math.hypot(dx, dy) || 1;
    const w = (w0 + (w1 - w0) * (i / (N - 1))) / 2;
    left.push([pts[i][0] - (dy / l) * w, pts[i][1] + (dx / l) * w]); right.unshift([pts[i][0] + (dy / l) * w, pts[i][1] - (dx / l) * w]);
  }
  const body = poly([...left, ...right]), [ex, ey] = pts[N - 1];
  const hi = smooth(pts.slice(1, Math.floor(N * 0.85)).filter((_, i) => i % 2 === 0));
  return path(body, { fill: '#26381c', fillOpacity: 0.3, transform: 'translate(3 4)' })
    + path(body, { fill: 'url(#stem)', stroke: INK, strokeWidth: 2.2, strokeLinejoin: 'round' })
    + path(hi, { fill: 'none', stroke: '#c9e08a', strokeOpacity: 0.55, strokeWidth: Math.max(1.2, w0 * 0.16), strokeLinecap: 'round', transform: 'translate(-1.2 -1.2)' })
    + path(circle(ex, ey, Math.max(2.5, w1 * 0.7)), { fill: '#3f5e2e', stroke: INK, strokeWidth: 1.6 });
}

/** Pointed leaf from (x, y) toward angle `ang` (degrees), length l, half-width w, bent by `bend` (-1..1). */
function leaf(x, y, ang, l, w, bend = 0.25) {
  const a = (ang * Math.PI) / 180, c = Math.cos(a), s = Math.sin(a);
  const T = (u, v) => [x + u * c - v * s, y + u * s + v * c];
  const b = bend * l * 0.25, tip = T(l, b * 1.6);
  const top = `M${P(x, y)}C${P(...T(l * 0.25, -w * 1.3 + b * 0.4))} ${P(...T(l * 0.7, -w * 0.9 + b))} ${P(...tip)}`;
  const bot = `C${P(...T(l * 0.72, w * 0.8 + b))} ${P(...T(l * 0.3, w * 1.2 + b * 0.4))} ${P(x, y)}Z`;
  const vein = `M${P(...T(l * 0.06, 0))}Q${P(...T(l * 0.5, b * 0.9))} ${P(...T(l * 0.9, b * 1.45))}`;
  const half = `M${P(x, y)}Q${P(...T(l * 0.5, b * 0.9))} ${P(...tip)}${bot}`;
  let ribs = '';
  for (const t of [0.28, 0.48, 0.68]) ribs += `M${P(...T(l * t, b * t * 1.6))}Q${P(...T(l * (t + 0.08), -w * 0.4 + b * t))} ${P(...T(l * (t + 0.16), -w * 0.62 + b * (t + 0.1)))}`;
  return path(top + bot, { fill: '#26381c', fillOpacity: 0.28, transform: 'translate(3 4)' })
    + path(top + bot, { fill: 'url(#leafG)', stroke: INK, strokeWidth: 2, strokeLinejoin: 'round' })
    + path(half, { fill: '#1f3317', fillOpacity: 0.28 })
    + path(vein + ribs, { fill: 'none', stroke: '#e3f0a8', strokeOpacity: 0.6, strokeWidth: 1.5, strokeLinecap: 'round' });
}

/** Ring-petalled flower: rounded petals in two or three rings and a seeded centre. pal: [outer, mid, inner]. */
function flower(cx, cy, r, pal = 'o', rot = 0) {
  const rings = pal === 'o' ? [['petO', 11, 1], ['petY', 11, 0.7], ['petL', 9, 0.44]] : pal === 'y' ? [['petY', 10, 1], ['petL', 10, 0.68], ['petO', 8, 0.42]] : [['petR', 9, 1], ['petO', 9, 0.66]];
  let out = '';
  rings.forEach(([fill, cnt, k], ri) => {
    const R = r * k, pw = (Math.PI * R) / cnt * 0.98;
    let d = '', crease = '';
    for (let i = 0; i < cnt; i++) {
      const a = ((rot + (i + ri * 0.5) * (360 / cnt)) * Math.PI) / 180, c = Math.cos(a), s = Math.sin(a);
      const T = (u, v) => P(cx + u * c - v * s, cy + u * s + v * c);
      d += `M${T(R * 0.3, 0)}C${T(R * 0.36, -pw * 0.7)} ${T(R * 1.0, -pw * 0.85)} ${T(R, 0)}C${T(R * 1.0, pw * 0.85)} ${T(R * 0.36, pw * 0.7)} ${T(R * 0.3, 0)}Z`;
      crease += `M${T(R * 0.5, 0)}L${T(R * 0.82, 0)}`;
    }
    if (!ri) out += path(d, { fill: '#3a2a10', fillOpacity: 0.26, transform: 'translate(3 5)' });
    out += path(d, { fill: `url(#${fill})`, stroke: INK, strokeWidth: n(Math.max(1.4, r * 0.03)), strokeLinejoin: 'round' })
      + path(crease, { fill: 'none', stroke: INK, strokeOpacity: 0.3, strokeWidth: n(Math.max(1, r * 0.022)), strokeLinecap: 'round' });
  });
  const rc = r * 0.22;
  let seeds = '';
  for (let i = 0; i < 9; i++) { const a = i * 2.4, rad = rc * 0.62 * Math.sqrt((i + 0.5) / 9); seeds += circle(cx + rad * Math.cos(a), cy + rad * Math.sin(a), rc * 0.13); }
  return out + path(circle(cx, cy, rc), { fill: 'url(#seedG)', stroke: INK, strokeWidth: n(Math.max(1.4, r * 0.03)) })
    + path(seeds, { fill: '#f4d36a', fillOpacity: 0.85 });
}

/** Tesserae along a path: grout band, base tiles, alternate tiles of a second colour. */
function tiles(d, width, tile, gap, c1, c2, grout = '#5a4426') {
  const per = tile + gap;
  return path(d, { fill: 'none', stroke: grout, strokeWidth: width + 3 })
    + path(d, { fill: 'none', stroke: c1, strokeWidth: width, strokeDasharray: `${tile} ${gap}` })
    + path(d, { fill: 'none', stroke: c2, strokeWidth: width, strokeDasharray: `${tile} ${per * 2 - tile}`, strokeDashoffset: -per })
    + path(d, { fill: 'none', stroke: '#fff', strokeOpacity: 0.32, strokeWidth: n(width * 0.22), strokeDasharray: `${tile} ${gap}`, transform: `translate(-${n(width * 0.12)} -${n(width * 0.12)})` });
}

/** Gold line with a dark outline and a light core. */
function goldLine(d, w = 6, fill = 'none') {
  return path(d, { fill, stroke: INK, strokeWidth: w + 3, strokeLinejoin: 'round' })
    + path(d, { fill: 'none', stroke: GOLD, strokeWidth: w, strokeLinejoin: 'round' })
    + path(d, { fill: 'none', stroke: GOLD_HI, strokeOpacity: 0.8, strokeWidth: n(w * 0.3), strokeLinejoin: 'round', transform: 'translate(-0.6 -0.8)' });
}

// ---- parts --------------------------------------------------------------------------------------------
function halo() {
  const { cx, cy, r } = HALO, ring = (rad) => circle(cx, cy, rad);
  let rays = '';
  for (let i = 0; i < 48; i += 2) {
    const a0 = (i / 48) * 2 * Math.PI, a1 = ((i + 1) / 48) * 2 * Math.PI, R = r - 66;
    rays += `M${P(cx, cy)}L${P(cx + R * Math.cos(a0), cy + R * Math.sin(a0))}A${P(R, R)} 0 0 1 ${P(cx + R * Math.cos(a1), cy + R * Math.sin(a1))}Z`;
  }
  // a scalloped ring just inside the tesserae, and a ring of little four-petal florets (upper half only shows)
  const at = (deg, rad) => [cx + rad * Math.cos((deg * Math.PI) / 180), cy + rad * Math.sin((deg * Math.PI) / 180)];
  let scallops = `M${P(...at(180, r - 67))}A${P(r - 67, r - 67)} 0 0 1 ${P(...at(360, r - 67))}L${P(...at(360, r - 70))}`, florets = '', floretEyes = '';
  for (let i = 35; i >= 0; i--) scallops += `Q${P(...at(180 + i * 5 + 2.5, r - 94))} ${P(...at(180 + i * 5, r - 70))}`;
  scallops += 'Z';
  for (let i = 0; i <= 18; i++) {
    const [x, y] = at(180 + i * 10, r - 195);
    florets += ellipse(x, y - 5, 3, 5) + ellipse(x, y + 5, 3, 5) + ellipse(x - 5, y, 5, 3) + ellipse(x + 5, y, 5, 3);
    floretEyes += circle(x, y, 2.4);
  }
  return g({},
    path(ring(r + 26), { fill: 'url(#haloGlow)' }),
    path(ring(r), { fill: '#5a4426', stroke: INK, strokeWidth: 3 }),
    tiles(ring(r - 12), 16, 11, 3, '#4f9a8f', GOLD),
    path(ring(r - 24), { fill: 'none', stroke: INK, strokeWidth: 2 }),
    path(ring(r - 38), { fill: 'none', stroke: '#c0603a', strokeWidth: 24 }),
    path(ring(r - 38), { fill: 'none', stroke: '#3a2a10', strokeOpacity: 0.3, strokeWidth: 10, strokeDasharray: '0.01 19.7', strokeLinecap: 'round', transform: 'translate(1 1.5)' }),
    path(ring(r - 38), { fill: 'none', stroke: GOLD_HI, strokeWidth: 10, strokeDasharray: '0.01 19.7', strokeLinecap: 'round' }),
    path(ring(r - 38), { fill: 'none', stroke: '#e07a3a', strokeWidth: 4, strokeDasharray: '0.01 19.7', strokeLinecap: 'round' }),
    path(ring(r - 52), { fill: 'none', stroke: INK, strokeWidth: 2 }),
    tiles(ring(r - 60), 12, 8, 3, '#e9c46a', '#f6ead0'),
    path(ring(r - 67), { fill: 'url(#haloIn)', stroke: INK, strokeWidth: 2 }),
    path(rays, { fill: '#e8c877', fillOpacity: 0.45 }),
    path(scallops, { fill: '#f6ead0', stroke: GOLD, strokeWidth: 2.4 }),
    path(florets, { fill: '#e07a3a', stroke: INK, strokeWidth: 1.2 }),
    path(floretEyes, { fill: GOLD_HI }),
    path(ring(r - 120) + ring(r - 170) + ring(r - 220), { fill: 'none', stroke: GOLD, strokeWidth: 3 }),
    path(ring(r - 145), { fill: 'none', stroke: '#4f9a8f', strokeWidth: 8, strokeDasharray: '0.01 16', strokeLinecap: 'round' }),
    path(ring(r - 145), { fill: 'none', stroke: '#fff', strokeOpacity: 0.6, strokeWidth: 3, strokeDasharray: '0.01 16', strokeLinecap: 'round', transform: 'translate(-1.2 -1.2)' }));
}

function border() {
  const outer = panelD(0), b = PLINTH.y0;
  return g({},
    path(archLine(31, b), { fill: 'none', stroke: '#5a4426', strokeWidth: 42 }),
    tiles(archLine(21, b), 14, 11, 3, '#4f9a8f', GOLD),
    tiles(archLine(40, b), 14, 11, 3, '#e07a3a', '#f0c45a'),
    goldLine(archLine(51, b), 5),
    goldLine(outer, 9),
    goldLine(archLine(11, b), 3));
}

function surround() {
  const o = 26, d = rr(hole.x - o, hole.y - o, hole.w + 2 * o, hole.h + 2 * o, radius + o);
  return path(rr(hole.x - o + 3, hole.y - o + 5, hole.w + 2 * o, hole.h + 2 * o, radius + o), { fill: '#3a2a10', fillOpacity: 0.3 })
    + path(d, { fill: 'url(#surround)', stroke: INK, strokeWidth: 3 })
    + path(rr(hole.x - 16, hole.y - 16, hole.w + 32, hole.h + 32, radius + 16), { fill: CREAM, stroke: INK, strokeWidth: 1.6 })
    + goldLine(rr(hole.x - 6, hole.y - 6, hole.w + 12, hole.h + 12, radius + 6), 3.5)
    + L.lip(rr(hole.x, hole.y, hole.w, hole.h, radius), '#2a1a08', [[4, 0.3], [1.8, 0.6]]);
}

/** Closed bud pointing along `ang` from its base (x, y): a petal teardrop held by three green sepals. */
function bud(x, y, ang, s, fill = 'petO') {
  const a = (ang * Math.PI) / 180, c = Math.cos(a), si = Math.sin(a), Lb = s * 2.3;
  const T = (u, v) => P(x + u * c - v * si, y + u * si + v * c);
  const body = `M${T(0, 0)}C${T(Lb * 0.35, -s * 1.1)} ${T(Lb * 0.86, -s * 0.62)} ${T(Lb, 0)}C${T(Lb * 0.86, s * 0.62)} ${T(Lb * 0.35, s * 1.1)} ${T(0, 0)}Z`;
  const fold = `M${T(Lb * 0.2, -s * 0.2)}Q${T(Lb * 0.6, -s * 0.5)} ${T(Lb * 0.97, -s * 0.05)}M${T(Lb * 0.2, s * 0.2)}Q${T(Lb * 0.6, s * 0.5)} ${T(Lb * 0.97, s * 0.05)}`;
  const sep = (k) => `M${T(0, 0)}Q${T(Lb * 0.25, k * s * 0.95)} ${T(Lb * 0.55, k * s * 0.3)}Q${T(Lb * 0.25, k * s * 0.3)} ${T(0, 0)}Z`;
  return path(body, { fill: '#3a2a10', fillOpacity: 0.25, transform: 'translate(2.5 4)' })
    + path(body, { fill: `url(#${fill})`, stroke: INK, strokeWidth: 1.8 })
    + path(fold, { fill: 'none', stroke: INK, strokeOpacity: 0.4, strokeWidth: 1.3, strokeLinecap: 'round' })
    + path(sep(-1) + sep(1) + `M${T(0, 0)}Q${T(Lb * 0.3, -s * 0.2)} ${T(Lb * 0.45, 0)}Q${T(Lb * 0.3, s * 0.2)} ${T(0, 0)}Z`, { fill: 'url(#leafG)', stroke: INK, strokeWidth: 1.5, strokeLinejoin: 'round' });
}

/** Everything on the left half (mirrored for the right); laid out for the panel before it moved down DY. */
function sideArt() {
  return g({ transform: `translate(0 ${DY})` },
    // spandrel tendril, main whiplash and the crossing stem
    vine([[178, 430], [140, 336], [176, 250], [252, 200], [326, 170]], 8, 2.5, 1, 13),
    vine([[150, 1150], [118, 1040], [190, 930], [128, 800], [196, 660], [132, 540], [176, 430], [262, 336], [328, 278], [370, 222]], 19, 4.5, 1, 24),
    vine([[196, 1140], [224, 1030], [144, 900], [104, 770], [158, 640]], 12, 3, -1, 16),
    leaf(128, 1000, -150, 90, 24, -0.4), leaf(190, 930, -96, 98, 24, 0.5), leaf(128, 800, -158, 80, 21, -0.3),
    leaf(196, 660, -78, 88, 23, -0.4), leaf(132, 540, -138, 80, 21, 0.4), leaf(210, 1060, -72, 74, 20, 0.3),
    leaf(262, 336, -40, 74, 18, -0.3), leaf(150, 336, -120, 64, 16, 0.3), leaf(224, 1030, -18, 52, 14, -0.4),
    leaf(104, 770, 160, 60, 16, 0.4), leaf(176, 250, -150, 56, 14, -0.3),
    bud(196, 660, -20, 14, 'petO'), bud(132, 540, -170, 12, 'petY'), bud(158, 640, -60, 11, 'petR'), bud(252, 200, -70, 11, 'petY'),
    flower(160, 760, 50, 'y', 8), flower(172, 410, 58, 'o', 4), flower(282, 244, 26, 'y', 12), flower(402, 162, 21, 'r', 0),
    flower(78, 1060, 40, 'r', 6), flower(246, 1166, 48, 'y', 0), flower(148, 1128, 76, 'o', 0));
}

/** Gold leaf outline used on the plinth scrolls. */
const goldLeaf = (x, y, ang, l, w) => {
  const a = (ang * Math.PI) / 180, c = Math.cos(a), s = Math.sin(a), T = (u, v) => P(x + u * c - v * s, y + u * s + v * c);
  return `M${T(0, 0)}C${T(l * 0.3, -w * 1.2)} ${T(l * 0.75, -w * 0.8)} ${T(l, 0)}C${T(l * 0.75, w * 0.8)} ${T(l * 0.3, w * 1.2)} ${T(0, 0)}Z`;
};

function plinth() {
  const { y0, y1 } = PLINTH, x0 = 24, x1 = W - 24, cy = (y0 + y1) / 2 + 12;
  const curves = (sx) => {
    const a = CX + sx * 96, b = CX + sx * 600;
    return [[[a, cy], [a + sx * 120, cy - 64], [b - sx * 230, cy + 60], [b - sx * 60, cy - 6]], [[a, cy + 12], [a + sx * 140, cy + 68], [b - sx * 270, cy - 46], [b - sx * 160, cy + 26]]];
  };
  const scroll = (sx) => {
    const b = CX + sx * 600, [c1, c2] = curves(sx), C = (q) => `M${P(...q[0])}C${P(...q[1], ...q[2], ...q[3])}`;
    return `${C(c1)}C${P(b - sx * 16, cy - 36, b + sx * 34, cy - 8, b + sx * 8, cy + 14)}C${P(b - sx * 6, cy + 24, b - sx * 26, cy + 14, b - sx * 18, cy + 4)}`
      + `${C(c2)}C${P(b - sx * 124, cy + 48, b - sx * 86, cy + 32, b - sx * 96, cy + 14)}`;
  };
  // gold leaves sprouting from the scrolls, alternating sides
  const bez = (q, t) => [0, 1].map((k) => (1 - t) ** 3 * q[0][k] + 3 * (1 - t) ** 2 * t * q[1][k] + 3 * (1 - t) * t * t * q[2][k] + t ** 3 * q[3][k]);
  const leaves = [-1, 1].flatMap((sx) => curves(sx).flatMap((q, ci) => [0.22, 0.48, 0.74].map((t, i) => {
    const [x, y] = bez(q, t), [x2, y2] = bez(q, t + 0.01), ang = (Math.atan2(y2 - y, x2 - x) * 180) / Math.PI + ((i + ci) % 2 ? 48 : -48);
    return goldLeaf(x, y, ang, 34, 9);
  }))).join('');
  const dots = [-1, 1].flatMap((sx) => [330, 470].map((dx) => [CX + sx * dx, cy - 4 + (dx === 330 ? 0 : 6)]));
  const cornice = rr(x0 - 8, y0 - 12, x1 - x0 + 16, 34, 6), base = rr(x0 - 8, y1 - 14, x1 - x0 + 16, 20, 4);
  return g({},
    path(rr(x0 - 8, y0 - 12, x1 - x0 + 16, y1 - y0 + 18, 6), { fill: '#000', fillOpacity: 0.2, transform: 'translate(5 8)' }),
    path(rr(x0, y0, x1 - x0, y1 - y0, 0), { fill: 'url(#plinth)', stroke: INK, strokeWidth: 3 }),
    path(rr(x0 + 14, y0 + 34, x1 - x0 - 28, y1 - y0 - 58, 10), { fill: 'none', stroke: GOLD, strokeOpacity: 0.7, strokeWidth: 2 }),
    goldLine(scroll(1) + scroll(-1), 4),
    path(leaves, { fill: 'url(#surround)', stroke: INK, strokeWidth: 1.6 }),
    dots.map(([x, y]) => path(circle(x, y, 25), { fill: '#2a3f2c', stroke: INK, strokeWidth: 2 })
      + tiles(circle(x, y, 19), 9, 6, 2.6, '#e07a3a', '#f0c45a') + path(circle(x, y, 10), { fill: 'url(#seedG)', stroke: INK, strokeWidth: 1.6 })
      + path(circle(x - 3, y - 3, 2.5), { fill: '#fff', fillOpacity: 0.6 })).join(''),
    path(base, { fill: 'url(#surround)', stroke: INK, strokeWidth: 2.5 }),
    path(`M${P(x0, y1 - 4)}H${n(x1)}`, { stroke: INK, strokeOpacity: 0.5, strokeWidth: 3, strokeDasharray: '2 14' }),
    path(cornice, { fill: 'url(#surround)', stroke: INK, strokeWidth: 2.5 }),
    tiles(`M${P(x0 + 6, y0 + 5)}H${n(x1 - 6)}`, 12, 11, 3, '#4f9a8f', '#c0603a'),
    path(circle(CX, cy, 86), { fill: '#3a2a10', fillOpacity: 0.3, transform: 'translate(3 5)' }),
    path(circle(CX, cy, 86), { fill: '#5a4426', stroke: INK, strokeWidth: 3 }),
    tiles(circle(CX, cy, 78), 13, 9, 3, '#4f9a8f', GOLD),
    path(circle(CX, cy, 68), { fill: 'url(#haloIn)', stroke: INK, strokeWidth: 2 }),
    flower(CX, cy, 56, 'o', 0));
}

function finial() {
  const cx = CX, cy = 44 + DY;
  let rays = '';
  for (let i = 0; i < 9; i++) {
    const a = Math.PI * (1.12 + (0.76 * i) / 8), c = Math.cos(a), s = Math.sin(a);
    rays += `M${P(cx + 44 * c, cy + 44 * s)}L${P(cx + 58 * c - 5 * s, cy + 58 * s + 5 * c)}L${P(cx + 64 * c, cy + 64 * s)}L${P(cx + 58 * c + 5 * s, cy + 58 * s - 5 * c)}Z`;
  }
  return g({},
    path(rays, { fill: GOLD, stroke: INK, strokeWidth: 1.8, strokeLinejoin: 'round' }),
    path(circle(cx + 2, cy + 4, 38), { fill: '#3a2a10', fillOpacity: 0.3 }),
    path(circle(cx, cy, 38), { fill: '#5a4426', stroke: INK, strokeWidth: 3 }),
    tiles(circle(cx, cy, 31), 11, 7, 2.6, '#4f9a8f', GOLD),
    path(circle(cx, cy, 23), { fill: 'url(#haloIn)', stroke: INK, strokeWidth: 2 }),
    flower(cx, cy, 19, 'y', 0));
}

function draw() {
  const defs = [
    lg('field', [0, 0, 0, 1], [[0, '#f7edd3'], [0.6, '#f1e2bd'], [1, '#e6d09c']]),
    rg('haloGlow', [0.5, 0.5, 0.5], [[0.85, '#fff3c4', 0.35], [1, '#fff3c4', 0]]),
    rg('haloIn', [0.5, 0.5, 0.5], [[0, '#fff8e2'], [0.7, '#f6e6b8'], [1, '#e9cf8a']]),
    lg('stem', [0, 0, 1, 1], [[0, '#8fb35a'], [0.5, '#5f8a3a'], [1, '#3b5a28']]),
    lg('leafG', [0, 0, 1, 1], [[0, '#a9c86a'], [0.5, '#6f9a44'], [1, '#3f6a2e']]),
    rg('petO', [0.5, 0.5, 0.5], [[0.3, '#f6b64a'], [0.75, '#ec7a2c'], [1, '#d4561e']]),
    rg('petY', [0.5, 0.5, 0.5], [[0.3, '#fff0a6'], [0.75, '#f8cc48'], [1, '#e8a22c']]),
    rg('petL', [0.5, 0.5, 0.5], [[0.3, '#fff8d6'], [1, '#fbd86a']]),
    rg('petR', [0.5, 0.5, 0.5], [[0.3, '#f6a05a'], [0.75, '#df5a32'], [1, '#b8401e']]),
    rg('seedG', [0.4, 0.35, 0.7], [[0, '#a3a34a'], [0.6, '#5f6a2a'], [1, '#3a3e18']]),
    lg('surround', [0, 0, 1, 1], [[0, '#f6e2a0'], [0.4, '#d9b257'], [1, '#a87a2c']]),
    lg('plinth', [0, 0, 0, 1], [[0, '#3c5a3e'], [1, '#22372a']]),
    rg('vign', [0.5, 0.42, 0.72], [[0.55, '#b98f4a', 0], [1, '#b98f4a', 0.28]]),
    `<pattern id="paper" width="36" height="36" patternUnits="userSpaceOnUse">${path(`${ellipse(18, 13, 2, 4)}${ellipse(18, 23, 2, 4)}${ellipse(13, 18, 4, 2)}${ellipse(23, 18, 4, 2)}`, { fill: '#b8955a', fillOpacity: 0.16 })}${path(circle(0, 0, 1.4) + circle(36, 0, 1.4) + circle(0, 36, 1.4) + circle(36, 36, 1.4), { fill: '#b8955a', fillOpacity: 0.22 })}</pattern>`,
  ].join('');
  const art = sideArt();
  const body = [
    path(panelD(-6), { fill: '#000', fillOpacity: 0.12, transform: 'translate(6 10)' }),
    path(panelD(0), { fill: 'url(#field)' }),
    path(panelD(0), { fill: 'url(#paper)' }),
    path(panelD(0), { fill: 'url(#vign)' }),
    halo(),
    border(),
    plinth(),
    surround(),
    art, mirrorAt(CX, art),
    finial(),
    [[PANEL.x0, PANEL.spring], [PANEL.x1, PANEL.spring]].map(([x, y]) => path(circle(x, y, 17), { fill: 'url(#surround)', stroke: INK, strokeWidth: 2.5 })
      + path(circle(x, y, 7), { fill: '#4f9a8f', stroke: INK, strokeWidth: 1.6 })).join(''),
  ].join('\n');
  return { defs, body };
}

module.exports = {
  W, H, hole, radius, draw,
  meta: {
    name: 'Nouveau Bloom', theme: 'art nouveau', rarity: 'epic', translucent: false, collection: 'old-masters', license: 'CC-BY-4.0',
    desc: 'An 1890s poster arch with a mosaic halo, whiplash vines and marigolds in full bloom, starring your game as the headline act.',
    tags: ['art nouveau', 'floral', 'poster', 'mosaic', 'gold', 'vintage'],
  },
};
