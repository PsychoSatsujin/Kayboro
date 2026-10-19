'use strict';
// Steam libraries and the apps installed in them (steamapps/libraryfolders.vdf + appmanifest_*.acf).
//
// A library drive can hang (a failing or sleeping external disk, a dead network share). Touching it
// synchronously would freeze the whole main process, and even an async fs call parks a libuv thread
// for good. So probeLibraries() checks each listed library once, in a child process with a timeout,
// and libraries() skips any library whose probe is pending or failed. Never-probed libraries (tests,
// tools) are used as before.
const fs = require('fs');
const { execFile } = require('child_process');
const path = require('path');
const vdf = require('./vdf');
const { steamRoot } = require('./paths');

const readText = (f) => {
  try {
    return vdf.parseText(fs.readFileSync(f, 'utf8'));
  } catch {
    return null;
  }
};
const isDir = (p) => {
  try {
    return fs.statSync(p).isDirectory();
  } catch {
    return false;
  }
};
const real = (p) => {
  try {
    return fs.realpathSync(p);
  } catch {
    return p;
  }
};

// Comparable path: no \\?\ prefix, forward slashes, lower case, no trailing slash.
const norm = (p) => String(p).replace(/^\\\\\?\\/, '').replace(/\\/g, '/').replace(/\/{2,}/g, '/').replace(/\/$/, '').toLowerCase();

// Every library Steam lists (root first), unchecked.
function listed(root) {
  if (!root) return [];
  const lf = readText(path.join(root, 'steamapps', 'libraryfolders.vdf')) || readText(path.join(root, 'config', 'libraryfolders.vdf'));
  const found = [root];
  // New format: "0" { "path" "..." }. Old format: "1" "D:\\SteamLibrary".
  for (const [k, v] of Object.entries(vdf.get(lf, 'libraryfolders') || {})) {
    const p = typeof v === 'string' ? v : vdf.get(v, 'path');
    if (/^\d+$/.test(k) && typeof p === 'string' && p) found.push(p);
  }
  return found;
}

const health = new Map(); // norm(library) -> true (answered) | false (hung or missing) | 'pending'
const PROBE_MS = 4000;
const CMD_SAFE = /^[^"%^&|<>!\r\n]+$/;

// True when <lib>/steamapps answers within PROBE_MS. On Windows the check runs in cmd.exe, so a hung
// drive stalls (and is killed in) the child, never this process.
function probe(lib) {
  const dir = path.join(lib, 'steamapps');
  if (process.platform === 'win32' && CMD_SAFE.test(dir)) {
    return new Promise((resolve) => {
      execFile(process.env.ComSpec || 'cmd.exe', ['/d', '/s', '/c', `"if exist "${dir}\\" (exit 0) else (exit 3)"`],
        { timeout: PROBE_MS, windowsHide: true, windowsVerbatimArguments: true }, (err) => resolve(!err));
    });
  }
  const timeout = new Promise((resolve) => setTimeout(resolve, PROBE_MS, false));
  return Promise.race([fs.promises.stat(dir).then((s) => s.isDirectory(), () => false), timeout]);
}

const probing = new Map(); // norm(root) -> the probe run in flight or done
/** Probes every listed library once per session (concurrent callers share the run); resolves to libraries(). */
function probeLibraries(root = steamRoot()) {
  const key = norm(root || '');
  if (!probing.has(key)) {
    const libs = listed(root).filter((p) => !health.has(norm(p)));
    for (const p of libs) health.set(norm(p), 'pending');
    probing.set(key, Promise.all(libs.map(async (p) => {
      const ok = await probe(p);
      health.set(norm(p), ok);
      if (!ok) console.warn(`[steam] library not responding, skipped: ${p}`);
    })));
  }
  return probing.get(key).then(() => libraries(root));
}

function libraries(root = steamRoot()) {
  const seen = new Set();
  return listed(root).filter((p) => {
    const h = health.get(norm(p));
    if (h === false || h === 'pending') return false; // hung, missing or not checked yet: never touch it here
    const key = norm(real(p));
    if (seen.has(key) || !isDir(path.join(p, 'steamapps'))) return false;
    seen.add(key);
    return true;
  });
}

function installedApps(libs = libraries()) {
  const apps = new Map();
  for (const lib of libs) {
    const dir = path.join(lib, 'steamapps');
    let files = [];
    try {
      files = fs.readdirSync(dir);
    } catch {}
    for (const f of files) {
      if (!/^appmanifest_\d+\.acf$/i.test(f)) continue;
      const st = vdf.get(readText(path.join(dir, f)), 'AppState');
      const appid = Number(vdf.get(st, 'appid'));
      const installdir = vdf.get(st, 'installdir');
      if (!Number.isSafeInteger(appid) || appid <= 0 || typeof installdir !== 'string' || !installdir || apps.has(appid)) continue;
      const name = vdf.get(st, 'name');
      apps.set(appid, { appid, name: typeof name === 'string' && name ? name : `App ${appid}`, installdir, libraryPath: lib });
    }
  }
  return [...apps.values()];
}

// The installed app whose steamapps/common/<installdir> folder contains exePath, or null.
function appForExe(exePath, apps = installedApps()) {
  if (!exePath || !apps || !apps.length) return null;
  const exe = norm(exePath);
  let best = null;
  let bestLen = 0;
  for (const a of apps) {
    const dir = norm(path.join(a.libraryPath, 'steamapps', 'common', a.installdir)) + '/';
    if (exe.startsWith(dir) && dir.length > bestLen) [best, bestLen] = [a, dir.length];
  }
  if (best) return best;
  // Library path seen differently (symlink, mapped or renamed drive): match the common/<installdir>/ segment.
  return apps.find((a) => exe.includes(`/steamapps/common/${norm(a.installdir)}/`)) || null;
}

module.exports = { libraries, probeLibraries, installedApps, appForExe, normPath: norm };
