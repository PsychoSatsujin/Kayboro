'use strict';
// Builds the Kayboro brand assets and app icons from the code in this folder (Electron, no deps):
//
//   npx electron tools/brand/build.cjs [--out=DIR] [--no-html]
//
// Writes (relative to the repo, or DIR):
//   assets/brand/kayboro-mark.svg              vector mark (Kay peeking out of a pink CRT), 1024 box
//   assets/brand/kayboro-mark-pixel.svg        16 px pixel mark (crispEdges); -24 and -32 variants too
//   assets/brand/kayboro-wordmark.svg          "KAYBORO" in pixel letters (rects, no fonts)
//   assets/brand/kayboro-lockup.svg            mark + wordmark; kayboro-lockup-stacked.svg centred
//   assets/brand/kayboro-mascot.svg            Kay waving; kayboro-mascot-sheet.svg = four poses + the mark
//   assets/brand/*.png                         PNG renders of the above, plus sizes.png (mark at 16..256 on dark/light)
//   build/icon.ico                             16, 24, 32 (pixel marks) + 48, 64, 128, 256 (vector), PNG entries
//   build/icon.png                             1024 x 1024 vector mark (electron-builder buildResources)
//   src/renderer/assets/icon.png               256 x 256 runtime window icon
// and, unless --no-html, replaces the <symbol id="i-logo"> (16 px) and <symbol id="i-logo-24"> sprites in
// src/renderer/index.html with the pixel marks (the HUD uses -24 at 1:1, the empty stage uses the 16 at 4x).
// Everything is deterministic: same code in, same bytes out.

const fs = require('fs');
const path = require('path');
const { run } = require('./render.cjs');
const { ico } = require('./ico.cjs');
const A = require('./art.cjs');
const M = require('./marks.cjs');

const ROOT = path.resolve(__dirname, '..', '..');
const argv = process.argv.slice(process.argv.findIndex((a) => a.endsWith('build.cjs')) + 1);
const flag = (k) => { const a = argv.find((x) => x.startsWith(`--${k}=`)); return a ? a.slice(k.length + 3) : null; };
const OUT = path.resolve(flag('out') || ROOT);
const HTML = !argv.includes('--no-html');

const write = (rel, data) => { const f = path.join(OUT, rel); fs.mkdirSync(path.dirname(f), { recursive: true }); fs.writeFileSync(f, data); console.log(`  ${rel}  ${(data.length / 1024).toFixed(1)} KB`); };
const dim = (s) => s.match(/width="(\d+)" height="(\d+)"/).slice(1).map(Number);
const b64 = (s) => Buffer.from(s).toString('base64');

/** The mark at every icon size: pixel grids where they exist, the vector mark above 32 px. */
const markAt = (n) => (M.GRIDS[n] ? M.gridSvg(n) : A.markSvg());

/** Contact sheet: marks at 16..256 on dark and light, pixel sizes drawn 1:1 (for docs/BRAND.md and review). */
function sizesSheet() {
  const sizes = [16, 24, 32, 48, 64, 128, 256], pad = 24;
  let x = pad, parts = '';
  for (const n of sizes) {
    const im = (y) => `<image href="data:image/svg+xml;base64,${b64(markAt(n))}" x="${x}" y="${y}" width="${n}" height="${n}"/>`;
    parts += im(pad + 256 - n) + im(pad * 3 + 512 - n); x += n + pad;
  }
  return { svg: `<svg xmlns="http://www.w3.org/2000/svg" width="${x}" height="${pad * 4 + 512}"><rect width="${x}" height="${pad * 2 + 256}" fill="#0f0d16"/><rect y="${pad * 2 + 256}" width="${x}" height="${pad * 2 + 256}" fill="#f3f1f7"/>${parts}</svg>`, w: x, h: pad * 4 + 512 };
}

/** Swap the i-logo sprites in index.html for the current pixel marks (idempotent). */
function patchHtml() {
  const file = path.join(ROOT, 'src', 'renderer', 'index.html');
  let html = fs.readFileSync(file, 'utf8');
  // i-logo (16: the empty-stage mark at 4x) and i-logo-24 (the HUD at 1:1); the 32 px grid only goes into the icons.
  const symbols = [16, 24].map((n) => `<symbol id="i-logo${n === 16 ? '' : `-${n}`}" viewBox="0 0 ${n} ${n}" shape-rendering="crispEdges">${M.spritePaths(n)}</symbol>`).join('\n');
  const re = /<symbol id="i-logo(?:-\d+)?" viewBox="0 0 \d+ \d+"[^>]*>.*?<\/symbol>(?:\r?\n)?/gs;
  const hits = html.match(re) || [];
  if (!hits.length) throw new Error('index.html has no <symbol id="i-logo"> to replace');
  let first = true;
  html = html.replace(re, () => { const r = first ? `${symbols}\n` : ''; first = false; return r; });
  fs.writeFileSync(file, html);
  console.log(`  src/renderer/index.html  i-logo sprites (${hits.length} -> 2)`);
}

run(async (r) => {
  console.log(`brand -> ${OUT}`);
  // A. source SVGs
  const svgs = {
    'kayboro-mark.svg': A.markSvg(), 'kayboro-mark-pixel.svg': M.gridSvg(16), 'kayboro-mark-pixel-24.svg': M.gridSvg(24), 'kayboro-mark-pixel-32.svg': M.gridSvg(32),
    'kayboro-wordmark.svg': A.wordmarkSvg(), 'kayboro-lockup.svg': A.lockupSvg(), 'kayboro-lockup-stacked.svg': A.lockupSvg({ stacked: true }),
    'kayboro-mascot.svg': A.mascotSvg('wave'), 'kayboro-mascot-sheet.svg': A.poseSheetSvg(),
  };
  for (const [name, svg] of Object.entries(svgs)) write(path.join('assets', 'brand', name), svg);
  // PNG renders (transparent, at a handy size)
  const png = async (name, svg, maxW, o = {}) => { const [w, h] = dim(svg), k = Math.min(1, maxW / w); write(path.join('assets', 'brand', name), await r.raster(svg, Math.round(w * k), Math.round(h * k), o)); };
  await png('kayboro-mark-512.png', svgs['kayboro-mark.svg'], 512);
  await png('kayboro-mark-pixel-x8.png', M.gridSvg(16, 8), 128, { smooth: false });
  await png('kayboro-wordmark.png', svgs['kayboro-wordmark.svg'], 1008);
  await png('kayboro-lockup.png', svgs['kayboro-lockup.svg'], 1600);
  await png('kayboro-lockup-stacked.png', svgs['kayboro-lockup-stacked.svg'], 1024);
  await png('kayboro-mascot-512.png', svgs['kayboro-mascot.svg'], 512);
  await png('kayboro-mascot-sheet.png', svgs['kayboro-mascot-sheet.svg'], 2560);
  const sh = sizesSheet(); write(path.join('assets', 'brand', 'sizes.png'), await r.raster(sh.svg, sh.w, sh.h));
  // C. icons
  const entries = [];
  for (const n of [16, 24, 32, 48, 64, 128, 256]) entries.push({ size: n, png: await r.raster(markAt(n), n, n, { smooth: n > 32 }) });
  write(path.join('build', 'icon.ico'), ico(entries));
  write(path.join('build', 'icon.png'), await r.raster(A.markSvg(), 1024, 1024));
  write(path.join('src', 'renderer', 'assets', 'icon.png'), entries.find((e) => e.size === 256).png);
  // D. in-app sprite
  if (HTML && OUT === ROOT) patchHtml();
});
