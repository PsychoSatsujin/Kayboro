'use strict';
// RateofReality end-to-end smoke test. Electron entry point:
//
//   npx electron test/e2e/smoke.js                    (Windows / macOS)
//   xvfb-run -a -s "-screen 0 1600x900x24" npx electron --no-sandbox test/e2e/smoke.js   (Linux)
//
// It boots the real app (src/main/main.js) with a fresh userData dir and a scripted file picker,
// then drives it like a user: real mouse/keyboard input through webContents.sendInputEvent, sidebar
// clicks in the page, and window.ror calls. Windows-only checks (Steam detection, window moving,
// play mode, global hotkey) need a running fake game: set FAKE_GAME_TITLE (see .github/workflows/smoke.yml).
//
// Output: a results table on stdout, test/e2e/out/results.json and one PNG per major step.
// Exit code 1 if any check FAILs. Hard limit: 150 s for the whole run.

const { app, dialog, ipcMain, screen } = require('electron');
const fs = require('fs');
const os = require('os');
const path = require('path');
const zlib = require('zlib');
const { pathToFileURL } = require('url');

const ROOT = path.resolve(__dirname, '..', '..');
const OUT = path.join(__dirname, 'out');
const IS_WIN = process.platform === 'win32';
const GAME_TITLE = process.env.FAKE_GAME_TITLE || '';
const HARD_TIMEOUT_MS = 150000;
// Debugging aid: SMOKE_ONLY=app-load,bg-gif runs just those checks (the rest are reported as SKIP).
const ONLY = (process.env.SMOKE_ONLY || '').split(',').map((s) => s.trim()).filter(Boolean);
const T0 = Date.now();

// ---- Fresh state + instrumentation (must happen before the app's main.js is loaded) ----------

fs.rmSync(OUT, { recursive: true, force: true });
fs.mkdirSync(OUT, { recursive: true });
const TMP = fs.mkdtempSync(path.join(os.tmpdir(), 'ror-smoke-'));
const USER_DATA = path.join(TMP, 'userData');
fs.mkdirSync(USER_DATA);
app.setPath('userData', USER_DATA);

const rendererErrors = []; // console errors, crashes, failed loads in the app window
const mainErrors = []; // console.error in the main process ([ror] handler failures, [store] ...)
const ipcLog = []; // every ror:* invoke: { ch, args, result, ms }
const dialogLog = []; // every showOpenDialog call
const pickQueue = []; // file paths the next showOpenDialog calls will "pick"

dialog.showOpenDialog = async (a, b) => {
  const opts = (b || a || {});
  const file = pickQueue.shift() || null;
  dialogLog.push({ at: Date.now() - T0, filters: opts.filters || null, file });
  return file ? { canceled: false, filePaths: [file] } : { canceled: true, filePaths: [] };
};

const origHandle = ipcMain.handle.bind(ipcMain);
ipcMain.handle = (ch, fn) => origHandle(ch, async (e, ...args) => {
  const t = Date.now();
  const entry = { ch, args: brief(args, 200), result: undefined, ms: 0 };
  ipcLog.push(entry);
  const result = await fn(e, ...args);
  entry.ms = Date.now() - t;
  entry.result = typeof result === 'object' && result !== null ? brief(result, 300) : result;
  entry.raw = result;
  return result;
});

for (const level of ['error', 'warn']) {
  const orig = console[level].bind(console);
  console[level] = (...args) => {
    const msg = args.map((x) => (x instanceof Error ? x.stack || x.message : typeof x === 'string' ? x : brief(x, 300))).join(' ');
    if (level === 'error' || /^\[(ror|store|win32)\]/.test(msg)) mainErrors.push({ at: Date.now() - T0, level, msg });
    orig(...args);
  };
}
process.on('uncaughtException', (err) => mainErrors.push({ at: Date.now() - T0, level: 'uncaught', msg: err.stack || String(err) }));
process.on('unhandledRejection', (err) => mainErrors.push({ at: Date.now() - T0, level: 'unhandledRejection', msg: (err && err.stack) || String(err) }));

let appWin = null;
let wc = null;
let resolveLoaded, rejectLoaded;
const loaded = new Promise((res, rej) => { resolveLoaded = res; rejectLoaded = rej; });
loaded.catch(() => {});

app.on('browser-window-created', (_e, w) => {
  if (appWin) return;
  appWin = w;
  wc = w.webContents;
  wc.once('did-finish-load', () => resolveLoaded());
  wc.on('did-fail-load', (_ev, code, desc, url, isMainFrame) => {
    rendererErrors.push({ at: Date.now() - T0, kind: 'did-fail-load', msg: `${code} ${desc} ${url}` });
    if (isMainFrame) rejectLoaded(new Error(`did-fail-load ${code} ${desc}`));
  });
  wc.on('console-message', (ev, ...rest) => {
    // Electron >= 35 passes one event object; older versions pass (event, level, message, line, sourceId).
    const level = typeof ev.level === 'string' ? ev.level : ['verbose', 'info', 'warning', 'error'][rest[0]];
    const message = typeof ev.message === 'string' ? ev.message : rest[1];
    const line = ev.lineNumber ?? rest[2];
    const src = ev.sourceId ?? rest[3];
    if (level === 'error') rendererErrors.push({ at: Date.now() - T0, kind: 'console', msg: `${message} (${src}:${line})` });
  });
  wc.on('preload-error', (_ev, p, err) => rendererErrors.push({ at: Date.now() - T0, kind: 'preload-error', msg: `${p}: ${err && err.message}` }));
  wc.on('render-process-gone', (_ev, d) => rendererErrors.push({ at: Date.now() - T0, kind: 'render-process-gone', msg: JSON.stringify(d) }));
  wc.on('unresponsive', () => rendererErrors.push({ at: Date.now() - T0, kind: 'unresponsive', msg: 'renderer unresponsive' }));
});

let mainLoadError = null;
try {
  require(path.join(ROOT, 'src', 'main', 'main.js'));
} catch (err) {
  mainLoadError = err;
}

// ---- Small utilities ---------------------------------------------------------------------------

function brief(v, max = 160) {
  let s;
  try { s = typeof v === 'string' ? v : JSON.stringify(v); } catch { s = String(v); }
  if (s === undefined) s = String(v);
  return s.length > max ? s.slice(0, max) + '…' : s;
}
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const near = (a, b, tol) => Number.isFinite(a) && Number.isFinite(b) && Math.abs(a - b) <= tol;
const fmtRect = (r) => (r ? `${r.x.toFixed(1)},${r.y.toFixed(1)} ${r.w.toFixed(1)}x${r.h.toFixed(1)}` : 'null');
function assert(cond, msg) { if (!cond) throw new Error(msg); }

// Every check bumps this; a straggling waitFor from a timed-out check notices and stops.
let epoch = 0;

/** Poll fn() until it returns a value that is truthy and not { ok: false }. Throws on timeout. */
async function waitFor(desc, fn, timeout = 5000, interval = 40) {
  const mine = epoch, end = Date.now() + timeout;
  let last;
  for (;;) {
    if (mine !== epoch) throw new Error(`aborted while waiting for ${desc}`);
    try { last = await fn(); } catch (err) { last = { ok: false, error: String((err && err.message) || err) }; }
    if (last && last.ok !== false) return last;
    if (Date.now() >= end) throw new Error(`timed out after ${timeout} ms waiting for ${desc}; last: ${brief(last, 400)}`);
    await sleep(interval);
  }
}

/** Run a function (no closures!) in the app page's main world with JSON args. */
function R(fn, ...args) {
  return wc.executeJavaScript(`(${fn})(...${JSON.stringify(args)})`, true);
}

let shotN = 0;
async function shot(name) {
  try {
    const img = await wc.capturePage();
    fs.writeFileSync(path.join(OUT, `${String(++shotN).padStart(2, '0')}-${name}.png`), img.toPNG());
  } catch (err) {
    console.log(`  (screenshot ${name} failed: ${err.message})`);
  }
}

/** [r, g, b] of the rendered page at CSS pixel (x, y). capturePage pixels are BGRA. */
async function pixelAt(x, y) {
  const img = await wc.capturePage({ x: Math.round(x), y: Math.round(y), width: 1, height: 1 });
  const b = img.toBitmap();
  assert(b.length >= 4, `capturePage(${x},${y}) returned an empty bitmap`);
  return [b[2], b[1], b[0]];
}
const colorNear = (px, want, tol) => px && want.every((c, i) => Math.abs(px[i] - c) <= tol);
const hex = (c) => '#' + c.map((n) => n.toString(16).padStart(2, '0')).join('');

// ---- Real input --------------------------------------------------------------------------------

function mouse(type, x, y, extra = {}) {
  wc.sendInputEvent({ type, x: Math.round(x), y: Math.round(y), ...extra });
}
function focusApp() {
  if (!appWin.isFocused()) appWin.focus();
  wc.focus();
}
async function click(p, modifiers = []) {
  focusApp();
  mouse('mouseMove', p.x, p.y, { modifiers });
  mouse('mouseDown', p.x, p.y, { button: 'left', clickCount: 1, modifiers });
  mouse('mouseUp', p.x, p.y, { button: 'left', clickCount: 1, modifiers });
}
async function dblclick(p) {
  focusApp();
  mouse('mouseMove', p.x, p.y);
  mouse('mouseDown', p.x, p.y, { button: 'left', clickCount: 1 });
  mouse('mouseUp', p.x, p.y, { button: 'left', clickCount: 1 });
  mouse('mouseDown', p.x, p.y, { button: 'left', clickCount: 2 });
  mouse('mouseUp', p.x, p.y, { button: 'left', clickCount: 2 });
}
async function drag(from, to, { steps = 12, modifiers = [] } = {}) {
  focusApp();
  mouse('mouseMove', from.x, from.y, { modifiers });
  mouse('mouseDown', from.x, from.y, { button: 'left', clickCount: 1, modifiers });
  for (let i = 1; i <= steps; i++) {
    const k = i / steps;
    mouse('mouseMove', from.x + (to.x - from.x) * k, from.y + (to.y - from.y) * k, { button: 'left', modifiers: [...modifiers, 'leftButtonDown'] });
    await sleep(8); // spread the moves over a few frames like a hand would; correctness is still polled below
  }
  mouse('mouseUp', to.x, to.y, { button: 'left', clickCount: 1, modifiers });
}
function key(keyCode, modifiers = []) {
  focusApp();
  wc.sendInputEvent({ type: 'keyDown', keyCode, modifiers });
  wc.sendInputEvent({ type: 'keyUp', keyCode, modifiers });
}
async function typeInto(selector, text) {
  const ok = await R((sel) => { const e = document.querySelector(sel); if (!e) return false; e.focus(); e.select?.(); return document.activeElement === e; }, selector);
  assert(ok, `could not focus ${selector}`);
  focusApp();
  await wc.insertText(text);
}

// ---- In-page helpers (installed once after load) -----------------------------------------------

function installHelpers() {
  if (window.__smoke) return true;
  const S = (window.__smoke = { toasts: [], cursor: [], hotkeys: [], playStates: [] });
  const toast = document.getElementById('toast');
  new MutationObserver(() => { if (toast.textContent) S.toasts.push({ at: Date.now(), text: toast.textContent }); })
    .observe(toast, { childList: true, characterData: true, subtree: true });
  if (window.ror) {
    window.ror.onCursor((c) => S.cursor.push({ at: Date.now(), ...c }));
    window.ror.onHotkey((name) => S.hotkeys.push({ at: Date.now(), name }));
    window.ror.onPlayState((p) => S.playStates.push({ at: Date.now(), ...p }));
  }
  const num = (v) => parseFloat(v);
  S.rectOf = (el) => ({ x: num(el.style.left), y: num(el.style.top), w: num(el.style.width), h: num(el.style.height) });
  S.bcr = (el) => { const b = el.getBoundingClientRect(); return { x: b.left, y: b.top, w: b.width, h: b.height }; };
  S.screens = () => [...document.querySelectorAll('#screens .screen')];
  S.sel = () => document.querySelector('#screens .screen.sel');
  S.selRect = () => (S.sel() ? S.rectOf(S.sel()) : null);
  S.chip = () => document.querySelector('#aspects .chip.on')?.dataset.a ?? null;
  S.lastToast = () => S.toasts[S.toasts.length - 1]?.text ?? '';
  S.toastSince = (t, re) => S.toasts.some((x) => x.at >= t && new RegExp(re).test(x.text));
  // Area of the stage the user can see: the window minus the sidebar (unless hidden).
  S.visibleStage = () => {
    const ui = document.getElementById('ui');
    const right = document.body.classList.contains('ui-hidden') ? innerWidth : Math.min(innerWidth, ui.getBoundingClientRect().left);
    return { x: 0, y: 0, w: right, h: innerHeight };
  };
  // A point on `el` that the mouse can actually hit (not covered by the sidebar or another screen, not a handle).
  S.grabPoint = (el) => {
    const b = el.getBoundingClientRect(), vs = S.visibleStage();
    const x0 = Math.max(b.left, 0), x1 = Math.min(b.right, vs.w), y0 = Math.max(b.top, 0), y1 = Math.min(b.bottom, vs.h);
    if (x1 - x0 < 4 || y1 - y0 < 4) return null;
    const pts = [[(x0 + x1) / 2, (y0 + y1) / 2]];
    for (let i = 1; i < 6; i++) for (let j = 1; j < 6; j++) pts.push([x0 + ((x1 - x0) * i) / 6, y0 + ((y1 - y0) * j) / 6]);
    for (const [x, y] of pts) {
      const rx = Math.round(x), ry = Math.round(y), hit = document.elementFromPoint(rx, ry);
      if (hit && hit.closest('.screen') === el && !hit.dataset.h) return { x: rx, y: ry };
    }
    return null;
  };
  S.handlePoint = (el, h) => {
    const e = el.querySelector('.h-' + h);
    if (!e) return null;
    const b = e.getBoundingClientRect(), x = Math.round(b.left + b.width / 2), y = Math.round(b.top + b.height / 2);
    return { h, x, y, hit: document.elementFromPoint(x, y) === e };
  };
  // A stage point showing the background: not on any screen or frame, not under the sidebar or toast.
  S.freePoint = () => {
    const vs = S.visibleStage();
    const boxes = [...document.querySelectorAll('#screens .screen, #screens .screen > .frame')]
      .map(S.bcr).filter((b) => b.w > 0 && b.h > 0);
    for (let y = 12; y < vs.h - 90; y += 20) {
      for (let x = 12; x < vs.w - 12; x += 20) {
        if (!boxes.some((b) => x >= b.x - 8 && x <= b.x + b.w + 8 && y >= b.y - 8 && y <= b.y + b.h + 8)) return { x, y };
      }
    }
    return null;
  };
  // Pixel statistics of a <video>'s current frame (canvas readback).
  S.videoStats = (v, box, W = 96) => {
    if (!v || !v.videoWidth) return null;
    const H = Math.max(1, Math.round((W * v.videoHeight) / v.videoWidth));
    const c = document.createElement('canvas');
    c.width = W; c.height = H;
    const ctx = c.getContext('2d', { willReadFrequently: true });
    ctx.drawImage(v, 0, 0, W, H);
    const d = ctx.getImageData(0, 0, W, H).data;
    let lo = 255, hi = 0, bx0 = W, by0 = H, bx1 = -1, by1 = -1;
    const colors = new Set();
    for (let i = 0, p = 0; i < d.length; i += 4, p++) {
      const l = (d[i] * 299 + d[i + 1] * 587 + d[i + 2] * 114) / 1000;
      lo = Math.min(lo, l); hi = Math.max(hi, l);
      colors.add(((d[i] >> 4) << 8) | ((d[i + 1] >> 4) << 4) | (d[i + 2] >> 4));
      if (box && Math.abs(d[i] - box[0]) <= 40 && Math.abs(d[i + 1] - box[1]) <= 40 && Math.abs(d[i + 2] - box[2]) <= 40) {
        const x = p % W, y = (p - x) / W;
        bx0 = Math.min(bx0, x); by0 = Math.min(by0, y); bx1 = Math.max(bx1, x); by1 = Math.max(by1, y);
      }
    }
    // Mean of the central 5x5 block.
    const acc = [0, 0, 0];
    for (let y = (H >> 1) - 2; y <= (H >> 1) + 2; y++) for (let x = (W >> 1) - 2; x <= (W >> 1) + 2; x++) {
      const i = (y * W + x) * 4; acc[0] += d[i]; acc[1] += d[i + 1]; acc[2] += d[i + 2];
    }
    return {
      vw: v.videoWidth, vh: v.videoHeight, lumMin: Math.round(lo), lumMax: Math.round(hi), colors: colors.size,
      centre: acc.map((n) => Math.round(n / 25)),
      box: box && bx1 >= 0 ? { x: bx0 / W, y: by0 / H, w: (bx1 - bx0 + 1) / W, h: (by1 - by0 + 1) / H } : null,
    };
  };
  S.click = (sel) => {
    const e = document.querySelector(sel);
    if (!e) throw new Error('no element ' + sel);
    if (e.disabled) throw new Error(sel + ' is disabled');
    e.click();
    return true;
  };
  // Expand a collapsed sidebar section (<details>) by clicking its <summary>, like a user.
  S.openSection = (title) => {
    const d = [...document.querySelectorAll('#ui details')].find((x) => x.querySelector('summary').textContent.trim() === title);
    if (!d) throw new Error('no sidebar section ' + title);
    if (!d.open) d.querySelector('summary').click();
    return d.open;
  };
  S.setValue = (sel, value, ev) => {
    const e = document.querySelector(sel);
    e.value = value;
    e.dispatchEvent(new Event(ev, { bubbles: true }));
    return e.value;
  };
  return true;
}

// ---- Fixtures ----------------------------------------------------------------------------------

const CRC_TABLE = (() => {
  const t = new Int32Array(256);
  for (let n = 0; n < 256; n++) { let c = n; for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1; t[n] = c; }
  return t;
})();
function crc32(buf) {
  let c = -1;
  for (let i = 0; i < buf.length; i++) c = CRC_TABLE[(c ^ buf[i]) & 0xff] ^ (c >>> 8);
  return (c ^ -1) >>> 0;
}
/** RGBA PNG encoder. pixel(x, y) -> [r, g, b, a]. */
function encodePng(w, h, pixel) {
  const stride = w * 4 + 1, raw = Buffer.alloc(stride * h);
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) raw.set(pixel(x, y), y * stride + 1 + x * 4);
  const chunk = (type, data) => {
    const td = Buffer.concat([Buffer.from(type, 'ascii'), data]);
    const len = Buffer.alloc(4); len.writeUInt32BE(data.length);
    const crc = Buffer.alloc(4); crc.writeUInt32BE(crc32(td));
    return Buffer.concat([len, td, crc]);
  };
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(w, 0); ihdr.writeUInt32BE(h, 4); ihdr[8] = 8; ihdr[9] = 6; // 8-bit RGBA
  return Buffer.concat([Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk('IHDR', ihdr), chunk('IDAT', zlib.deflateSync(raw)), chunk('IEND', Buffer.alloc(0))]);
}
// 16x16 GIF89a, 2 frames (yellow #ffff00, cyan #00ffff), 250 ms each, loops forever.
const ANIM_GIF_B64 =
  'R0lGODlhEAAQAIAAAP//AAD//yH/C05FVFNDQVBFMi4wAwEAAAAh+QQEGQAAACwAAAAAEAAQAAACwQRBEARBEARBEARBEARBEARBEARBEARBEARBEARBEARBEARBEARBEARBEARBEARBEARBEARBEARBEARBEARBEARBEARBEARBEARBEARBEARBEARBEARBEARBEARBEARBEARBEARBEARBEARBEARBEARBEARBEARBEARBEARBEARBEARBEARBEARBEARBEARBEARBEARBEARBEARBEARBEARBEARBEARBEARBEARBEARBEARBEARBEARBEARBEARBEAUAIfkEBBkAAAAsAAAAABAAEAAAAsEMwzAMwzAMwzAMwzAMwzAMwzAMwzAMwzAMwzAMwzAMwzAMwzAMwzAMwzAMwzAMwzAMwzAMwzAMwzAMwzAMwzAMwzAMwzAMwzAMwzAMwzAMwzAMwzAMwzAMwzAMwzAMwzAMwzAMwzAMwzAMwzAMwzAMwzAMwzAMwzAMwzAMwzAMwzAMwzAMwzAMwzAMwzAMwzAMwzAMwzAMwzAMwzAMwzAMwzAMwzAMwzAMwzAMwzAMwzAMwzAMwzAMwzAMwzAMwzAFADs=';
const GIF_COLORS = [[255, 255, 0], [0, 255, 255]];
const BG_PNG_COLOR = [32, 192, 64];
const BG_COLOR = [0x12, 0x34, 0x56];
const VIDEO_COLOR = [0xe0, 0x10, 0x70];
const GAME_COLOR = [255, 0, 255];
// Custom frame: 200x200 opaque purple with a transparent 150x90 opening at (25, 50) -> hole fractions:
const CUSTOM_HOLE = { x: 25 / 200, y: 50 / 200, w: 150 / 200, h: 90 / 200 };

function fixture(name, buf) {
  const p = path.join(TMP, name);
  fs.writeFileSync(p, buf);
  try { fs.copyFileSync(p, path.join(OUT, 'fixture-' + name)); } catch {}
  return p;
}

// ---- Windows API for independent verification (own koffi bindings) ----------------------------

let W32 = null;
function win() {
  if (W32) return W32;
  const koffi = require('koffi');
  const u = koffi.load('user32.dll');
  // Distinct type names: src/main/win32.js registers POINT/RECT in the same koffi instance.
  koffi.struct('SMOKE_RECT', { left: 'int32', top: 'int32', right: 'int32', bottom: 'int32' });
  koffi.struct('SMOKE_POINT', { x: 'int32', y: 'int32' });
  const f = (s) => u.func(s);
  const api = {
    GetWindowRect: f('int __stdcall GetWindowRect(intptr_t hWnd, _Out_ SMOKE_RECT *r)'),
    GetClientRect: f('int __stdcall GetClientRect(intptr_t hWnd, _Out_ SMOKE_RECT *r)'),
    ClientToScreen: f('int __stdcall ClientToScreen(intptr_t hWnd, _Inout_ SMOKE_POINT *p)'),
    GetClipCursor: f('int __stdcall GetClipCursor(_Out_ SMOKE_RECT *r)'),
    ClipCursor: f('int __stdcall ClipCursor(const SMOKE_RECT *r)'),
    SetCursorPos: f('int __stdcall SetCursorPos(int x, int y)'),
    SetWindowPos: f('int __stdcall SetWindowPos(intptr_t hWnd, intptr_t after, int x, int y, int cx, int cy, uint32 flags)'),
    GetSystemMetrics: f('int __stdcall GetSystemMetrics(int index)'),
    GetForegroundWindow: f('intptr_t __stdcall GetForegroundWindow()'),
    keybd_event: f('void __stdcall keybd_event(uint8 vk, uint8 scan, uint32 flags, uintptr_t extra)'),
  };
  const rect = (r) => ({ x: r.left, y: r.top, w: r.right - r.left, h: r.bottom - r.top });
  const H = (h) => Number(h);
  W32 = {
    windowRect: (h) => { const r = {}; return api.GetWindowRect(H(h), r) ? rect(r) : null; },
    clientRect: (h) => {
      const r = {}, p = { x: 0, y: 0 };
      if (!api.GetClientRect(H(h), r) || !api.ClientToScreen(H(h), p)) return null;
      return { x: p.x, y: p.y, w: r.right - r.left, h: r.bottom - r.top };
    },
    clip: () => { const r = {}; return api.GetClipCursor(r) ? rect(r) : null; },
    unclip: () => api.ClipCursor(null),
    setCursor: (x, y) => !!api.SetCursorPos(x, y),
    moveTo: (h, x, y) => !!api.SetWindowPos(H(h), 0, x, y, 0, 0, 0x1 | 0x4 | 0x10), // NOSIZE|NOZORDER|NOACTIVATE
    virtualScreen: () => ({ x: api.GetSystemMetrics(76), y: api.GetSystemMetrics(77), w: api.GetSystemMetrics(78), h: api.GetSystemMetrics(79) }),
    foreground: () => String(api.GetForegroundWindow()),
    chord: (vks) => { // press in order, release in reverse
      for (const vk of vks) api.keybd_event(vk, 0, 0, 0);
      for (const vk of [...vks].reverse()) api.keybd_event(vk, 0, 2, 0);
    },
  };
  return W32;
}
// Same contract as fitRect() in src/renderer/layout.js (where a picture of `aspect` lands inside `box`).
function fitRect(aspect, box, mode = 'contain') {
  if (mode === 'stretch' || !(aspect > 0)) return { ...box };
  const wider = aspect > box.w / box.h, byWidth = mode === 'cover' ? !wider : wider;
  const w = byWidth ? box.w : box.h * aspect, h = byWidth ? box.w / aspect : box.h;
  return { x: box.x + (box.w - w) / 2, y: box.y + (box.h - h) / 2, w, h };
}
const sameRect = (a, b, tol = 0) => !!a && !!b && near(a.x, b.x, tol) && near(a.y, b.y, tol) && near(a.w, b.w, tol) && near(a.h, b.h, tol);

// ---- Checks ------------------------------------------------------------------------------------

const ctx = {}; // shared between checks: frames, game, ...
const ipcSince = (n, ch) => ipcLog.slice(n).filter((e) => e.ch === 'ror:' + ch);
const now = () => Date.now();

const CHECKS = [
  { name: 'app-load', timeout: 25000, shot: true, async fn() {
    if (mainLoadError) throw new Error(`src/main/main.js threw while loading: ${mainLoadError.stack || mainLoadError}`);
    await waitFor('the app window', () => !!wc, 15000, 50);
    await Promise.race([loaded, sleep(20000).then(() => { throw new Error('did-finish-load not received within 20 s'); })]);
    await waitFor('the sidebar and stage to be built', () => R(() => ({
      ok: document.querySelectorAll('#frames .tile').length > 0 && document.querySelectorAll('#screens .screen').length > 0,
    })), 10000);
    await R(installHelpers);
    ctx.frames = await R(async () => (await import('./frames/frames.js')).FRAMES.map((f) => ({ id: f.id, name: f.name, hole: f.hole, aspect: f.aspect })));
    const st = await R(() => ({
      api: ['listSources', 'detectSteamGame', 'getDisplays', 'moveWindowToDisplay', 'startPlay', 'stopPlay', 'onCursor', 'onPlayState',
        'onHotkey', 'pickFile', 'listScenes', 'loadScene', 'saveScene', 'deleteScene', 'setFullscreen'].filter((k) => typeof window.ror?.[k] !== 'function'),
      stub: !!window.ror?.stub,
      screens: document.querySelectorAll('#screens .screen').length,
      frameTiles: document.querySelectorAll('#frames .tile').length,
      chips: document.querySelectorAll('#aspects .chip').length,
      size: [innerWidth, innerHeight],
    }));
    assert(st.api.length === 0, `window.ror is missing: ${st.api.join(', ')}`);
    assert(!st.stub, 'window.ror is the browser stub (preload did not run)');
    assert(st.screens === 1, `expected 1 screen on first run, got ${st.screens}`);
    assert(st.frameTiles === ctx.frames.length + 1, `expected ${ctx.frames.length + 1} frame tiles, got ${st.frameTiles}`);
    assert(st.chips === 8, `expected 8 aspect chips, got ${st.chips}`);
    assert(rendererErrors.length === 0, `renderer errors during load: ${brief(rendererErrors, 400)}`);
    return `window ${st.size.join('x')}, ${st.frameTiles} frame tiles, ${st.chips} aspect chips, no renderer errors`;
  } },

  { name: 'initial-rect-visible', timeout: 5000, async fn() {
    const r = await R(() => {
      const el = __smoke.screens()[0];
      return { r: __smoke.rectOf(el), vs: __smoke.visibleStage() };
    });
    const { r: s, vs } = r;
    const inside = s.x >= 0 && s.y >= 0 && s.x + s.w <= vs.w + 0.5 && s.y + s.h <= vs.h + 0.5;
    assert(inside, `screen ${fmtRect(s)} is not inside the visible stage 0,0 ${vs.w}x${vs.h} (sidebar starts at x=${vs.w}; ` +
      `overflow right ${(s.x + s.w - vs.w).toFixed(1)} px, bottom ${(s.y + s.h - vs.h).toFixed(1)} px)`);
    return `screen ${fmtRect(s)} inside visible stage ${vs.w}x${vs.h}`;
  } },

  { name: 'steam-autoshow-first-run', win: true, timeout: 20000, async fn() {
    if (!GAME_TITLE) return { skip: 'FAKE_GAME_TITLE not set' };
    const r = await waitFor('the first-run screen to show the Steam game', () => R((title) => {
      const names = [...document.querySelectorAll('#screenList li span')].map((s) => s.textContent);
      return { ok: names.includes(title), names };
    }, GAME_TITLE), 15000, 100);
    return `first-run screen shows "${GAME_TITLE}" (${r.names.length} screen)`;
  } },

  { name: 'list-sources', timeout: 25000, async fn() {
    let calls = 0;
    const r = await waitFor('listSources() to include a screen', async () => {
      calls++;
      return R(async () => {
        const l = await window.ror.listSources();
        const bad = l.filter((s) => !s.id || typeof s.name !== 'string' || !/^(screen|window)$/.test(s.kind) || !/^data:image\//.test(s.thumbnail || ''));
        const screens = l.filter((s) => s.kind === 'screen');
        return { ok: screens.length > 0, n: l.length, screens: screens.map((s) => `${s.id} "${s.name}"`), windows: l.length - screens.length, bad: bad.map((s) => s.id) };
      });
    }, 20000, 100);
    assert(r.bad.length === 0, `malformed sources: ${r.bad.join(', ')}`);
    ctx.sourceCallsNeeded = calls;
    return `${r.n} sources: ${r.screens.join(', ')} + ${r.windows} window(s)` + (calls > 1 ? `; NOTE first ${calls - 1} call(s) returned no screen` : '');
  } },

  { name: 'list-sources-repeatable', timeout: 20000, async fn() {
    const counts = [];
    for (let i = 0; i < 6; i++) counts.push(await R(async () => (await window.ror.listSources()).filter((s) => s.kind === 'screen').length));
    const missing = counts.filter((n) => !n).length;
    assert(missing === 0, `screen source missing in ${missing}/6 consecutive listSources() calls (screens per call: [${counts}])`);
    return `6/6 calls returned a screen ([${counts}])`;
  } },

  { name: 'capture-screen', timeout: 40000, shot: true, async fn() {
    let attempt = 0, name = '', live = null, refreshes = 0;
    while (!live && attempt < 3) {
      attempt++;
      // Like a user: if the Sources grid shows no screen, press Refresh and look again once it has finished.
      const screenTiles = () => R(() => [...document.querySelectorAll('#sources .tile')].filter((t) => t.querySelector('span')?.textContent.startsWith('🖥')).length);
      const deadline = Date.now() + 20000;
      while (!(await screenTiles())) {
        assert(Date.now() < deadline, `no screen tile in Sources after ${refreshes} Refresh click(s)`);
        const k = ipcLog.length;
        refreshes++;
        await R(() => __smoke.click('#srcRefresh'));
        const call = await waitFor('Refresh (listSources) to finish', () => {
          const c = ipcSince(k, 'listSources').find((e) => e.result !== undefined);
          return c ? { hasScreen: Array.isArray(c.raw) && c.raw.some((x) => x.kind === 'screen') } : { ok: false };
        }, 10000, 50);
        if (call.hasScreen) await waitFor('the screen tile to be rendered', () => screenTiles().then((n) => ({ ok: n > 0 })), 2000);
      }
      const t = now();
      name = await R(() => {
        const tile = [...document.querySelectorAll('#sources .tile')].find((x) => x.querySelector('span')?.textContent.startsWith('🖥'));
        tile.click();
        return tile.title;
      });
      try {
        live = await waitFor('the selected screen to go live', () => R((since) => {
          const el = __smoke.sel(), v = el?.querySelector('video');
          const failed = __smoke.toastSince(since, '^Capture (failed|ended)');
          if (failed) return { ok: true, failed: __smoke.lastToast() };
          return { ok: !!v && el.classList.contains('live') && v.videoWidth > 0 && v.readyState >= 2 && !v.paused,
            live: el?.classList.contains('live'), vw: v?.videoWidth, rs: v?.readyState, paused: v?.paused, toast: __smoke.lastToast() };
        }, t), 10000, 50);
        if (live.failed) { ctx.captureNote = `attempt ${attempt}: ${live.failed}`; live = null; }
      } catch (err) {
        if (attempt >= 3) throw err;
        ctx.captureNote = `attempt ${attempt}: ${err.message}`;
      }
    }
    assert(live, `capture never went live after ${attempt} attempts (${ctx.captureNote})`);
    const st = await waitFor('non-uniform pixels in the captured video', () => R(() => {
      const s = __smoke.videoStats(__smoke.sel().querySelector('video'));
      return { ok: !!s && s.lumMax - s.lumMin >= 16 && s.colors >= 3, ...s };
    }), 8000, 100);
    const a = await waitFor('the screen to lock to the source aspect', () => R(() => {
      const r = __smoke.selRect(), v = __smoke.sel().querySelector('video');
      const want = v.videoWidth / v.videoHeight, got = r.w / r.h;
      const name = document.querySelector('#screenList li.on span')?.textContent;
      return { ok: Math.abs(got - want) / want < 0.01, got, want, name, chip: __smoke.chip() };
    }), 3000);
    assert(a.name === name, `screen list shows "${a.name}", expected "${name}"`);
    ctx.videoAspect = a.want;
    return `"${name}" ${st.vw}x${st.vh}, luminance ${st.lumMin}-${st.lumMax}, ${st.colors} colours, rect aspect ${a.got.toFixed(3)}` +
      (refreshes ? `; NOTE Sources grid had no screen until ${refreshes} Refresh click(s)` : '') +
      (attempt > 1 ? `; NOTE needed ${attempt} capture attempts (${ctx.captureNote})` : '');
  } },

  { name: 'click-select', timeout: 10000, async fn() {
    const fp = await R(() => __smoke.freePoint());
    assert(fp, 'no empty stage point to click');
    await click(fp);
    await waitFor('empty-stage click to deselect', () => R(() => ({ ok: !__smoke.sel() && document.getElementById('scrRemove').disabled })), 3000);
    const p = await R(() => __smoke.grabPoint(__smoke.screens()[0]));
    assert(p, 'the screen has no clickable point');
    await click(p);
    await waitFor('clicking the screen to select it', () => R(() => ({ ok: !!__smoke.sel() && !document.getElementById('scrRemove').disabled })), 3000);
    return `click (${fp.x},${fp.y}) deselected, click (${p.x},${p.y}) selected`;
  } },

  { name: 'frames-builtin', timeout: 30000, async fn() {
    const out = [];
    for (const f of ctx.frames) {
      await R((id) => __smoke.click(`#frames .tile[data-id="${id}"]`), f.id);
      const g = await waitFor(`frame ${f.id} to load`, () => R((id) => {
        const el = __smoke.sel(), img = el.querySelector('img.frame');
        return { ok: !img.hidden && img.src.endsWith('/' + id + '.svg') && img.complete && img.naturalWidth > 0,
          src: img.src.split('/').pop(), hidden: img.hidden, nw: img.naturalWidth,
          r: __smoke.rectOf(el), fs: __smoke.rectOf(img), sb: __smoke.bcr(el), fb: __smoke.bcr(img),
          tileOn: document.querySelector(`#frames .tile[data-id="${id}"]`).classList.contains('on') };
      }, f.id), 5000);
      const { r, fs: fr } = g;
      const exp = { x: (-f.hole.x * r.w) / f.hole.w, y: (-f.hole.y * r.h) / f.hole.h, w: r.w / f.hole.w, h: r.h / f.hole.h };
      const laid = { x: g.fb.x - g.sb.x, y: g.fb.y - g.sb.y, w: g.fb.w, h: g.fb.h };
      assert(sameRect(fr, exp, 1), `${f.id}: frame style rect ${fmtRect(fr)} != frameOuterRect ${fmtRect(exp)}`);
      assert(sameRect(laid, exp, 1), `${f.id}: frame laid out at ${fmtRect(laid)} != ${fmtRect(exp)}`);
      assert(Math.abs(r.w / r.h - f.aspect) / f.aspect < 0.01, `${f.id}: screen aspect ${(r.w / r.h).toFixed(3)} did not snap to the opening ${f.aspect.toFixed(3)}`);
      assert(g.tileOn, `${f.id}: frame tile not highlighted`);
      out.push(`${f.id} ${g.nw}px`);
      await shot('frame-' + f.id);
    }
    await R(() => __smoke.click('#frames .tile[data-id=""]'));
    await waitFor('frame None to remove the frame', () => R(() => ({ ok: __smoke.sel().querySelector('img.frame').hidden })), 3000);
    return `all ${out.length} loaded and aligned within 1px: ${out.join(', ')}`;
  } },

  { name: 'drag-move', timeout: 10000, async fn() {
    const s = await R(() => ({ r: __smoke.selRect(), p: __smoke.grabPoint(__smoke.sel()) }));
    assert(s.p, 'no grab point on the selected screen');
    const d = { x: -70, y: -40 };
    await drag(s.p, { x: s.p.x + d.x, y: s.p.y + d.y });
    const exp = { ...s.r, x: s.r.x + d.x, y: s.r.y + d.y };
    const g = await waitFor('the screen to move', () => R(() => __smoke.selRect()).then((r) => ({ ok: sameRect(r, exp, 0.5), r })), 3000);
    return `${fmtRect(s.r)} -> ${fmtRect(g.r)}`;
  } },

  { name: 'resize-aspect-lock', timeout: 10000, shot: true, async fn() {
    const s = await R(() => ({ r: __smoke.selRect(), chip: __smoke.chip(), hp: ['se', 'sw', 'ne', 'nw'].map((h) => __smoke.handlePoint(__smoke.sel(), h)) }));
    assert(s.chip === 'source', `expected aspect "source", got ${s.chip}`);
    const hp = s.hp.find((p) => p && p.hit);
    assert(hp, `no corner handle is clickable (${brief(s.hp)})`);
    const a = ctx.videoAspect || 16 / 9;
    const sx = hp.h.includes('e') ? 1 : -1, sy = hp.h.includes('s') ? 1 : -1;
    await drag(hp, { x: hp.x + 90 * sx, y: hp.y + 30 * sy });
    const g = await waitFor('the screen to resize', () => R(() => __smoke.selRect()).then((r) => ({ ok: Math.abs(r.w - s.r.w) > 20, r })), 3000);
    const r = g.r, ratio = r.w / r.h;
    assert(Math.abs(ratio - a) / a < 0.01, `ratio ${ratio.toFixed(4)} drifted from locked ${a.toFixed(4)} (${fmtRect(s.r)} -> ${fmtRect(r)})`);
    assert(near(r.w, s.r.w + 90, 1), `width ${r.w.toFixed(1)}, expected ${(s.r.w + 90).toFixed(1)}`);
    const ax = sx > 0 ? [r.x, s.r.x] : [r.x + r.w, s.r.x + s.r.w], ay = sy > 0 ? [r.y, s.r.y] : [r.y + r.h, s.r.y + s.r.h];
    assert(near(ax[0], ax[1], 1) && near(ay[0], ay[1], 1), `opposite corner moved (${fmtRect(s.r)} -> ${fmtRect(r)})`);
    ctx.handle = hp.h;
    return `handle ${hp.h}: ${fmtRect(s.r)} -> ${fmtRect(r)}, ratio ${ratio.toFixed(4)} vs ${a.toFixed(4)}`;
  } },

  { name: 'resize-shift-free', timeout: 10000, async fn() {
    // Any corner the mouse can reach (the previous resize may have pushed one under the sidebar).
    const order = [...new Set([ctx.handle || 'se', 'se', 'sw', 'ne', 'nw'])];
    const s0 = await R((order) => ({ r: __smoke.selRect(), hps: order.map((h) => __smoke.handlePoint(__smoke.sel(), h)) }), order);
    const s = { r: s0.r, hp: s0.hps.find((p) => p && p.hit) };
    assert(s.hp, `no corner handle is clickable (${brief(s0.hps)})`);
    const h = s.hp.h;
    const sx = h.includes('e') ? 1 : -1, sy = h.includes('s') ? 1 : -1;
    await drag(s.hp, { x: s.hp.x + 60 * sx, y: s.hp.y - 50 * sy }, { modifiers: ['shift'] });
    const exp = { w: s.r.w + 60, h: s.r.h - 50 };
    const g = await waitFor('a free (Shift) resize', () => R(() => __smoke.selRect()).then((r) => ({ ok: near(r.w, exp.w, 1) && near(r.h, exp.h, 1), r })), 3000);
    const a = ctx.videoAspect || 16 / 9, ratio = g.r.w / g.r.h;
    assert(Math.abs(ratio - a) / a > 0.05, `ratio ${ratio.toFixed(3)} still locked to ${a.toFixed(3)} with Shift held`);
    return `handle ${h}+Shift: ${fmtRect(s.r)} -> ${fmtRect(g.r)} (ratio ${ratio.toFixed(3)}, unlocked)`;
  } },

  { name: 'keyboard-nudge-scale', timeout: 15000, shot: true, async fn() {
    const p = await R(() => __smoke.grabPoint(__smoke.sel()));
    assert(p, 'no grab point');
    await click(p); // selects + blurs any focused control so keys reach the stage
    await waitFor('focus on the stage', () => R(() => ({ ok: !!__smoke.sel() && !document.activeElement?.closest?.('input, select, textarea, dialog'), active: document.activeElement?.tagName })), 2000);
    const steps = [
      ['Right', [], (r) => ({ ...r, x: r.x + 1 })],
      ['Right', ['shift'], (r) => ({ ...r, x: r.x + 10 })],
      ['Left', [], (r) => ({ ...r, x: r.x - 1 })],
      ['Down', [], (r) => ({ ...r, y: r.y + 1 })],
      ['Up', ['shift'], (r) => ({ ...r, y: r.y - 10 })],
      ['Plus', [], (r) => ({ x: r.x - (r.w * 0.05) / 2, y: r.y - (r.h * 0.05) / 2, w: r.w * 1.05, h: r.h * 1.05 })],
      ['-', [], (r) => ({ x: r.x + (r.w * 0.05) / 2, y: r.y + (r.h * 0.05) / 2, w: r.w * 0.95, h: r.h * 0.95 })],
    ];
    const done = [];
    for (const [k, mods, f] of steps) {
      const r0 = await R(() => __smoke.selRect());
      const exp = f(r0);
      key(k, mods);
      const label = [...mods, k].join('+');
      await waitFor(`${label} to change the rect to ${fmtRect(exp)}`, () => R(() => __smoke.selRect()).then((r) => ({ ok: sameRect(r, exp, 0.05), r })), 2000);
      done.push(label);
    }
    return `${done.join(', ')} all moved/scaled the rect exactly`;
  } },

  { name: 'aspect-presets', timeout: 15000, async fn() {
    const parse = (a) => { const [w, h] = a.split(':').map(Number); return w / h; };
    for (const a of ['16:9', '4:3', '21:9', '32:9', '1:1', '3:2']) {
      const r0 = await R(() => __smoke.selRect());
      await R((a) => __smoke.click(`#aspects .chip[data-a="${a}"]`), a);
      const want = parse(a);
      await waitFor(`aspect ${a}`, () => R(() => ({ r: __smoke.selRect(), chip: __smoke.chip() })).then(({ r, chip }) => ({
        ok: chip === a && Math.abs(r.w / r.h - want) / want < 0.01 && near(r.w, r0.w, 0.5) && near(r.y + r.h / 2, r0.y + r0.h / 2, 0.5), chip, r,
      })), 2000);
    }
    const r1 = await R(() => __smoke.selRect());
    await R(() => __smoke.click('#aspects .chip[data-a="free"]'));
    await waitFor('aspect free', () => R(() => ({ r: __smoke.selRect(), chip: __smoke.chip() })).then(({ r, chip }) => ({ ok: chip === 'free' && sameRect(r, r1, 0.01), chip, r })), 2000);
    await R(() => __smoke.click('#aspects .chip[data-a="source"]'));
    const a = ctx.videoAspect || 16 / 9;
    await waitFor('aspect source', () => R(() => ({ r: __smoke.selRect(), chip: __smoke.chip() })).then(({ r, chip }) => ({ ok: chip === 'source' && Math.abs(r.w / r.h - a) / a < 0.01, chip, r })), 2000);
    return '16:9 4:3 21:9 32:9 1:1 3:2 applied (width kept, centred); free kept rect; source restored ' + a.toFixed(3);
  } },

  { name: 'aspect-custom', timeout: 10000, async fn() {
    await typeInto('#aspectCustom', '5:4');
    await R(() => __smoke.click('#aspectApply'));
    const g = await waitFor('custom aspect 5:4', () => R(() => ({ r: __smoke.selRect(), chip: __smoke.chip(), v: document.getElementById('aspectCustom').value }))
      .then((s) => ({ ok: !s.chip && Math.abs(s.r.w / s.r.h - 1.25) < 0.0125, ...s })), 2000);
    const t = await R(() => Date.now());
    await typeInto('#aspectCustom', 'abc');
    await R(() => __smoke.click('#aspectApply'));
    await waitFor('the invalid-aspect toast', () => R((t) => ({ ok: __smoke.toastSince(t, 'Enter an aspect'), toast: __smoke.lastToast() }), t), 2000);
    const r2 = await R(() => __smoke.selRect());
    assert(sameRect(r2, g.r, 0.01), `invalid aspect changed the rect ${fmtRect(g.r)} -> ${fmtRect(r2)}`);
    await R(() => { document.activeElement?.blur(); return true; });
    return `5:4 -> ${fmtRect(g.r)} (ratio ${(g.r.w / g.r.h).toFixed(4)}); "abc" rejected with toast, rect unchanged`;
  } },

  { name: 'fit-modes', timeout: 10000, async fn() {
    for (const [mode, css] of [['cover', 'cover'], ['stretch', 'fill'], ['contain', 'contain']]) {
      await R((m) => __smoke.setValue('#fit', m, 'change'), mode);
      await waitFor(`fit ${mode}`, () => R(() => {
        const el = __smoke.sel();
        return { v: el.querySelector('video').style.objectFit, c: el.querySelector('canvas').style.objectFit };
      }).then((s) => ({ ok: s.v === css && s.c === css, ...s })), 2000);
    }
    const p = await R(() => __smoke.grabPoint(__smoke.sel()));
    await dblclick(p);
    await waitFor('double-click to toggle fit to cover', () => R(() => ({ ok: document.getElementById('fit').value === 'cover' && __smoke.sel().querySelector('video').style.objectFit === 'cover', fit: document.getElementById('fit').value })), 2000);
    await dblclick(p);
    await waitFor('double-click to toggle fit back to contain', () => R(() => ({ ok: document.getElementById('fit').value === 'contain', fit: document.getElementById('fit').value })), 2000);
    return 'cover/stretch(fill)/contain applied to video+canvas; double-click toggled contain->cover->contain';
  } },

  { name: 'bg-color', timeout: 10000, shot: true, async fn() {
    await R(() => __smoke.setValue('#bgType', 'color', 'change'));
    await R((c) => __smoke.setValue('#bgColor', c, 'input'), hex(BG_COLOR));
    await waitFor('#bg background colour', () => R(() => ({ c: document.getElementById('bg').style.backgroundColor })).then((s) => ({ ok: s.c === 'rgb(18, 52, 86)', ...s })), 2000);
    const fp = await R(() => __smoke.freePoint());
    assert(fp, 'no free stage point to sample');
    const px = await waitFor('the rendered background colour', async () => { const c = await pixelAt(fp.x, fp.y); return { ok: colorNear(c, BG_COLOR, 6), c }; }, 3000, 50);
    return `rendered ${hex(px.c)} at (${fp.x},${fp.y})`;
  } },

  { name: 'bg-image-png', timeout: 15000, shot: true, async fn() {
    const file = fixture('bg.png', encodePng(64, 48, () => [...BG_PNG_COLOR, 255]));
    const url = pathToFileURL(file).href, n = ipcLog.length;
    pickQueue.push(file);
    await R(() => __smoke.click('#bgImage'));
    await waitFor('pickFile("image")', () => ({ ok: ipcSince(n, 'pickFile').some((e) => e.raw === url && e.args.includes('image')) }), 3000);
    const st = await waitFor('the image background', () => R(() => ({ img: document.getElementById('bg').style.backgroundImage, type: document.getElementById('bgType').value }))
      .then((s) => ({ ok: s.img.includes('bg.png') && s.type === 'image', ...s })), 3000);
    const im = await R((u) => new Promise((res) => { const i = new Image(); i.onload = () => res({ w: i.naturalWidth, h: i.naturalHeight }); i.onerror = () => res({ error: true }); i.src = u; }), url);
    assert(im.w === 64 && im.h === 48, `fixture did not load in the page: ${brief(im)}`);
    const fp = await R(() => __smoke.freePoint());
    const px = await waitFor('the PNG to render', async () => { const c = await pixelAt(fp.x, fp.y); return { ok: colorNear(c, BG_PNG_COLOR, 8), c }; }, 5000, 50);
    return `background-image ${st.img.slice(0, 60)}…, rendered ${hex(px.c)}`;
  } },

  { name: 'bg-gif', timeout: 15000, async fn() {
    const file = fixture('anim.gif', Buffer.from(ANIM_GIF_B64, 'base64'));
    const url = pathToFileURL(file).href;
    pickQueue.push(file);
    await R(() => __smoke.click('#bgImage'));
    await waitFor('the GIF background', () => R(() => ({ img: document.getElementById('bg').style.backgroundImage })).then((s) => ({ ok: s.img.includes('anim.gif'), ...s })), 3000);
    const im = await R((u) => new Promise((res) => { const i = new Image(); i.onload = () => res({ w: i.naturalWidth }); i.onerror = () => res({ error: true }); i.src = u; }), url);
    assert(im.w === 16, `GIF did not load: ${brief(im)}`);
    const fp = await R(() => __smoke.freePoint());
    const seen = new Set();
    await waitFor('both GIF frames to be displayed (animation)', async () => {
      const c = await pixelAt(fp.x, fp.y);
      GIF_COLORS.forEach((g, i) => { if (colorNear(c, g, 12)) seen.add(i); });
      return { ok: seen.size === 2, seen: [...seen], last: hex(c) };
    }, 6000, 40);
    await shot('bg-gif');
    return `rendered and animating (saw ${GIF_COLORS.map(hex).join(' and ')})`;
  } },

  { name: 'bg-video-webm', timeout: 30000, shot: true, async fn() {
    const rec = await R(async (color) => {
      const c = Object.assign(document.createElement('canvas'), { width: 160, height: 90 });
      const g = c.getContext('2d');
      const mimeType = ['video/webm;codecs=vp8', 'video/webm;codecs=vp9', 'video/webm'].find((t) => MediaRecorder.isTypeSupported(t));
      if (!mimeType) return { error: 'MediaRecorder supports no WebM type' };
      const stream = c.captureStream(30), chunks = [];
      const recorder = new MediaRecorder(stream, { mimeType, videoBitsPerSecond: 2e6 });
      recorder.ondataavailable = (e) => { if (e.data.size) chunks.push(e.data); };
      let n = 0;
      const draw = () => { g.fillStyle = color; g.fillRect(0, 0, 160, 90); g.fillStyle = n++ % 2 ? '#000' : '#fff'; g.fillRect(0, 0, 4, 4); };
      draw();
      const timer = setInterval(draw, 33);
      const stopped = new Promise((res) => { recorder.onstop = res; });
      recorder.start(100);
      await new Promise((r) => setTimeout(r, 1500)); // fixture length, not a wait for app state
      recorder.stop();
      await stopped;
      clearInterval(timer);
      stream.getTracks().forEach((t) => t.stop());
      const buf = new Uint8Array(await new Blob(chunks, { type: 'video/webm' }).arrayBuffer());
      let s = '';
      for (let i = 0; i < buf.length; i += 0x8000) s += String.fromCharCode.apply(null, buf.subarray(i, i + 0x8000));
      return { mimeType, bytes: buf.length, frames: n, b64: btoa(s) };
    }, hex(VIDEO_COLOR));
    assert(!rec.error && rec.bytes > 1000, `could not record a WebM fixture: ${brief({ ...rec, b64: undefined })}`);
    const file = fixture('bg.webm', Buffer.from(rec.b64, 'base64'));
    const n = ipcLog.length;
    const t = await R(() => Date.now());
    pickQueue.push(file);
    await R(() => __smoke.click('#bgVideo'));
    await waitFor('pickFile("video")', () => ({ ok: ipcSince(n, 'pickFile').some((e) => e.args.includes('video') && String(e.raw).endsWith('bg.webm')) }), 3000);
    const v1 = await waitFor('the background video to load and play', () => R((t) => {
      const v = document.querySelector('#bg video');
      if (__smoke.toastSince(t, 'Could not play background video')) return { ok: true, error: __smoke.lastToast() };
      return { ok: !!v && v.src.endsWith('bg.webm') && v.readyState >= 2 && v.videoWidth === 160 && !v.paused && v.currentTime > 0,
        rs: v?.readyState, vw: v?.videoWidth, paused: v?.paused, t: v?.currentTime, err: v?.error?.message, type: document.getElementById('bgType').value };
    }, t), 8000, 50);
    assert(!v1.error, v1.error);
    assert(v1.type === 'video', `bgType shows ${v1.type}`);
    // Actually playing: currentTime keeps advancing (>= 0.3 s of playback), or wraps around via loop.
    let maxT = v1.t, wrapped = false;
    const v2 = await waitFor('currentTime to advance by 0.3 s', () => R(() => {
      const v = document.querySelector('#bg video');
      return { t: v.currentTime, paused: v.paused, ended: v.ended, d: v.duration };
    }).then((s) => {
      if (s.t < maxT - 0.2) wrapped = true;
      maxT = Math.max(maxT, s.t);
      return { ok: !s.paused && (s.t >= v1.t + 0.3 || wrapped), ...s };
    }), 4000, 50);
    const fp = await R(() => __smoke.freePoint());
    const px = await waitFor('video pixels on the stage', async () => { const c = await pixelAt(fp.x, fp.y); return { ok: colorNear(c, VIDEO_COLOR, 48), c }; }, 3000, 50);
    // Informational: does loop=true restart it? (MediaRecorder files have no duration, so this is not a pass criterion.)
    await waitFor('loop', () => R(() => document.querySelector('#bg video').currentTime).then((t) => { if (t < maxT - 0.2) wrapped = true; maxT = Math.max(maxT, t); return { ok: wrapped }; }), 2500, 50).catch(() => {});
    return `${rec.mimeType} ${rec.bytes} B, ${rec.frames} frames; playing (t ${v1.t.toFixed(2)}s -> ${v2.t.toFixed(2)}s, ` +
      `looped: ${wrapped ? 'yes' : 'not seen'}), rendered ${hex(px.c)} (want ~${hex(VIDEO_COLOR)})`;
  }, after: async () => { // stop the video, back to a plain colour for later steps
    await R(() => __smoke.setValue('#bgType', 'color', 'change')).catch(() => {});
  } },

  { name: 'custom-frame-hole', timeout: 15000, shot: true, async fn() {
    const W = 200, H = 200, hx0 = 25, hy0 = 50, hx1 = 25 + 150, hy1 = 50 + 90;
    const file = fixture('frame-hole.png', encodePng(W, H, (x, y) => (x >= hx0 && x < hx1 && y >= hy0 && y < hy1 ? [0, 0, 0, 0] : [128, 64, 192, 255])));
    const url = pathToFileURL(file).href;
    // Independent probe: can this page read pixels of a file:// image at all (canvas taint)?
    const probe = await R((u) => new Promise((res) => {
      const i = new Image();
      i.onload = () => {
        const c = document.createElement('canvas'); c.width = i.naturalWidth; c.height = i.naturalHeight;
        const g = c.getContext('2d'); g.drawImage(i, 0, 0);
        try { const d = g.getImageData(100, 100, 1, 1).data; res({ tainted: false, centreAlpha: d[3] }); } catch (e) { res({ tainted: true, error: String(e.name || e) }); }
      };
      i.onerror = () => res({ loadError: true });
      i.src = u;
    }), url);
    const n = ipcLog.length;
    pickQueue.push(file);
    await R(() => __smoke.click('#frameCustom'));
    const g = await waitFor('the custom frame or the manual-insets fallback', () => R((u) => {
      const dlg = document.getElementById('insets');
      if (dlg.open) return { ok: true, fallback: true };
      const el = __smoke.sel(), img = el.querySelector('img.frame');
      return { ok: !img.hidden && img.src === u && img.complete && img.naturalWidth === 200, src: img.src, r: __smoke.rectOf(el), f: __smoke.rectOf(img),
        anyTileOn: !!document.querySelector('#frames .tile.on') };
    }, url), 6000, 50);
    if (g.fallback) {
      await R(() => { document.querySelector('#insets button[value=cancel]').click(); return true; });
      throw new Error(`hole NOT auto-detected: app fell back to the manual insets dialog (pixel probe: ${brief(probe)})`);
    }
    assert(ipcSince(n, 'pickFile').some((e) => e.args.includes('frame')), 'pickFile("frame") was not called');
    const hole = { x: -g.f.x / g.f.w, y: -g.f.y / g.f.h, w: g.r.w / g.f.w, h: g.r.h / g.f.h };
    const ok = ['x', 'y', 'w', 'h'].every((k) => near(hole[k], CUSTOM_HOLE[k], 0.006));
    assert(ok, `detected hole ${brief(hole)} != expected ${brief(CUSTOM_HOLE)} (probe ${brief(probe)})`);
    const want = (CUSTOM_HOLE.w * W) / (CUSTOM_HOLE.h * H), got = g.r.w / g.r.h;
    assert(Math.abs(got - want) / want < 0.01, `screen aspect ${got.toFixed(3)} did not snap to the opening ${want.toFixed(3)}`);
    assert(!g.anyTileOn, 'a built-in frame tile is still highlighted');
    return `findHole path: hole ${['x', 'y', 'w', 'h'].map((k) => hole[k].toFixed(3)).join('/')} (want ${['x', 'y', 'w', 'h'].map((k) => CUSTOM_HOLE[k].toFixed(3)).join('/')}), aspect ${got.toFixed(3)}; canvas probe ${brief(probe)}`;
  } },

  { name: 'screens-add-remove', timeout: 15000, shot: true, async fn() {
    const n0 = await R(() => { const l = __smoke.screens(); l.forEach((e) => { e.dataset.smokeOrig = '1'; }); return l.length; });
    const count = () => R(() => ({ dom: __smoke.screens().length, list: document.querySelectorAll('#screenList li').length,
      selNew: !!__smoke.sel() && !__smoke.sel().dataset.smokeOrig, selRect: __smoke.selRect(), vs: __smoke.visibleStage() }));
    await R(() => __smoke.click('#scrAdd'));
    const a1 = await waitFor('Add to create a screen', () => count().then((c) => ({ ok: c.dom === n0 + 1 && c.list === n0 + 1 && c.selNew, ...c })), 3000);
    const r = a1.selRect, vs = a1.vs;
    assert(r.x >= 0 && r.y >= 0 && r.x + r.w <= vs.w + 0.5 && r.y + r.h <= vs.h + 0.5, `new screen ${fmtRect(r)} is outside the visible stage ${vs.w}x${vs.h}`);
    await R(() => __smoke.click('#scrAdd'));
    await waitFor('a second Add', () => count().then((c) => ({ ok: c.dom === n0 + 2 && c.list === n0 + 2 && c.selNew, ...c })), 3000);
    await shot('screens-added');
    await R(() => __smoke.click('#scrRemove'));
    await waitFor('Remove to delete the selected screen', () => count().then((c) => ({ ok: c.dom === n0 + 1 && c.list === n0 + 1 && c.selNew, ...c })), 3000);
    const p = await R(() => __smoke.grabPoint(__smoke.sel()));
    assert(p, 'remaining new screen has no clickable point');
    await click(p);
    key('Delete');
    const c = await waitFor('the Delete key to remove the selected screen', () => R(() => ({ n: __smoke.screens().length, orig: __smoke.screens().every((e) => e.dataset.smokeOrig) }))
      .then((s) => ({ ok: s.n === n0 && s.orig, ...s })), 3000);
    return `${n0} -> +2 (Add x2, new one selected, inside stage) -> Remove -> Delete key -> ${c.n}, originals intact`;
  } },

  { name: 'scenes-roundtrip', timeout: 20000, async fn() {
    const name = 'smoke scene';
    const scenesFile = path.join(USER_DATA, 'scenes.json');
    const before = await R(() => ({ n: __smoke.screens().length, r: __smoke.selRect(), bg: document.getElementById('bg').style.backgroundColor }));
    const t = await R(() => Date.now());
    assert(await R(() => __smoke.openSection('Scenes')), 'could not expand the Scenes section');
    await typeInto('#sceneName', name);
    await R(() => __smoke.click('#sceneSave'));
    await waitFor('the scene to appear in the list', () => R((n, t) => ({ ok: [...document.querySelectorAll('#scenes option')].some((o) => o.value === n) &&
      document.getElementById('scenes').value === n && __smoke.toastSince(t, '^Saved'), toast: __smoke.lastToast() }), name, t), 3000);
    const saved = JSON.parse(fs.readFileSync(scenesFile, 'utf8'))[name];
    assert(saved && Array.isArray(saved.screens) && saved.screens.length === before.n, `scenes.json entry wrong: ${brief(saved, 300)}`);
    const ss = saved.screens.find((s) => s.id === saved.selectedId);
    assert(ss && sameRect(ss.rect, before.r, 0.01), `saved selected rect ${brief(ss && ss.rect)} != on-screen ${fmtRect(before.r)}`);
    // Change the scene, then load the saved one back.
    await R(() => __smoke.click('#scrAdd'));
    await R(() => __smoke.setValue('#bgColor', '#654321', 'input'));
    await waitFor('the scene to change', () => R(() => __smoke.screens().length).then((k) => ({ ok: k === before.n + 1, k })), 3000);
    const t2 = await R(() => Date.now());
    await R((n) => { document.getElementById('scenes').value = n; return __smoke.click('#sceneLoad'); }, name);
    const l = await waitFor('Load to restore the scene', () => R((t) => ({ n: __smoke.screens().length, r: __smoke.selRect(), bg: document.getElementById('bg').style.backgroundColor, loaded: __smoke.toastSince(t, '^Loaded') }), t2)
      .then((s) => ({ ok: s.n === before.n && sameRect(s.r, before.r, 0.01) && s.bg === before.bg && s.loaded, ...s })), 3000);
    await R(() => __smoke.click('#sceneDelete'));
    await waitFor('Delete to remove the scene', () => R((n) => ({ ok: ![...document.querySelectorAll('#scenes option')].some((o) => o.value === n) })), 3000);
    const disk = JSON.parse(fs.readFileSync(scenesFile, 'utf8'));
    assert(!(name in disk), 'scene still in scenes.json after Delete');
    const api = await R(async (n) => ({ load: await window.ror.loadScene(n), list: await window.ror.listScenes() }), name);
    assert(api.load === null && !api.list.includes(name), `after delete: loadScene=${brief(api.load)}, listScenes=${brief(api.list)}`);
    return `saved "${name}" (${saved.screens.length} screen, rect ${fmtRect(ss.rect)}), changed, loaded back (${l.n} screen, bg ${l.bg}), deleted from list + scenes.json`;
  } },

  // ---- Windows only ----

  { name: 'win-steam-detect', win: true, timeout: 25000, async fn() {
    if (!GAME_TITLE) return { skip: 'FAKE_GAME_TITLE not set (CI starts the fake game)' };
    const g = await waitFor('detectSteamGame() to return the fake game', () => R(async () => {
      const x = await window.ror.detectSteamGame();
      return x ? { ...x, thumbnail: undefined } : { ok: false, got: x };
    }), 20000, 300);
    assert(g.name === GAME_TITLE, `detected "${g.name}", expected "${GAME_TITLE}"`);
    assert(g.isSteamGame === true, 'isSteamGame is not true');
    assert(g.kind === 'window' && /^-?\d+$/.test(String(g.hwnd)) && Number(g.hwnd) !== 0, `bad kind/hwnd: ${g.kind} ${g.hwnd}`);
    assert(/\\steamapps\\common\\/i.test(g.exePath || ''), `exePath "${g.exePath}" lacks \\steamapps\\common\\`);
    const wr = win().windowRect(g.hwnd);
    assert(wr && wr.w > 0, `GetWindowRect(${g.hwnd}) failed`);
    ctx.game = g;
    return `"${g.name}" hwnd ${g.hwnd}, ${g.exePath}, window ${fmtRect(wr)}`;
  } },

  { name: 'win-game-capture', win: true, timeout: 25000, shot: true, async fn() {
    if (!ctx.game) return { skip: 'no game detected' };
    // Start from a plain screen: no frame, aspect locked to the source.
    await R(() => { __smoke.click('#frames .tile[data-id=""]'); __smoke.click('#aspects .chip[data-a="source"]'); __smoke.setValue('#fit', 'contain', 'change'); return true; });
    const t = await R(() => Date.now());
    await R(() => __smoke.click('#srcSteam'));
    await waitFor('the selected screen to show the game', () => R((title, t) => ({
      ok: document.querySelector('#screenList li.on span')?.textContent === title && __smoke.toastSince(t, '^Showing'),
      name: document.querySelector('#screenList li.on span')?.textContent, toast: __smoke.lastToast(),
    }), GAME_TITLE, t), 5000);
    const st = await waitFor('the game colour #ff00ff in the capture', () => R((c) => {
      const el = __smoke.sel(), v = el.querySelector('video');
      const s = el.classList.contains('live') ? __smoke.videoStats(v, c, 320) : null;
      return { ok: !!s && s.centre.every((x, i) => Math.abs(x - c[i]) <= 30), live: el.classList.contains('live'), ...s };
    }, GAME_COLOR), 15000, 100);
    const a = await waitFor('the screen to lock to the game window aspect', () => R(() => __smoke.selRect()).then((r) => ({ ok: Math.abs(r.w / r.h - st.vw / st.vh) / (st.vw / st.vh) < 0.01, r })), 3000);
    ctx.gameBox = st.box;
    ctx.gameVideo = { vw: st.vw, vh: st.vh };
    return `video ${st.vw}x${st.vh}, centre ${hex(st.centre)}, magenta (client) area ${brief(st.box)} of the frame, screen ${fmtRect(a.r)}`;
  } },

  { name: 'win-move-window', win: true, timeout: 20000, async fn() {
    if (!ctx.game) return { skip: 'no game detected' };
    const h = ctx.game.hwnd, w = win();
    const r0 = w.windowRect(h);
    assert(w.moveTo(h, 140, 110), 'own SetWindowPos failed');
    await waitFor('the game window at 140,110', () => { const r = w.windowRect(h); return { ok: r.x === 140 && r.y === 110, r }; }, 3000);
    const ds = await R(() => window.ror.getDisplays());
    const primary = ds.find((d) => d.primary);
    assert(primary, `no primary display in ${brief(ds)}`);
    const exp = screen.dipToScreenPoint({ x: primary.bounds.x, y: primary.bounds.y });
    const n = ipcLog.length, t = await R(() => Date.now());
    assert(await R(() => __smoke.openSection('Displays')), 'could not expand the Displays section');
    await R(() => __smoke.click('#dispRefresh'));
    await waitFor('the primary display in the Displays list', () => R((id) => ({ ok: [...document.querySelectorAll('#displays option')].some((o) => o.value === id) }), primary.id), 3000);
    await R((id) => { document.getElementById('displays').value = id; return __smoke.click('#dispMove'); }, primary.id);
    const call = await waitFor('moveWindowToDisplay to be called', () => {
      const c = ipcSince(n, 'moveWindowToDisplay')[0];
      return c && c.ms >= 0 && c.result !== undefined ? c : { ok: false };
    }, 3000);
    assert(call.result === true, `moveWindowToDisplay(${call.args}) returned ${call.result}`);
    const r = await waitFor(`the game window at the primary display origin ${exp.x},${exp.y}`, () => {
      const r = w.windowRect(h); return { ok: r.x === exp.x && r.y === exp.y && r.w === r0.w && r.h === r0.h, r };
    }, 3000);
    await waitFor('the "Window moved." toast', () => R((t) => ({ ok: __smoke.toastSince(t, '^Window moved'), toast: __smoke.lastToast() }), t), 2000);
    return `moveWindowToDisplay${call.args} -> true; window 140,110 -> ${r.r.x},${r.r.y} (${r.r.w}x${r.r.h})`;
  } },

  { name: 'win-play-start', win: true, timeout: 20000, shot: true, async fn() {
    if (!ctx.game) return { skip: 'no game detected' };
    const h = ctx.game.hwnd, w = win(), n = ipcLog.length;
    await R(() => __smoke.click('#play'));
    const call = await waitFor('startPlay to return', () => { const c = ipcSince(n, 'startPlay')[0]; return c && c.result !== undefined ? c : { ok: false }; }, 5000);
    assert(call.result === true, `startPlay(${call.args}) returned ${call.result}`);
    assert(String(call.args).includes(String(h)), `startPlay called with ${call.args}, expected hwnd ${h}`);
    await waitFor('body.playing', () => R(() => ({ ok: document.body.classList.contains('playing') })), 3000);
    const s = await waitFor('ClipCursor = game client rect and always-on-top', () => {
      const cr = w.clientRect(h), clip = w.clip(), top = appWin.isAlwaysOnTop();
      return { ok: sameRect(clip, cr) && top, clip, client: cr, top, fg: w.foreground() === String(h) };
    }, 5000, 50);
    ctx.playing = true;
    return `startPlay -> true; clip ${fmtRect(s.clip)} == client rect; alwaysOnTop; game foreground: ${s.fg}`;
  } },

  { name: 'win-play-cursor', win: true, timeout: 10000, async fn() {
    if (!ctx.playing) return { skip: 'play mode not active' };
    const h = ctx.game.hwnd, w = win(), cr = w.clientRect(h);
    await R(() => { __smoke.cursor.length = 0; return true; });
    const cx = cr.x + Math.floor(cr.w / 2), cy = cr.y + Math.floor(cr.h / 2);
    assert(w.setCursor(cx, cy), 'SetCursorPos failed');
    const c = await waitFor('onCursor near (0.5, 0.5) inside', () => R(() => __smoke.cursor.slice(-1)[0] || null)
      .then((c) => ({ ok: !!c && Math.abs(c.u - 0.5) <= 0.02 && Math.abs(c.v - 0.5) <= 0.02 && c.inside === true, ...c })), 3000, 30);
    const d = await waitFor('the drawn cursor', () => R(() => {
      const el = document.getElementById('cursor'), m = /translate\(([-\d.]+)px,\s*([-\d.]+)px\)/.exec(el.style.transform);
      return { ok: !el.hidden && !!m, x: m && +m[1], y: m && +m[2], r: __smoke.rectOf(document.querySelector('#screens .screen.sel') || __smoke.screens()[0]) };
    }), 2000);
    ctx.drawn = d;
    const inside = d.x >= d.r.x && d.x <= d.r.x + d.r.w && d.y >= d.r.y && d.y <= d.r.y + d.r.h;
    assert(inside, `drawn cursor ${d.x},${d.y} outside the screen ${fmtRect(d.r)}`);
    return `SetCursorPos(${cx},${cy}) -> onCursor u=${c.u.toFixed(3)} v=${c.v.toFixed(3)} inside; drawn at ${d.x.toFixed(1)},${d.y.toFixed(1)} in ${fmtRect(d.r)}`;
  } },

  { name: 'win-play-cursor-alignment', win: true, timeout: 5000, async fn() {
    if (!ctx.drawn || !ctx.gameBox) return { skip: 'needs win-play-cursor and win-game-capture' };
    // Where the game's client-area centre appears in the captured picture (the magenta box), mapped to the stage.
    const b = ctx.gameBox, { vw, vh } = ctx.gameVideo;
    const fit = await R(() => document.getElementById('fit').value);
    const vr = fitRect(vw / vh, ctx.drawn.r, fit); // where the captured picture is drawn
    // The cursor sits at the client-area centre; in the picture that is the centre of the magenta box.
    const exp = { x: vr.x + (b.x + b.w / 2) * vr.w, y: vr.y + (b.y + b.h / 2) * vr.h };
    const dx = ctx.drawn.x - exp.x, dy = ctx.drawn.y - exp.y;
    const tol = { x: Math.max(3, vr.w * 0.015), y: Math.max(3, vr.h * 0.015) };
    assert(Math.abs(dx) <= tol.x && Math.abs(dy) <= tol.y,
      `drawn cursor ${ctx.drawn.x.toFixed(1)},${ctx.drawn.y.toFixed(1)} is ${dx.toFixed(1)},${dy.toFixed(1)} px off where the game's cursor appears ` +
      `in the picture (${exp.x.toFixed(1)},${exp.y.toFixed(1)}); the client area is only ${brief(b)} of the captured ${vw}x${vh} frame ` +
      `(title bar/borders), but (u,v) is mapped onto the whole frame`);
    return `drawn cursor within ${dx.toFixed(1)},${dy.toFixed(1)} px of the client centre in the picture (fit ${fit})`;
  } },

  { name: 'win-hotkey-stop', win: true, timeout: 10000, async fn() {
    if (!ctx.playing) return { skip: 'play mode not active' };
    const n = ipcLog.length;
    await R(() => { __smoke.hotkeys.length = 0; __smoke.playStates.length = 0; return true; });
    win().chord([0x11, 0x12, 0x50]); // Ctrl, Alt, P
    const s = await waitFor('Ctrl+Alt+P to stop play mode', () => R(() => ({ playing: document.body.classList.contains('playing'), hotkeys: __smoke.hotkeys.map((h) => h.name), states: __smoke.playStates.map((p) => p.playing) }))
      .then((s) => ({ ok: !s.playing && !appWin.isAlwaysOnTop(), ...s })), 5000, 50);
    ctx.playing = false;
    const via = s.hotkeys.includes('toggle-play') ? `renderer hotkey "toggle-play" -> stopPlay IPC (${ipcSince(n, 'stopPlay').length} call)` : `main stopped play directly (playState ${brief(s.states)})`;
    return `play stopped via ${via}`;
  } },

  { name: 'win-stop-play-release', win: true, timeout: 10000, async fn() {
    if (!ctx.game) return { skip: 'no game detected' };
    let note = '';
    if (ctx.playing || await R(() => document.body.classList.contains('playing'))) {
      note = ' (hotkey did not stop play; called window.ror.stopPlay())';
      await R(() => window.ror.stopPlay());
    }
    const w = win(), vs = w.virtualScreen();
    const s = await waitFor('the cursor clip to be released and always-on-top off', () => {
      const clip = w.clip(), top = appWin.isAlwaysOnTop();
      return { ok: sameRect(clip, vs) && !top, clip, vs, top };
    }, 5000, 50);
    const playing = await R(() => document.body.classList.contains('playing'));
    assert(!playing, 'renderer still in play mode');
    return `clip ${fmtRect(s.clip)} == virtual screen, alwaysOnTop false${note}`;
  } },

  { name: 'no-renderer-errors', timeout: 5000, async fn() {
    const toasts = await R(() => __smoke.toasts.map((t) => t.text)).catch(() => []);
    ctx.toasts = toasts;
    const bad = [...rendererErrors.map((e) => `[renderer ${e.kind}] ${e.msg}`), ...mainErrors.map((e) => `[main ${e.level}] ${e.msg}`)];
    assert(bad.length === 0, `${bad.length} error(s): ${brief(bad, 600)}`);
    return `0 renderer/main errors; toasts seen: ${brief([...new Set(toasts)], 300)}`;
  } },
];

// ---- Runner ------------------------------------------------------------------------------------

const results = [];
let finished = false;

function printTable() {
  const rows = results.map((r, i) => [String(i + 1), r.name, r.status, `${(r.ms / 1000).toFixed(1)}s`, r.detail]);
  const head = ['#', 'CHECK', 'RESULT', 'TIME', 'DETAIL'];
  const wd = [0, 1, 2, 3].map((c) => Math.max(head[c].length, ...rows.map((r) => r[c].length)));
  const line = (r) => r.slice(0, 4).map((c, i) => c.padEnd(wd[i])).join('  ') + '  ' + (r[4].length > 220 ? r[4].slice(0, 220) + '…' : r[4]);
  console.log('\n' + line(head));
  console.log(wd.map((n) => '-'.repeat(n)).join('  ') + '  ' + '-'.repeat(40));
  rows.forEach((r) => console.log(line(r)));
  const c = (s) => results.filter((r) => r.status === s).length;
  console.log(`\n${c('PASS')} passed, ${c('FAIL')} failed, ${c('SKIP')} skipped in ${((Date.now() - T0) / 1000).toFixed(1)}s` +
    ` (${process.platform} ${process.arch}, Electron ${process.versions.electron})\n`);
}

async function finish(reason) {
  if (finished) return;
  finished = true;
  epoch++;
  // Never leave the machine with a clipped cursor or an always-on-top overlay.
  if (IS_WIN) { try { win().unclip(); } catch {} }
  try { if (wc && !wc.isDestroyed()) await Promise.race([R(() => window.ror.stopPlay()), sleep(1000)]); } catch {}
  const failed = results.some((r) => r.status === 'FAIL');
  const report = {
    ok: !failed, reason: reason || null, platform: process.platform, arch: process.arch, versions: { electron: process.versions.electron, chrome: process.versions.chrome, node: process.versions.node },
    fakeGameTitle: GAME_TITLE || null, startedAt: new Date(T0).toISOString(), durationMs: Date.now() - T0, userData: USER_DATA,
    checks: results, rendererErrors, mainErrors, toasts: ctx.toasts || null, dialogs: dialogLog,
    ipc: ipcLog.map(({ raw, ...e }) => e),
  };
  try { fs.writeFileSync(path.join(OUT, 'results.json'), JSON.stringify(report, null, 2)); } catch (err) { console.log('could not write results.json:', err.message); }
  printTable();
  if (reason) console.log(`Aborted: ${reason}\n`);
  try { fs.rmSync(TMP, { recursive: true, force: true }); } catch {}
  app.exit(failed ? 1 : 0);
}

let current = null;
const hardTimer = setTimeout(() => {
  if (current) results.push({ name: current.name, status: 'FAIL', ms: Date.now() - current.t, detail: `overall ${HARD_TIMEOUT_MS / 1000}s timeout hit while running` });
  for (const c of CHECKS) if (!results.some((r) => r.name === c.name)) results.push({ name: c.name, status: 'FAIL', ms: 0, detail: 'not run (overall timeout)' });
  finish(`overall timeout of ${HARD_TIMEOUT_MS / 1000}s`);
}, HARD_TIMEOUT_MS);

async function runCheck(c) {
  epoch++;
  current = { name: c.name, t: Date.now() };
  let status = 'PASS', detail = '';
  if (c.win && !IS_WIN) { status = 'SKIP'; detail = 'Windows only'; }
  else if (ONLY.length && !ONLY.includes(c.name)) { status = 'SKIP'; detail = 'filtered out by SMOKE_ONLY'; }
  else {
    let timer;
    try {
      const r = await Promise.race([
        c.fn(),
        new Promise((_, rej) => { timer = setTimeout(() => rej(new Error(`check timed out after ${c.timeout} ms`)), c.timeout); }),
      ]);
      if (r && r.skip) { status = 'SKIP'; detail = r.skip; }
      else detail = r == null ? '' : typeof r === 'string' ? r : brief(r, 400);
    } catch (err) {
      status = 'FAIL';
      detail = String((err && err.message) || err);
    } finally {
      clearTimeout(timer);
      epoch++; // stop stragglers of a timed-out check
    }
    if (c.after) { try { await c.after(); } catch {} }
    if (c.shot && wc && !wc.isDestroyed()) await shot(c.name);
  }
  if (finished) return;
  results.push({ name: c.name, status, ms: Date.now() - current.t, detail });
  current = null;
  console.log(`[smoke] ${status.padEnd(4)} ${c.name} (${((Date.now() - T0) / 1000).toFixed(1)}s) ${detail.length > 300 ? detail.slice(0, 300) + '…' : detail}`);
}

app.whenReady().then(async () => {
  console.log(`[smoke] RateofReality smoke on ${process.platform}, Electron ${process.versions.electron}, userData ${USER_DATA}` +
    (GAME_TITLE ? `, fake game "${GAME_TITLE}"` : ''));
  for (const c of CHECKS) {
    if (finished) return;
    await runCheck(c);
    if (c.name === 'app-load' && results[0].status === 'FAIL') {
      for (const rest of CHECKS.slice(1)) results.push({ name: rest.name, status: rest.win && !IS_WIN ? 'SKIP' : 'FAIL', ms: 0, detail: 'not run: app failed to load' });
      break;
    }
  }
  clearTimeout(hardTimer);
  await finish();
}).catch((err) => {
  results.push({ name: 'harness', status: 'FAIL', ms: 0, detail: String(err && err.stack || err) });
  finish('harness error');
});
