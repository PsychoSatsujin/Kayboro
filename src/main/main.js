'use strict';
const { app, BrowserWindow, ipcMain, desktopCapturer, screen, dialog, globalShortcut, net, shell, protocol } = require('electron');
const path = require('path');
const fs = require('fs');
const { pathToFileURL } = require('url');
const win32 = require('./win32');
const store = require('./store');
const { registerEconomyIpc } = require('./economy/ipc');
const { migrateUserData } = require('./migrate');
const popout = require('./popout');
const vdd = require('./vdd');
const playCursor = require('./playCursor');
// Running from source (not the packaged app): renderers show developer tools such as the Bundle Studio.
if (!app.isPackaged) process.env.KAYBORO_DEV_TOOLS = '1';
let kayboClient = null;
protocol.registerSchemesAsPrivileged([require('./kaybo').SCHEME]); // before ready
const kaybo = () => (kayboClient ||= require('./kaybo').create({ net, userDataDir: app.getPath('userData') }));
const sandbox = require('./sandbox').apply(app); // KAYBORO_SANDBOX=1 only: separate tester userData (before anything reads it)
require('./steam/overlay').enable(); // Steam overlay (steamworks.js), only when started by Steam; must run before app ready
const selftest = require('./selftest').parseArgs(process.argv, path.join(app.getPath('userData'), 'kayboro', 'selftest.json')); // --self-test[=file]

const STEAM_RE = /\\steamapps\\common\\/i;
const IMG = ['png', 'jpg', 'jpeg', 'gif', 'webp', 'svg'];
const VID = ['mp4', 'webm', 'mov'];
const FILTERS = {
  image: [{ name: 'Images', extensions: IMG }],
  video: [{ name: 'Videos', extensions: VID }],
  media: [{ name: 'Images & videos', extensions: [...IMG, ...VID] }],
  frame: [{ name: 'Frame images', extensions: ['png', 'webp', 'svg'] }],
};

// The Kayboro mark (tools/brand) on the window and taskbar; the packaged exe also embeds build/icon.ico.
const ICON = path.join(__dirname, '..', 'renderer', 'assets', 'icon.png');

let win = null;
let play = null; // { hwnd, win, popId, timer, lastCursor, lastRect }
let economy = null; // registerEconomyIpc() result: coins/XP for time spent, hosted-game session, mods

const sendTo = (w, ch, data) => {
  if (w && !w.isDestroyed()) w.webContents.send('ror:' + ch, data);
};
const send = (ch, data) => sendTo(win, ch, data);

function createWindow() {
  win = new BrowserWindow({
    width: 1280,
    height: 800,
    minWidth: 480,
    minHeight: 320,
    title: 'Kayboro',
    icon: ICON,
    backgroundColor: '#000000',
    autoHideMenuBar: true,
    webPreferences: {
      preload: path.join(__dirname, '..', 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: false,
    },
  });
  win.loadFile(path.join(__dirname, '..', 'renderer', 'index.html'));
  // A crashed renderer can no longer leave play mode: release the cursor and the overlay.
  win.webContents.on('render-process-gone', () => stopPlay());
  win.on('closed', () => {
    stopPlay();
    popout.closeAll(); // pop-outs belong to this window's scene
    win = null;
    economy?.onWindowState();
  });
  // Time spent counts while the window is visible and not minimized (or in play mode).
  for (const ev of ['minimize', 'restore', 'show', 'hide']) win.on(ev, () => economy?.onWindowState());
}

// ---- Sources & displays -------------------------------------------------

// "window:<HWND>" part of a media source id. getMediaSourceId() can carry an aura id in the 3rd field,
// while desktopCapturer may report the same window with ":0", so compare without it.
const srcKey = (id) => String(id).split(':').slice(0, 2).join(':');

async function listSources() {
  const own = new Set(BrowserWindow.getAllWindows().map((w) => srcKey(w.getMediaSourceId())));
  // One getSources() call per type: asking for windows and screens together intermittently drops the
  // screen on Linux/X11 ("Failed to initialize pixel buffer"); sequential single-type calls don't.
  const sources = [];
  for (const type of ['screen', 'window']) {
    sources.push(...(await desktopCapturer.getSources({ types: [type], thumbnailSize: { width: 320, height: 180 } })));
  }
  return sources.filter((s) => !own.has(srcKey(s.id))).map((s) => {
    const kind = s.id.startsWith('screen:') ? 'screen' : 'window';
    const m = kind === 'window' ? /^window:(-?\d+):/.exec(s.id) : null; // Windows: "window:<HWND>:0"
    const hwnd = m ? m[1] : null;
    const info = hwnd ? win32.getProcessInfo(hwnd) : null;
    const exePath = (info && info.exePath) || null;
    return {
      id: s.id,
      name: s.name,
      kind,
      thumbnail: s.thumbnail.toDataURL(),
      hwnd,
      displayId: s.display_id || null,
      exePath,
      isSteamGame: !!exePath && STEAM_RE.test(exePath),
      startedAt: (info && info.startedAt) || null,
    };
  });
}

async function detectSteamGame() {
  const games = (await listSources()).filter((s) => s.isSteamGame);
  games.sort((a, b) => (b.startedAt || 0) - (a.startedAt || 0));
  return games[0] || null;
}

function getDisplays() {
  const primaryId = screen.getPrimaryDisplay().id;
  return screen.getAllDisplays().map((d, i) => ({
    id: String(d.id),
    label: `${d.label || 'Display ' + (i + 1)} (${Math.round(d.size.width * d.scaleFactor)}x${Math.round(d.size.height * d.scaleFactor)})`,
    bounds: { ...d.bounds },
    scaleFactor: d.scaleFactor,
    primary: d.id === primaryId,
  }));
}

function moveWindowToDisplay(hwnd, displayId) {
  const d = screen.getAllDisplays().find((x) => String(x.id) === String(displayId));
  if (!d || !win32.isWindow(hwnd)) return false;
  // Display bounds are DIP; SetWindowPos wants physical pixels.
  const p = process.platform === 'win32' ? screen.dipToScreenPoint({ x: d.bounds.x, y: d.bounds.y }) : d.bounds;
  return win32.moveWindow(hwnd, p.x, p.y);
}

// ---- Play mode: input goes to the game, our window becomes a display-only overlay ----

function clip(hwnd) {
  const r = win32.getClientRect(hwnd);
  if (r && r.width > 0 && r.height > 0) win32.clipCursor(r);
  return r;
}

function pollCursor() {
  if (!play) return;
  if (!win32.isWindow(play.hwnd)) return void stopPlay();
  const r = win32.getClientRect(play.hwnd);
  const c = win32.getCursorPos();
  if (!r || !c || r.width <= 0 || r.height <= 0) return;

  // Re-clip while the game has focus (so alt-tab isn't trapped) when it moved/resized, or when the clip
  // was dropped: Windows resets it on activation changes, and SetForegroundWindow activates asynchronously
  // (after startPlay's first clip). A tighter clip the game set itself is left alone.
  const rk = `${r.x},${r.y},${r.width},${r.height}`;
  if (win32.isForeground(play.hwnd)) {
    const cc = win32.getClipCursor();
    const held = cc && cc.x >= r.x && cc.y >= r.y && cc.x + cc.width <= r.x + r.width && cc.y + cc.height <= r.y + r.height;
    if (rk !== play.lastRect || !held) {
      play.lastRect = rk;
      win32.clipCursor(r);
    }
  }

  // A hidden game lives on a screen nobody can see: once it has had focus, losing it (Alt+Tab, the Start
  // menu, a click elsewhere) ends play, which brings the cursor back instead of stranding it there.
  if (play.hidden) {
    if (win32.isForeground(play.hwnd)) { play.hadFocus = true; play.away = 0; }
    else if (play.hadFocus && Date.now() - (play.away ||= Date.now()) > 250) return void stopPlay();
  }

  const u = (c.x - r.x) / r.width;
  const v = (c.y - r.y) / r.height;
  if (u >= 0 && u <= 1 && v >= 0 && v <= 1) Object.assign(play, { u, v });
  const ck = `${c.x},${c.y},${rk}`;
  if (ck === play.lastCursor) return;
  play.lastCursor = ck;
  sendTo(play.win, 'cursor', { u, v, inside: u >= 0 && u <= 1 && v >= 0 && v <= 1 });
}

// Physical px <-> DIP (Windows has per-monitor DPI; elsewhere they are the same).
const toDip = (p) => (process.platform === 'win32' ? screen.screenToDipPoint(p) : p);
const toPhysical = (p) => (process.platform === 'win32' ? screen.dipToScreenPoint(p) : p);

// Whether physical point `p` is on one of our invisible screens.
function onHiddenScreen(p) {
  if (!p || !vdd._active.size) return false;
  const id = String(screen.getDisplayNearestPoint(toDip(p)).id);
  return [...vdd._active.keys()].some((k) => String(k) === id);
}

// Physical point over the picture in Kayboro window `target` for (u, v) in the game (its centre without a view).
function shellPoint(target, view, u, v) {
  return toPhysical(playCursor.viewPoint(view, target.getContentBounds(), target.webContents.getZoomFactor(), u, v));
}

// `popId`: play inside that screen's pop-out window instead of the main window. `view`: where the game's
// picture is in that window (client CSS px {x, y, w, h}), for handing the cursor over in both directions.
function startPlay(hwnd, popId = null, view = null) {
  const target = popId ? popout.windowOf(popId) : win;
  if (!target || target.isDestroyed() || !hwnd || !win32.isWindow(hwnd)) return false;
  if (play) stopPlay();
  // Cursor over the picture (clicked or Ctrl+Alt+P): it goes to the same spot on the game.
  const c = win32.getCursorPos();
  const at = c && playCursor.viewUV(view, target.getContentBounds(), target.webContents.getZoomFactor(), toDip(c));
  win32.focusWindow(hwnd);
  const g = win32.getClientRect(hwnd);
  if (at && g && g.width > 0 && g.height > 0) { const p = playCursor.rectPoint(g, at.u, at.v); win32.setCursorPos(p.x, p.y); }
  const r = clip(hwnd);
  target.setAlwaysOnTop(true, 'screen-saver');
  target.setIgnoreMouseEvents(true);
  play = { hwnd: String(hwnd), win: target, popId, view, hidden: !!vdd.findByHwnd(hwnd), hadFocus: false, away: 0,
    u: at ? at.u : 0.5, v: at ? at.v : 0.5, lastCursor: '', lastRect: r ? `${r.x},${r.y},${r.width},${r.height}` : '' };
  play.timer = setInterval(pollCursor, 8); // ~120 Hz
  sendTo(target, 'playState', { playing: true, hwnd: play.hwnd });
  if (popId) send('popout', { type: 'play', id: popId, playing: true });
  economy?.onPlayState(true, play.hwnd);
  return true;
}

// Gives the mouse back: unclips it, hands focus back to Kayboro (a focused game may keep hiding, clipping
// or re-centring the cursor) and puts the cursor over the picture where the drawn one was.
function stopPlay() {
  if (!play) return false;
  clearInterval(play.timer);
  const { hwnd, win: target, popId, view, u, v } = play;
  play = null;
  win32.clipCursor(null);
  if (popId) popout.afterPlay(popId);
  else if (target && !target.isDestroyed()) {
    target.setIgnoreMouseEvents(false);
    target.setAlwaysOnTop(false);
  }
  if (target && !target.isDestroyed()) {
    if (!target.isMinimized() && target.isVisible()) target.focus();
    const home = shellPoint(target, view, u, v);
    win32.setCursorPos(home.x, home.y);
    // The game may still be handling its deactivation: settle once more a moment later.
    setTimeout(() => {
      if (play) return;
      win32.clipCursor(null);
      if (onHiddenScreen(win32.getCursorPos()) && !target.isDestroyed()) win32.setCursorPos(home.x, home.y);
    }, 150);
  }
  sendTo(target, 'playState', { playing: false, hwnd });
  if (popId) send('popout', { type: 'play', id: popId, playing: false });
  economy?.onPlayState(false, hwnd);
  return true;
}

// Outside play mode nothing belongs on an invisible screen, but Windows may lay one out edge to edge with a
// real monitor, so the mouse can slide onto it. It acts as a wall: the cursor goes straight back to where
// it left the visible desktop (never into a console). A hidden game that grabbed focus (Alt+Tab) loses it
// to Kayboro so it stops pulling the cursor over.
let rescueTimer = null, lastSeen = null;
function watchCursor() {
  if (rescueTimer) return;
  rescueTimer = setInterval(() => {
    if (!vdd._active.size) { clearInterval(rescueTimer); rescueTimer = null; lastSeen = null; return; }
    if (play) { lastSeen = null; return; }
    const c = win32.getCursorPos();
    if (!c) return;
    if (!onHiddenScreen(c)) { lastSeen = c; return; }
    win32.clipCursor(null);
    const gameFocused = [...vdd._active.values()].some((a) => a.hwnd && win32.isForeground(a.hwnd));
    if (gameFocused && win && !win.isDestroyed() && win.isVisible() && !win.isMinimized()) win.focus();
    const back = lastSeen || toPhysical((({ x, y, width, height }) => ({ x: x + width / 2, y: y + height / 2 }))(screen.getPrimaryDisplay().workArea));
    win32.setCursorPos(back.x, back.y);
  }, 30);
}

// ---- Invisible screens: the game runs on a virtual monitor nobody can see ----

// Moves the game behind `hwnd` onto a new invisible screen sized for `aspect` (width / height). The game
// keeps running full speed (it is never minimized) and Kayboro is the only place it shows.
async function hideGame(hwnd, aspect) {
  if (!win32.isWindow(hwnd)) throw new Error('The game window is gone.');
  const had = vdd.findByHwnd(hwnd);
  if (had) return { displayId: String(had[0]), backend: had[1].backend, already: true };
  const restore = win32.getWindowRect(hwnd); // physical pixels, for bringing it back
  const s = await vdd.create(screen, { aspect });
  const target = process.platform === 'win32' ? screen.dipToScreenRect(null, s.bounds) : s.bounds;
  win32.placeWindow(hwnd, target);
  vdd.track(s.displayId, hwnd, restore);
  watchCursor();
  return s;
}

// Puts the game back where it was and unplugs its invisible screen.
async function showGame(hwnd) {
  const had = vdd.findByHwnd(hwnd);
  if (!had) return false;
  const [displayId, a] = had;
  if (play && String(play.hwnd) === String(hwnd)) stopPlay();
  if (win32.isWindow(hwnd)) {
    const prim = screen.getPrimaryDisplay().workArea, p = process.platform === 'win32' ? screen.dipToScreenRect(null, prim) : prim;
    win32.placeWindow(hwnd, a.restore || { x: p.x + 40, y: p.y + 40, width: Math.min(1280, p.width - 80), height: Math.min(720, p.height - 80) });
  }
  return vdd.remove(displayId);
}

// ---- Misc ---------------------------------------------------------------

async function pickFile(kind) {
  const r = await dialog.showOpenDialog(win, { properties: ['openFile'], filters: FILTERS[kind] || FILTERS.media });
  return r.canceled || !r.filePaths[0] ? null : pathToFileURL(r.filePaths[0]).href;
}

function setFullscreen(on) {
  if (!win || win.isDestroyed()) return false;
  win.setFullScreen(!!on);
  return true;
}

const HANDLERS = {
  listSources,
  detectSteamGame,
  getDisplays,
  moveWindowToDisplay,
  startPlay,
  stopPlay: () => stopPlay(),
  pickFile,
  listScenes: () => store.list(),
  loadScene: (name) => store.load(name),
  saveScene: (name, obj) => store.save(name, obj),
  deleteScene: (name) => store.remove(name),
  setFullscreen,
  // Pop-outs: rect is the shell's outer rect in the main window's content (CSS px), or saved screen bounds.
  // `avoid`: the sidebar's rect (same units). A new pop-out opens clear of it, so it never lands under the
  // mouse that just clicked Pop Out (the next click there would hit the console and start play).
  popOut: (id, screenData, rect, saved, avoid) => {
    if (!win || win.isDestroyed()) return false;
    const c = win.getContentBounds();
    let b = saved?.bounds || (rect && { x: c.x + rect.x, y: c.y + rect.y, width: rect.w, height: rect.h });
    if (b && !saved?.bounds && avoid) b = playCursor.clearOf(b, { x: c.x + avoid.x, y: c.y + avoid.y, width: avoid.w, height: avoid.h });
    return popout.open(String(id), screenData, b, { pinned: saved?.pinned ?? true });
  },
  popoutUpdate: (id, screenData) => popout.update(String(id), screenData),
  popoutClose: (id) => popout.close(String(id)),
  popoutPlay: (id) => { const w = popout.windowOf(String(id)); if (w) sendTo(w, 'popout', { type: 'playRequest', id: String(id) }); return !!w; },
  virtualScreenStatus: () => vdd.status(),
  installScreenDriver: () => vdd.installDriver().catch((err) => ({ ok: false, error: err.message })),
  hideGame: (hwnd, aspect) => hideGame(hwnd, aspect).catch((err) => ({ error: err.message })),
  showGame,
  // Kaybo community art (src/main/kaybo.js): browse, use (cached locally), save a copy, open on the site.
  kayboBrowse: (opts) => kaybo().browse(opts && typeof opts === 'object' ? opts : {}).catch((err) => ({ error: err.message })),
  kayboUse: (id, n) => kaybo().fetchWork(String(id), Number(n) || 0).catch((err) => ({ error: err.message })),
  async kayboSave(id, title) {
    const got = await kaybo().fetchWork(String(id), 0).catch((err) => ({ error: err.message }));
    if (got.error) return got;
    const ext = path.extname(got.file);
    const safe = String(title || 'kaybo').replace(/[^\w\- ]+/g, '').trim().slice(0, 60) || 'kaybo';
    const r = await dialog.showSaveDialog(win, { title: 'Save a copy', defaultPath: path.join(app.getPath('pictures'), safe + ext),
      filters: [{ name: 'Image or video', extensions: [ext.slice(1)] }] });
    if (r.canceled || !r.filePath) return null;
    fs.copyFileSync(got.file, r.filePath);
    return { file: r.filePath };
  },
  kayboOpen: (url) => {
    const u = require('./kaybo').siteUrl(url || '/');
    return u ? shell.openExternal(u).then(() => true) : false;
  },
};
const FALLBACK = { listSources: [], getDisplays: [], listScenes: [] }; // everything else -> null/false

function registerIpc() {
  for (const [name, fn] of Object.entries(HANDLERS)) {
    ipcMain.handle('ror:' + name, async (_e, ...args) => {
      try {
        return await fn(...args);
      } catch (err) {
        console.error(`[ror] ${name} failed:`, err);
        return name in FALLBACK ? FALLBACK[name] : /^(detect|load)/.test(name) ? null : false;
      }
    });
  }
}

app.whenReady().then(() => {
  registerIpc();
  require('./kaybo').registerProtocol(protocol, net);
  require('./steam/library').probeLibraries().catch(() => {}); // skip hung library drives before anything scans them
  popout.register({ ipcMain, page: path.join(__dirname, '..', 'renderer', 'index.html'), preload: path.join(__dirname, '..', 'preload.js'), icon: ICON,
    notify: (ev) => send('popout', ev), onPlayRequest: (id) => sendTo(popout.windowOf(id), 'popout', { type: 'playRequest', id }) });
  if (!sandbox.enabled) migrateUserData(app); // one-time copy of pre-rename (Shellcade) data; never throws. The sandbox starts fresh
  economy = registerEconomyIpc({ ipcMain, getWindow: () => win, detectSteamGame, isPlaying: () => !!play, userDataDir: app.getPath('userData') });
  createWindow();
  if (selftest) require('./selftest').run({ app, win, file: selftest.file, probe: () => economy.selfTestProbe() });
  // Global so they work while the game has focus; the renderer decides what to do.
  // Stopping is handled here so a hung/crashed renderer can't trap the user in the click-through overlay.
  globalShortcut.register('Control+Alt+P', () => (play ? stopPlay() : send('hotkey', 'toggle-play')));
  globalShortcut.register('Control+Alt+H', () => send('hotkey', 'toggle-ui'));
  app.on('activate', () => {
    if (!BrowserWindow.getAllWindows().length) createWindow();
  });
});

app.on('window-all-closed', () => app.quit());
// Games on invisible screens go back to a real one before Kayboro exits (the drivers would also unplug the
// screens on their own a moment later, and Windows then moves the windows, but this is tidier).
let screensReleased = false;
app.on('before-quit', (e) => {
  if (screensReleased || !vdd._active.size) return;
  e.preventDefault();
  const hwnds = [...vdd._active.values()].map((a) => a.hwnd).filter(Boolean);
  Promise.all(hwnds.map((h) => showGame(h).catch(() => {}))).then(() => vdd.dispose()).finally(() => { screensReleased = true; app.quit(); });
});
app.on('will-quit', () => {
  stopPlay();
  clearInterval(rescueTimer);
  globalShortcut.unregisterAll();
});
