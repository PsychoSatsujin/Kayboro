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
  getState: call('getState'),
  listCatalog: call('listCatalog'),
  listDevelopers: call('listDevelopers'),
  purchase: call('purchase'),
  equip: call('equip'),
  setBackdropSlot: call('setBackdropSlot'),
  buyBackdropSlot: call('buyBackdropSlot'),
  listLocalWallpapers: call('listLocalWallpapers'),
  sessionStart: call('sessionStart'),
  sessionStop: call('sessionStop'),
  openLink: call('openLink'),
  onState: on('state'),
  onUnlock: on('unlock'),
  onLevelUp: on('levelUp'),
  onGameLaunched: on('gameLaunched'),
};

if (process.env.SHELLCADE_TEST === '1') {
  api.debugSimulateUnlock = call('debugSimulateUnlock');
  api.debugGrant = call('debugGrant');
}

module.exports = api;
