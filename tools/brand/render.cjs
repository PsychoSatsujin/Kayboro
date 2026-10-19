'use strict';
// Offscreen SVG -> PNG/JPEG rasterizer for the brand generators (Electron, no deps). Pattern: tools/shells/preview.cjs.
//
//   const { run } = require('./render.cjs');
//   run(async (r) => { fs.writeFileSync('a.png', await r.raster(svg, 256, 256)); });   // inside `npx electron <script>`
//
// r.raster(svg, w, h, { type: 'png' | 'jpeg', quality, bg, filter, smooth }) draws the SVG (vector, so any nested
// data: <image> is re-rasterized at its placed size) onto a w x h canvas and returns a Buffer. JPEG gets `bg`
// (default the Kayboro stage colour) under it since it has no alpha. `filter` is a canvas filter string
// (e.g. 'grayscale(1) brightness(.6)'). Deterministic: device scale factor 1, no GPU, no fonts or network.

const isElectron = !!process.versions.electron;

// Runs inside the page (serialized), so it must not close over anything.
async function job({ svg, w, h, type, quality, bg, filter, smooth }) {
  const img = new Image();
  img.src = 'data:image/svg+xml;base64,' + btoa(unescape(encodeURIComponent(svg)));
  await img.decode();
  const c = Object.assign(document.createElement('canvas'), { width: w, height: h }), g = c.getContext('2d');
  if (bg) { g.fillStyle = bg; g.fillRect(0, 0, w, h); }
  g.imageSmoothingEnabled = smooth;
  if (filter) g.filter = filter;
  g.drawImage(img, 0, 0, w, h);
  return c.toDataURL(`image/${type}`, quality).split(',')[1];
}

/** Boot Electron offscreen, hand `main` a rasterizer, exit 0 (or 1 on a thrown error). */
function run(main) {
  if (!isElectron) { console.error('run me with electron: npx electron <script>'); process.exit(1); }
  const { app, BrowserWindow } = require('electron');
  app.commandLine.appendSwitch('force-device-scale-factor', '1');
  app.disableHardwareAcceleration();
  app.whenReady().then(async () => {
    let code = 0;
    try {
      const win = new BrowserWindow({ show: false, width: 800, height: 600, webPreferences: { offscreen: true } });
      await win.loadURL('data:text/html,<body></body>');
      const r = {
        async raster(svg, w, h, o = {}) {
          const type = o.type || 'png';
          const b64 = await win.webContents.executeJavaScript(`(${job})(${JSON.stringify({
            svg, w, h, type, quality: o.quality ?? 0.92, filter: o.filter || '', smooth: o.smooth !== false,
            bg: o.bg !== undefined ? o.bg : type === 'jpeg' ? '#0f0d16' : null })})`);
          return Buffer.from(b64, 'base64');
        },
        page: win.webContents, // for callers with their own page-side jobs (contact sheets)
      };
      await main(r);
    } catch (e) {
      console.error(e.stack || e.message);
      code = 1;
    }
    app.exit(code);
  });
}

module.exports = { run };
