'use strict';
// Steam overlay for Electron. Must run before app 'ready' (steamworks.js adds Chromium switches and a
// per-window repaint ticker that the overlay needs). Only when Kayboro was started by Steam, or a
// steam_appid.txt lies next to the exe (local dev with Spacewar 480, never shipped), or
// KAYBORO_STEAM_APPID is set. Without steamworks.js, or outside Steam, it does nothing.
const fs = require('fs');
const path = require('path');

// Steam sets SteamAppId / SteamGameId for the process it launches (also under Proton on Linux).
function isUnderSteam({ env = process.env, exeDir = path.dirname(process.execPath), exists = (f) => fs.existsSync(f) } = {}) {
  if (Number(env.SteamAppId) > 0 || Number(env.SteamGameId) > 0 || Number(env.KAYBORO_STEAM_APPID) > 0) return true;
  try {
    return exists(path.join(exeDir, 'steam_appid.txt'));
  } catch {
    return false;
  }
}

// Returns true when the overlay was enabled.
function enable({ env = process.env, load = () => require('steamworks.js'), under = isUnderSteam } = {}) {
  if (env.KAYBORO_TEST === '1' || env.KAYBORO_NO_OVERLAY === '1' || !under()) return false;
  try {
    const sw = load();
    if (typeof sw.electronEnableSteamOverlay !== 'function') return false;
    sw.electronEnableSteamOverlay();
    return true;
  } catch (err) {
    console.warn('[steam] overlay not enabled:', err.message);
    return false;
  }
}

module.exports = { isUnderSteam, enable };
