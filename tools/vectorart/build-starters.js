'use strict';
// Builds the built-in starter shells: tools/vectorart/starters/<id>.js -> src/renderer/frames/<id>.svg.
//   node tools/vectorart/build-starters.js [id ...]
// Starters are not catalog items: their geometry lives in src/renderer/frames/frames.js (STARTERS) and
// src/main/economy/catalog.js (STARTERS). This prints the def(...) line both files need for each starter,
// and test/starters.test.js checks the two stay in sync with the SVGs.
// Preview one without touching anything: npx electron tools/shells/preview.cjs <id>
const fs = require('fs');
const path = require('path');
const { frameSvg } = require('./lib');

const ROOT = path.resolve(__dirname, '..', '..');
const OUT = path.join(ROOT, 'src', 'renderer', 'frames');
const STARTER_IDS = ['crt-tv', 'virtual-pet', 'handheld', 'arcade', 'bezel', 'pocket-brick', 'wide-pocket', 'split-pad', 'sleek-portable',
  'plain-bezel', 'plain-handheld', 'plain-tv'];

const load = (id) => ({ id, ...require(`./starters/${id}.js`) });
const svgOf = (f) => { const { defs, body } = f.draw(); return frameSvg({ id: f.id, W: f.W, H: f.H, hole: f.hole, radius: f.radius || 0, defs, body }); };
/** Catalog-shaped item for the preview tool (starters are free, built in and never priced). */
const item = (f) => ({
  id: f.id, name: f.meta.name, kind: 'frame', style: 'vector', theme: f.meta.theme || 'classic', rarity: 'common', price: null, unlockLevel: null,
  file: `frames/${f.id}.svg`, size: { w: f.W, h: f.H }, hole: { x: f.hole.x / f.W, y: f.hole.y / f.H, w: f.hole.w / f.W, h: f.hole.h / f.H },
  holeRadius: (f.radius || 0) / f.hole.w, aspect: f.hole.w / f.hole.h, translucent: !!f.meta.translucent, author: 'Kayboro',
  desc: f.meta.desc, tags: f.meta.tags || ['starter'], starter: true,
});
const defLine = (f) => `def('${f.id}', '${f.meta.name}', ${f.W}, ${f.H}, ${f.hole.x}, ${f.hole.y}, ${f.hole.w}, ${f.hole.h}, ${+(f.radius || 0)}, ${!!f.meta.translucent})`;

if (require.main === module) {
  const only = process.argv.slice(2);
  for (const id of STARTER_IDS) {
    if (only.length && !only.includes(id)) continue;
    if (!fs.existsSync(path.join(__dirname, 'starters', `${id}.js`))) { console.log(`${id}: no module yet, kept the old SVG`); continue; }
    const f = load(id), svg = svgOf(f);
    fs.writeFileSync(path.join(OUT, `${id}.svg`), svg);
    console.log(`${id}.svg  ${(svg.length / 1024).toFixed(1)} KB  ${defLine(f)}`);
  }
}

module.exports = { STARTER_IDS, load, svgOf, item, defLine };
