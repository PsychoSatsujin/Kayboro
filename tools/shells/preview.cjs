'use strict';
// Preview and check one or more shells without touching the shipped catalog (Electron, no deps):
//
//   npx electron tools/shells/preview.cjs [--out=DIR] [--crop=x,y,w,h] [--sheet] id [id ...]
//
// Each id is built from tools/vectorart/frames/<id>.js or tools/pixelart/frames/<id>.mjs exactly like the
// real builds (tools/vectorart/build.js, tools/pixelart/build.mjs), linted against the rules the frame unit
// tests enforce, then rasterized at 1x and checked: nothing opaque inside the opening, a solid ring around
// it, and the transparent region around its center spans exactly the hole (the shell encloses the screen).
// Writes to DIR (default <repo>/.preview/, git-ignored):
//   <id>.svg, <id>.json  the built frame and its catalog item
//   <id>.png             checkerboard | dark stage with a mock game | (translucent) clear shell over a fill
//   <id>-crop.png        with --crop: that region (frame units) magnified, on the stage
//   sheet.png            with --sheet: every previewed shell on the stage, 4 per row
// Exit code 1 if any shell FAILs; WARN lines are worth fixing but do not fail.
const { app, BrowserWindow } = require('electron');
const fs = require('fs');
const path = require('path');
const { pathToFileURL } = require('url');

const ROOT = path.resolve(__dirname, '..', '..');
const argv = process.argv.slice(process.argv.findIndex((a) => a.endsWith('preview.cjs')) + 1);
const flag = (k) => { const a = argv.find((x) => x.startsWith(`--${k}=`)); return a ? a.slice(k.length + 3) : null; };
const OUT = path.resolve(flag('out') || path.join(ROOT, '.preview'));
const CROP = flag('crop');
const SHEET = argv.includes('--sheet');
const IDS = argv.filter((a) => !a.startsWith('--'));
const RARITY = ['common', 'rare', 'epic', 'legendary'];
const ASPECTS = [[16, 9], [16, 10], [21, 9], [3, 2], [4, 3], [5, 4], [10, 9], [1, 1], [9, 16], [3, 4]];

app.commandLine.appendSwitch('force-device-scale-factor', '1');
app.disableHardwareAcceleration();
// Keep Electron's profile (caches, local storage) next to the output, not in %APPDATA%\Electron on the system drive.
app.setPath('userData', path.join(OUT, 'electron-profile'));

/** Build one shell the way the real build does: { style, svg, item, problems }. */
async function build(id) {
  const st = path.join(ROOT, 'tools', 'vectorart', 'starters', `${id}.js`);
  if (fs.existsSync(st)) { // built-in starter shells (tools/vectorart/build-starters.js)
    const sb = require('../vectorart/build-starters.js');
    const f = sb.load(id);
    return { style: 'vector', starter: true, svg: sb.svgOf(f), item: sb.item(f), problems: [] };
  }
  const vx = path.join(ROOT, 'tools', 'vectorart', 'frames', `${id}.js`);
  const px = path.join(ROOT, 'tools', 'pixelart', 'frames', `${id}.mjs`);
  if (fs.existsSync(vx)) {
    const vb = require('../vectorart/build.js');
    const f = vb.load(id);
    return { style: 'vector', svg: vb.svgOf(f), item: vb.item(f), problems: [] };
  }
  if (fs.existsSync(px)) {
    const pb = await import(pathToFileURL(path.join(ROOT, 'tools', 'pixelart', 'build.mjs')).href);
    const f = (await import(pathToFileURL(px).href)).default;
    if (!f || f.id !== id) throw new Error(`${path.basename(px)} must export default { id: '${id}', ... }`);
    const cv = f.draw();
    if (!cv || !cv.hole) throw new Error('no hole punched: end draw() with `return cv.punch(x, y, w, h, r)`');
    const bad = pb.checkRim(cv);
    return { style: 'pixel', svg: cv.toSVG(f.css || ''), item: pb.entry(f, cv),
      problems: bad.length ? [`rim not opaque at ${bad.slice(0, 5).map((p) => p.join(',')).join(' ')}${bad.length > 5 ? ` (+${bad.length - 5})` : ''}`] : [] };
  }
  throw new Error(`no tools/vectorart/starters/${id}.js, tools/vectorart/frames/${id}.js or tools/pixelart/frames/${id}.mjs`);
}

/** Ids already used by the shipped catalog, mapped to their file (or kind). */
function catalogIds() {
  const dir = path.join(ROOT, 'src', 'catalog'), out = new Map();
  for (const name of fs.readdirSync(dir).filter((n) => n.endsWith('.json'))) {
    try {
      const d = JSON.parse(fs.readFileSync(path.join(dir, name), 'utf8'));
      for (const list of Object.values(d)) if (Array.isArray(list)) for (const it of list) if (it && typeof it.id === 'string') out.set(it.id, it.file || name);
    } catch {}
  }
  return out;
}

/** Static checks mirroring test/frames-vector.test.js and test/frames-pixel.test.js. */
function lint(id, { style, svg, item: f }, known) {
  const problems = [], warnings = [], { w: W, h: H } = f.size, { x, y, w, h } = f.hole;
  const starter = !!arguments[1].starter;
  if (!starter && (!/^(vx|px)-[a-z0-9]+(?:-[a-z0-9]+)*$/.test(id) || id.length > 64)) problems.push(`id "${id}" must be vx-/px- + lowercase words`);
  if (style === 'vector' && !starter && !id.startsWith('vx-')) problems.push('vector shell ids start with vx-');
  if (style === 'pixel' && !id.startsWith('px-')) problems.push('pixel shell ids start with px-');
  if (!starter && known.has(id) && known.get(id) !== f.file) problems.push(`id clashes with ${known.get(id)}`);
  for (const k of ['name', 'theme']) if (!(typeof f[k] === 'string' && f[k])) problems.push(`missing ${k}`);
  if (!Array.isArray(f.tags) || !f.tags.length) problems.push('missing tags');
  if (!RARITY.includes(f.rarity)) problems.push(`rarity must be one of ${RARITY.join('/')}`);
  if (!(typeof f.desc === 'string' && f.desc)) (style === 'vector' ? problems : warnings).push('missing desc (one playful sentence for the shop card)');
  if (!Number.isInteger(W) || !Number.isInteger(H)) problems.push('size must be whole numbers');
  if (!(x > 0 && y > 0 && w > 0 && h > 0 && x + w < 1 && y + h < 1)) problems.push('hole must sit strictly inside the frame');
  if (Math.abs(f.aspect - (w * W) / (h * H)) > 1e-4) problems.push('aspect does not match the hole');
  if (!(f.holeRadius >= 0 && f.holeRadius <= 0.5)) problems.push('holeRadius out of range');
  const root = (svg.match(/<svg\b[^>]*>/) || [''])[0];
  if (!root.includes(`viewBox="0 0 ${W} ${H}"`) || !root.includes(`width="${W}" height="${H}"`)) problems.push('svg viewBox/size differ from the item');
  if (svg.length > 200 * 1024) problems.push(`svg is ${(svg.length / 1024).toFixed(0)} KB (keep under 200 KB)`);
  else if (svg.length > 150 * 1024) warnings.push(`svg is ${(svg.length / 1024).toFixed(0)} KB (limit 200 KB)`);
  if (style === 'vector') {
    if (/<script|<foreignObject|<image|<text|xlink:href|href=|@import|https?:\/\/(?!www\.w3\.org\/2000\/svg)/i.test(svg)) problems.push('not self-contained: no script, foreignObject, image, text, href, @import or URLs');
    const ids = [...svg.matchAll(/\bid="([^"]+)"/g)].map((m) => m[1]);
    const dup = ids.filter((v, i) => ids.indexOf(v) !== i);
    if (dup.length) problems.push(`duplicate ids: ${[...new Set(dup)].join(', ')}`);
    for (const [, ref] of svg.matchAll(/url\(#([^)]+)\)/g)) if (!ids.includes(ref)) problems.push(`url(#${ref}) is not defined`);
  } else {
    if (/href|url\(|https?:|<script|@import/i.test(svg.replace('xmlns="http://www.w3.org/2000/svg"', ''))) problems.push('not self-contained');
    if (!/shape-rendering="crispEdges"/.test(svg)) problems.push('missing crispEdges');
    if (W < 160 || W > 320) problems.push(`logical width ${W} must be 160..320`);
    for (const [k, v] of [['hole.x', x * W], ['hole.y', y * H], ['hole.w', w * W], ['hole.h', h * H], ['radius', f.holeRadius * w * W]])
      if (Math.abs(v - Math.round(v)) > 1e-9) problems.push(`${k} ${v} is not a whole pixel`);
    const r = Math.round(f.holeRadius * w * W);
    if (r >= Math.min(w * W, h * H) / 4) problems.push(`hole radius ${r} must be < min(w,h)/4`);
    if (/fill-opacity/.test(svg) !== !!f.translucent) problems.push(f.translucent ? 'translucent but no see-through pixels (use alpha())' : 'has see-through pixels: set translucent: true');
    if ([...svg.matchAll(/ d="([^"]*)"/g)].some((m) => m[1].replace(/M\d+ \d+h\d+v\d+h-\d+z/g, ''))) problems.push('path data must be rects only');
  }
  const a = ASPECTS.find(([p, q]) => Math.abs(f.aspect - p / q) < 1e-6);
  return { problems, warnings, aspect: a ? `${a[0]}:${a[1]}` : f.aspect.toFixed(4) };
}

// Runs inside the page (serialized), so it must not close over anything.
async function job({ svg, f, pixel, crop, sheetPx }) {
  const img = new Image();
  img.src = 'data:image/svg+xml;base64,' + btoa(unescape(encodeURIComponent(svg)));
  await img.decode();
  const W = f.size.w, H = f.size.h, mk = (w, h) => Object.assign(document.createElement('canvas'), { width: w, height: h });
  const c1 = mk(W, H), g1 = c1.getContext('2d', { willReadFrequently: true });
  g1.drawImage(img, 0, 0, W, H);
  const d = g1.getImageData(0, 0, W, H).data, A = (x, y) => d[(y * W + x) * 4 + 3];
  const hx = f.hole.x * W, hy = f.hole.y * H, hw = f.hole.w * W, hh = f.hole.h * H, r = f.holeRadius * hw;
  let leaks = 0, ringBad = 0, ringN = 0, ringMin = 255, opaque = 0;
  const ring = (al) => { ringN++; ringMin = Math.min(ringMin, al); if (al < (pixel ? 255 : 250)) ringBad++; };
  if (pixel) {
    const X = Math.round(hx), Y = Math.round(hy), w = Math.round(hw), h = Math.round(hh), R = Math.round(r);
    const cuts = Array.from({ length: R }, (_, i) => Math.ceil(R - Math.sqrt(R * R - (R - i) ** 2) - 1e-9));
    for (let j = 0; j < h; j++) {
      const b = h - 1 - j, a = Math.max(j < R ? cuts[j] : 0, b < R ? cuts[b] : 0);
      for (let i = a; i < w - a; i++) if (A(X + i, Y + j) !== 0) leaks++;
    }
    for (let i = X; i < X + w; i++) for (const j of [Y - 1, Y + h]) ring(A(i, j));
    for (let j = Y; j < Y + h; j++) for (const i of [X - 1, X + w]) ring(A(i, j));
  } else {
    // signed distance to the rounded opening (negative inside)
    const sd = (px, py) => { const qx = Math.abs(px - (hx + hw / 2)) - (hw / 2 - r), qy = Math.abs(py - (hy + hh / 2)) - (hh / 2 - r);
      return Math.hypot(Math.max(qx, 0), Math.max(qy, 0)) + Math.min(Math.max(qx, qy), 0) - r; };
    for (let py = Math.max(0, Math.floor(hy) - 6); py < Math.min(H, Math.ceil(hy + hh) + 6); py++)
      for (let px = Math.max(0, Math.floor(hx) - 6); px < Math.min(W, Math.ceil(hx + hw) + 6); px++) {
        const dd = sd(px + 0.5, py + 0.5), al = A(px, py);
        if (dd < -1.5 && al > 0) leaks++;
        else if (dd > 1.5 && dd < 4.5) ring(al);
      }
  }
  for (let i = 3; i < d.length; i += 4) if (d[i] > 200) opaque++;
  // The transparent region around the opening's center must be exactly the opening.
  const seen = new Uint8Array(W * H), st = [Math.floor(hy + hh / 2) * W + Math.floor(hx + hw / 2)];
  let x0 = W, y0 = H, x1 = -1, y1 = -1;
  while (st.length) {
    const i = st.pop(), x = i % W, y = (i - x) / W;
    if (seen[i] || d[i * 4 + 3] >= 16) continue;
    seen[i] = 1; x0 = Math.min(x0, x); x1 = Math.max(x1, x); y0 = Math.min(y0, y); y1 = Math.max(y1, y);
    if (x > 0) st.push(i - 1); if (x < W - 1) st.push(i + 1); if (y > 0) st.push(i - W); if (y < H - 1) st.push(i + W);
  }
  const flood = { x: x0, y: y0, w: x1 - x0 + 1, h: y1 - y0 + 1 }, tol = pixel ? 0 : 2;
  const floodOk = x1 >= 0 && Math.abs(x0 - hx) <= tol && Math.abs(y0 - hy) <= tol && Math.abs(x1 + 1 - (hx + hw)) <= tol && Math.abs(y1 + 1 - (hy + hh)) <= tol;

  // Previews.
  const game = (g, x, y, w, h) => {
    const sky = g.createLinearGradient(0, y, 0, y + h);
    sky.addColorStop(0, '#4aa8ff'); sky.addColorStop(0.65, '#b8ecff'); sky.addColorStop(0.66, '#5cc85c'); sky.addColorStop(1, '#2f8a3c');
    g.fillStyle = sky; g.fillRect(x, y, w, h);
    g.fillStyle = '#fff4a8'; g.beginPath(); g.arc(x + w * 0.78, y + h * 0.22, h * 0.09, 0, 7); g.fill();
    g.fillStyle = '#ffffff'; for (const [u, v] of [[0.2, 0.2], [0.5, 0.3]]) g.fillRect(x + w * u, y + h * v, w * 0.14, h * 0.05);
    g.fillStyle = '#d0452f'; g.fillRect(x + w * 0.3, y + h * 0.55, w * 0.05, h * 0.11);
  };
  const stage = (g, w, h) => { const bg = g.createLinearGradient(0, 0, w, h); bg.addColorStop(0, '#1d1530'); bg.addColorStop(1, '#0f0d16'); g.fillStyle = bg; g.fillRect(0, 0, w, h); };
  const fill = (g, w, h) => { // a "shell fill" glowing through translucent plastic
    const bg = g.createLinearGradient(0, 0, 0, h); bg.addColorStop(0, '#120b2e'); bg.addColorStop(1, '#2a1250'); g.fillStyle = bg; g.fillRect(0, 0, w, h);
    let seed = 7; const rnd = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);
    for (let i = 0; i < 260; i++) { g.fillStyle = rnd() < 0.3 ? '#7af0ff' : '#ffffff'; const z = (rnd() < 0.15 ? 2 : 1) * Math.max(1, w / 400); g.fillRect(rnd() * w | 0, rnd() * h | 0, z, z); }
  };
  const scene = (s, translucent) => { // stage + (fill) + game + frame at scale s
    const w = Math.round(W * s), h = Math.round(H * s), c = mk(w, h), g = c.getContext('2d');
    g.imageSmoothingEnabled = !pixel; stage(g, w, h);
    if (translucent) { const fl = mk(w, h), gl = fl.getContext('2d'); fill(gl, w, h); gl.globalCompositeOperation = 'destination-in'; gl.imageSmoothingEnabled = !pixel; gl.drawImage(img, 0, 0, w, h); g.drawImage(fl, 0, 0); }
    game(g, hx * s, hy * s, hw * s, hh * s); g.drawImage(img, 0, 0, w, h);
    return c;
  };
  const s = pixel ? 3 : Math.min(1, 720 / Math.max(W, H)), fw = Math.round(W * s), fh = Math.round(H * s), pad = 24;
  const panels = f.translucent ? 3 : 2, out = mk(panels * fw + (panels - 1) * pad, fh), g = out.getContext('2d');
  g.imageSmoothingEnabled = !pixel;
  const t = pixel ? 4 * s : 16;
  for (let y = 0; y < fh; y += t) for (let x = 0; x < fw; x += t) { g.fillStyle = ((x + y) / t) % 2 ? '#d9d6e4' : '#a9a5bb'; g.fillRect(x, y, t, t); }
  g.drawImage(img, 0, 0, fw, fh);
  g.drawImage(scene(s, false), fw + pad, 0);
  if (f.translucent) g.drawImage(scene(s, true), 2 * (fw + pad), 0);
  let cropPng = null;
  if (crop) {
    const [cx, cy, cw, ch] = crop, k = pixel ? 8 : 2, big = scene(k, f.translucent), c = mk(Math.round(cw * k), Math.round(ch * k)), gc = c.getContext('2d');
    gc.drawImage(big, -cx * k, -cy * k); cropPng = c.toDataURL('image/png').split(',')[1];
  }
  let sheetCell = null;
  if (sheetPx) {
    const k = pixel ? Math.max(1, Math.floor(sheetPx / Math.max(W, H))) : sheetPx / Math.max(W, H);
    sheetCell = scene(k, f.translucent).toDataURL('image/png').split(',')[1];
  }
  return { leaks, ringBad, ringN, ringMin, floodOk, flood, opaquePct: +(100 * opaque / (W * H)).toFixed(1),
    png: out.toDataURL('image/png').split(',')[1], cropPng, sheetCell };
}

// Contact sheet (page side): cells with an id caption under each, 4 per row.
async function sheetJob(items) {
  const imgs = await Promise.all(items.map(async (it) => { const i = new Image(); i.src = 'data:image/png;base64,' + it.png; await i.decode(); return { i, id: it.id }; }));
  const cols = Math.min(4, imgs.length), rows = Math.ceil(imgs.length / cols), pad = 28, cap = 26;
  const cw = Math.max(...imgs.map((x) => x.i.width)), ch = Math.max(...imgs.map((x) => x.i.height));
  const c = Object.assign(document.createElement('canvas'), { width: cols * (cw + pad) + pad, height: rows * (ch + cap + pad) + pad });
  const g = c.getContext('2d'); g.fillStyle = '#17141f'; g.fillRect(0, 0, c.width, c.height);
  g.font = '600 15px system-ui, sans-serif'; g.textAlign = 'center'; g.fillStyle = '#eee9ff';
  imgs.forEach(({ i, id }, k) => {
    const x = pad + (k % cols) * (cw + pad), y = pad + Math.floor(k / cols) * (ch + cap + pad);
    g.imageSmoothingEnabled = false; g.drawImage(i, x + (cw - i.width) / 2, y + (ch - i.height) / 2);
    g.fillText(id, x + cw / 2, y + ch + 19);
  });
  return c.toDataURL('image/png').split(',')[1];
}

app.whenReady().then(async () => {
  let code = 0;
  try {
    if (!IDS.length) throw new Error('usage: npx electron tools/shells/preview.cjs [--out=DIR] [--crop=x,y,w,h] [--sheet] id [id ...]');
    const crop = CROP ? CROP.split(',').map(Number) : null;
    if (crop && (crop.length !== 4 || crop.some((v) => !Number.isFinite(v)) || crop[2] <= 0 || crop[3] <= 0)) throw new Error('--crop=x,y,w,h in frame units');
    fs.mkdirSync(OUT, { recursive: true });
    const win = new BrowserWindow({ show: false, width: 800, height: 600, webPreferences: { offscreen: true } });
    await win.loadURL('data:text/html,<body></body>');
    const known = catalogIds(), cells = [];
    for (const id of IDS) {
      try {
        const b = await build(id), f = b.item, pixel = b.style === 'pixel';
        const { problems, warnings, aspect } = lint(id, b, known);
        problems.unshift(...b.problems);
        fs.writeFileSync(path.join(OUT, `${id}.svg`), b.svg);
        fs.writeFileSync(path.join(OUT, `${id}.json`), `${JSON.stringify(f, null, 2)}\n`);
        const r = await win.webContents.executeJavaScript(`(${job})(${JSON.stringify({ svg: b.svg, f, pixel, crop, sheetPx: SHEET ? 360 : 0 })})`);
        fs.writeFileSync(path.join(OUT, `${id}.png`), Buffer.from(r.png, 'base64'));
        if (r.cropPng) fs.writeFileSync(path.join(OUT, `${id}-crop.png`), Buffer.from(r.cropPng, 'base64'));
        if (r.sheetCell) cells.push({ id, png: r.sheetCell });
        if (r.leaks) problems.push(`${r.leaks} visible px inside the opening`);
        if (!r.floodOk) problems.push(`see-through area ${JSON.stringify(r.flood)} is not the opening: the shell must fully enclose the screen`);
        if (pixel && r.ringBad) problems.push(`${r.ringBad} rim px around the opening are not fully opaque`);
        if (!pixel && r.ringBad > r.ringN * 0.05) warnings.push(`${r.ringBad}/${r.ringN} px of the ring around the opening are not opaque (min alpha ${r.ringMin})`);
        if (r.opaquePct < 15) warnings.push(`only ${r.opaquePct}% of the frame is opaque: does it read as a shell?`);
        const { w: W, h: H } = f.size, hp = (k, t) => Math.round(f.hole[k] * t);
        console.log(`${problems.length ? 'FAIL' : 'PASS'}  ${id}  ${b.style} ${W}x${H}  hole ${hp('w', W)}x${hp('h', H)}@${hp('x', W)},${hp('y', H)} r${+(f.holeRadius * f.hole.w * W).toFixed(2)}  aspect ${aspect}  ${f.rarity}${f.translucent ? ' translucent' : ''}  ${(b.svg.length / 1024).toFixed(1)} KB  opaque ${r.opaquePct}%`);
        for (const p of problems) console.log(`      FAIL ${p}`);
        for (const w of warnings) console.log(`      WARN ${w}`);
        if (problems.length) code = 1;
      } catch (e) {
        code = 1;
        console.log(`FAIL  ${id}: ${e.stack || e.message}`);
      }
    }
    if (cells.length) {
      const png = await win.webContents.executeJavaScript(`(${sheetJob})(${JSON.stringify(cells)})`);
      fs.writeFileSync(path.join(OUT, 'sheet.png'), Buffer.from(png, 'base64'));
    }
    console.log(`out: ${OUT}`);
  } catch (e) {
    console.error(e.message);
    code = 1;
  }
  app.exit(code);
});
