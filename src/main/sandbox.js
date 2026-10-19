'use strict';
// Tester sandbox: KAYBORO_SANDBOX=1 (and only that, never a setting or a flag) runs Kayboro with its own
// userData, the debug hooks on (debugGrant, debugAdvanceTime, debugSimulateUnlock, debugResetSandbox) and
// Kayboro's own Steam achievements off. Dev runs keep it in <repo>/.sandbox/userData, packaged builds in
// <appData>/Kayboro Sandbox/userData; KAYBORO_SANDBOX_DIR overrides both. Test runs (KAYBORO_TEST=1)
// own their userData, so the sandbox stays off there. Normal runs never see any of this.
const fs = require('fs');
const os = require('os');
const path = require('path');

const ROOT = path.resolve(__dirname, '..', '..');
// Economy files a reset removes from <userData>/kayboro (mods, scenes and UI settings stay).
const RESET_FILES = ['state.json', 'history.jsonl'];

const isEnabled = (env = {}) => env.KAYBORO_SANDBOX === '1' && env.KAYBORO_TEST !== '1';

function defaultAppData(env = {}, platform = process.platform) {
  if (env.APPDATA) return env.APPDATA;
  if (platform === 'darwin') return path.join(os.homedir(), 'Library', 'Application Support');
  return env.XDG_CONFIG_HOME || path.join(os.homedir(), '.config');
}

// Where the sandbox userData lives. Packaged apps can't write next to app.asar, so they use appData.
function resolveDir({ env = {}, root = ROOT, packaged = false, appData = defaultAppData(env) } = {}) {
  if (env.KAYBORO_SANDBOX_DIR && String(env.KAYBORO_SANDBOX_DIR).trim()) return path.resolve(String(env.KAYBORO_SANDBOX_DIR).trim());
  return packaged ? path.join(appData, 'Kayboro Sandbox', 'userData') : path.join(root, '.sandbox', 'userData');
}

const isInside = (child, parent) => {
  const rel = path.relative(path.resolve(parent), path.resolve(child));
  return !!rel && !rel.startsWith('..') && !path.isAbsolute(rel);
};

const enabled = isEnabled(process.env);
const sandbox = {
  enabled,
  dir: enabled ? resolveDir({ env: process.env, packaged: /[\\/]app\.asar([\\/]|$)/i.test(__dirname) }) : null,

  // Call before anything reads userData (top of main.js). Returns the sandbox for chaining.
  apply(app) {
    if (!sandbox.enabled) return sandbox;
    fs.mkdirSync(sandbox.dir, { recursive: true });
    app.setPath('userData', sandbox.dir);
    console.log(`[sandbox] tester sandbox on: userData ${sandbox.dir}`);
    // "(Sandbox)" in every window title, so a sandbox window is never mistaken for the real profile.
    app.on('browser-window-created', (_e, w) => w.on('page-title-updated', (ev, title) => {
      ev.preventDefault();
      w.setTitle(/\(Sandbox\)$/.test(title) ? title : `${title} (Sandbox)`);
    }));
    return sandbox;
  },

  // Starts the sandbox profile over: removes its economy files and reloads the economy (in memory + on disk).
  // Refuses anything outside the sandbox dir, so it can never clear a real save.
  resetProfile({ economy, dir, sandboxDir = sandbox.dir }) {
    if (!sandboxDir || !dir || !isInside(dir, sandboxDir)) throw new Error('reset is only allowed inside the sandbox folder');
    for (const f of RESET_FILES) fs.rmSync(path.join(dir, f), { force: true });
    economy.load();
    economy._save();
    economy.emit('state', economy.getState());
    return economy.getState();
  },
};

module.exports = Object.assign(sandbox, { isEnabled, resolveDir, isInside, RESET_FILES });
