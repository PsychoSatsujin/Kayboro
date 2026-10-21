'use strict';
// window.shell: the renderer's economy API ('shell:*' IPC). Every method returns a Promise;
// on*(cb) subscribe to pushes from main and return an unsubscribe function.
const { ipcRenderer } = require('electron');

const call = (name) => (...args) => ipcRenderer.invoke('shell:' + name, ...args);
const on = (ch) => (cb) => {
  const f = (_e, data) => cb(data);
  ipcRenderer.on('shell:' + ch, f);
  return () => ipcRenderer.removeListener('shell:' + ch, f);
};

const api = {
  ...Object.fromEntries([
    'getState', 'listCatalog', 'listDevelopers', 'purchase', 'equip',
    'setActiveWallpaper', 'buyPresetSlot', 'savePreset', 'getPreset', 'listLocalWallpapers',
    'sessionStart', 'sessionStop', 'openLink', 'getSettings', 'setSettings', 'getIntegrity',
    'getMods', 'reloadMods', 'openModsFolder', 'submitDeveloper', 'listSubmissions', 'exportPayoutSheet',
    'getWeeklyBundle', 'buyBundle', 'exportBundle', 'betLimits', 'placeBet', 'settleBet',
  ].map((n) => [n, call(n)])),
  onState: on('state'),
  onUnlock: on('unlock'),
  onLevelUp: on('levelUp'),
  onGameLaunched: on('gameLaunched'),
  onCatalog: on('catalog'),
};

// Developer tools (the Shop's Bundle Studio) when Kayboro runs from source (`electron .`) or with KAYBORO_DEV=1.
api.devTools = process.env.KAYBORO_DEV_TOOLS === '1' || process.env.KAYBORO_DEV === '1';

// Tester sandbox (KAYBORO_SANDBOX=1, src/main/sandbox.js): Profile shows its Tester tools when this is true.
api.sandbox = require('../sandbox').enabled;

if (process.env.KAYBORO_TEST === '1' || api.sandbox) {
  api.debugSimulateUnlock = call('debugSimulateUnlock');
  api.debugGrant = call('debugGrant');
  api.debugAdvanceTime = call('debugAdvanceTime');
}
if (api.sandbox) api.debugResetSandbox = call('debugResetSandbox');

module.exports = api;
