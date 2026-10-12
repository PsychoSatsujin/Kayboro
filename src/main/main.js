'use strict';
const { app, BrowserWindow, ipcMain, desktopCapturer, screen, dialog, globalShortcut } = require('electron');
const path = require('path');
const { pathToFileURL } = require('url');
const win32 = require('./win32');
const store = require('./store');

const STEAM_RE = /\\steamapps\\common\\/i;
const IMG = ['png', 'jpg', 'jpeg', 'gif', 'webp', 'svg'];
const VID = ['mp4', 'webm', 'mov'];
const FILTERS = {
  image: [{ name: 'Images', extensions: IMG }],
  video: [{ name: 'Videos', extensions: VID }],
  media: [{ name: 'Images & videos', extensions: [...IMG, ...VID] }],
  frame: [{ name: 'Frame images', extensions: ['png', 'webp', 'svg'] }],
};

let win = null;
let play = null; // { hwnd, timer, lastCursor, lastRect }

const send = (ch, data) => {
  if (win && !win.isDestroyed()) win.webContents.send('ror:' + ch, data);
};

function createWindow() {
  win = new BrowserWindow({
    width: 1280,
    height: 800,
    minWidth: 480,
    minHeight: 320,
    title: 'RateofReality',
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
  win.on('closed', () => {
    stopPlay();
    win = null;
  });
}

// ---- Sources & displays -------------------------------------------------

async function listSources() {
  const own = new Set(BrowserWindow.getAllWindows().map((w) => w.getMediaSourceId()));
  const sources = await desktopCapturer.getSources({ types: ['window', 'screen'], thumbnailSize: { width: 320, height: 180 } });
  return sources.filter((s) => !own.has(s.id)).map((s) => {
    const kind = s.id.startsWith('screen:') ? 'screen' : 'window';
    const m = kind === 'window' ? /^window:(\d+):/.exec(s.id) : null; // Windows: "window:<HWND>:0"
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

  // Re-clip when the game window moved/resized (only while it has focus, so alt-tab isn't trapped).
  const rk = `${r.x},${r.y},${r.width},${r.height}`;
  if (rk !== play.lastRect && win32.isForeground(play.hwnd)) {
    play.lastRect = rk;
    win32.clipCursor(r);
  }

  const ck = `${c.x},${c.y},${rk}`;
  if (ck === play.lastCursor) return;
  play.lastCursor = ck;
  const u = (c.x - r.x) / r.width;
  const v = (c.y - r.y) / r.height;
  send('cursor', { u, v, inside: u >= 0 && u <= 1 && v >= 0 && v <= 1 });
}

function startPlay(hwnd) {
  if (!win || !hwnd || !win32.isWindow(hwnd)) return false;
  if (play) stopPlay();
  win32.focusWindow(hwnd);
  const r = clip(hwnd);
  win.setAlwaysOnTop(true, 'screen-saver');
  win.setIgnoreMouseEvents(true);
  play = { hwnd: String(hwnd), lastCursor: '', lastRect: r ? `${r.x},${r.y},${r.width},${r.height}` : '' };
  play.timer = setInterval(pollCursor, 8); // ~120 Hz
  send('playState', { playing: true, hwnd: play.hwnd });
  return true;
}

function stopPlay() {
  if (!play) return false;
  clearInterval(play.timer);
  const { hwnd } = play;
  play = null;
  win32.clipCursor(null);
  if (win && !win.isDestroyed()) {
    win.setIgnoreMouseEvents(false);
    win.setAlwaysOnTop(false);
  }
  send('playState', { playing: false, hwnd });
  return true;
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
  createWindow();
  // Global so they work while the game has focus; the renderer decides what to do.
  globalShortcut.register('Control+Alt+P', () => send('hotkey', 'toggle-play'));
  globalShortcut.register('Control+Alt+H', () => send('hotkey', 'toggle-ui'));
  app.on('activate', () => {
    if (!BrowserWindow.getAllWindows().length) createWindow();
  });
});

app.on('window-all-closed', () => app.quit());
app.on('will-quit', () => {
  stopPlay();
  globalShortcut.unregisterAll();
});
