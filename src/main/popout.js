'use strict';
// Pop-out shells: one frameless, transparent window per popped-out screen, holding just that console.
// The renderer reports whether the cursor is over the shell (opaque pixels or the screen opening): only
// then does the window take the mouse, so the transparent corners click through to the desktop. The shell
// drags anywhere (polled from the real cursor, so fast flicks never drop it), Ctrl+wheel resizes around
// the centre, right-click opens a native menu. The main window owns the scene: screen changes are relayed
// here, and bounds/dock events go back to it as 'popout' events.
const { BrowserWindow, Menu, screen } = require('electron');
const fs = require('fs');
const path = require('path');
const { fileURLToPath } = require('url');

const MIN = 120; // smallest side, DIP
const IMG = /\.(?:svg|png|webp)$/i;
const MIME = { '.svg': 'image/svg+xml', '.png': 'image/png', '.webp': 'image/webp' };
const pops = new Map(); // screen id -> { win, screen, pinned, drag }

let ctx = null; // { page, preload, icon, notify(ev), onPlayRequest(id) }

const byWc = (wc) => [...pops.entries()].find(([, p]) => !p.win.isDestroyed() && p.win.webContents === wc) || [];
const live = (p) => p && !p.win.isDestroyed();

// Keep a rect on the display it mostly sits on (dragging or resizing never loses the window off-screen).
function clamp(b) {
  const wa = screen.getDisplayMatching(b).workArea, w = Math.min(b.width, wa.width), h = Math.min(b.height, wa.height);
  return { x: Math.round(Math.min(Math.max(b.x, wa.x - w + MIN), wa.x + wa.width - MIN)), y: Math.round(Math.min(Math.max(b.y, wa.y), wa.y + wa.height - MIN)),
    width: Math.round(w), height: Math.round(h) };
}

function notifyBounds(id, p) {
  if (live(p)) ctx.notify({ type: 'bounds', id, bounds: p.win.getBounds(), pinned: p.pinned });
}

/** Opens (or refocuses) the pop-out for screen `id` at `bounds` (screen DIP). */
function open(id, screenData, bounds, { pinned = true } = {}) {
  const had = pops.get(id);
  if (live(had)) { had.screen = screenData; had.win.webContents.send('ror:popout', { type: 'screen', screen: screenData }); had.win.focus(); return true; }
  const b = clamp({ x: bounds?.x ?? 100, y: bounds?.y ?? 100, width: Math.max(MIN, bounds?.width || 480), height: Math.max(MIN, bounds?.height || 360) });
  const win = new BrowserWindow({
    ...b, frame: false, transparent: true, backgroundColor: '#00000000', hasShadow: false, resizable: false, maximizable: false,
    fullscreenable: false, alwaysOnTop: pinned, skipTaskbar: false, show: false, title: `Kayboro: ${screenData?.sourceName || 'Shell'}`, icon: ctx.icon,
    webPreferences: { preload: ctx.preload, contextIsolation: true, nodeIntegration: false, sandbox: false, backgroundThrottling: false },
  });
  const p = { win, screen: screenData, pinned, drag: null };
  pops.set(id, p);
  win.setIgnoreMouseEvents(true, { forward: true }); // until the renderer reports the cursor over the shell
  win.loadFile(ctx.page, { query: { popout: id } });
  win.once('ready-to-show', () => win.showInactive());
  win.on('blur', () => stopDrag(p, id));
  win.on('closed', () => {
    stopDrag(p, id);
    if (pops.get(id) === p) pops.delete(id);
    ctx.notify({ type: 'closed', id });
  });
  return true;
}

const update = (id, screenData) => {
  const p = pops.get(id);
  if (!live(p)) return false;
  p.screen = screenData;
  p.win.webContents.send('ror:popout', { type: 'screen', screen: screenData });
  return true;
};

const close = (id) => { const p = pops.get(id); if (live(p)) p.win.close(); return !!p; };
const closeAll = () => { for (const id of [...pops.keys()]) close(id); };
const windowOf = (id) => { const p = pops.get(id); return live(p) ? p.win : null; };
const has = (wc) => !!byWc(wc)[1];

// Play mode handed the window back: mouse follows the shell again, pin state restored.
function afterPlay(id) {
  const p = pops.get(id);
  if (!live(p)) return;
  p.win.setAlwaysOnTop(p.pinned, 'floating');
  p.win.setIgnoreMouseEvents(true, { forward: true });
  p.win.webContents.send('ror:popout', { type: 'rehit' });
}

function startDrag(p, id) {
  stopDrag(p, id);
  const c0 = screen.getCursorScreenPoint(), [x0, y0] = p.win.getPosition();
  p.drag = setInterval(() => {
    if (!live(p)) return stopDrag(p, id);
    const c = screen.getCursorScreenPoint();
    p.win.setPosition(x0 + c.x - c0.x, y0 + c.y - c0.y);
  }, 8);
}
// Edge/corner drag: the opposite side stays put (an edge keeps its centre), the shell keeps its aspect.
function startResize(p, id, edge) {
  stopDrag(p, id);
  const c0 = screen.getCursorScreenPoint(), b0 = p.win.getBounds(), wa = screen.getDisplayMatching(b0).workArea;
  p.drag = setInterval(() => {
    if (!live(p)) return stopDrag(p, id);
    const c = screen.getCursorScreenPoint();
    p.win.setBounds(resizeBounds(b0, edge, c.x - c0.x, c.y - c0.y, wa));
  }, 16);
}

/** `b` resized by dragging `edge` ('n', 'se', ...) by (dx, dy), aspect kept, between MIN and the work area. */
function resizeBounds(b, edge, dx, dy, wa) {
  const E = edge.includes('e'), W = edge.includes('w'), N = edge.includes('n'), S = edge.includes('s'), a = b.width / b.height;
  let w = b.width + (E ? dx : W ? -dx : 0), h = b.height + (S ? dy : N ? -dy : 0);
  if ((E || W) && (N || S)) { if (w / a >= h) h = w / a; else w = h * a; } else if (E || W) h = w / a; else w = h * a;
  if (Math.min(w, h) < MIN) { if (a >= 1) { h = MIN; w = h * a; } else { w = MIN; h = w / a; } }
  if (wa && (w > wa.width || h > wa.height)) { const k = Math.min(wa.width / w, wa.height / h); w *= k; h *= k; }
  const x = W ? b.x + b.width - w : E ? b.x : b.x + (b.width - w) / 2, y = N ? b.y + b.height - h : S ? b.y : b.y + (b.height - h) / 2;
  return { x: Math.round(x), y: Math.round(y), width: Math.round(w), height: Math.round(h) };
}

function stopDrag(p, id) {
  if (!p.drag) return;
  clearInterval(p.drag);
  p.drag = null;
  if (live(p)) { p.win.setBounds(clamp(p.win.getBounds())); notifyBounds(id, p); }
}

// Scales the window by `k` around its centre, keeping the shell's aspect.
function resize(p, id, k) {
  const b = p.win.getBounds(), a = b.width / b.height;
  let w = Math.round(b.width * k), h = Math.round(w / a);
  if (Math.min(w, h) < MIN) { w = a >= 1 ? Math.round(MIN * a) : MIN; h = Math.round(w / a); }
  const wa = screen.getDisplayMatching(b).workArea;
  if (w > wa.width || h > wa.height) { const s = Math.min(wa.width / w, wa.height / h); w = Math.round(w * s); h = Math.round(h * s); }
  p.win.setBounds(clamp({ x: b.x + (b.width - w) / 2, y: b.y + (b.height - h) / 2, width: w, height: h }));
  notifyBounds(id, p);
}

function menu(p, id) {
  const sizes = [0.5, 0.75, 1.25, 1.5, 2].map((k) => ({ label: k < 1 ? `Smaller (${k * 100}%)` : `Larger (${k * 100}%)`, click: () => resize(p, id, k) }));
  Menu.buildFromTemplate([
    { label: 'Play', click: () => ctx.onPlayRequest(id) },
    { type: 'separator' },
    { label: 'Always on Top', type: 'checkbox', checked: p.pinned, click: (it) => { p.pinned = it.checked; p.win.setAlwaysOnTop(p.pinned, 'floating'); notifyBounds(id, p); } },
    { label: 'Size', submenu: sizes },
    { type: 'separator' },
    { label: 'Dock Back to Kayboro', click: () => p.win.close() },
  ]).popup({ window: p.win });
}

// Frame image as a data URL so the renderer can read its alpha without a tainted canvas (file:// images).
function frameData(url) {
  try {
    const f = fileURLToPath(String(url));
    if (!IMG.test(f)) return null;
    return `data:${MIME[path.extname(f).toLowerCase()]};base64,${fs.readFileSync(f).toString('base64')}`;
  } catch {
    return null;
  }
}

/** Registers the pop-out IPC. `opts`: { ipcMain, page, preload, notify(ev), onPlayRequest(id) }. */
function register(opts) {
  ctx = opts;
  const on = (name, fn) => opts.ipcMain.handle('ror:' + name, async (e, ...args) => {
    try { return await fn(e, ...args); } catch (err) { console.error(`[popout] ${name} failed:`, err); return null; }
  });
  on('popoutInfo', (e) => { const [id, p] = byWc(e.sender); return p ? { id, screen: p.screen, pinned: p.pinned } : null; });
  on('popoutHit', (e, hit) => { const [, p] = byWc(e.sender); if (p && !p.drag) p.win.setIgnoreMouseEvents(!hit, { forward: true }); return !!p; });
  on('popoutDrag', (e, active) => { const [id, p] = byWc(e.sender); if (!p) return false; if (active) startDrag(p, id); else stopDrag(p, id); return true; });
  on('popoutResizeDrag', (e, edge) => {
    const [id, p] = byWc(e.sender);
    if (!p) return false;
    if (edge && /^(?:[ns][ew]?|[ew])$/.test(edge)) startResize(p, id, edge); else stopDrag(p, id);
    return true;
  });
  on('popoutResize', (e, k) => { const [id, p] = byWc(e.sender); if (!p || !(k > 0.2 && k < 5)) return false; resize(p, id, k); return true; });
  on('popoutMenu', (e) => { const [id, p] = byWc(e.sender); if (p) menu(p, id); return !!p; });
  on('popoutFrame', (_e, url) => frameData(url));
}

module.exports = { register, open, update, close, closeAll, windowOf, afterPlay, has, clamp, resizeBounds };
