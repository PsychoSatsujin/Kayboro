'use strict';
// Emits 'unlock' for Steam achievements the hosted game unlocks during a Shellcade session, by watching
// Steam's local stats cache. Unlocks already there at start, or timed before the session, are ignored.
// More than `burstLimit` unlocks within `burstWindowMs` (an unlocker tool, a stats reset) emit
// 'suspicious' {appid, count} instead of 'unlock'.
const fs = require('fs');
const { EventEmitter } = require('events');
const { steamRoot } = require('./paths');
const ach = require('./achievements');

const GRACE_MS = 60e3; // Steam's unlock time can be a little earlier than our session start
const indexSchema = (list) => new Map(list.map((a) => [`${a.statId}:${a.bit}`, a]));

class AchievementWatcher extends EventEmitter {
  constructor({ pollMs = 4000, debounceMs = 250, burstLimit = 10, burstWindowMs = 60e3, now = Date.now } = {}) {
    super();
    Object.assign(this, { pollMs, debounceMs, burstLimit, burstWindowMs, now });
    this.session = null;
  }

  get running() {
    return !!this.session;
  }

  // sessionStart: ms (or unix seconds) the session began; defaults to now. Returns false without Steam.
  start({ appid, name, sessionStart } = {}) {
    this.stop();
    appid = Number(appid);
    const root = steamRoot();
    if (!Number.isSafeInteger(appid) || appid <= 0 || !root) return false;
    const t = Number(sessionStart) || this.now();
    const accountId = ach.currentAccountId(root);
    const s = (this.session = {
      appid, root, accountId,
      game: typeof name === 'string' && name ? name : `App ${appid}`,
      start: t < 1e12 ? t * 1000 : t,
      seen: new Set(Object.keys(ach.readUnlockTimes(accountId, appid, root))),
      schema: indexSchema(ach.readSchema(appid, root)),
      recent: [],
    });
    s.live = (fn) => () => this.session === s && fn();
    try {
      // Missing until the game first syncs stats; the poll covers that.
      s.fsw = fs.watch(ach.statsDir(root), (_ev, file) => {
        if (!file || String(file).endsWith(`_${appid}.bin`)) this._schedule();
      });
      s.fsw.on('error', () => {});
      s.fsw.unref?.();
    } catch {}
    s.poll = setInterval(s.live(() => this.check()), this.pollMs);
    s.poll.unref?.();
    return true;
  }

  _schedule() {
    const s = this.session;
    if (!s) return;
    clearTimeout(s.debounce);
    s.debounce = setTimeout(s.live(() => this.check()), this.debounceMs);
    s.debounce.unref?.();
  }

  // Reads the stats file now; returns how many 'unlock' events it emitted.
  check() {
    const s = this.session;
    if (!s) return 0;
    if (s.accountId == null) s.accountId = ach.currentAccountId(s.root);
    const fresh = [];
    for (const [key, sec] of Object.entries(ach.readUnlockTimes(s.accountId, s.appid, s.root))) {
      if (s.seen.has(key)) continue;
      s.seen.add(key);
      if (sec * 1000 >= s.start - GRACE_MS) fresh.push([key, sec * 1000]);
    }
    if (!fresh.length) return 0;
    const now = this.now();
    s.recent = s.recent.filter((t) => now - t < this.burstWindowMs).concat(fresh.map(() => now));
    if (s.recent.length > this.burstLimit) {
      this.emit('suspicious', { appid: s.appid, count: s.recent.length });
      return 0;
    }
    if (fresh.some(([k]) => !s.schema.has(k))) s.schema = indexSchema(ach.readSchema(s.appid, s.root));
    for (const [key, unlockedAt] of fresh) {
      const a = s.schema.get(key) || {};
      this.emit('unlock', {
        appid: s.appid, game: s.game, apiName: a.apiName || key, name: a.name || 'Achievement unlocked',
        desc: a.desc || '', iconUrl: ach.iconUrl(s.appid, a.icon), unlockedAt,
      });
    }
    return fresh.length;
  }

  // Ends the session. A last check first catches stats Steam wrote as the game exited.
  stop({ flush = true } = {}) {
    const s = this.session;
    if (!s) return;
    if (flush) {
      try {
        this.check();
      } catch {}
    }
    this.session = null;
    clearInterval(s.poll);
    clearTimeout(s.debounce);
    try {
      s.fsw?.close();
    } catch {}
  }
}

module.exports = { AchievementWatcher };
