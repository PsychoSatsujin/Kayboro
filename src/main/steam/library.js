'use strict';
// Steam libraries and the apps installed in them (steamapps/libraryfolders.vdf + appmanifest_*.acf).
const fs = require('fs');
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

function libraries(root = steamRoot()) {
  if (!root) return [];
  const lf = readText(path.join(root, 'steamapps', 'libraryfolders.vdf')) || readText(path.join(root, 'config', 'libraryfolders.vdf'));
  const found = [root];
  // New format: "0" { "path" "..." }. Old format: "1" "D:\\SteamLibrary".
  for (const [k, v] of Object.entries(vdf.get(lf, 'libraryfolders') || {})) {
    const p = typeof v === 'string' ? v : vdf.get(v, 'path');
    if (/^\d+$/.test(k) && typeof p === 'string' && p) found.push(p);
  }
  const seen = new Set();
  return found.filter((p) => {
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

module.exports = { libraries, installedApps, appForExe, normPath: norm };
