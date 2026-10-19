'use strict';
// Builds src/renderer/frames/vector/<id>.svg and src/catalog/frames-vector.json from tools/vectorart/frames/*.js.
//   node tools/vectorart/build.js [id ...]
// Preview one frame without touching the catalog: npx electron tools/shells/preview.cjs <id>
const fs = require('fs');
const path = require('path');
const { frameSvg } = require('./lib');

const ROOT = path.resolve(__dirname, '..', '..');
const OUT_SVG = path.join(ROOT, 'src', 'renderer', 'frames', 'vector');
const OUT_JSON = path.join(ROOT, 'src', 'catalog', 'frames-vector.json');
const ORDER = ['vx-sakura-handheld', 'vx-magical-compact', 'vx-mecha-hud', 'vx-cozy-wood-tv', 'vx-neko-tv', 'vx-synthwave', 'vx-ufo-pet', 'vx-gallery',
  'vx-cloud-pal', 'vx-mochi-bunny', 'vx-flip-clam', 'vx-handheld-pc', 'vx-gacha-globe', 'vx-claw-crane', 'vx-star-pinball', 'vx-photo-booth',
  'vx-space-station', 'vx-candy-house',
  // Sci-Fi Signals, Old Masters, Legends & Dread, Wild & Tuneful, Curio Cabinet
  'vx-saucer-beam', 'vx-bot-buddy', 'vx-neon-oni', 'vx-toxic-drip',
  'vx-chateau-gilt', 'vx-nouveau-bloom', 'vx-marble-atrium', 'vx-hanging-scroll',
  'vx-elven-arch', 'vx-dwarven-gate', 'vx-gothic-reliquary', 'vx-demon-crown',
  'vx-terrarium', 'vx-great-wave', 'vx-analog-synth', 'vx-pipe-organ',
  'vx-shark-diver', 'vx-apothecary', 'vx-chalkboard-club', 'vx-samurai-brocade'];
// Coin prices per id (shells not listed are level rewards in src/catalog/levels.json).
const coinPrice = (c) => (Number.isInteger(c) && c > 0 ? { coins: c } : null);
const PRICES = (() => { try { return require('../shells/pricing.json'); } catch { return {}; } })();
// Particles + screen glass per id (tools/shells/fx.json).
const FX = (() => { try { return require('../shells/fx.json'); } catch { return {}; } })();
const r6 = (v) => +v.toFixed(6);

/** Catalog FrameItem for a frame module. Optional meta: price (coins), license, collection. */
function item(f) {
  const { W, H, hole: h, radius = 0, meta } = f;
  return {
    id: f.id, name: meta.name, kind: 'frame', style: 'vector', theme: meta.theme, rarity: meta.rarity,
    price: coinPrice(PRICES[f.id] ?? meta.price), unlockLevel: null,
    file: `frames/vector/${f.id}.svg`, size: { w: W, h: H },
    hole: { x: r6(h.x / W), y: r6(h.y / H), w: r6(h.w / W), h: r6(h.h / H) }, holeRadius: r6(radius / h.w), aspect: r6(h.w / h.h),
    translucent: !!meta.translucent, author: 'Kayboro', desc: meta.desc, tags: meta.tags,
    ...(meta.license ? { license: meta.license } : {}), ...(meta.collection ? { collection: meta.collection } : {}),
    ...(FX[f.id] ? { fx: FX[f.id] } : {}),
  };
}

/** The frame SVG markup for a frame module. */
function svgOf(f) {
  const { defs, body } = f.draw();
  return frameSvg({ id: f.id, W: f.W, H: f.H, hole: f.hole, radius: f.radius || 0, defs, body });
}

const load = (id) => ({ id, ...require(`./frames/${id}.js`) });

if (require.main === module) {
  const only = process.argv.slice(2);
  fs.mkdirSync(OUT_SVG, { recursive: true });
  const frames = ORDER.filter((id) => fs.existsSync(path.join(__dirname, 'frames', `${id}.js`))).map(load);
  for (const f of frames) {
    if (only.length && !only.includes(f.id)) continue;
    const svg = svgOf(f);
    fs.writeFileSync(path.join(OUT_SVG, `${f.id}.svg`), svg);
    console.log(`${f.id}.svg  ${(svg.length / 1024).toFixed(1)} KB`);
  }
  fs.writeFileSync(OUT_JSON, `{\n  "frames": [\n${frames.map((f) => `    ${JSON.stringify(item(f))}`).join(',\n')}\n  ]\n}\n`);
}

module.exports = { ORDER, item, svgOf, load };
