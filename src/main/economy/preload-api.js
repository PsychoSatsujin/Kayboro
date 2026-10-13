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
    'setActiveWallpaper', 'setWallpaperPreset', 'buyWallpaperPreset', 'listLocalWallpapers',
    'sessionStart', 'sessionStop', 'openLink', 'getSettings', 'setSettings', 'getIntegrity',
    'getMods', 'reloadMods', 'openModsFolder', 'submitDeveloper', 'listSubmissions', 'exportPayoutSheet',
  ].map((n) => [n, call(n)])),
  onState: on('state'),
  onUnlock: on('unlock'),
  onLevelUp: on('levelUp'),
  onGameLaunched: on('gameLaunched'),
  onCatalog: on('catalog'),
};

if (process.env.SHELLCADE_TEST === '1') {
  api.debugSimulateUnlock = call('debugSimulateUnlock');
  api.debugGrant = call('debugGrant');
  api.debugAdvanceTime = call('debugAdvanceTime');
}

module.exports = api;
