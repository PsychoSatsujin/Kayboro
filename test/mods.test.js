// Unit tests for src/main/economy/mods.js: the mod loader, its catalog merge and the example mod.
const { test, after } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { pathToFileURL } = require('node:url');

const { loadMods } = require('../src/main/economy/mods');
const catalogLib = require('../src/main/economy/catalog');
const { Economy } = require('../src/main/economy/economy');

const TMP = fs.mkdtempSync(path.join(os.tmpdir(), 'kayboro-mods-'));
after(() => fs.rmSync(TMP, { recursive: true, force: true }));
const EXAMPLE = path.join(__dirname, '..', 'examples', 'mods', 'example-shell');

function modsDir(mods) {
  const dir = fs.mkdtempSync(path.join(TMP, 'mods-'));
  for (const [folder, files] of Object.entries(mods)) {
    fs.mkdirSync(path.join(dir, folder));
    for (const [rel, body] of Object.entries(files)) {
      const f = path.join(dir, folder, rel);
      fs.mkdirSync(path.dirname(f), { recursive: true });
      fs.writeFileSync(f, typeof body === 'string' ? body : JSON.stringify(body));
    }
  }
  return dir;
}

const SVG = '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100"/>';
const frame = (id, extra = {}) => ({ id, name: id, file: 'f.svg', size: { w: 100, h: 100 }, hole: { x: 0.1, y: 0.1, w: 0.8, h: 0.8 }, ...extra });

test('example mod: loads every item with file:// urls inside its folder', () => {
  const dir = fs.mkdtempSync(path.join(TMP, 'ex-'));
  fs.cpSync(EXAMPLE, path.join(dir, 'example-shell'), { recursive: true });
  const r = loadMods(dir, { reserved: catalogLib.reservedIds() });
  assert.equal(r.mods.length, 1);
  const m = r.mods[0];
  assert.deepEqual([m.id, m.name, m.version, m.items, m.errors, m.skipped], ['example-shell', 'Example Shell', '1.0.0', 4, [], false]);
  const f = r.frames[0];
  assert.equal(f.url, pathToFileURL(path.join(dir, 'example-shell', 'frames', 'example-shell.svg')).href);
  assert.deepEqual(f.mod, { id: 'example-shell', name: 'Example Shell', author: 'Kayboro' });
  assert.deepEqual([f.kind, f.price, f.unlockLevel, f.starter], ['frame', null, null, false]);
  assert.ok(Math.abs(f.aspect - (f.hole.w * f.size.w) / (f.hole.h * f.size.h)) < 1e-3, 'aspect matches the hole');
  const viewBox = /viewBox="0 0 (\d+) (\d+)"/.exec(fs.readFileSync(path.join(EXAMPLE, f.file), 'utf8'));
  assert.deepEqual([+viewBox[1], +viewBox[2]], [f.size.w, f.size.h]);
  assert.match(r.wallpapers[0].media.url, /^file:\/\/.*dusk-grid\.svg$/);
  assert.match(r.wallpapers[0].previewUrl, /^file:\/\//);
  assert.deepEqual([r.fills[0].base, r.fills[0].kind], ['bubbles', 'fill']);
  assert.equal(r.colorways[0].filter, 'hue-rotate(150deg) saturate(1.2)');
});

test('loader: broken mod.json skips the mod, broken items skip the item, errors are listed', () => {
  const dir = modsDir({
    'a-good': { 'mod.json': { id: 'good', name: 'Good', author: 'Ann', frames: [frame('g1'), frame('g2', { file: '../escape.svg' }), frame('g3', { hole: { x: 0.5, y: 0, w: 0.8, h: 1 } }),
      frame('starfield'), frame('../x')], colorways: [{ id: 'cw', filter: 'url(https://evil.example/f.svg#x)' }, { id: 'cw2', filter: 'sepia(1)', opacity: 0.5 }],
    fills: [{ id: 'f1', base: 'plasma', colors: ['#fff', 'red'] }, { id: 'f2', base: 'lava' }, { id: 'f3', media: { type: 'video', file: 'f.svg' } }],
    wallpapers: [{ id: 'w1', media: { type: 'image', file: 'f.svg' }, price: { coins: 9 } }, { id: 'w2', media: { type: 'video', file: 'missing.mp4' } }] }, 'f.svg': SVG },
    'b-broken': { 'mod.json': '{ not json' },
    'c-noid': { 'mod.json': { name: 'No id' } },
    'd-dupe': { 'mod.json': { id: 'good', frames: [] } },
    'e-clash': { 'mod.json': { id: 'clash', frames: [frame('g1')], wallpapers: 'nope' }, 'f.svg': SVG },
    'f-empty': {},
  });
  fs.writeFileSync(path.join(dir, 'stray-file.txt'), 'ignored');
  const r = loadMods(dir, { reserved: new Set(['starfield']) });
  const by = Object.fromEntries(r.mods.map((m) => [m.path.split(path.sep).pop(), m]));
  assert.deepEqual(Object.keys(by), ['a-good', 'b-broken', 'c-noid', 'd-dupe', 'e-clash', 'f-empty']);
  const g = by['a-good'];
  assert.equal(g.items, 4);
  assert.deepEqual([r.frames.map((x) => x.id), r.colorways.map((x) => x.id), r.fills.map((x) => x.id), r.wallpapers.map((x) => x.id)], [['g1'], ['cw2'], ['f1'], ['w1']]);
  assert.equal(g.errors.length, 8, g.errors.join('\n'));
  assert.ok(g.errors.some((e) => /frames\[1\] "g2": file/.test(e)));
  assert.ok(g.errors.some((e) => /"starfield": id is already used/.test(e)));
  assert.deepEqual(r.fills[0].colors, ['#fff'], 'only hex colors');
  assert.deepEqual([r.colorways[0].opacity, r.colorways[0].translucent], [0.5, true]);
  assert.equal(r.wallpapers[0].price, null);
  for (const k of ['b-broken', 'c-noid', 'd-dupe', 'f-empty']) assert.ok(by[k].skipped && by[k].errors.length === 1 && by[k].items === 0, k);
  assert.match(by['f-empty'].errors[0], /missing/);
  assert.match(by['d-dupe'].errors[0], /already uses id "good"/);
  assert.deepEqual([by['e-clash'].items, by['e-clash'].errors.length], [0, 2], 'ids are unique across mods; a non-list kind is reported');
  assert.deepEqual(loadMods(path.join(TMP, 'nope')).mods, [], 'no mods folder: nothing to load');
});

test('catalog merge: mod items are listed with url + mod, owned, and removable by takedown', async () => {
  const dir = fs.mkdtempSync(path.join(TMP, 'merge-'));
  fs.cpSync(EXAMPLE, path.join(dir, 'example-shell'), { recursive: true });
  const mods = loadMods(dir, { reserved: catalogLib.reservedIds() });
  const cat = catalogLib.load(mods);
  assert.equal(catalogLib.load(mods), cat, 'memoized per mods result');
  const f = cat.frames.find((x) => x.id === 'example-shell');
  assert.ok(f && f.url && f.mod);
  assert.ok(cat.wallpapers.some((w) => w.id === 'example-dusk-grid' && w.mod));
  assert.ok(!catalogLib.load().frames.some((x) => x.id === 'example-shell'));

  const e = new Economy({ dir: path.join(TMP, 'eco'), catalog: () => cat });
  const s = e.getState();
  for (const id of ['example-shell', 'example-mint-bubbles', 'example-lagoon']) assert.ok(s.inventory.includes(id), id);
  assert.equal(e.equip('fill', 'example-mint-bubbles').ok, true);
  assert.equal(e.setActiveWallpaper({ source: 'mod', id: 'example-dusk-grid' }).ok, true);

  // The renderer accepts the mod frame's file:// url (and only for mod items).
  const F = await import('../src/renderer/frames/frames.js');
  assert.equal(F.fromCatalog(f).url, f.url);
  assert.equal(F.fromCatalog({ ...f, mod: null, file: 'nope' }), null);
  assert.equal(F.fromCatalog({ ...f, url: 'https://evil.example/x.svg' }), null);

  const gone = catalogLib.finish(catalogLib.load(), mods, ['example-shell']);
  assert.ok(!gone.frames.some((x) => x.id === 'example-shell'));
});
