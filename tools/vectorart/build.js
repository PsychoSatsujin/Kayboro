'use strict';
// Builds src/renderer/frames/vector/<id>.svg and src/catalog/frames-vector.json from tools/vectorart/frames/*.js.
//   node tools/vectorart/build.js [id ...]
const fs = require('fs');
const path = require('path');
const { frameSvg } = require('./lib');

const ROOT = path.resolve(__dirname, '..', '..');
const OUT_SVG = path.join(ROOT, 'src', 'renderer', 'frames', 'vector');
const OUT_JSON = path.join(ROOT, 'src', 'catalog', 'frames-vector.json');
const ORDER = ['vx-sakura-handheld', 'vx-magical-compact', 'vx-mecha-hud', 'vx-cozy-wood-tv', 'vx-neko-tv', 'vx-synthwave', 'vx-ufo-pet', 'vx-gallery'];
const r6 = (v) => +v.toFixed(6);

function item(f) {
  const { W, H, hole: h, radius = 0, meta } = f;
  return {
    id: f.id, name: meta.name, kind: 'frame', style: 'vector', theme: meta.theme, rarity: meta.rarity, price: null, unlockLevel: null,
    file: `frames/vector/${f.id}.svg`, size: { w: W, h: H },
    hole: { x: r6(h.x / W), y: r6(h.y / H), w: r6(h.w / W), h: r6(h.h / H) }, holeRadius: r6(radius / h.w), aspect: r6(h.w / h.h),
    translucent: !!meta.translucent, author: 'Shellcade', desc: meta.desc, tags: meta.tags,
  };
}

const only = process.argv.slice(2);
fs.mkdirSync(OUT_SVG, { recursive: true });
const frames = ORDER.filter((id) => fs.existsSync(path.join(__dirname, 'frames', `${id}.js`))).map((id) => ({ id, ...require(`./frames/${id}.js`) }));
for (const f of frames) {
  if (only.length && !only.includes(f.id)) continue;
  const { defs, body } = f.draw();
  const svg = frameSvg({ id: f.id, W: f.W, H: f.H, hole: f.hole, radius: f.radius || 0, defs, body });
  fs.writeFileSync(path.join(OUT_SVG, `${f.id}.svg`), svg);
  console.log(`${f.id}.svg  ${(svg.length / 1024).toFixed(1)} KB`);
}
fs.writeFileSync(OUT_JSON, `{\n  "frames": [\n${frames.map((f) => `    ${JSON.stringify(item(f))}`).join(',\n')}\n  ]\n}\n`);
