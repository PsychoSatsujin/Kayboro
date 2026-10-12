'use strict';
// 'shell:*' IPC for the renderer's window.shell API (see preload-api.js) and the economy's push events.
const path = require('path');
const { Economy } = require('./economy');
const { SessionManager } = require('./session');
const catalog = require('./catalog');

// Wallpaper Engine scanning lives in ../wallpaperEngine.js (owned by the Steam integration).
const listLocalWallpapers = () => {
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

const devHosts = () => new Set(catalog.load().developers.map((d) => d.links.website && hostOf(d.links.website)).filter(Boolean));

function registerEconomyIpc({ ipcMain, getWindow, detectSteamGame, userDataDir }) {
  const { app, shell } = require('electron');
  const win32 = require('../win32');
  const economy = new Economy({ dir: path.join(userDataDir, 'shellcade') });
  const session = new SessionManager({ economy, detectSteamGame, getProcessInfo: (h) => win32.getProcessInfo(h) });
  const test = process.env.SHELLCADE_TEST === '1';

  const send = (ch, data) => {
    const w = getWindow();
    if (w && !w.isDestroyed()) w.webContents.send('shell:' + ch, data);
  };
  economy.on('state', (s) => send('state', s));
  economy.on('levelUp', (e) => send('levelUp', e));
  economy.on('unlock', (e) => send('unlock', e));
  session.on('gameLaunched', (e) => send('gameLaunched', e));

  const fail = { ok: false, reason: 'error' };
  const HANDLERS = {
    getState: () => economy.getState(),
    listCatalog: () => {
      const { frames, finishes, colorways, fills, backdrops, levels } = catalog.load();
      return { frames, finishes, colorways, fills, backdrops, levels };
    },
    listDevelopers: () => catalog.load().developers,
    purchase: (itemId) => economy.purchase(itemId),
    equip: (slot, itemId) => economy.equip(slot, itemId),
    buyBackdropSlot: () => economy.buyBackdropSlot(),
    setBackdropSlot(slot, wallpaperId) {
      if (wallpaperId != null) {
        const wp = listLocalWallpapers().find((w) => w.id === wallpaperId);
        if (!wp || !wp.usable) return { ok: false, reason: 'unusable', state: economy.getState() };
      }
      return economy.setBackdropSlot(Number(slot), wallpaperId ?? null);
    },
    listLocalWallpapers,
    sessionStart: (info) => session.sessionStart(info && typeof info === 'object' ? info : {}),
    sessionStop: () => session.sessionStop(),
    async openLink(url) {
      const href = allowedLink(url, devHosts());
      if (!href) return false;
      await shell.openExternal(href);
      return true;
    },
  };
  if (test) {
    HANDLERS.debugSimulateUnlock = (appid, apiName) => session.simulateUnlock(appid, apiName);
    HANDLERS.debugGrant = (g) => economy.grant(g && typeof g === 'object' ? g : {});
  }
  const FALLBACK = { getState: null, listCatalog: { frames: [], finishes: [], colorways: [], fills: [], backdrops: [], levels: [] },
    listDevelopers: [], listLocalWallpapers: [], sessionStart: null, sessionStop: false, openLink: false, debugSimulateUnlock: null };

  for (const [name, fn] of Object.entries(HANDLERS)) {
    ipcMain.handle('shell:' + name, async (_e, ...args) => {
      try {
        return await fn(...args);
      } catch (err) {
        console.error(`[shell] ${name} failed:`, err);
        return name in FALLBACK ? FALLBACK[name] : { ...fail, state: economy.getState() };
      }
    });
  }

  session.startLaunchPolling();
  const dispose = () => session.dispose();
  app.on('will-quit', dispose);

  return {
    onPlayState: (playing, hwnd) => {
      try {
        session.setPlaying(!!playing, hwnd);
      } catch (err) {
        console.error('[shell] play state failed:', err);
      }
    },
    economy, session, dispose,
  };
}

module.exports = { registerEconomyIpc, allowedLink };
