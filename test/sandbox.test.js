// Unit tests for the tester sandbox (src/main/sandbox.js): env-only switch, userData location,
// apply() and the reset that may only ever clear the sandbox profile.
const { test, after } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { EventEmitter } = require('node:events');

const sandbox = require('../src/main/sandbox');
const { Economy } = require('../src/main/economy/economy');

const TMP = fs.mkdtempSync(path.join(os.tmpdir(), 'kayboro-sandbox-'));
after(() => fs.rmSync(TMP, { recursive: true, force: true }));

// Runs fn with sandbox.enabled/dir swapped in, restoring them afterwards.
function withSandbox(dir, fn) {
  const was = { enabled: sandbox.enabled, dir: sandbox.dir };
  Object.assign(sandbox, { enabled: !!dir, dir });
  try { return fn(); } finally { Object.assign(sandbox, was); }
}
const fakeApp = () => Object.assign(new EventEmitter(), { paths: {}, setPath(k, v) { this.paths[k] = v; } });

test('only KAYBORO_SANDBOX=1 turns it on, and never inside test runs', () => {
  assert.equal(sandbox.isEnabled({ KAYBORO_SANDBOX: '1' }), true);
  for (const v of [undefined, '', '0', 'true', 'yes', ' 1', 'TRUE']) assert.equal(sandbox.isEnabled({ KAYBORO_SANDBOX: v }), false, `KAYBORO_SANDBOX=${v}`);
  assert.equal(sandbox.isEnabled({ KAYBORO_SANDBOX: '1', KAYBORO_TEST: '1' }), false);
  assert.equal(sandbox.isEnabled({}), false);
  assert.equal(sandbox.isEnabled(), false);
});

test('this test process (no KAYBORO_SANDBOX) is not a sandbox run', { skip: process.env.KAYBORO_SANDBOX === '1' }, () => {
  assert.equal(sandbox.enabled, false);
  assert.equal(sandbox.dir, null);
});

test('userData: repo .sandbox in dev, appData in packaged builds, KAYBORO_SANDBOX_DIR wins', () => {
  const root = path.join(TMP, 'repo'), appData = path.join(TMP, 'appData');
  assert.equal(sandbox.resolveDir({ env: {}, root }), path.join(root, '.sandbox', 'userData'));
  assert.equal(sandbox.resolveDir({ env: {}, root, packaged: true, appData }), path.join(appData, 'Kayboro Sandbox', 'userData'));
  assert.equal(sandbox.resolveDir({ env: { KAYBORO_SANDBOX_DIR: path.join(TMP, 'x') }, root, packaged: true, appData }), path.join(TMP, 'x'));
  assert.equal(sandbox.resolveDir({ env: { KAYBORO_SANDBOX_DIR: '  ' }, root }), path.join(root, '.sandbox', 'userData'));
  assert.ok(path.isAbsolute(sandbox.resolveDir({ env: { KAYBORO_SANDBOX_DIR: 'rel/dir' } })));
  assert.equal(sandbox.resolveDir().endsWith(path.join('.sandbox', 'userData')), true, 'defaults to the repo');
});

test('isInside only accepts real descendants', () => {
  const base = path.join(TMP, 'sb');
  assert.equal(sandbox.isInside(path.join(base, 'kayboro'), base), true);
  assert.equal(sandbox.isInside(base, base), false);
  assert.equal(sandbox.isInside(path.join(base, '..', 'other'), base), false);
  assert.equal(sandbox.isInside(path.join(TMP, 'sb2', 'kayboro'), base), false);
});

test('apply() does nothing when the sandbox is off', () => {
  const app = fakeApp();
  assert.equal(withSandbox(null, () => sandbox.apply(app)), sandbox);
  assert.deepEqual(app.paths, {});
  assert.equal(app.listenerCount('browser-window-created'), 0);
});

test('apply() moves userData into the sandbox and marks window titles', () => {
  const dir = path.join(TMP, 'apply', 'userData'), app = fakeApp();
  withSandbox(dir, () => sandbox.apply(app));
  assert.equal(app.paths.userData, dir);
  assert.ok(fs.statSync(dir).isDirectory());
  const w = Object.assign(new EventEmitter(), { title: '', setTitle(t) { this.title = t; } });
  app.emit('browser-window-created', {}, w);
  let prevented = 0;
  w.emit('page-title-updated', { preventDefault: () => prevented++ }, 'Kayboro');
  assert.equal(w.title, 'Kayboro (Sandbox)');
  w.emit('page-title-updated', { preventDefault: () => prevented++ }, 'Kayboro (Sandbox)');
  assert.equal(w.title, 'Kayboro (Sandbox)');
  assert.equal(prevented, 2);
});

test('resetProfile() starts the sandbox economy over, in memory and on disk', () => {
  const sbDir = path.join(TMP, 'reset', 'userData'), dir = path.join(sbDir, 'kayboro');
  const eco = new Economy({ dir });
  eco.grant({ coins: 5000, xp: 3000 });
  fs.mkdirSync(path.join(dir, 'mods', 'm1'), { recursive: true });
  assert.ok(fs.existsSync(path.join(dir, 'state.json')));
  assert.ok(fs.existsSync(path.join(dir, 'history.jsonl')), 'level-ups were logged');
  const pushed = [];
  eco.on('state', (s) => pushed.push(s));
  const s = sandbox.resetProfile({ economy: eco, dir, sandboxDir: sbDir });
  assert.equal(s.coins, 0);
  assert.equal(s.level, 1);
  assert.equal(eco.getState().coins, 0);
  assert.equal(JSON.parse(fs.readFileSync(path.join(dir, 'state.json'), 'utf8')).coins, 0);
  assert.ok(!fs.existsSync(path.join(dir, 'history.jsonl')));
  assert.ok(fs.existsSync(path.join(dir, 'mods', 'm1')), 'mods are kept');
  assert.equal(pushed.length, 1);
  assert.equal(new Economy({ dir }).getState().coins, 0, 'a restart sees the reset');
});

test('resetProfile() refuses anything outside the sandbox', () => {
  const real = path.join(TMP, 'real', 'kayboro');
  const eco = new Economy({ dir: real });
  eco.grant({ coins: 77 });
  assert.throws(() => sandbox.resetProfile({ economy: eco, dir: real, sandboxDir: path.join(TMP, 'sb3') }), /only allowed inside the sandbox/);
  assert.throws(() => sandbox.resetProfile({ economy: eco, dir: real, sandboxDir: null }), /only allowed/);
  assert.throws(() => withSandbox(null, () => sandbox.resetProfile({ economy: eco, dir: real })), /only allowed/);
  assert.equal(eco.getState().coins, 77);
  assert.equal(JSON.parse(fs.readFileSync(path.join(real, 'state.json'), 'utf8')).coins, 77);
});
