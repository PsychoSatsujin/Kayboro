'use strict';
// Invisible screens for games: a virtual monitor nobody can see, so the game runs there at full speed
// (never minimized) and Kayboro is the only place it shows. The driver work happens in worker.js; this
// module adds the Electron side: which Electron display a new screen became, moving the game onto it
// and back, and cleaning up on quit.
const fs = require('fs');
const path = require('path');
const { Worker } = require('worker_threads');

let worker = null, seq = 0, broken = null;
const pending = new Map();
const active = new Map(); // electron display id -> { index, backend, device, hwnd, restore }

function start() {
  if (worker || broken || process.platform !== 'win32') return worker;
  try {
    worker = new Worker(path.join(__dirname, 'worker.js'));
    worker.on('message', ({ id, ok, result, error }) => {
      if (id === 0 && !ok) { broken = error; return; }
      const p = pending.get(id);
      if (!p) return;
      pending.delete(id);
      clearTimeout(p.timer);
      ok ? p.resolve(result) : p.reject(new Error(error));
    });
    worker.on('error', (err) => { broken = err.message; for (const p of pending.values()) p.reject(err); pending.clear(); worker = null; });
    worker.on('exit', () => { worker = null; });
    worker.unref(); // never keeps Kayboro alive on its own
  } catch (err) {
    broken = err.message;
  }
  return worker;
}

// One request to the worker; a stuck driver call times out instead of hanging the caller.
function call(op, args, ms = 8000) {
  if (!start()) return Promise.reject(new Error(broken || 'virtual screens need Windows'));
  return new Promise((resolve, reject) => {
    const id = ++seq;
    pending.set(id, { resolve, reject, timer: setTimeout(() => { pending.delete(id); reject(new Error(`${op} timed out`)); }, ms) });
    worker.postMessage({ id, op, args });
  });
}

// kbvdd-setup.exe that came with this copy of Kayboro: next to Kayboro.exe in a build (driver/), or the
// local driver build in a dev checkout. null when there is none.
function driverPackage() {
  const exeDir = path.dirname(process.execPath);
  for (const f of [path.join(exeDir, 'driver', 'kbvdd-setup.exe'), path.join(__dirname, '..', '..', '..', 'driver', 'build', 'Release', 'package', 'kbvdd-setup.exe')]) {
    if (fs.existsSync(f) && fs.existsSync(path.join(path.dirname(f), 'KayboroVdd.inf'))) return f;
  }
  return null;
}

/** { available, backend: 'kayboro' | 'parsec' | null, active: [{ displayId, ... }], canInstall, error? } */
async function status() {
  const canInstall = process.platform === 'win32' && !!driverPackage();
  try {
    const s = await call('status');
    return { available: !!s.backend, backend: s.backend, version: s.version, ready: s.ready, canInstall,
      active: [...active.entries()].map(([displayId, a]) => ({ displayId, backend: a.backend, hwnd: a.hwnd })) };
  } catch (err) {
    return { available: false, backend: null, active: [], canInstall, error: err.message };
  }
}

/** Installs the bundled Kayboro Virtual Screen Driver (Windows asks the player for administrator approval). */
async function installDriver() {
  const file = driverPackage();
  if (!file) return { ok: false, error: 'The driver did not come with this copy of Kayboro.' };
  const r = await call('installDriver', { file }, 150000);
  if (!r.started) return { ok: false, cancelled: true, error: 'The driver was not installed: administrator approval was declined.' };
  if (!r.ok) return { ok: false, error: `The driver installer stopped with code ${r.exitCode}.` };
  return { ok: true, restart: r.restart };
}

// Resolution for a screen showing `aspect` (width / height): about 1080 px on the short side (1440 lines for
// ultrawide), multiples of 8, within the driver's limits. The Parsec driver only knows its presets, so it
// gets the closest aspect, preferring about 1080 lines over heavier modes.
const PARSEC_MODES = [[3840, 2160], [3440, 1440], [2560, 1440], [2560, 1080], [1920, 1080], [1600, 900], [1280, 720]];
function sizeFor(aspect, backend) {
  const a = Number.isFinite(aspect) && aspect > 0.3 && aspect < 4 ? aspect : 16 / 9;
  if (backend === 'parsec') {
    const best = PARSEC_MODES.map(([w, h]) => ({ w, h, d: Math.abs(Math.log((w / h) / a)) })).sort((x, y) => x.d - y.d || Math.abs(x.h - 1080) - Math.abs(y.h - 1080))[0];
    return { w: best.w, h: best.h };
  }
  const r8 = (v) => Math.round(v / 8) * 8;
  if (a < 1) return { w: 1080, h: Math.min(4320, r8(1080 / a)) }; // portrait: 1080 wide
  const h = a >= 2 ? 1440 : 1080;
  return { w: Math.min(7680, Math.max(640, r8(h * a))), h };
}

/**
 * Plugs in an invisible screen sized for `aspect` and returns { displayId, bounds, backend } once Electron
 * sees it. `screen` is Electron's screen module.
 */
async function create(screen, { aspect, refresh = 60 } = {}) {
  const st = await call('status');
  if (!st.backend) throw new Error('No virtual screen driver is installed.');
  const size = sizeFor(aspect, st.backend);
  const before = new Set(screen.getAllDisplays().map((d) => d.id));
  const added = new Promise((resolve) => {
    const onAdd = (_e, d) => { if (!before.has(d.id)) { screen.off('display-added', onAdd); resolve(d); } };
    screen.on('display-added', onAdd);
    setTimeout(() => { screen.off('display-added', onAdd); resolve(screen.getAllDisplays().find((d) => !before.has(d.id)) || null); }, 6000);
  });
  const { index, backend } = await call('add', { width: size.w, height: size.h, refresh });
  const display = await added;
  if (!display) { await call('remove', { index }).catch(() => {}); throw new Error('Windows did not show the new screen.'); }

  // Find its device name by position (physical pixels), tuck it into a corner and set the resolution.
  const phys = process.platform === 'win32' ? screen.dipToScreenRect(null, display.bounds) : display.bounds;
  const devs = await call('displays');
  const dev = devs.find((d) => d.x === phys.x && d.y === phys.y) || devs.find((d) => /kayboro|parsec/i.test(d.adapter) && d.width === phys.width);
  if (dev) await call('place', { device: dev.device, size: backend === 'parsec' ? { width: size.w, height: size.h } : null }).catch(() => null);
  const fresh = screen.getAllDisplays().find((d) => d.id === display.id) || display;
  active.set(display.id, { index, backend, device: dev?.device || null, hwnd: null, restore: null });
  return { displayId: String(display.id), bounds: { ...fresh.bounds }, backend, size };
}

/** Unplugs the screen behind Electron display `displayId` (moving its game back first, see hideGame). */
async function remove(displayId) {
  const key = [...active.keys()].find((id) => String(id) === String(displayId));
  if (key == null) return false;
  const a = active.get(key);
  active.delete(key);
  await call('remove', { index: a.index }).catch(() => {});
  return true;
}

async function removeAll() {
  active.clear();
  if (worker) await call('removeAll', {}, 3000).catch(() => {});
}

// Remembers which game sits on which invisible screen and where it came from.
function track(displayId, hwnd, restore) {
  const key = [...active.keys()].find((id) => String(id) === String(displayId));
  if (key != null) Object.assign(active.get(key), { hwnd: String(hwnd), restore });
}
const findByHwnd = (hwnd) => [...active.entries()].find(([, a]) => a.hwnd === String(hwnd)) || null;

async function dispose() {
  await removeAll();
  if (worker) { await worker.terminate().catch(() => {}); worker = null; }
}

module.exports = { status, create, remove, removeAll, dispose, track, findByHwnd, sizeFor, installDriver, driverPackage, _active: active };
