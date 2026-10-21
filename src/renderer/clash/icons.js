// Fandom Clash: the canvas side of the pixel-art icons (pixel.js does the maths). Every image comes from
// kclash://img/<characterId>, which main serves only from that character's SFW snapshot image; anything
// without one (or that fails to load) gets the procedural placeholder instead.
import { cropRect, iconFromSquare, placeholderIcon } from './pixel.js';
import { hash32 } from './logic.js';

const SIZE = 32, WORK = 96; // icon size; the crop is drawn at WORK x WORK, then box-filtered down
const cache = new Map(); // key -> Promise<dataURL>
const placeholders = new Map();

/** The only image URL the game ever shows for an entity (null when the snapshot has no SFW image for it). */
export const imageUrl = ref => (ref && typeof ref.img === 'string' && ref.img ? `kclash://img/${encodeURIComponent(ref.img)}` : null);

function toDataUrl({ rgba, size }) {
  const c = document.createElement('canvas');
  c.width = c.height = size;
  c.getContext('2d').putImageData(new ImageData(new Uint8ClampedArray(rgba), size, size), 0, 0);
  return c.toDataURL('image/png');
}

/** Placeholder pixel bust for an entity (synchronous; cached). */
export function placeholderUrl(ref) {
  const k = `${ref?.type || 'c'}:${ref?.id ?? ref?.name ?? '?'}`;
  if (!placeholders.has(k)) placeholders.set(k, toDataUrl(placeholderIcon(k, SIZE)));
  return placeholders.get(k);
}

async function fromImage(url) {
  const img = new Image();
  img.crossOrigin = 'anonymous'; // main answers with Access-Control-Allow-Origin, so the canvas stays readable
  img.decoding = 'async';
  img.src = url;
  await img.decode();
  const w = img.naturalWidth, h = img.naturalHeight;
  if (!w || !h) throw new Error('empty image');
  const r = cropRect(w, h);
  const c = document.createElement('canvas');
  c.width = c.height = WORK;
  const ctx = c.getContext('2d', { willReadFrequently: true });
  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = 'high';
  ctx.drawImage(img, r.x, r.y, r.w, r.h, 0, 0, WORK, WORK);
  return toDataUrl(iconFromSquare(ctx.getImageData(0, 0, WORK, WORK).data, WORK, WORK, { size: SIZE, colors: 16 }));
}

/** Promise of the entity's pixel icon as a data URL. */
export function pixelFor(ref) {
  const url = imageUrl(ref);
  if (!url) return Promise.resolve(placeholderUrl(ref));
  if (!cache.has(url)) cache.set(url, fromImage(url).catch(() => placeholderUrl(ref)));
  return cache.get(url);
}

/** An <img> showing the entity's pixel icon: the placeholder at once, swapped for the real one when ready. */
export function avatar(ref, cls = 'cl-px') {
  const el = document.createElement('img');
  el.className = cls;
  el.alt = '';
  el.draggable = false;
  el.width = el.height = SIZE;
  el.src = placeholderUrl(ref);
  if (imageUrl(ref)) pixelFor(ref).then(u => { el.src = u; });
  return el;
}

/** A stable avatar for a player (leaderboards, ghosts): one of the snapshot's characters that has an image. */
export function playerAvatarRef(playerId, characters, avatarId) {
  const list = characters || [];
  if (avatarId) { const a = list.find(c => c.id === avatarId); if (a) return a; }
  const withImg = list.filter(c => c.img);
  const pool = withImg.length ? withImg : list;
  return pool.length ? pool[hash32(playerId || 'x') % pool.length] : { type: 'c', id: playerId, name: '?' };
}

/** Warm the icon cache for the next few entities (a run's upcoming rounds). */
export const prefetch = refs => { for (const r of refs || []) pixelFor(r); };
