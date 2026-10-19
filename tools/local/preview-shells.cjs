'use strict';
// Renders every catalog shell with tools/shells/preview.cjs into one contact sheet (Node, no deps):
//
//   node tools/local/preview-shells.cjs [--drafts] [--list] [--out=DIR]
//
// Ids come from src/catalog/frames-*.json (only the ones with a source module under tools/vectorart/frames
// or tools/pixelart/frames; built-in starters have none). --drafts also adds source modules that are not in
// the catalog yet (shells still being drawn). --list prints the ids and exits. Output: DIR (default
// <repo>/.preview/all) with one PNG per shell and sheet.png. Exit code: preview.cjs's (1 if any shell FAILs).
const fs = require('fs');
const path = require('path');
const { spawnSync } = require('child_process');

const ROOT = path.resolve(__dirname, '..', '..');

const sourceOf = (root, id) => [path.join(root, 'tools', 'vectorart', 'frames', `${id}.js`), path.join(root, 'tools', 'pixelart', 'frames', `${id}.mjs`)].find((f) => fs.existsSync(f)) || null;

// { ids, missing, drafts }: catalog ids with a source module (catalog order), catalog ids without one, and
// (with drafts) source modules the catalog doesn't list yet.
function shellIds({ root = ROOT, drafts = false } = {}) {
  const dir = path.join(root, 'src', 'catalog');
  const catalog = [];
  for (const f of fs.readdirSync(dir).filter((n) => /^frames-.*\.json$/.test(n)).sort()) {
    try {
      const d = JSON.parse(fs.readFileSync(path.join(dir, f), 'utf8'));
      for (const it of (Array.isArray(d) ? d : d.frames) || []) if (it && typeof it.id === 'string' && !catalog.includes(it.id)) catalog.push(it.id);
    } catch (err) {
      console.warn(`[preview-shells] ${f} skipped: ${err.message}`);
    }
  }
  const ids = catalog.filter((id) => sourceOf(root, id)), missing = catalog.filter((id) => !sourceOf(root, id));
  const extra = [];
  if (drafts) {
    for (const [sub, ext] of [['vectorart', '.js'], ['pixelart', '.mjs']]) {
      const d = path.join(root, 'tools', sub, 'frames');
      for (const n of fs.existsSync(d) ? fs.readdirSync(d).sort() : []) {
        const id = n.slice(0, -ext.length);
        if (n.endsWith(ext) && !catalog.includes(id) && !extra.includes(id)) extra.push(id);
      }
    }
  }
  return { ids: [...ids, ...extra], missing, drafts: extra };
}

function main(argv) {
  const out = path.resolve((argv.find((a) => a.startsWith('--out=')) || '').slice(6) || path.join(ROOT, '.preview', 'all'));
  const { ids, missing, drafts } = shellIds({ drafts: argv.includes('--drafts') });
  if (missing.length) console.log(`[preview-shells] no source module (skipped): ${missing.join(', ')}`);
  if (drafts.length) console.log(`[preview-shells] drafts not in the catalog yet: ${drafts.join(', ')}`);
  if (argv.includes('--list')) return void console.log(ids.join('\n'));
  if (!ids.length) { console.error('[preview-shells] no shells to preview'); return 1; }
  console.log(`[preview-shells] rendering ${ids.length} shells into ${out}`);
  const electron = require(path.join(ROOT, 'node_modules', 'electron')); // the binary's path when required from Node
  const r = spawnSync(electron, [path.join(ROOT, 'tools', 'shells', 'preview.cjs'), '--sheet', `--out=${out}`, ...ids], { stdio: 'inherit', cwd: ROOT });
  if (r.error) { console.error(`[preview-shells] could not start Electron: ${r.error.message}`); return 1; }
  const sheet = path.join(out, 'sheet.png');
  console.log(fs.existsSync(sheet) ? `[preview-shells] sheet: ${sheet}` : '[preview-shells] no sheet.png was written');
  return r.status ?? 1;
}

if (require.main === module) process.exitCode = main(process.argv.slice(2)) || 0;

module.exports = { shellIds, sourceOf };
