'use strict';
// Loads the shop catalog from src/catalog/*.json, appends mod items and hides taken-down ids.
// Frame lists are optional (missing/broken files are skipped); the built-in starter frames are
// always present, free and owned. Wallpapers are never locked: they carry no price.
const fs = require('fs');
const path = require('path');
const { pathToFileURL } = require('url');

const DIR = path.join(__dirname, '..', '..', 'catalog');
const RENDERER = path.join(__dirname, '..', '..', 'renderer');
const FILES = { frames: ['frames-pixel.json', 'frames-vector.json'], finishes: ['finishes.json'], colorways: ['colorways.json'],
  fills: ['fills.json'], wallpapers: ['wallpapers.json'], levels: ['levels.json'], developers: ['developers.json'], takedowns: ['takedowns.json'],
  bundles: ['bundles.json'] };
const KINDS = { frames: 'frame', finishes: 'finish', colorways: 'colorway', fills: 'fill' }; // ownable shop items
const ITEM_KEYS = [...Object.keys(KINDS), 'wallpapers'];
const RARITY = ['common', 'rare', 'epic', 'legendary'];
const SCREENSAVERS = ['starfield', 'bubbles', 'plasma', 'pixel-rain', 'sakura-petals', 'aurora'];
const SAFE_FILE = /^frames\/(?:[\w-]+\/)*[\w-]+\.(?:svg|png|webp)$/;
const WP_FILE = /^wallpapers\/(?:[\w-]+\/)*[\w-]+\.[a-z0-9]+$/i;
const MEDIA = { video: /\.(?:mp4|webm|m4v)$/i, image: /\.(?:png|jpe?g|webp|svg)$/i, gif: /\.gif$/i, preview: /\.(?:png|jpe?g|webp|gif|svg)$/i };
const ID = /^[\w-]{1,64}$/;
const HEX = /^#[0-9a-f]{3,8}$/i;

// Mirrors src/renderer/frames/frames.js (an ES module the main process can't require).
const starter = (id, name, W, H, x, y, w, h, r = 0, translucent = false) => ({
  id, name, kind: 'frame', style: 'vector', theme: 'classic', rarity: 'common', price: null, unlockLevel: null,
  file: `frames/${id}.svg`, size: { w: W, h: H }, hole: { x: x / W, y: y / H, w: w / W, h: h / H }, holeRadius: r / w,
  aspect: w / h, translucent, author: 'Kayboro', tags: ['starter'], starter: true,
});
const STARTERS = [
  starter('crt-tv', 'CRT TV', 1040, 950, 130, 266, 640, 480, 34, false),
  starter('virtual-pet', 'Virtual Pet', 1040, 1340, 255, 384, 530, 530, 58, true),
  starter('handheld', 'Handheld', 1000, 1580, 220, 198, 560, 420, 18, true),
  starter('arcade', 'Arcade Cabinet', 840, 1080, 160, 264, 520, 390, 18, false),
  starter('bezel', 'Thin Bezel', 1012, 648, 26, 26, 960, 540, 8, false),
  starter('pocket-brick', 'Pocket Brick', 1000, 1600, 240, 256, 520, 468, 8, false),
  starter('wide-pocket', 'Wide Pocket', 1500, 960, 450, 206, 600, 400, 10, false),
  starter('split-pad', 'Glider Pad', 1740, 850, 390, 132, 960, 540, 10, false),
  starter('sleek-portable', 'Sleek Portable', 1800, 870, 420, 156, 960, 540, 10, false),
  // Plain shells: deliberately basic, to use as they are or as templates for your own (docs/MODDING.md).
  starter('plain-bezel', 'Plain Bezel', 1056, 636, 48, 48, 960, 540, 12, false),
  starter('plain-handheld', 'Plain Handheld', 600, 820, 60, 60, 480, 360, 12, false),
  starter('plain-tv', 'Plain TV', 884, 600, 60, 60, 640, 480, 24, false),
];

function readList(file, key) {
  try {
    const d = JSON.parse(fs.readFileSync(path.join(DIR, file), 'utf8'));
    const list = Array.isArray(d) ? d : d && d[key];
    return Array.isArray(list) ? list : [];
  } catch (err) {
    if (err.code !== 'ENOENT') console.warn(`[shell] catalog ${file} skipped: ${err.message}`);
    return [];
  }
}

const str = (s, max = 200) => (typeof s === 'string' ? s.replace(/[\u0000-\u001f\u007f]/g, '').trim().slice(0, max) : '');
// A shell's particles + screen glass (mirrors normFx in src/renderer/frames/frames.js).
const PARTICLES = ['sparkles', 'hearts', 'bubbles', 'pixel-stars', 'petals', 'embers', 'fireflies', 'confetti', 'snow', 'notes'];
const GLASS = ['round', 'crt', 'flat'];
function normFx(fx) {
  if (!fx || typeof fx !== 'object') return null;
  const out = { particles: PARTICLES.includes(fx.particles) ? fx.particles : null, glass: GLASS.includes(fx.glass) ? fx.glass : null };
  if (Array.isArray(fx.palette) && fx.palette.length && fx.palette.length <= 6 && fx.palette.every((c) => /^#[0-9a-f]{6}$/i.test(c))) out.palette = [...fx.palette];
  if (Number.isFinite(fx.density)) out.density = Math.min(2, Math.max(0.2, fx.density));
  return out.particles || out.glass ? out : null;
}
const price = (p) => (p && Number.isInteger(p.coins) && p.coins >= 0 ? { coins: p.coins }
  : p && Number.isFinite(p.usd) && p.usd > 0 ? { usd: p.usd } : null);
const palette = (p) => (Array.isArray(p) && p.length && p.length <= 6 && p.every((c) => HEX.test(c)) ? [...p] : null);

function normItem(it, kind) {
  if (!it || typeof it !== 'object' || typeof it.id !== 'string' || !ID.test(it.id)) return null;
  if (kind === 'frame' && !SAFE_FILE.test(String(it.file || ''))) return null;
  const out = {
    ...it, kind, starter: STARTERS.includes(it), name: String(it.name || it.id), rarity: RARITY.includes(it.rarity) ? it.rarity : 'common', price: price(it.price),
    unlockLevel: Number.isInteger(it.unlockLevel) && it.unlockLevel >= 1 ? it.unlockLevel : null, author: it.author || 'Kayboro',
  };
  if (kind === 'frame') { const fx = normFx(it.fx); if (fx) out.fx = fx; else delete out.fx; }
  // Paid designs ship as Steam DLC: passed through as a badge, never bought with coins.
  if (it.dlc && typeof it.dlc === 'object') out.dlc = { appid: Number.isSafeInteger(it.dlc.appid) && it.dlc.appid > 0 ? it.dlc.appid : null };
  else delete out.dlc;
  return out;
}

// A wallpaper item. `resolve(file, re)` turns a media/preview path into a URL (null when unusable).
// Types: video, image, gif, or screensaver ({fill, palette?}: one of the fill animations).
function normWallpaper(it, resolve) {
  if (!it || typeof it !== 'object' || typeof it.id !== 'string' || !ID.test(it.id)) return null;
  const m = it.media && typeof it.media === 'object' ? it.media : {};
  const type = String(m.type || '').toLowerCase();
  let media;
  if (type === 'screensaver') {
    if (!SCREENSAVERS.includes(m.fill)) return null;
    media = { type, fill: m.fill, ...(palette(m.palette) ? { palette: palette(m.palette) } : {}) };
  } else {
    const url = MEDIA[type] && type !== 'preview' ? resolve(m.file, MEDIA[type]) : null;
    if (!url) return null;
    media = { type, file: String(m.file), url };
  }
  const previewUrl = it.preview ? resolve(it.preview, MEDIA.preview) : null;
  const c = it.credit && typeof it.credit === 'object' ? it.credit : null;
  return {
    id: it.id, kind: 'wallpaper', name: str(it.name) || it.id, desc: str(it.desc, 500), media,
    preview: previewUrl ? String(it.preview) : null, previewUrl, rarity: RARITY.includes(it.rarity) ? it.rarity : 'common',
    credit: c ? { artist: str(c.artist), source: str(c.source), url: /^https:\/\//.test(c.url) ? str(c.url, 500) : null } : null,
    author: str(it.author) || 'Kayboro', tags: Array.isArray(it.tags) ? it.tags.filter((t) => typeof t === 'string') : [], price: null,
  };
}

const rendererFile = (f, re) => (WP_FILE.test(String(f || '')) && re.test(f) && !String(f).includes('..') ? pathToFileURL(path.join(RENDERER, f)).href : null);

function build() {
  const seen = new Set();
  const out = {};
  for (const [key, kind] of Object.entries(KINDS)) {
    const raw = key === 'frames' ? [...STARTERS, ...FILES.frames.flatMap((f) => readList(f, 'frames'))] : readList(FILES[key][0], key);
    out[key] = raw.map((it) => normItem(it, kind)).filter((it) => it && !seen.has(it.id) && seen.add(it.id));
  }
  out.wallpapers = readList(FILES.wallpapers[0], 'wallpapers').map((it) => normWallpaper(it, rendererFile)).filter((it) => it && !seen.has(it.id) && seen.add(it.id));
  out.levels = readList(FILES.levels[0], 'levels').filter((r) => r && Number.isInteger(r.level))
    .map((r) => ({ level: r.level, xpRequired: r.xpRequired, rewards: { coins: Math.max(0, Math.floor(r.rewards?.coins) || 0), items: (r.rewards?.items || []).filter((i) => typeof i === 'string') }, ...(r.milestone ? { milestone: true } : {}) }))
    .sort((a, b) => a.level - b.level);
  out.developers = readList(FILES.developers[0], 'developers').filter((d) => d && typeof d.devId === 'string').map((d) => ({
    devId: d.devId, name: String(d.name || d.devId), blurb: d.blurb ? String(d.blurb) : '',
    apps: (d.apps || []).filter((a) => a && Number.isInteger(Number(a.appid))).map((a) => ({ appid: Number(a.appid), name: String(a.name || a.appid) })),
    links: { patreon: d.links?.patreon || null, kofi: d.links?.kofi || null, itch: d.links?.itch || null, website: d.links?.website || null },
    verified: !!d.verified, sample: !!d.sample,
  }));
  out.bundles = readList(FILES.bundles[0], 'bundles').filter((b) => b && typeof b === 'object'); // validated per week by bundles.js
  out.takedowns = readList(FILES.takedowns[0], 'removed').map((t) => (typeof t === 'string' ? t : t && t.id)).filter((id) => typeof id === 'string' && id);
  // levels.json is the source of truth for when an item unlocks.
  const byId = index(out);
  for (const r of out.levels) for (const id of r.rewards.items) {
    const it = byId.get(id);
    if (it && !it.price?.usd && !it.dlc && (it.unlockLevel == null || r.level < it.unlockLevel)) it.unlockLevel = r.level;
  }
  return out;
}

// Appends mod items (already free of id clashes, see mods.js) and removes every taken-down id
// from the items, the level rewards and the developer listing.
function finish(base, mods, extraTakedowns = []) {
  const gone = new Set([...base.takedowns, ...extraTakedowns]);
  const keep = (it) => it && !gone.has(it.id);
  const out = { ...base, takedowns: [...gone] };
  for (const k of ITEM_KEYS) out[k] = [...base[k], ...((mods && mods[k]) || [])].filter(keep);
  out.levels = base.levels.map((r) => ({ ...r, rewards: { ...r.rewards, items: r.rewards.items.filter((id) => !gone.has(id)) } }));
  out.developers = base.developers.filter((d) => !gone.has(d.devId));
  return out;
}

// Map of every ownable item (frames, finishes, colorways, fills) by id.
const index = (cat) => new Map(Object.keys(KINDS).flatMap((k) => cat[k] || []).map((it) => [it.id, it]));

let base = null, baseKey = '', merged = null, mergedFor;
// The catalog with `mods` (a loadMods() result) merged in. Rebuilt when a catalog file changes.
function load(mods = null) {
  const key = Object.values(FILES).flat().map((f) => { try { return fs.statSync(path.join(DIR, f)).mtimeMs; } catch { return 0; } }).join(',');
  if (!base || key !== baseKey) { base = build(); baseKey = key; merged = null; }
  if (!merged || mergedFor !== mods) { merged = finish(base, mods); mergedFor = mods; }
  return merged;
}

// Every id the static catalog uses (mods may not reuse them).
const reservedIds = () => {
  const c = load();
  return new Set(ITEM_KEYS.flatMap((k) => c[k].map((it) => it.id)));
};

module.exports = { load, index, finish, normItem, normFx, PARTICLES, GLASS, normWallpaper, reservedIds, STARTERS, SCREENSAVERS, MEDIA, ID, HEX, DIR, RENDERER };
