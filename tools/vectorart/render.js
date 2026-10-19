'use strict';
// Review renderer for the vector frames (Electron main script). For each SVG it writes
//   <out>/<id>.png      the frame on a checkerboard (transparent areas show the pattern)
//   <out>/<id>-app.png  the frame over a dark stage with a mock game picture in the hole
// and checks the hole: every pixel inside it must be fully transparent, the ring just outside opaque.
//   xvfb-run -a npx electron --no-sandbox tools/vectorart/render.js [--out DIR] [--max PX] [id ...]
const { app, BrowserWindow } = require('electron');
const fs = require('fs');
const os = require('os');
const path = require('path');

const ROOT = path.resolve(__dirname, '..', '..');
const argv = process.argv.slice(process.argv.findIndex((a) => a.endsWith('render.js')) + 1);
const opt = (k, d) => { const i = argv.indexOf(k); return i >= 0 ? argv.splice(i, 2)[1] : d; };
const OUT = path.resolve(opt('--out', path.join(os.tmpdir(), 'kayboro-vectorart')));
const MAX = +opt('--max', 1000);
const CROP = opt('--crop', ''); // x,y,w,h in frame px: also writes <id>-crop.png at 1:1
const catalog = JSON.parse(fs.readFileSync(path.join(ROOT, 'src', 'catalog', 'frames-vector.json'), 'utf8')).frames;
const ids = argv.length ? argv : catalog.map((f) => f.id);

async function renderOne(win, f) {
  const url = `data:image/svg+xml;base64,${fs.readFileSync(path.join(ROOT, 'src', 'renderer', f.file)).toString('base64')}`;
  return win.webContents.executeJavaScript(`(async () => {
    const f = ${JSON.stringify(f)}, MAX = ${MAX}, CROP = ${JSON.stringify(CROP)};
    const img = new Image(); img.src = ${JSON.stringify(url)}; await img.decode();
    const W = f.size.w, H = f.size.h, c = document.createElement('canvas'); c.width = W; c.height = H;
    const x = c.getContext('2d'); x.drawImage(img, 0, 0, W, H);
    const a = x.getImageData(0, 0, W, H).data;
    const hx = f.hole.x * W, hy = f.hole.y * H, hw = f.hole.w * W, hh = f.hole.h * H, r = f.holeRadius * hw;
    // signed distance-ish test for a rounded rect (negative inside)
    const sd = (px, py) => { const qx = Math.abs(px - (hx + hw / 2)) - (hw / 2 - r), qy = Math.abs(py - (hy + hh / 2)) - (hh / 2 - r);
      return Math.hypot(Math.max(qx, 0), Math.max(qy, 0)) + Math.min(Math.max(qx, qy), 0) - r; };
    let leak = 0, ring = 0, ringMin = 255, ringN = 0, opaque = 0;
    for (let py = 0; py < H; py++) for (let px = 0; px < W; px++) {
      const d = sd(px + 0.5, py + 0.5), al = a[(py * W + px) * 4 + 3];
      if (al > 200) opaque++;
      if (d < -1.5 && al > 0) leak++;
      else if (d > 1.5 && d < 4.5) { ringN++; ringMin = Math.min(ringMin, al); if (al < 250) ring++; }
    }
    // review images
    const s = Math.min(1, MAX / Math.max(W, H)), w = Math.round(W * s), h = Math.round(H * s);
    const out = document.createElement('canvas'); out.width = w; out.height = h; const o = out.getContext('2d');
    for (let yy = 0; yy < h; yy += 16) for (let xx = 0; xx < w; xx += 16) { o.fillStyle = ((xx + yy) / 16) % 2 ? '#c9c9c9' : '#f4f4f4'; o.fillRect(xx, yy, 16, 16); }
    o.drawImage(img, 0, 0, w, h);
    const checker = out.toDataURL('image/png');
    const g = o.createLinearGradient(0, 0, w, h); g.addColorStop(0, '#1d1530'); g.addColorStop(1, '#0f0d16'); o.fillStyle = g; o.fillRect(0, 0, w, h);
    const sx = hx * s, sy = hy * s, sw = hw * s, shh = hh * s;
    const gg = o.createLinearGradient(sx, sy, sx, sy + shh); gg.addColorStop(0, '#5ec8ff'); gg.addColorStop(0.62, '#b8f0ff'); gg.addColorStop(0.62, '#4caf50'); gg.addColorStop(1, '#2e7d32');
    o.fillStyle = gg; o.fillRect(sx, sy, sw, shh);
    o.fillStyle = '#ffd166'; o.beginPath(); o.arc(sx + sw * 0.8, sy + shh * 0.22, shh * 0.09, 0, 7); o.fill();
    o.fillStyle = '#e53935'; o.fillRect(sx + sw * 0.3, sy + shh * 0.5, sw * 0.05, shh * 0.12);
    o.drawImage(img, 0, 0, w, h);
    let crop = null;
    if (CROP) {
      const [cx, cy, cw, ch] = CROP.split(',').map(Number), k = document.createElement('canvas'); k.width = cw; k.height = ch;
      const kc = k.getContext('2d'); kc.fillStyle = '#1d1530'; kc.fillRect(0, 0, cw, ch); kc.drawImage(img, -cx, -cy, W, H); crop = k.toDataURL('image/png');
    }
    return { leak, ring, ringN, ringMin, opaquePct: +(100 * opaque / (W * H)).toFixed(1), checker, app: out.toDataURL('image/png'), crop };
  })()`);
}

app.whenReady().then(async () => {
  fs.mkdirSync(OUT, { recursive: true });
  const win = new BrowserWindow({ show: false, webPreferences: { offscreen: true } });
  await win.loadURL('data:text/html,<body></body>');
  let bad = 0;
  for (const id of ids) {
    const f = catalog.find((c) => c.id === id);
    if (!f) { console.log(`${id}: not in catalog`); bad++; continue; }
    try {
      const r = await renderOne(win, f);
      for (const [k, suf] of [['checker', ''], ['app', '-app'], ['crop', '-crop']]) if (r[k]) fs.writeFileSync(path.join(OUT, `${id}${suf}.png`), Buffer.from(r[k].split(',')[1], 'base64'));
      const ok = r.leak === 0;
      if (!ok) bad++;
      console.log(`${ok ? 'OK  ' : 'FAIL'} ${id}  hole leak px=${r.leak}  ring<250: ${r.ring}/${r.ringN} (min ${r.ringMin})  opaque ${r.opaquePct}%`);
    } catch (e) { bad++; console.log(`FAIL ${id}: ${e.message}`); }
  }
  console.log(`out: ${OUT}`);
  app.exit(bad ? 1 : 0);
});
