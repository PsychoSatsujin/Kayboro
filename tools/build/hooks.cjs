'use strict';
// electron-builder afterPack hook (package.json "build".afterPack). koffi ships prebuilt binaries for
// 18 platforms and steamworks.js for 3; both live outside the asar (asarUnpack), so after packing we
// delete the folders the target platform/arch can never load (about 25 MB per build). Per-platform
// "files" patterns were meant to do this, but electron-builder 26 keeps top-level and win/linux
// "files" lists in separate matchers, so they never applied. An explicit, testable hook instead.
const fs = require('fs');
const path = require('path');

const KOFFI = 'node_modules/koffi/build/koffi';
const STEAMWORKS = 'node_modules/steamworks.js/dist';
// Electron platform name -> koffi triplet prefix and steamworks.js dist folder.
const PLATFORMS = { win32: { koffi: 'win32', steamworks: 'win64' }, linux: { koffi: 'linux', steamworks: 'linux64' }, darwin: { koffi: 'darwin', steamworks: 'osx' } };
const KOFFI_ARCH = { x64: 'x64', arm64: 'arm64', ia32: 'ia32', armv7l: 'armhf' };

// The unpacked native folders to delete for a target, relative to app.asar.unpacked.
// `dirs` = { koffi: [folder names], steamworks: [folder names] } as found on disk.
function prunable(dirs, platformName, arch = 'x64') {
  const p = PLATFORMS[platformName];
  if (!p || !dirs) return [];
  const keepKoffi = `${p.koffi}_${KOFFI_ARCH[arch] || arch}`;
  const out = [];
  for (const d of dirs.koffi || []) if (d !== keepKoffi) out.push(`${KOFFI}/${d}`);
  for (const d of dirs.steamworks || []) if (d !== p.steamworks) out.push(`${STEAMWORKS}/${d}`);
  return out;
}

const list = (d) => {
  try {
    return fs.readdirSync(d, { withFileTypes: true }).filter((e) => e.isDirectory()).map((e) => e.name);
  } catch {
    return [];
  }
};
const dirSize = (d) => fs.readdirSync(d, { withFileTypes: true }).reduce((t, e) => t + (e.isDirectory() ? dirSize(path.join(d, e.name)) : fs.statSync(path.join(d, e.name)).size), 0);

// Deletes the prunable folders under `unpacked` (an app.asar.unpacked dir). Returns { removed: [rel], bytes }.
function prune(unpacked, platformName, arch) {
  const dirs = { koffi: list(path.join(unpacked, KOFFI)), steamworks: list(path.join(unpacked, STEAMWORKS)) };
  let bytes = 0;
  const removed = [];
  for (const rel of prunable(dirs, platformName, arch)) {
    const abs = path.join(unpacked, rel);
    try {
      bytes += dirSize(abs);
      fs.rmSync(abs, { recursive: true, force: true });
      removed.push(rel);
    } catch (err) {
      console.warn(`afterPack: could not remove ${rel}: ${err.message}`);
    }
  }
  return { removed, bytes };
}

// electron-builder calls this with { appOutDir, packager, electronPlatformName, arch (enum number) }.
async function afterPack(context) {
  const platformName = context.electronPlatformName || context.packager.platform.nodeName;
  const arch = require('builder-util').Arch[context.arch] || 'x64';
  const resources = platformName === 'darwin'
    ? path.join(context.appOutDir, `${context.packager.appInfo.productFilename}.app`, 'Contents', 'Resources')
    : path.join(context.appOutDir, 'resources');
  const r = prune(path.join(resources, 'app.asar.unpacked'), platformName, arch);
  console.log(`  • afterPack: kept ${platformName}-${arch} native binaries, removed ${r.removed.length} folders (${(r.bytes / 1048576).toFixed(1)} MB)`);
}

module.exports = afterPack;
module.exports.prunable = prunable;
module.exports.prune = prune;
module.exports.KOFFI = KOFFI;
module.exports.STEAMWORKS = STEAMWORKS;
