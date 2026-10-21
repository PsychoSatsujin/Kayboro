'use strict';
// Bridge between the renderer and main. Everything goes through 'ror:<name>' IPC channels.
const { contextBridge, ipcRenderer } = require('electron');

const INVOKE = ['listSources', 'detectSteamGame', 'getDisplays', 'moveWindowToDisplay', 'startPlay', 'stopPlay',
  'pickFile', 'listScenes', 'loadScene', 'saveScene', 'deleteScene', 'setFullscreen',
  'popOut', 'popoutUpdate', 'popoutClose', 'popoutPlay', 'popoutInfo', 'popoutHit', 'popoutDrag', 'popoutResize', 'popoutResizeDrag', 'popoutMenu', 'popoutFrame',
  'virtualScreenStatus', 'hideGame', 'showGame', 'installScreenDriver', 'kayboBrowse', 'kayboUse', 'kayboSave', 'kayboOpen',
  'clashStatus', 'clashCheck', 'clashSnapshot', 'clashSetName', 'clashSetServer', 'clashMatch', 'clashSubmitRun', 'clashCancel',
  'clashPercentage', 'clashResolvePercent', 'clashOpponents', 'clashResolvePick', 'clashLeaderboard',
  'clashGroups', 'clashCreateGroup', 'clashJoinGroup', 'clashLeaveGroup', 'clashGhosts', 'clashTopGhosts'];

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
  onPopout: on('popout'),
});

contextBridge.exposeInMainWorld('shell', require('./main/economy/preload-api.js'));
