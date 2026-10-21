'use strict';
// Helpers for vector SKINS (tools/vectorart/skins/<id>.js): recolor a base frame's markup (its draw()
// output) by hue and lightness, then add themed decor. The hole is cut by frameSvg from the base's own
// geometry, so a skin can never move the opening (tools/shells/build-skins.mjs checks it anyway).

const clamp = (v, a = 0, b = 1) => Math.min(b, Math.max(a, v));
const rgb = (c) => [1, 3, 5].map((i) => parseInt(c.slice(i, i + 2), 16));
const hex = (a) => '#' + a.map((v) => Math.round(clamp(v, 0, 255)).toString(16).padStart(2, '0')).join('');

function hsv(c) {
  let [r, g, b] = rgb(c);
  r /= 255; g /= 255; b /= 255;
  const M = Math.max(r, g, b), m = Math.min(r, g, b), d = M - m;
  const h = !d ? 0 : M === r ? ((g - b) / d) % 6 : M === g ? (b - r) / d + 2 : (r - g) / d + 4;
  return [(h * 60 + 360) % 360, M ? d / M : 0, M];
}
const lum = (c) => { const [r, g, b] = rgb(c); return (0.299 * r + 0.587 * g + 0.114 * b) / 255; };
const hueDist = (a, b) => { const d = Math.abs(a - b) % 360; return d > 180 ? 360 - d : d; };
const mix = (a, b, t) => { const A = rgb(a), B = rgb(b); return hex(A.map((v, i) => v + (B[i] - v) * t)); };

/** Color at t (0..1) along gradient stops [[t, '#hex'], ...]. */
function along(stops, t) {
  t = clamp(t);
  for (let i = 1; i < stops.length; i++) if (t <= stops[i][0]) {
    const [t0, c0] = stops[i - 1], [t1, c1] = stops[i];
    return mix(c0, c1, (t - t0) / Math.max(1e-6, t1 - t0));
  }
  return stops[stops.length - 1][1];
}

/** Replace every #rrggbb (and #rgb) in markup through fn(hex) -> hex | null (null keeps it). */
function recolorSvg(markup, fn) {
  const cache = new Map();
  return markup.replace(/#([0-9a-fA-F]{6}|[0-9a-fA-F]{3})\b/g, (m, h) => {
    const c = h.length === 3 ? '#' + [...h].map((x) => x + x).join('') : '#' + h.toLowerCase();
    if (!cache.has(c)) cache.set(c, fn(c) || c);
    return cache.get(c);
  });
}

/**
 * fn for recolorSvg: colors whose hue is within `width` of `hue` (and saturation >= minSat) move onto
 * `stops` by their lightness (lo..hi maps to 0..1). Returns null for others.
 */
function hueBand(hue, width, stops, { minSat = 0.12, lo = 0, hi = 1 } = {}) {
  return (c) => {
    const [h, s] = hsv(c);
    if (s < minSat || hueDist(h, hue) > width) return null;
    return along(stops, (lum(c) - lo) / Math.max(1e-6, hi - lo));
  };
}
/** First fn that returns a color wins. */
const chain = (...fns) => (c) => { for (const f of fns) { const r = f(c); if (r) return r; } return null; };
/** Exact color map as an fn. */
const exact = (map) => (c) => map[c] || null;

module.exports = { rgb, hex, hsv, lum, hueDist, mix, along, recolorSvg, hueBand, chain, exact };
