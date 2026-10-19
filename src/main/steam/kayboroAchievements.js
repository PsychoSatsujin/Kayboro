'use strict';
// Kayboro's own Steam achievements: which ones the economy state has earned, and an unlocker that
// pushes newly earned ones to Steam through selfStats. The rules here are the source of truth for
// the api names; steam/achievements.json carries the names, descriptions and icon motifs that go to
// Steamworks (test/steam-kayboro.test.js keeps the two lists identical).
// Everything is derived from what the main process can observe: economy.getState(), the catalog,
// and ctx = { played (play mode was started this run), mods (mods loaded) }. A coin purchase is read off the
// inventory: an owned coin-priced item below its unlock level can only have been bought.
const catalogLib = require('../economy/catalog');

const COLLECTIONS = { 'pocket-pals': 'KB_COLLECTION_POCKET_PALS', 'coin-op': 'KB_COLLECTION_COIN_OP', 'blue-cel': 'KB_COLLECTION_BLUE_CEL' };
const LEVELS = { 10: 'KB_LEVEL_10', 25: 'KB_LEVEL_25', 50: 'KB_LEVEL_50', 100: 'KB_LEVEL_100' };
const TEN_HOURS = 10 * 3600;

const catalogShells = (cat) => (cat.frames || []).filter((f) => !f.starter && !f.mod);
const byCollection = (cat) => {
  const out = {};
  for (const f of catalogShells(cat)) if (f.collection) (out[f.collection] = out[f.collection] || []).push(f.id);
  return out;
};

// An owned shop item that only coins could have bought: priced in coins, not a level reward reached yet.
const boughtWithCoins = (it, inv, level) => inv.has(it.id) && !it.starter && !it.mod && !!(it.price && it.price.coins > 0) && (it.unlockLevel == null || level < it.unlockLevel);

// Every achievement the state has earned, as api names (sorted, stable). Empty collections earn nothing.
function earned(state, cat, ctx) {
  ctx = ctx && typeof ctx === 'object' ? ctx : {};
  if (!state || typeof state !== 'object') return [];
  const out = new Set();
  const inv = new Set(Array.isArray(state.inventory) ? state.inventory : []);
  const level = Number(state.level) || 1;
  const eq = state.equipped || {};
  const items = [...catalogLib.index(cat || {}).values()];

  if (catalogShells(cat || {}).some((f) => inv.has(f.id))) out.add('KB_FIRST_SHELL');
  if (ctx.played === true) out.add('KB_FIRST_PLAY');
  for (const [l, name] of Object.entries(LEVELS)) if (level >= Number(l)) out.add(name);
  const slots = Array.isArray(state.wallpaperPresets) ? state.wallpaperPresets.length : 0;
  if (slots > 0 || items.some((it) => boughtWithCoins(it, inv, level))) out.add('KB_FIRST_COIN');
  for (const [coll, ids] of Object.entries(byCollection(cat || {}))) {
    if (COLLECTIONS[coll] && ids.length && ids.every((id) => inv.has(id))) out.add(COLLECTIONS[coll]);
  }
  if (Number(state.stats && state.stats.totalPlaySeconds) >= TEN_HOURS) out.add('KB_TIME_10H');
  if (slots > 0) out.add('KB_FIRST_PRESET');
  if (eq.finish && eq.finish !== 'none' && eq.colorway && eq.colorway !== 'default' && eq.fill) out.add('KB_FULL_STYLE');
  if (Number(ctx.mods) > 0) out.add('KB_FIRST_MOD');
  return [...out].sort();
}

const API_NAMES = ['KB_FIRST_SHELL', 'KB_FIRST_PLAY', ...Object.values(LEVELS), 'KB_FIRST_COIN', ...Object.values(COLLECTIONS), 'KB_TIME_10H', 'KB_FIRST_PRESET', 'KB_FULL_STYLE', 'KB_FIRST_MOD'];

// sync(state, cat, ctx) unlocks what is newly earned through stats (a selfStats-like object).
// Each api name is sent once per run; nothing is sent while stats is muted (sandbox/test) or unavailable.
function createUnlocker({ stats, log = console } = {}) {
  const sent = new Set();
  return {
    sent,
    sync(state, cat, ctx) {
      if (!stats || !stats.available || (typeof stats.muted === 'function' && stats.muted())) return [];
      const fresh = [];
      for (const name of earned(state, cat, ctx)) {
        if (sent.has(name)) continue;
        try {
          if (stats.isUnlocked(name) || stats.unlock(name)) {
            sent.add(name);
            fresh.push(name);
          }
        } catch (err) {
          log.warn(`[steam] achievement ${name} failed:`, err.message);
        }
      }
      if (fresh.length && typeof stats.store === 'function') {
        try { stats.store(); } catch {}
      }
      return fresh;
    },
  };
}

module.exports = { earned, createUnlocker, API_NAMES, COLLECTIONS, LEVELS, TEN_HOURS, byCollection };
