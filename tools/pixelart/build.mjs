#!/usr/bin/env node
// Builds the pixel-art frames: node tools/pixelart/build.mjs [id ...]
// Each tools/pixelart/frames/<id>.mjs draws onto a logical-pixel Canvas; this writes
// src/renderer/frames/pixel/<id>.svg and the matching src/catalog/frames-pixel.json entries.
// Preview + pixel-check the result with tools/pixelart/render.cjs (see its header).
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(HERE, '..', '..');
const OUT = path.join(ROOT, 'src', 'renderer', 'frames', 'pixel');
const JSON_FILE = path.join(ROOT, 'src', 'catalog', 'frames-pixel.json');
export const IDS = ['px-pocket', 'px-crt', 'px-pet-egg', 'px-arcade', 'px-dungeon', 'px-cloud-castle', 'px-cat-monitor', 'px-space-console'];

function entry(f, cv) {
  const { w: W, h: H, hole: o } = cv;
  return {
    id: f.id, name: f.name, kind: 'frame', style: 'pixel', theme: f.theme, rarity: f.rarity, price: null, unlockLevel: null,
    file: `frames/pixel/${f.id}.svg`, size: { w: W, h: H }, hole: { x: o.x / W, y: o.y / H, w: o.w / W, h: o.h / H },
    holeRadius: o.r / o.w, aspect: o.w / o.h, translucent: !!f.translucent, author: 'Shellcade', tags: f.tags,
  };
}

// The ring of pixels hugging the opening must be solid so the hole's bounds are exact.
function checkRim(cv) {
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
