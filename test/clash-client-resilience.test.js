// Fandom Clash client (src/main/clash.js) resilience: the circuit breaker, the quick retry, the durable upload
// queue (exponential back-off with jitter, Retry-After, idempotency keys, no lost runs), the snapshot's
// conditional GET, and the bet saga (every ticket ends settled or refunded).
const { test, after } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const clashLib = require('../src/main/clash');
const { Economy } = require('../src/main/economy/economy');

const FIX = path.join(__dirname, 'fixtures', 'clash-snapshot.json');
const SNAP = JSON.parse(fs.readFileSync(FIX, 'utf8'));
const TMP = fs.mkdtempSync(path.join(os.tmpdir(), 'kayboro-clash-res-'));
after(() => fs.rmSync(TMP, { recursive: true, force: true }));
let n = 0;
delete process.env.KAYBORO_CLASH_URL;
const json = (o, status = 200, headers = {}) => new Response(JSON.stringify(o), { status, headers: { 'Content-Type': 'application/json', ...headers } });

function setup(routes, o = {}) {
  const dir = path.join(TMP, String(++n));
  const eco = new Economy({ dir: path.join(dir, 'kayboro') });
  const clock = { t: 1e12 };
  const log = [];
  const ids = SNAP.characters.map((x) => x.id);
  const round = (i) => ({ round: i, kind: 'char-char', a: { type: 'character', id: ids[i] }, b: { type: 'character', id: ids[i + 12] }, totals: { a: 1000 + i, b: 500 }, answer: 'a' });
  const all = {
    'GET /v1/match': () => json({ seed: 4242, mode: 'ranked', difficulty: 'normal', rounds: Array.from({ length: 10 }, (_, i) => round(i)), registered: true }),
    'GET /v1/leaderboard': () => json({ entries: [] }),
    ...routes,
  };
  const net = {
    fetch: async (url, opts = {}) => {
      const u = new URL(url);
      const k = `${opts.method || 'GET'} ${u.pathname}`;
      log.push({ k, at: clock.t, body: opts.body ? JSON.parse(opts.body) : null, headers: opts.headers || {}, cache: opts.cache });
      const fn = all[k];
      if (!fn) return json({ error: 'nope' }, 404);
      return fn(opts.body ? JSON.parse(opts.body) : null, opts);
    },
  };
  const c = clashLib.create({ net, userDataDir: dir, economy: () => eco, bundled: [FIX], matchmaking: null, serverUrl: 'https://clash.example', now: () => clock.t, ...o });
  const queue = () => { try { return JSON.parse(fs.readFileSync(path.join(dir, 'kayboro', 'clash', 'pending.json'), 'utf8')); } catch { return []; } };
  return { c, eco, clock, log, dir, queue };
}

test('queue back-off is exponential with jitter, capped', () => {
  const { QUEUE } = clashLib;
  for (let a = 1; a <= 12; a++) {
    const cap = Math.min(QUEUE.maxMs, QUEUE.baseMs * 2 ** (a - 1));
    assert.equal(clashLib.queueDelay(a, () => 0), cap / 2);
    assert.equal(clashLib.queueDelay(a, () => 0.999999), Math.round(cap / 2 + 0.999999 * (cap / 2)));
  }
  assert.equal(clashLib.queueDelay(1, () => 0), 15000);
  assert.equal(clashLib.queueDelay(50, () => 1), QUEUE.maxMs, 'never past the cap');
});

test('circuit breaker: opens after a failure, fails fast while open, half-opens with one probe, closes on success', async () => {
  let down = true, calls = 0;
  const { c, clock } = setup({ 'GET /v1/leaderboard': () => { calls++; return down ? json({}, 503) : json({ entries: [] }); } });
  assert.equal((await c.leaderboard({ mode: 'ranked' })).source, 'local');
  assert.equal(calls, 2, 'first try + one quick retry on 503');
  await c.leaderboard({ mode: 'ranked' });
  assert.equal(calls, 2, 'open: no request at all');
  clock.t += clashLib.BREAKER.baseMs * 1.25; // past the (jittered) first open period
  await c.leaderboard({ mode: 'ranked' });
  assert.equal(calls, 3, 'half-open: a single probe, no retry');
  assert.equal(c.status().online, false);
  await c.leaderboard({ mode: 'ranked' });
  assert.equal(calls, 3, 're-opened, for longer');
  clock.t += clashLib.BREAKER.baseMs * 1.25;
  await c.leaderboard({ mode: 'ranked' });
  assert.equal(calls, 3, 'the second open period is about twice as long');
  clock.t += clashLib.BREAKER.baseMs * 1.25;
  down = false;
  assert.equal((await c.leaderboard({ mode: 'ranked' })).source, 'server');
  assert.equal(c.status().online, true);
  await c.leaderboard({ mode: 'ranked' });
  assert.equal(calls, 5, 'closed again');
});

test('client requests bypass the HTTP cache (boards are fresh right after a run)', async () => {
  const { c, log } = setup({});
  await c.leaderboard({ mode: 'ranked' });
  assert.equal(log[0].cache, 'no-store');
});

test('a run whose answer is lost is retried with the same idempotency key and counted once', async () => {
  let posts = 0;
  const { c, clock, log, queue } = setup({
    'POST /v1/runs': () => { posts++; if (posts === 1) throw Object.assign(new Error('timeout'), { name: 'TimeoutError' }); return json({ runId: 1, score: 5, rank: 1 }, 201); },
  });
  const m = await c.match({ mode: 'ranked' });
  const r = await c.submitRun({ matchId: m.matchId, answers: [{ round: 0, pick: 'a', ms: 900 }] });
  assert.equal(r.queued, true);
  assert.equal(posts, 1, 'a timeout is not retried at once');
  const q = queue();
  assert.equal(q.length, 1);
  assert.equal(q[0].attempts, 1);
  assert.ok(q[0].nextAt >= clock.t + 15000 && q[0].nextAt <= clock.t + 30000, 'first back-off 15-30 s');
  await c.flushPending();
  assert.equal(posts, 1, 'not due yet');
  clock.t += 60000;
  await c.flushPending();
  assert.equal(posts, 2);
  assert.equal(queue().length, 0);
  const keys = log.filter((x) => x.k === 'POST /v1/runs').map((x) => x.body.idempotencyKey);
  assert.equal(new Set(keys).size, 1);
  assert.match(keys[0], /^run-[0-9a-f]{24}$/);
});

test('queue: Retry-After is honoured, 4xx refusals are dropped, a run queued during a flush is not lost', async () => {
  let mode = '429';
  let release;
  const { c, clock, queue } = setup({
    'POST /v1/runs': (b) => {
      if (mode === '429') return json({ error: 'slow down' }, 429, { 'retry-after': '120' });
      if (mode === 'hold') return new Promise((res) => { release = () => res(json({ runId: 2 }, 201)); });
      if (b.seed === 1) return json({ error: 'match expired' }, 410);
      return json({ runId: 3 }, 201);
    },
  });
  const m = await c.match({ mode: 'ranked' });
  await c.submitRun({ matchId: m.matchId, answers: [] });
  let q = queue();
  assert.equal(q.length, 1, '429 queues');
  clock.t += 60000;
  await c.flushPending();
  q = queue();
  assert.equal(q[0].attempts, 2);
  assert.ok(q[0].nextAt >= clock.t + 120000, 'waits at least Retry-After');
  // A slow flush in flight while another run is queued: both survive.
  clock.t += 200000;
  mode = 'hold';
  const flushing = c.flushPending();
  await new Promise((r) => setTimeout(r, 20));
  mode = '429';
  const m2 = await c.match({ mode: 'ranked' });
  await c.submitRun({ matchId: m2.matchId, answers: [] });
  assert.equal(queue().length, 2);
  release();
  await flushing;
  assert.equal(queue().length, 1, 'the in-flight one was sent, the new one is still queued');
  // A refusal the server will repeat forever (410 expired) is dropped, not retried.
  mode = 'ok';
  const left = queue();
  left[0].body.seed = 1; left[0].nextAt = 0;
  fs.writeFileSync(path.join(c.dir, 'pending.json'), JSON.stringify(left));
  clock.t += 1e6;
  await c.flushPending();
  assert.equal(queue().length, 0);
});

test('queue: the pre-queue file format is migrated and sent with a key; stale items expire', async () => {
  const { c, clock, log, queue } = setup({ 'POST /v1/runs': () => json({ runId: 7 }, 201) });
  const body = { player: { id: 'legacy-player-1', name: 'Old' }, mode: 'ranked', difficulty: 'normal', seed: 99, answers: [] };
  fs.mkdirSync(c.dir, { recursive: true });
  fs.writeFileSync(path.join(c.dir, 'pending.json'), JSON.stringify([body]));
  assert.equal(c.status().pending, 1);
  await c.flushPending();
  assert.equal(queue().length, 0);
  assert.match(log.find((x) => x.k === 'POST /v1/runs').body.idempotencyKey, /^q-/);
  fs.writeFileSync(path.join(c.dir, 'pending.json'), JSON.stringify([{ id: 'old-item-1', body, at: clock.t - 24 * 3600e3, attempts: 3, nextAt: 0 }]));
  await c.flushPending();
  assert.equal(queue().length, 0, 'older than the server keeps matches: dropped');
  assert.equal(log.filter((x) => x.k === 'POST /v1/runs').length, 1);
});

test('snapshot refresh uses the ETag: a 304 keeps the cached snapshot and costs no download', async () => {
  let gets = 0;
  const newer = { ...SNAP, generatedAt: '2026-10-22T00:00:00.000Z' };
  const { c, log } = setup({
    'GET /v1/snapshot': (_b, opts) => {
      gets++;
      if (opts.headers['If-None-Match'] === '"2026-10-22T00:00:00.000Z-gzip"') return new Response(null, { status: 304 });
      return json(newer, 200, { etag: '"2026-10-22T00:00:00.000Z-gzip"' });
    },
  });
  await c.refreshSnapshot(true);
  assert.equal(c.status().snapshot.generatedAt, newer.generatedAt);
  await c.refreshSnapshot(true);
  assert.equal(gets, 2);
  assert.equal(log[1].headers['If-None-Match'], '"2026-10-22T00:00:00.000Z-gzip"');
  assert.equal(c.status().snapshot.generatedAt, newer.generatedAt);
  assert.equal(c.status().online, true);
});

test('bet saga: a ghost bet settles before the upload; failures refund; nothing stays in escrow', async () => {
  const { c, eco } = setup({ 'POST /v1/runs': () => json({}, 503) });
  eco.grant({ coins: 2000 });
  // Pick-your-own with a bad choice: the error refunds the ticket (it used to stay open until a restart).
  const o = await c.opponents({ champion: { type: 'c', id: SNAP.characters[0].id }, difficulty: 'normal', seed: 'x' });
  const t1 = eco.placeBet(100, { game: 'clash-pick' }).ticket;
  await assert.rejects(c.resolvePick({ matchId: o.matchId, opponents: ['nobody'], ticket: t1 }), /Choose 1 to 5/);
  assert.equal(eco.betLimits().open, 0);
  assert.equal(eco.getState().coins, 2000);
  // Expired match-ups refund too.
  const t2 = eco.placeBet(50, { game: 'clash-percent' }).ticket;
  await assert.rejects(c.resolvePercent({ matchId: 'm-gone', guess: 70, ticket: t2 }), /expired/);
  assert.equal(eco.getState().coins, 2000);
  // A local ghost with a bet, server down for the upload: the bet is settled from the local score regardless.
  const m = await c.match({ mode: 'ranked' });
  const first = await c.submitRun({ matchId: m.matchId, answers: [] });
  const g = await c.match({ mode: 'ghost', ghost: first.runId });
  const t3 = eco.placeBet(100, { game: 'clash-ghost' }).ticket;
  const res = await c.submitRun({ matchId: g.matchId, answers: g.rounds.map((r, round) => ({ round, pick: r.a.total > r.b.total ? 'a' : 'b', ms: 500 })), ticket: t3 });
  assert.deepEqual([res.bet.outcome, res.bet.payout], ['win', 190]);
  assert.equal(eco.betLimits().open, 0);
  assert.equal(eco.getState().coins, 2090);
});
