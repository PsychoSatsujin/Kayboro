'use strict';
// 'shell:*' IPC for the renderer's window.shell API (see preload-api.js) and the economy's push events.
const fs = require('fs');
const path = require('path');
const { Economy } = require('./economy');
const { SessionManager } = require('./session');
const { ActivityTracker } = require('./activity');
const { Submissions } = require('./submissions');
const { loadMods } = require('./mods');
const integrity = require('./integrity');
const payouts = require('./payouts');
const catalog = require('./catalog');

// Wallpaper Engine scanning lives in ../wallpaperEngine.js (owned by the Steam integration).
const listWallpaperEngine = () => {
  try {
    return require('../wallpaperEngine').listLocalWallpapers();
  } catch (err) {
    console.warn('[shell] wallpapers unavailable:', err.message);
    return [];
  }
};

const LINK_DOMAINS = ['patreon.com', 'ko-fi.com', 'itch.io', 'store.steampowered.com', 'github.com'];

const hostOf = (u) => {
  try {
    return new URL(u).hostname.toLowerCase().replace(/^www\./, '');
  } catch {
    return null;
  }
};

// The normalized URL when it is https on an allowlisted host (or a listed developer's website), else null.
function allowedLink(raw, devHosts = new Set()) {
  let u;
  try {
    u = new URL(String(raw));
  } catch {
    return null;
  }
  if (u.protocol !== 'https:' || u.username || u.password || u.port) return null;
  const h = u.hostname.toLowerCase();
  const ok = LINK_DOMAINS.some((d) => h === d || h.endsWith('.' + d)) || devHosts.has(h.replace(/^www\./, ''));
  return ok ? u.href : null;
}

const pad = (n) => String(n).padStart(2, '0');

function registerEconomyIpc({ ipcMain, getWindow, detectSteamGame, isPlaying = () => false, userDataDir }) {
  const { app, shell, dialog } = require('electron');
  const win32 = require('../win32');
  const dir = path.join(userDataDir, 'shellcade');
  const modsDir = path.join(dir, 'mods');
  const test = process.env.SHELLCADE_TEST === '1';

  let mods = loadMods(modsDir, { reserved: catalog.reservedIds() });
  const cat = () => catalog.load(mods);
  const economy = new Economy({ dir, catalog: cat });
  const submissions = new Submissions(dir);
  let tracker = null, clock = 0; // clock: test-only fast-forward (debugAdvanceTime)
  const session = new SessionManager({ economy, detectSteamGame, getProcessInfo: (h) => win32.getProcessInfo(h), beforeChange: () => tracker && tracker.tick() });
  tracker = new ActivityTracker({
    economy, getApp: () => session.app(), now: () => Date.now() + clock,
    isActive: () => {
      const w = getWindow();
      return isPlaying() || (!!w && !w.isDestroyed() && w.isVisible() && !w.isMinimized());
    },
  });

  const send = (ch, data) => {
    const w = getWindow();
    if (w && !w.isDestroyed()) w.webContents.send('shell:' + ch, data);
  };
  economy.on('state', (s) => send('state', s));
  economy.on('levelUp', (e) => send('levelUp', e));
  economy.on('unlock', (e) => send('unlock', e));
  economy.on('settings', () => session.refreshWatcher());
  session.on('gameLaunched', (e) => send('gameLaunched', e));

  const listCatalog = () => {
    const { frames, finishes, colorways, fills, wallpapers, levels, takedowns } = cat();
    return { frames, finishes, colorways, fills, wallpapers, levels, takedowns };
  };
  const devHosts = () => new Set(cat().developers.map((d) => d.links.website && hostOf(d.links.website)).filter(Boolean));

  // Informational only: started a few seconds after launch, or on the first getIntegrity(); {refresh: true} checks again.
  let integrityP = null;
  const getIntegrity = (opts) => {
    if (opts && opts.refresh === true) integrityP = null;
    return (integrityP = integrityP || integrity.check().catch((err) => ({ ok: true, checked: 0, mismatched: [], missing: [], skipped: true, error: err.message })));
  };
  setTimeout(getIntegrity, 4000).unref?.();

  const HANDLERS = {
    getState: () => economy.getState(),
    listCatalog,
    listDevelopers: () => cat().developers,
    purchase: (itemId) => economy.purchase(itemId),
    equip: (slot, itemId) => economy.equip(slot, itemId),
    buyWallpaperPreset: () => economy.buyWallpaperPreset(),
    setWallpaperPreset: (slot, wallpaper) => economy.setWallpaperPreset(Number(slot), wallpaper ?? null),
    setActiveWallpaper: (wallpaper, target) => economy.setActiveWallpaper(wallpaper ?? null, target ?? 'stage'),
    listLocalWallpapers: () => {
      const gone = new Set(cat().takedowns);
      return listWallpaperEngine().filter((w) => !gone.has(w.id));
    },
    sessionStart: (info) => session.sessionStart(info && typeof info === 'object' ? info : {}),
    sessionStop: () => session.sessionStop(),
    async openLink(url) {
      const href = allowedLink(url, devHosts());
      if (!href) return false;
      await shell.openExternal(href);
      return true;
    },
    getSettings: () => economy.getSettings(),
    setSettings: (patch) => economy.setSettings(patch && typeof patch === 'object' ? patch : {}),
    getIntegrity,
    getMods: () => mods.mods,
    reloadMods() {
      mods = loadMods(modsDir, { reserved: catalog.reservedIds() });
      send('catalog', listCatalog());
      economy.emit('state', economy.getState());
      return mods.mods;
    },
    async openModsFolder() {
      fs.mkdirSync(modsDir, { recursive: true });
      return (await shell.openPath(modsDir)) === '';
    },
    submitDeveloper: (form) => submissions.add(form),
    listSubmissions: () => submissions.list().reverse(),
    // Saves the payout sheet for this install (CSV for Excel, or usage JSON for merge-sheets.mjs). Returns the path or null.
    async exportPayoutSheet(opts) {
      const revenueCents = Number(opts?.revenueCents ?? 0);
      if (!Number.isSafeInteger(revenueCents) || revenueCents < 0) throw new RangeError('revenueCents must be a non-negative integer');
      const { stats } = economy.getState();
      const rows = payouts.devRows({ developers: cat().developers, submissions: submissions.list(), stats });
      let file = test && typeof opts?.filePath === 'string' ? opts.filePath : null;
      if (!file) {
        const d = new Date();
        const o = { title: 'Export payout sheet', defaultPath: path.join(app.getPath('documents'), `shellcade-payouts-${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}.csv`),
          filters: [{ name: 'Spreadsheet (CSV)', extensions: ['csv'] }, { name: 'Usage file for merging (JSON)', extensions: ['json'] }] };
        const w = getWindow();
        const r = await (w && !w.isDestroyed() ? dialog.showSaveDialog(w, o) : dialog.showSaveDialog(o));
        if (r.canceled || !r.filePath) return null;
        file = r.filePath;
      }
      const body = /\.json$/i.test(file)
        ? payouts.toJson(rows, { exportedAt: new Date().toISOString(), revenueCents, perApp: stats.perApp })
        : payouts.toCsv(payouts.buildSheet(rows, revenueCents));
      fs.writeFileSync(file, body, 'utf8');
      return file;
    },
  };
  if (test) {
    HANDLERS.debugSimulateUnlock = (appid, apiName) => session.simulateUnlock(appid, apiName);
    HANDLERS.debugGrant = (g) => economy.grant(g && typeof g === 'object' ? g : {});
    // Fast clock: `seconds` of Shellcade time pass through the real tracker (window visibility, hosted game).
    HANDLERS.debugAdvanceTime = (seconds) => {
      tracker.tick(); // credit the real time so far and sample the window's current state
      const before = economy.getState();
      for (let left = Math.max(0, Number(seconds) || 0) * 1000; left > 0; left -= tracker.tickMs) {
        clock += Math.min(left, tracker.tickMs);
        tracker.tick();
      }
      return { before, state: economy.getState() };
    };
  }
  const FALLBACK = { getState: null, listCatalog: { frames: [], finishes: [], colorways: [], fills: [], wallpapers: [], levels: [], takedowns: [] },
    listDevelopers: [], listLocalWallpapers: [], sessionStart: null, sessionStop: false, openLink: false, debugSimulateUnlock: null,
    getSettings: null, setSettings: null, getMods: [], reloadMods: [], openModsFolder: false, listSubmissions: [], exportPayoutSheet: null, debugAdvanceTime: null,
    getIntegrity: { ok: true, checked: 0, mismatched: [], missing: [], skipped: true } };

  for (const [name, fn] of Object.entries(HANDLERS)) {
    ipcMain.handle('shell:' + name, async (_e, ...args) => {
      try {
        return await fn(...args);
      } catch (err) {
        console.error(`[shell] ${name} failed:`, err);
        return name in FALLBACK ? FALLBACK[name] : { ok: false, reason: 'error', state: economy.getState() };
      }
    });
  }

  session.startLaunchPolling();
  tracker.start();
  const dispose = () => {
    tracker.stop();
    session.dispose();
  };
  app.on('will-quit', dispose);

  const safe = (what, fn) => {
    try {
      fn();
    } catch (err) {
      console.error(`[shell] ${what} failed:`, err);
    }
  };
  return {
    // Main calls these right after play mode or the window's visibility changes.
    onPlayState: (playing, hwnd) => safe('play state', () => {
      tracker.tick();
      session.setPlaying(!!playing, hwnd);
    }),
    onWindowState: () => safe('window state', () => tracker.tick()),
    economy, session, tracker, dispose,
  };
}

module.exports = { registerEconomyIpc, allowedLink };
