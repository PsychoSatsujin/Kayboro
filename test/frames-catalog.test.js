// Catalog frames in the renderer (src/renderer/frames/frames.js): FrameItem -> stage frame mapping.
const { test, before } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { fileURLToPath } = require('node:url');

const ROOT = path.join(__dirname, '..');
let F;
before(async () => { F = await import('../src/renderer/frames/frames.js'); });

const item = (o = {}) => ({ id: 'x-test', name: 'Test', kind: 'frame', style: 'pixel', rarity: 'rare', price: null, unlockLevel: 4,
  file: 'frames/pixel/x-test.svg', size: { w: 200, h: 100 }, hole: { x: 0.1, y: 0.2, w: 0.5, h: 0.6 }, holeRadius: 0.05, translucent: true, ...o });

test('fromCatalog maps a FrameItem to a stage frame', () => {
  const f = F.fromCatalog(item({ aspect: undefined }));
  assert.equal(f.id, 'x-test');
  assert.equal(fileURLToPath(f.url), path.join(ROOT, 'src', 'renderer', 'frames', 'pixel', 'x-test.svg'));
  assert.deepEqual(f.hole, { x: 0.1, y: 0.2, w: 0.5, h: 0.6 });
  assert.ok(Math.abs(f.aspect - (0.5 * 200) / (0.6 * 100)) < 1e-12, 'aspect falls back to the hole in pixels');
  assert.equal(f.holeRadius, 0.05);
  assert.equal(f.translucent, true);
  assert.equal(f.unlockLevel, 4);
  assert.equal(F.fromCatalog(item({ aspect: 1.5 })).aspect, 1.5);
});

test('fromCatalog rejects unsafe or broken items', () => {
  for (const bad of [{ file: '../main/main.js' }, { file: 'frames/x.exe' }, { file: 'https://evil.example/x.svg' }, { hole: null }, { hole: { x: 0, y: 0, w: 0, h: 1 } }, { id: 7 }]) {
    assert.equal(F.fromCatalog(item(bad)), null, JSON.stringify(bad));
  }
  assert.equal(F.fromCatalog(null), null);
});

test('setCatalogFrames keeps the starters first and skips duplicates and bad items', () => {
  const starterIds = F.STARTERS.map((s) => s.id);
  try {
    const list = F.setCatalogFrames([{ ...item(), id: 'crt-tv', file: 'frames/crt-tv.svg' }, item(), item({ id: 'bad', file: 'nope' })]);
    assert.equal(list, F.FRAMES);
    assert.deepEqual(list.map((f) => f.id), [...starterIds, 'x-test']);
    assert.equal(F.frameById('crt-tv'), F.STARTERS[0], 'starters keep their built-in geometry');
    assert.equal(F.frameById('x-test').name, 'Test');
  } finally {
    F.setCatalogFrames([]);
  }
  assert.deepEqual(F.FRAMES.map((f) => f.id), starterIds);
});

test('every shipped catalog frame maps to an existing image', () => {
  const items = ['frames-pixel.json', 'frames-vector.json'].flatMap((n) => {
    const p = path.join(ROOT, 'src', 'catalog', n);
    return fs.existsSync(p) ? JSON.parse(fs.readFileSync(p, 'utf8')).frames : [];
  });
  for (const it of items) {
    const f = F.fromCatalog(it);
    assert.ok(f, `${it.id} is rejected`);
    assert.ok(fs.existsSync(fileURLToPath(f.url)), `${it.id}: ${it.file} is missing`);
    assert.ok(f.aspect > 0 && f.hole.x >= 0 && f.hole.x + f.hole.w <= 1 + 1e-9 && f.hole.y + f.hole.h <= 1 + 1e-9, `${it.id}: bad geometry`);
  }
});
