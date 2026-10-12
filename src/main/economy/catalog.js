'use strict';
// Loads the shop catalog from src/catalog/*.json. Frame lists are optional (missing/broken files are
// skipped); the five built-in starter frames are always present, free and owned.
const fs = require('fs');
const path = require('path');

const DIR = path.join(__dirname, '..', '..', 'catalog');
const FILES = { frames: ['frames-pixel.json', 'frames-vector.json'], finishes: ['finishes.json'], colorways: ['colorways.json'],
  fills: ['fills.json'], backdrops: ['backdrops.json'], levels: ['levels.json'], developers: ['developers.json'] };
const KINDS = { frames: 'frame', finishes: 'finish', colorways: 'colorway', fills: 'fill', backdrops: 'backdrop-slot' };
const RARITY = ['common', 'rare', 'epic', 'legendary'];
const SAFE_FILE = /^frames\/(?:[\w-]+\/)*[\w-]+\.(?:svg|png|webp)$/;

// Mirrors src/renderer/frames/frames.js (an ES module the main process can't require).
const starter = (id, name, W, H, x, y, w, h) => ({
  id, name, kind: 'frame', style: 'vector', theme: 'classic', rarity: 'common', price: null, unlockLevel: null,
  file: `frames/${id}.svg`, size: { w: W, h: H }, hole: { x: x / W, y: y / H, w: w / W, h: h / H }, holeRadius: 0,
  aspect: w / h, translucent: false, author: 'Shellcade', tags: ['starter'], starter: true,
});
const STARTERS = [
  starter('crt-tv', 'CRT TV', 1000, 800, 100, 90, 640, 480),
  starter('virtual-pet', 'Virtual pet', 600, 720, 180, 200, 240, 240),
  starter('handheld', 'Handheld', 600, 1000, 130, 110, 340, 306),
  starter('arcade', 'Arcade cabinet', 800, 1000, 150, 200, 500, 375),
  starter('bezel', 'Thin bezel', 1000, 600, 20, 20, 960, 540),
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

const price = (p) => (p && Number.isInteger(p.coins) && p.coins >= 0 ? { coins: p.coins }
  : p && Number.isFinite(p.usd) && p.usd > 0 ? { usd: p.usd } : null);

function normItem(it, kind) {
  if (!it || typeof it !== 'object' || typeof it.id !== 'string' || !/^[\w-]{1,64}$/.test(it.id)) return null;
  const isStarter = STARTERS.includes(it);
  if (kind === 'frame' && !SAFE_FILE.test(String(it.file || ''))) return null;
  return {
    ...it, kind, starter: isStarter, name: String(it.name || it.id), rarity: RARITY.includes(it.rarity) ? it.rarity : 'common', price: price(it.price),
    unlockLevel: Number.isInteger(it.unlockLevel) && it.unlockLevel >= 1 ? it.unlockLevel : null, author: it.author || 'Shellcade',
  };
}

function build() {
  const seen = new Set();
  const out = {};
  for (const [key, kind] of Object.entries(KINDS)) {
    const raw = key === 'frames' ? [...STARTERS, ...FILES.frames.flatMap((f) => readList(f, 'frames'))] : readList(FILES[key][0], key);
    out[key] = raw.map((it) => normItem(it, kind)).filter((it) => it && !seen.has(it.id) && seen.add(it.id));
  }
  out.levels = readList(FILES.levels[0], 'levels').filter((r) => r && Number.isInteger(r.level))
    .map((r) => ({ level: r.level, xpRequired: r.xpRequired, rewards: { coins: Math.max(0, Math.floor(r.rewards?.coins) || 0), items: (r.rewards?.items || []).filter((i) => typeof i === 'string') }, ...(r.milestone ? { milestone: true } : {}) }))
    .sort((a, b) => a.level - b.level);
  out.developers = readList(FILES.developers[0], 'developers').filter((d) => d && typeof d.devId === 'string').map((d) => ({
    devId: d.devId, name: String(d.name || d.devId), blurb: d.blurb ? String(d.blurb) : '',
    apps: (d.apps || []).filter((a) => a && Number.isInteger(Number(a.appid))).map((a) => ({ appid: Number(a.appid), name: String(a.name || a.appid) })),
    links: { patreon: d.links?.patreon || null, kofi: d.links?.kofi || null, itch: d.links?.itch || null, website: d.links?.website || null },
    verified: !!d.verified, sample: !!d.sample,
  }));
  // levels.json is the source of truth for when an item unlocks.
  const byId = index(out);
  for (const r of out.levels) for (const id of r.rewards.items) {
    const it = byId.get(id);
    if (it && !it.price?.usd && (it.unlockLevel == null || r.level < it.unlockLevel)) it.unlockLevel = r.level;
  }
  return out;
}

// Map of every purchasable/equippable item by id.
const index = (cat) => new Map(Object.keys(KINDS).flatMap((k) => cat[k] || []).map((it) => [it.id, it]));

let cache = null;
let cacheKey = '';
function load() {
  const key = Object.values(FILES).flat().map((f) => { try { return fs.statSync(path.join(DIR, f)).mtimeMs; } catch { return 0; } }).join(',');
  if (!cache || key !== cacheKey) { cache = build(); cacheKey = key; }
  return cache;
}

module.exports = { load, index, STARTERS, DIR };
