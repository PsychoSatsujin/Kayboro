'use strict';
// Coins, XP, levels and cosmetics. Every coin/XP change is a ledger entry; the state is a replay of the
// ledger plus <dir>/state.json for the purely cosmetic choices (equipped items, backdrop wallpapers).
const fs = require('fs');
const path = require('path');
const { EventEmitter } = require('events');
const { Ledger } = require('./ledger');
const progression = require('./progression');
const catalogLib = require('./catalog');

const RULES = {
  achievement: { coins: 50, xp: 120, firstOfDayBonus: 25 },
  play: { xpPerMinute: 10, xpCapPerDay: 900, secondsPerCoin: 300, coinCapPerDay: 60, maxTickSeconds: 120 },
  backdrop: { price: 200, freeAtLevel: 5, maxSlots: 12 },
};
const SLOTS = { finish: 'finish', colorway: 'colorway', fill: 'fill' };
const DEFAULT_EQUIPPED = { finish: 'none', colorway: 'default', fill: 'starfield' };
const WALLPAPER_ID = /^[^\u0000-\u001f\u007f/\\]{1,200}$/; // a folder name (workshop id or own project)

const pad = (n) => String(n).padStart(2, '0');
const dayKey = (t) => { const d = new Date(t); return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`; };

class Economy extends EventEmitter {
  constructor({ dir, catalog = catalogLib.load, now = Date.now } = {}) {
    super();
    this.dir = dir;
    this.now = now;
    this.catalog = typeof catalog === 'function' ? catalog : () => catalog;
    this.ledger = new Ledger(dir, { now });
    this.session = null; // { appid, name, startedAt } while a game is hosted
    this.prefs = { equipped: { ...DEFAULT_EQUIPPED }, backdrops: {} };
    this.load();
  }

  load() {
    this.r = { coins: 0, xp: 0, days: new Map(), achieved: new Set(), items: new Set(), levels: new Set(), slots: 0,
      flags: new Set(), playSeconds: 0, achievements: 0, perApp: Object.create(null) };
    for (const e of this.ledger.load()) this._apply(e);
    try {
      const p = JSON.parse(fs.readFileSync(path.join(this.dir, 'state.json'), 'utf8'));
      this.prefs = { equipped: { ...DEFAULT_EQUIPPED, ...p.equipped }, backdrops: { ...p.backdrops } };
    } catch {}
    if (this.ledger.tampered) this.addFlag('ledger-tampered');
    this._settleLevels(false);
    return this;
  }

  // ---- Replay -------------------------------------------------------------

  _day(day) {
    if (!this.r.days.has(day)) this.r.days.set(day, { playSeconds: 0, playXp: 0, playCoins: 0, achievements: 0 });
    return this.r.days.get(day);
  }

  _app(appid, name) {
    if (appid == null || !Number.isSafeInteger(Number(appid))) return null;
    const a = (this.r.perApp[appid] = this.r.perApp[appid] || { name: '', playSeconds: 0, achievements: 0 });
    if (name) a.name = String(name);
    return a;
  }

  _apply(e) {
    const r = this.r, ref = e.ref || {};
    r.coins += e.delta.coins;
    r.xp += e.delta.xp;
    if (e.type === 'play') {
      const d = this._day(ref.day || dayKey(e.t));
      const sec = Math.max(0, Math.floor(ref.seconds) || 0);
      d.playSeconds += sec; d.playXp += e.delta.xp; d.playCoins += e.delta.coins;
      r.playSeconds += sec;
      const a = this._app(ref.appid, ref.name);
      if (a) a.playSeconds += sec;
    } else if (e.type === 'achievement') {
      this._day(ref.day || dayKey(e.t)).achievements++;
      r.achieved.add(`${ref.appid}:${ref.apiName}`);
      r.achievements++;
      const a = this._app(ref.appid, ref.game);
      if (a) a.achievements++;
    } else if (e.type === 'purchase') {
      r.items.add(ref.itemId);
    } else if (e.type === 'levelup') {
      r.levels.add(ref.level);
      for (const id of ref.items || []) r.items.add(id);
    } else if (e.type === 'slot') {
      r.slots++;
    } else if (e.type === 'flag') {
      r.flags.add(ref.flag);
    }
  }

  _append(type, delta, ref) {
    const e = this.ledger.append(type, delta, ref);
    this._apply(e);
    return e;
  }

  // Grants the levels.json rewards of every level reached but not yet rewarded.
  _settleLevels(notify = true) {
    const level = progression.levelFromXp(this.r.xp);
    const table = this.catalog().levels;
    for (let l = 2; l <= level; l++) {
      if (this.r.levels.has(l)) continue;
      const rewards = progression.rewardsFor(l, table);
      this._append('levelup', { coins: rewards.coins, xp: 0 }, { level: l, items: rewards.items });
      if (notify) this.emit('levelUp', { level: l, rewards });
    }
  }

  _changed() {
    this._settleLevels();
    this.emit('state', this.getState());
  }

  _savePrefs() {
    try {
      fs.mkdirSync(this.dir, { recursive: true });
      const f = path.join(this.dir, 'state.json');
      fs.writeFileSync(f + '.tmp', JSON.stringify({ v: 1, ...this.prefs }, null, 2));
      fs.renameSync(f + '.tmp', f);
    } catch (err) {
      console.error('[shell] state write failed:', err);
    }
  }

  // ---- Queries ------------------------------------------------------------

  get level() { return progression.levelFromXp(this.r.xp); }

  owns(item) {
    if (!item) return false;
    if (item.starter || this.r.items.has(item.id)) return true;
    if (item.price && item.price.usd) return false;
    if (item.unlockLevel != null) return this.level >= item.unlockLevel;
    return !item.price || item.price.coins === 0;
  }

  _slotInfo() {
    const b = this.catalog().backdrops.find((x) => x.id === 'backdrop-slot') || {};
    return {
      price: (b.price && b.price.coins) || RULES.backdrop.price,
      freeAtLevel: b.freeAtLevel || RULES.backdrop.freeAtLevel,
      max: b.maxSlots || RULES.backdrop.maxSlots,
    };
  }

  slotCount() {
    const s = this._slotInfo();
    return Math.min(s.max, (this.level >= s.freeAtLevel ? 1 : 0) + this.r.slots);
  }

  getState() {
    const cat = this.catalog();
    const idx = catalogLib.index(cat);
    const inventory = new Set([...idx.values()].filter((it) => it.kind !== 'backdrop-slot' && this.owns(it)).map((it) => it.id));
    for (const id of this.r.items) inventory.add(id); // keep items whose catalog file is missing right now
    const equipped = {};
    for (const [slot, kind] of Object.entries(SLOTS)) {
      const id = this.prefs.equipped[slot];
      const it = id == null ? null : idx.get(id);
      equipped[slot] = id == null && slot === 'fill' ? null : it && it.kind === kind && inventory.has(id) ? id : DEFAULT_EQUIPPED[slot];
    }
    const p = progression.progress(this.r.xp);
    return {
      coins: this.r.coins, xp: this.r.xp, level: p.level, xpIntoLevel: p.xpIntoLevel, xpForNext: p.xpForNext,
      inventory: [...inventory], equipped,
      backdropSlots: Array.from({ length: this.slotCount() }, (_, i) => ({ slot: i, wallpaperId: this.prefs.backdrops[i] || null })),
      stats: { totalPlaySeconds: this.r.playSeconds, achievements: this.r.achievements, perApp: JSON.parse(JSON.stringify(this.r.perApp)) },
      session: this.session ? { appid: this.session.appid, name: this.session.name, startedAt: this.session.startedAt } : null,
      flags: [...this.r.flags],
    };
  }

  // ---- Earning ------------------------------------------------------------

  // Hosted play time while play mode is on: 10 XP/min and 1 coin per 5 min, both capped per day.
  addPlayTime(seconds, app = {}) {
    const P = RULES.play;
    seconds = Math.min(P.maxTickSeconds, Math.max(0, Math.round(Number(seconds) || 0)));
    if (!seconds) return null;
    const day = dayKey(this.now());
    const d = this._day(day);
    const total = d.playSeconds + seconds;
    const xp = Math.min(P.xpCapPerDay, Math.floor((total * P.xpPerMinute) / 60)) - d.playXp;
    const coins = Math.min(P.coinCapPerDay, Math.floor(total / P.secondsPerCoin)) - d.playCoins;
    const e = this._append('play', { coins: Math.max(0, coins), xp: Math.max(0, xp) }, { appid: app.appid ?? null, name: app.name || null, seconds, day });
    this._changed();
    return e.delta;
  }

  // A Steam achievement unlocked while its game was hosted. Each (appid, apiName) pays out once ever.
  awardAchievement({ appid, game, apiName, name, desc, iconUrl } = {}) {
    if (appid == null || !apiName || this.r.achieved.has(`${appid}:${apiName}`)) return null;
    const A = RULES.achievement;
    const day = dayKey(this.now());
    const coins = A.coins + (this._day(day).achievements === 0 ? A.firstOfDayBonus : 0);
    this._append('achievement', { coins, xp: A.xp }, { appid, game: game || null, apiName: String(apiName), name: name || null, day });
    const award = { appid, game: game || null, apiName: String(apiName), name: name || String(apiName), desc: desc || '', iconUrl: iconUrl || null, coins, xp: A.xp };
    this.emit('unlock', award); // before any levelUp it causes
    this._changed();
    return award;
  }

  addFlag(flag, info) {
    if (!flag || this.r.flags.has(flag)) return false;
    this._append('flag', { coins: 0, xp: 0 }, { flag: String(flag), ...(info && typeof info === 'object' ? { info } : {}) });
    this.emit('state', this.getState());
    return true;
  }

  // Debug/test only (wired up when SHELLCADE_TEST=1).
  grant({ coins = 0, xp = 0 } = {}) {
    this._append('grant', { coins: Math.max(-this.r.coins, Math.trunc(coins) || 0), xp: Math.max(0, Math.trunc(xp) || 0) }, { debug: true });
    this._changed();
    return this.getState();
  }

  // ---- Spending -----------------------------------------------------------

  purchase(itemId) {
    if (itemId === 'backdrop-slot') return this.buyBackdropSlot();
    const item = catalogLib.index(this.catalog()).get(itemId);
    const fail = (reason) => ({ ok: false, reason, state: this.getState() });
    if (!item) return fail('unknown');
    if (this.owns(item)) return fail('owned');
    if (item.price && item.price.usd) return fail('paid');
    if (!item.price || !item.price.coins) return fail('locked');
    if (this.r.coins < item.price.coins) return fail('insufficient');
    this._append('purchase', { coins: -item.price.coins, xp: 0 }, { itemId: item.id });
    this._changed();
    return { ok: true, state: this.getState() };
  }

  equip(slot, itemId) {
    const fail = (reason) => ({ ok: false, reason, state: this.getState() });
    if (!Object.prototype.hasOwnProperty.call(SLOTS, slot)) return fail('slot');
    if (itemId == null) itemId = slot === 'fill' ? null : DEFAULT_EQUIPPED[slot];
    if (itemId !== null) {
      const item = catalogLib.index(this.catalog()).get(itemId);
      if (!item || item.kind !== SLOTS[slot]) return fail('unknown');
      if (!this.owns(item)) return fail('locked');
    }
    this.prefs.equipped[slot] = itemId;
    this._savePrefs();
    this._changed();
    return { ok: true, state: this.getState() };
  }

  buyBackdropSlot() {
    const s = this._slotInfo();
    const fail = (reason) => ({ ok: false, reason, state: this.getState() });
    if (this.slotCount() >= s.max) return fail('max');
    if (this.r.coins < s.price) return fail('insufficient');
    this._append('slot', { coins: -s.price, xp: 0 }, { slot: this.r.slots });
    this._changed();
    return { ok: true, state: this.getState() };
  }

  setBackdropSlot(slot, wallpaperId) {
    const fail = (reason) => ({ ok: false, reason, state: this.getState() });
    if (!Number.isInteger(slot) || slot < 0 || slot >= this.slotCount()) return fail('slot');
    if (wallpaperId != null && !(typeof wallpaperId === 'string' && WALLPAPER_ID.test(wallpaperId))) return fail('invalid');
    if (wallpaperId == null) delete this.prefs.backdrops[slot];
    else this.prefs.backdrops[slot] = wallpaperId;
    this._savePrefs();
    this._changed();
    return { ok: true, state: this.getState() };
  }

  setSession(s) {
    this.session = s ? { appid: s.appid ?? null, name: s.name || '', startedAt: s.startedAt || this.now() } : null;
    this.emit('state', this.getState());
  }
}

module.exports = { Economy, RULES, DEFAULT_EQUIPPED, dayKey };
