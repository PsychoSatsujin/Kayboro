'use strict';
// Payout sheet (pure). One row per listed developer or form submission with the play their games got
// in Shellcade, the 70/30 split of a revenue amount (largest-remainder cents, see revenue.js) and an
// Excel-ready CSV (UTF-8 BOM, CRLF, plain numbers). tools/payouts/merge-sheets.mjs reuses it to merge
// the sheets of many installs.
const { computePayouts, points } = require('./revenue');

const DEV_SHARE = 0.7;
const COLUMNS = [['id', 'ID'], ['name', 'Name'], ['email', 'Email'], ['kofi', 'Ko-fi'], ['paypal', 'PayPal'], ['patreon', 'Patreon'],
  ['appids', 'Steam appids'], ['playMinutes', 'Play minutes'], ['points', 'Points'], ['share', 'Share %'], ['payout', 'Payout (USD)']];
const CONTACT = ['name', 'email', 'kofi', 'paypal', 'patreon'];

const ids = (list) => [...new Set((list || []).map(Number).filter((n) => Number.isSafeInteger(n) && n > 0))];
const row = (r) => ({ id: String(r.id || ''), ...Object.fromEntries(CONTACT.map((k) => [k, String(r[k] || '')])), appids: ids(r.appids),
  playMinutes: Math.max(0, Math.floor(Number(r.playMinutes)) || 0), points: Math.max(0, Math.floor(Number(r.points)) || 0) });

// Rows for one install: listed developers (sample listings excluded) then submissions. A submission
// sharing an appid with an earlier row fills in that row's contact details instead of adding a row,
// so every appid's play counts once.
function devRows({ developers = [], submissions = [], stats = {} } = {}) {
  const rows = [];
  for (const d of developers || []) {
    if (!d || d.sample) continue;
    rows.push({ id: d.devId, name: d.name, email: '', kofi: d.links?.kofi || '', paypal: '', patreon: d.links?.patreon || '', appids: ids((d.apps || []).map((a) => a.appid)) });
  }
  for (const s of submissions || []) {
    if (!s) continue;
    const appids = ids((s.games || []).map((g) => g.appid));
    const hit = rows.find((r) => r.appids.some((a) => appids.includes(a)));
    if (!hit) {
      rows.push({ id: s.id, name: s.name, email: s.email, kofi: s.kofi, paypal: s.paypal, patreon: s.patreon, appids });
      continue;
    }
    for (const k of CONTACT) if (!hit[k] && s[k]) hit[k] = s[k];
    hit.appids = ids([...hit.appids, ...appids]);
  }
  const perApp = (stats && stats.perApp) || {};
  return rows.map((r) => row({ ...r,
    playMinutes: r.appids.reduce((m, a) => m + Math.floor(Math.max(0, Number(perApp[a]?.playSeconds) || 0) / 60), 0),
    points: points(stats, r.appids) }));
}

// Same developer across installs: by ID, else email, else name.
const keyOf = (r) => (r.id ? `id:${r.id}` : r.email ? `email:${r.email.toLowerCase()}` : `name:${r.name.toLowerCase()}`);

// Sums play minutes and points of the same developer over several row lists; contacts fill in.
function mergeRows(lists) {
  const by = new Map();
  for (const list of lists || []) for (const raw of list || []) {
    const r = row(raw);
    if (!r.name && !r.id) continue;
    const k = keyOf(r), m = by.get(k);
    if (!m) { by.set(k, r); continue; }
    m.playMinutes += r.playMinutes;
    m.points += r.points;
    m.appids = ids([...m.appids, ...r.appids]);
    for (const c of CONTACT) if (!m[c] && r[c]) m[c] = r[c];
  }
  return [...by.values()];
}

const dollars = (c) => `${Math.floor(c / 100)}.${String(c % 100).padStart(2, '0')}`;

// Splits revenueCents: 70% to the rows by points, the rest to Shellcade. Returns the developer rows
// with share/cents, plus the Shellcade, unallocated (nobody played) and total amounts.
function buildSheet(rows, revenueCents) {
  if (!Number.isSafeInteger(revenueCents) || revenueCents < 0) throw new RangeError('revenueCents must be a non-negative integer');
  const pay = computePayouts({ netRevenueCents: revenueCents, creatorShare: DEV_SHARE, devs: rows.map((r) => ({ devId: keyOf(r), points: r.points })) });
  const cents = new Map(pay.map((p) => [p.devId, p.cents]));
  const totalPoints = rows.reduce((s, r) => s + r.points, 0);
  const devs = rows.map((r) => ({ ...r, share: totalPoints ? (r.points / totalPoints) * 100 : 0, cents: cents.get(keyOf(r)) || 0 }));
  const pool = Number((BigInt(revenueCents) * BigInt(Math.round(DEV_SHARE * 100))) / 100n);
  const paid = devs.reduce((s, r) => s + r.cents, 0);
  return { rows: devs, revenueCents, poolCents: pool, shellcadeCents: revenueCents - pool, unallocatedCents: pool - paid, totalPoints,
    playMinutes: rows.reduce((s, r) => s + r.playMinutes, 0) };
}

// A CSV cell: text that a spreadsheet would read as a formula gets a leading apostrophe.
const cell = (v) => {
  let s = typeof v === 'number' ? String(v) : String(v ?? '');
  if (typeof v !== 'number' && /^[=+\-@\t\r]/.test(s)) s = `'${s}`;
  return /[",\r\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
};

function toCsv(sheet) {
  const line = (r) => COLUMNS.map(([k]) => cell(r[k])).join(',');
  const special = (id, name, cents, extra = {}) => line({ id, name, payout: dollars(cents), ...extra });
  const out = [COLUMNS.map(([, label]) => label).join(',')];
  for (const r of sheet.rows) out.push(line({ ...r, appids: r.appids.join(' '), share: r.share.toFixed(2), payout: dollars(r.cents) }));
  out.push(special('_shellcade', `Shellcade (${Math.round((1 - DEV_SHARE) * 100)}%)`, sheet.shellcadeCents));
  if (sheet.unallocatedCents) out.push(special('_unallocated', 'Unallocated (no play this period)', sheet.unallocatedCents));
  out.push(special('_total', 'Total', sheet.revenueCents, { playMinutes: sheet.playMinutes, points: sheet.totalPoints, share: sheet.totalPoints ? '100.00' : '0.00' }));
  return '﻿' + out.join('\r\n') + '\r\n';
}

// Usage file for merging: the rows without the money columns.
const toJson = (rows, extra = {}) => JSON.stringify({ v: 1, kind: 'shellcade-usage', ...extra, rows: rows.map(row) }, null, 2);

function parseCsv(text) {
  const s = String(text).replace(/^﻿/, '');
  const rows = [];
  let cur = [], f = '', q = false;
  for (let i = 0; i < s.length; i++) {
    const c = s[i];
    if (q) {
      if (c === '"' && s[i + 1] === '"') { f += '"'; i++; } else if (c === '"') q = false; else f += c;
    } else if (c === '"') q = true;
    else if (c === ',') { cur.push(f); f = ''; } else if (c === '\n' || c === '\r') {
      if (c === '\r' && s[i + 1] === '\n') i++;
      cur.push(f); rows.push(cur); cur = []; f = '';
    } else f += c;
  }
  if (f || cur.length) { cur.push(f); rows.push(cur); }
  return rows.filter((r) => r.some((x) => x !== ''));
}

// Developer rows of a sheet CSV (Shellcade/total rows skipped) or of a usage JSON ({rows} or [rows]).
function readUsage(text, name = '') {
  if (/\.json$/i.test(name) || /^\s*[[{]/.test(String(text).replace(/^﻿/, ''))) {
    const d = JSON.parse(String(text).replace(/^﻿/, ''));
    return (Array.isArray(d) ? d : d.rows || []).map(row);
  }
  const [head = [], ...body] = parseCsv(text);
  const keys = head.map((h) => (COLUMNS.find(([k, l]) => [k, l].some((x) => x.toLowerCase() === h.trim().toLowerCase())) || [])[0]);
  return body.map((cells) => {
    const r = {};
    keys.forEach((k, i) => { if (k) r[k] = String(cells[i] ?? '').replace(/^'(?=[=+\-@\t\r])/, ''); });
    r.appids = String(r.appids || '').split(/[\s,;]+/);
    return r;
  }).filter((r) => !String(r.id || '').startsWith('_')).map(row);
}

module.exports = { devRows, mergeRows, buildSheet, toCsv, toJson, parseCsv, readUsage, COLUMNS, DEV_SHARE };
