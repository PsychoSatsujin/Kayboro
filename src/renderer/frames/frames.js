// Shell frames. Each image's viewBox is size.w x size.h; `hole` is its transparent screen opening as
// fractions of the frame, `aspect` the opening's native width/height, `holeRadius` the opening's corner
// radius as a fraction of the hole width. The five starters are built in; the rest come from the catalog.
const def = (id, name, W, H, x, y, w, h) => ({
  id, name, url: new URL(`./${id}.svg`, import.meta.url).href, starter: true, style: 'vector', rarity: 'common',
  size: { w: W, h: H }, hole: { x: x / W, y: y / H, w: w / W, h: h / H }, aspect: w / h, holeRadius: 0, translucent: false,
});

export const STARTERS = [
  def('crt-tv', 'CRT TV', 1000, 800, 100, 90, 640, 480),
  def('virtual-pet', 'Virtual pet', 600, 720, 180, 200, 240, 240),
  def('handheld', 'Handheld', 600, 1000, 130, 110, 340, 306),
  def('arcade', 'Arcade cabinet', 800, 1000, 150, 200, 500, 375),
  def('bezel', 'Thin bezel', 1000, 600, 20, 20, 960, 540),
];

// Live list: starters first, catalog frames appended by loadCatalogFrames().
export const FRAMES = [...STARTERS];

const num = (n, d = 0) => (Number.isFinite(n) ? n : d);
const SAFE = /^frames\/(?:[\w-]+\/)*[\w-]+\.(?:svg|png|webp)$/;
const MOD_URL = /^file:\/\/[^?#]+\.(?:svg|png|webp)$/i; // mod frames: absolute URL from main (mods.js)

// Image URL of a catalog frame: `file` relative to src/renderer/, or a mod's own file:// `url`.
const frameUrl = it => (it.mod ? (MOD_URL.test(String(it.url || '')) ? it.url : null)
  : SAFE.test(String(it.file || '')) ? new URL(`../${it.file}`, import.meta.url).href : null);

/** Catalog FrameItem -> frame entry, or null when unusable. */
export function fromCatalog(it) {
  const h = it?.hole, url = it && frameUrl(it);
  if (!it || typeof it.id !== 'string' || !url || !h || !(h.w > 0 && h.h > 0)) return null;
  const size = { w: num(it.size?.w, 1000), h: num(it.size?.h, 1000) };
  return {
    id: it.id, name: String(it.name || it.id), url, starter: !!it.starter, mod: it.mod || null, dlc: it.dlc || null,
    style: it.style || 'vector', theme: it.theme || '', rarity: it.rarity || 'common', price: it.price || null,
    unlockLevel: it.unlockLevel ?? null, size, hole: { x: num(h.x), y: num(h.y), w: h.w, h: h.h },
    aspect: num(it.aspect) > 0 ? it.aspect : (h.w * size.w) / (h.h * size.h), holeRadius: Math.max(0, num(it.holeRadius)),
    translucent: !!it.translucent, author: it.author || 'Shellcade', desc: it.desc || '', tags: it.tags || [],
  };
}

/** Merge catalog frames into FRAMES (starters keep their built-in geometry). Returns FRAMES. */
export function setCatalogFrames(items = []) {
  const extra = items.filter(it => !STARTERS.some(s => s.id === it?.id)).map(fromCatalog).filter(Boolean);
  FRAMES.splice(0, FRAMES.length, ...STARTERS, ...extra);
  return FRAMES;
}

export const frameById = id => FRAMES.find(f => f.id === id) || null;
export default FRAMES;
