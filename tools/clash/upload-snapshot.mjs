#!/usr/bin/env node
// Upload a Fandom Clash snapshot to the Worker's KV namespace via the Cloudflare REST API.
//
//   node tools/clash/upload-snapshot.mjs [path/to/snapshot.json] [--dry-run]
//
// Default path: .cache/clash/snapshot.json (written by build-snapshot.mjs).
// Writes "snapshot:<id>" (the JSON) and then "snapshot:current" (= <id>), where <id> is the
// snapshot's generatedAt. Old snapshots are kept so in-flight matches and ghosts still score.
//
// Needs, from the environment or from the git-ignored server/clash/.env (KEY=VALUE lines):
//   CLOUDFLARE_API_TOKEN    token with "Workers KV Storage: Edit" on the account
//   CLOUDFLARE_ACCOUNT_ID   the account id
//   CLASH_KV_NAMESPACE_ID   id printed by `wrangler kv namespace create CLASH_KV`
// The token is never printed.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(HERE, '..', '..');

const args = process.argv.slice(2);
const dryRun = args.includes('--dry-run');
const file = path.resolve(args.find((a) => !a.startsWith('--')) || path.join(ROOT, '.cache', 'clash', 'snapshot.json'));

function loadDotEnv(p) {
  if (!fs.existsSync(p)) return;
  for (const line of fs.readFileSync(p, 'utf8').split(/\r?\n/)) {
    const m = /^\s*([A-Z0-9_]+)\s*=\s*(.*?)\s*$/.exec(line);
    if (m && !process.env[m[1]]) process.env[m[1]] = m[2].replace(/^["']|["']$/g, '');
  }
}
loadDotEnv(path.join(ROOT, 'server', 'clash', '.env'));

export function validateSnapshot(s) {
  const errs = [];
  if (!s || s.version !== 1) errs.push('version must be 1');
  if (!s || typeof s.generatedAt !== 'string' || Number.isNaN(Date.parse(s.generatedAt))) errs.push('generatedAt must be an ISO date');
  if (!Array.isArray(s && s.sites) || !s.sites.length) errs.push('sites must be a non-empty array');
  if (!Array.isArray(s && s.characters) || s.characters.length < 10) errs.push('need at least 10 characters');
  if (!Array.isArray(s && s.franchises)) errs.push('franchises must be an array');
  if (errs.length) return errs;
  const frIds = new Set(s.franchises.map((f) => f.id));
  let prev = Infinity;
  for (const c of s.characters) {
    if (!c.id || !c.name || !c.franchise || typeof c.total !== 'number') { errs.push(`bad character ${c && c.id}`); break; }
    if (c.total > prev) { errs.push('characters must be sorted by total desc'); break; }
    prev = c.total;
    if (!frIds.has(c.franchise)) { errs.push(`character ${c.id} references unknown franchise ${c.franchise}`); break; }
    if (c.image && !/^https:\/\//.test(c.image.url)) { errs.push(`character ${c.id} image url must be https`); break; }
  }
  return errs;
}

async function kvPut(key, value) {
  const { CLOUDFLARE_API_TOKEN: token, CLOUDFLARE_ACCOUNT_ID: account, CLASH_KV_NAMESPACE_ID: ns } = process.env;
  const url = `https://api.cloudflare.com/client/v4/accounts/${account}/storage/kv/namespaces/${ns}/values/${encodeURIComponent(key)}`;
  const form = new FormData();
  form.set('value', new Blob([value], { type: 'application/json' }));
  form.set('metadata', '{}');
  const res = await fetch(url, { method: 'PUT', headers: { Authorization: `Bearer ${token}` }, body: form });
  const body = await res.json().catch(() => ({}));
  if (!res.ok || body.success === false) {
    const msg = (body.errors || []).map((e) => `${e.code}: ${e.message}`).join('; ') || res.statusText;
    throw new Error(`KV put ${key} failed (${res.status}): ${msg}`);
  }
}

async function main() {
  const text = fs.readFileSync(file, 'utf8');
  const snap = JSON.parse(text);
  const errs = validateSnapshot(snap);
  if (errs.length) throw new Error(`snapshot invalid:\n  ${errs.join('\n  ')}`);
  if (snap.sample) console.warn('warning: this is a sample snapshot ("sample": true)');
  const id = snap.generatedAt;
  const compact = JSON.stringify(snap);
  console.log(`snapshot ${id}: ${snap.characters.length} characters, ${snap.franchises.length} franchises, ${(compact.length / 1024).toFixed(0)} KB`);
  if (compact.length > 24 * 1024 * 1024) throw new Error('snapshot exceeds the 25 MiB KV value limit');
  if (dryRun) { console.log('dry run: nothing uploaded'); return; }
  const missing = ['CLOUDFLARE_API_TOKEN', 'CLOUDFLARE_ACCOUNT_ID', 'CLASH_KV_NAMESPACE_ID'].filter((k) => !process.env[k]);
  if (missing.length) throw new Error(`missing env: ${missing.join(', ')}`);
  await kvPut(`snapshot:${id}`, compact);
  await kvPut('snapshot:current', id);
  console.log(`uploaded; snapshot:current = ${id} (Workers pick it up within ~5 minutes)`);
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  main().catch((e) => { console.error(e.message); process.exit(1); });
}
