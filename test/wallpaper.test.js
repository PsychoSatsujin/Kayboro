// Unit tests for src/main/wallpaperEngine.js against synthetic Wallpaper Engine folders.
const { test, after } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { pathToFileURL } = require('node:url');

const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'kayboro-we-'));
const ROOT = path.join(tmp, 'Steam');
const LIB2 = path.join(tmp, 'Lib2');
process.env.KAYBORO_STEAM_ROOT = ROOT;
after(() => fs.rmSync(tmp, { recursive: true, force: true }));

const { listLocalWallpapers } = require('../src/main/wallpaperEngine');

const put = (f, data = 'x') => {
  fs.mkdirSync(path.dirname(f), { recursive: true });
  fs.writeFileSync(f, data);
};
const ws = (lib, id) => path.join(lib, 'steamapps', 'workshop', 'content', '431960', String(id));
const project = (dir, p, files = []) => {
  put(path.join(dir, 'project.json'), typeof p === 'string' ? p : JSON.stringify(p));
  for (const f of files) put(path.join(dir, f));
};
const url = (...p) => pathToFileURL(path.join(...p)).href;

put(path.join(ROOT, 'steamapps', 'libraryfolders.vdf'), `"libraryfolders" { "0" { "path" "${ROOT}" } "1" { "path" "${LIB2}" } }`);
project(ws(ROOT, 111), { title: 'Neon Rain', type: 'video', file: 'rain.mp4', preview: 'preview.gif' }, ['rain.mp4', 'preview.gif']);
project(ws(ROOT, 222), { title: 'Forest Scene', type: 'scene', file: 'scene.json', preview: 'preview.jpg' }, ['scene.json', 'preview.jpg']);
project(ws(ROOT, 333), { title: 'Clock', type: 'Web', file: 'index.html' }, ['index.html', 'preview.png']);
project(ws(LIB2, 444), '﻿' + JSON.stringify({ title: 'Beach\u0007 Pic', type: 'image', file: 'beach.jpg' }), ['beach.jpg']);
project(ws(LIB2, 555), '{ not json');
project(ws(LIB2, 666), { title: 'Escape', type: 'video', file: '../../../../etc/passwd', preview: '../111/preview.gif' });
project(ws(LIB2, 777), { title: 'Missing file', type: 'video', file: 'gone.mp4' });
project(ws(LIB2, 888), { title: 'An app', type: 'application', file: 'app.exe' }, ['app.exe']);
project(ws(LIB2, 999), { title: 'AVI video', type: 'video', file: 'clip.avi' }, ['clip.avi']);
project(ws(LIB2, 111), { title: 'Duplicate id in another library', type: 'scene' });
project(path.join(LIB2, 'steamapps', 'common', 'wallpaper_engine', 'projects', 'myprojects', 'mine1'), { title: 'My Loop', file: 'loop.webm' }, ['loop.webm']);
put(path.join(ws(ROOT, 'stray-file')));

test('lists video/image/scene/web wallpapers from every library, usable first', async () => {
  const list = (await listLocalWallpapers());
  assert.deepEqual(list.map((w) => w.id), ['444', 'mine1', '111', '999', '333', '666', '222', '777']);
  const by = Object.fromEntries(list.map((w) => [w.id, w]));
  assert.deepEqual(by[111], {
    id: '111', title: 'Neon Rain', type: 'video', previewUrl: url(ws(ROOT, 111), 'preview.gif'), fileUrl: url(ws(ROOT, 111), 'rain.mp4'), usable: true,
  });
  assert.deepEqual(by[222], { id: '222', title: 'Forest Scene', type: 'scene', previewUrl: url(ws(ROOT, 222), 'preview.jpg'), fileUrl: null, usable: false });
  assert.equal(by[333].type, 'web');
  assert.equal(by[333].previewUrl, url(ws(ROOT, 333), 'preview.png')); // found without a "preview" field
  assert.deepEqual(by[444], { id: '444', title: 'Beach Pic', type: 'image', previewUrl: null, fileUrl: url(ws(LIB2, 444), 'beach.jpg'), usable: true });
  assert.deepEqual([by.mine1.type, by.mine1.usable], ['video', true]); // type inferred from the file
});

test('ignores broken projects, applications and paths escaping the wallpaper folder', async () => {
  const by = Object.fromEntries((await listLocalWallpapers()).map((w) => [w.id, w]));
  assert.equal(by[555], undefined);
  assert.equal(by[888], undefined);
  assert.deepEqual([by[666].fileUrl, by[666].previewUrl, by[666].usable], [null, null, false]);
  assert.deepEqual([by[777].fileUrl, by[777].usable], [null, false]);
  assert.deepEqual([by[999].fileUrl, by[999].usable], [null, false]); // not playable in Chromium
});

test('explicit library list and empty cases', async () => {
  assert.deepEqual((await listLocalWallpapers([LIB2])).map((w) => w.id).sort(), ['111', '444', '666', '777', '999', 'mine1']);
  assert.deepEqual((await listLocalWallpapers([path.join(tmp, 'none')])), []);
  assert.deepEqual((await listLocalWallpapers([])), []);
});
