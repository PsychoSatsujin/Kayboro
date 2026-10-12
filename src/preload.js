'use strict';
// Bridge between the renderer and main. Everything goes through 'ror:<name>' IPC channels.
const { contextBridge, ipcRenderer } = require('electron');

const INVOKE = ['listSources', 'detectSteamGame', 'getDisplays', 'moveWindowToDisplay', 'startPlay', 'stopPlay',
  'pickFile', 'listScenes', 'loadScene', 'saveScene', 'deleteScene', 'setFullscreen'];

const on = (ch) => (cb) => {
  const f = (_e, data) => cb(data);
  ipcRenderer.on('ror:' + ch, f);
  return () => ipcRenderer.removeListener('ror:' + ch, f);
};

contextBridge.exposeInMainWorld('ror', {
  ...Object.fromEntries(INVOKE.map((n) => [n, (...args) => ipcRenderer.invoke('ror:' + n, ...args)])),
  onCursor: on('cursor'),
  onPlayState: on('playState'),
  onHotkey: on('hotkey'),
});
