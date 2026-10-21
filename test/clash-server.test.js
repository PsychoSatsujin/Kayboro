// Fandom Clash server: pure scoring/validation logic, plus an end-to-end pass through the Worker's
// fetch handler against an in-memory D1 (node:sqlite running schema.sql) and a Map-backed KV.
const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { pathToFileURL } = require('node:url');

const L = require('../server/clash/src/logic.js');
const mm = require('../tools/clash/matchmaking.js');

const SAMPLE = JSON.parse(fs.readFileSync(path.join(__dirname, '..', 'tools', 'clash', 'sample-snapshot.json'), 'utf8'));
const PLAYER = { id: 'device-abc12345', name: 'Tester' };

// ---------------------------------------------------------------------------------------------
test('speed bonus: full under 2s, fades to 0 at 12s, none for inhuman speed', () => {
  assert.equal(L.speedBonus(100), 0);
  assert.equal(L.speedBonus(1500), 50);
  assert.equal(L.speedBonus(7000), 25);
  assert.equal(L.speedBonus(12000), 0);
  assert.equal(L.speedBonus(undefined), 0);
});

test('scoreRun: binary rounds, difficulty multiplier, unanswered rounds score 0', () => {
  const match = mm.buildMatch({ snapshot: SAMPLE, mode: 'ranked', difficulty: 'hard', seed: 77 });
  const answers = match.rounds.map((r, i) => ({ round: i, pick: i < 6 ? r.answer : (r.answer === 'a' ? 'b' : 'a'), ms: 1500 }));
  answers.pop(); // round 9 unanswered
  const res = L.scoreRun(match, answers);
  assert.equal(res.rounds, 10);
  assert.equal(res.correct, 6);
  assert.equal(res.score, 6 * (200 + 50));
  assert.equal(res.details[9].points, 0);
  assert.equal(res.details[9].ms, null);
  const easy = mm.buildMatch({ snapshot: SAMPLE, mode: 'ranked', difficulty: 'easy', seed: 77 });
  const perfect = L.scoreRun(easy, easy.rounds.map((r, i) => ({ round: i, pick: r.answer, ms: 20000 })));
  assert.equal(perfect.score, 1000);
});

test('scoreRun: percentage rounds reward the right side and closeness of the % guess', () => {
  const match = mm.buildMatch({ snapshot: SAMPLE, mode: 'percentage', difficulty: 'normal', seed: 5 });
  const r0 = match.rounds[0];
  const exact = L.scoreRound(r0, { round: 0, pick: r0.share, ms: 20000 }, 1.5);
  assert.equal(exact.correct, r0.share !== 50);
  assert.equal(exact.points, 150 + 100);
  const off = r0.share > 50 ? Math.max(50.1, r0.share - 30) : Math.min(49.9, r0.share + 30);
  const far = L.scoreRound(r0, { round: 0, pick: off, ms: 20000 }, 1.5);
  assert.ok(far.points >= 150 && far.points < 250);
  const wrongSide = L.scoreRound(r0, { round: 0, pick: r0.answer === 'a' ? 10 : 90, ms: 1000 }, 1.5);
  assert.equal(wrongSide.points, 0);
  const sideOnly = L.scoreRound(r0, { round: 0, pick: r0.answer, ms: 20000 }, 1.5);
  assert.equal(sideOnly.points, 150);
  assert.equal(L.scoreRound(r0, { round: 0, pick: 50, ms: 1000 }, 1).points, 0);
});

test('validateRun accepts the contract and rejects bad input', () => {
  const good = { player: PLAYER, mode: 'ranked', difficulty: 'normal', seed: 123, answers: [{ round: 1, pick: 'b', ms: 900 }, { round: 0, pick: 'a', ms: 1200 }] };
  const v = L.validateRun(good);
  assert.ok(v.ok, v.error);
  assert.deepEqual(v.value.answers.map((a) => a.round), [0, 1]);
  assert.equal(v.value.player.kayboId, null);
  const bad = (patch, why) => assert.equal(L.validateRun({ ...good, ...patch }).ok, false, why);
  bad({ player: { id: 'x', name: 'A' } }, 'short id');
  bad({ player: { id: PLAYER.id, name: '   ' } }, 'blank name');
  bad({ mode: 'casual' }, 'mode');
  bad({ difficulty: 'nightmare' }, 'difficulty');
  bad({ seed: -4 }, 'seed');
  bad({ seed: 2 ** 32 }, 'seed range');
  bad({ mode: 'local' }, 'local needs group');
  bad({ group: 'nope' }, 'group format');
  bad({ mode: 'ghost' }, 'ghost needs ghostOf');
  bad({ answers: [{ round: 0, pick: 'c', ms: 1 }] }, 'pick');
  bad({ answers: [{ round: 0, pick: 'a' }, { round: 0, pick: 'b' }] }, 'duplicate round');
  bad({ answers: 'aaaa' }, 'answers type');
  assert.ok(L.validateRun({ ...good, mode: 'local', group: 'kite-42' }).value.group === 'KITE-42');
  assert.equal(L.cleanName('  Neko‮ Chan  \n'), 'Neko Chan');
  assert.equal(Array.from(L.cleanName('x'.repeat(80))).length, L.LIMITS.nameMax);
});

test('group codes look like KITE-42', () => {
  const rng = mm.mulberry32(1);
  for (let i = 0; i < 200; i++) assert.match(L.groupCode(rng), L.GROUP_CODE);
});

// ---------------------------------------------------------------------------------------------
// End-to-end through the Worker with a node:sqlite-backed D1 shim.
let sqlite = null;
try { sqlite = require('node:sqlite'); } catch { /* older Node: skip the e2e part */ }

function d1(db) {
  return {
    prepare(sql) {
      // D1 uses ?1, ?2 ...; node:sqlite (22.x) does not bind those positionally, so map them to
      // named parameters $p1, $p2 ... and bind an object.
      const used = [...new Set([...sql.matchAll(/\?(\d+)/g)].map((m) => Number(m[1])))];
      const st = db.prepare(sql.replace(/\?(\d+)/g, '$$p$1'));
      let args = [];
      const stmt = {
        bind(...a) {
          const o = {};
          for (const n of used) o[`p${n}`] = a[n - 1] === undefined ? null : a[n - 1];
          args = used.length ? [o] : [];
          return stmt;
        },
        async first() { const r = st.get(...args); return r ? { ...r } : null; },
        async all() { return { results: st.all(...args).map((r) => ({ ...r })) }; },
        async run() { const r = st.run(...args); return { meta: { changes: Number(r.changes) } }; },
      };
      return stmt;
    },
  };
}

test('worker end-to-end: match, run, leaderboard, groups, ghosts', { skip: !sqlite && 'node:sqlite unavailable' }, async () => {
  const { handle, cleanup } = await import(pathToFileURL(path.join(__dirname, '..', 'server', 'clash', 'src', 'index.mjs')).href);
  const db = new sqlite.DatabaseSync(':memory:');
  db.exec(fs.readFileSync(path.join(__dirname, '..', 'server', 'clash', 'schema.sql'), 'utf8'));
  const kv = new Map([['snapshot:current', SAMPLE.generatedAt], [`snapshot:${SAMPLE.generatedAt}`, JSON.stringify(SAMPLE)]]);
  const env = { DB: d1(db), CLASH_KV: { get: async (k) => kv.get(k) ?? null }, IP_SALT: 'test' };
  let now = Date.parse('2026-10-20T12:00:00Z');
  const call = async (method, p, body, ip = '10.0.0.1') => {
    const req = new Request(`https://clash.test${p}`, {
      method, headers: { 'content-type': 'application/json', 'cf-connecting-ip': ip }, body: body ? JSON.stringify(body) : undefined,
    });
    const res = await handle(req, env, now);
    const text = await res.text();
    return { status: res.status, headers: res.headers, body: text ? JSON.parse(text) : null };
  };

  // Snapshot + ETag
  const snap = await call('GET', '/v1/snapshot');
  assert.equal(snap.status, 200);
  assert.equal(snap.body.characters.length, SAMPLE.characters.length);
  const etag = snap.headers.get('etag');
  const again = await handle(new Request('https://clash.test/v1/snapshot', { headers: { 'if-none-match': etag } }), env, now);
  assert.equal(again.status, 304);

  // Match: server-chosen seed, registered; rounds equal matchmaking's own derivation.
  const match = await call('GET', '/v1/match?mode=ranked&difficulty=normal');
  assert.equal(match.status, 200);
  assert.equal(match.body.registered, true);
  assert.deepEqual(match.body.rounds, mm.buildMatch({ snapshot: SAMPLE, mode: 'ranked', difficulty: 'normal', seed: match.body.seed }).rounds);
  const preview = await call('GET', `/v1/match?mode=ranked&difficulty=normal&seed=${match.body.seed}`);
  assert.equal(preview.body.registered, false);
  assert.deepEqual(preview.body.rounds, match.body.rounds);

  // Submit a run: the server re-derives the rounds and scores them itself.
  const answers = match.body.rounds.map((r, i) => ({ round: i, pick: r.answer, ms: 1500 }));
  answers[0].pick = answers[0].pick === 'a' ? 'b' : 'a';
  const run = await call('POST', '/v1/runs', { player: PLAYER, mode: 'ranked', difficulty: 'normal', seed: match.body.seed, answers });
  assert.equal(run.status, 201, JSON.stringify(run.body));
  assert.equal(run.body.correct, 9);
  assert.equal(run.body.score, 9 * (150 + 50));
  assert.equal(run.body.rank, 1);
  assert.equal(run.body.personalBest, true);

  // Same seed twice: refused. Unknown seed: refused.
  assert.equal((await call('POST', '/v1/runs', { player: PLAYER, mode: 'ranked', difficulty: 'normal', seed: match.body.seed, answers })).status, 409);
  assert.equal((await call('POST', '/v1/runs', { player: PLAYER, mode: 'ranked', difficulty: 'normal', seed: (match.body.seed + 1) >>> 0, answers })).status, 400);

  // A second player beats the first.
  const p2 = { id: 'device-xyz98765', name: 'Rival' };
  const m2 = await call('GET', '/v1/match?mode=ranked&difficulty=normal', null, '10.0.0.2');
  const r2 = await call('POST', '/v1/runs', { player: p2, mode: 'ranked', difficulty: 'normal', seed: m2.body.seed,
    answers: m2.body.rounds.map((r, i) => ({ round: i, pick: r.answer, ms: 1000 })) }, '10.0.0.2');
  assert.equal(r2.body.rank, 1);
  const board = await call('GET', '/v1/leaderboard?mode=ranked&difficulty=normal&limit=10');
  assert.deepEqual(board.body.entries.map((e) => [e.rank, e.player.name]), [[1, 'Rival'], [2, 'Tester']]);

  // Groups + local ranking
  const g = await call('POST', '/v1/groups', { name: 'Friday crew', player: PLAYER });
  assert.equal(g.status, 201);
  assert.match(g.body.code, L.GROUP_CODE);
  const m3 = await call('GET', '/v1/match?mode=local&difficulty=easy');
  const r3 = await call('POST', '/v1/runs', { player: PLAYER, mode: 'local', difficulty: 'easy', group: g.body.code, seed: m3.body.seed,
    answers: m3.body.rounds.map((r, i) => ({ round: i, pick: r.answer, ms: 3000 })) });
  assert.equal(r3.status, 201, JSON.stringify(r3.body));
  const lb = await call('GET', `/v1/leaderboard?mode=local&difficulty=easy&group=${g.body.code.toLowerCase()}`);
  assert.equal(lb.body.entries.length, 1);
  const info = await call('GET', `/v1/groups/${g.body.code}`);
  assert.equal(info.body.name, 'Friday crew');
  assert.equal(info.body.players, 1);
  assert.equal((await call('GET', '/v1/groups/ZZZZ-00')).status, 404);

  // Percentage run with numeric picks
  const m4 = await call('GET', '/v1/match?mode=percentage&difficulty=hard');
  assert.equal(m4.body.rounds.length, 5);
  const r4 = await call('POST', '/v1/runs', { player: PLAYER, mode: 'percentage', difficulty: 'hard', seed: m4.body.seed,
    answers: m4.body.rounds.map((r, i) => ({ round: i, pick: r.share, ms: 4000 })) });
  assert.equal(r4.status, 201);
  assert.equal(r4.body.correct, 5);

  // Ghosts: top ranker and by player id; racing the ghost replays its stored rounds.
  const top = await call('GET', '/v1/ghosts/top?mode=ranked&difficulty=normal');
  assert.equal(top.body.player.name, 'Rival');
  assert.equal(top.body.seed, m2.body.seed);
  assert.equal(top.body.answers.length, 10);
  assert.equal(top.body.rounds.length, 10);
  const byPlayer = await call('GET', `/v1/ghosts?player=${PLAYER.id}&mode=ranked&difficulty=normal`);
  assert.equal(byPlayer.body.runId, run.body.runId);
  const race = await call('POST', '/v1/runs', { player: PLAYER, mode: 'ghost', difficulty: 'normal', seed: top.body.seed, ghostOf: top.body.runId,
    answers: top.body.rounds.map((r, i) => ({ round: i, pick: r.answer, ms: 1000 })) });
  assert.equal(race.status, 201, JSON.stringify(race.body));
  assert.equal(race.body.outcome, 'draw');
  assert.equal(race.body.rank, null);
  assert.equal((await call('POST', '/v1/runs', { player: p2, mode: 'ghost', difficulty: 'normal', seed: top.body.seed, ghostOf: top.body.runId, answers: [] }, '10.0.0.2')).status, 400);

  // Validation and routing errors
  assert.equal((await call('GET', '/v1/match?mode=ranked&difficulty=impossible')).status, 400);
  assert.equal((await call('POST', '/v1/runs', { nope: true })).status, 400);
  assert.equal((await call('GET', '/v1/nothing')).status, 404);

  // Rate limit: groups bucket is 10/hour per IP.
  let last;
  for (let i = 0; i < 11; i++) last = await call('POST', '/v1/groups', {}, '10.9.9.9');
  assert.equal(last.status, 429);

  // Expired matches are refused and cleaned up.
  const m5 = await call('GET', '/v1/match?mode=ranked&difficulty=easy');
  now += 25 * 3600 * 1000;
  assert.equal((await call('POST', '/v1/runs', { player: PLAYER, mode: 'ranked', difficulty: 'easy', seed: m5.body.seed, answers: [] })).status, 410);
  await cleanup(env, now);
  assert.equal(db.prepare('SELECT COUNT(*) AS n FROM matches WHERE used_at IS NULL').get().n, 0);
});
