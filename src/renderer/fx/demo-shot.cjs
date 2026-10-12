'use strict';
// Screenshots of demo.html: xvfb-run -a -s '-screen 0 1600x900x24' npx electron --no-sandbox src/renderer/fx/demo-shot.cjs [outDir] [view...]
// Writes <outDir>/<view>[-tN].png. Pass FX_REDUCED=1 to emulate prefers-reduced-motion.
const { app, BrowserWindow } = require('electron');
const fs = require('fs');
const path = require('path');

const args = process.argv.slice(process.argv.findIndex(a => path.resolve(a) === __filename) + 1);
const outDir = path.resolve(args[0] || path.join(__dirname, 'shots'));
const views = args.length > 1 ? args.slice(1) : ['finishes', 'colorways', 'fills', 'savers', 'combos'];
app.disableHardwareAcceleration();
if (process.env.FX_REDUCED) app.commandLine.appendSwitch('force-prefers-reduced-motion');
const wait = ms => new Promise(r => setTimeout(r, ms));

app.whenReady().then(async () => {
  fs.mkdirSync(outDir, { recursive: true });
  const win = new BrowserWindow({ width: 1600, height: 900, show: true, backgroundColor: '#0f0d16', webPreferences: { contextIsolation: true } });
  const errors = [];
  win.webContents.on('console-message', (e) => { const m = e.message ?? e; if (/error|warn|fail/i.test(String(m))) errors.push(String(m)); });
  for (const spec of views) {
    const [name, query = ''] = spec.split('?');
    await win.loadFile(path.join(__dirname, 'demo.html'), { query: Object.fromEntries(new URLSearchParams(`view=${name}&${query}`)) });
    await wait(1500);
    const tag = spec.replace(/[^\w-]+/g, '_');
    for (const [i, t] of [[0, 0], [1, 1400]]) {
      if (t) await wait(t);
      if (process.env.FX_MOUSE) win.webContents.sendInputEvent({ type: 'mouseMove', x: +process.env.FX_MOUSE.split(',')[0], y: +process.env.FX_MOUSE.split(',')[1] });
      fs.writeFileSync(path.join(outDir, `${tag}-t${i}.png`), (await win.webContents.capturePage()).toPNG());
    }
  }
  if (errors.length) console.log('console:', errors.join('\n'));
  console.log('shots in', outDir);
  app.quit();
});
