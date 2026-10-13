'use strict';
// App file check (informational). tools/integrity/build-manifest.mjs writes src/integrity.json with
// the sha256 of every shipped file under src/; at startup the files are compared against it. No
// manifest (a dev checkout) means nothing to check. Mods live in userData and are never checked.
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const SRC = path.join(__dirname, '..', '..');
const MANIFEST = 'integrity.json';

// Every file under root as sorted posix paths relative to root, without the manifest itself.
function listFiles(root) {
  const out = [];
  const walk = (dir, rel) => {
    for (const d of fs.readdirSync(dir, { withFileTypes: true })) {
      const r = rel ? `${rel}/${d.name}` : d.name;
      if (d.isDirectory()) walk(path.join(dir, d.name), r);
      else if (d.isFile() && r !== MANIFEST) out.push(r);
    }
  };
  walk(root, '');
  return out.sort();
}

const sha256 = (buf) => crypto.createHash('sha256').update(buf).digest('hex');
const hashFile = async (f) => sha256(await fs.promises.readFile(f));

async function buildManifest(root = SRC) {
  const files = {};
  for (const rel of listFiles(root)) files[rel] = await hashFile(path.join(root, rel));
  return { v: 1, algo: 'sha256', files };
}

// {ok, checked, mismatched: [path], missing: [path]} for root against manifest.files.
async function verify(root, manifest) {
  const res = { ok: true, checked: 0, mismatched: [], missing: [] };
  for (const [rel, hash] of Object.entries((manifest && manifest.files) || {})) {
    const f = path.resolve(root, rel);
    if (!f.startsWith(path.resolve(root) + path.sep)) continue;
    let h;
    try {
      h = await hashFile(f);
    } catch {
      res.missing.push(rel);
      continue;
    }
    res.checked++;
    if (h !== hash) res.mismatched.push(rel);
  }
  res.ok = !res.mismatched.length && !res.missing.length;
  return res;
}

// Startup check of root against root/integrity.json; {..., skipped: true} when there is no manifest.
async function check(root = SRC) {
  let manifest;
  try {
    manifest = JSON.parse(await fs.promises.readFile(path.join(root, MANIFEST), 'utf8'));
  } catch {
    return { ok: true, checked: 0, mismatched: [], missing: [], skipped: true };
  }
  return verify(root, manifest);
}

module.exports = { listFiles, buildManifest, verify, check, SRC, MANIFEST };
