// Pure helpers shared by the panels (no DOM): item status, shop filtering and sorting, the reward
// track, formatting. Unit tested in test/panels.test.js.
export const RARITIES = ['common', 'rare', 'epic', 'legendary'];
export const SHOP_KINDS = { frames: 'frame', finishes: 'finish', colorways: 'colorway', fills: 'fill' };
export const EQUIP_SLOTS = ['finish', 'colorway', 'fill']; // item.kind === slot name
export const MAX_LEVEL = 100;
export const STEAM_ICON_HOSTS = ['cdn.cloudflare.steamstatic.com', 'shared.cloudflare.steamstatic.com', 'steamcdn-a.akamaihd.net'];

export const rarityRank = r => Math.max(0, RARITIES.indexOf(r));
export const owns = (item, st) => !!item && (!!item.starter || !!st?.inventory?.includes(item.id));
export const isEquipped = (item, st) => !!item && EQUIP_SLOTS.includes(item.kind) && st?.equipped?.[item.kind] === item.id;

// What a shop card offers: equipped | owned | buy | short (not enough coins) | level | paid | locked.
export function itemStatus(item, st) {
  if (owns(item, st)) return isEquipped(item, st) ? 'equipped' : 'owned';
  if (item?.price?.usd) return 'paid';
  const c = item?.price?.coins;
  if (c > 0) return (st?.coins ?? 0) >= c ? 'buy' : 'short';
  return item?.unlockLevel ? 'level' : 'locked';
}

// Coins still missing to buy `item` (0 when affordable or not for sale).
export const coinsShort = (item, st) => Math.max(0, (item?.price?.coins || 0) - (st?.coins || 0));

// Order for the "Featured" sort: things you can act on first, owned last.
const STATUS_ORDER = { buy: 0, short: 1, level: 2, paid: 3, locked: 4, equipped: 5, owned: 6 };
// Price ladder: free < coins (ascending) < level unlocks < paid.
const priceKey = it => (it.price?.usd ? 3e9 + it.price.usd : it.price?.coins ? it.price.coins : it.unlockLevel ? 2e9 + it.unlockLevel : 0);
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

// Every catalog item by id (frames, finishes, colorways, fills, backdrops).
export function indexCatalog(cat) {
  const m = new Map();
  for (const k of ['frames', 'finishes', 'colorways', 'fills', 'backdrops']) for (const it of cat?.[k] || []) if (it?.id) m.set(it.id, it);
  return m;
}

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

// Games played inside Shellcade, most played first.
export function gameStats(st) {
  return Object.entries(st?.stats?.perApp || {}).filter(([, a]) => a)
    .map(([appid, a]) => ({ appid: Number(appid), name: a.name || `App ${appid}`, playSeconds: a.playSeconds || 0, achievements: a.achievements || 0 }))
    .sort((a, b) => b.playSeconds - a.playSeconds || b.achievements - a.achievements);
}

// Creator-pool play points for one game, as in src/main/economy/revenue.js: minutes + 10 per achievement.
export const playPoints = a => Math.floor(Math.max(0, Number(a?.playSeconds) || 0) / 60) + 10 * Math.max(0, Math.floor(Number(a?.achievements) || 0));

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
