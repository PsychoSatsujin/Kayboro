#!/usr/bin/env node
// Builds the shell SKINS: node tools/shells/build-skins.mjs [id ...]
// A skin is alternate artwork for one existing shell (its "frame"): same canvas, same opening, same
// see-through-ness, so it swaps in without moving the console. Pixel skins live in
// tools/pixelart/skins/<id>.mjs (default export { id, frame, name, desc, rarity, tags, css?, draw() -> Canvas }),
// vector skins in tools/vectorart/skins/<id>.js (module.exports { id, frame, name, desc, rarity, tags, base, draw() -> { defs, body } }).
// Writes src/renderer/frames/skins/<id>.svg and src/catalog/skins.json, and fails if a skin's opening
// differs from its base by a single pixel (tools/shells/skin-check.cjs).
// Preview without writing anything: npx electron tools/shells/preview.cjs <skin id> [...]
import fs from 'node:fs';
import path from 'node:path';
import { createRequire } from 'node:module';
import { fileURLToPath, pathToFileURL } from 'node:url';

const require = createRequire(import.meta.url);
const HERE = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(HERE, '..', '..');
const OUT = path.join(ROOT, 'src', 'renderer', 'frames', 'skins');
const JSON_FILE = path.join(ROOT, 'src', 'catalog', 'skins.json');
const PX = path.join(ROOT, 'tools', 'pixelart', 'skins');
const VX = path.join(ROOT, 'tools', 'vectorart', 'skins');
const check = require('./skin-check.cjs');

// Build (and shop) order: the order they unlock on the reward track (src/catalog/levels.json).
export const SKINS = ['skin-crt-tv-gold', 'skin-px-crt-winter', 'skin-px-pet-egg-midnight', 'skin-px-forest-autumn', 'skin-vx-neko-tv-calico-night',
  'skin-px-cat-monitor-tuxedo', 'skin-px-arcade-gold', 'skin-vx-mochi-bunny-choco', 'skin-px-dungeon-haunted', 'skin-px-food-truck-night-market'];
const RARITY = ['common', 'rare', 'epic', 'legendary'];

/** The shipped catalog's frame items (starters included), by id. */
function baseFrames() {
  const cat = require('../../src/main/economy/catalog.js').load();
  return new Map(cat.frames.map((f) => [f.id, f]));
}

/** Loads a skin module: { style, mod }. */
export async function loadSkin(id) {
  const px = path.join(PX, `${id}.mjs`), vx = path.join(VX, `${id}.js`);
  if (fs.existsSync(px)) return { style: 'pixel', mod: (await import(pathToFileURL(px).href)).default };
  if (fs.existsSync(vx)) return { style: 'vector', mod: require(vx) };
  throw new Error(`no tools/pixelart/skins/${id}.mjs or tools/vectorart/skins/${id}.js`);
}

/** skins.json entry. Geometry is never stored: the catalog takes it from the base frame. */
export const entry = (m, style) => ({
  id: m.id, frame: m.frame, name: m.name, desc: m.desc, rarity: m.rarity, file: `frames/skins/${m.id}.svg`, style,
  license: 'CC-BY-4.0', author: 'Kayboro', tags: m.tags,
});

/**
 * Builds one skin: { style, svg, entry, base, item, problems }. `item` is a catalog-shaped frame item for
 * the preview tool (the base's geometry with the skin's id, name and file).
 */
export async function buildSkin(id, frames = baseFrames()) {
  const { style, mod: m } = await loadSkin(id), problems = [];
  if (!m || m.id !== id) throw new Error(`${id}: module must export id '${id}'`);
  const base = frames.get(m.frame);
  if (!base) throw new Error(`${id}: unknown base frame "${m.frame}"`);
  if (base.style !== style) problems.push(`a ${style} skin for a ${base.style} shell`);
  if (!/^skin-[a-z0-9]+(?:-[a-z0-9]+)*$/.test(id) || id.length > 64) problems.push('ids are skin- + lowercase words');
  for (const k of ['name', 'desc']) if (!(typeof m[k] === 'string' && m[k]) || /—/.test(m[k])) problems.push(`missing ${k} (no em dashes)`);
  if (!RARITY.includes(m.rarity)) problems.push(`rarity must be one of ${RARITY.join('/')}`);
  if (!Array.isArray(m.tags) || !m.tags.length) problems.push('missing tags');
  let svg;
  if (style === 'pixel') {
    const cv = m.draw(), g = check.pixelGeometry(base);
    if (cv.w !== g.W || cv.h !== g.H) problems.push(`canvas ${cv.w}x${cv.h} is not the base's ${g.W}x${g.H}`);
    const h = cv.hole || {};
    if ([h.x, h.y, h.w, h.h, h.r].join() !== [g.x, g.y, g.w, g.h, g.r].join()) problems.push(`opening ${[h.x, h.y, h.w, h.h, h.r]} is not the base's ${[g.x, g.y, g.w, g.h, g.r]}`);
    svg = cv.toSVG(m.css || '');
    problems.push(...check.pixelSkinProblems(svg, base));
  } else {
    const { frameSvg } = require('../vectorart/lib.js'), b = m.base, { defs, body } = m.draw();
    svg = frameSvg({ id, W: b.W, H: b.H, hole: b.hole, radius: b.radius || 0, defs, body });
    const baseSvg = fs.readFileSync(path.join(ROOT, 'src', 'renderer', base.file), 'utf8');
    problems.push(...check.vectorSkinProblems(svg, baseSvg));
  }
  if (svg.length > 200 * 1024) problems.push(`svg is ${(svg.length / 1024).toFixed(0)} KB (keep under 200 KB)`);
  const e = entry(m, style);
  const item = { ...base, id, name: `${m.name} · ${base.name}`, file: e.file, starter: false, desc: m.desc, tags: m.tags, rarity: m.rarity, skinOf: base.id };
  return { style, svg, entry: e, base, item, problems };
}

async function main(ids) {
  fs.mkdirSync(OUT, { recursive: true });
  const frames = baseFrames();
  let prev = [];
  try { prev = JSON.parse(fs.readFileSync(JSON_FILE, 'utf8')).skins || []; } catch {}
  const items = new Map(prev.map((s) => [s.id, s]));
  let bad = 0;
  for (const id of ids) {
    const b = await buildSkin(id, frames);
    if (b.problems.length) { bad++; console.error(`FAIL ${id}\n  ${b.problems.join('\n  ')}`); continue; }
    fs.writeFileSync(path.join(OUT, `${id}.svg`), b.svg);
    items.set(id, b.entry);
    console.log(`${id.padEnd(34)} on ${b.base.id.padEnd(16)} ${b.style}  ${(b.svg.length / 1024).toFixed(1)} KB`);
  }
  const list = SKINS.filter((id) => items.has(id)).map((id) => items.get(id));
  fs.writeFileSync(JSON_FILE, `{\n  "skins": [\n${list.map((s) => `    ${JSON.stringify(s)}`).join(',\n')}\n  ]\n}\n`);
  if (bad) process.exit(1);
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const ids = process.argv.slice(2);
  const unknown = ids.filter((id) => !SKINS.includes(id));
  if (unknown.length) { console.error(`unknown skin id(s): ${unknown.join(', ')} (add them to SKINS)`); process.exit(1); }
  main(ids.length ? ids : SKINS).catch((e) => { console.error(e); process.exit(1); });
}
