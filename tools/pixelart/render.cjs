'use strict';
// Preview + pixel check for the pixel-art frames (Electron, no deps):
//
//   xvfb-run -a -s '-screen 0 1600x900x24' npx electron --no-sandbox tools/pixelart/render.cjs [--out=DIR] [id ...]
//
// For each frame in src/catalog/frames-pixel.json it rasterizes the SVG at 1x and checks the opening:
// alpha 0 everywhere inside the hole (minus the rounded corners), alpha 255 on the ring around it, and
// the transparent region flood-filled from the hole's center must span exactly the JSON hole. It also writes
// <DIR>/<id>.png (3x: checkerboard | stage with a fake game, and a "clear shell + fill" panel for
// translucent frames) and <DIR>/sheet.png. Default DIR: <tmp>/shellcade-pixelart. Exit 1 on any failure.
const { app, BrowserWindow } = require('electron');
const fs = require('fs');
const os = require('os');
const path = require('path');

const ROOT = path.resolve(__dirname, '..', '..');
const argv = process.argv.slice(process.argv.findIndex((a) => a.endsWith('render.cjs')) + 1);
const OUT = (argv.find((a) => a.startsWith('--out=')) || '').slice(6) || path.join(os.tmpdir(), 'shellcade-pixelart');
const ONLY = argv.filter((a) => !a.startsWith('--'));

app.commandLine.appendSwitch('force-device-scale-factor', '1');
app.disableHardwareAcceleration();

// Runs inside the page (serialized), so it must not close over anything.
async function job({ f, svg, scale, sheet }) {
  const img = new Image();
  img.src = 'data:image/svg+xml;base64,' + btoa(unescape(encodeURIComponent(svg)));
  await img.decode();
  const { w: W, h: H } = f.size, mk = (w, h) => Object.assign(document.createElement('canvas'), { width: w, height: h });
  const hx = Math.round(f.hole.x * W), hy = Math.round(f.hole.y * H), hw = Math.round(f.hole.w * W), hh = Math.round(f.hole.h * H);
  const r = Math.round(f.holeRadius * hw), cuts = Array.from({ length: r }, (_, i) => Math.ceil(r - Math.sqrt(r * r - (r - i) ** 2) - 1e-9));

  const c1 = mk(W, H), g1 = c1.getContext('2d', { willReadFrequently: true });
  g1.drawImage(img, 0, 0, W, H);
  const d = g1.getImageData(0, 0, W, H).data, A = (x, y) => d[(y * W + x) * 4 + 3];
  let leaks = 0, gaps = 0;
  for (let j = 0; j < hh; j++) {
    const b = hh - 1 - j, a = Math.max(j < r ? cuts[j] : 0, b < r ? cuts[b] : 0);
    for (let i = a; i < hw - a; i++) if (A(hx + i, hy + j) !== 0) leaks++;
  }
  for (let i = hx; i < hx + hw; i++) gaps += (A(i, hy - 1) !== 255) + (A(i, hy + hh) !== 255);
  for (let j = hy; j < hy + hh; j++) gaps += (A(hx - 1, j) !== 255) + (A(hx + hw, j) !== 255);
  const seen = new Uint8Array(W * H), st = [(hy + (hh >> 1)) * W + hx + (hw >> 1)];
  let x0 = W, y0 = H, x1 = -1, y1 = -1;
  while (st.length) {
    const i = st.pop(), x = i % W, y = (i - x) / W;
    if (seen[i] || d[i * 4 + 3] >= 16) continue;
    seen[i] = 1; x0 = Math.min(x0, x); x1 = Math.max(x1, x); y0 = Math.min(y0, y); y1 = Math.max(y1, y);
    if (x > 0) st.push(i - 1); if (x < W - 1) st.push(i + 1); if (y > 0) st.push(i - W); if (y < H - 1) st.push(i + W);
  }
  const det = { x: x0, y: y0, w: x1 - x0 + 1, h: y1 - y0 + 1 }, detOk = det.x === hx && det.y === hy && det.w === hw && det.h === hh;

  // Previews.
  const s = scale, fw = W * s, fhh = H * s, game = (g, x, y, w, h) => {
    const sky = g.createLinearGradient(0, y, 0, y + h);
    sky.addColorStop(0, '#4aa8ff'); sky.addColorStop(0.65, '#b8ecff'); sky.addColorStop(0.66, '#5cc85c'); sky.addColorStop(1, '#2f8a3c');
    g.fillStyle = sky; g.fillRect(x, y, w, h);
    g.fillStyle = '#fff4a8'; g.beginPath(); g.arc(x + w * 0.78, y + h * 0.22, h * 0.09, 0, 7); g.fill();
    g.fillStyle = '#ffffff'; for (const [u, v] of [[0.2, 0.2], [0.5, 0.3]]) g.fillRect(x + w * u, y + h * v, w * 0.14, h * 0.05);
    g.fillStyle = '#d0452f'; g.fillRect(x + w * 0.3, y + h * 0.55, w * 0.05, h * 0.11);
    g.strokeStyle = 'rgba(255,255,255,.35)'; g.lineWidth = 1; g.strokeRect(x + 0.5, y + 0.5, w - 1, h - 1);
  };
  const stars = (g, w, h) => {
    const bg = g.createLinearGradient(0, 0, 0, h); bg.addColorStop(0, '#120b2e'); bg.addColorStop(1, '#2a1250');
    g.fillStyle = bg; g.fillRect(0, 0, w, h);
    let seed = 7; const rnd = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);
    for (let i = 0; i < 260; i++) { g.fillStyle = rnd() < 0.3 ? '#7af0ff' : '#ffffff'; const z = rnd() < 0.15 ? 2 : 1; g.fillRect(rnd() * w | 0, rnd() * h | 0, z * s, z * s); }
  };
  const panels = sheet ? 1 : f.translucent ? 3 : 2, pad = sheet ? 0 : 24;
  const out = mk(panels * fw + (panels - 1) * pad, fhh), g = out.getContext('2d');
  g.imageSmoothingEnabled = false;
  const hole = [hx * s, hy * s, hw * s, hh * s];
  let ox = 0;
  if (!sheet) { // checkerboard
    for (let y = 0; y < fhh; y += 4 * s) for (let x = 0; x < fw; x += 4 * s) { g.fillStyle = ((x + y) / (4 * s)) % 2 ? '#d9d6e4' : '#a9a5bb'; g.fillRect(x, y, 4 * s, 4 * s); }
    g.drawImage(img, 0, 0, fw, fhh);
    ox = fw + pad;
  }
  for (let p = 0; p < (f.translucent && !sheet ? 2 : 1); p++, ox += fw + pad) {
    g.fillStyle = '#0f0d16'; g.fillRect(ox, 0, fw, fhh);
    if (p === 1) { // shell fill masked by the frame's own alpha, under the frame
      const fl = mk(fw, fhh), gl = fl.getContext('2d');
      stars(gl, fw, fhh); gl.globalCompositeOperation = 'destination-in'; gl.drawImage(img, 0, 0, fw, fhh);
      g.drawImage(fl, ox, 0);
    }
    game(g, ox + hole[0], hole[1], hole[2], hole[3]);
    g.drawImage(img, ox, 0, fw, fhh);
  }
  return { leaks, gaps, det, detOk, png: out.toDataURL('image/png').split(',')[1] };
}

app.whenReady().then(async () => {
  let code = 0;
  try {
    const all = JSON.parse(fs.readFileSync(path.join(ROOT, 'src', 'catalog', 'frames-pixel.json'), 'utf8')).frames;
    const frames = ONLY.length ? all.filter((f) => ONLY.includes(f.id)) : all;
    fs.mkdirSync(OUT, { recursive: true });
    const win = new BrowserWindow({ show: false, width: 800, height: 600, webPreferences: { offscreen: true } });
    await win.loadURL('data:text/html,<body></body>');
    const run = (f, scale, sheet) => win.webContents.executeJavaScript(`(${job})(${JSON.stringify({
      f, svg: fs.readFileSync(path.join(ROOT, 'src', 'renderer', f.file), 'utf8'), scale, sheet })})`);
    const sheet = [];
    for (const f of frames) {
      const r = await run(f, 3, false);
      fs.writeFileSync(path.join(OUT, `${f.id}.png`), Buffer.from(r.png, 'base64'));
      sheet.push({ f, png: (await run(f, 2, true)).png });
      const ok = !r.leaks && !r.gaps && r.detOk;
      if (!ok) code = 1;
      console.log(`${ok ? 'PASS' : 'FAIL'}  ${f.id.padEnd(18)} leaks=${r.leaks} rimGaps=${r.gaps} flood=${r.detOk ? 'match' : JSON.stringify(r.det)}`);
    }
    // Contact sheet: all frames at 2x, 4 per row.
    const png = await win.webContents.executeJavaScript(`(async (items) => {
      const imgs = await Promise.all(items.map(async (it) => { const i = new Image(); i.src = 'data:image/png;base64,' + it; await i.decode(); return i; }));
      const cols = Math.min(4, imgs.length), rows = Math.ceil(imgs.length / cols), pad = 24;
      const cw = Math.max(...imgs.map((i) => i.width)), ch = Math.max(...imgs.map((i) => i.height));
      const c = Object.assign(document.createElement('canvas'), { width: cols * (cw + pad) + pad, height: rows * (ch + pad) + pad });
      const g = c.getContext('2d'); g.fillStyle = '#1b1726'; g.fillRect(0, 0, c.width, c.height);
      imgs.forEach((im, k) => g.drawImage(im, pad + (k % cols) * (cw + pad) + (cw - im.width) / 2, pad + Math.floor(k / cols) * (ch + pad) + (ch - im.height) / 2));
      return c.toDataURL('image/png').split(',')[1];
    })(${JSON.stringify(sheet.map((s) => s.png))})`);
    fs.writeFileSync(path.join(OUT, 'sheet.png'), Buffer.from(png, 'base64'));
    console.log(`previews: ${OUT}`);
  } catch (e) {
    console.error(e);
    code = 1;
  }
  app.exit(code);
});
