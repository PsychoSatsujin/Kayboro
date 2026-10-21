// Fandom Clash server hardening: idempotent POSTs, the health endpoint, Retry-After on rate limits, ETag
// handling (handler, in-memory D1), and the Node wrapper as a real process: body limits, the client IP from
// X-Real-IP, and a graceful drain on shutdown (in-flight requests finish, SQLite is closed).
const { test, after } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const http = require('node:http');
const { fork } = require('node:child_process');
const { pathToFileURL } = require('node:url');

const mm = require('../tools/clash/matchmaking.js');
const ROOT = path.join(__dirname, '..');
const SAMPLE = JSON.parse(fs.readFileSync(path.join(ROOT, 'tools', 'clash', 'sample-snapshot.json'), 'utf8'));
const SCHEMA = fs.readFileSync(path.join(ROOT, 'server', 'clash', 'schema.sql'), 'utf8');
const PLAYER = { id: 'hardening-test-01', name: 'Hardy' };
const TMP = fs.mkdtempSync(path.join(os.tmpdir(), 'kayboro-clash-srv-'));
after(() => fs.rmSync(TMP, { recursive: true, force: true }));

let sqlite = null;
try { sqlite = require('node:sqlite'); } catch { /* older Node */ }
const skip = !sqlite && 'node:sqlite unavailable';

async function harness() {
  const { handle, cleanup } = await import(pathToFileURL(path.join(ROOT, 'server', 'clash', 'src', 'index.mjs')).href);
  const { d1 } = await import(pathToFileURL(path.join(ROOT, 'server', 'clash', 'node', 'shim.mjs')).href);
  const db = new sqlite.DatabaseSync(':memory:');
  db.exec(SCHEMA);
  const kv = new Map([['snapshot:current', SAMPLE.generatedAt], [`snapshot:${SAMPLE.generatedAt}`, JSON.stringify(SAMPLE)]]);
  const env = { DB: d1(db), CLASH_KV: { get: async (k) => kv.get(k) ?? null }, IP_SALT: 'test' };
  const h = { db, env, kv, now: Date.parse('2026-10-21T12:00:00Z'), cleanup };
  h.call = async (method, p, body, { ip = '10.0.0.1', headers = {} } = {}) => {
    const req = new Request(`https://clash.test${p}`, { method, headers: { 'content-type': 'application/json', 'cf-connecting-ip': ip, ...headers }, body: body == null ? undefined : JSON.stringify(body) });
    const res = await handle(req, env, h.now);
    const text = await res.text();
    return { status: res.status, headers: res.headers, body: text ? JSON.parse(text) : null };
  };
  return h;
}

test('GET /v1/health: 200 with the snapshot id; 503 without a snapshot; never cached', { skip }, async () => {
  const h = await harness();
  const ok = await h.call('GET', '/v1/health');
  assert.equal(ok.status, 200);
  assert.deepEqual([ok.body.ok, ok.body.db, ok.body.snapshot], [true, true, SAMPLE.generatedAt]);
  assert.equal(ok.headers.get('cache-control'), 'no-store');
  assert.equal(ok.headers.get('x-content-type-options'), 'nosniff');
  h.kv.clear();
  h.now += 10 * 60e3; // past the snapshot memo
  const bad = await h.call('GET', '/v1/health');
  assert.equal(bad.status, 503);
  assert.equal(bad.body.ok, false);
});

test('POST /v1/runs with an idempotency key: a retry returns the original result, not a 409 or a second run', { skip }, async () => {
  const h = await harness();
  const m = await h.call('GET', '/v1/match?mode=ranked&difficulty=normal');
  const answers = m.body.rounds.map((r, i) => ({ round: i, pick: r.answer, ms: 1500 }));
  const body = { player: PLAYER, mode: 'ranked', difficulty: 'normal', seed: m.body.seed, answers, idempotencyKey: 'run-0123456789abcdef' };
  const first = await h.call('POST', '/v1/runs', body);
  assert.equal(first.status, 201);
  assert.equal(first.body.score, 10 * 200);
  const retry = await h.call('POST', '/v1/runs', body);
  assert.equal(retry.status, 201);
  assert.deepEqual(retry.body, first.body);
  assert.equal(retry.headers.get('idempotent-replay'), 'true');
  assert.equal(h.db.prepare('SELECT COUNT(*) AS n FROM runs').get().n, 1, 'one run stored');
  // Same key in the header works too.
  const viaHeader = await h.call('POST', '/v1/runs', { ...body, idempotencyKey: undefined }, { headers: { 'idempotency-key': 'run-0123456789abcdef' } });
  assert.equal(viaHeader.status, 201);
  assert.equal(viaHeader.body.runId, first.body.runId);
  // The same key with a different request is refused; no key = the plain single-use seed rule (409).
  assert.equal((await h.call('POST', '/v1/runs', { ...body, answers: answers.slice(1) })).status, 422);
  assert.equal((await h.call('POST', '/v1/runs', { ...body, idempotencyKey: undefined })).status, 409);
  assert.equal((await h.call('POST', '/v1/runs', { ...body, idempotencyKey: 'other-key-123' })).status, 409, 'a new key cannot reuse the seed');
  assert.equal((await h.call('POST', '/v1/runs', { ...body, idempotencyKey: 'bad key!' })).status, 400);
  // Keys are per player: another player with the same key is a different request.
  const other = await h.call('POST', '/v1/runs', { ...body, player: { id: 'hardening-test-02', name: 'B' } });
  assert.equal(other.status, 409);
  // Old idempotency records are cleaned up after 48 h.
  h.now += 49 * 3600e3;
  await h.cleanup(h.env, h.now);
  assert.equal(h.db.prepare('SELECT COUNT(*) AS n FROM idem').get().n, 0);
});

test('POST /v1/groups with an idempotency key makes one group however often it is retried', { skip }, async () => {
  const h = await harness();
  const body = { name: 'Retry crew', player: PLAYER, idempotencyKey: 'grp-abcdef012345' };
  const a = await h.call('POST', '/v1/groups', body);
  const b = await h.call('POST', '/v1/groups', body);
  assert.equal(a.status, 201);
  assert.deepEqual(b.body, a.body);
  assert.equal(h.db.prepare('SELECT COUNT(*) AS n FROM groups').get().n, 1);
  const c = await h.call('POST', '/v1/groups', { ...body, idempotencyKey: 'grp-abcdef012346' });
  assert.notEqual(c.body.code, a.body.code);
});

test('rate limits answer 429 with Retry-After, per client IP, and reset with the window', { skip }, async () => {
  const h = await harness();
  let last;
  for (let i = 0; i < 11; i++) last = await h.call('POST', '/v1/groups', {}, { ip: '10.1.1.1' });
  assert.equal(last.status, 429);
  const ra = Number(last.headers.get('retry-after'));
  assert.ok(ra >= 1 && ra <= 3600, `retry-after ${ra}`);
  assert.equal((await h.call('POST', '/v1/groups', {}, { ip: '10.1.1.2' })).status, 201, 'another IP has its own bucket');
  for (let i = 0; i < 61; i++) last = await h.call('GET', '/v1/match?mode=ranked&difficulty=easy', null, { ip: '10.1.1.3' });
  assert.equal(last.status, 429);
  assert.ok(Number(last.headers.get('retry-after')) <= 60);
  h.now += 61e3;
  assert.equal((await h.call('GET', '/v1/match?mode=ranked&difficulty=easy', null, { ip: '10.1.1.3' })).status, 200);
  // A client cannot pick its own bucket on the Node server: the wrapper overwrites cf-connecting-ip (tested below);
  // x-forwarded-for alone counts its last entry (the one our proxy appended), not the first.
  const { handle } = await import(pathToFileURL(path.join(ROOT, 'server', 'clash', 'src', 'index.mjs')).href);
  const req = (xff) => new Request('https://clash.test/v1/groups', { method: 'POST', headers: { 'x-forwarded-for': xff }, body: '{}' });
  let st;
  for (let i = 0; i < 11; i++) st = (await handle(req(`1.2.3.${i}, 10.5.5.5`), h.env, h.now)).status;
  assert.equal(st, 429);
});

test('snapshot ETag: strong, weak and listed If-None-Match all give 304; bad input never 500s', { skip }, async () => {
  const h = await harness();
  const tag = `"${SAMPLE.generatedAt}"`;
  for (const inm of [tag, `W/${tag}`, `"x", ${tag}`, '*']) assert.equal((await h.call('GET', '/v1/snapshot', null, { headers: { 'if-none-match': inm } })).status, 304, inm);
  assert.equal((await h.call('GET', '/v1/snapshot', null, { headers: { 'if-none-match': '"other"' } })).status, 200);
  assert.equal((await h.call('GET', '/v1/groups/%E0%A4%A')).status, 400, 'malformed escape');
  assert.equal((await h.call('GET', '/v1/leaderboard?mode=local&difficulty=easy')).status, 400);
  assert.equal((await h.call('GET', '/v1/match?seed=-1')).status, 400);
  assert.equal((await h.call('GET', '/v1/ghosts?player=x')).status, 400);
  assert.equal((await h.call('POST', '/v1/runs', [1, 2])).status, 400);
  const lb = await h.call('GET', '/v1/leaderboard?mode=ranked&difficulty=easy');
  assert.equal(lb.headers.get('cache-control'), 'public, max-age=15');
});

// ---- The Node wrapper as a real process ----
function startServer(extraEnv = {}) {
  const data = fs.mkdtempSync(path.join(TMP, 'data-'));
  fs.mkdirSync(path.join(data, 'kv'), { recursive: true });
  fs.writeFileSync(path.join(data, 'kv', encodeURIComponent('snapshot:current')), SAMPLE.generatedAt);
  fs.writeFileSync(path.join(data, 'kv', encodeURIComponent(`snapshot:${SAMPLE.generatedAt}`)), JSON.stringify(SAMPLE));
  const child = fork(path.join(ROOT, 'server', 'clash', 'node', 'server.mjs'), [], {
    execArgv: ['--experimental-sqlite', '--no-warnings'], silent: true,
    env: { ...process.env, PORT: '0', HOST: '127.0.0.1', DATA_DIR: data, IP_SALT: 'test', ...extraEnv },
  });
  let out = '';
  child.stdout.on('data', (d) => { out += d; });
  child.stderr.on('data', (d) => { out += d; });
  const exited = new Promise((res) => child.on('exit', (code) => res(code)));
  const port = new Promise((res, rej) => {
    child.on('message', (m) => m && m.listening && res(m.listening));
    exited.then((code) => rej(new Error(`server exited (${code}): ${out}`)));
    setTimeout(() => rej(new Error('server did not start: ' + out)), 10000).unref();
  });
  return { child, port, exited, data, log: () => out };
}
function request(port, method, p, { body, headers = {} } = {}) {
  return new Promise((resolve, reject) => {
    const req = http.request({ host: '127.0.0.1', port, method, path: p, headers: { 'content-type': 'application/json', ...headers } }, (res) => {
      let text = '';
      res.on('data', (d) => { text += d; });
      res.on('end', () => resolve({ status: res.statusCode, headers: res.headers, body: text ? JSON.parse(text) : null }));
    });
    req.on('error', reject);
    if (body != null) req.write(typeof body === 'string' ? body : JSON.stringify(body));
    req.end();
  });
}

test('node server: health, body size limit, client IP from X-Real-IP, graceful drain on shutdown', { skip, timeout: 30000 }, async () => {
  const s = startServer();
  const port = await s.port;
  try {
    const health = await request(port, 'GET', '/v1/health');
    assert.equal(health.status, 200);
    assert.equal(health.body.snapshot, SAMPLE.generatedAt);
    // Too big: refused with 413, whether declared up front or streamed.
    const big = await request(port, 'POST', '/v1/runs', { body: 'x'.repeat(70 * 1024) });
    assert.equal(big.status, 413);
    // Rate-limit buckets follow X-Real-IP (set by Caddy), and a spoofed cf-connecting-ip is ignored.
    let last;
    for (let i = 0; i < 11; i++) last = await request(port, 'POST', '/v1/groups', { body: {}, headers: { 'x-real-ip': '203.0.113.7', 'cf-connecting-ip': `198.51.100.${i}` } });
    assert.equal(last.status, 429);
    assert.ok(Number(last.headers['retry-after']) >= 1);
    assert.equal((await request(port, 'POST', '/v1/groups', { body: {}, headers: { 'x-real-ip': '203.0.113.8' } })).status, 201);

    // Drain: a request in flight when shutdown starts still gets its answer; then the process exits cleanly.
    const inflight = new Promise((resolve, reject) => {
      const body = JSON.stringify({ name: 'Drain', player: PLAYER });
      const req = http.request({ host: '127.0.0.1', port, method: 'POST', path: '/v1/groups', headers: { 'content-type': 'application/json', 'content-length': Buffer.byteLength(body), 'x-real-ip': '203.0.113.9' } }, (res) => {
        let t = '';
        res.on('data', (d) => { t += d; });
        res.on('end', () => resolve({ status: res.statusCode, body: JSON.parse(t) }));
      });
      req.on('error', reject);
      req.write(body.slice(0, 10));
      setTimeout(() => { s.child.send('shutdown'); setTimeout(() => req.end(body.slice(10)), 300); }, 200);
    });
    const done = await inflight;
    assert.equal(done.status, 201, JSON.stringify(done.body));
    assert.equal(await s.exited, 0, s.log());
    assert.match(s.log(), /draining[\s\S]*closed/);
    // SQLite was checkpointed and closed: the WAL is empty and the group is in the main file.
    const wal = path.join(s.data, 'clash.sqlite-wal');
    assert.ok(!fs.existsSync(wal) || fs.statSync(wal).size === 0, 'WAL checkpointed');
    const db = new sqlite.DatabaseSync(path.join(s.data, 'clash.sqlite'));
    assert.equal(db.prepare("SELECT COUNT(*) AS n FROM groups WHERE name = 'Drain'").get().n, 1);
    db.close();
  } finally { if (s.child.exitCode == null) s.child.kill(); }
});

test('node server with TRUST_PROXY=0 ignores proxy headers (direct exposure, e.g. docker)', { skip, timeout: 30000 }, async () => {
  const s = startServer({ TRUST_PROXY: '0' });
  const port = await s.port;
  try {
    let last;
    for (let i = 0; i < 11; i++) last = await request(port, 'POST', '/v1/groups', { body: {}, headers: { 'x-real-ip': `203.0.113.${i}`, 'x-forwarded-for': `198.51.100.${i}` } });
    assert.equal(last.status, 429, 'every request counted against the socket address');
  } finally { s.child.send('shutdown'); await s.exited; }
});

test('group codes widen to three digits when two-digit ones collide', { skip }, async () => {
  const L = require('../server/clash/src/logic.js');
  const rng = mm.mulberry32(9);
  for (let i = 0; i < 300; i++) assert.match(L.groupCode(rng, true), /^[A-Z]{3,6}-\d{3}$/);
  const h = await harness();
  // Fill every two-digit code: creation must still succeed (with a three-digit one).
  const ins = h.db.prepare('INSERT INTO groups (code, name, created_by, created_at) VALUES (?, ?, NULL, 0)');
  for (const w of L.WORDS) for (let n = 10; n < 100; n++) ins.run(`${w}-${n}`, 'x');
  const g = await h.call('POST', '/v1/groups', { name: 'Late' }, { ip: '10.7.7.7' });
  assert.equal(g.status, 201);
  assert.match(g.body.code, /-\d{3}$/);
});

test('buildMatch output the server stores is what a ghost race replays', () => {
  const m = mm.buildMatch({ snapshot: SAMPLE, mode: 'ranked', difficulty: 'master', seed: 4242 });
  assert.deepEqual(JSON.parse(JSON.stringify(m.rounds)), mm.buildMatch({ snapshot: JSON.parse(JSON.stringify(SAMPLE)), mode: 'ranked', difficulty: 'master', seed: 4242 }).rounds);
});
