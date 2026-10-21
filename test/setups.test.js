// Saved configurations: the game-setups store (src/main/setups.js) and the renderer helpers that capture and
// load them (src/renderer/setups.js). Preset slots are covered in economy.test.js.
const { test, before, after } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const S = require('../src/main/setups');

const TMP = fs.mkdtempSync(path.join(os.tmpdir(), 'kayboro-setups-'));
after(() => fs.rmSync(TMP, { recursive: true, force: true }));
let n = 0;
const freshDir = () => { const d = path.join(TMP, String(++n)); fs.mkdirSync(d, { recursive: true }); return d; };

let R;
before(async () => { R = await import('../src/renderer/setups.js'); });

const screen = (id, o = {}) => ({ id, frame: 'px-crt', skin: null, colorway: 'default', finish: 'none', fill: null, fillClarity: 0, rect: { x: 0, y: 0, w: 320, h: 180 }, z: 1, sourceId: null, sourceName: '', hwnd: null, exePath: null, ...o });
const scene = (screens, o = {}) => ({ version: 1, background: { type: 'color', color: '#000000' }, screens, selectedId: screens[0]?.id ?? null, ...o });
const config = (sc = scene([screen('a')])) => ({ version: 1, scene: sc, fx: { particles: true, glass: false, depth: true } });

test('setups: cleanConfig keeps a whole setup and refuses junk', () => {
  const c = config();
  assert.deepEqual(S.cleanConfig(c), c);
  assert.deepEqual(S.cleanConfig({ scene: c.scene, fx: { glass: false, extra: 1 } }).fx, { particles: true, glass: false, depth: true });
  assert.equal(S.cleanConfig({ scene: c.scene }).fx, null);
  for (const bad of [null, 'x', [], {}, { scene: {} }, { scene: { screens: [1] } }, { scene: { screens: Array(33).fill({}) } }, { scene: { screens: [{ x: 'y'.repeat(S.MAX_BYTES) }] } }]) {
    assert.equal(S.cleanConfig(bad), null, JSON.stringify(bad).slice(0, 60));
  }
  assert.deepEqual(S.cleanConfig({ wallpaper: { source: 'we', id: '1' } }), { version: 1, wallpaper: { source: 'we', id: '1' } });
});

test('setups: summaries and game links', () => {
  const c = config(scene([screen('a'), screen('b', { frame: 'handheld' }), screen('c', { frame: null, customFrame: { url: 'x' } }), screen('d', { frame: 'px-crt' })], { background: { type: 'wallpaper' } }));
  assert.deepEqual(S.summarize(c), { screens: 4, frames: ['px-crt', 'handheld', 'custom'], background: 'wallpaper', wallpaperOnly: false });
  assert.deepEqual(S.cleanGame({ appid: '570', exe: 'C:\\Steam\\steamapps\\common\\dota 2\\Dota2.EXE', name: 'Dota 2' }), { appid: 570, exe: 'dota2.exe', name: 'Dota 2' });
  assert.deepEqual(S.cleanGame({ exe: '/games/celeste.exe' }), { appid: null, exe: 'celeste.exe', name: 'celeste' });
  assert.deepEqual(S.cleanGame({ appid: 10 }), { appid: 10, exe: null, name: 'App 10' });
  assert.equal(S.cleanGame({ appid: -1, exe: '' }), null);
  assert.equal(S.cleanGame(null), null);
});

test('setups: save, update by name, load, delete; unlimited and free', () => {
  let t = 1000;
  const dir = freshDir();
  const st = S.create({ dir, now: () => t++ });
  assert.deepEqual(st.list(), []);
  const a = st.save({ name: 'Cozy CRT', game: null, config: config() });
  assert.match(a.id, /^[a-f0-9]{12}$/);
  assert.deepEqual(a.summary, { screens: 1, frames: ['px-crt'], background: 'color', wallpaperOnly: false });
  const b = st.save({ name: 'Arcade night', game: { exe: 'C:\\Games\\Celeste\\Celeste.exe', name: 'Celeste' }, config: config() });
  assert.deepEqual(b.game, { appid: null, exe: 'celeste.exe', name: 'Celeste' });
  assert.deepEqual(st.list().map((s) => s.name), ['Arcade night', 'Cozy CRT'], 'sorted by name');
  const a2 = st.save({ name: 'Cozy CRT', config: config(scene([screen('a'), screen('b')])) });
  assert.equal(a2.id, a.id, 'saving under the same name updates it');
  assert.equal(st.list().length, 2);
  assert.equal(st.load(a.id).config.scene.screens.length, 2);
  assert.equal(st.save({ name: '', config: config() }), null);
  assert.equal(st.save({ name: 'x', config: { scene: { screens: 'no' } } }), null);
  assert.equal(st.save({ name: 'x', config: { version: 1, wallpaper: { source: 'we', id: '1' } } }), null, 'a setup is a whole stage');
  for (let i = 0; i < 40; i++) assert.ok(st.save({ name: `Setup ${i}`, config: config() }));
  const again = S.create({ dir });
  assert.equal(again.list().length, 42, 'persists');
  assert.equal(st.remove(a.id), true);
  assert.equal(st.remove(a.id), false);
  assert.equal(st.load(a.id), null);
});

test('setups: the setup linked to a launched game, by Steam app id then program name', () => {
  let t = 0;
  const st = S.create({ dir: freshDir(), now: () => ++t });
  st.save({ name: 'By exe', game: { exe: 'D:\\x\\game.exe' }, config: config() });
  st.save({ name: 'By appid', game: { appid: 570, name: 'Dota 2' }, config: config() });
  st.save({ name: 'Newer exe', game: { exe: 'game.exe' }, config: config() });
  st.save({ name: 'Unlinked', config: config() });
  assert.equal(st.forGame({ appid: 570, exePath: 'C:\\other.exe' }).name, 'By appid');
  assert.equal(st.forGame({ appid: null, exePath: 'E:\\Games\\GAME.exe' }).name, 'Newer exe', 'the most recently saved match wins');
  assert.equal(st.forGame({ appid: 1, exePath: 'nope.exe' }), null);
  assert.equal(st.forGame(null), null);
  assert.deepEqual([...st.exes()].sort(), ['game.exe']);
});

test('setups: old named scenes become setups with no game, once', () => {
  const dir = freshDir();
  const sc = scene([screen('a', { sourceId: 'window:1:0', hwnd: '1' })]);
  fs.writeFileSync(path.join(dir, 'scenes.json'), JSON.stringify({ 'Cozy CRT': sc, broken: { screens: 'x' } }));
  const st = S.create({ dir });
  const list = st.list();
  assert.deepEqual(list.map((s) => [s.name, s.game]), [['Cozy CRT', null]]);
  assert.deepEqual(st.load(list[0].id).config, { version: 1, scene: sc, fx: null });
  assert.ok(fs.existsSync(path.join(dir, 'setups.json')));
  assert.ok(fs.existsSync(path.join(dir, 'scenes.json')), 'the old file stays');
  st.remove(list[0].id);
  assert.deepEqual(S.create({ dir }).list(), [], 'not migrated again');
});

test('renderer: captureConfig saves everything but the live game windows', () => {
  const sc = scene([screen('a', { skin: 'skin-px-crt-winter', colorway: 'berry', fillClarity: 0.5, sourceId: 'window:9:0', sourceName: 'Celeste', hwnd: '9', exePath: 'C:\\c.exe', popout: { pinned: true } })]);
  const c = R.captureConfig(sc, { particles: false, glass: true, depth: false, junk: 1 });
  assert.deepEqual(c.fx, { particles: false, glass: true, depth: false });
  const s = c.scene.screens[0];
  assert.deepEqual([s.skin, s.colorway, s.fillClarity, s.popout], ['skin-px-crt-winter', 'berry', 0.5, { pinned: true }]);
  assert.deepEqual([s.sourceId, s.sourceName, s.hwnd, s.exePath], [null, '', null, null]);
  assert.equal(sc.screens[0].hwnd, '9', 'the live scene is untouched');
  assert.ok(S.cleanConfig(c), 'main accepts what the renderer saves');
});

test('renderer: sceneFromConfig keeps the games on screen, hosted first, into the selected screen first', () => {
  const cur = scene([screen('x', { z: 1, sourceId: 's1', hwnd: '1' }), screen('y', { z: 3, sourceId: 's2', hwnd: '2' }), screen('z', { z: 2 })]);
  const saved = scene([screen('p', { z: 1 }), screen('q', { z: 2, sourceId: 'stale', hwnd: '77' }), screen('r', { z: 3 })], { selectedId: 'p' });
  const out = R.sceneFromConfig({ scene: saved }, cur, 'x');
  const by = Object.fromEntries(out.screens.map((s) => [s.id, s.hwnd]));
  assert.deepEqual(by, { p: '1', r: '2', q: null }, 'hosted game -> selected screen, next game -> the top screen, stale windows cleared');
  assert.equal(saved.screens[1].hwnd, '77', 'the saved config is untouched');
  const res = R.sceneFromConfig({ scene: saved }, cur, 'x', { reserveSelected: true });
  assert.deepEqual(Object.fromEntries(res.screens.map((s) => [s.id, s.hwnd])), { p: null, r: '1', q: '2' }, 'a launching game gets the selected screen');
  const wp = R.sceneFromConfig({ wallpaper: { source: 'we', id: '42' } }, cur);
  assert.deepEqual(wp.background, { type: 'wallpaper', color: '#000000', ref: { source: 'we', id: '42' } });
  assert.equal(wp.screens.length, 3, 'a wallpaper-only preset leaves the screens alone');
  assert.equal(R.sceneFromConfig(null, cur), null);
  assert.equal(R.sceneFromConfig({ scene: { screens: 'x' } }, cur), null);
});

test('renderer: gameOf and describe', () => {
  assert.deepEqual(R.gameOf(screen('a', { exePath: 'C:\\Games\\Hades\\Hades.exe', sourceName: 'Hades' }), 1145360), { appid: 1145360, exe: 'hades.exe', name: 'Hades' });
  assert.equal(R.gameOf(screen('a')), null);
  const names = { 'px-crt': 'Rabbit-Ear CRT', handheld: 'Handheld' };
  assert.equal(R.describe({ screens: 1, frames: ['px-crt'] }, (id) => names[id]), '1 screen · Rabbit-Ear CRT');
  assert.equal(R.describe({ screens: 4, frames: ['px-crt', 'handheld', 'custom', 'z'] }, (id) => names[id] || id), '4 screens · Rabbit-Ear CRT, Handheld +2');
  assert.equal(R.describe({ wallpaperOnly: true }), 'Wallpaper only');
  assert.equal(R.describe({ screens: 2, frames: [] }), '2 screens');
});
