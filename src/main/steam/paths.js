'use strict';
// Locates the Steam install. SHELLCADE_STEAM_ROOT overrides detection (tests, portable installs).
const fs = require('fs');
const os = require('os');
const path = require('path');
const { execFileSync } = require('child_process');

const isDir = (p) => {
  try {
    return fs.statSync(p).isDirectory();
  } catch {
    return false;
  }
};
const looksLikeSteam = (p) => isDir(path.join(p, 'steamapps')) || isDir(path.join(p, 'config'));

// One value out of `reg query` output. DWORD/QWORD values ("0x1a") come back as numbers.
function parseRegValue(out, name) {
  for (const line of String(out || '').split(/\r?\n/)) {
    const m = /^\s*(.+?)\s+(REG_\w+)\s+(.*?)\s*$/.exec(line);
    if (m && m[1].toLowerCase() === String(name).toLowerCase()) return /^REG_[DQ]WORD$/.test(m[2]) ? Number(m[3]) : m[3];
  }
  return null;
}

// Registry value on Windows; null elsewhere or when missing.
function regQuery(key, name) {
  if (process.platform !== 'win32') return null;
  try {
    const out = execFileSync('reg', ['query', key, '/v', name], {
      encoding: 'utf8', windowsHide: true, timeout: 3000, stdio: ['ignore', 'pipe', 'ignore'],
    });
    return parseRegValue(out, name);
  } catch {
    return null;
  }
}

function candidates() {
  const h = os.homedir();
  if (process.platform === 'win32') {
    const reg = [regQuery('HKCU\\Software\\Valve\\Steam', 'SteamPath'), regQuery('HKLM\\SOFTWARE\\WOW6432Node\\Valve\\Steam', 'InstallPath')];
    const pf = [process.env['ProgramFiles(x86)'], process.env.ProgramFiles].filter(Boolean).map((p) => path.join(p, 'Steam'));
    return [...reg.filter((p) => typeof p === 'string' && p).map((p) => path.normalize(p)), ...pf, 'C:\\Program Files (x86)\\Steam'];
  }
  if (process.platform === 'darwin') return [path.join(h, 'Library', 'Application Support', 'Steam')];
  return [
    path.join(h, '.steam', 'steam'),
    path.join(h, '.local', 'share', 'Steam'),
    path.join(h, '.var', 'app', 'com.valvesoftware.Steam', '.local', 'share', 'Steam'),
    path.join(h, '.steam', 'root'),
  ];
}

// A found root is kept for the app's lifetime; "not installed" is re-checked after 30 s.
let cached, cachedAt = 0;
function steamRoot() {
  const env = process.env.SHELLCADE_STEAM_ROOT;
  if (env) return path.resolve(env);
  if (cached === undefined || (cached === null && Date.now() - cachedAt > 30e3)) {
    cached = candidates().find(looksLikeSteam) || null;
    cachedAt = Date.now();
  }
  return cached;
}

module.exports = {
  steamRoot,
  steamPath: (...parts) => {
    const r = steamRoot();
    return r ? path.join(r, ...parts) : null;
  },
  regQuery,
  parseRegValue,
  resetCache: () => void (cached = undefined),
};
