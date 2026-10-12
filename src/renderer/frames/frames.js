// Built-in decorative frames. Each SVG's viewBox is size.w x size.h; `hole` is its transparent
// screen opening as fractions of the frame, `aspect` the opening's native width/height.
const def = (id, name, W, H, x, y, w, h) => ({
  id, name, url: new URL(`./${id}.svg`, import.meta.url).href,
  size: { w: W, h: H }, hole: { x: x / W, y: y / H, w: w / W, h: h / H }, aspect: w / h,
});

export const FRAMES = [
  def('crt-tv', 'CRT TV', 1000, 800, 100, 90, 640, 480),
  def('virtual-pet', 'Virtual pet', 600, 720, 180, 200, 240, 240),
  def('handheld', 'Handheld', 600, 1000, 130, 110, 340, 306),
  def('arcade', 'Arcade cabinet', 800, 1000, 150, 200, 500, 375),
  def('bezel', 'Thin bezel', 1000, 600, 20, 20, 960, 540),
];

export const frameById = id => FRAMES.find(f => f.id === id) || null;
export default FRAMES;
