'use strict';
// Weekly bundles (src/main/economy/bundles.js) and buying one (economy.buyBundle).
const test = require('node:test');
const assert = require('node:assert/strict');
const B = require('../src/main/economy/bundles');
const catalog = require('../src/main/economy/catalog');

const cat = catalog.load();
const items = B.sellable(cat);

test('isoWeek follows ISO 8601 (weeks start Monday; the Thursday decides the year)', () => {
  assert.equal(B.isoWeek(new Date(2026, 9, 19)), '2026-W43');
  assert.equal(B.isoWeek(new Date(2026, 0, 1)), '2026-W01');
  assert.equal(B.isoWeek(new Date(2027, 0, 1)), '2026-W53');
  assert.equal(B.isoWeek(new Date(2024, 11, 30)), '2025-W01');
});

test('sellable leaves out starters, fan art, DLC and the default looks', () => {
  assert.ok(items.size > 40);
  for (const it of items.values()) assert.ok(!it.starter && it.license !== 'fan-art' && !it.dlc && it.id !== 'default' && it.id !== 'none', it.id);
});

test('normBundle validates the week, drops unknown items, clamps the discount', () => {
  const ids = [...items.keys()];
  assert.equal(B.normBundle({ week: '2026-44', items: ids.slice(0, 3) }, items), null);
  assert.equal(B.normBundle({ week: '2026-W44', items: [ids[0], 'nope'] }, items), null, 'needs two real items');
  const b = B.normBundle({ week: '2026-W44', name: 'Test', items: [ids[0], ids[0], ids[1], 'nope'], discount: 0.9 }, items);
  assert.deepEqual(b.items, [ids[0], ids[1]]);
  assert.equal(b.discount, 0.6);
  assert.equal(b.id, 'bundle-2026-w44');
});

test('autoBundle is the same for everyone in a week and different across weeks', () => {
  const a = B.autoBundle('2026-W44', cat), again = B.autoBundle('2026-W44', cat), next = B.autoBundle('2026-W45', cat);
  assert.deepEqual(a, again);
  assert.ok(a.items.length >= 4 && a.items.length <= 8 && !a.curated);
  assert.ok(a.items.every((id) => items.has(id)));
  const weeks = Array.from({ length: 8 }, (_, i) => JSON.stringify(B.autoBundle(`2026-W${String(30 + i).padStart(2, '0')}`, cat).items));
  assert.ok(new Set([...weeks, JSON.stringify(next.items)]).size > 4, 'rotates');
});

test('weekly prefers the curated bundle for this week, else the automatic one', () => {
  const ids = [...items.keys()].slice(0, 3);
  const date = new Date(2026, 9, 28); // 2026-W44
  assert.equal(B.weekly(cat, [{ week: '2026-W44', name: 'Mine', items: ids }], date).name, 'Mine');
  assert.equal(B.weekly(cat, [{ week: '2026-W45', name: 'Later', items: ids }], date).curated, false);
});

test('quote counts only what the player does not own, at the discount, to the nearest 10', () => {
  const b = B.autoBundle('2026-W44', cat);
  const none = B.quote(b, cat, () => false), all = B.quote(b, cat, () => true);
  assert.equal(none.missing.length, b.items.length);
  assert.equal(none.coins, Math.round((none.full * (1 - b.discount)) / 10) * 10);
  assert.deepEqual([all.coins, all.missing], [0, []]);
  const one = B.quote(b, cat, (id) => id !== b.items[0]);
  assert.deepEqual(one.missing, [b.items[0]]);
});

test('the shipped bundles.json is valid', () => {
  for (const raw of cat.bundles) assert.ok(B.normBundle(raw, items), JSON.stringify(raw));
});
