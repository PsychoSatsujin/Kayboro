'use strict';
// Tiny SVG authoring helpers for the vector frames. Everything emits absolute path commands so the
// output stays readable and test/frames-vector.test.js can parse the hole geometry.

const n = (v) => +(+v).toFixed(2);
const P = (...pts) => pts.map(n).join(' ');

/** Rounded rect path (absolute, clockwise). r may be a number or [tl, tr, br, bl]. */
function rr(x, y, w, h, r = 0) {
  const [a, b, c, d] = (Array.isArray(r) ? r : [r, r, r, r]).map((v) => Math.min(v, w / 2, h / 2));
  const arc = (rad, ex, ey) => (rad ? `A${P(rad, rad)} 0 0 1 ${P(ex, ey)}` : '');
  return `M${P(x + a, y)}H${n(x + w - b)}${arc(b, x + w, y + b)}V${n(y + h - c)}${arc(c, x + w - c, y + h)}`
    + `H${n(x + d)}${arc(d, x, y + h - d)}V${n(y + a)}${arc(a, x + a, y)}Z`;
}

/** Polygon / polyline from [[x,y],...]. */
const poly = (pts, close = true) => `M${pts.map((p) => P(...p)).join('L')}${close ? 'Z' : ''}`;

/** Chamfered rect: corners cut by c (number or [tl,tr,br,bl]). */
function chamfer(x, y, w, h, c) {
  const [a, b, cc, d] = Array.isArray(c) ? c : [c, c, c, c];
  return poly([[x + a, y], [x + w - b, y], [x + w, y + b], [x + w, y + h - cc], [x + w - cc, y + h], [x + d, y + h], [x, y + h - d], [x, y + a]]);
}

const circle = (cx, cy, r) => `M${P(cx - r, cy)}A${P(r, r)} 0 1 0 ${P(cx + r, cy)}A${P(r, r)} 0 1 0 ${P(cx - r, cy)}Z`;
const ellipse = (cx, cy, rx, ry) => `M${P(cx - rx, cy)}A${P(rx, ry)} 0 1 0 ${P(cx + rx, cy)}A${P(rx, ry)} 0 1 0 ${P(cx - rx, cy)}Z`;

/** n-point star. */
function star(cx, cy, R, r, pts = 5, rot = -90) {
  const out = [];
  for (let i = 0; i < pts * 2; i++) {
    const a = ((rot + (i * 180) / pts) * Math.PI) / 180, rad = i % 2 ? r : R;
    out.push([cx + rad * Math.cos(a), cy + rad * Math.sin(a)]);
  }
  return poly(out);
}

/** Four-point "twinkle" sparkle with concave sides. */
function sparkle(cx, cy, s, k = 0.18) {
  const q = s * k;
  return `M${P(cx, cy - s)}Q${P(cx + q, cy - q)} ${P(cx + s, cy)}Q${P(cx + q, cy + q)} ${P(cx, cy + s)}`
    + `Q${P(cx - q, cy + q)} ${P(cx - s, cy)}Q${P(cx - q, cy - q)} ${P(cx, cy - s)}Z`;
}

/** Heart centred on (cx, cy), width ~2s. */
function heart(cx, cy, s) {
  return `M${P(cx, cy + s * 0.95)}C${P(cx - s * 0.2, cy + s * 0.75, cx - s, cy + s * 0.25, cx - s, cy - s * 0.25)}`
    + `C${P(cx - s, cy - s * 0.75, cx - s * 0.45, cy - s * 0.95, cx, cy - s * 0.5)}`
    + `C${P(cx + s * 0.45, cy - s * 0.95, cx + s, cy - s * 0.75, cx + s, cy - s * 0.25)}`
    + `C${P(cx + s, cy + s * 0.25, cx + s * 0.2, cy + s * 0.75, cx, cy + s * 0.95)}Z`;
}

/** One sakura petal pointing up from (0,0) to (0,-L), with the notch at the tip. Use inside a transform. */
function petal(L) {
  const w = L * 0.5;
  return `M0 0C${P(-w * 0.9, -L * 0.25, -w * 1.05, -L * 0.8, -w * 0.35, -L)}L0 ${n(-L * 0.86)}L${P(w * 0.35, -L)}`
    + `C${P(w * 1.05, -L * 0.8, w * 0.9, -L * 0.25, 0, 0)}Z`;
}

/** Five-petal sakura blossom (petal gradient id `pg`, needs objectBoundingBox radial gradient). */
function blossom(cx, cy, size, rot = 0, pg = 'petal', centre = '#ff5f9e') {
  let out = '';
  for (let i = 0; i < 5; i++) out += `<path d="${petal(size)}" fill="url(#${pg})" transform="rotate(${n(i * 72)})"/>`;
  for (let i = 0; i < 10; i++) {
    const a = ((i * 36 + 18) * Math.PI) / 180, r = size * (i % 2 ? 0.34 : 0.42);
    out += `<path d="M0 0L${P(r * Math.cos(a), r * Math.sin(a))}" stroke="${centre}" stroke-width="${n(size * 0.035)}" stroke-linecap="round"/>`
      + `<circle cx="${n(r * Math.cos(a))}" cy="${n(r * Math.sin(a))}" r="${n(size * 0.05)}" fill="#ffd96a"/>`;
  }
  out += `<circle r="${n(size * 0.12)}" fill="${centre}"/>`;
  return `<g transform="${tf(cx, cy, rot)}">${out}</g>`;
}

const tf = (x, y, rot = 0, s = 1) => `translate(${P(x, y)})${rot ? ` rotate(${n(rot)})` : ''}${s !== 1 ? ` scale(${n(s)})` : ''}`;

const stops = (list) => list.map(([o, c, a]) => `<stop offset="${o}" stop-color="${c}"${a != null && a !== 1 ? ` stop-opacity="${a}"` : ''}/>`).join('');
/** Linear gradient in objectBoundingBox units unless `user` coords are given ([x1,y1,x2,y2]). */
const lg = (id, [x1, y1, x2, y2], list, user = false) =>
  `<linearGradient id="${id}" x1="${x1}" y1="${y1}" x2="${x2}" y2="${y2}"${user ? ' gradientUnits="userSpaceOnUse"' : ''}>${stops(list)}</linearGradient>`;
const rg = (id, [cx, cy, r, fx = cx, fy = cy], list, user = false) =>
  `<radialGradient id="${id}" cx="${cx}" cy="${cy}" r="${r}"${fx !== cx || fy !== cy ? ` fx="${fx}" fy="${fy}"` : ''}${user ? ' gradientUnits="userSpaceOnUse"' : ''}>${stops(list)}</radialGradient>`;

/** Attribute string from an object (skips null/undefined; camelCase -> kebab-case). */
const attrs = (o) => Object.entries(o).filter(([, v]) => v != null && v !== false)
  .map(([k, v]) => ` ${k.replace(/[A-Z]/g, (m) => `-${m.toLowerCase()}`)}="${v}"`).join('');
const path = (d, a = {}) => `<path d="${d}"${attrs(a)}/>`;
const g = (a, ...kids) => `<g${attrs(a)}>${kids.flat().join('')}</g>`;

/** Soft "glow" built from stacked strokes (cheap alternative to a blur filter). */
function glowStroke(d, color, width, layers = [[6, 0.08], [3.2, 0.14], [1.8, 0.28], [1, 1]], extra = {}) {
  return layers.map(([k, a]) => path(d, { fill: 'none', stroke: color, strokeWidth: n(width * k), strokeOpacity: a, strokeLinecap: 'round', strokeLinejoin: 'round', ...extra })).join('');
}

/** Concentric strokes just outside a hole path: a cheap inner shadow cast onto the screen lip. */
function lip(holeD, color = '#000', steps = [[14, 0.12], [9, 0.18], [5, 0.3], [2.5, 0.55]]) {
  return steps.map(([w, a]) => path(holeD, { fill: 'none', stroke: color, strokeWidth: w * 2, strokeOpacity: a })).join('');
}

/** Smooth open curve through points (quadratic segments via midpoints). */
function smooth(pts) {
  if (pts.length < 3) return poly(pts, false);
  let d = `M${P(...pts[0])}`;
  for (let i = 1; i < pts.length - 1; i++) {
    const [x, y] = pts[i], [x2, y2] = pts[i + 1];
    d += `Q${P(x, y)} ${P(i === pts.length - 2 ? x2 : (x + x2) / 2, i === pts.length - 2 ? y2 : (y + y2) / 2)}`;
  }
  return d;
}

/** Deterministic PRNG so builds are reproducible. */
function rng(seed = 1) {
  let s = seed >>> 0;
  return () => ((s = (s * 1664525 + 1013904223) >>> 0) / 4294967296);
}

/**
 * Wrap artwork into a frame SVG. The hole is cut with an even-odd clip path over the whole drawing,
 * so it is fully transparent and exactly {x, y, w, h} (radius r) in viewBox units.
 */
function frameSvg({ id, W, H, hole, radius = 0, defs = '', body = '' }) {
  const cut = `M0 0H${W}V${H}H0Z${rr(hole.x, hole.y, hole.w, hole.h, radius)}`;
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${W} ${H}" width="${W}" height="${H}" data-frame="${id}">\n`
    + `<defs><clipPath id="shell-cut"><path clip-rule="evenodd" d="${cut}"/></clipPath>\n${defs}\n</defs>\n`
    + `<g clip-path="url(#shell-cut)">\n${body}\n</g>\n</svg>\n`;
}

module.exports = { n, P, rr, poly, chamfer, circle, ellipse, star, sparkle, heart, petal, blossom, tf, stops, lg, rg, attrs, path, g, glowStroke, lip, smooth, rng, frameSvg };
