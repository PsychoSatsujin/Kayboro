#!/usr/bin/env node
// Builds the pixel-art frames: node tools/pixelart/build.mjs [id ...]
// Each tools/pixelart/frames/<id>.mjs draws onto a logical-pixel Canvas; this writes
// src/renderer/frames/pixel/<id>.svg and the matching src/catalog/frames-pixel.json entries.
// Preview + pixel-check the result with tools/pixelart/render.cjs (see its header), or preview one
// frame without touching the catalog: npx electron tools/shells/preview.cjs <id>
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(HERE, '..', '..');
const OUT = path.join(ROOT, 'src', 'renderer', 'frames', 'pixel');
const JSON_FILE = path.join(ROOT, 'src', 'catalog', 'frames-pixel.json');
export const IDS = ['px-pocket', 'px-crt', 'px-pet-egg', 'px-arcade', 'px-dungeon', 'px-cloud-castle', 'px-cat-monitor', 'px-space-console',
  'px-dino-pal', 'px-ghost-pet', 'px-pager-pal', 'px-game-watch', 'px-clear-wide', 'px-candy-cab', 'px-racer-cab', 'px-mole-bash',
  'px-cel-crt', 'px-cel-pet', 'px-cel-cyberpunk', 'px-cel-future', 'px-cel-scifi', 'px-cel-steampunk', 'px-cel-analog',
  'px-cel-celestial', 'px-cel-magical', 'px-cel-constellation', 'px-cel-universe',
  'px-forest', 'px-jungle', 'px-desert', 'px-safari', 'px-insects', 'px-animals', 'px-deep-sea', 'px-ocean',
  'px-food-truck', 'px-ramen', 'px-japan-engawa', 'px-kamishibai', 'px-chinese-pavilion', 'px-mongolian-ger', 'px-tung-sahur'];
// Coin prices per id (shells not listed are level rewards in src/catalog/levels.json).
const coinPrice = (c) => (Number.isInteger(c) && c > 0 ? { coins: c } : null);
const PRICES = (() => { try { return JSON.parse(fs.readFileSync(path.join(HERE, '..', 'shells', 'pricing.json'), 'utf8')); } catch { return {}; } })();
// Particles + screen glass per id (tools/shells/fx.json).
const FX = (() => { try { return JSON.parse(fs.readFileSync(path.join(HERE, '..', 'shells', 'fx.json'), 'utf8')); } catch { return {}; } })();

/** Catalog FrameItem for a drawn frame. Optional fields on the module: desc, price (coins), license, collection. */
export function entry(f, cv) {
  const { w: W, h: H, hole: o } = cv;
  return {
    id: f.id, name: f.name, kind: 'frame', style: 'pixel', theme: f.theme, rarity: f.rarity,
    price: coinPrice(PRICES[f.id] ?? f.price), unlockLevel: null,
    file: `frames/pixel/${f.id}.svg`, size: { w: W, h: H }, hole: { x: o.x / W, y: o.y / H, w: o.w / W, h: o.h / H },
    holeRadius: o.r / o.w, aspect: o.w / o.h, translucent: !!f.translucent, author: 'Kayboro', tags: f.tags,
    ...(f.desc ? { desc: f.desc } : {}), ...(f.license ? { license: f.license } : {}), ...(f.collection ? { collection: f.collection } : {}),
    ...(FX[f.id] ? { fx: FX[f.id] } : {}),
  };
}

// The ring of pixels hugging the opening must be solid so the hole's bounds are exact.
export function checkRim(cv) {
  const { x, y, w, h } = cv.hole, bad = [];
  for (let i = x; i < x + w; i++) for (const j of [y - 1, y + h]) if (!/^#[0-9a-f]{6}$/.test(cv.get(i, j) || '')) bad.push([i, j]);
  for (let j = y; j < y + h; j++) for (const i of [x - 1, x + w]) if (!/^#[0-9a-f]{6}$/.test(cv.get(i, j) || '')) bad.push([i, j]);
  return bad;
}

async function main(ids) {
  fs.mkdirSync(OUT, { recursive: true });
  let prev = [];
  try { prev = JSON.parse(fs.readFileSync(JSON_FILE, 'utf8')).frames || []; } catch {}
  const items = new Map(prev.map((f) => [f.id, f]));
  for (const id of ids) {
    const f = (await import(pathToFileURL(path.join(HERE, 'frames', `${id}.mjs`)).href)).default;
    const cv = f.draw();
    if (!cv.hole) throw new Error(`${id}: no hole punched`);
    const bad = checkRim(cv);
    if (bad.length) throw new Error(`${id}: rim not opaque at ${bad.slice(0, 5).map((p) => p.join(',')).join(' ')}`);
    const svg = cv.toSVG(f.css || '');
    fs.writeFileSync(path.join(OUT, `${id}.svg`), svg);
    items.set(id, entry(f, cv));
    console.log(`${id.padEnd(18)} ${cv.w}x${cv.h}  hole ${cv.hole.w}x${cv.hole.h}@${cv.hole.x},${cv.hole.y} r${cv.hole.r}  ${(svg.length / 1024).toFixed(1)} KB`);
  }
  const frames = IDS.filter((id) => items.has(id)).map((id) => items.get(id));
  const json = `{\n  "frames": [\n${frames.map((f) => `    {\n${Object.entries(f).map(([k, v]) => `      ${JSON.stringify(k)}: ${JSON.stringify(v)}`).join(',\n')}\n    }`).join(',\n')}\n  ]\n}\n`;
  fs.writeFileSync(JSON_FILE, json);
}

if (import.meta.url === pathToFileURL(process.argv[1]).href) {
  const ids = process.argv.slice(2);
  const bad = ids.filter((id) => !IDS.includes(id));
  if (bad.length) { console.error(`unknown frame id(s): ${bad.join(', ')}`); process.exit(1); }
  main(ids.length ? ids : IDS).catch((e) => { console.error(e); process.exit(1); });
}
