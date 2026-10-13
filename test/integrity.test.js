// Unit tests for the app file check (src/main/economy/integrity.js, tools/integrity/build-manifest.mjs).
const { test, after } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { spawnSync } = require('node:child_process');

const I = require('../src/main/economy/integrity');

const TMP = fs.mkdtempSync(path.join(os.tmpdir(), 'shellcade-int-'));
after(() => fs.rmSync(TMP, { recursive: true, force: true }));

function tree() {
  const root = fs.mkdtempSync(path.join(TMP, 'src-'));
  const files = { 'main/main.js': 'x', 'renderer/app.js': 'y', 'renderer/frames/a.svg': '<svg/>', 'catalog/levels.json': '{}' };
  for (const [rel, body] of Object.entries(files)) {
    fs.mkdirSync(path.dirname(path.join(root, rel)), { recursive: true });
    fs.writeFileSync(path.join(root, rel), body);
  }
  return root;
}

test('no manifest (a dev checkout): the check is skipped', async () => {
  assert.deepEqual(await I.check(tree()), { ok: true, checked: 0, mismatched: [], missing: [], skipped: true });
});

test('manifest: every file but itself; changed and missing files are reported, extra files ignored', async () => {
  const root = tree();
  const m = await I.buildManifest(root);
  assert.deepEqual(Object.keys(m.files), ['catalog/levels.json', 'main/main.js', 'renderer/app.js', 'renderer/frames/a.svg']);
  assert.match(m.files['main/main.js'], /^[0-9a-f]{64}$/);
  fs.writeFileSync(path.join(root, I.MANIFEST), JSON.stringify(m));
  assert.deepEqual(await I.check(root), { ok: true, checked: 4, mismatched: [], missing: [] });

  fs.writeFileSync(path.join(root, 'renderer/app.js'), 'tampered');
  fs.rmSync(path.join(root, 'renderer/frames/a.svg'));
  fs.writeFileSync(path.join(root, 'renderer/new.js'), 'new');
  assert.deepEqual(await I.check(root), { ok: false, checked: 3, mismatched: ['renderer/app.js'], missing: ['renderer/frames/a.svg'] });
  const evil = await I.verify(root, { files: { '../outside.txt': 'x' } });
  assert.equal(evil.checked + evil.missing.length, 0, 'paths outside the root are ignored');
});

test('build-manifest.mjs writes <root>/integrity.json that the check accepts', async () => {
  const root = tree();
  const tool = path.join(__dirname, '..', 'tools', 'integrity', 'build-manifest.mjs');
  const r = spawnSync(process.execPath, [tool, '--root', root], { encoding: 'utf8' });
  assert.equal(r.status, 0, r.stderr);
  assert.match(r.stdout, /4 files/);
  assert.equal(JSON.parse(fs.readFileSync(path.join(root, I.MANIFEST), 'utf8')).algo, 'sha256');
  assert.deepEqual(await I.check(root), { ok: true, checked: 4, mismatched: [], missing: [] });
  // The real src/ tree: lists the shipped files (the manifest itself excluded).
  const files = I.listFiles(I.SRC);
  assert.ok(files.includes('main/main.js') && files.includes('renderer/index.html') && !files.includes(I.MANIFEST));
});
