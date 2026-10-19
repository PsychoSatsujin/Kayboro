// Packages Kayboro with electron-builder (config: package.json "build").
//   node tools/build/dist.mjs --win dir portable nsis     npm run dist        (everything for Windows)
//   node tools/build/dist.mjs --win dir                   npm run dist:dir    (dist/win-unpacked only, fastest)
//   node tools/build/dist.mjs --win dir --steam           npm run dist:steam  (same, then prints the SteamPipe content root)
//   node tools/build/dist.mjs --linux dir                 npm run dist:linux  (Linux depot / Steam Deck; optional)
// Every other argument is passed to electron-builder as is.
// The integrity manifest (src/integrity.json, the sha256 of every shipped file under src/) exists only
// while the build runs: it is written first and removed again in a finally block, so a dev checkout never
// keeps one (the app would otherwise report mismatches after the next edit). KAYBORO_KEEP_MANIFEST=1 keeps it.
import { createRequire } from 'node:module';
import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const require = createRequire(import.meta.url);
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
const { buildManifest, MANIFEST, SRC } = require(path.join(ROOT, 'src', 'main', 'economy', 'integrity.js'));

// Splits our own flags from electron-builder's. Returns { args, steam, platform }.
export function parseArgs(argv) {
  const args = [];
  let steam = false, platform = null;
  for (const a of argv) {
    if (a === '--steam') steam = true;
    else {
      if (a === '--win' || a === '-w') platform = 'win';
      else if (a === '--linux' || a === '-l') platform = 'linux';
      args.push(a);
    }
  }
  return { args, steam, platform: platform || (process.platform === 'win32' ? 'win' : 'linux') };
}

// Where electron-builder leaves the unpacked app for a platform (the SteamPipe content root).
export const contentRoot = (platform, out = path.join(ROOT, 'dist')) => path.join(out, platform === 'linux' ? 'linux-unpacked' : 'win-unpacked');

// Sizes of the build outputs: [{name, bytes}] for every file and *-unpacked dir in dist/.
export function outputs(out = path.join(ROOT, 'dist')) {
  const dirSize = (d) => fs.readdirSync(d, { withFileTypes: true }).reduce((t, e) => t + (e.isDirectory() ? dirSize(path.join(d, e.name)) : fs.statSync(path.join(d, e.name)).size), 0);
  let entries = [];
  try {
    entries = fs.readdirSync(out, { withFileTypes: true });
  } catch {
    return [];
  }
  return entries.filter((e) => e.isFile() ? /\.(exe|zip|7z|AppImage|deb|rpm|blockmap)$/i.test(e.name) : /-unpacked$/.test(e.name))
    .map((e) => ({ name: e.name + (e.isDirectory() ? '/' : ''), bytes: e.isDirectory() ? dirSize(path.join(out, e.name)) : fs.statSync(path.join(out, e.name)).size }));
}

export const fmtMB = (bytes) => `${(bytes / 1048576).toFixed(1)} MB`;

// The Kayboro Virtual Screen Driver ships next to Kayboro.exe in driver/ (package.json "extraFiles" copies
// build/driver/ there), where Steam's install script and the NSIS installer run kbvdd-setup.exe. Built by
// driver/build.cmd; release builds must use the SignPath-signed package (KBVDD_PACKAGE). copyDriver(root)
// copies it into <root>/driver/ and returns the files, or [] when there is no driver build.
export const DRIVER_FILES = ['KayboroVdd.dll', 'KayboroVdd.inf', 'kayborovdd.cat', 'kbvdd-setup.exe', 'LICENSE.txt'];
export function copyDriver(root, from = process.env.KBVDD_PACKAGE || path.join(ROOT, 'driver', 'build', 'Release', 'package')) {
  if (!DRIVER_FILES.every((f) => fs.existsSync(path.join(from, f)))) return [];
  const dir = path.join(root, 'driver');
  fs.rmSync(dir, { recursive: true, force: true });
  fs.mkdirSync(dir, { recursive: true });
  for (const f of DRIVER_FILES) fs.copyFileSync(path.join(from, f), path.join(dir, f));
  return DRIVER_FILES.map((f) => path.join(dir, f));
}

async function main() {
  const { args, steam, platform } = parseArgs(process.argv.slice(2));
  const manifestFile = path.join(SRC, MANIFEST);
  let code = 1;
  try {
    const staged = platform === 'win' ? copyDriver(path.join(ROOT, 'build')) : [];
    if (platform === 'win') {
      if (!staged.length) { // no stale copy from an older build; extraFiles still needs the folder
        fs.rmSync(path.join(ROOT, 'build', 'driver'), { recursive: true, force: true });
        fs.mkdirSync(path.join(ROOT, 'build', 'driver'), { recursive: true });
      }
      console.log(staged.length ? 'dist: Kayboro Virtual Screen Driver staged in build/driver'
        : 'dist: no driver package (run driver\build.cmd, or set KBVDD_PACKAGE to the signed one): Hide Game Window will need the driver installed separately');
    }
    const manifest = await buildManifest(SRC);
    fs.writeFileSync(manifestFile, JSON.stringify(manifest, null, 1) + '\n');
    console.log(`dist: integrity manifest, ${Object.keys(manifest.files).length} files under src/`);
    const cli = require.resolve('electron-builder/cli.js');
    console.log(`dist: electron-builder ${args.join(' ')}`);
    const r = spawnSync(process.execPath, [cli, ...args], { cwd: ROOT, stdio: 'inherit', env: { ...process.env, CSC_IDENTITY_AUTO_DISCOVERY: 'false' } });
    code = r.status == null ? 1 : r.status;
    if (r.error) throw r.error;
  } finally {
    if (process.env.KAYBORO_KEEP_MANIFEST !== '1') fs.rmSync(manifestFile, { force: true });
    else console.log(`dist: kept ${manifestFile} (KAYBORO_KEEP_MANIFEST=1)`);
  }
  if (code !== 0) {
    console.error(`dist: electron-builder exited with ${code}`);
    process.exit(code);
  }
  for (const o of outputs()) console.log(`dist: ${o.name.padEnd(36)} ${fmtMB(o.bytes)}`);
  if (steam) {
    const root = contentRoot(platform);
    console.log(`\nSteamPipe content root (ContentRoot in steam/scripts/depot_build_${platform}.vdf.template):\n  ${root}`);
    console.log('Upload: powershell -File steam/upload.ps1 -AppId <id> -DepotWin <id>   (see steam/README.md)');
  }
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  main().catch((err) => {
    console.error('dist failed:', err);
    process.exit(1);
  });
}
