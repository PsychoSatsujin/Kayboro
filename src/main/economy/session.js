'use strict';
// The hosted-game session: which game Shellcade is showing, its achievement watcher, play-time ticks
// while play mode is on, and (Windows) detection of newly launched Steam games.
const path = require('path');
const { EventEmitter } = require('events');

const ICON_HOSTS = new Set(['cdn.cloudflare.steamstatic.com', 'shared.cloudflare.steamstatic.com', 'steamcdn-a.akamaihd.net']);
const safeIcon = (u) => {
  try {
    const x = new URL(u);
    return x.protocol === 'https:' && ICON_HOSTS.has(x.hostname) ? x.href : null;
  } catch {
    return null;
  }
};

function loadSteam() {
  try {
    return require('../steam');
  } catch (err) {
    console.warn('[shell] Steam integration unavailable:', err.message);
    return {};
  }
}

const attempt = (fn, fallback = null) => {
  try {
    return fn();
  } catch {
    return fallback;
  }
};

class SessionManager extends EventEmitter {
  constructor({ economy, steam = loadSteam(), detectSteamGame = async () => null, getProcessInfo = () => null,
    platform = process.platform, now = Date.now, tickMs = 30e3, pollMs = 5e3 } = {}) {
    super();
    Object.assign(this, { economy, steam, detectSteamGame, getProcessInfo, platform, now, tickMs, pollMs });
    this.cur = null; // { hwnd, exePath, appid, name, startedAt, watcher }
    this.playing = false;
  }

  _appForExe(exe) {
    return exe && typeof this.steam.appForExe === 'function' ? attempt(() => this.steam.appForExe(exe)) : null;
  }

  // Starts hosting the game behind hwnd/exePath (same window: keeps the running session).
  // Returns {appid, name}; appid is null for windows that aren't an installed Steam game.
  sessionStart({ hwnd = null, exePath = null, sourceName = '' } = {}) {
    hwnd = hwnd == null || hwnd === '' ? null : String(hwnd);
    const exe = (typeof exePath === 'string' && exePath) || (hwnd && attempt(() => this.getProcessInfo(hwnd))?.exePath) || null;
    if (!hwnd && !exe) return null;
    const c = this.cur;
    if (c && (hwnd ? c.hwnd === hwnd : c.exePath === exe)) return { appid: c.appid, name: c.name };
    this.sessionStop();
    const app = this._appForExe(exe);
    const s = (this.cur = {
      hwnd, exePath: exe, appid: app ? app.appid : null, startedAt: this.now(), watcher: null,
      name: (app && app.name) || String(sourceName || '').slice(0, 200) || (exe ? path.basename(exe).replace(/\.exe$/i, '') : 'Game'),
    });
    if (s.appid != null) this._watch(s);
    if (this.playing) this.lastTick = this.now();
    this.economy.setSession(s);
    return { appid: s.appid, name: s.name };
  }

  sessionStop() {
    const s = this.cur;
    if (!s) return false;
    this._tick();
    // The watcher's final check can still report unlocks for this session, so stop it first.
    if (s.watcher) attempt(() => s.watcher.stop());
    this.cur = null;
    this.economy.setSession(null);
    return true;
  }

  _watch(s) {
    const W = this.steam.AchievementWatcher;
    if (typeof W !== 'function') return;
    try {
      const w = new W();
      w.on('unlock', (u) => this._award(s, u));
      w.on('suspicious', (info) => this.economy.addFlag('suspicious-achievements', { appid: s.appid, count: info && info.count }));
      if (w.start({ appid: s.appid, name: s.name, sessionStart: s.startedAt })) s.watcher = w;
    } catch (err) {
      console.warn('[shell] achievement watcher failed:', err.message);
    }
  }

  _award(s, u) {
    if (!u || Number(u.appid) !== s.appid) return null;
    return this.economy.awardAchievement({ appid: s.appid, game: u.game || s.name, apiName: u.apiName, name: u.name, desc: u.desc, iconUrl: safeIcon(u.iconUrl) });
  }

  // Test hook: an unlock for appid/apiName, as if the watcher had seen it in a hosted session.
  simulateUnlock(appid, apiName) {
    appid = Number(appid);
    if (!Number.isSafeInteger(appid) || appid <= 0 || typeof apiName !== 'string' || !apiName) return null;
    const a = attempt(() => this.steam.readSchema(appid), []).find((x) => x.apiName === apiName) || {};
    const game = (this.cur && this.cur.appid === appid && this.cur.name) ||
      attempt(() => this.steam.installedApps().find((x) => x.appid === appid), null)?.name || `App ${appid}`;
    const iconUrl = a.icon ? attempt(() => this.steam.iconUrl(appid, a.icon)) : null;
    return this._award({ appid, name: game }, { appid, game, apiName, name: a.name || apiName, desc: a.desc || '', iconUrl });
  }

  // Play mode on/off for hwnd: earns play time for the hosted game while on.
  setPlaying(playing, hwnd) {
    if (playing) {
      if (hwnd && (!this.cur || this.cur.hwnd !== String(hwnd))) this.sessionStart({ hwnd });
      this.playing = true;
      this.lastTick = this.now();
      clearInterval(this.tickTimer);
      this.tickTimer = setInterval(() => this._tick(), this.tickMs);
      this.tickTimer.unref?.();
    } else if (this.playing) {
      this._tick();
      this.playing = false;
      clearInterval(this.tickTimer);
      this.tickTimer = null;
    }
  }

  _tick() {
    if (!this.playing || !this.cur) return;
    const t = this.now();
    const sec = (t - this.lastTick) / 1000;
    this.lastTick = t;
    // A tick far later than scheduled (sleep, hang) only counts as one interval.
    attempt(() => this.economy.addPlayTime(Math.min(sec, (this.tickMs / 1000) * 2), this.cur));
  }

  // Windows only: every pollMs, report a Steam game started after the last one seen ('gameLaunched').
  startLaunchPolling() {
    if (this.platform !== 'win32' || this.pollTimer) return false;
    this.lastSeen = this.now();
    this.pollTimer = setInterval(() => this.pollLaunch(), this.pollMs);
    this.pollTimer.unref?.();
    return true;
  }

  async pollLaunch() {
    if (this.polling || this.playing) return null;
    this.polling = true;
    try {
      const g = await this.detectSteamGame();
      if (!g || !(g.startedAt > this.lastSeen)) return null;
      this.lastSeen = g.startedAt;
      const app = this._appForExe(g.exePath);
      const ev = { appid: app ? app.appid : null, name: (app && app.name) || g.name, hwnd: g.hwnd || null, exePath: g.exePath || null };
      this.emit('gameLaunched', ev);
      return ev;
    } catch {
      return null;
    } finally {
      this.polling = false;
    }
  }

  dispose() {
    clearInterval(this.pollTimer);
    this.pollTimer = null;
    this.setPlaying(false);
    this.sessionStop();
  }
}

module.exports = { SessionManager, safeIcon };
