'use strict';
// One-time data move for the rename Shellcade -> Kayboro. Electron derives userData from productName,
// so a pre-0.3.0 install kept its data in <appData>/Shellcade/: economy, mods and submissions under
// shellcade/, scenes in scenes.json, UI settings in Local Storage/. When <userData>/kayboro/state.json
// does not exist yet, that data is copied over. The legacy folder is only read: never moved, changed or deleted.
const fs = require('fs');
const path = require('path');

const LEGACY_APP = 'Shellcade', LEGACY_DIR = 'shellcade', LEGACY_SOURCE = 'shellcade';

const isDir = (p) => { try { return fs.statSync(p).isDirectory(); } catch { return false; } };

// Built-in wallpaper references were {source: 'shellcade', id}; they are {source: 'kayboro', id} now.
function renameSources(v) {
  if (Array.isArray(v)) return v.map(renameSources);
  if (!v || typeof v !== 'object') return v;
  const o = {};
  for (const [k, x] of Object.entries(v)) o[k] = k === 'source' && x === LEGACY_SOURCE ? 'kayboro' : renameSources(x);
  return o;
}

// Copies a JSON file with its wallpaper sources renamed (as-is when unreadable), through a temp file so
// a half-written copy never exists under the real name.
function copyRenamed(src, dst) {
  let text = fs.readFileSync(src, 'utf8');
  try {
    const d = JSON.parse(text), r = renameSources(d);
    if (JSON.stringify(r) !== JSON.stringify(d)) text = JSON.stringify(r, null, 1);
  } catch {} // not JSON: copied unchanged, its reader starts fresh as usual
  fs.writeFileSync(dst + '.tmp', text);
  fs.renameSync(dst + '.tmp', dst);
}

// Pure part, explicit paths: copies legacyDir's contents into dataDir (existing files are kept), the legacy
// scenes file and Local Storage folder next to it, and state.json last, so an interrupted copy runs again on
// the next start. Returns true when it copied.
function migrateLegacyData({ legacyDir, dataDir, legacyScenes = null, scenes = null, legacyStorage = null, storage = null }) {
  const state = path.join(dataDir, 'state.json'), legacyState = path.join(legacyDir, 'state.json');
  if (fs.existsSync(state) || !isDir(legacyDir)) return false;
  fs.mkdirSync(dataDir, { recursive: true });
  fs.cpSync(legacyDir, dataDir, { recursive: true, force: false, errorOnExist: false, filter: (src) => path.resolve(src) !== path.resolve(legacyState) });
  if (legacyScenes && scenes && fs.existsSync(legacyScenes) && !fs.existsSync(scenes)) copyRenamed(legacyScenes, scenes);
  if (legacyStorage && storage && isDir(legacyStorage) && !fs.existsSync(storage)) fs.cpSync(legacyStorage, storage, { recursive: true });
  if (fs.existsSync(legacyState)) copyRenamed(legacyState, state);
  return true;
}

// Called once from main before the economy starts and before the first window opens (Local Storage must not
// be in use yet). Never throws; skipped in test runs (KAYBORO_TEST=1), which use their own throwaway userData.
function migrateUserData(app) {
  if (process.env.KAYBORO_TEST === '1') return false;
  try {
    const userData = app.getPath('userData'), legacy = path.join(app.getPath('appData'), LEGACY_APP);
    if (path.resolve(legacy).toLowerCase() === path.resolve(userData).toLowerCase()) return false;
    const done = migrateLegacyData({ legacyDir: path.join(legacy, LEGACY_DIR), dataDir: path.join(userData, 'kayboro'),
      legacyScenes: path.join(legacy, 'scenes.json'), scenes: path.join(userData, 'scenes.json'),
      legacyStorage: path.join(legacy, 'Local Storage'), storage: path.join(userData, 'Local Storage') });
    if (done) console.log(`[migrate] copied ${LEGACY_APP} data from ${legacy} to ${userData}`);
    return done;
  } catch (err) {
    console.warn('[migrate] legacy data not copied:', err?.message || err);
    return false;
  }
}

module.exports = { migrateLegacyData, migrateUserData, renameSources };
