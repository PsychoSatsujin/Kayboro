// Unit tests for the pure parts of src/renderer/fx (colorways, finish recipes, screensaver ids).
const { test, before } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const ROOT = path.join(__dirname, '..');
const CONTRACT = {
  finishes: ['none', 'matte', 'gloss', 'holo', 'pearl', 'glitter'],
  fills: ['starfield', 'bubbles', 'plasma', 'pixel-rain', 'sakura-petals', 'aurora'],
  colorways: ['default', 'berry', 'mint', 'midnight', 'sunset', 'mono', 'gold', 'clear'],
};
const catalog = name => {
  const p = path.join(ROOT, 'src/catalog', `${name}.json`);
  return fs.existsSync(p) ? JSON.parse(fs.readFileSync(p, 'utf8'))[name] : null;
};

let C, F, S;
before(async () => {
  C = await import('../src/renderer/fx/colorways.js');
  F = await import('../src/renderer/fx/finishes.js');
  S = await import('../src/renderer/fx/screensavers.js');
});

test('colorways: every contract id, filters made only of colour functions', () => {
  assert.deepEqual([...C.COLORWAY_IDS].sort(), [...CONTRACT.colorways].sort());
  const fn = /^(sepia|saturate|hue-rotate|brightness|contrast|grayscale)\(-?[\d.]+(deg)?\)$/;
  for (const id of CONTRACT.colorways) {
    const { filter, shellOpacity } = C.COLORWAYS[id];
    assert.ok(filter === 'none' || filter.split(' ').every(f => fn.test(f)), `${id}: ${filter}`);
    assert.ok(shellOpacity > 0 && shellOpacity <= 1, id);
  }
  assert.equal(C.COLORWAYS.default.filter, 'none');
  assert.equal(C.COLORWAYS.clear.shellOpacity, 0.55);
  for (const id of CONTRACT.colorways.filter(i => i !== 'clear')) assert.equal(C.COLORWAYS[id].shellOpacity, 1, id);
  assert.equal(C.colorwayOf('nope'), C.COLORWAYS.default);
});

test('colorways: catalogue items all render, translucency agrees', () => {
  const items = catalog('colorways');
  if (!items) return;
  for (const it of items) {
    assert.ok(C.COLORWAYS[it.id], `no colorway for catalogue id ${it.id}`);
    assert.equal(C.COLORWAYS[it.id].shellOpacity < 1, !!it.translucent, it.id);
  }
});

test('applyColorway sets filter + opacity and restores the previous look', () => {
  const img = { style: { filter: '', opacity: '' } };
  const undoGold = C.applyColorway(img, 'gold');
  assert.equal(img.style.filter, C.COLORWAYS.gold.filter);
  assert.equal(img.style.opacity, '');
  const undoClear = C.applyColorway(img, 'clear'); // replaces gold
  assert.equal(img.style.opacity, '0.55');
  undoGold(); // stale disposer: no effect
  assert.equal(img.style.opacity, '0.55');
  undoClear();
  assert.deepEqual([img.style.filter, img.style.opacity], ['', '']);
});

test('finishes: every contract id has a recipe whose layers are styled in fx.css', () => {
  assert.deepEqual(F.FINISH_IDS, CONTRACT.finishes);
  const css = fs.readFileSync(path.join(ROOT, 'src/renderer/fx/fx.css'), 'utf8');
  for (const id of CONTRACT.finishes) {
    const r = F.FINISHES[id];
    assert.ok(r && Array.isArray(r.layers), id);
    assert.equal(r.layers.length === 0, id === 'none', id);
    for (const layer of r.layers) {
      const cls = `.fx-${layer.split(' ')[0]}`;
      assert.ok(css.includes(cls), `${id}: ${cls} missing from fx.css`);
    }
  }
  for (const it of catalog('finishes') || []) assert.ok(F.FINISHES[it.id], `no finish for catalogue id ${it.id}`);
});

test('finishes: none / unknown / empty fills are no-ops that need no DOM', () => {
  for (const id of ['none', 'nope', undefined]) assert.equal(typeof F.applyFinish({}, 'x.svg', id), 'function');
  for (const fill of [null, { type: 'none' }, { type: 'screensaver' }, { type: 'image' }, { type: 'gif', url: 'a' }]) {
    assert.equal(typeof F.applyShellFill({}, 'x.svg', fill), 'function', JSON.stringify(fill));
  }
});

test('needsShellFill: translucent frames or a translucent colorway', () => {
  assert.equal(F.needsShellFill({ translucent: true }, 'default'), true);
  assert.equal(F.needsShellFill({ translucent: false }, 'default'), false);
  assert.equal(F.needsShellFill({ translucent: false }, 'clear'), true);
  assert.equal(F.needsShellFill(null, 'berry'), false);
  assert.equal(F.needsShellFill({}, 'unknown'), false);
});

test('screensavers: every fill id has a scene and a valid default palette', () => {
  assert.deepEqual(S.SCREENSAVER_IDS, CONTRACT.fills);
  for (const id of CONTRACT.fills) {
    const p = S.PALETTES[id];
    assert.ok(p && p.length >= 3, id);
    for (const c of p) assert.match(c, /^#[0-9a-f]{6}$/i, `${id} ${c}`);
  }
  for (const it of catalog('fills') || []) assert.ok(S.SCREENSAVER_IDS.includes(it.id), `no screensaver for catalogue id ${it.id}`);
  assert.deepEqual(S.hexRgb('#fff'), [255, 255, 255]);
  assert.deepEqual(S.hexRgb('#7af0ff'), [122, 240, 255]);
  assert.deepEqual(S.hexRgb('7AF0FF'), [122, 240, 255]);
});
