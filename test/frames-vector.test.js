// Unit tests for the vector frame catalogue (src/catalog/frames-vector.json) against the SVG files:
// viewBox/size, the hole cut (position, size, corner radius), self-contained markup and the contract.
const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const ROOT = path.join(__dirname, '..');
const { frames } = JSON.parse(fs.readFileSync(path.join(ROOT, 'src', 'catalog', 'frames-vector.json'), 'utf8'));
const svgOf = (f) => fs.readFileSync(path.join(ROOT, 'src', 'renderer', f.file), 'utf8');

const CONTRACT = {
  'vx-sakura-handheld': 3 / 2, 'vx-magical-compact': 1, 'vx-mecha-hud': 16 / 9, 'vx-cozy-wood-tv': 4 / 3,
  'vx-neko-tv': 4 / 3, 'vx-synthwave': 16 / 9, 'vx-ufo-pet': 1, 'vx-gallery': 16 / 9,
};

/** Bounding box and arc radii of one absolute subpath made of M/L/H/V/A/Z commands. */
function subpathBox(d) {
  const tok = d.match(/[MLHVAZ]|-?\d*\.?\d+(?:e-?\d+)?/gi);
  let cmd = '', x = 0, y = 0, i = 0;
  const xs = [], ys = [], radii = [];
  const num = () => +tok[i++];
  while (i < tok.length) {
    if (/[A-Z]/i.test(tok[i])) cmd = tok[i++];
    assert.ok('MLHVAZ'.includes(cmd), `unsupported path command ${cmd} in hole cut`);
    if (cmd === 'Z') continue;
    if (cmd === 'M' || cmd === 'L') { x = num(); y = num(); }
    else if (cmd === 'H') x = num();
    else if (cmd === 'V') y = num();
    else if (cmd === 'A') { const rx = num(), ry = num(); i += 3; x = num(); y = num(); radii.push(rx, ry); }
    xs.push(x); ys.push(y);
  }
  return { x: Math.min(...xs), y: Math.min(...ys), w: Math.max(...xs) - Math.min(...xs), h: Math.max(...ys) - Math.min(...ys), radii };
}

const { ORDER } = require('../tools/vectorart/build.js');
const COLLECTIONS = ['pocket-pals', 'coin-op', 'blue-cel', 'wild-pixels', 'world-tour', 'dreamscapes', 'fan-favorites',
  'sci-fi-signals', 'old-masters', 'legends-dread', 'wild-tuneful', 'curio-cabinet'];

test('catalogue lists every built frame in build order, the eight originals first', () => {
  assert.deepEqual(frames.map((f) => f.id), ORDER);
  assert.deepEqual(ORDER.slice(0, 8).sort(), Object.keys(CONTRACT).sort());
});

test('items follow the FrameItem contract', () => {
  for (const f of frames) {
    assert.equal(f.kind, 'frame', f.id); assert.equal(f.style, 'vector', f.id); assert.equal(f.author, 'Kayboro', f.id);
    assert.equal(f.unlockLevel, null, f.id);
    assert.ok(f.price === null || (Number.isInteger(f.price.coins) && f.price.coins > 0), `${f.id}.price`);
    if (CONTRACT[f.id]) assert.equal(f.price, null, `${f.id}: originals are level rewards`);
    else {
      assert.ok(COLLECTIONS.includes(f.collection), `${f.id}.collection`);
      assert.ok(['CC-BY-4.0', 'fan-art'].includes(f.license), `${f.id}.license`);
      assert.doesNotMatch(f.desc, /—/, `${f.id}: no em dash in desc`);
    }
    assert.equal(f.file, `frames/vector/${f.id}.svg`, f.id);
    assert.match(f.file, /^frames\/(?:[\w-]+\/)*[\w-]+\.(?:svg|png|webp)$/, 'catalog.js SAFE_FILE');
    for (const k of ['name', 'theme', 'desc']) assert.ok(typeof f[k] === 'string' && f[k].length, `${f.id}.${k}`);
    assert.ok(Array.isArray(f.tags) && f.tags.length, `${f.id}.tags`);
    assert.ok(Number.isInteger(f.size.w) && Number.isInteger(f.size.h), `${f.id}.size`);
    const { x, y, w, h } = f.hole;
    assert.ok(x > 0 && y > 0 && w > 0 && h > 0 && x + w < 1 && y + h < 1, `${f.id} hole inside the frame`);
    assert.ok(f.holeRadius >= 0 && f.holeRadius <= 0.5, `${f.id}.holeRadius`);
    assert.ok(Math.abs(f.aspect - (w * f.size.w) / (h * f.size.h)) < 1e-4, `${f.id} aspect matches the hole`);
    if (CONTRACT[f.id]) assert.ok(Math.abs(f.aspect - CONTRACT[f.id]) < 1e-5, `${f.id} aspect ${f.aspect} vs contract ${CONTRACT[f.id]}`);
  }
});

test('rarity mix, translucency and the rounded compact mirror', () => {
  const originals = frames.filter((f) => CONTRACT[f.id]);
  const count = (r) => originals.filter((f) => f.rarity === r).length;
  assert.deepEqual([count('common'), count('rare'), count('epic'), count('legendary')], [2, 3, 2, 1]);
  assert.equal(frames.find((f) => f.id === 'vx-gallery').rarity, 'legendary');
  assert.deepEqual(originals.filter((f) => f.translucent).map((f) => f.id).sort(), ['vx-sakura-handheld', 'vx-ufo-pet']);
  assert.ok(frames.find((f) => f.id === 'vx-magical-compact').holeRadius >= 0.15);
});

test('SVG viewBox and size match the catalogue', () => {
  for (const f of frames) {
    const root = svgOf(f).match(/<svg\b[^>]*>/)[0];
    assert.match(root, new RegExp(`viewBox="0 0 ${f.size.w} ${f.size.h}"`), f.id);
    assert.match(root, new RegExp(`width="${f.size.w}" height="${f.size.h}"`), f.id);
  }
});

test('SVG hole cut matches the catalogue hole and radius', () => {
  for (const f of frames) {
    const svg = svgOf(f), { w: W, h: H } = f.size;
    const m = svg.match(/<clipPath id="shell-cut"><path clip-rule="evenodd" d="([^"]+)"\/><\/clipPath>/);
    assert.ok(m, `${f.id}: shell-cut clip path`);
    const [outer, hole, ...rest] = m[1].split(/(?=M)/);
    assert.equal(rest.length, 0, `${f.id}: one hole`);
    assert.deepEqual(subpathBox(outer), { x: 0, y: 0, w: W, h: H, radii: [] }, `${f.id}: outer subpath covers the frame`);
    const b = subpathBox(hole), tol = 0.01;
    for (const [k, total] of [['x', W], ['y', H], ['w', W], ['h', H]])
      assert.ok(Math.abs(b[k] - f.hole[k] * total) < tol + total * 5e-7, `${f.id} hole.${k}: svg ${b[k]} vs json ${f.hole[k] * total}`);
    const r = f.holeRadius * f.hole.w * W;
    if (r < 0.5) assert.equal(b.radii.length, 0, `${f.id}: square hole has no arcs`);
    else for (const rad of b.radii) assert.ok(Math.abs(rad - r) < 0.05, `${f.id}: corner radius ${rad} vs ${r}`);
    // everything drawn sits inside the clipped group
    const body = svg.slice(svg.indexOf('</defs>') + 7).trim();
    assert.ok(body.startsWith('<g clip-path="url(#shell-cut)">') && body.endsWith('</g>\n</svg>'), `${f.id}: artwork wrapped in the hole clip`);
  }
});

test('SVGs are self-contained: no scripts, external refs, text or dangling ids', () => {
  for (const f of frames) {
    const svg = svgOf(f);
    assert.doesNotMatch(svg, /<script|<foreignObject|<image|<text|xlink:href|href=|@import|https?:\/\/(?!www\.w3\.org\/2000\/svg)/i, f.id);
    const ids = [...svg.matchAll(/\bid="([^"]+)"/g)].map((m) => m[1]);
    assert.equal(new Set(ids).size, ids.length, `${f.id}: duplicate ids`);
    for (const [, ref] of svg.matchAll(/url\(#([^)]+)\)/g)) assert.ok(ids.includes(ref), `${f.id}: url(#${ref}) is defined`);
    assert.ok(svg.length < 200 * 1024, `${f.id}: keep under 200 KB`);
  }
});

test('the economy catalogue loads every vector frame', () => {
  const { load } = require('../src/main/economy/catalog');
  const loaded = new Map(load().frames.map((f) => [f.id, f]));
  for (const f of frames) {
    const it = loaded.get(f.id);
    assert.ok(it, `${f.id} loaded`);
    assert.equal(it.style, 'vector'); assert.equal(it.file, f.file);
  }
});
