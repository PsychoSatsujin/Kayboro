// Fandom Clash: retro pixel-art icons, procedurally, from a character's SFW image. Pure functions on RGBA
// arrays (tested in node); icons.js does the canvas part. Steps: crop to the face/upper area, box-filter
// down to size x size, median-cut to 16 colours, then a rounded mask, a 1px dark outline and a bevel
// highlight. With no image, placeholderIcon() draws a little bust silhouette in a hue from the name.

/** Crop rectangle for an image of w x h: a square from the upper part, where faces usually are. */
export function cropRect(w, h) {
  const side = Math.max(1, Math.round(Math.min(w, h * 0.62, h)));
  const x = Math.round((w - side) / 2);
  const y = h > w ? Math.round(Math.min(h - side, h * 0.04)) : Math.round((h - side) / 2);
  return { x: Math.max(0, x), y: Math.max(0, y), w: side, h: side };
}

/** Box-filter (area average) of an RGBA image down to `size` x `size`. Alpha-weighted colour. */
export function downsample(src, w, h, size) {
  const out = new Uint8ClampedArray(size * size * 4);
  for (let oy = 0; oy < size; oy++) {
    const y0 = Math.floor((oy * h) / size), y1 = Math.max(y0 + 1, Math.floor(((oy + 1) * h) / size));
    for (let ox = 0; ox < size; ox++) {
      const x0 = Math.floor((ox * w) / size), x1 = Math.max(x0 + 1, Math.floor(((ox + 1) * w) / size));
      let r = 0, g = 0, b = 0, a = 0, n = 0;
      for (let y = y0; y < y1; y++) for (let x = x0; x < x1; x++) {
        const i = (y * w + x) * 4, al = src[i + 3];
        r += src[i] * al; g += src[i + 1] * al; b += src[i + 2] * al; a += al; n++;
      }
      const o = (oy * size + ox) * 4;
      if (a > 0) { out[o] = r / a; out[o + 1] = g / a; out[o + 2] = b / a; }
      out[o + 3] = n ? a / n : 0;
    }
  }
  return out;
}

/**
 * Median-cut palette of at most `k` colours from the opaque pixels of `rgba`, then every pixel snapped to
 * its nearest palette colour. Returns { palette: [[r,g,b]], indices: Int16Array (-1 = transparent) }.
 */
export function quantize(rgba, k = 16) {
  const px = [];
  for (let i = 0; i < rgba.length; i += 4) if (rgba[i + 3] >= 128) px.push([rgba[i], rgba[i + 1], rgba[i + 2]]);
  const palette = [];
  if (px.length) {
    let boxes = [px];
    while (boxes.length < k) {
      // Split the box with the widest channel range at its median.
      let best = -1, bestRange = 0, bestCh = 0;
      boxes.forEach((bx, bi) => {
        if (bx.length < 2) return;
        for (let c = 0; c < 3; c++) {
          let lo = 255, hi = 0;
          for (const p of bx) { if (p[c] < lo) lo = p[c]; if (p[c] > hi) hi = p[c]; }
          if (hi - lo > bestRange) { bestRange = hi - lo; best = bi; bestCh = c; }
        }
      });
      if (best < 0 || bestRange === 0) break;
      const bx = boxes[best].slice().sort((p, q) => p[bestCh] - q[bestCh]);
      const mid = bx.length >> 1;
      boxes.splice(best, 1, bx.slice(0, mid), bx.slice(mid));
    }
    for (const bx of boxes) {
      const s = [0, 0, 0];
      for (const p of bx) { s[0] += p[0]; s[1] += p[1]; s[2] += p[2]; }
      palette.push(s.map(v => Math.round(v / bx.length)));
    }
  }
  const indices = new Int16Array(rgba.length / 4).fill(-1);
  for (let i = 0, j = 0; i < rgba.length; i += 4, j++) {
    if (rgba[i + 3] < 128 || !palette.length) continue;
    let bi = 0, bd = Infinity;
    for (let p = 0; p < palette.length; p++) {
      const dr = rgba[i] - palette[p][0], dg = rgba[i + 1] - palette[p][1], db = rgba[i + 2] - palette[p][2];
      const d = 2 * dr * dr + 4 * dg * dg + 3 * db * db; // rough perceptual weights
      if (d < bd) { bd = d; bi = p; }
    }
    indices[j] = bi;
  }
  return { palette, indices };
}

export const OUTLINE = [18, 12, 28];
const lighten = (c, t) => c.map(v => Math.round(v + (255 - v) * t));
const darken = (c, t) => c.map(v => Math.round(v * (1 - t)));

/** Rounded-square mask: corners of radius r are cut. */
export function roundMask(size, r = Math.max(2, Math.round(size / 10))) {
  const m = new Uint8Array(size * size);
  for (let y = 0; y < size; y++) for (let x = 0; x < size; x++) {
    const cx = x < r ? r - x - 0.5 : x >= size - r ? x - (size - r) + 0.5 : 0;
    const cy = y < r ? r - y - 0.5 : y >= size - r ? y - (size - r) + 0.5 : 0;
    m[y * size + x] = cx * cx + cy * cy <= r * r ? 1 : 0;
  }
  return m;
}

/**
 * Finishes a size x size quantized image into an icon: pixels outside `mask` go transparent, the mask's
 * edge becomes a 1px dark outline, the inner top/left edge is lightened (highlight) and the inner
 * bottom/right edge darkened (shade), with a 2px glint in the top-left. Returns RGBA.
 */
export function finishIcon({ palette, indices }, size, mask = roundMask(size)) {
  const out = new Uint8ClampedArray(size * size * 4);
  const inside = (x, y) => x >= 0 && y >= 0 && x < size && y < size && mask[y * size + x] === 1;
  const set = (x, y, c, a = 255) => { const o = (y * size + x) * 4; out[o] = c[0]; out[o + 1] = c[1]; out[o + 2] = c[2]; out[o + 3] = a; };
  for (let y = 0; y < size; y++) for (let x = 0; x < size; x++) {
    if (!inside(x, y)) continue;
    const edge = !inside(x - 1, y) || !inside(x + 1, y) || !inside(x, y - 1) || !inside(x, y + 1);
    if (edge) { set(x, y, OUTLINE); continue; }
    const idx = indices[y * size + x];
    let c = idx >= 0 ? palette[idx] : [40, 34, 56];
    const topLeft = !inside(x - 2, y) || !inside(x, y - 2), botRight = !inside(x + 2, y) || !inside(x, y + 2);
    if (topLeft && !botRight) c = lighten(c, 0.32);
    else if (botRight && !topLeft) c = darken(c, 0.22);
    set(x, y, c);
  }
  const g = Math.max(2, Math.round(size / 10)) + 1; // glint just inside the top-left corner
  for (const [dx, dy] of [[0, 0], [1, 0], [0, 1]]) if (inside(g + dx, g + dy)) set(g + dx, g + dy, [255, 255, 255]);
  return out;
}

/** The whole pipeline from a source RGBA image of w x h. Returns { rgba, size, palette }. */
export function pixelIcon(src, w, h, { size = 32, colors = 16 } = {}) {
  const c = cropRect(w, h);
  const crop = new Uint8ClampedArray(c.w * c.h * 4);
  for (let y = 0; y < c.h; y++) {
    const from = ((c.y + y) * w + c.x) * 4;
    crop.set(src.subarray ? src.subarray(from, from + c.w * 4) : src.slice(from, from + c.w * 4), y * c.w * 4);
  }
  return iconFromSquare(crop, c.w, c.h, { size, colors });
}

/** The pipeline after cropping: an already-square-ish RGBA image (the canvas wrapper crops while drawing). */
export function iconFromSquare(src, w, h, { size = 32, colors = 16 } = {}) {
  const small = downsample(src, w, h, size);
  for (let i = 3; i < small.length; i += 4) small[i] = 255; // photos: treat as opaque
  const q = quantize(small, colors);
  return { rgba: finishIcon(q, size), size, palette: q.palette };
}

/** HSL (h 0-360, s/l 0-1) to [r, g, b]. */
export function hsl(hh, s, l) {
  const k = n => (n + hh / 30) % 12, a = s * Math.min(l, 1 - l);
  const f = n => l - a * Math.max(-1, Math.min(k(n) - 3, Math.min(9 - k(n), 1)));
  return [Math.round(f(0) * 255), Math.round(f(8) * 255), Math.round(f(4) * 255)];
}

/** Placeholder icon for an entity without an image: a bust silhouette on a two-tone backdrop. */
export function placeholderIcon(seed, size = 32) {
  let hsh = 0x811c9dc5;
  for (const ch of String(seed)) { hsh ^= ch.codePointAt(0); hsh = Math.imul(hsh, 0x01000193); }
  const hue = (hsh >>> 0) % 360;
  const palette = [hsl(hue, 0.55, 0.3), hsl(hue, 0.6, 0.42), hsl((hue + 40) % 360, 0.7, 0.75), hsl((hue + 40) % 360, 0.6, 0.6)];
  const indices = new Int16Array(size * size);
  const s = size / 32;
  for (let y = 0; y < size; y++) for (let x = 0; x < size; x++) {
    const u = x / s, v = y / s;
    let i = v < 16 ? 0 : 1; // backdrop
    const head = (u - 16) ** 2 + (v - 13) ** 2 <= 36;
    const body = v >= 21 && Math.abs(u - 16) <= 4 + (v - 21) * 0.9;
    if (head || body) i = u < 15 ? 2 : 3;
    indices[y * size + x] = i;
  }
  return { rgba: finishIcon({ palette, indices }, size), size, palette };
}
