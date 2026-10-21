// Unit tests for Kayboro's own Steam side: achievements (src/main/steam/kayboroAchievements.js +
// steam/achievements.json), the overlay switch, selfStats muting and DLC ownership in the economy.
const { test, after } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');

const K = require('../src/main/steam/kayboroAchievements');
const overlay = require('../src/main/steam/overlay');
const selfStats = require('../src/main/steam/selfStats');
const { Economy } = require('../src/main/economy/economy');
const catalogLib = require('../src/main/economy/catalog');

const TMP = fs.mkdtempSync(path.join(os.tmpdir(), 'kayboro-kbach-'));
after(() => fs.rmSync(TMP, { recursive: true, force: true }));
let n = 0;
const freshDir = () => path.join(TMP, String(++n));

const SCHEMA = JSON.parse(fs.readFileSync(path.join(__dirname, '..', 'steam', 'achievements.json'), 'utf8'));
const MOTIFS = ['shell', 'play', 'level', 'coin', 'collection', 'time', 'mod', 'preset', 'style', 'legend'];

const frame = (id, extra = {}) => ({ id, kind: 'frame', name: id, price: { coins: 300 }, unlockLevel: null, file: `frames/${id}.svg`, ...extra });
const CAT = {
  frames: [
    frame('crt-tv', { starter: true, price: null }), frame('modded', { mod: { id: 'm' }, price: null }),
    frame('px-a'), frame('px-b', { unlockLevel: 30, price: { coins: 600 } }), frame('lvl', { price: null, unlockLevel: 5 }),
    frame('pp-1', { collection: 'pocket-pals' }), frame('pp-2', { collection: 'pocket-pals' }),
    frame('co-1', { collection: 'coin-op' }), frame('xx-1', { collection: 'unknown-set' }),
  ],
  finishes: [{ id: 'none', kind: 'finish' }, { id: 'gloss', kind: 'finish', price: { coins: 200 } }],
  colorways: [{ id: 'default', kind: 'colorway' }, { id: 'mint', kind: 'colorway', price: { coins: 150 } }],
  fills: [{ id: 'starfield', kind: 'fill' }],
  wallpapers: [], levels: [], takedowns: [],
};
const state = (p = {}) => ({ level: 1, inventory: [], equipped: { finish: 'none', colorway: 'default', fill: 'starfield' }, presets: [], stats: { totalPlaySeconds: 0 }, ...p });

// ---- steam/achievements.json <-> rules ------------------------------------------------------

test('achievements.json: matches the rules, valid schema, 10-14 entries, plain copy', () => {
  const list = SCHEMA.achievements;
  assert.ok(list.length >= 10 && list.length <= 14, `${list.length} achievements`);
  assert.deepEqual(list.map((a) => a.apiName).sort(), [...K.API_NAMES].sort());
  assert.equal(new Set(list.map((a) => a.apiName)).size, list.length);
  for (const a of list) {
    assert.match(a.apiName, /^KB_[A-Z0-9_]{2,60}$/);
    assert.ok(a.name.length >= 3 && a.name.length <= 40, a.name);
    assert.ok(a.desc.length >= 8 && a.desc.length <= 120 && /\.$/.test(a.desc), a.desc);
    assert.ok(!/—/.test(a.name + a.desc), 'no em dashes');
    assert.equal(typeof a.hidden, 'boolean');
    assert.ok(MOTIFS.includes(a.motif), a.motif);
    assert.ok(Number.isInteger(a.value) && a.value > 0);
  }
  assert.deepEqual(Object.keys(SCHEMA), ['achievements']);
});

// ---- earned() -----------------------------------------------------------------------------

test('earned: nothing on a fresh profile, and never throws on junk', () => {
  assert.deepEqual(K.earned(state(), CAT), []);
  assert.deepEqual(K.earned(null, CAT), []);
  assert.deepEqual(K.earned(state(), {}), []);
  assert.deepEqual(K.earned({ level: 'x', inventory: 'nope', equipped: null, stats: null }, CAT, null), []);
});

test('earned: first shell needs a catalog shell (starters and mod shells do not count)', () => {
  assert.deepEqual(K.earned(state({ inventory: ['crt-tv', 'modded'] }), CAT), []);
  assert.deepEqual(K.earned(state({ inventory: ['px-a'] }), CAT), ['KB_FIRST_COIN', 'KB_FIRST_SHELL']);
  assert.deepEqual(K.earned(state({ inventory: ['lvl'], level: 5 }), CAT), ['KB_FIRST_SHELL']);
});

test('earned: levels 10/25/50/100 stack', () => {
  const at = (level) => K.earned(state({ level }), CAT).filter((a) => /^KB_LEVEL/.test(a));
  assert.deepEqual(at(9), []);
  assert.deepEqual(at(10), ['KB_LEVEL_10']);
  assert.deepEqual(at(50), ['KB_LEVEL_10', 'KB_LEVEL_25', 'KB_LEVEL_50']);
  assert.deepEqual(at(100), ['KB_LEVEL_10', 'KB_LEVEL_100', 'KB_LEVEL_25', 'KB_LEVEL_50']);
});

test('earned: a coin purchase is read off the inventory or the preset slots', () => {
  // px-b unlocks at 30: owned at level 12 it must have been bought; owned at level 30 it was a reward.
  assert.ok(K.earned(state({ inventory: ['px-b'], level: 12 }), CAT).includes('KB_FIRST_COIN'));
  assert.ok(!K.earned(state({ inventory: ['px-b'], level: 30 }), CAT).includes('KB_FIRST_COIN'));
  assert.ok(K.earned(state({ inventory: ['gloss'] }), CAT).includes('KB_FIRST_COIN'));
  assert.ok(!K.earned(state({ inventory: ['lvl', 'modded', 'crt-tv'] }), CAT).includes('KB_FIRST_COIN'));
  const preset = K.earned(state({ presets: [{ slot: 0, empty: true }] }), CAT);
  assert.deepEqual(preset, ['KB_FIRST_COIN', 'KB_FIRST_PRESET']);
});

test('earned: collections need every member, empty or unknown collections earn nothing', () => {
  assert.deepEqual(K.byCollection(CAT), { 'pocket-pals': ['pp-1', 'pp-2'], 'coin-op': ['co-1'], 'unknown-set': ['xx-1'] });
  const col = (inv) => K.earned(state({ inventory: inv }), CAT).filter((a) => /^KB_COLLECTION/.test(a));
  assert.deepEqual(col(['pp-1']), []);
  assert.deepEqual(col(['pp-1', 'pp-2']), ['KB_COLLECTION_POCKET_PALS']);
  assert.deepEqual(col(['pp-1', 'pp-2', 'co-1', 'xx-1']), ['KB_COLLECTION_COIN_OP', 'KB_COLLECTION_POCKET_PALS']);
  // blue-cel has no members in this catalog (and none in the shipped one yet): not earned by owning everything.
  const all = CAT.frames.map((f) => f.id);
  assert.ok(!K.earned(state({ inventory: all }), CAT).includes('KB_COLLECTION_BLUE_CEL'));
  assert.ok(!K.earned(state({ inventory: catalogLib.load().frames.map((f) => f.id) }), catalogLib.load()).some((a) => /^KB_COLLECTION/.test(a)) ||
    Object.keys(K.byCollection(catalogLib.load())).length > 0, 'the shipped catalog has no collection members yet');
  // A mod shell tagged with a collection name does not count for it.
  const withMod = { ...CAT, frames: [...CAT.frames, frame('mod-pp', { mod: { id: 'm' }, collection: 'pocket-pals' })] };
  assert.deepEqual(K.earned(state({ inventory: ['pp-1', 'pp-2'] }), withMod).filter((a) => /^KB_COLL/.test(a)), ['KB_COLLECTION_POCKET_PALS']);
});

test('earned: time, style, play and mods', () => {
  assert.ok(!K.earned(state({ stats: { totalPlaySeconds: K.TEN_HOURS - 1 } }), CAT).includes('KB_TIME_10H'));
  assert.ok(K.earned(state({ stats: { totalPlaySeconds: K.TEN_HOURS } }), CAT).includes('KB_TIME_10H'));
  const eq = (finish, colorway, fill) => K.earned(state({ equipped: { finish, colorway, fill } }), CAT).includes('KB_FULL_STYLE');
  assert.equal(eq('gloss', 'mint', 'starfield'), true);
  assert.equal(eq('none', 'mint', 'starfield'), false);
  assert.equal(eq('gloss', 'default', 'starfield'), false);
  assert.equal(eq('gloss', 'mint', null), false);
  assert.deepEqual(K.earned(state(), CAT, { played: true }), ['KB_FIRST_PLAY']);
  assert.deepEqual(K.earned(state(), CAT, { played: 'yes' }), []);
  assert.deepEqual(K.earned(state(), CAT, { mods: 2 }), ['KB_FIRST_MOD']);
  assert.deepEqual(K.earned(state(), CAT, { mods: 0 }), []);
});

test('earned: the shipped catalog and a real economy state work together', () => {
  const eco = new Economy({ dir: freshDir() });
  assert.deepEqual(K.earned(eco.getState(), catalogLib.load(), {}), []);
  eco.grant({ xp: 10000, coins: 5000 }); // level 50+: level rewards include shells and a finish
  const got = K.earned(eco.getState(), catalogLib.load(), {});
  assert.ok(got.includes('KB_LEVEL_50') && got.includes('KB_FIRST_SHELL'), got.join());
  assert.ok(!got.includes('KB_FIRST_COIN'), 'level rewards are not purchases');
  assert.ok(eco.buyPresetSlot().ok);
  assert.ok(K.earned(eco.getState(), catalogLib.load(), {}).includes('KB_FIRST_COIN'));
});

// ---- createUnlocker() -----------------------------------------------------------------------

const fakeStats = (p = {}) => {
  const calls = [];
  const unlocked = new Set(p.unlocked || []);
  return {
    calls, unlocked, available: true, muted: () => false, store: () => calls.push('store'),
    isUnlocked: (a) => unlocked.has(a),
    unlock: (a) => { calls.push(a); if (p.fail && p.fail.includes(a)) return false; unlocked.add(a); return true; },
    ...p.over,
  };
};

test('unlocker: sends each newly earned achievement once, stores, skips the ones Steam already has', () => {
  const stats = fakeStats({ unlocked: ['KB_LEVEL_10'] });
  const u = K.createUnlocker({ stats, log: { warn() {} } });
  assert.deepEqual(u.sync(state({ level: 25 }), CAT, {}), ['KB_LEVEL_10', 'KB_LEVEL_25']);
  assert.deepEqual(stats.calls, ['KB_LEVEL_25', 'store']);
  assert.deepEqual(u.sync(state({ level: 25 }), CAT, {}), []);
  assert.deepEqual(stats.calls, ['KB_LEVEL_25', 'store']);
  assert.deepEqual(u.sync(state({ level: 25 }), CAT, { played: true }), ['KB_FIRST_PLAY']);
});

test('unlocker: a failed unlock is retried next time; errors are contained', () => {
  const stats = fakeStats({ fail: ['KB_LEVEL_10'] });
  const u = K.createUnlocker({ stats, log: { warn() {} } });
  assert.deepEqual(u.sync(state({ level: 10 }), CAT, {}), []);
  assert.deepEqual(u.sync(state({ level: 10 }), CAT, {}), []);
  assert.deepEqual(stats.calls, ['KB_LEVEL_10', 'KB_LEVEL_10']);
  const boom = fakeStats({ over: { unlock() { throw new Error('steam down'); } } });
  assert.deepEqual(K.createUnlocker({ stats: boom, log: { warn() {} } }).sync(state({ level: 10 }), CAT, {}), []);
});

test('unlocker: no-op without steamworks, when muted (sandbox/test), and without a stats object', () => {
  for (const stats of [null, fakeStats({ over: { available: false } }), fakeStats({ over: { muted: () => true } })]) {
    const u = K.createUnlocker({ stats });
    assert.deepEqual(u.sync(state({ level: 100 }), CAT, { played: true, mods: 1 }), []);
    if (stats) assert.deepEqual(stats.calls, []);
  }
});

// ---- selfStats / overlay ----------------------------------------------------------------------

test('selfStats: muted in the sandbox and in tests, never unlocks there; DLC/connected are safe no-ops', () => {
  assert.equal(selfStats.muted({ KAYBORO_SANDBOX: '1' }), true);
  assert.equal(selfStats.muted({ KAYBORO_TEST: '1' }), true);
  assert.equal(selfStats.muted({}), false);
  const was = { S: process.env.KAYBORO_SANDBOX, T: process.env.KAYBORO_TEST };
  try {
    process.env.KAYBORO_SANDBOX = '1';
    assert.equal(selfStats.unlock('KB_LEVEL_10'), false);
  } finally {
    if (was.S === undefined) delete process.env.KAYBORO_SANDBOX; else process.env.KAYBORO_SANDBOX = was.S;
  }
  assert.equal(typeof selfStats.available, 'boolean');
  assert.equal(selfStats.ownsDlc(123), false); // no Steam client in a unit test run
  assert.equal(selfStats.ownsDlc('123'), false);
  assert.equal(selfStats.ownsDlc(0), false);
  assert.equal(selfStats.connected(), false);
  assert.equal(selfStats.store(), false);
});

test('overlay.isUnderSteam: Steam env vars, KAYBORO_STEAM_APPID or steam_appid.txt next to the exe', () => {
  const no = () => false;
  assert.equal(overlay.isUnderSteam({ env: {}, exeDir: 'x', exists: no }), false);
  assert.equal(overlay.isUnderSteam({ env: { SteamAppId: '480' }, exeDir: 'x', exists: no }), true);
  assert.equal(overlay.isUnderSteam({ env: { SteamGameId: '480' }, exeDir: 'x', exists: no }), true);
  assert.equal(overlay.isUnderSteam({ env: { KAYBORO_STEAM_APPID: '480' }, exeDir: 'x', exists: no }), true);
  assert.equal(overlay.isUnderSteam({ env: { SteamAppId: '0' }, exeDir: 'x', exists: no }), false);
  assert.equal(overlay.isUnderSteam({ env: {}, exeDir: 'x', exists: (f) => f === path.join('x', 'steam_appid.txt') }), true);
  assert.equal(overlay.isUnderSteam({ env: {}, exeDir: 'x', exists: () => { throw new Error('io'); } }), false);
});

test('overlay.enable: only under Steam, never in tests, failures are swallowed', () => {
  let calls = 0;
  const sw = { electronEnableSteamOverlay: () => calls++ };
  assert.equal(overlay.enable({ env: {}, load: () => sw, under: () => false }), false);
  assert.equal(overlay.enable({ env: { KAYBORO_TEST: '1' }, load: () => sw, under: () => true }), false);
  assert.equal(overlay.enable({ env: { KAYBORO_NO_OVERLAY: '1' }, load: () => sw, under: () => true }), false);
  assert.equal(calls, 0);
  assert.equal(overlay.enable({ env: {}, load: () => sw, under: () => true }), true);
  assert.equal(calls, 1);
  assert.equal(overlay.enable({ env: {}, load: () => { throw new Error('no steamworks.js'); }, under: () => true }), false);
  assert.equal(overlay.enable({ env: {}, load: () => ({}), under: () => true }), false);
});

// ---- DLC in the economy ---------------------------------------------------------------------

test('economy: DLC items are owned only through ownsDlc(appid)', () => {
  const cat = { ...catalogLib.load() };
  cat.frames = [...cat.frames, { id: 't-dlc', name: 'DLC', kind: 'frame', rarity: 'legendary', price: null, unlockLevel: null, dlc: { appid: 999 }, file: 'frames/t.svg' },
    { id: 't-dlc-bad', name: 'DLC', kind: 'frame', rarity: 'legendary', price: null, unlockLevel: null, dlc: { appid: null }, file: 'frames/t.svg' }];
  const owned = new Set([999]);
  const eco = new Economy({ dir: freshDir(), catalog: cat, ownsDlc: (id) => owned.has(id) });
  assert.ok(eco.getState().inventory.includes('t-dlc'));
  assert.ok(!eco.getState().inventory.includes('t-dlc-bad'));
  assert.equal(eco.purchase('t-dlc').reason, 'owned');
  owned.clear();
  assert.ok(!eco.getState().inventory.includes('t-dlc'));
  assert.equal(eco.purchase('t-dlc').reason, 'paid');
  // Default: nothing is owned; a throwing or truthy-but-not-true checker counts as not owned.
  assert.ok(!new Economy({ dir: freshDir(), catalog: cat }).getState().inventory.includes('t-dlc'));
  assert.ok(!new Economy({ dir: freshDir(), catalog: cat, ownsDlc: () => { throw new Error('x'); } }).getState().inventory.includes('t-dlc'));
  assert.ok(!new Economy({ dir: freshDir(), catalog: cat, ownsDlc: () => 1 }).getState().inventory.includes('t-dlc'));
  assert.ok(!new Economy({ dir: freshDir(), catalog: cat, ownsDlc: 'nope' }).getState().inventory.includes('t-dlc'));
});
