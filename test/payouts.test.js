// Unit tests for the developer program: form submissions, the payout sheet (70/30, largest remainder,
// Excel-ready CSV) and tools/payouts/merge-sheets.mjs.
const { test, after } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { spawnSync } = require('node:child_process');

const P = require('../src/main/economy/payouts');
const { Submissions, validateSubmission } = require('../src/main/economy/submissions');

const TMP = fs.mkdtempSync(path.join(os.tmpdir(), 'kayboro-pay-'));
after(() => fs.rmSync(TMP, { recursive: true, force: true }));

const FORM = { name: 'Tiny Moth', email: 'hi@tinymoth.games', games: [{ name: 'Moth Quest', appid: '1234560' }, { name: '', appid: '' }],
  kofi: 'ko-fi.com/tinymoth', paypal: 'paypal.me/tinymoth', patreon: '', website: 'https://tinymoth.games', notes: 'Hello', agree: true };

const DEVS = [
  { devId: 'sample-studio', name: 'Sample', sample: true, apps: [{ appid: 480 }], links: {} },
  { devId: 'moth', name: 'Tiny Moth', apps: [{ appid: 1234560 }], links: { kofi: 'https://ko-fi.com/tinymoth', patreon: null } },
  { devId: 'owl', name: '=Owl "Games", Inc', apps: [{ appid: 620 }, { appid: 621 }], links: { patreon: 'https://www.patreon.com/owl' } },
];
const STATS = { perApp: { 480: { playSeconds: 9e5 }, 1234560: { playSeconds: 3599, achievements: 1 }, 620: { playSeconds: 600 }, 621: { playSeconds: 59 } } };

// ---- Submissions -------------------------------------------------------------------

test('submissions: validation mirrors the Devs tab form', () => {
  const ok = validateSubmission(FORM);
  assert.equal(ok.ok, true, JSON.stringify(ok.errors));
  assert.deepEqual(ok.value.games, [{ name: 'Moth Quest', appid: 1234560 }]);
  assert.deepEqual([ok.value.kofi, ok.value.paypal, ok.value.website], ['https://ko-fi.com/tinymoth', 'https://paypal.me/tinymoth', 'https://tinymoth.games/']);
  const bad = validateSubmission({ ...FORM, email: 'nope', games: [{ name: 'X', appid: 'abc' }], kofi: 'https://evil.com/x', paypal: 'bob', agree: 'yes' });
  assert.deepEqual(Object.keys(bad.errors).sort(), ['agree', 'email', 'games.0', 'kofi', 'payout', 'paypal'].sort());
  assert.ok(validateSubmission({ ...FORM, kofi: '', paypal: '', patreon: '' }).errors.payout, 'needs a way to get paid');
  assert.ok(validateSubmission({ ...FORM, games: [] }).errors.games);
  assert.equal(validateSubmission(null).ok, false);
  assert.equal(validateSubmission({ ...FORM, paypal: 'pay@moth.games' }).value.paypal, 'pay@moth.games');
});

test('submissions: saved to dev-submissions.json', () => {
  let t = 1_700_000_000_000;
  const s = new Submissions(path.join(TMP, 'sub'), { now: () => t++ });
  assert.deepEqual(s.list(), []);
  assert.deepEqual(s.add({ ...FORM, agree: false }).reason, 'invalid');
  const a = s.add(FORM), b = s.add({ ...FORM, name: 'Owl' });
  assert.ok(a.ok && b.ok && a.id !== b.id);
  assert.match(a.id, /^sub-/);
  const again = new Submissions(path.join(TMP, 'sub')).list();
  assert.deepEqual(again.map((x) => x.name), ['Tiny Moth', 'Owl']);
  assert.equal(again[0].submittedAt, new Date(1_700_000_000_000).toISOString());
  assert.equal(again[0].agree, true);
});

// ---- Sheet ---------------------------------------------------------------------------

test('devRows: listed developers (no samples), submissions merge into the dev with the same appid', () => {
  const subs = [{ id: 'sub-1', name: 'Tiny Moth', email: 'hi@tinymoth.games', paypal: 'https://paypal.me/tinymoth', kofi: '', games: [{ appid: 1234560 }, { appid: 1234561 }] },
    { id: 'sub-2', name: 'Newbie', email: 'n@new.dev', kofi: 'https://ko-fi.com/new', games: [{ appid: 777 }] }];
  const rows = P.devRows({ developers: DEVS, submissions: subs, stats: STATS });
  assert.deepEqual(rows.map((r) => r.id), ['moth', 'owl', 'sub-2']);
  assert.deepEqual(rows[0], { id: 'moth', name: 'Tiny Moth', email: 'hi@tinymoth.games', kofi: 'https://ko-fi.com/tinymoth', paypal: 'https://paypal.me/tinymoth',
    patreon: '', appids: [1234560, 1234561], playMinutes: 59, points: 69 });
  assert.deepEqual([rows[1].playMinutes, rows[1].points], [10, 10], 'whole minutes per app');
  assert.deepEqual([rows[2].playMinutes, rows[2].points], [0, 0]);
});

test('buildSheet: 70% split by points with largest-remainder cents, 30% to Kayboro', () => {
  const rows = [{ id: 'a', name: 'A', points: 1 }, { id: 'b', name: 'B', points: 1 }, { id: 'c', name: 'C', points: 1 }].map((r) => ({ ...r, appids: [], playMinutes: r.points }));
  const s = P.buildSheet(rows, 100);
  assert.deepEqual(s.rows.map((r) => r.cents), [24, 23, 23]); // 70 / 3: the first of equal remainders gets the extra cent
  assert.deepEqual([s.poolCents, s.kayboroCents, s.unallocatedCents], [70, 30, 0]);
  assert.ok(Math.abs(s.rows[0].share - 33.333) < 0.01);
  const odd = P.buildSheet(rows, 999);
  assert.equal(odd.rows.reduce((t, r) => t + r.cents, 0) + odd.kayboroCents, 999, 'every cent is accounted for');
  const none = P.buildSheet(rows.map((r) => ({ ...r, points: 0 })), 1000);
  assert.deepEqual([none.unallocatedCents, none.kayboroCents], [700, 300], 'nobody played: the pool stays unallocated');
  assert.throws(() => P.buildSheet(rows, -1), RangeError);
  assert.throws(() => P.buildSheet(rows, 1.5), RangeError);
});

test('toCsv: BOM, CRLF, quoted text, formula-safe cells, plain numbers, Kayboro and total rows', () => {
  const rows = P.devRows({ developers: DEVS, stats: STATS });
  const csv = P.toCsv(P.buildSheet(rows, 123456));
  assert.ok(csv.startsWith('﻿ID,Name,Email,Ko-fi,PayPal,Patreon,Steam appids,Play minutes,Points,Share %,Payout (USD)\r\n'));
  assert.ok(csv.endsWith('\r\n') && !/[^\r]\n/.test(csv), 'CRLF line ends');
  const lines = csv.slice(1).trim().split('\r\n');
  assert.equal(lines.length, 5);
  // moth 59+10 = 69 points, owl 10: pool floor(123456 * 0.7) = 86419 -> 75480.09, 10939.11
  assert.equal(lines[1], 'moth,Tiny Moth,,https://ko-fi.com/tinymoth,,,1234560,59,69,87.34,754.80');
  assert.equal(lines[2], `owl,"'=Owl ""Games"", Inc",,,,https://www.patreon.com/owl,620 621,10,10,12.66,109.39`);
  assert.equal(lines[3], '_kayboro,Kayboro (30%),,,,,,,,,370.37');
  assert.equal(lines[4], '_total,Total,,,,,,69,79,100.00,1234.56');
  assert.ok(!/(^|,)[=+@-]/.test(lines.join('\n').replace(/"'=/g, '')), 'no cell starts like a formula');
});

test('readUsage + mergeRows: CSV and JSON from several installs sum per developer', () => {
  const rows = P.devRows({ developers: DEVS, stats: STATS });
  const csv = P.toCsv(P.buildSheet(rows, 500));
  const back = P.readUsage(csv, 'a.csv');
  assert.deepEqual(back, rows, 'CSV round-trips (Kayboro/total rows skipped, apostrophes removed)');
  const json = P.toJson([{ id: 'owl', name: 'Owl', email: 'owl@x.io', appids: [620], playMinutes: 30, points: 40 }, { name: 'Solo', playMinutes: 5, points: 5 }]);
  const merged = P.mergeRows([back, P.readUsage(json, 'b.json')]);
  assert.deepEqual(merged.map((r) => [r.id, r.playMinutes, r.points]), [['moth', 59, 69], ['owl', 40, 50], ['', 5, 5]]);
  assert.equal(merged[1].email, 'owl@x.io', 'missing contact details fill in');
  assert.deepEqual(P.parseCsv('a,"b,""c"""\r\n\r\n1,"x\ny"'), [['a', 'b,"c"'], ['1', 'x\ny']]);
});

test('merge-sheets.mjs: merges files into one 70/30 sheet', () => {
  const a = path.join(TMP, 'a.csv'), b = path.join(TMP, 'b.json'), out = path.join(TMP, 'merged.csv');
  fs.writeFileSync(a, P.toCsv(P.buildSheet(P.devRows({ developers: DEVS, stats: STATS }), 0)));
  fs.writeFileSync(b, P.toJson([{ id: 'moth', name: 'Tiny Moth', appids: [1234560], playMinutes: 31, points: 31 }]));
  const tool = path.join(__dirname, '..', 'tools', 'payouts', 'merge-sheets.mjs');
  const r = spawnSync(process.execPath, [tool, '--revenue', '1,000.50', '--out', out, a, b], { encoding: 'utf8' });
  assert.equal(r.status, 0, r.stderr);
  const lines = fs.readFileSync(out, 'utf8').slice(1).trim().split('\r\n');
  // moth 100 points, owl 10 of a 70035-cent pool: 63668.18 -> 63668, 6366.81 -> 6367
  assert.equal(lines[1], 'moth,Tiny Moth,,https://ko-fi.com/tinymoth,,,1234560,90,100,90.91,636.68');
  assert.match(lines[2], /,10,10,9\.09,63\.67$/);
  assert.equal(lines[3], '_kayboro,Kayboro (30%),,,,,,,,,300.15');
  assert.equal(lines[4], '_total,Total,,,,,,100,110,100.00,1000.50');
  const bad = spawnSync(process.execPath, [tool, '--revenue', 'lots', a], { encoding: 'utf8' });
  assert.equal(bad.status, 1);
  assert.match(bad.stderr, /revenue/);
});
