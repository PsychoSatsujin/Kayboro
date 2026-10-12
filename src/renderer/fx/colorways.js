// Colorways recolour a frame image with a CSS filter. A partial sepia first gives grey or beige
// shells a hue to rotate, so every colorway reads clearly on any frame. 'clear' also lowers the
// shell's opacity so the equipped shell fill glows through it.
export const COLORWAYS = {
  default: { filter: 'none', shellOpacity: 1 },
  berry: { filter: 'sepia(.5) saturate(2.4) hue-rotate(292deg) brightness(.97)', shellOpacity: 1 },
  mint: { filter: 'sepia(.45) saturate(1.35) hue-rotate(112deg) brightness(1.06)', shellOpacity: 1 },
  midnight: { filter: 'sepia(.4) saturate(1.9) hue-rotate(188deg) brightness(.62) contrast(1.12)', shellOpacity: 1 },
  sunset: { filter: 'sepia(.45) saturate(2.3) hue-rotate(-14deg) brightness(1.04)', shellOpacity: 1 },
  mono: { filter: 'grayscale(1) contrast(1.08) brightness(1.03)', shellOpacity: 1 },
  gold: { filter: 'sepia(1) saturate(2.1) hue-rotate(-9deg) brightness(.9) contrast(1.25)', shellOpacity: 1 },
  clear: { filter: 'saturate(.8) brightness(1.1)', shellOpacity: 0.55 },
};
export const COLORWAY_IDS = Object.keys(COLORWAYS);

export const colorwayOf = id => COLORWAYS[id] || COLORWAYS.default;

// Applies the colorway to the frame <img>; the returned function restores its previous look.
const applied = new WeakMap();
export function applyColorway(imgEl, id) {
  applied.get(imgEl)?.();
  const { filter, shellOpacity } = colorwayOf(id), s = imgEl.style, prev = [s.filter, s.opacity];
  s.filter = filter === 'none' ? '' : filter;
  s.opacity = shellOpacity < 1 ? String(shellOpacity) : '';
  const undo = () => {
    if (applied.get(imgEl) !== undo) return;
    applied.delete(imgEl);
    [s.filter, s.opacity] = prev;
  };
  applied.set(imgEl, undo);
  return undo;
}
