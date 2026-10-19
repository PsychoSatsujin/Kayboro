'use strict';
// Cursor geometry for play mode and pop-outs (pure). `view` is where the game's picture sits in a Kayboro window:
// its rect in the window's client area, CSS px {x, y, w, h}, as the renderer measured it. `content` is
// that window's content bounds (DIP) and `zoom` its zoom factor (CSS px * zoom = DIP). Entering play puts
// the real cursor on the game at the spot under the mouse; leaving puts it back over the picture where
// the drawn cursor was, so it never stays behind on a screen nobody can see.

const clamp01 = (n) => Math.min(1, Math.max(0, Number.isFinite(n) ? n : 0.5));
const okRect = (r) => !!r && [r.x, r.y, r.w, r.h].every(Number.isFinite) && r.w > 0 && r.h > 0;
const z = (zoom) => (zoom > 0 ? zoom : 1);

/** DIP point for (u, v) in the picture; the window's centre when the view is unknown. */
function viewPoint(view, content, zoom, u, v) {
  if (!okRect(view)) return { x: Math.round(content.x + content.width / 2), y: Math.round(content.y + content.height / 2) };
  return { x: Math.round(content.x + (view.x + clamp01(u) * view.w) * z(zoom)), y: Math.round(content.y + (view.y + clamp01(v) * view.h) * z(zoom)) };
}

/** (u, v) of DIP point `p` over the picture, or null when it is outside it (or the view is unknown). */
function viewUV(view, content, zoom, p) {
  if (!okRect(view) || !p) return null;
  const u = ((p.x - content.x) / z(zoom) - view.x) / view.w, v = ((p.y - content.y) / z(zoom) - view.y) / view.h;
  return u >= 0 && u <= 1 && v >= 0 && v <= 1 ? { u, v } : null;
}

/** Physical point for (u, v) in a client rect {x, y, width, height}, kept inside it. */
function rectPoint(r, u, v) {
  return { x: Math.round(r.x + Math.min(r.width - 1, clamp01(u) * r.width)), y: Math.round(r.y + Math.min(r.height - 1, clamp01(v) * r.height)) };
}

/**
 * Rect `b` moved left until it no longer overlaps `avoid` (both {x, y, width, height}), with `gap` between
 * them; unchanged when they don't overlap. A new pop-out uses it to open beside the sidebar, not under the
 * mouse that clicked Pop Out.
 */
function clearOf(b, avoid, gap = 12) {
  const ok = (r) => !!r && [r.x, r.y, r.width, r.height].every(Number.isFinite) && r.width > 0 && r.height > 0;
  if (!ok(b) || !ok(avoid)) return b;
  const overlaps = b.x < avoid.x + avoid.width && avoid.x < b.x + b.width && b.y < avoid.y + avoid.height && avoid.y < b.y + b.height;
  return overlaps ? { ...b, x: Math.round(avoid.x - gap - b.width) } : b;
}

module.exports = { viewPoint, viewUV, rectPoint, clearOf };
