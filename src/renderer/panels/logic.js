// Pure helpers shared by the panels (no DOM): item status, shop filtering and sorting, the reward
// track, wallpapers and presets, the developer form, formatting. Unit tested in test/panels.test.js.
export const RARITIES = ['common', 'rare', 'epic', 'legendary'];
export const SHOP_KINDS = { frames: 'frame', finishes: 'finish', colorways: 'colorway', fills: 'fill' };
export const EQUIP_SLOTS = ['finish', 'colorway', 'fill']; // item.kind === slot name
export const MAX_LEVEL = 100;
export const PRESET_PRICE = 200;
export const DEV_SHARE = 70; // percent of the creator pool that goes to listed developers
export const STEAM_ICON_HOSTS = ['cdn.cloudflare.steamstatic.com', 'shared.cloudflare.steamstatic.com', 'steamcdn-a.akamaihd.net'];

export const rarityRank = r => Math.max(0, RARITIES.indexOf(r));
export const isDlc = item => !!(item?.dlc || item?.price?.usd);
export const owns = (item, st) => !!item && (!!item.starter || !!item.mod || !!st?.inventory?.includes(item.id));
export const isEquipped = (item, st) => !!item && EQUIP_SLOTS.includes(item.kind) && st?.equipped?.[item.kind] === item.id;

// What a shop card offers: equipped | owned | buy | short (not enough coins) | level | dlc | locked.
export function itemStatus(item, st) {
  if (owns(item, st)) return isEquipped(item, st) ? 'equipped' : 'owned';
  if (isDlc(item)) return 'dlc';
  const c = item?.price?.coins;
  if (c > 0) return (st?.coins ?? 0) >= c ? 'buy' : 'short';
  return item?.unlockLevel ? 'level' : 'locked';
}

// Coins still missing to buy `item` (0 when affordable or not for sale).
export const coinsShort = (item, st) => Math.max(0, (item?.price?.coins || 0) - (st?.coins || 0));

// Order for the "Featured" sort: things you can act on first, owned last.
const STATUS_ORDER = { buy: 0, short: 1, level: 2, dlc: 3, locked: 4, equipped: 5, owned: 6 };
// Price ladder: free < coins (ascending) < level unlocks < DLC.
const priceKey = it => (isDlc(it) ? 3e9 + (it.price?.usd || 0) : it.price?.coins ? it.price.coins : it.unlockLevel ? 2e9 + it.unlockLevel : 0);
const byName = (a, b) => String(a.name).localeCompare(String(b.name));

export function filterItems(items, { rarity = 'all', hideOwned = false } = {}, st = null) {
  return (items || []).filter(it => (rarity === 'all' || (it.rarity || 'common') === rarity) && !(hideOwned && owns(it, st)));
}

export function sortItems(items, sort = 'featured', st = null) {
  const list = [...(items || [])];
  const cmp = {
    featured: (a, b) => STATUS_ORDER[itemStatus(a, st)] - STATUS_ORDER[itemStatus(b, st)] || priceKey(a) - priceKey(b) || rarityRank(a.rarity) - rarityRank(b.rarity),
    rarity: (a, b) => rarityRank(b.rarity) - rarityRank(a.rarity) || priceKey(a) - priceKey(b),
    price: (a, b) => priceKey(a) - priceKey(b) || rarityRank(a.rarity) - rarityRank(b.rarity),
  }[sort] || (() => 0);
  return list.sort((a, b) => cmp(a, b) || byName(a, b));
}

// Every catalog item by id (frames, finishes, colorways, fills, wallpapers).
export function indexCatalog(cat) {
  const m = new Map();
  for (const k of ['frames', 'finishes', 'colorways', 'fills', 'wallpapers', 'backdrops']) for (const it of cat?.[k] || []) if (it?.id) m.set(it.id, it);
  return m;
}

// Items whose ids are on the takedown list are hidden everywhere.
export function withoutTakedowns(items, takedowns) {
  const gone = new Set((takedowns?.removed || takedowns || []).map(t => (typeof t === 'string' ? t : t?.id)).filter(Boolean));
  return gone.size ? (items || []).filter(it => !gone.has(it?.id)) : items || [];
}

// Item id -> the first level whose rewards include it.
export function rewardLevels(levels) {
  const m = new Map();
  for (const r of levels || []) for (const id of r?.rewards?.items || []) if (!m.has(id) || m.get(id) > r.level) m.set(id, r.level);
  return m;
}

// Catalog items with unlockLevel filled in from the level rewards when the item has no price of its own.
export const withRewardLevels = (items, levels, m = rewardLevels(levels)) =>
  (items || []).map(it => (it && it.unlockLevel == null && !it.price && m.has(it.id) ? { ...it, unlockLevel: m.get(it.id) } : it));

// Levels 1..max with their rewards and state: claimed (reached), next (level + 1) or locked.
export function rewardTrack(levels, level = 1, max = MAX_LEVEL) {
  const by = new Map((levels || []).filter(Boolean).map(r => [r.level, r]));
  const top = Math.max(max, ...by.keys());
  return Array.from({ length: top }, (_, i) => {
    const l = i + 1, r = by.get(l)?.rewards || {};
    return { level: l, coins: Math.max(0, Math.floor(r.coins) || 0), items: Array.isArray(r.items) ? r.items : [],
      milestone: !!by.get(l)?.milestone || l % 10 === 0, state: l <= level ? 'claimed' : l === level + 1 ? 'next' : 'locked' };
  });
}

export const mergeRewards = (a = {}, b = {}) => ({ coins: (a.coins || 0) + (b.coins || 0), items: [...new Set([...(a.items || []), ...(b.items || [])])] });

// Fraction of the current level done (1 at the cap).
export const levelProgress = st => (st?.xpForNext > 0 ? Math.min(1, Math.max(0, (st.xpIntoLevel || 0) / st.xpForNext)) : 1);

// 3725 -> "1h 2m"; 59 -> "0m"; 400000 -> "111h".
export function fmtDuration(sec) {
  const m = Math.floor(Math.max(0, Number(sec) || 0) / 60), hrs = Math.floor(m / 60);
  return hrs >= 100 ? `${hrs}h` : hrs ? `${hrs}h ${m % 60}m` : `${m}m`;
}

// "just now", "5 min", "2 h 10 min" since `t` (ms).
export function fmtSince(t, now = Date.now()) {
  const m = Math.floor(Math.max(0, now - (Number(t) || now)) / 60000);
  return m < 1 ? 'just now' : m < 60 ? `${m} min` : `${Math.floor(m / 60)} h${m % 60 ? ` ${m % 60} min` : ''}`;
}

// 123456 -> "$1,234.56"
export const fmtUsd = cents => `$${(Math.max(0, Math.round(Number(cents) || 0)) / 100).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

// "12.50" / "$1,200" / "7" -> cents, or null when not a non-negative amount.
export function parseUsd(text) {
  const s = String(text ?? '').replace(/[$,\s]/g, '');
  if (!/^\d+(\.\d{0,2})?$/.test(s)) return null;
  const [d, c = ''] = s.split('.');
  const cents = Number(d) * 100 + Number((c + '00').slice(0, 2));
  return Number.isSafeInteger(cents) ? cents : null;
}

// The 70/30 split of a revenue amount: floor(70%) to developers, the rest to Shellcade.
export function splitRevenue(cents) {
  const c = Math.max(0, Math.floor(Number(cents) || 0)), devs = Math.floor((c * DEV_SHARE) / 100);
  return { devs, shellcade: c - devs };
}

// Games played inside Shellcade, most played first.
export function gameStats(st) {
  return Object.entries(st?.stats?.perApp || {}).filter(([, a]) => a)
    .map(([appid, a]) => ({ appid: Number(appid), name: a.name || `App ${appid}`, playSeconds: a.playSeconds || 0, achievements: a.achievements || 0 }))
    .sort((a, b) => b.playSeconds - a.playSeconds || b.achievements - a.achievements);
}

export const devForApp = (devs, appid) => (appid == null ? null : (devs || []).find(d => d?.apps?.some(a => String(a.appid) === String(appid))) || null);

// Achievement icon URL when it is https on a Steam CDN host (the only remote images allowed), else null.
export function steamIcon(url) {
  try {
    const u = new URL(String(url));
    return u.protocol === 'https:' && STEAM_ICON_HOSTS.includes(u.hostname) ? u.href : null;
  } catch { return null; }
}

const RANKS = [[100, 'Shellcade Master'], [75, 'Living Legend'], [50, 'Cabinet Legend'], [25, 'Shell Collector'], [10, 'Arcade Regular'], [1, 'Rookie Shell']];
export const rankTitle = level => RANKS.find(([l]) => (level || 1) >= l)[1];

export const initials = name => String(name || '?').replace(/\(.*?\)/g, '').split(/[\s:_-]+/).filter(w => /[\p{L}\p{N}]/u.test(w)).slice(0, 2).map(w => [...w][0].toUpperCase()).join('') || '?';

// ---- Wallpapers ----------------------------------------------------------------------------------
// Every wallpaper the user can pick, from four sources, as one shape:
//   { key, source, id, url, type: 'video'|'image'|'gif'|'screensaver', fill, name, preview, credit, mod, usable }
// A reference to one (presets, the active wallpaper) is { source, id } or { source: 'file', url }.
export const WP_SOURCES = ['shellcade', 'mod', 'we', 'file'];
const SOURCE_ALIAS = { shellcade: 'shellcade', catalog: 'shellcade', builtin: 'shellcade', mod: 'mod', mods: 'mod', we: 'we',
  'wallpaper-engine': 'we', wallpaperengine: 'we', workshop: 'we', file: 'file', files: 'file', local: 'file' };
export const wpSource = s => SOURCE_ALIAS[String(s || '').toLowerCase()] || null;
const VIDEO_EXT = /\.(mp4|webm|m4v|mov)(?:[?#]|$)/i, GIF_EXT = /\.gif(?:[?#]|$)/i;

export function mediaType(url, hint) {
  const t = String(hint || '').toLowerCase();
  if (['video', 'image', 'gif', 'screensaver'].includes(t)) return t === 'image' && GIF_EXT.test(url || '') ? 'gif' : t;
  return VIDEO_EXT.test(url || '') ? 'video' : GIF_EXT.test(url || '') ? 'gif' : 'image';
}

export function fileName(url) {
  const last = String(url || '').split(/[?#]/)[0].split(/[\\/]/).pop() || 'File';
  try { return decodeURIComponent(last); } catch { return last; }
}

// Catalog (or mod) wallpaper item. `resolve(file)` turns a path relative to src/renderer/ into a URL.
export function fromCatalogWallpaper(it, resolve = f => f) {
  if (!it?.id) return null;
  const m = it.media || {}, type = mediaType(it.url || m.url || m.file, m.type);
  const fill = type === 'screensaver' ? String(m.fill || m.id || m.file || '') || null : null;
  const url = type === 'screensaver' ? null : it.url || m.url || (m.file ? resolve(m.file) : null);
  const preview = it.previewUrl || (typeof it.preview === 'string' && it.preview ? (/^[a-z]+:/i.test(it.preview) ? it.preview : resolve(it.preview)) : null);
  const source = it.mod ? 'mod' : 'shellcade';
  return { key: `${source}:${it.id}`, source, id: it.id, url, type, fill, palette: Array.isArray(m.palette) ? m.palette : null, name: String(it.name || it.id), preview: preview || (type === 'image' || type === 'gif' ? url : null),
    credit: it.credit || null, mod: it.mod || null, usable: type === 'screensaver' ? !!fill : !!url, rarity: it.rarity || 'common' };
}

// A wallpaper from the user's own Wallpaper Engine folder (listLocalWallpapers()).
export function fromWallpaperEngine(w) {
  if (!w?.id) return null;
  const type = w.type === 'video' ? 'video' : w.type === 'image' ? mediaType(w.fileUrl, 'image') : String(w.type || 'scene');
  return { key: `we:${w.id}`, source: 'we', id: String(w.id), url: w.fileUrl || null, type, fill: null, name: String(w.title || w.id),
    preview: w.previewUrl || null, credit: null, mod: null, usable: !!(w.usable && w.fileUrl) };
}

// Any local image, GIF or video the user picked.
export function fromFile(url, name) {
  if (!url) return null;
  return { key: `file:${url}`, source: 'file', id: null, url, type: mediaType(url), fill: null, name: name || fileName(url),
    preview: VIDEO_EXT.test(url) ? null : url, credit: null, mod: null, usable: true };
}

export function normRef(ref) {
  const source = wpSource(ref?.source);
  if (!source) return null;
  if (source === 'file') return ref.url ? { source, url: String(ref.url) } : null;
  return ref.id != null && ref.id !== '' ? { source, id: String(ref.id) } : null;
}
export const refOf = w => (w ? normRef(w.source === 'file' ? { source: 'file', url: w.url } : { source: w.source, id: w.id }) : null);
export const refKey = ref => { const r = normRef(ref); return r ? `${r.source}:${r.source === 'file' ? r.url : r.id}` : ''; };
export const sameRef = (a, b) => !!a && !!b && refKey(a) === refKey(b);

// The gallery entry a reference points at (files always resolve; others must still exist).
export function resolveRef(ref, entries) {
  const r = normRef(ref);
  if (!r) return null;
  return (entries || []).find(w => w && refKey(refOf(w)) === refKey(r)) || (r.source === 'file' ? fromFile(r.url) : null);
}

// The gallery: catalog + mods, Wallpaper Engine, then picked files (deduped by reference).
export function buildGallery({ catalog = [], we = [], files = [], resolve } = {}) {
  const out = new Map();
  const add = w => { if (w && !out.has(w.key)) out.set(w.key, w); };
  for (const it of catalog || []) add(fromCatalogWallpaper(it, resolve));
  for (const w of we || []) add(fromWallpaperEngine(w));
  for (const f of files || []) add(typeof f === 'string' ? fromFile(f) : fromFile(f?.url, f?.name));
  return [...out.values()];
}

export function filterGallery(list, source = 'all', query = '') {
  const q = String(query || '').trim().toLowerCase();
  return (list || []).filter(w => (source === 'all' || w.source === source) && (!q || w.name.toLowerCase().includes(q)));
}

export const countBySource = list => Object.fromEntries(['all', ...WP_SOURCES].map(s => [s, s === 'all' ? (list || []).length : (list || []).filter(w => w.source === s).length]));

// Saved wallpaper presets as [{ slot, wallpaper: ref|null }], from wallpaperPresets (or legacy backdropSlots).
export function presetsOf(st) {
  if (Array.isArray(st?.wallpaperPresets)) {
    return st.wallpaperPresets.filter(p => p && Number.isInteger(p.slot)).map(p => ({ slot: p.slot, wallpaper: normRef(p.wallpaper) }));
  }
  return (st?.backdropSlots || []).filter(p => p && Number.isInteger(p.slot))
    .map(p => ({ slot: p.slot, wallpaper: p.wallpaperId ? { source: 'we', id: String(p.wallpaperId) } : null }));
}

// The active wallpaper for 'stage' or 'fill' when the state carries one.
export function activeRef(st, target = 'stage') {
  const a = st?.activeWallpaper ?? st?.wallpaper ?? null;
  if (!a) return null;
  if (a.source) return target === 'stage' ? normRef(a) : null;
  return normRef(a[target]);
}

// ---- Developer program form ----------------------------------------------------------------------
const EMAIL = /^[^\s@<>()",;:]+@[^\s@<>()",;:]+\.[a-z]{2,}$/i;
const hostIs = (u, host) => u.hostname === host || u.hostname.endsWith(`.${host}`);
function httpsUrl(s) {
  try {
    const u = new URL(/^[a-z]+:\/\//i.test(s) ? s : `https://${s}`);
    return u.protocol === 'https:' && u.hostname.includes('.') && !u.username && !u.password ? u : null;
  } catch { return null; }
}

// Checks the "List your game" form. Returns { ok, errors: { field: message }, value } with trimmed,
// normalized fields (URLs made https, appids as numbers, empty game rows dropped).
export function validateDevForm(f = {}) {
  const t = k => String(f[k] ?? '').trim();
  const errors = {}, value = { name: t('name'), email: t('email'), kofi: '', paypal: '', patreon: '', website: '', notes: t('notes').slice(0, 2000), agree: !!f.agree, games: [] };
  if (!value.name) errors.name = 'Add your studio or developer name.';
  else if (value.name.length > 80) errors.name = 'Keep the name under 80 characters.';
  if (!EMAIL.test(value.email)) errors.email = 'Add an email we can reach you at.';

  const rows = (Array.isArray(f.games) ? f.games : []).map(g => ({ name: String(g?.name ?? '').trim(), appid: String(g?.appid ?? '').trim() })).filter(g => g.name || g.appid);
  rows.forEach((g, i) => {
    if (!/^\d{1,10}$/.test(g.appid) || !Number(g.appid)) errors[`games.${i}`] = 'Steam appids are numbers, e.g. 1145360.';
    else if (!g.name) errors[`games.${i}`] = 'Add the game name.';
    else value.games.push({ name: g.name.slice(0, 120), appid: Number(g.appid) });
  });
  if (!rows.length) errors.games = 'Add at least one game with its Steam appid.';

  const link = (key, host, label) => {
    const s = t(key);
    if (!s) return;
    const u = httpsUrl(s);
    if (!u || (host && !hostIs(u, host))) errors[key] = `That doesn't look like a ${label} link.`;
    else value[key] = u.href;
  };
  link('kofi', 'ko-fi.com', 'Ko-fi');
  link('patreon', 'patreon.com', 'Patreon');
  link('website', null, 'website');
  const pp = t('paypal');
  if (pp) {
    const u = !EMAIL.test(pp) && httpsUrl(pp);
    if (EMAIL.test(pp)) value.paypal = pp;
    else if (u && (hostIs(u, 'paypal.me') || hostIs(u, 'paypal.com'))) value.paypal = u.href;
    else errors.paypal = 'Use your PayPal email or a paypal.me link.';
  }
  if (!value.kofi && !value.paypal && !value.patreon) errors.payout = 'Add Ko-fi, PayPal or Patreon so we can pay you.';
  if (!value.agree) errors.agree = 'Agree to the 70/30 split to list your game.';
  return { ok: !Object.keys(errors).length, errors, value };
}
