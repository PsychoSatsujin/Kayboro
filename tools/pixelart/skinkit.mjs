// Helpers for pixel SKINS (tools/pixelart/skins/<id>.mjs): a skin redraws an existing pixel shell with
// other palette ramps (withPalette), retints whatever the ramps don't cover (recolor, remapIn), adds
// themed decor on top (snowCap, icicles, ...) and finally re-punches the base's exact opening (repunch).
// Built by tools/shells/build-skins.mjs, which checks the opening matches the base pixel for pixel.
import { INK } from './kit.mjs';
import { rgb, hex, bayer, rng } from './pixel.mjs';

/**
 * Runs fn() while the named palettes of a base frame module (its exported PALETTES) hold other colors,
 * then restores them. Arrays must keep their length; objects (e.g. a flame color map) are merged.
 */
export function withPalette(pal, swaps, fn) {
  const restore = [];
  try {
    for (const [k, v] of Object.entries(swaps)) {
      const a = pal[k];
      if (!a) throw new Error(`base has no palette "${k}"`);
      if (Array.isArray(a)) {
        if (!Array.isArray(v) || v.length !== a.length) throw new Error(`palette "${k}" needs ${a.length} colors`);
        const old = a.slice();
        restore.push(() => a.splice(0, a.length, ...old));
        a.splice(0, a.length, ...v);
      } else {
        const old = { ...a };
        restore.push(() => { for (const key of Object.keys(a)) delete a[key]; Object.assign(a, old); });
        Object.assign(a, v);
      }
    }
    return fn();
  } finally {
    for (const undo of restore.reverse()) undo();
  }
}

// ---- color ---------------------------------------------------------------------------------------
export function toHsv(c) {
  let [r, g, b] = rgb(c);
  r /= 255; g /= 255; b /= 255;
  const M = Math.max(r, g, b), m = Math.min(r, g, b), d = M - m;
  const h = !d ? 0 : M === r ? ((g - b) / d) % 6 : M === g ? (b - r) / d + 2 : (r - g) / d + 4;
  return [(h * 60 + 360) % 360, M ? d / M : 0, M];
}
export function fromHsv(h, s, v) {
  s = Math.min(1, Math.max(0, s)); v = Math.min(1, Math.max(0, v)); h = ((h % 360) + 360) % 360;
  const f = (n) => { const k = (n + h / 60) % 6; return v - v * s * Math.max(0, Math.min(k, 4 - k, 1)); };
  return hex([f(5), f(3), f(1)].map((x) => x * 255));
}
/** Hue distance in degrees (0..180). */
export const hueDist = (a, b) => { const d = Math.abs(a - b) % 360; return d > 180 ? 360 - d : d; };
/** Relative luminance-ish lightness 0..1 (fast, perceptual enough for remapping ramps). */
export const lum = (c) => { const [r, g, b] = rgb(c); return (0.299 * r + 0.587 * g + 0.114 * b) / 255; };

/**
 * Recolor every painted pixel (base and animation layers): fn('#rrggbb', x, y) -> '#rrggbb' (or the
 * same), or a { from: to } map. See-through pixels keep their opacity. Results are cached per color
 * unless fn takes coordinates.
 */
export function recolor(cv, fn, mask = null) {
  const map = typeof fn === 'function' ? null : Object.fromEntries(Object.entries(fn).map(([a, b]) => [a.toLowerCase(), b]));
  const pos = typeof fn === 'function' && fn.length > 1, cache = new Map();
  const one = (c, x, y) => {
    if (!c) return c;
    const base = c.slice(0, 7).toLowerCase(), a = c.slice(7);
    let out;
    if (map) out = map[base] ?? base;
    else if (pos) out = fn(base, x, y);
    else { if (!cache.has(base)) cache.set(base, fn(base)); out = cache.get(base); }
    return (out || base) + a;
  };
  for (const c of [cv, ...cv.layers.map((l) => l.cv)]) {
    for (let i = 0; i < c.p.length; i++) {
      const x = i % c.w, y = (i - x) / c.w;
      if (c.p[i] && (!mask || mask.has(x, y))) c.p[i] = one(c.p[i], x, y);
    }
  }
  return cv;
}

/** Inside `mask`, move colors of ramp `from` to the same step of ramp `to` (e.g. dark fur -> white bib). */
export function remapIn(cv, mask, from, to, shift = 0) {
  const at = new Map(from.map((c, i) => [c.toLowerCase(), i]));
  return recolor(cv, (c) => (at.has(c) ? to[Math.min(to.length - 1, Math.max(0, Math.round((at.get(c) * (to.length - 1)) / Math.max(1, from.length - 1)) + shift))] : c), mask);
}

/**
 * A recolor function that moves colors whose hue is near `hue` (within `width` degrees, with saturation
 * >= minSat) onto a target ramp by lightness: lightest source -> lightest target. Others pass through.
 */
export function hueToRamp(hue, width, ramp, { minSat = 0.12, lo = 0.05, hi = 0.95 } = {}) {
  return (c) => {
    const [h, s] = toHsv(c);
    if (s < minSat || hueDist(h, hue) > width) return null;
    const t = Math.min(1, Math.max(0, (lum(c) - lo) / (hi - lo)));
    return ramp[Math.min(ramp.length - 1, Math.round(t * (ramp.length - 1)))];
  };
}
/** Chain recolor functions: the first that returns a color wins. */
export const chain = (...fns) => (c) => { for (const f of fns) { const r = f(c); if (r) return r; } return c; };

// ---- canvas --------------------------------------------------------------------------------------
/** Re-punch the base's opening (decor may have been drawn over it). */
export function repunch(cv) {
  const { x, y, w, h, r } = cv.hole;
  return cv.punch(x, y, w, h, r);
}

/** Empty an animation layer (e.g. to replace a base's fireflies with falling leaves). */
export function clearLayer(cv, cls) {
  for (const l of cv.layers) if (l.cls === cls) l.cv.p.fill(null);
  return cv;
}

/** Erase a region of the base art (to redraw something there). */
export function erase(cv, mask) {
  for (const c of [cv, ...cv.layers.map((l) => l.cv)]) c.fill(mask, null);
  return cv;
}

/** Smooth 1-D value noise (seeded) for lumpy snow lines and drips. */
export function noise1(seed = 1) {
  const r = (i) => { const t = Math.sin((i + seed * 97.13) * 12.9898) * 43758.5453; return t - Math.floor(t); };
  return (x) => { const i = Math.floor(x), f = x - i, u = f * f * (3 - 2 * f); return r(i) * (1 - u) + r(i + 1) * u; };
}

/** Upward-facing surfaces: [{ y, x0, x1 }] runs of painted pixels with nothing above, at least minRun wide. */
export function surfaces(cv, { area = null, minRun = 5 } = {}) {
  const solid = cv.opaque(), out = [], o = cv.hole;
  const inHole = (x, y) => !!o && x >= o.x && y >= o.y && x < o.x + o.w && y < o.y + o.h; // never inside the screen opening
  for (let y = 1; y < cv.h; y++) {
    let x0 = -1;
    for (let x = 0; x <= cv.w; x++) {
      const top = x < cv.w && solid.has(x, y) && !solid.has(x, y - 1) && (!area || area.has(x, y)) && !inHole(x, y - 1);
      if (top && x0 < 0) x0 = x;
      if (!top && x0 >= 0) { if (x - x0 >= minRun) out.push({ y, x0, x1: x - 1 }); x0 = -1; }
    }
  }
  return out;
}

/**
 * Pillowy snow resting on every upward-facing surface (wider than minRun) inside `area`: a row of soft
 * overlapping mounds up to `depth` px tall that round over the ends and drip a little down the face,
 * shaded with ramp S (dark -> light, >= 4) and outlined in ink. Returns the snow mask.
 */
export function snowCap(cv, S, { area = null, depth = 4, minRun = 5, seed = 3, drips = true, overhang = 2 } = {}) {
  const solid = cv.opaque(), n = noise1(seed), r = rng(seed), snow = cv.mask();
  for (const { y, x0, x1 } of surfaces(cv, { area, minRun })) {
    const len = x1 - x0 + 1, d = Math.min(depth, Math.max(2, Math.round(len / 4)));
    for (let x = x0 - overhang; x <= x1 + overhang; x++) {
      const end = Math.min(x - x0 + overhang + 1, x1 + overhang - x + 1); // 1 at the very tip
      const h = Math.max(1, Math.min(Math.round(d * (0.35 + 0.65 * n(x * 0.09))), end + 1));
      for (let k = 0; k < h; k++) if (!solid.has(x, y - 1 - k)) snow.put(x, y - 1 - k);
      if (solid.has(x, y)) snow.put(x, y); // the edge of the surface disappears under the snow
    }
    if (!drips) continue;
    for (let x = x0 + 3 + Math.floor(r() * 8); x < x1 - 4; x += 9 + Math.floor(r() * 14)) { // rounded drips draped over the edge
      const k = 1 + Math.floor(r() * 3), w = 2 + (r() < 0.4 ? 1 : 0);
      for (let i = 0; i < w; i++) for (let j = 1; j <= k - (i === 0 || i === w - 1 ? 1 : 0); j++) if (solid.has(x + i, y + j)) snow.put(x + i, y + j);
    }
  }
  // Shading: lit crest, mid body, a shadowed underside where it meets the surface.
  cv.fill(snow, S[S.length - 2]);
  cv.fill(snow.sub(snow.shift(0, -1)), (x, y) => (solid.has(x, y + 1) ? S[S.length - 3] : S[S.length - 2]));
  cv.fill(snow.sub(snow.shift(0, 1)), S[S.length - 1]);
  cv.fill(snow.sub(snow.shift(0, 1)).sub(snow.shift(-1, 0)), '#ffffff');
  snow.each((x, y) => { if (!snow.has(x, y + 1) && solid.has(x, y + 1) && cv.get(x, y + 1) !== INK) cv.set(x, y + 1, cv.step(cv.get(x, y + 1), -1)); });
  cv.outline(INK, snow, { all: false });
  return snow;
}

/** Icicles hanging below row y between x0 and x1 (pixels already painted there stay). I = ice ramp (4). */
export function icicles(cv, x0, x1, y, I, { seed = 5, max = 7 } = {}) {
  const r = rng(seed), m = cv.mask();
  for (let x = x0; x <= x1;) {
    const big = r() < 0.3, len = big ? Math.round(max * (0.7 + r() * 0.3)) : 2 + Math.floor(r() * Math.max(1, max * 0.5));
    const w = big ? 3 : len > 3 ? 2 : 1;
    for (let k = 0; k < len; k++) {
      const ww = Math.max(1, Math.round(w * (1 - k / len) + 0.35));
      for (let i = 0; i < ww; i++) if (!cv.get(x + i, y + k)) m.put(x + i, y + k);
    }
    x += w + 2 + Math.floor(r() * 5);
  }
  cv.fill(m, (x, yy) => (!m.has(x - 1, yy) ? I[3] : m.has(x + 1, yy) ? I[2] : I[1]));
  m.each((x, yy) => { if (!m.has(x, yy + 1) && yy - y > 1) cv.set(x, yy, I[3]); });
  cv.outline(INK, m, { all: false });
  return m;
}

/** A tiny snowflake (3x3 '+', 5x5 star or 7x7 crystal) in color c with a bright core. */
export function flake(cv, x, y, size, c, core = '#ffffff') {
  const S = {
    3: ['.a.', 'aca', '.a.'],
    5: ['a.a.a', '.aaa.', 'aacaa', '.aaa.', 'a.a.a'],
    7: ['...a...', '.a.a.a.', '..aaa..', 'aaacaaa', '..aaa..', '.a.a.a.', '...a...'],
  }[size];
  S.forEach((row, j) => [...row].forEach((ch, i) => { if (ch !== '.') cv.set(x + i - (size >> 1), y + j - (size >> 1), ch === 'c' ? core : c); }));
  return cv;
}
