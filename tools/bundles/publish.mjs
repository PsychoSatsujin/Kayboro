#!/usr/bin/env node
// Publishes curated weekly bundles: checks bundle files saved by Kayboro's Bundle Studio (Shop > Weekly)
// against the catalog and adds them to src/catalog/bundles.json (one per week; a newer file for the same
// week replaces the old one). Weeks without a curated bundle keep getting an automatic one.
//   node tools/bundles/publish.mjs <bundle.json> [more.json ...]   add or replace
//   node tools/bundles/publish.mjs --list                          show the curated weeks
//   node tools/bundles/publish.mjs --remove 2026-W44               drop a week (it goes back to automatic)
import fs from 'node:fs';
import path from 'node:path';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';

const require = createRequire(import.meta.url);
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
const FILE = path.join(ROOT, 'src', 'catalog', 'bundles.json');
const catalog = require(path.join(ROOT, 'src', 'main', 'economy', 'catalog.js'));
const B = require(path.join(ROOT, 'src', 'main', 'economy', 'bundles.js'));

const doc = JSON.parse(fs.readFileSync(FILE, 'utf8'));
const save = () => {
  doc.bundles.sort((a, b) => (a.week < b.week ? -1 : 1));
  fs.writeFileSync(FILE, JSON.stringify(doc, null, 2) + '\n');
};
const args = process.argv.slice(2);

if (!args.length || args.includes('--help')) {
  console.log('usage: node tools/bundles/publish.mjs <bundle.json> [...] | --list | --remove <YYYY-Www>');
  process.exit(args.length ? 0 : 1);
}
if (args[0] === '--list') {
  for (const b of doc.bundles) console.log(`${b.week}  ${b.name}  (${b.items.length} items, ${Math.round((b.discount ?? B.DEFAULT_DISCOUNT) * 100)}% off)`);
  if (!doc.bundles.length) console.log('No curated weeks yet: every week is automatic.');
  process.exit(0);
}
if (args[0] === '--remove') {
  const week = args[1];
  const before = doc.bundles.length;
  doc.bundles = doc.bundles.filter((b) => b.week !== week);
  if (doc.bundles.length === before) { console.error(`No curated bundle for ${week}.`); process.exit(1); }
  save();
  console.log(`Removed ${week}; that week is automatic again.`);
  process.exit(0);
}

const items = B.sellable(catalog.load());
let bad = 0;
for (const f of args) {
  let raw;
  try { raw = JSON.parse(fs.readFileSync(f, 'utf8')); } catch (err) { console.error(`${f}: ${err.message}`); bad++; continue; }
  const unknown = (raw.items || []).filter((id) => !items.has(String(id)));
  const b = B.normBundle(raw, items);
  if (!b) { console.error(`${f}: needs a week like 2026-W44 and at least two sellable items (not starters, DLC or fan art).`); bad++; continue; }
  if (unknown.length) console.warn(`${f}: skipped unknown or unsellable items: ${unknown.join(', ')}`);
  const { id, curated, ...entry } = b;
  doc.bundles = doc.bundles.filter((x) => x.week !== entry.week).concat(entry);
  console.log(`${entry.week}: "${entry.name}", ${entry.items.length} items, ${Math.round(entry.discount * 100)}% off`);
}
save();
process.exit(bad ? 1 : 0);
