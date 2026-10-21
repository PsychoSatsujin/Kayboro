'use strict';
// Weekly bundles (pure): a set of shells, skins and looks sold together at a discount for one ISO week.
// A developer curates a week in the app's Bundle Studio, which saves a bundle file; tools/bundles/publish.mjs
// adds it to src/catalog/bundles.json. Any week nobody curated gets an automatic bundle, built from the
// week number so every player sees the same one.
const RARITY_VALUE = { common: 150, rare: 300, epic: 550, legendary: 1000 };
const WEEK = /^(\d{4})-W(\d{2})$/;
const KINDS = ['frames', 'finishes', 'colorways', 'fills', 'skins'];
const DEFAULT_DISCOUNT = 0.3;

/** ISO 8601 week of a date, as 'YYYY-Www'. */
function isoWeek(date = new Date()) {
  const d = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()));
  const day = d.getUTCDay() || 7;
  d.setUTCDate(d.getUTCDate() + 4 - day); // the Thursday of this week decides its year
  const year = d.getUTCFullYear(), first = new Date(Date.UTC(year, 0, 1));
  const week = Math.ceil(((d - first) / 86400000 + 1) / 7);
  return `${year}-W${String(week).padStart(2, '0')}`;
}

// Every item a bundle may hold: catalog frames and looks that are not built-in starters, not paid DLC
// and not fan art (fan art is never sold or given away as a reward).
function sellable(cat) {
  const out = new Map();
  for (const k of KINDS) for (const it of cat[k] || []) {
    if (!it || it.starter || it.dlc || it.price?.usd || it.license === 'fan-art' || it.id === 'default' || it.id === 'none') continue;
    out.set(it.id, it);
  }
  return out;
}

const value = (it) => (it.price?.coins > 0 ? it.price.coins : RARITY_VALUE[it.rarity] || RARITY_VALUE.common);

/** A clean bundle, or null. Unknown or duplicate items are dropped; it needs 2 to 8 items left. */
function normBundle(raw, items) {
  if (!raw || typeof raw !== 'object' || !WEEK.test(String(raw.week))) return null;
  const ids = [...new Set((Array.isArray(raw.items) ? raw.items : []).map(String))].filter((id) => items.has(id)).slice(0, 8);
  if (ids.length < 2) return null;
  const discount = Number.isFinite(raw.discount) ? Math.min(0.6, Math.max(0, raw.discount)) : DEFAULT_DISCOUNT;
  const name = String(raw.name || '').trim().slice(0, 48) || `Bundle ${raw.week}`;
  return { id: `bundle-${String(raw.week).toLowerCase()}`, week: String(raw.week), name, desc: String(raw.desc || '').trim().slice(0, 200),
    items: ids, discount, curated: raw.curated !== false, author: raw.author ? String(raw.author).slice(0, 40) : 'Kayboro' };
}

// Small deterministic PRNG (mulberry32) seeded from a string.
function rng(seed) {
  let a = [...String(seed)].reduce((h, c) => Math.imul(h ^ c.charCodeAt(0), 2654435761) >>> 0, 1779033703);
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
const pick = (list, r) => list[Math.floor(r() * list.length)];
const shuffle = (list, r) => { const a = [...list]; for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(r() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; } return a; };
const title = (s) => String(s).split(/[-_ ]+/).map((w) => w.charAt(0).toUpperCase() + w.slice(1)).join(' ');

/** The automatic bundle for `week`: three frames from one collection (or theme) plus a finish, a colorway and a fill. */
function autoBundle(week, cat) {
  const items = sellable(cat), r = rng(week);
  const frames = [...items.values()].filter((it) => it.kind === 'frame');
  const groups = new Map();
  for (const f of frames) { const g = f.collection || f.theme || 'classic'; if (!groups.has(g)) groups.set(g, []); groups.get(g).push(f); }
  const big = [...groups.entries()].filter(([, list]) => list.length >= 3).sort(([a], [b]) => (a < b ? -1 : 1));
  const [group, list] = big.length ? pick(big, r) : ['mixed', frames];
  const chosen = shuffle(list, r).slice(0, 3);
  for (const kind of ['finish', 'colorway', 'fill']) {
    const looks = [...items.values()].filter((it) => it.kind === kind).sort((a, b) => (a.id < b.id ? -1 : 1));
    if (looks.length) chosen.push(pick(looks, r));
  }
  return normBundle({ week, name: `${title(group)} Week`, desc: `This week's picks from ${title(group)}, with a finish, a color and a fill to match.`,
    items: chosen.map((it) => it.id), discount: DEFAULT_DISCOUNT, curated: false, author: 'Kayboro' }, items);
}

/** This week's bundle: the curated one for `week` if there is one, else the automatic one. */
function weekly(cat, curated = [], date = new Date()) {
  const week = isoWeek(date), items = sellable(cat);
  const mine = (curated || []).map((b) => normBundle(b, items)).find((b) => b && b.week === week);
  return mine || autoBundle(week, cat);
}

/** What `bundle` costs a player who owns `owns(id)`: { coins, full, missing: [ids], items: [item] }. */
function quote(bundle, cat, owns) {
  const items = sellable(cat), list = bundle.items.map((id) => items.get(id)).filter(Boolean);
  const missing = list.filter((it) => !owns(it.id));
  const full = missing.reduce((s, it) => s + value(it), 0);
  return { coins: Math.round((full * (1 - bundle.discount)) / 10) * 10, full, missing: missing.map((it) => it.id), items: list };
}

module.exports = { isoWeek, sellable, normBundle, autoBundle, weekly, quote, value, RARITY_VALUE, DEFAULT_DISCOUNT, WEEK };
