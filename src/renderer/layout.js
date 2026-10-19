// Pure geometry helpers (no DOM). Rects are {x, y, w, h}. Unit-tested in test/layout.test.js.

const pos = n => typeof n === 'number' && Number.isFinite(n) && n > 0;

/** '16:9' | '5x4' | '1.6' | 1.6 -> width/height ratio; 'free', 'source' or invalid -> null. */
export function parseAspect(v) {
  if (typeof v === 'number') return pos(v) ? v : null;
  if (typeof v !== 'string') return null;
  const s = v.trim();
  const m = /^(\d*\.?\d+)\s*[:x/]\s*(\d*\.?\d+)$/i.exec(s);
  const a = m ? +m[1] / +m[2] : /^\d*\.?\d+$/.test(s) ? +s : NaN;
  return pos(a) ? a : null;
}

/** Place content of the given aspect inside box: 'contain' (letterbox), 'cover' (crop) or 'stretch'. */
export function fitRect(aspect, box, mode = 'contain') {
  const { x, y, w, h } = box;
  if (mode === 'stretch' || !pos(aspect) || !pos(w) || !pos(h)) return { x, y, w, h };
  const wider = aspect > w / h;
  const byWidth = mode === 'cover' ? !wider : wider;
  const fw = byWidth ? w : h * aspect, fh = byWidth ? w / aspect : h;
  return { x: x + (w - fw) / 2, y: y + (h - fh) / 2, w: fw, h: fh };
}

/** Drag a resize handle by (dx, dy). Opposite edge/corner stays put; aspect (w/h) locks when given. */
export function resizeRect(rect, handle, dx, dy, aspect = null, minSize = 40) {
  const E = handle.includes('e'), W = handle.includes('w'), N = handle.includes('n'), S = handle.includes('s');
  if (!(E || W || N || S)) return { ...rect };
  let w = rect.w + (E ? dx : W ? -dx : 0);
  let h = rect.h + (S ? dy : N ? -dy : 0);
  const a = pos(aspect) ? aspect : null;
  if (a) {
    if ((E || W) && (N || S)) { if (w / a >= h) h = w / a; else w = h * a; } // corner: dominant axis wins
    else if (E || W) h = w / a;
    else w = h * a;
    if (w < minSize || h < minSize) { if (a >= 1) { h = minSize; w = h * a; } else { w = minSize; h = w / a; } }
  } else {
    w = Math.max(w, minSize);
    h = Math.max(h, minSize);
  }
  const x = W ? rect.x + rect.w - w : E ? rect.x : rect.x + (rect.w - w) / 2;
  const y = N ? rect.y + rect.h - h : S ? rect.y : rect.y + (rect.h - h) / 2;
  return { x, y, w, h };
}

/** Scale a rect about its center. Invalid factors return an unchanged copy. */
export function scaleRect(r, factor) {
  if (!pos(factor)) return { ...r };
  const w = r.w * factor, h = r.h * factor;
  return { x: r.x + (r.w - w) / 2, y: r.y + (r.h - h) / 2, w, h };
}

/** Outer rect for a frame image whose transparent hole (fractions of the frame) must land on contentRect. */
export function frameOuterRect(c, hole) {
  if (!hole || !pos(hole.w) || !pos(hole.h)) return { ...c };
  const w = c.w / hole.w, h = c.h / hole.h;
  return { x: c.x - hole.x * w, y: c.y - hole.y * h, w, h };
}

/** The opening of a frame drawn at outer rect `o` (inverse of frameOuterRect). */
export function holeRect(o, hole) {
  if (!hole || !pos(hole.w) || !pos(hole.h)) return { ...o };
  return { x: o.x + hole.x * o.w, y: o.y + hole.y * o.h, w: hole.w * o.w, h: hole.h * o.h };
}

// The game inside a shell's opening is sized apart from the shell: `zoom` scales the fitted picture about
// the opening's centre and `pan` shifts it by fractions of the opening, so both follow the shell's size.
export const ZOOM_MIN = 0.25, ZOOM_MAX = 4, PAN_MAX = 2;
const fin = (n, d = 0) => (Number.isFinite(n) ? n : d);
export const clampZoom = z => (pos(z) ? Math.min(ZOOM_MAX, Math.max(ZOOM_MIN, z)) : 1);
export const clampPan = n => Math.min(PAN_MAX, Math.max(-PAN_MAX, fin(n)));

/** Where the picture fitted at `base` ends up inside `opening` after zoom and pan. */
export function zoomRect(base, opening, zoom = 1, pan = null) {
  const z = clampZoom(zoom), cx = opening.x + opening.w / 2, cy = opening.y + opening.h / 2;
  return { x: cx + (base.x - cx) * z + clampPan(pan?.x) * opening.w, y: cy + (base.y - cy) * z + clampPan(pan?.y) * opening.h,
    w: base.w * z, h: base.h * z };
}

/** { zoom, pan } that put the picture at `rect` (its centre kept when the zoom is clamped). Inverse of zoomRect. */
export function zoomFor(base, opening, rect) {
  const zoom = clampZoom(rect.w / base.w), cx = opening.x + opening.w / 2, cy = opening.y + opening.h / 2;
  const bx = base.x + base.w / 2 - cx, by = base.y + base.h / 2 - cy;
  return { zoom, pan: { x: clampPan((rect.x + rect.w / 2 - cx - bx * zoom) / opening.w), y: clampPan((rect.y + rect.h / 2 - cy - by * zoom) / opening.h) } };
}

export const isZoomed = s => clampZoom(s?.zoom) !== 1 || !!clampPan(s?.pan?.x) || !!clampPan(s?.pan?.y);

/** Normalized (u, v) inside the captured client area -> stage coordinates. */
export function cursorToStage(u, v, r) {
  return { x: r.x + u * r.w, y: r.y + v * r.h };
}

/**
 * Bounding box (fractions) of transparent pixels (alpha < threshold) 4-connected to the image center.
 * null when the center is opaque, inputs are bad, or the whole image is transparent.
 */
export function findHole(alpha, width, height, threshold = 16) {
  const n = width * height;
  if (!alpha || !(width > 0 && height > 0) || alpha.length < n) return null;
  const cx = width >> 1, cy = height >> 1, start = cy * width + cx;
  if (alpha[start] >= threshold) return null;
  const seen = new Uint8Array(n), stack = new Int32Array(n);
  let sp = 0, x0 = cx, x1 = cx, y0 = cy, y1 = cy;
  const push = i => { if (!seen[i] && alpha[i] < threshold) { seen[i] = 1; stack[sp++] = i; } };
  push(start);
  while (sp) {
    const i = stack[--sp], x = i % width, y = (i - x) / width;
    if (x < x0) x0 = x; if (x > x1) x1 = x; if (y < y0) y0 = y; if (y > y1) y1 = y;
    if (x > 0) push(i - 1);
    if (x < width - 1) push(i + 1);
    if (y > 0) push(i - width);
    if (y < height - 1) push(i + width);
  }
  if (x0 === 0 && y0 === 0 && x1 === width - 1 && y1 === height - 1) return null;
  return { x: x0 / width, y: y0 / height, w: (x1 - x0 + 1) / width, h: (y1 - y0 + 1) / height };
}
