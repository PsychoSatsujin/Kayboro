'use strict';
// Marble Atrium: the front of a small Ionic temple in warm museum light. Veined white marble throughout: a
// pediment with a gilded laurel wreath tied in a red ribbon and palmette acroteria, a cornice with dentils,
// a frieze of carved laurel festoons, a three-banded architrave, two fluted Ionic columns with volute
// capitals on pedestals that each carry a cameo-style profile medallion, and three steps below. The
// screen sits in a plain marble doorway set into a Pompeian red wall.
const L = require('../lib');
const { g, lg, rg, rng } = L;

const W = 1720, H = 1340, hole = { x: 300, y: 420, w: 1120, h: 630 }, radius = 0;
const CX = W / 2;
const COLS = [200, 1520];
const Y = { apex: 64, cornice: 230, dentil: 256, frieze: 270, arch: 320, cap: 372, shaft: 420, base: 1032, ped: 1070, die: 1088, pedBase: 1212, steps: 1236 };
const INK = '#6e6253';      // carved-edge line
const SHADE = '#5a4632';    // warm shadow

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
const mirrorAt = (x0, ...kids) => g({ transform: `translate(${n(2 * x0)} 0) scale(-1 1)` }, ...kids);

/** Marble slab: fill, a hairline top light and a carved bottom shadow. */
function slab(x, y, w, h, fill = 'url(#marbleV)', edge = true) {
  return path(rect(x, y, w, h), { fill, stroke: INK, strokeWidth: 1.4 })
    + (edge ? path(`M${P(x + 1, y + 1.5)}H${n(x + w - 1)}`, { stroke: '#fff', strokeOpacity: 0.8, strokeWidth: 1.6 })
      + path(`M${P(x + 1, y + h - 1.5)}H${n(x + w - 1)}`, { stroke: SHADE, strokeOpacity: 0.3, strokeWidth: 2.2 }) : '');
}

/** Pointed leaf from (x, y) toward `ang` (degrees). */
function leafD(x, y, ang, l, w) {
  const a = (ang * Math.PI) / 180, c = Math.cos(a), s = Math.sin(a), T = (u, v) => P(x + u * c - v * s, y + u * s + v * c);
  return `M${T(0, 0)}C${T(l * 0.3, -w * 1.15)} ${T(l * 0.72, -w * 0.85)} ${T(l, 0)}C${T(l * 0.72, w * 0.85)} ${T(l * 0.3, w * 1.15)} ${T(0, 0)}Z`;
}

/** Laurel along a list of points: leaf pairs pointing along the run, every `every` points. */
function laurel(pts, l, w, every = 1, berries = false) {
  let d = '', b = '';
  for (let i = 1; i < pts.length; i += every) {
    const [x, y] = pts[i], [px, py] = pts[i - 1], a = (Math.atan2(y - py, x - px) * 180) / Math.PI;
    d += leafD(x, y, a - 38, l, w) + leafD(x, y, a + 38, l, w);
    if (berries && i % 4 === 1) b += circle(x + Math.cos(((a + 90) * Math.PI) / 180) * 4, y + Math.sin(((a + 90) * Math.PI) / 180) * 4, 3);
  }
  return { d, b };
}

// ---- architecture -------------------------------------------------------------------------------------
function pediment() {
  const L0 = 76, R0 = W - 76, yb = Y.cornice, ax = CX, ay = Y.apex;
  const outer = poly([[L0, yb], [ax, ay], [R0, yb]]);
  const inner = poly([[L0 + 196, yb], [ax, ay + 42], [R0 - 196, yb]]);
  const rake = (k) => { const t = k / 42; return `M${P(L0 + 196 * t, yb - 0.01 * k)}L${P(ax, ay + k)}L${P(R0 - 196 * t, yb - 0.01 * k)}`; };
  const den = (k) => `M${P(L0 + 196 * (k / 42) + 6, yb - 2)}L${P(ax, ay + k)}L${P(R0 - 196 * (k / 42) - 6, yb - 2)}`;
  return g({},
    path(outer, { fill: 'url(#marbleV)', stroke: INK, strokeWidth: 1.6, strokeLinejoin: 'round' }),
    path(inner, { fill: 'url(#tympanum)', stroke: INK, strokeWidth: 1.4, strokeLinejoin: 'round' }),
    // the raking cornice casts a soft shadow into the tympanum
    path(`M${P(L0 + 196, yb)}L${P(ax, ay + 42)}L${P(R0 - 196, yb)}`, { fill: 'none', stroke: SHADE, strokeOpacity: 0.28, strokeWidth: 10, transform: 'translate(0 5)' }),
    path(rake(8) + rake(16), { fill: 'none', stroke: INK, strokeOpacity: 0.55, strokeWidth: 1.2 }),
    path(rake(4), { fill: 'none', stroke: '#fff', strokeOpacity: 0.85, strokeWidth: 1.6 }),
    path(den(30), { fill: 'none', stroke: SHADE, strokeOpacity: 0.35, strokeWidth: 12 }),
    path(den(30), { fill: 'none', stroke: 'url(#marbleV)', strokeWidth: 11, strokeDasharray: '8 6' }),
    path(den(30), { fill: 'none', stroke: INK, strokeOpacity: 0.35, strokeWidth: 11, strokeDasharray: '1 13', strokeDashoffset: -8 }),
    path(outer, { fill: 'none', stroke: INK, strokeWidth: 1.6, strokeLinejoin: 'round' }));
}

function entablature() {
  const x0 = 64, x1 = W - 64, f0 = 104, f1 = W - 104;
  return g({},
    // cornice: fillet, corona, dentils
    slab(x0, Y.cornice, x1 - x0, 10), slab(x0 + 6, Y.cornice + 10, x1 - x0 - 12, 16),
    // dentils (solid strokes: a gradient on a zero-height line would not paint)
    path(rect(f0 - 4, Y.dentil, f1 - f0 + 8, 14), { fill: '#b9a98f' }),
    path(`M${P(f0 - 4, Y.dentil + 7)}H${n(f1 + 4)}`, { stroke: '#efe6d6', strokeWidth: 14, strokeDasharray: '11 7' }),
    path(`M${P(f0 - 4, Y.dentil + 13)}H${n(f1 + 4)}`, { stroke: '#cbbda5', strokeWidth: 2, strokeDasharray: '11 7' }),
    path(`M${P(f0 - 4, Y.dentil + 1)}H${n(f1 + 4)}`, { stroke: '#fff', strokeOpacity: 0.8, strokeWidth: 1.4, strokeDasharray: '11 7' }),
    path(`M${P(x0 + 6, Y.cornice + 26)}H${n(x1 - 6)}`, { stroke: SHADE, strokeOpacity: 0.35, strokeWidth: 3 }),
    // frieze and architrave
    slab(f0, Y.frieze, f1 - f0, Y.arch - Y.frieze, 'url(#frieze)'),
    path(`M${P(f0, Y.frieze + 3)}H${n(f1)}`, { stroke: SHADE, strokeOpacity: 0.25, strokeWidth: 6 }),
    slab(f0 - 4, Y.arch, f1 - f0 + 8, 6),
    slab(f0, Y.arch + 6, f1 - f0, 14), slab(f0 + 3, Y.arch + 20, f1 - f0 - 6, 15), slab(f0 + 6, Y.arch + 35, f1 - f0 - 12, 17));
}

/** Carved laurel festoons hanging between rosettes along the frieze. */
function festoons() {
  const y = Y.frieze + 12, xs = [];
  for (let i = 0; i <= 8; i++) xs.push(160 + (i * (W - 320)) / 8);
  let leaves = '', ribbon = '', ros = '';
  for (let i = 0; i < xs.length - 1; i++) {
    const a = xs[i] + 14, b = xs[i + 1] - 14, pts = [];
    for (let j = 0; j <= 20; j++) { const t = j / 20; pts.push([a + (b - a) * t, y + 4 + 24 * Math.sin(Math.PI * t)]); }
    // the swag is fattest at its lowest point and tapers to the rosettes
    for (const [ri, run] of [pts.slice(0, 11), pts.slice(10).reverse()].entries()) {
      for (let j = 1; j < run.length - ri; j++) {
        const [x, yy] = run[j], [px, py] = run[j - 1], ang = (Math.atan2(yy - py, x - px) * 180) / Math.PI, k = 0.55 + 0.45 * (j / (run.length - 1));
        leaves += leafD(x, yy, ang - 34, 18 * k, 6.2 * k) + leafD(x, yy, ang + 34, 18 * k, 6.2 * k);
      }
    }
    ribbon += `M${P(xs[i] + 4, y)}C${P(xs[i] + 10, y + 14, xs[i] - 6, y + 22, xs[i] + 2, y + 34)}`;
  }
  for (const x of xs) {
    let pet = '';
    for (let k = 0; k < 8; k++) pet += leafD(x, y, k * 45, 10, 3.6);
    ros += pet + circle(x, y, 3.2);
  }
  return path(leaves, { fill: SHADE, fillOpacity: 0.42, transform: 'translate(1.6 2.6)' })
    + path(leaves, { fill: 'url(#leafM)', stroke: INK, strokeWidth: 1 })
    + path(ribbon, { fill: 'none', stroke: INK, strokeWidth: 4.2, strokeLinecap: 'round' })
    + path(ribbon, { fill: 'none', stroke: '#f7f1e6', strokeWidth: 2.4, strokeLinecap: 'round' })
    + path(ros, { fill: 'url(#gilt)', stroke: '#6b4a14', strokeWidth: 0.9 });
}

/** Ionic column on its Attic base, centred at cx. */
function column(cx) {
  const rb = 52, rt = 45, y0 = Y.shaft, y1 = Y.base;
  const shaft = `M${P(cx - rb, y1)}C${P(cx - rb - 2, y1 - 300, cx - rt, y0 + 140, cx - rt, y0)}H${n(cx + rt)}C${P(cx + rt, y0 + 140, cx + rb + 2, y1 - 300, cx + rb, y1)}Z`;
  let flutes = '', lit = '';
  for (let k = -4; k <= 4; k++) {
    const s = Math.sin((k * 19 * Math.PI) / 180), xt = cx + rt * s * 0.96, xb = cx + rb * s * 0.96;
    flutes += `M${P(xt, y0 + 14)}L${P(xb, y1 - 14)}`;
    lit += `M${P(xt - 3.2, y0 + 16)}L${P(xb - 3.6, y1 - 16)}`;
  }
  // capital: abacus, volute band, two volutes, echinus with eggs
  const vol = (sx) => {
    const vx = cx + sx * 62, vy = 404, sp = [];
    for (let i = 0; i <= 22; i++) { const t = i / 22, r = 22 * (1 - 0.78 * t), a = -Math.PI / 2 + sx * t * Math.PI * 2.6; sp.push([vx + r * Math.cos(a), vy + r * Math.sin(a)]); }
    return path(circle(vx + 1.5, vy + 2.5, 23), { fill: SHADE, fillOpacity: 0.3 })
      + path(circle(vx, vy, 23), { fill: 'url(#marbleR)', stroke: INK, strokeWidth: 1.5 })
      + path(smooth(sp), { fill: 'none', stroke: INK, strokeWidth: 2, strokeLinecap: 'round' })
      + path(smooth(sp), { fill: 'none', stroke: '#fff', strokeOpacity: 0.75, strokeWidth: 1.2, strokeLinecap: 'round', transform: 'translate(-1 -1.2)' })
      + path(circle(vx, vy, 4.5), { fill: 'url(#berry)', stroke: '#6b4a14', strokeWidth: 1.2 });
  };
  let eggs = '', darts = '';
  for (let k = -1; k <= 1; k++) { eggs += ellipse(cx + k * 22, 404, 8, 10); if (k < 1) darts += `M${P(cx + k * 22 + 11, 396)}L${P(cx + k * 22 + 13, 406)}L${P(cx + k * 22 + 11, 414)}L${P(cx + k * 22 + 9, 406)}Z`; }
  const base = [[cx - 74, Y.base + 22, 148, 16], [cx - 66, Y.base + 12, 132, 10], [cx - 58, Y.base + 6, 116, 6], [cx - 60, Y.base, 120, 7]];
  return g({},
    path(shaft, { fill: 'url(#shaft)', stroke: INK, strokeWidth: 1.6 }),
    path(flutes, { fill: 'none', stroke: '#8a7c68', strokeOpacity: 0.55, strokeWidth: 2.2, strokeLinecap: 'round' }),
    path(lit, { fill: 'none', stroke: '#fff', strokeOpacity: 0.55, strokeWidth: 1.6, strokeLinecap: 'round' }),
    path(rect(cx - rt - 3, Y.shaft - 6, 2 * rt + 6, 7), { fill: 'url(#marbleV)', stroke: INK, strokeWidth: 1.2 }),
    path(`M${P(cx - 60, 398)}Q${P(cx, 432, cx + 60, 398)}V${n(392)}H${n(cx - 60)}Z`, { fill: 'url(#marbleV)', stroke: INK, strokeWidth: 1.4 }),
    path(eggs, { fill: 'url(#marbleR)', stroke: INK, strokeWidth: 1.2 }), path(darts, { fill: INK, fillOpacity: 0.55 }),
    path(`M${P(cx - 64, 382)}H${n(cx + 64)}C${P(cx + 60, 392, cx + 50, 394, cx + 44, 396)}H${n(cx - 44)}C${P(cx - 50, 394, cx - 60, 392, cx - 64, 382)}Z`, { fill: 'url(#marbleV)', stroke: INK, strokeWidth: 1.4 }),
    vol(-1), vol(1),
    slab(cx - 82, Y.cap, 164, 10),
    base.map(([x, y, w, h], i) => path(L.rr(x, y, w, h, i === 0 ? 2 : h / 2), { fill: 'url(#marbleV)', stroke: INK, strokeWidth: 1.4 })).join(''),
    path(`M${P(cx - 64, Y.base + 14)}H${n(cx + 64)}M${P(cx - 56, Y.base + 2)}H${n(cx + 56)}`, { stroke: '#fff', strokeOpacity: 0.8, strokeWidth: 1.6 }));
}

// Cameo bust (facing right), ~130 units tall.
const SKIN = 'M12 -38C16 -34 18 -28 19 -22C20 -18 21 -15 22 -12C24 -6 28 -2 31 1C32 2 32 4 30 5C28 6 26 5 25 7'
  + 'C25 8 26 9 26 10C27 11 26 12 24 13C25 14 26 15 25 17C24 19 21 19 21 21C21 24 24 26 22 30C20 33 14 33 8 35'
  + 'C7 42 9 50 13 58C18 62 22 66 22 72L-32 72C-31 62 -27 52 -24 44C-26 36 -28 28 -26 20C-24 0 -6 -30 12 -38Z';
const HAIR = 'M15 -35C10 -48 -6 -56 -20 -51C-34 -45 -41 -30 -39 -14C-38 -2 -33 10 -26 21C-22 16 -16 10 -13 5'
  + 'C-11 1 -12 -3 -9 -6C-6 -9 -3 -9 -1 -13C1 -17 -1 -20 3 -23C6 -26 5 -29 9 -31C12 -33 13 -34 15 -35Z';
const EAR = 'M-9 -5C-3 -8 1 1 -1 8C-3 12 -8 11 -10 6C-9 3 -11 -2 -9 -5Z';
const BUN = 'M-36 -22C-50 -26 -58 -12 -55 0C-52 12 -40 16 -33 8C-28 0 -28 -16 -36 -22Z';
const DRAPE = 'M-33 72C-30 62 -20 56 -6 58C6 60 16 64 23 72Z';
const GROOVES = 'M11 -32C2 -38 -12 -38 -24 -31M7 -25C-2 -30 -14 -28 -27 -20M3 -18C-6 -21 -16 -17 -27 -9M-1 -11C-9 -12 -16 -8 -23 1'
  + 'M-42 -18C-48 -16 -50 -8 -46 -2M-38 -10C-44 -6 -44 2 -40 6M-44 -22C-52 -18 -54 -6 -50 2';
const FEAT = 'M10 -12C12 -14 16 -14 18 -12C16 -11 12 -11 10 -12ZM9 -18C13 -20 17 -19 20 -17';
const LINES = 'M25 13L21 13.5M25 4C24 5 24 6 25.5 6.5M-6 -1C-4 1 -4 4 -6 6M-24 62C-14 62 0 64 12 70M-28 68C-18 66 -6 68 4 72';

/** Round medallion: marble moulding ring around a pale slate ground with a white relief profile. */
function medallion(x, y, r, face) {
  const s = (r * 0.98) / 130 * 1.55, st = { stroke: '#7d7466', strokeWidth: n(1.2 / s), strokeLinejoin: 'round' };
  const head = g({ transform: `translate(${n(x + face * 2)} ${n(y - r * 0.08)}) scale(${n(face * s * 100) / 100} ${n(s * 100) / 100})` },
    path(SKIN + BUN, { fill: '#2f3d4a', fillOpacity: 0.35, transform: `translate(${face * 2.5} 3)` }),
    path(SKIN, { fill: 'url(#relief)', ...st }), path(EAR, { fill: 'url(#relief)', ...st }), path(BUN, { fill: 'url(#relief)', ...st }),
    path(HAIR, { fill: 'url(#relief)', ...st }),
    path(GROOVES, { fill: 'none', stroke: '#9b927f', strokeWidth: 1.5, strokeLinecap: 'round' }),
    path('M13 -40C0 -48 -20 -46 -35 -33', { fill: 'none', stroke: '#b8a77a', strokeWidth: 3.2, strokeLinecap: 'round' }),
    path(DRAPE, { fill: 'url(#relief)', ...st }),
    path(FEAT, { fill: 'none', stroke: '#6f675a', strokeWidth: 1.2, strokeLinecap: 'round' }),
    path(LINES, { fill: 'none', stroke: '#8a8172', strokeWidth: 1.2, strokeLinecap: 'round' }));
  return g({},
    path(circle(x + 2, y + 4, r + 10), { fill: SHADE, fillOpacity: 0.3 }),
    path(circle(x, y, r + 10), { fill: 'url(#marbleR)', stroke: INK, strokeWidth: 1.5 }),
    path(circle(x, y, r + 4), { fill: 'none', stroke: INK, strokeOpacity: 0.5, strokeWidth: 1.2 }),
    path(circle(x, y, r), { fill: 'url(#cameo)', stroke: INK, strokeWidth: 1.5 }),
    path(circle(x, y, r - 1), { fill: 'none', stroke: '#1f2b36', strokeOpacity: 0.25, strokeWidth: 5, transform: 'translate(1.5 2)' }),
    g({ clipPath: `url(#medClip${face > 0 ? 'L' : 'R'})` }, head));
}

function pedestal(cx, face) {
  const x0 = cx - 100, w = 200;
  return g({},
    slab(x0 + 10, Y.die, w - 20, Y.pedBase - Y.die),
    path(rect(x0 + 24, Y.die + 12, w - 48, Y.pedBase - Y.die - 24), { fill: 'none', stroke: INK, strokeOpacity: 0.45, strokeWidth: 1.3 }),
    path(rect(x0 + 26, Y.die + 14, w - 48, Y.pedBase - Y.die - 24), { fill: 'none', stroke: '#fff', strokeOpacity: 0.6, strokeWidth: 1.1 }),
    slab(x0, Y.ped, w, 10), slab(x0 + 5, Y.ped + 10, w - 10, 8),
    slab(x0 + 5, Y.pedBase, w - 10, 10), slab(x0, Y.pedBase + 10, w, 14),
    medallion(cx, (Y.die + Y.pedBase) / 2, 46, face));
}

function steps() {
  return [[70, Y.steps, W - 140, 30], [46, Y.steps + 30, W - 92, 30], [22, Y.steps + 60, W - 44, 30]]
    .map(([x, y, w, h]) => slab(x, y, w, h, 'url(#step)') + path(`M${P(x + 4, y + h + 1.5)}H${n(x + w - 4)}`, { stroke: SHADE, strokeOpacity: 0.3, strokeWidth: 3 })).join('');
}

/** Cella wall in Pompeian red with a marble doorway (a calm moulding) around the screen. */
function wall() {
  const x0 = 150, x1 = W - 150, y0 = Y.cap - 2, y1 = Y.steps, dado = 1140;
  const o = 30, dx = hole.x - o, dy = hole.y - o, dw = hole.w + 2 * o, dh = hole.h + 2 * o;
  return g({},
    path(rect(x0, y0, x1 - x0, y1 - y0), { fill: 'url(#wall)' }),
    path(rect(x0, y0, x1 - x0, y1 - y0), { fill: 'url(#wallLight)' }),
    path(rect(x0, y0, x1 - x0, 14), { fill: '#2a0e0a', fillOpacity: 0.3 }),
    // marble dado along the foot of the wall
    slab(x0, dado, x1 - x0, 12), slab(x0 + 4, dado + 12, x1 - x0 - 8, y1 - dado - 12, 'url(#step)', false),
    path(`M${P(x0 + 4, dado + 22)}H${n(x1 - 4)}M${P(x0 + 4, y1 - 12)}H${n(x1 - 4)}`, { stroke: INK, strokeOpacity: 0.35, strokeWidth: 1.2 }),
    path(rect(dx + 4, dy + 8, dw, dh), { fill: '#2a0e0a', fillOpacity: 0.35 }),
    path(rect(dx, dy, dw, dh), { fill: 'url(#door)', stroke: INK, strokeWidth: 1.5 }),
    path(rect(dx + 10, dy + 10, dw - 20, dh - 20), { fill: 'none', stroke: INK, strokeOpacity: 0.45, strokeWidth: 1.2 }),
    path(rect(dx + 11.5, dy + 11.5, dw - 20, dh - 20), { fill: 'none', stroke: '#fff', strokeOpacity: 0.55, strokeWidth: 1.1 }),
    L.lip(L.rr(hole.x, hole.y, hole.w, hole.h, 0), '#1a0f08', [[5, 0.28], [2, 0.55]]),
    // shadows cast to the right by the left column and the doorway (light from the upper left)
    path(rect(COLS[0] + 50, y0, 22, dado - y0), { fill: 'url(#castR)' }),
    path(rect(dx + dw, y0, 20, dado - y0), { fill: 'url(#castR)' }),
    // a painted Greek key band under the doorway
    path(`M${P(hole.x, 1092)}H${n(hole.x + hole.w)}M${P(hole.x, 1130)}H${n(hole.x + hole.w)}`, { stroke: '#d9a35a', strokeOpacity: 0.85, strokeWidth: 2 }),
    path(rect(hole.x, 1095, hole.w, 32), { fill: 'url(#key)' }));
}

function wreath(cx, cy, r) {
  const side = (sx) => {
    const pts = [];
    for (let i = 0; i <= 16; i++) { const a = Math.PI / 2 + sx * (0.12 + (i / 16) * 0.82) * Math.PI; pts.push([cx + r * Math.cos(a), cy + r * Math.sin(a)]); }
    return laurel(pts, 17, 5.6, 1, true);
  };
  const A = side(1), B = side(-1);
  const stem = (sx) => { const pts = []; for (let i = 0; i <= 12; i++) { const a = Math.PI / 2 + sx * (0.08 + (i / 12) * 0.84) * Math.PI; pts.push([cx + r * Math.cos(a), cy + r * Math.sin(a)]); } return smooth(pts); };
  const bow = `M${P(cx, cy + r)}C${P(cx - 16, cy + r - 16, cx - 30, cy + r - 4, cx - 22, cy + r + 8)}C${P(cx - 16, cy + r + 14, cx - 6, cy + r + 8, cx, cy + r)}Z`
    + `M${P(cx, cy + r)}C${P(cx + 16, cy + r - 16, cx + 30, cy + r - 4, cx + 22, cy + r + 8)}C${P(cx + 16, cy + r + 14, cx + 6, cy + r + 8, cx, cy + r)}Z`;
  const tails = `M${P(cx - 3, cy + r + 3)}C${P(cx - 40, cy + r + 30, cx - 110, cy + r + 4, cx - 170, cy + r + 30)}L${P(cx - 158, cy + r + 20)}L${P(cx - 176, cy + r + 18)}C${P(cx - 110, cy + r - 6, cx - 44, cy + r + 18, cx + 3, cy + r - 3)}Z`;
  const tailsR = `M${P(cx + 3, cy + r + 3)}C${P(cx + 40, cy + r + 30, cx + 110, cy + r + 4, cx + 170, cy + r + 30)}L${P(cx + 158, cy + r + 20)}L${P(cx + 176, cy + r + 18)}C${P(cx + 110, cy + r - 6, cx + 44, cy + r + 18, cx - 3, cy + r - 3)}Z`;
  const gold = { fill: 'url(#gilt)', stroke: '#6b4a14', strokeWidth: 1.1, strokeLinejoin: 'round' };
  return g({},
    path(tails + tailsR, { fill: SHADE, fillOpacity: 0.3, transform: 'translate(2 4)' }),
    path(tails + tailsR, { fill: 'url(#ribbon)', stroke: '#4a120c', strokeWidth: 1.4, strokeLinejoin: 'round' }),
    path(stem(1) + stem(-1), { fill: 'none', stroke: '#6b4a14', strokeWidth: 3.6, strokeLinecap: 'round' }),
    path(A.d + B.d, { fill: SHADE, fillOpacity: 0.3, transform: 'translate(2 3)' }),
    path(A.d + B.d, gold),
    path(A.b + B.b, { fill: 'url(#berry)', stroke: '#6b4a14', strokeWidth: 0.9 }),
    path(bow, { fill: 'url(#ribbon)', stroke: '#4a120c', strokeWidth: 1.4 }),
    path(circle(cx, cy + r, 6), { fill: 'url(#ribbon)', stroke: '#4a120c', strokeWidth: 1.4 }));
}

/** Carved laurel sprays lying along the tympanum floor on both sides of the wreath. */
function sprays() {
  let d = '', st = '';
  for (const sx of [-1, 1]) {
    const pts = [];
    for (let i = 0; i <= 18; i++) { const t = i / 18; pts.push([CX + sx * (70 + 330 * t), 216 - 10 * Math.sin(Math.PI * t) + 4 * t]); }
    st += smooth(pts);
    for (let i = 1; i < pts.length; i++) {
      const [x, y] = pts[i], [px, py] = pts[i - 1], a = (Math.atan2(y - py, x - px) * 180) / Math.PI, k = 1 - 0.45 * (i / pts.length);
      d += leafD(x, y, a - 40, 18 * k, 6 * k) + leafD(x, y, a + 40, 18 * k, 6 * k);
    }
  }
  return path(st, { fill: 'none', stroke: '#e9e2d4', strokeWidth: 2.6, strokeLinecap: 'round' })
    + path(d, { fill: '#1f2b36', fillOpacity: 0.35, transform: 'translate(1.5 2.5)' })
    + path(d, { fill: 'url(#relief)', stroke: '#7d7466', strokeWidth: 0.9 });
}

/** Anthemion acroterion: a fan of lobed palmette fronds over a pair of small volutes. */
function palmette(cx, by, h, half = 0) {
  let fr = '';
  const cnt = 7;
  for (let i = 0; i < cnt; i++) {
    const t = i / (cnt - 1) - 0.5;
    if ((half < 0 && t > 0.01) || (half > 0 && t < -0.01)) continue;
    const ang = -90 + t * 120, l = h * (1 - Math.abs(t) * 0.45);
    fr += leafD(cx, by - 8, ang, l, l * 0.17);
  }
  const vol = `M${P(cx, by - 4)}C${P(cx - 20, by - 4, cx - 26, by - 18, cx - 16, by - 20)}C${P(cx - 9, by - 21, cx - 8, by - 12, cx - 13, by - 12)}`
    + `M${P(cx, by - 4)}C${P(cx + 20, by - 4, cx + 26, by - 18, cx + 16, by - 20)}C${P(cx + 9, by - 21, cx + 8, by - 12, cx + 13, by - 12)}`;
  return path(fr, { fill: SHADE, fillOpacity: 0.28, transform: 'translate(2 3)' })
    + path(fr, { fill: 'url(#marbleV)', stroke: INK, strokeWidth: 1.2 })
    + path(vol, { fill: 'none', stroke: INK, strokeWidth: 4.2, strokeLinecap: 'round' })
    + path(vol, { fill: 'none', stroke: '#f6f0e4', strokeWidth: 2.4, strokeLinecap: 'round' })
    + path(ellipse(cx, by - 3, 10, 5), { fill: 'url(#marbleV)', stroke: INK, strokeWidth: 1.2 });
}

/** Grey and honey veins, clipped to the marble surfaces. */
function veins() {
  const rnd = rng(23);
  let dark = '', warm = '';
  for (let i = 0; i < 46; i++) {
    let x = rnd() * W, y = rnd() * H;
    const pts = [[x, y]], a0 = rnd() * Math.PI * 2;
    for (let j = 0; j < 6; j++) { const a = a0 + (rnd() - 0.5) * 1.6; x += Math.cos(a) * (30 + rnd() * 40); y += Math.sin(a) * (14 + rnd() * 26); pts.push([x, y]); }
    if (i % 3) dark += smooth(pts); else warm += smooth(pts);
  }
  return g({ clipPath: 'url(#marbleClip)' },
    path(dark, { fill: 'none', stroke: '#8d8476', strokeOpacity: 0.07, strokeWidth: 7, strokeLinecap: 'round' }), path(dark, { fill: 'none', stroke: '#857b6c', strokeOpacity: 0.26, strokeWidth: 1.1, strokeLinecap: 'round' }),
    path(warm, { fill: 'none', stroke: '#c39a5a', strokeOpacity: 0.1, strokeWidth: 8, strokeLinecap: 'round' }), path(warm, { fill: 'none', stroke: '#b98c4a', strokeOpacity: 0.3, strokeWidth: 1.3, strokeLinecap: 'round' }),
    path(rect(0, 0, W, H), { fill: 'url(#spot)' }));
}

function draw() {
  // marble surfaces for the veins (even-odd: the cameo medallions are cut out)
  // (exactly the painted slabs, so the warm light never tints empty space)
  const band = (x, y, h) => rect(x, y, W - 2 * x, h);
  const clip = poly([[76, Y.cornice], [CX, Y.apex], [W - 76, Y.cornice]])
    + band(64, Y.cornice, 10) + band(70, Y.cornice + 10, 16) + band(100, Y.dentil, 14) + band(104, Y.frieze, 50)
    + band(100, Y.arch, 6) + band(104, Y.arch + 6, 14) + band(107, Y.arch + 20, 15) + band(110, Y.arch + 35, 17)
    + COLS.map((cx) => rect(cx - 100, Y.ped, 200, 10) + rect(cx - 95, Y.ped + 10, 190, 8) + rect(cx - 90, Y.die, 180, Y.pedBase - Y.die)
      + rect(cx - 95, Y.pedBase, 190, 10) + rect(cx - 100, Y.pedBase + 10, 200, 14) + circle(cx, (Y.die + Y.pedBase) / 2, 57)).join('')
    + rect(70, Y.steps, W - 140, 30) + rect(46, Y.steps + 30, W - 92, 30) + rect(22, Y.steps + 60, W - 44, 30)
    + rect(300, 1140, W - 600, Y.steps - 1140);
  const defs = [
    lg('marbleV', [0, 0, 0, 1], [[0, '#fffaf1'], [0.55, '#f2e9da'], [1, '#d9ccb6']]),
    rg('marbleR', [0.38, 0.32, 0.75], [[0, '#fffdf8'], [0.6, '#efe5d4'], [1, '#cdbfa6']]),
    lg('frieze', [0, 0, 0, 1], [[0, '#7d93a6'], [1, '#a1b4c3']]),
    lg('tympanum', [0, 0, 0, 1], [[0, '#6f8597'], [0.4, '#8ea3b4'], [1, '#a3b5c3']]),
    lg('shaft', [0, 0, 1, 0], [[0, '#b9aa92'], [0.18, '#f0e7d8'], [0.36, '#fffbf3'], [0.62, '#ece2d1'], [0.86, '#cdbfa8'], [1, '#a8987f']]),
    lg('step', [0, 0, 0, 1], [[0, '#f7f0e4'], [1, '#ddd0ba']]),
    lg('wall', [0, 0, 0, 1], [[0, '#7c2a20'], [0.5, '#8e3427'], [1, '#5c1d16']]),
    rg('wallLight', [0.5, 0, 0.75], [[0, '#ffb98a', 0.32], [1, '#ffb98a', 0]]),
    lg('door', [0, 0, 1, 1], [[0, '#fbf5ea'], [0.5, '#efe5d3'], [1, '#d6c8b0']]),
    lg('cameo', [0, 0, 0, 1], [[0, '#b7c6d2'], [1, '#8ea3b4']]),
    lg('leafM', [0, 0, 1, 1], [[0, '#fffdf7'], [1, '#d8cab0']]),
    lg('relief', [0, 0, 1, 1], [[0, '#ffffff'], [0.5, '#f3eee5'], [1, '#cfc6b6']]),
    lg('gilt', [0, 0, 1, 1], [[0, '#fbe7a6'], [0.45, '#e2b75a'], [1, '#9c6d1e']]),
    rg('berry', [0.35, 0.3, 0.8], [[0, '#fff2c4'], [1, '#b8862e']]),
    lg('ribbon', [0, 0, 0, 1], [[0, '#c4483a'], [1, '#7e2219']]),
    rg('spot', [0.5, 0.05, 0.75], [[0, '#ffe2b0', 0.3], [0.6, '#ffe2b0', 0.08], [1, '#ffe2b0', 0]], false),
    rg('glow', [0.5, 0.5, 0.5], [[0, '#ffd9a0', 0.32], [0.6, '#ffd9a0', 0.12], [1, '#ffd9a0', 0]]),
    lg('castR', [0, 0, 1, 0], [[0, '#1a0605', 0.45], [1, '#1a0605', 0]]),
    `<pattern id="key" width="40" height="32" patternUnits="userSpaceOnUse" patternTransform="translate(${hole.x} 1095)">`
      + `${path('M0 30H40M4 30V5H32V25H14V13H24V19', { fill: 'none', stroke: '#d9a35a', strokeOpacity: 0.85, strokeWidth: 3 })}</pattern>`,
    `<clipPath id="marbleClip"><path clip-rule="evenodd" d="${toRel(clip)}"/></clipPath>`,
    ...COLS.map((cx, i) => `<clipPath id="medClip${i ? 'R' : 'L'}"><path d="${toRel(circle(cx, (Y.die + Y.pedBase) / 2, 45.5))}"/></clipPath>`),
  ].join('');
  const body = [
    // soft museum floor shadow and back glow
    path(ellipse(CX, Y.steps + 96, 840, 22), { fill: '#000', fillOpacity: 0.22 }),
    path(ellipse(CX, 190, 860, 210), { fill: 'url(#glow)' }),
    wall(),
    entablature(),
    festoons(),
    pediment(),
    sprays(), wreath(CX, 168, 52),
    palmette(CX, Y.apex + 8, 56), palmette(84, Y.cornice + 2, 44, 1), palmette(W - 84, Y.cornice + 2, 44, -1),
    steps(),
    pedestal(COLS[0], 1), pedestal(COLS[1], -1),
    COLS.map(column).join(''),
    veins(),
  ].join('\n');
  return { defs, body };
}

module.exports = {
  W, H, hole, radius, draw,
  meta: {
    name: 'Marble Atrium', theme: 'classical', rarity: 'rare', translucent: false, collection: 'old-masters', license: 'CC-BY-4.0',
    desc: 'A sunlit Ionic temple in veined marble, with a gilded laurel wreath and two cameo portraits keeping watch over your game.',
    tags: ['marble', 'classical', 'temple', 'museum', 'greek', 'columns', 'laurel'],
  },
};
