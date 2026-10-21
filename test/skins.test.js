// Shell skins: alternate artwork for one existing shell (src/catalog/skins.json, built by
// tools/shells/build-skins.mjs). Catalog validation and inherited geometry, every skin SVG keeps its
// base's opening exactly, the renderer's frame-for-screen logic, economy ownership and level rewards.
const { test, before, after } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');

const ROOT = path.join(__dirname, '..');
const catalogLib = require('../src/main/economy/catalog');
const { Economy } = require('../src/main/economy/economy');
const P = require('../src/main/economy/progression');
const bundles = require('../src/main/economy/bundles');
const check = require('../tools/shells/skin-check.cjs');
const { skins: RAW } = JSON.parse(fs.readFileSync(path.join(ROOT, 'src', 'catalog', 'skins.json'), 'utf8'));

// The reward track: one skin per level, on levels that had no item before.
const LEVELS = { 15: 'skin-crt-tv-gold', 26: 'skin-px-crt-winter', 31: 'skin-px-pet-egg-midnight', 33: 'skin-px-forest-autumn',
  36: 'skin-vx-neko-tv-calico-night', 39: 'skin-px-cat-monitor-tuxedo', 41: 'skin-px-arcade-gold', 43: 'skin-vx-mochi-bunny-choco',
  49: 'skin-px-dungeon-haunted', 52: 'skin-px-food-truck-night-market' };

const TMP = fs.mkdtempSync(path.join(os.tmpdir(), 'kayboro-skins-'));
after(() => fs.rmSync(TMP, { recursive: true, force: true }));
let n = 0;
const make = (dir = path.join(TMP, String(++n))) => new Economy({ dir, now: () => new Date(2026, 0, 5, 10).getTime() });

let F, SKINS, L;
before(async () => {
  F = await import('../src/renderer/frames/frames.js');
  ({ SKINS } = await import('../tools/shells/build-skins.mjs'));
  L = await import('../src/renderer/panels/logic.js');
});

test('skins.json: build order, well formed, 8+ skins, mostly pixel', () => {
  assert.deepEqual(RAW.map((s) => s.id), SKINS);
  assert.ok(RAW.length >= 8);
  assert.ok(RAW.filter((s) => s.style === 'pixel').length > RAW.length / 2, 'mostly pixel');
  for (const s of RAW) {
    assert.match(s.id, /^skin-[a-z0-9]+(?:-[a-z0-9]+)*$/);
    assert.equal(s.file, `frames/skins/${s.id}.svg`);
    assert.ok(fs.existsSync(path.join(ROOT, 'src', 'renderer', s.file)), s.file);
    assert.ok(['common', 'rare', 'epic', 'legendary'].includes(s.rarity), s.id);
    assert.equal(s.license, 'CC-BY-4.0'); assert.equal(s.author, 'Kayboro');
    assert.ok(s.name && s.desc && !/—/.test(s.desc) && s.tags.length, s.id);
    for (const k of ['size', 'hole', 'holeRadius', 'aspect', 'translucent', 'price']) assert.ok(!(k in s), `${s.id}: no ${k} of its own`);
  }
});

test('catalog: skins inherit their base shell geometry, never their own', () => {
  const cat = catalogLib.load(), frames = new Map(cat.frames.map((f) => [f.id, f]));
  assert.equal(cat.skins.length, RAW.length);
  for (const k of cat.skins) {
    const b = frames.get(k.frame);
    assert.ok(b, `${k.id}: base ${k.frame}`);
    assert.equal(k.kind, 'skin'); assert.equal(k.starter, false); assert.equal(k.style, b.style);
    assert.deepEqual([k.size, k.hole, k.holeRadius, k.aspect, k.translucent], [b.size, b.hole, b.holeRadius, b.aspect, b.translucent], k.id);
    assert.equal(k.price, null, `${k.id}: no coin price (level reward)`);
    assert.ok(catalogLib.index(cat).get(k.id) === k, 'ownable through the index');
  }
  const frameMap = new Map([['px-crt', frames.get('px-crt')], ['m', { id: 'm', mod: { id: 'x' }, size: { w: 1, h: 1 }, hole: {} }]]);
  const raw = { id: 'skin-t', frame: 'px-crt', name: 'T', file: 'frames/skins/t.svg', size: { w: 9, h: 9 }, hole: { x: 0, y: 0, w: 1, h: 1 }, holeRadius: 0.4, translucent: true, fx: { glass: 'flat' } };
  const ok = catalogLib.normSkin(raw, frameMap);
  assert.deepEqual([ok.size, ok.hole, ok.holeRadius, ok.translucent], [frames.get('px-crt').size, frames.get('px-crt').hole, frames.get('px-crt').holeRadius, false], 'own geometry ignored');
  assert.equal('fx' in ok, false);
  assert.equal(catalogLib.normSkin({ ...raw, frame: 'nope' }, frameMap), null, 'unknown base frame: dropped');
  assert.equal(catalogLib.normSkin({ ...raw, frame: 'm' }, frameMap), null, 'skins of mod frames: dropped');
  assert.equal(catalogLib.normSkin({ ...raw, file: '../x.svg' }, frameMap), null, 'unsafe file: dropped');
  assert.equal(catalogLib.normSkin({ ...raw, id: 'bad id!' }, frameMap), null);
});

test('catalog: a taken-down shell takes its skins (and their rewards) along', () => {
  const base = catalogLib.load();
  const cat = catalogLib.finish({ ...base, takedowns: ['px-crt'] }, null);
  assert.ok(!cat.skins.some((k) => k.frame === 'px-crt'));
  assert.ok(!cat.levels.some((r) => r.rewards.items.includes('skin-px-crt-winter')));
  assert.ok(cat.skins.length === base.skins.length - 1);
});

test('levels: one skin per listed level, after its base unlocks, never sold for coins', () => {
  const cat = catalogLib.load(), at = new Map(cat.levels.flatMap((r) => r.rewards.items.map((id) => [id, r.level])));
  for (const [lvl, id] of Object.entries(LEVELS)) {
    assert.deepEqual(cat.levels.find((r) => r.level === +lvl).rewards.items, [id], `level ${lvl}`);
    const k = cat.skins.find((s) => s.id === id), b = cat.frames.find((f) => f.id === k.frame);
    assert.equal(k.unlockLevel, +lvl);
    assert.ok(b.starter || b.price?.coins || at.get(b.id) < +lvl, `${id}: its shell ${b.id} is available first`);
  }
  assert.equal(cat.skins.length, Object.keys(LEVELS).length, 'every skin is earned on the track');
});

for (const s of RAW) {
  test(`${s.id}: keeps the opening of ${s.frame} exactly`, () => {
    const cat = catalogLib.load(), base = cat.frames.find((f) => f.id === s.frame);
    const svg = fs.readFileSync(path.join(ROOT, 'src', 'renderer', s.file), 'utf8');
    if (s.style === 'pixel') assert.deepEqual(check.pixelSkinProblems(svg, base), []);
    else assert.deepEqual(check.vectorSkinProblems(svg, fs.readFileSync(path.join(ROOT, 'src', 'renderer', base.file), 'utf8')), []);
    assert.ok(svg.length < 200 * 1024, 'under 200 KB');
  });
}

test('skin check: catches a moved or painted-over opening', () => {
  const base = catalogLib.load().frames.find((f) => f.id === 'px-crt');
  const svg = fs.readFileSync(path.join(ROOT, 'src', 'renderer', 'frames', 'skins', 'skin-px-crt-winter.svg'), 'utf8');
  const painted = svg.replace('</svg>', '<path fill="#ff0000" d="M100 140h4v4h-4z"/>\n</svg>');
  assert.ok(check.pixelSkinProblems(painted, base).some((p) => /inside the opening/.test(p)));
  const moved = { ...base, hole: { ...base.hole, x: base.hole.x + 1 / base.size.w } };
  assert.ok(check.pixelSkinProblems(svg, moved).length);
  const vbase = fs.readFileSync(path.join(ROOT, 'src', 'renderer', 'frames', 'crt-tv.svg'), 'utf8');
  const vskin = fs.readFileSync(path.join(ROOT, 'src', 'renderer', 'frames', 'skins', 'skin-crt-tv-gold.svg'), 'utf8');
  assert.ok(check.vectorSkinProblems(vskin.replace('V712A34', 'V713A34'), vbase).some((p) => /clip path/.test(p)));
});

test('frameForScreen: an owned skin swaps the image only; unowned, foreign or custom frames ignore it', () => {
  const skins = catalogLib.load().skins, owned = new Set(['skin-px-crt-winter']), owns = (id) => owned.has(id);
  F.setCatalogFrames(catalogLib.load().frames);
  const base = F.frameById('px-crt');
  const worn = F.frameForScreen({ frame: 'px-crt', skin: 'skin-px-crt-winter' }, { skins, owns });
  assert.match(worn.url, /frames\/skins\/skin-px-crt-winter\.svg$/);
  assert.equal(worn.skin, 'skin-px-crt-winter'); assert.equal(worn.skinName, 'Winter');
  for (const k of ['id', 'size', 'hole', 'aspect', 'holeRadius', 'translucent', 'fx', 'style']) assert.deepEqual(worn[k], base[k], k);
  assert.equal(F.frameForScreen({ frame: 'px-crt', skin: null }, { skins, owns }), base, 'no skin: the frame itself');
  assert.equal(F.frameForScreen({ frame: 'px-crt', skin: 'skin-px-arcade-gold' }, { skins, owns: () => true }), base, 'skin of another frame');
  assert.equal(F.frameForScreen({ frame: 'px-crt', skin: 'skin-px-crt-winter' }, { skins, owns: () => false }), base, 'not owned');
  assert.equal(F.frameForScreen({ frame: 'px-crt', skin: 'skin-gone' }, { skins, owns: () => true }), base, 'unknown skin');
  const cf = F.frameForScreen({ frame: null, skin: 'skin-px-crt-winter', customFrame: { url: 'file:///x.png', hole: { x: 0, y: 0, w: 0.5, h: 0.5 } } }, { skins, owns });
  assert.equal(cf.url, 'file:///x.png');
  assert.deepEqual(F.skinsFor('px-crt', skins).map((k) => k.id), ['skin-px-crt-winter']);
  assert.deepEqual(F.skinsFor('bezel', skins), []);
  assert.equal(F.skinned(base, { id: 'k', frame: 'px-crt', file: '../evil.svg' }), base, 'unsafe file: unchanged');
  // Starter shells take skins too (their geometry is built in).
  const gold = F.frameForScreen({ frame: 'crt-tv', skin: 'skin-crt-tv-gold' }, { skins, owns: () => true });
  assert.match(gold.url, /skin-crt-tv-gold\.svg$/);
  assert.deepEqual(gold.hole, F.frameById('crt-tv').hole);
});

test('economy: skins are earned on the reward track, caught up later, never bought', () => {
  const e = make();
  assert.ok(!e.getState().inventory.includes('skin-crt-tv-gold'), 'a fresh profile has no skins, not even for starter shells');
  assert.equal(e.purchase('skin-crt-tv-gold').reason, 'locked');
  e.grant({ xp: P.xpForLevel(15) });
  let inv = e.getState().inventory;
  assert.ok(inv.includes('skin-crt-tv-gold') && !inv.includes('skin-px-crt-winter'));
  assert.equal(e.purchase('skin-crt-tv-gold').reason, 'owned');
  e.grant({ xp: P.xpForLevel(52) - P.xpForLevel(15) });
  inv = e.getState().inventory;
  for (const id of Object.values(LEVELS)) assert.ok(inv.includes(id), id);
  // A profile saved before a skin became a reward gets it on the next load (without the level's coins).
  const file = path.join(e.dir, 'state.json'), st = JSON.parse(fs.readFileSync(file, 'utf8'));
  st.items = st.items.filter((id) => id !== 'skin-px-arcade-gold');
  fs.writeFileSync(file, JSON.stringify(st));
  const coins = e.getState().coins, e2 = make(e.dir);
  assert.ok(e2.getState().inventory.includes('skin-px-arcade-gold'));
  assert.equal(e2.getState().coins, coins);
  assert.equal(e2.equip('skin', 'skin-px-arcade-gold').reason, 'slot', 'skins are worn per screen, not equipped globally');
});

test('bundles: skins can be sold in a curated weekly bundle', () => {
  const cat = catalogLib.load(), items = bundles.sellable(cat);
  assert.ok(items.has('skin-px-crt-winter'));
  const b = bundles.normBundle({ week: '2026-W45', items: ['skin-px-crt-winter', 'skin-px-arcade-gold'] }, items);
  assert.deepEqual(b.items, ['skin-px-crt-winter', 'skin-px-arcade-gold']);
  const q = bundles.quote(b, cat, () => false);
  assert.equal(q.full, bundles.RARITY_VALUE.rare + bundles.RARITY_VALUE.legendary);
});

test('shop logic: skins index by id and show as level rewards until earned', () => {
  const cat = catalogLib.load(), idx = L.indexCatalog(cat);
  assert.equal(idx.get('skin-px-dungeon-haunted').kind, 'skin');
  assert.equal(L.SHOP_KINDS.skins, 'skin');
  const k = cat.skins.find((s) => s.id === 'skin-px-dungeon-haunted');
  assert.equal(L.itemStatus(k, { coins: 9999, inventory: [] }), 'level');
  assert.equal(L.itemStatus(k, { coins: 0, inventory: [k.id] }), 'owned');
  assert.deepEqual(L.withRewardLevels([{ ...k, unlockLevel: null }], cat.levels)[0].unlockLevel, 49);
});
