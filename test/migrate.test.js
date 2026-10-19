// Unit tests for the one-time Shellcade -> Kayboro data copy (src/main/migrate.js).
const { test, after } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');

const { migrateLegacyData, migrateUserData, renameSources } = require('../src/main/migrate');

const TMP = fs.mkdtempSync(path.join(os.tmpdir(), 'kayboro-migrate-'));
after(() => fs.rmSync(TMP, { recursive: true, force: true }));

const read = (...p) => fs.readFileSync(path.join(...p), 'utf8');
function legacy(state = { coins: 42, activeWallpaper: { stage: { source: 'shellcade', id: 'wp-nebula-drift' }, fill: null } }) {
  const root = fs.mkdtempSync(path.join(TMP, 'appData-'));
  const dir = path.join(root, 'Shellcade', 'shellcade');
  fs.mkdirSync(path.join(dir, 'mods', 'm1'), { recursive: true });
  fs.writeFileSync(path.join(dir, 'state.json'), JSON.stringify(state));
  fs.writeFileSync(path.join(dir, 'history.jsonl'), '{"t":1}\n');
  fs.writeFileSync(path.join(dir, 'mods', 'm1', 'mod.json'), '{"id":"m1"}');
  fs.writeFileSync(path.join(root, 'Shellcade', 'scenes.json'), '{"a":{}}');
  fs.mkdirSync(path.join(root, 'Shellcade', 'Local Storage', 'leveldb'), { recursive: true });
  fs.writeFileSync(path.join(root, 'Shellcade', 'Local Storage', 'leveldb', '000003.log'), 'ls');
  return { root, dir, scenes: path.join(root, 'Shellcade', 'scenes.json'), userData: path.join(root, 'Kayboro') };
}

test('copies the legacy folder recursively, keeps it intact and renames built-in wallpaper sources', () => {
  const L = legacy();
  const dataDir = path.join(L.userData, 'kayboro');
  assert.equal(migrateLegacyData({ legacyDir: L.dir, dataDir, legacyScenes: L.scenes, scenes: path.join(L.userData, 'scenes.json') }), true);
  const st = JSON.parse(read(dataDir, 'state.json'));
  assert.equal(st.coins, 42);
  assert.deepEqual(st.activeWallpaper.stage, { source: 'kayboro', id: 'wp-nebula-drift' });
  assert.equal(read(dataDir, 'history.jsonl'), '{"t":1}\n');
  assert.equal(read(dataDir, 'mods', 'm1', 'mod.json'), '{"id":"m1"}');
  assert.equal(read(L.userData, 'scenes.json'), '{"a":{}}');
  assert.ok(!fs.existsSync(path.join(L.userData, 'Local Storage')), 'Local Storage only when asked');
  assert.equal(JSON.parse(read(L.dir, 'state.json')).activeWallpaper.stage.source, 'shellcade', 'legacy data is never changed');
  assert.ok(fs.existsSync(L.scenes));
});

test('saved scenes keep their built-in wallpapers, and Local Storage is copied', () => {
  const L = legacy();
  const scene = { background: { type: 'wallpaper', ref: { source: 'shellcade', id: 'wp-nebula-drift' } }, screens: [{ id: 's1', fill: { source: 'shellcade', id: 'wp-x' } }, { id: 's2', fill: { source: 'we', id: 'w' } }] };
  fs.writeFileSync(L.scenes, JSON.stringify({ desk: scene }));
  const dataDir = path.join(L.userData, 'kayboro'), scenes = path.join(L.userData, 'scenes.json');
  assert.equal(migrateLegacyData({ legacyDir: L.dir, dataDir, legacyScenes: L.scenes, scenes,
    legacyStorage: path.join(L.root, 'Shellcade', 'Local Storage'), storage: path.join(L.userData, 'Local Storage') }), true);
  const d = JSON.parse(read(scenes)).desk;
  assert.deepEqual(d.background.ref, { source: 'kayboro', id: 'wp-nebula-drift' });
  assert.deepEqual(d.screens.map(s => s.fill.source), ['kayboro', 'we']);
  assert.equal(read(L.userData, 'Local Storage', 'leveldb', '000003.log'), 'ls');
  assert.equal(JSON.parse(read(L.scenes)).desk.background.ref.source, 'shellcade', 'legacy scenes are never changed');
  assert.ok(!fs.existsSync(scenes + '.tmp') && !fs.existsSync(path.join(dataDir, 'state.json.tmp')));
});

test('an interrupted copy (no state.json yet) runs again and still renames sources', () => {
  const L = legacy();
  const dataDir = path.join(L.userData, 'kayboro');
  fs.mkdirSync(dataDir, { recursive: true });
  fs.writeFileSync(path.join(dataDir, 'history.jsonl'), '{"t":1}\n');
  assert.equal(migrateLegacyData({ legacyDir: L.dir, dataDir }), true);
  assert.equal(JSON.parse(read(dataDir, 'state.json')).activeWallpaper.stage.source, 'kayboro');
});

test('runs once: an existing state.json wins, and existing files are never overwritten', () => {
  const L = legacy();
  const dataDir = path.join(L.userData, 'kayboro');
  fs.mkdirSync(dataDir, { recursive: true });
  fs.writeFileSync(path.join(dataDir, 'state.json'), '{"coins":7}');
  assert.equal(migrateLegacyData({ legacyDir: L.dir, dataDir }), false);
  assert.equal(read(dataDir, 'state.json'), '{"coins":7}');
  assert.ok(!fs.existsSync(path.join(dataDir, 'history.jsonl')));

  const M = legacy(), dir2 = path.join(M.userData, 'kayboro');
  fs.mkdirSync(path.join(dir2, 'mods', 'm1'), { recursive: true });
  fs.writeFileSync(path.join(dir2, 'mods', 'm1', 'mod.json'), '{"id":"mine"}');
  fs.mkdirSync(M.userData, { recursive: true });
  fs.writeFileSync(path.join(M.userData, 'scenes.json'), '{"b":{}}');
  assert.equal(migrateLegacyData({ legacyDir: M.dir, dataDir: dir2, legacyScenes: M.scenes, scenes: path.join(M.userData, 'scenes.json') }), true);
  assert.equal(read(dir2, 'mods', 'm1', 'mod.json'), '{"id":"mine"}');
  assert.equal(read(M.userData, 'scenes.json'), '{"b":{}}');
  assert.equal(JSON.parse(read(dir2, 'state.json')).coins, 42);
});

test('no legacy folder: nothing happens', () => {
  const dataDir = path.join(TMP, 'fresh', 'kayboro');
  assert.equal(migrateLegacyData({ legacyDir: path.join(TMP, 'nope'), dataDir }), false);
  assert.ok(!fs.existsSync(dataDir));
});

test('an unreadable legacy state.json is copied as-is', () => {
  const L = legacy();
  fs.writeFileSync(path.join(L.dir, 'state.json'), '{not json');
  const dataDir = path.join(L.userData, 'kayboro');
  assert.equal(migrateLegacyData({ legacyDir: L.dir, dataDir }), true);
  assert.equal(read(dataDir, 'state.json'), '{not json');
});

test('renameSources: only built-in wallpaper sources change', () => {
  const s = { wallpaperPresets: [{ slot: 0, wallpaper: { source: 'shellcade', id: 'a' } }, { slot: 1, wallpaper: { source: 'mod', id: 'b' } }], name: 'shellcade' };
  assert.deepEqual(renameSources(s), { wallpaperPresets: [{ slot: 0, wallpaper: { source: 'kayboro', id: 'a' } }, { slot: 1, wallpaper: { source: 'mod', id: 'b' } }], name: 'shellcade' });
});

test('migrateUserData: never throws, skipped in test runs', () => {
  const prev = process.env.KAYBORO_TEST;
  try {
    delete process.env.KAYBORO_TEST;
    assert.equal(migrateUserData({ getPath() { throw new Error('boom'); } }), false);
    const L = legacy();
    assert.equal(migrateUserData({ getPath: (k) => (k === 'appData' ? L.root : L.userData) }), true);
    assert.equal(JSON.parse(read(L.userData, 'kayboro', 'state.json')).coins, 42);
    process.env.KAYBORO_TEST = '1';
    const M = legacy();
    assert.equal(migrateUserData({ getPath: (k) => (k === 'appData' ? M.root : M.userData) }), false);
  } finally {
    if (prev === undefined) delete process.env.KAYBORO_TEST; else process.env.KAYBORO_TEST = prev;
  }
});

test('renderer settings: shellcade.* keys are copied once to kayboro.* with sources renamed', async () => {
  const { migrateLegacyKeys } = await import('../src/renderer/legacy-storage.js');
  const m = new Map(Object.entries({ 'shellcade.muted': '1', 'shellcade.tab': 'shop', 'kayboro.tab': 'stage', 'ror.lastScene': 'x',
    'shellcade.lastScene': JSON.stringify({ background: { ref: { source: 'shellcade', id: 'a' } } }) }));
  const store = { get length() { return m.size; }, key: (i) => [...m.keys()][i] ?? null, getItem: (k) => (m.has(k) ? m.get(k) : null), setItem: (k, v) => m.set(k, String(v)) };
  assert.equal(migrateLegacyKeys(store), 2);
  assert.equal(m.get('kayboro.muted'), '1');
  assert.equal(m.get('kayboro.tab'), 'stage', 'an existing kayboro.* key wins');
  assert.equal(JSON.parse(m.get('kayboro.lastScene')).background.ref.source, 'kayboro');
  assert.equal(m.get('shellcade.muted'), '1', 'old keys are kept');
  m.set('shellcade.sections', '{}');
  assert.equal(migrateLegacyKeys(store), 0, 'runs once');
});
