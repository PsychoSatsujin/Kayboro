'use strict';
// Stand-in "Steam game" for test/e2e/smoke.js. CI copies the Electron binary into a
// ...\steamapps\common\FakeGame\ folder and launches it with this directory, so the window's
// process path looks like a Steam install. The client area is a solid, known colour (#ff00ff).
const { app, BrowserWindow, Menu } = require('electron');

const title = process.env.FAKE_GAME_TITLE || 'FakeGame';
const COLOR = '#ff00ff';

Menu.setApplicationMenu(null); // no menu bar: keeps the client area exactly 800x600 and Alt inert

app.whenReady().then(() => {
  const win = new BrowserWindow({
    width: 800,
    height: 600,
    useContentSize: true,
    title,
    frame: true,
    resizable: false,
    backgroundColor: COLOR,
    webPreferences: { sandbox: true, contextIsolation: true },
  });
  win.on('page-title-updated', (e) => e.preventDefault()); // keep our title, the smoke test looks it up
  const html = `<!doctype html><title>${title}</title><body style="margin:0;background:${COLOR};overflow:hidden"></body>`;
  win.loadURL('data:text/html;charset=utf-8,' + encodeURIComponent(html));
});

app.on('window-all-closed', () => app.quit());
