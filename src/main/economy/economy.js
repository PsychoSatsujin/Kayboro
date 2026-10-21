'use strict';
// Coins, XP, levels, cosmetics, wallpapers and settings, saved as one plain <dir>/state.json.
// Purchases, level-ups and achievements are also appended to <dir>/history.jsonl for reference.
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const { EventEmitter } = require('events');
const progression = require('./progression');
const catalogLib = require('./catalog');
const bundles = require('./bundles');

const RULES = {
  time: { coinsPerMinute: 1, xpPerMinute: 10, maxTickSeconds: 3600 }, // while Kayboro is visible or in play mode
  achievement: { coins: 50, xp: 120 }, // only with settings.rewards.achievements on
  preset: { price: 200 }, // each extra wallpaper preset slot; no maximum
  // Coin bets (Fandom Clash): the stake is held in escrow until settled; open tickets are refunded on the next load.
  bet: { min: 1, max: 500, maxShare: 0.25, maxMultiplier: 5, maxOpen: 5 },
};
const SLOTS = { finish: 'finish', colorway: 'colorway', fill: 'fill' };
const DEFAULT_EQUIPPED = { finish: 'none', colorway: 'default', fill: 'starfield' };
const DEFAULT_SETTINGS = { rewards: { achievements: false } };
const TARGETS = ['stage', 'fill'];
const SOURCES = ['kayboro', 'mod', 'we', 'file'];
const REF_ID = /^[^\u0000-\u001f\u007f/\\]{1,200}$/; // catalog/mod item id or a Wallpaper Engine folder name

const int = (n, min = 0) => Math.max(min, Math.floor(Number(n)) || 0);
const r3 = (n) => Math.round(n * 1000) / 1000;
const clone = (o) => JSON.parse(JSON.stringify(o));
const own = (o, k) => Object.prototype.hasOwnProperty.call(o, k);

// A wallpaper reference: {source: 'kayboro'|'mod'|'we', id} or {source: 'file', url: 'file://...'}; null when malformed.
function wallpaperRef(w) {
  if (!w || typeof w !== 'object' || !SOURCES.includes(w.source)) return null;
  if (w.source === 'file') {
    return typeof w.url === 'string' && w.url.length <= 4096 && /^file:\/\//i.test(w.url) && !/[\u0000-\u001f]/.test(w.url) ? { source: 'file', url: w.url } : null;
  }
  return typeof w.id === 'string' && REF_ID.test(w.id) ? { source: w.source, id: w.id } : null;
}

class Economy extends EventEmitter {
  // ownsDlc(appid): Steam DLC ownership for "dlc" catalog items (the Steam build passes selfStats.ownsDlc).
  constructor({ dir, catalog = catalogLib.load, now = Date.now, ownsDlc = () => false } = {}) {
    super();
    this.dir = dir;
    this.file = path.join(dir, 'state.json');
    this.now = now;
    this.catalog = typeof catalog === 'function' ? catalog : () => catalog;
    this.ownsDlc = typeof ownsDlc === 'function' ? ownsDlc : () => false;
    this.session = null; // { appid, name, startedAt } while a game is hosted
    this.load();
  }

  load() {
    let p = {};
    try {
      p = JSON.parse(fs.readFileSync(this.file, 'utf8')) || {};
    } catch (err) {
      if (err.code !== 'ENOENT') console.error('[shell] state.json unreadable, starting fresh:', err.message);
    }
    const arr = (a) => (Array.isArray(a) ? a.filter((x) => typeof x === 'string') : []);
    const perApp = Object.create(null);
    for (const [id, a] of Object.entries(p.perApp || {})) {
      if (Number.isSafeInteger(Number(id)) && a) perApp[id] = { name: String(a.name || ''), playSeconds: Math.max(0, Number(a.playSeconds) || 0), achievements: int(a.achievements) };
    }
    const presets = {};
    for (const [k, w] of Object.entries(p.presets || {})) if (wallpaperRef(w)) presets[k] = wallpaperRef(w);
    this.s = {
      coins: int(p.coins), xp: int(p.xp), activeSeconds: Math.max(0, Number(p.activeSeconds) || 0), levelRewarded: int(p.levelRewarded, 1),
      items: new Set(arr(p.items)), presetSlots: int(p.presetSlots), presets,
      active: { stage: wallpaperRef(p.active?.stage), fill: wallpaperRef(p.active?.fill) },
      equipped: { ...DEFAULT_EQUIPPED, ...(p.equipped && typeof p.equipped === 'object' ? p.equipped : {}) },
      achieved: new Set(arr(p.achieved)), achievements: int(p.achievements), perApp,
      settings: { rewards: { achievements: p.settings?.rewards?.achievements === true } },
      bets: {},
    };
    this._settleLevels(false);
    // Bets still open when the last run ended (a crash, a closed window mid-round): the stake comes back.
    let refunded = 0;
    for (const [ticket, b] of Object.entries(p.bets && typeof p.bets === 'object' ? p.bets : {})) {
      const amount = int(b && b.amount);
      if (!amount) continue;
      this.s.coins += amount;
      refunded += amount;
      this._log('betRefund', { ticket: String(ticket).slice(0, 40), coins: amount, reason: 'restart' });
    }
    if (refunded) this._save();
    return this;
  }

  _save() {
    const s = this.s;
    const data = { v: 2, ...s, items: [...s.items], achieved: [...s.achieved], perApp: { ...s.perApp } };
    try {
      fs.mkdirSync(this.dir, { recursive: true });
      fs.writeFileSync(this.file + '.tmp', JSON.stringify(data, null, 1));
      fs.renameSync(this.file + '.tmp', this.file);
    } catch (err) {
      console.error('[shell] state write failed:', err);
    }
  }

  _log(type, data) {
    try {
      fs.mkdirSync(this.dir, { recursive: true });
      fs.appendFileSync(path.join(this.dir, 'history.jsonl'), JSON.stringify({ t: this.now(), type, ...data }) + '\n');
    } catch {}
  }

  // Grants the levels.json rewards of every level reached but not yet rewarded.
  _settleLevels(notify = true) {
    const level = this.level;
    const table = this.catalog().levels;
    for (let l = this.s.levelRewarded + 1; l <= level; l++) {
      const rewards = progression.rewardsFor(l, table);
      this.s.coins += rewards.coins;
      for (const id of rewards.items) this.s.items.add(id);
      this.s.levelRewarded = l;
      this._log('levelup', { level: l, ...rewards });
      if (notify) this.emit('levelUp', { level: l, rewards });
    }
    // Items a catalog update added to levels already passed still reach the player (items only, no coins).
    for (let l = 1; l <= this.s.levelRewarded; l++) {
      for (const id of progression.rewardsFor(l, table).items) {
        if (this.s.items.has(id)) continue;
        this.s.items.add(id);
        this._log('levelcatchup', { level: l, item: id });
      }
    }
  }

  _changed() {
    this._settleLevels();
    this._save();
    this.emit('state', this.getState());
  }

  _app(appid, name) {
    if (appid == null || !Number.isSafeInteger(Number(appid)) || Number(appid) <= 0) return null;
    const a = (this.s.perApp[appid] = this.s.perApp[appid] || { name: '', playSeconds: 0, achievements: 0 });
    if (name) a.name = String(name).slice(0, 200);
    return a;
  }

  // ---- Queries ------------------------------------------------------------

  get level() { return progression.levelFromXp(this.s.xp); }

  owns(item) {
    if (!item) return false;
    if (item.starter || item.mod || this.s.items.has(item.id)) return true;
    if (item.dlc) return this._ownsDlc(item.dlc.appid);
    if (item.price && item.price.usd) return false;
    if (item.unlockLevel != null) return this.level >= item.unlockLevel;
    return !item.price || item.price.coins === 0;
  }

  _ownsDlc(appid) {
    try {
      return Number.isSafeInteger(appid) && appid > 0 && this.ownsDlc(appid) === true;
    } catch {
      return false;
    }
  }

  getSettings() { return clone(this.s.settings); }

  getState() {
    const cat = this.catalog();
    const idx = catalogLib.index(cat);
    const gone = new Set(cat.takedowns || []);
    const inventory = new Set([...idx.values()].filter((it) => this.owns(it)).map((it) => it.id));
    for (const id of this.s.items) if (!gone.has(id)) inventory.add(id); // keeps items of a mod that is out right now
    const equipped = {};
    for (const [slot, kind] of Object.entries(SLOTS)) {
      const id = this.s.equipped[slot];
      const it = id == null ? null : idx.get(id);
      const fallback = slot === 'fill' && !idx.has(DEFAULT_EQUIPPED.fill) ? null : DEFAULT_EQUIPPED[slot];
      equipped[slot] = id == null && slot === 'fill' ? null : it && it.kind === kind && inventory.has(id) ? id : fallback;
    }
    const live = (r) => (r && (r.source === 'file' || !gone.has(r.id)) ? { ...r } : null); // taken-down wallpapers drop out
    const perApp = {};
    for (const [id, a] of Object.entries(this.s.perApp)) perApp[id] = { name: a.name, playSeconds: Math.floor(a.playSeconds), achievements: a.achievements };
    const p = progression.progress(this.s.xp);
    return {
      coins: this.s.coins, xp: this.s.xp, level: p.level, xpIntoLevel: p.xpIntoLevel, xpForNext: p.xpForNext,
      inventory: [...inventory], equipped,
      wallpaperPresets: Array.from({ length: this.s.presetSlots }, (_, i) => ({ slot: i, wallpaper: live(this.s.presets[i]) })),
      activeWallpaper: { stage: live(this.s.active.stage), fill: live(this.s.active.fill) },
      stats: { totalPlaySeconds: Math.floor(this.s.activeSeconds), achievements: this.s.achievements, perApp },
      session: this.session ? { ...this.session } : null,
      settings: this.getSettings(),
    };
  }

  // ---- Earning ------------------------------------------------------------

  // Time spent in Kayboro: 1 coin + 10 XP per whole minute (fractions carry over). `app` is the
  // hosted game, whose Steam appid also collects the seconds for the developer split.
  addTime(seconds, app = null) {
    const sec = Math.min(RULES.time.maxTickSeconds, Number(seconds));
    if (!(sec > 0)) return null;
    const before = Math.floor(this.s.activeSeconds / 60);
    this.s.activeSeconds = r3(this.s.activeSeconds + sec);
    const minutes = Math.floor(this.s.activeSeconds / 60) - before;
    const a = app && this._app(app.appid, app.name);
    if (a) a.playSeconds = r3(a.playSeconds + sec);
    const delta = { coins: minutes * RULES.time.coinsPerMinute, xp: minutes * RULES.time.xpPerMinute };
    this.s.coins += delta.coins;
    this.s.xp += delta.xp;
    if (minutes) this._changed();
    else this._save();
    return delta;
  }

  // A Steam achievement unlocked while its game was hosted (achievement rewards on). Each pays out once.
  awardAchievement({ appid, game, apiName, name, desc, iconUrl } = {}) {
    const id = Number(appid ?? NaN);
    if (!this.s.settings.rewards.achievements || !Number.isSafeInteger(id) || id <= 0 || !apiName) return null;
    const key = `${id}:${apiName}`;
    if (this.s.achieved.has(key)) return null;
    const { coins, xp } = RULES.achievement;
    this.s.achieved.add(key);
    this.s.achievements++;
    this._app(id, game).achievements++;
    this.s.coins += coins;
    this.s.xp += xp;
    const award = { appid: id, game: game || null, apiName: String(apiName), name: name || String(apiName), desc: desc || '', iconUrl: iconUrl || null, coins, xp };
    this._log('achievement', { appid: award.appid, apiName: award.apiName, coins, xp });
    this.emit('unlock', award); // before any levelUp it causes
    this._changed();
    return award;
  }

  // Debug/test only (wired up when KAYBORO_TEST=1).
  grant({ coins = 0, xp = 0 } = {}) {
    this.s.coins = Math.max(0, this.s.coins + (Math.trunc(coins) || 0));
    this.s.xp += Math.max(0, Math.trunc(xp) || 0);
    this._changed();
    return this.getState();
  }

  // ---- Spending and choices -------------------------------------------------

  _fail(reason) { return { ok: false, reason, state: this.getState() }; }
  _ok() { this._changed(); return { ok: true, state: this.getState() }; }

  purchase(itemId) {
    if (itemId === 'wallpaper-preset') return this.buyWallpaperPreset();
    const item = catalogLib.index(this.catalog()).get(itemId);
    if (!item) return this._fail('unknown');
    if (this.owns(item)) return this._fail('owned');
    if (item.dlc || (item.price && item.price.usd)) return this._fail('paid'); // Steam DLC, not sold for coins
    if (!item.price || !item.price.coins) return this._fail('locked');
    if (this.s.coins < item.price.coins) return this._fail('insufficient');
    this.s.coins -= item.price.coins;
    this.s.items.add(item.id);
    this._log('purchase', { itemId: item.id, coins: -item.price.coins });
    return this._ok();
  }

  // Buys a weekly bundle (see bundles.js): every item in it the player doesn't own yet, at the bundle price.
  buyBundle(bundle) {
    if (!bundle) return this._fail('unknown');
    const q = bundles.quote(bundle, this.catalog(), (id) => this.owns(catalogLib.index(this.catalog()).get(id)));
    if (!q.missing.length) return this._fail('owned');
    if (this.s.coins < q.coins) return this._fail('insufficient');
    this.s.coins -= q.coins;
    for (const id of q.missing) this.s.items.add(id);
    this._log('bundle', { bundle: bundle.id, items: q.missing, coins: -q.coins });
    return this._ok();
  }

  equip(slot, itemId) {
    if (typeof slot !== 'string' || !own(SLOTS, slot)) return this._fail('slot');
    if (itemId == null) itemId = slot === 'fill' ? null : DEFAULT_EQUIPPED[slot];
    if (itemId !== null) {
      const item = catalogLib.index(this.catalog()).get(itemId);
      if (!item || item.kind !== SLOTS[slot]) return this._fail('unknown');
      if (!this.owns(item)) return this._fail('locked');
    }
    this.s.equipped[slot] = itemId;
    if (slot === 'fill') this.s.active.fill = null; // the last choice wins: a fill replaces a wallpaper fill
    return this._ok();
  }

  buyWallpaperPreset() {
    if (this.s.coins < RULES.preset.price) return this._fail('insufficient');
    this.s.coins -= RULES.preset.price;
    this.s.presetSlots++;
    this._log('preset', { slot: this.s.presetSlots - 1, coins: -RULES.preset.price });
    return this._ok();
  }

  setWallpaperPreset(slot, wallpaper) {
    if (!Number.isInteger(slot) || slot < 0 || slot >= this.s.presetSlots) return this._fail('slot');
    const ref = wallpaper == null ? null : wallpaperRef(wallpaper);
    if (wallpaper != null && !ref) return this._fail('invalid');
    if (ref) this.s.presets[slot] = ref;
    else delete this.s.presets[slot];
    return this._ok();
  }

  // The one free active wallpaper, as the stage backdrop or the shell fill. Any wallpaper, any time.
  setActiveWallpaper(wallpaper, target = 'stage') {
    if (!TARGETS.includes(target)) return this._fail('target');
    const ref = wallpaper == null ? null : wallpaperRef(wallpaper);
    if (wallpaper != null && !ref) return this._fail('invalid');
    if (ref && (ref.source === 'kayboro' || ref.source === 'mod') && !(this.catalog().wallpapers || []).some((w) => w.id === ref.id)) return this._fail('unknown');
    this.s.active[target] = ref;
    return this._ok();
  }

  setSettings(patch = {}) {
    const on = patch && patch.rewards && typeof patch.rewards.achievements === 'boolean' ? patch.rewards.achievements : null;
    if (on !== null && on !== this.s.settings.rewards.achievements) {
      this.s.settings.rewards.achievements = on;
      this._save();
      this.emit('settings', this.getSettings());
      this.emit('state', this.getState());
    }
    return this.getSettings();
  }

  // ---- Bets -----------------------------------------------------------------

  // The most a player may stake right now: 25% of the balance, at most 500 coins.
  betLimits() {
    const { min, max, maxShare, maxMultiplier, maxOpen } = RULES.bet;
    return { min, max: Math.max(0, Math.min(max, Math.floor(this.s.coins * maxShare))), maxMultiplier, open: Object.keys(this.s.bets).length, maxOpen };
  }

  // Escrow: the stake leaves the balance now and the ticket is saved, so a crash before settling refunds it.
  placeBet(amount, meta = {}) {
    const a = amount;
    if (typeof a !== 'number' || !Number.isSafeInteger(a) || a < RULES.bet.min) return this._fail('amount');
    const lim = this.betLimits();
    if (lim.open >= lim.maxOpen) return this._fail('busy');
    if (a > this.s.coins) return this._fail('insufficient');
    if (a > lim.max) return this._fail('cap');
    const ticket = 'bet-' + crypto.randomBytes(8).toString('hex');
    const game = String((meta && meta.game) || 'clash').replace(/[^\w.-]/g, '').slice(0, 40) || 'clash';
    this.s.coins -= a;
    this.s.bets[ticket] = { amount: a, at: this.now(), game };
    this._log('bet', { ticket, game, coins: -a });
    this._changed();
    return { ok: true, ticket, amount: a, state: this.getState() };
  }

  // outcome 'win' pays stake * multiplier (1..5, rounded down), 'loss' pays nothing, 'cancel' or 'push' refunds.
  settleBet(ticket, outcome, multiplier = 1) {
    const b = typeof ticket === 'string' && own(this.s.bets, ticket) ? this.s.bets[ticket] : null;
    if (!b) return this._fail('unknown');
    let payout;
    if (outcome === 'win') {
      const m = Number(multiplier);
      if (!Number.isFinite(m)) return this._fail('multiplier');
      // Integer arithmetic (multiplier in thousandths): stake x 1.9 etc. must never land on 56.999... and lose a coin.
      const milli = Math.round(Math.min(RULES.bet.maxMultiplier, Math.max(1, m)) * 1000);
      payout = Math.floor((b.amount * milli) / 1000);
    } else if (outcome === 'loss') payout = 0;
    else if (outcome === 'cancel' || outcome === 'push') payout = b.amount;
    else return this._fail('outcome');
    delete this.s.bets[ticket];
    this.s.coins += payout;
    this._log('betSettle', { ticket, game: b.game, outcome, stake: b.amount, multiplier: outcome === 'win' ? Number(multiplier) : null, coins: payout });
    this._changed();
    return { ok: true, outcome, stake: b.amount, payout, state: this.getState() };
  }

  setSession(s) {
    this.session = s ? { appid: s.appid ?? null, name: s.name || '', startedAt: s.startedAt || this.now() } : null;
    this.emit('state', this.getState());
  }
}

module.exports = { Economy, RULES, DEFAULT_EQUIPPED, DEFAULT_SETTINGS, wallpaperRef };
