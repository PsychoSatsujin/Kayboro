// Shell effects: particles + screen glass. The fx config is validated the same way in the main process
// (catalog.js normFx) and the renderer (frames.js normFx); every entry in tools/shells/fx.json and every
// starter is valid and lands in the shipped catalog; glass SVGs and particle counts are well formed.
const { test, before } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const ROOT = path.join(__dirname, '..');
const catalog = require('../src/main/economy/catalog.js');
const FX = JSON.parse(fs.readFileSync(path.join(ROOT, 'tools', 'shells', 'fx.json'), 'utf8'));
let F, P, G;
before(async () => {
  F = await import('../src/renderer/frames/frames.js');
  P = await import('../src/renderer/fx/particles.js');
  G = await import('../src/renderer/fx/glass.js');
});

test('both processes accept the same particle and glass types', () => {
  assert.deepEqual(catalog.PARTICLES, F.PARTICLE_TYPES);
  assert.deepEqual(catalog.GLASS, F.GLASS_TYPES);
  assert.deepEqual(F.PARTICLE_TYPES, P.PARTICLE_TYPES, 'every type has a particle preset');
  assert.deepEqual(F.GLASS_TYPES, G.GLASS_TYPES);
});

test('normFx: drops junk, clamps density, keeps valid palettes, same result in both processes', () => {
  const cases = [
    null, 'x', {}, { particles: 'nope' }, { glass: 'round' }, { particles: 'hearts', glass: 'crt', density: 9 },
    { particles: 'snow', density: 0.01 }, { particles: 'bubbles', palette: ['#ffffff', '#7af0ff'] },
    { particles: 'bubbles', palette: ['red'] }, { particles: 'embers', palette: Array(7).fill('#ffffff') },
  ];
  for (const c of cases) assert.deepEqual(catalog.normFx(c), F.normFx(c), JSON.stringify(c));
  assert.equal(F.normFx({ particles: 'nope', glass: 'nope' }), null);
  assert.deepEqual(F.normFx({ particles: 'hearts', glass: 'crt', density: 9 }), { particles: 'hearts', glass: 'crt', density: 2 });
  assert.equal(F.normFx({ particles: 'snow', density: 0.01 }).density, 0.2);
  assert.equal(F.normFx({ particles: 'bubbles', palette: ['red'] }).palette, undefined);
});

test('tools/shells/fx.json: valid entries for shipped shells, all in the catalog', () => {
  const cat = catalog.load(), byId = new Map(cat.frames.map((f) => [f.id, f]));
  for (const [id, fx] of Object.entries(FX)) {
    if (id.startsWith('_')) continue;
    assert.ok(byId.has(id), `${id} is a catalog shell`);
    const n = F.normFx(fx);
    assert.ok(n, `${id}: has a valid particles or glass type`);
    assert.deepEqual(byId.get(id).fx, n, `${id}: catalog carries its fx`);
    assert.deepEqual(F.fromCatalog(byId.get(id)).fx, n, `${id}: renderer frame carries its fx`);
  }
});

test('every starter has glass (and particles, except the plain ones), and the starters match between processes', () => {
  for (const s of F.STARTERS) {
    assert.ok(s.fx?.glass && (s.id.startsWith('plain-') ? !s.fx.particles : s.fx.particles), `${s.id} fx`);
    const c = catalog.STARTERS.find((x) => x.id === s.id);
    assert.ok(c, `${s.id} in catalog.js`);
    assert.deepEqual([c.size, c.hole, c.aspect, c.holeRadius, c.translucent], [s.size, s.hole, s.aspect, s.holeRadius, s.translucent], `${s.id} geometry`);
    assert.ok(fs.existsSync(path.join(ROOT, 'src', 'renderer', 'frames', `${s.id}.svg`)), `${s.id}.svg`);
  }
});

test('glassSvg: a self-contained SVG for every type and aspect, nothing for an empty box', () => {
  for (const type of [...G.GLASS_TYPES, 'unknown']) {
    for (const [w, h, r] of [[640, 480, 24], [1280, 720, 0], [300, 300, 150], [90, 900, 8]]) {
      const svg = G.glassSvg(w, h, r, type);
      assert.match(svg, /^<svg [^>]*viewBox="0 0 [\d.]+ [\d.]+"/, `${type} ${w}x${h}`);
      assert.doesNotMatch(svg, /NaN|undefined|Infinity|<script|href/i, `${type} ${w}x${h}`);
    }
  }
  assert.equal(G.glassSvg(0, 100), '');
});

test('particleCount: scales with area and density, always between 4 and 48', () => {
  for (const type of P.PARTICLE_TYPES) {
    assert.equal(P.particleCount(type, 10, 10), 4, type);
    assert.equal(P.particleCount(type, 4000, 4000), 48, type);
    assert.ok(P.particleCount(type, 800, 600, 2) >= P.particleCount(type, 800, 600, 0.5), type);
  }
  assert.equal(P.particleCount('nope', 800, 600), 0);
});
