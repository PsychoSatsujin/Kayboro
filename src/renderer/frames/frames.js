// Shell frames. Each image's viewBox is size.w x size.h; `hole` is its transparent screen opening as
// fractions of the frame, `aspect` the opening's native width/height, `holeRadius` the opening's corner
// radius as a fraction of the hole width, `fx` its particles and screen glass (see normFx). The starters
// are built in (tools/vectorart/build-starters.js prints their def lines); the rest come from
// the catalog. Keep STARTERS in sync with src/main/economy/catalog.js (test/starters.test.js checks).
const def = (id, name, W, H, x, y, w, h, r = 0, translucent = false) => ({
  id, name, url: new URL(`./${id}.svg`, import.meta.url).href, starter: true, style: 'vector', rarity: 'common',
  size: { w: W, h: H }, hole: { x: x / W, y: y / H, w: w / W, h: h / H }, aspect: w / h, holeRadius: r / w, translucent,
  fx: normFx(STARTER_FX[id]),
});

// Particles + glass of the starters (catalog shells carry theirs in the catalog: tools/shells/fx.json).
export const STARTER_FX = {
  'crt-tv': { particles: 'sparkles', glass: 'crt' },
  'virtual-pet': { particles: 'hearts', glass: 'round' },
  handheld: { particles: 'bubbles', glass: 'round' },
  arcade: { particles: 'pixel-stars', glass: 'crt' },
  bezel: { particles: 'sparkles', glass: 'flat', density: 0.5 },
  'pocket-brick': { particles: 'pixel-stars', glass: 'flat' },
  'wide-pocket': { particles: 'sparkles', glass: 'flat', palette: ['#ffd27a', '#fff4dc', '#ffb6dc'] },
  'split-pad': { particles: 'confetti', glass: 'flat', palette: ['#b98cff', '#ffc89a', '#ffffff'], density: 0.6 },
  'sleek-portable': { particles: 'sparkles', glass: 'flat', palette: ['#c9f0ff', '#e2d4ff', '#ffffff'], density: 0.6 },
  // Plain shells stay plain: screen glass only, no particles.
  'plain-bezel': { glass: 'flat' },
  'plain-handheld': { glass: 'flat' },
  'plain-tv': { glass: 'flat' },
};
export const PARTICLE_TYPES = ['sparkles', 'hearts', 'bubbles', 'pixel-stars', 'petals', 'embers', 'fireflies', 'confetti', 'snow', 'notes'];
export const GLASS_TYPES = ['round', 'crt', 'flat'];
const HEX = /^#[0-9a-f]{6}$/i;
/** A shell's effects, or null: { particles: type|null, glass: type|null, palette?: [hex], density?: 0.2..2 }. */
export function normFx(fx) {
  if (!fx || typeof fx !== 'object') return null;
  const out = { particles: PARTICLE_TYPES.includes(fx.particles) ? fx.particles : null, glass: GLASS_TYPES.includes(fx.glass) ? fx.glass : null };
  if (Array.isArray(fx.palette) && fx.palette.length && fx.palette.length <= 6 && fx.palette.every((c) => HEX.test(c))) out.palette = [...fx.palette];
  if (Number.isFinite(fx.density)) out.density = Math.min(2, Math.max(0.2, fx.density));
  return out.particles || out.glass ? out : null;
}

export const STARTERS = [
  def('crt-tv', 'CRT TV', 1040, 950, 130, 266, 640, 480, 34, false),
  def('virtual-pet', 'Virtual Pet', 1040, 1340, 255, 384, 530, 530, 58, true),
  def('handheld', 'Handheld', 1000, 1580, 220, 198, 560, 420, 18, true),
  def('arcade', 'Arcade Cabinet', 840, 1080, 160, 264, 520, 390, 18, false),
  def('bezel', 'Thin Bezel', 1012, 648, 26, 26, 960, 540, 8, false),
  def('pocket-brick', 'Pocket Brick', 1000, 1600, 240, 256, 520, 468, 8, false),
  def('wide-pocket', 'Wide Pocket', 1500, 960, 450, 206, 600, 400, 10, false),
  def('split-pad', 'Glider Pad', 1740, 850, 390, 132, 960, 540, 10, false),
  def('sleek-portable', 'Sleek Portable', 1800, 870, 420, 156, 960, 540, 10, false),
  // Plain shells: deliberately basic, to use as they are or as templates for your own (docs/MODDING.md).
  def('plain-bezel', 'Plain Bezel', 1056, 636, 48, 48, 960, 540, 12, false),
  def('plain-handheld', 'Plain Handheld', 600, 820, 60, 60, 480, 360, 12, false),
  def('plain-tv', 'Plain TV', 884, 600, 60, 60, 640, 480, 24, false),
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
    translucent: !!it.translucent, author: it.author || 'Kayboro', desc: it.desc || '', tags: it.tags || [],
    collection: it.collection || null, license: it.license || null, fx: normFx(it.fx),
  };
}

/** Merge catalog frames into FRAMES (starters keep their built-in geometry). Returns FRAMES. */
export function setCatalogFrames(items = []) {
  const extra = items.filter(it => !STARTERS.some(s => s.id === it?.id)).map(fromCatalog).filter(Boolean);
  FRAMES.splice(0, FRAMES.length, ...STARTERS, ...extra);
  return FRAMES;
}

export const frameById = id => FRAMES.find(f => f.id === id) || null;

// ---- Skins: alternate artwork for one shell (src/catalog/skins.json). A skin keeps everything about
// its frame (geometry, see-through-ness, particles, glass) and swaps only the image, so every effect
// keyed by the frame URL (depth, finish, fill clarity, pop-out hit testing) follows it.

/** Skin image URL (catalog `file` relative to src/renderer/), or null. */
export const skinUrl = it => (it && SAFE.test(String(it.file || '')) ? new URL(`../${it.file}`, import.meta.url).href : null);

/** The frame wearing `skin` (a catalog SkinItem): its url swapped, plus skin / skinName. Anything else -> the frame as is. */
export function skinned(frame, skin) {
  const url = skin && frame && skin.frame === frame.id ? skinUrl(skin) : null;
  return url ? { ...frame, url, skin: skin.id, skinName: String(skin.name || skin.id) } : frame;
}

/** Skins made for `frameId` (catalog order). */
export const skinsFor = (frameId, skins) => (frameId ? (skins || []).filter(k => k && k.frame === frameId && skinUrl(k)) : []);

/**
 * What a screen shows: its custom frame, else its catalog frame wearing s.skin when that skin exists,
 * belongs to that frame and is owned. `owns(id)` decides ownership.
 */
export function frameForScreen(s, { skins = [], owns = () => false, byId = frameById } = {}) {
  if (!s) return null;
  if (s.customFrame?.url) return { aspect: s.customFrame.hole.w / s.customFrame.hole.h, holeRadius: 0, translucent: false, ...s.customFrame };
  const f = byId(s.frame);
  if (!f || !s.skin) return f;
  const k = (skins || []).find(x => x && x.id === s.skin);
  return k && k.frame === f.id && owns(k.id) ? skinned(f, k) : f;
}
export default FRAMES;
