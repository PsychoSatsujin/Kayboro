// Unit tests for the packaging side: package.json "build" (electron-builder), tools/build/dist.mjs,
// the self-test flag parser and the SteamPipe templates.
const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const ROOT = path.join(__dirname, '..');
const pkg = require('../package.json');
const selftest = require('../src/main/selftest');

test('package.json: electron-builder config for the Steam depot, testers and installers', () => {
  const b = pkg.build;
  assert.equal(b.appId, 'com.kayboro.app');
  assert.equal(b.productName, 'Kayboro');
  assert.deepEqual(b.directories, { output: 'dist', buildResources: 'build' });
  assert.equal(b.asar, true);
  assert.ok(b.asarUnpack.some((p) => p.includes('koffi')) && b.asarUnpack.some((p) => p.includes('steamworks.js')), 'native modules unpacked');
  assert.deepEqual(b.win.target.map((t) => t.target), ['dir', 'portable', 'nsis']);
  assert.deepEqual(b.linux.target.map((t) => t.target), ['dir']);
  assert.equal(b.npmRebuild, false);
  assert.equal(b.publish, null);
  assert.ok(b.files.includes('src/**/*') && b.files.includes('package.json'));
  assert.ok(b.extraFiles.some((f) => f.from === 'LICENSE-CONTENT.md'));
  assert.ok(b.extraFiles.some((f) => /OFL/.test(f.from)) && b.extraFiles.some((f) => /TABLER/.test(f.from)));
  // build/driver is staged by tools/build/dist.mjs from the driver build; everything else ships as is.
  for (const f of b.extraFiles) if (f.from !== 'build/driver') assert.ok(fs.existsSync(path.join(ROOT, f.from)), f.from);
  // The Kayboro Virtual Screen Driver: disclosed by the EULA on the installer's license page, shipped in driver/.
  assert.ok(b.extraFiles.some((f) => f.from === 'build/driver' && f.to === 'driver'), 'driver ships next to Kayboro.exe');
  assert.ok(b.extraFiles.some((f) => f.from === 'EULA.txt'), 'EULA ships with the app');
  assert.equal(b.nsis.license, 'EULA.txt');
  const eula = fs.readFileSync(path.join(ROOT, 'EULA.txt'), 'utf8');
  for (const s of ['Kayboro Virtual Screen Driver', 'administrator approval', 'Removing it', 'kbvdd-setup.exe uninstall']) assert.ok(eula.includes(s), `EULA mentions ${s}`);
  const nsh = fs.readFileSync(path.join(ROOT, 'build', 'installer.nsh'), 'utf8');
  assert.match(nsh, /!macro customInstall[\s\S]*ExecShellWait "runas" "\$INSTDIR\\driver\\kbvdd-setup\.exe" "install"/);
  assert.match(nsh, /!macro customUnInstall[\s\S]*\$\{ifNot\} \$\{isUpdated\}[\s\S]*"uninstall"/, 'updates keep the driver');
  // koffi ships prebuilt binaries for 18 platforms; each OS build keeps only its own (afterPack hook).
  assert.equal(b.afterPack, 'tools/build/hooks.cjs');
  assert.ok(!b.win.files && !b.linux.files, 'per-platform files lists are ignored by electron-builder 26; the hook prunes instead');
});

test('hooks.cjs: prunes every native binary folder but the target one', () => {
  const hooks = require('../tools/build/hooks.cjs');
  const triplets = fs.readdirSync(path.join(ROOT, 'node_modules', 'koffi', 'build', 'koffi'));
  const sw = fs.readdirSync(path.join(ROOT, 'node_modules', 'steamworks.js', 'dist'));
  assert.ok(triplets.includes('win32_x64') && triplets.includes('linux_x64') && sw.includes('win64') && sw.includes('linux64'));
  const dirs = { koffi: triplets, steamworks: sw };
  const win = hooks.prunable(dirs, 'win32', 'x64');
  assert.equal(win.length, triplets.length - 1 + sw.length - 1);
  assert.ok(!win.includes(`${hooks.KOFFI}/win32_x64`) && !win.includes(`${hooks.STEAMWORKS}/win64`));
  assert.ok(win.includes(`${hooks.KOFFI}/linux_x64`) && win.includes(`${hooks.STEAMWORKS}/linux64`) && win.includes(`${hooks.STEAMWORKS}/osx`));
  const linux = hooks.prunable(dirs, 'linux', 'x64');
  assert.ok(!linux.includes(`${hooks.KOFFI}/linux_x64`) && !linux.includes(`${hooks.STEAMWORKS}/linux64`) && linux.includes(`${hooks.KOFFI}/win32_x64`));
  assert.ok(!hooks.prunable(dirs, 'linux', 'armv7l').includes(`${hooks.KOFFI}/linux_armhf`));
  assert.deepEqual(hooks.prunable(dirs, 'haiku'), []);
  assert.deepEqual(hooks.prunable(null, 'win32'), []);
  // On disk: a fake unpacked tree keeps only the target folders.
  const os = require('node:os');
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'kayboro-prune-'));
  for (const d of ['win32_x64', 'linux_x64', 'darwin_arm64']) fs.mkdirSync(path.join(tmp, hooks.KOFFI, d), { recursive: true });
  for (const d of ['win64', 'linux64']) fs.mkdirSync(path.join(tmp, hooks.STEAMWORKS, d), { recursive: true });
  fs.writeFileSync(path.join(tmp, hooks.KOFFI, 'linux_x64', 'koffi.node'), 'xxxx');
  const r = hooks.prune(tmp, 'win32', 'x64');
  assert.deepEqual(r.removed.sort(), [`${hooks.KOFFI}/darwin_arm64`, `${hooks.KOFFI}/linux_x64`, `${hooks.STEAMWORKS}/linux64`]);
  assert.equal(r.bytes, 4);
  assert.deepEqual(fs.readdirSync(path.join(tmp, hooks.KOFFI)), ['win32_x64']);
  assert.deepEqual(fs.readdirSync(path.join(tmp, hooks.STEAMWORKS)), ['win64']);
  fs.rmSync(tmp, { recursive: true, force: true });
});

test('package.json: scripts, steamworks.js optional, electron-builder dev-only', () => {
  assert.equal(pkg.scripts.dist, 'node tools/build/dist.mjs --win dir portable nsis');
  assert.equal(pkg.scripts['dist:dir'], 'node tools/build/dist.mjs --win dir');
  assert.match(pkg.scripts['dist:steam'], /--win dir --steam/);
  assert.match(pkg.scripts['dist:linux'], /--linux dir/);
  assert.ok(pkg.optionalDependencies['steamworks.js']);
  assert.ok(pkg.devDependencies['electron-builder']);
  assert.ok(!pkg.dependencies['steamworks.js'] && !pkg.dependencies['electron-builder']);
});

test('dist.mjs: argument split, content roots, output listing', async () => {
  const d = await import('../tools/build/dist.mjs');
  assert.deepEqual(d.parseArgs(['--win', 'dir', 'portable', '--steam']), { args: ['--win', 'dir', 'portable'], steam: true, platform: 'win' });
  assert.deepEqual(d.parseArgs(['--linux', 'dir']), { args: ['--linux', 'dir'], steam: false, platform: 'linux' });
  assert.equal(d.parseArgs([]).steam, false);
  assert.ok(d.contentRoot('win').endsWith(path.join('dist', 'win-unpacked')));
  assert.ok(d.contentRoot('linux').endsWith(path.join('dist', 'linux-unpacked')));
  assert.deepEqual(d.outputs(path.join(ROOT, 'no-such-dir')), []);
  assert.equal(d.fmtMB(1048576 * 2.5), '2.5 MB');
  const src = fs.readFileSync(path.join(ROOT, 'tools', 'build', 'dist.mjs'), 'utf8');
  assert.match(src, /finally\s*\{[^}]*rmSync\(manifestFile/, 'the manifest is always removed');
  assert.ok(!fs.existsSync(path.join(ROOT, 'src', 'integrity.json')), 'no integrity.json in the dev tree');
  assert.ok(fs.readFileSync(path.join(ROOT, '.gitignore'), 'utf8').includes('src/integrity.json'));
});

test('selftest.parseArgs: flag with or without a file, default file, absent', () => {
  assert.equal(selftest.parseArgs(['electron', '.']), null);
  assert.deepEqual(selftest.parseArgs(['x', '--self-test'], 'D'), { file: 'D' });
  assert.deepEqual(selftest.parseArgs(['x', '--self-test=C:\\t\\r.json']), { file: 'C:\\t\\r.json' });
  assert.deepEqual(selftest.parseArgs(['--self-test= '], 'D'), { file: 'D' });
  assert.equal(selftest.parseArgs(['--self-tests']), null);
  assert.equal(selftest.parseArgs(null), null);
  assert.equal(selftest.TIMEOUT_MS, 30e3);
});

test('selftest.run: writes the result, prints the line and exits 0 on a loaded renderer', async () => {
  const { EventEmitter } = require('node:events');
  const os = require('node:os');
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'kayboro-selftest-'));
  const file = path.join(tmp, 'sub', 'r.json');
  const wc = Object.assign(new EventEmitter(), { executeJavaScript: async () => true });
  const win = { isDestroyed: () => false, webContents: wc };
  const app = { getVersion: () => '9.9.9', exit() {} };
  let out = '';
  const code = await new Promise((resolve) => {
    selftest.run({ app, win, file, probe: () => ({ catalog: { frames: 21, wallpapers: 3 }, steamworks: true }), out: { write: (s) => (out += s) }, exit: resolve });
    wc.emit('console-message', { level: 'warning', message: 'ignored' });
    wc.emit('did-finish-load');
  });
  assert.equal(code, 0);
  const r = JSON.parse(fs.readFileSync(file, 'utf8'));
  assert.equal(r.ok, true);
  assert.equal(r.version, '9.9.9');
  assert.deepEqual(r.catalog, { frames: 21, wallpapers: 3 });
  assert.equal(r.steamworks, true);
  assert.deepEqual(r.errors, []);
  assert.match(out, /^KAYBORO_SELFTEST \{"ok":true,/);
  fs.rmSync(tmp, { recursive: true, force: true });
});

test('selftest.run: renderer errors, a dead renderer and a timeout fail with exit 1', async () => {
  const { EventEmitter } = require('node:events');
  const app = { getVersion: () => '1', exit() {} };
  const go = (drive, extra = {}) => new Promise((resolve) => {
    const wc = Object.assign(new EventEmitter(), { executeJavaScript: async () => true });
    const res = {};
    selftest.run({ app, win: { isDestroyed: () => false, webContents: wc }, file: null, probe: () => ({}), out: { write: (s) => (res.line = s) }, exit: (c) => resolve({ c, r: JSON.parse(res.line.slice('KAYBORO_SELFTEST '.length)) }), ...extra });
    drive(wc);
  });
  let r = await go((wc) => { wc.emit('console-message', {}, 3, 'Uncaught TypeError'); wc.emit('did-finish-load'); });
  assert.equal(r.c, 1);
  assert.deepEqual(r.r.errors, ['renderer: Uncaught TypeError']);
  r = await go((wc) => wc.emit('render-process-gone', {}, { reason: 'crashed' }));
  assert.equal(r.c, 1);
  assert.match(r.r.errors[0], /renderer gone: crashed/);
  r = await go(() => {}, { timeoutMs: 20 });
  assert.equal(r.c, 1);
  assert.match(r.r.errors[0], /did not load/);
  r = await go(() => {}, { win: null });
  assert.deepEqual(r.r.errors, ['no window']);
});

test('steam/: templates, upload script and achievements file are in place', () => {
  const dir = path.join(ROOT, 'steam');
  for (const f of ['scripts/app_build.vdf.template', 'scripts/depot_build_win.vdf.template', 'scripts/depot_build_linux.vdf.template', 'upload.ps1', 'README.md', 'achievements.json']) {
    assert.ok(fs.existsSync(path.join(dir, f)), f);
  }
  const app = fs.readFileSync(path.join(dir, 'scripts', 'app_build.vdf.template'), 'utf8');
  for (const p of ['{{APPID}}', '{{DESC}}', '{{PREVIEW}}', '{{DEPOTS}}']) assert.ok(app.includes(p), p);
  const win = fs.readFileSync(path.join(dir, 'scripts', 'depot_build_win.vdf.template'), 'utf8');
  assert.ok(win.includes('{{DEPOT_WIN}}') && win.includes('{{CONTENT_ROOT}}') && /steam_appid\.txt/.test(win), 'win depot excludes steam_appid.txt');
  const linux = fs.readFileSync(path.join(dir, 'scripts', 'depot_build_linux.vdf.template'), 'utf8');
  assert.ok(linux.includes('{{DEPOT_LINUX}}') && linux.includes('{{CONTENT_ROOT}}'));
  const ps = fs.readFileSync(path.join(dir, 'upload.ps1'), 'utf8');
  assert.ok(!/password/i.test(ps.replace(/#.*$/gm, '').replace(/<#[\s\S]*?#>/g, '')) || !/\+password/.test(ps), 'never passes a password');
  assert.ok(/\+login/.test(ps) && /run_app_build/.test(ps) && /win-unpacked/.test(ps));
  assert.ok(!fs.existsSync(path.join(ROOT, 'dist', 'win-unpacked', 'steam_appid.txt')), 'steam_appid.txt is never in dist');
});
