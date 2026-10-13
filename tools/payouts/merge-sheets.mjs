// Merges the payout sheets (CSV) or usage files (JSON) exported by many installs (Devs tab > Export
// payout sheet) into one sheet with the same 70/30 split: play minutes and points of the same
// developer (same ID, else email, else name) are summed, then 70% of the revenue is split by points.
//
//   node tools/payouts/merge-sheets.mjs [--revenue 1234.56 | --revenue-cents 123456] [--out payout-sheet.csv] FILE...
//
// --revenue        net revenue of the period in USD (default 0: minutes and points only)
// --revenue-cents  the same in cents
// --out            output CSV (UTF-8 with BOM, opens in Excel); default payout-sheet.csv, "-" for stdout
import { createRequire } from 'node:module';
import fs from 'node:fs';
import path from 'node:path';

const require = createRequire(import.meta.url);
const { readUsage, mergeRows, buildSheet, toCsv } = require('../../src/main/economy/payouts.js');

function parseArgs(argv) {
  const o = { revenueCents: 0, out: 'payout-sheet.csv', files: [] };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === '--revenue') {
      const m = /^\$?(\d+)(?:\.(\d{1,2}))?$/.exec(String(argv[++i]).replace(/,/g, ''));
      if (!m) throw new Error('--revenue takes a USD amount like 1234.56');
      o.revenueCents = Number(m[1]) * 100 + Number((m[2] || '').padEnd(2, '0'));
    } else if (a === '--revenue-cents') o.revenueCents = Number(argv[++i]);
    else if (a === '--out') o.out = argv[++i];
    else if (a === '-h' || a === '--help') o.help = true;
    else o.files.push(a);
  }
  if (!Number.isSafeInteger(o.revenueCents) || o.revenueCents < 0) throw new Error('revenue must be a non-negative amount');
  return o;
}

try {
  const o = parseArgs(process.argv.slice(2));
  if (o.help || !o.files.length) {
    console.log('usage: node tools/payouts/merge-sheets.mjs [--revenue USD | --revenue-cents N] [--out FILE.csv] FILE...');
    process.exit(o.help ? 0 : 1);
  }
  const lists = o.files.map((f) => readUsage(fs.readFileSync(f, 'utf8'), f));
  const sheet = buildSheet(mergeRows(lists), o.revenueCents);
  const csv = toCsv(sheet);
  if (o.out === '-') process.stdout.write(csv);
  else {
    fs.writeFileSync(o.out, csv);
    console.log(`merged ${o.files.length} file(s), ${sheet.rows.length} developer(s), ${sheet.playMinutes} play minutes -> ${path.resolve(o.out)}`);
  }
} catch (err) {
  console.error(`merge-sheets: ${err.message}`);
  process.exit(1);
}
