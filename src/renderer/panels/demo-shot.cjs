'use strict';
// Screenshots of demo.html: the whole window plus the sidebar at each scroll page.
//   xvfb-run -a -s '-screen 0 1600x900x24' npx electron --no-sandbox src/renderer/panels/demo-shot.cjs [outDir] [view[?query]...]
// e.g. 'shop?tab=wallpapers', 'profile&empty=1', 'toasts'. PANELS_REDUCED=1 forces prefers-reduced-motion.
const { app, BrowserWindow } = require('electron');
const fs = require('fs');
const os = require('os');
const path = require('path');

const args = process.argv.slice(process.argv.findIndex((a) => path.resolve(a) === __filename) + 1);
const outDir = path.resolve(args[0] || path.join(os.tmpdir(), 'kayboro-panel-shots'));
const views = args.length > 1 ? args.slice(1) : ['shop?tab=frames', 'shop?tab=finishes', 'shop?tab=colorways', 'shop?tab=fills', 'shop?tab=wallpapers', 'profile', 'devs', 'toasts', 'gallery'];
app.disableHardwareAcceleration();
app.commandLine.appendSwitch('force-device-scale-factor', '1.5');
if (process.env.PANELS_REDUCED) app.commandLine.appendSwitch('force-prefers-reduced-motion');
const wait = (ms) => new Promise((r) => setTimeout(r, ms));

app.whenReady().then(async () => {
  fs.mkdirSync(outDir, { recursive: true });
  const win = new BrowserWindow({ width: 1600, height: 900, show: true, backgroundColor: '#0f0d16', webPreferences: { contextIsolation: true } });
  const errors = [];
  win.webContents.on('console-message', (e) => {
    const lvl = e.level ?? 'info', m = String(e.message ?? e);
    if (lvl === 'error' || lvl === 'warning' || /error|fail/i.test(m)) errors.push(`[${lvl}] ${m}`);
  });
  for (const spec of views) {
    const [name, query = ''] = spec.split('?');
    await win.loadFile(path.join(__dirname, 'demo.html'), { query: Object.fromEntries(new URLSearchParams(`view=${name}&${query}`)) });
    await wait(name === 'toasts' ? 900 : 1600);
    const tag = spec.replace(/[^\w-]+/g, '_');
    fs.writeFileSync(path.join(outDir, `${tag}.png`), (await win.webContents.capturePage()).toPNG());
    if (name === 'toasts' || name === 'gallery') continue;
    const h = await win.webContents.executeJavaScript('(() => { const p = document.getElementById("panel"); return [p.scrollHeight, p.clientHeight, p.getBoundingClientRect().left]; })()');
    const [sh, ch, left] = h;
    const pages = Math.min(6, Math.ceil(sh / ch));
    for (let i = 0; i < pages; i++) {
      await win.webContents.executeJavaScript(`document.getElementById("panel").scrollTop = ${i * (ch - 80)}`);
      await wait(400);
      const img = await win.webContents.capturePage({ x: Math.floor(left) - 1, y: 0, width: 1600 - Math.floor(left) + 1, height: 900 });
      fs.writeFileSync(path.join(outDir, `${tag}-side${i}.png`), img.toPNG());
    }
  }
  if (errors.length) console.log('console:\n' + [...new Set(errors)].join('\n'));
  console.log('shots in', outDir);
  app.quit();
});
