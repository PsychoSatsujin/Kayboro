// Unit tests for src/main/clash.js: offline play from the bundled snapshot, authoritative local scoring,
// ghosts, Percentage Vs bets, the server client (stubbed net.fetch), the pending-upload queue, and the
// kclash:// image route (only the snapshot's own SFW image URL is ever fetched).
const { test, after } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const clashLib = require('../src/main/clash');
const { Economy } = require('../src/main/economy/economy');

const FIX = path.join(__dirname, 'fixtures', 'clash-snapshot.json');
const SNAP = JSON.parse(fs.readFileSync(FIX, 'utf8'));
const TMP = fs.mkdtempSync(path.join(os.tmpdir(), 'kayboro-clash-'));
after(() => fs.rmSync(TMP, { recursive: true, force: true }));
let n = 0;
const fresh = () => path.join(TMP, String(++n));
delete process.env.KAYBORO_CLASH_URL;

const json = (o, status = 200) => new Response(JSON.stringify(o), { status, headers: { 'Content-Type': 'application/json' } });
const PNG = Buffer.from('89504e470d0a1a0a0000000d4948445200000001000000010806000000', 'hex');
const offlineNet = { fetch: async () => { throw new Error('no network'); } };
function client(o = {}) {
  const dir = o.dir || fresh();
  const eco = o.eco || new Economy({ dir: path.join(dir, 'kayboro') });
  const c = clashLib.create({ net: o.net || offlineNet, userDataDir: dir, economy: () => eco, bundled: [o.snapshot || FIX], matchmaking: o.matchmaking === 'auto' ? undefined : o.matchmaking ?? null, serverUrl: o.server ?? '', ...o.extra }); // '' = offline unless a test names a server
  return { c, eco, dir };
}
const best = (round) => (round.a.total >= round.b.total ? 'a' : 'b');

test('sanitizeSnapshot keeps https images only and fills totals', () => {
  const s = clashLib.sanitizeSnapshot({ version: 1, characters: [
    { id: 'a', name: 'A', counts: { x: 2, y: 3 }, image: { url: 'http://evil.test/a.png' } },
    { id: 'b', name: 'B', total: 9, image: { url: 'https://img.test/b.png', site: 's', postId: 1 } },
    { id: 'b', name: 'dupe', total: 1 }, { id: 'bad' + String.fromCharCode(92) + 'id', total: 1 }, { id: 'bad' + String.fromCharCode(1) + 'id', total: 1 }, null,
  ], franchises: [{ id: 'f', name: 'F', characters: ['a', 'b', 'zzz'] }, { id: 'fate/grand_order', name: 'Fate/Grand Order', total: 4, characters: [] }, { id: 'gochuumon_wa_usagi_desu_ka?', total: 3 }] });
  assert.equal(s.characters.length, 2);
  assert.equal(s.byId.get('a').total, 5);
  assert.equal(s.byId.get('a').image, null);
  assert.equal(s.byId.get('b').image.url, 'https://img.test/b.png');
  assert.deepEqual(s.franchises[0].characters, ['a', 'b']);
  assert.equal(s.franchises[0].total, 14);
  assert.deepEqual([...s.hosts], ['img.test']);
  // Real Danbooru tags with '/' or '?' must survive (they were dropped once, and every round with them broke).
  assert.deepEqual(s.franchises.map((x) => x.id), ['f', 'fate/grand_order', 'gochuumon_wa_usagi_desu_ka?']);
  assert.equal(clashLib.sanitizeSnapshot({ version: 2, characters: [] }), null);
});

test('offline: status, player and the renderer snapshot (no image URLs leave main)', () => {
  const { c } = client();
  const st = c.status();
  assert.equal(st.server, null);
  assert.equal(st.snapshot.characters, SNAP.characters.length);
  assert.match(st.player.id, /^[0-9a-f-]{36}$/);
  assert.equal(c.setName(' x ').error, 'Names need 2 to 20 characters.');
  assert.equal(c.setName('  Neo   Fan  ').name, 'Neo Fan');
  const s = c.snapshotForRenderer();
  assert.equal(s.characters.length, SNAP.characters.length);
  assert.ok(!JSON.stringify(s).includes('https://'), 'renderer gets ids, never remote URLs');
  const withImg = s.characters.find((x) => x.img), without = s.characters.find((x) => !x.img);
  assert.equal(withImg.img, withImg.id);
  assert.ok(without, 'fixture has characters without images');
  assert.ok(s.franchises.every((f) => f.type === 'f' && (f.img === null || s.characters.some((x) => x.id === f.img))));
});

test('offline match + submitRun: scored in main from the match rounds, saved locally, ranked locally', async () => {
  const { c } = client();
  const m = await c.match({ mode: 'ranked', difficulty: 'hard', seed: 'abc' });
  assert.equal(m.source, 'local');
  assert.equal(m.rounds.length, 10);
  const answers = m.rounds.map((r, round) => ({ round, pick: best(r), ms: 900 }));
  const res = await c.submitRun({ matchId: m.matchId, answers });
  assert.equal(res.correct, 10);
  assert.equal(res.score, 10 * (200 + 50));
  assert.equal(res.localRank, 1);
  assert.equal(res.rank, null);
  await assert.rejects(c.submitRun({ matchId: m.matchId, answers }), /expired/); // one submit per match
  const m2 = await c.match({ mode: 'ranked', difficulty: 'hard' });
  const r2 = await c.submitRun({ matchId: m2.matchId, answers: m2.rounds.map((r, round) => ({ round, pick: best(r) === 'a' ? 'b' : 'a', ms: 1 })) });
  assert.equal(r2.score, 0);
  assert.equal(r2.localRank, 2);
  const lb = await c.leaderboard({ mode: 'ranked', difficulty: 'hard' });
  assert.equal(lb.source, 'local');
  assert.deepEqual(lb.entries.map((e) => e.score), [res.score, 0]);
  assert.equal((await c.leaderboard({ mode: 'local', difficulty: 'hard' })).needGroup, true);
});

test('the real matchmaking (tools/clash/matchmaking.js) builds local matches from a uint32 seed', async () => {
  const mm = require('../tools/clash/matchmaking.js');
  const { c } = client({ matchmaking: 'auto' }); // loads the real module
  const m = await c.match({ mode: 'ranked', difficulty: 'hard' });
  assert.ok(Number.isInteger(m.seed) && m.seed >= 0 && m.seed <= 0xffffffff);
  const want = mm.buildMatch({ snapshot: clashLib.sanitizeSnapshot(SNAP), mode: 'ranked', difficulty: 'hard', seed: m.seed });
  assert.deepEqual(m.rounds.map((r) => r.a.total), want.rounds.map((r) => r.totals.a));
  for (const [i, r] of m.rounds.entries()) {
    const side = want.rounds[i].a;
    if (side.type === 'group' && side.members.length > 1) assert.equal(r.a.type, 'g', 'group sides become teams');
    else assert.equal(r.a.id, side.type === 'group' ? side.members[0].id : side.id);
  }
});

test('a stubbed buildMatch is used, and a broken one falls back', async () => {
  const ids = SNAP.characters.map((x) => x.id);
  const calls = [];
  const matchmaking = { buildMatch: (o) => { calls.push(o); return { rounds: Array.from({ length: o.rounds }, (_, i) => ({ kind: 'char-char', a: { type: 'character', id: ids[i] }, b: { type: 'group', members: [{ type: 'character', id: ids[i + 11] }, { type: 'franchise', id: SNAP.franchises[i % 8].id }] }, totals: { a: 5, b: 7 } })) }; } };
  const { c } = client({ matchmaking });
  const m = await c.match({ mode: 'ranked', difficulty: 'easy' });
  assert.equal(calls[0].difficulty, 'easy');
  assert.equal(calls[0].seed, m.seed);
  assert.equal(m.rounds[0].a.id, ids[0]);
  assert.equal(m.rounds[0].b.type, 'g');
  assert.equal(m.rounds[0].b.members.length, 2);
  assert.equal(m.rounds[0].b.total, 7, 'totals come from the match');
  const res = await c.submitRun({ matchId: m.matchId, answers: [{ round: 0, pick: 'b', ms: 3000 }] });
  assert.equal(res.score, 100 + 45);
  const broken = client({ matchmaking: { buildMatch: () => { throw new Error('boom'); } } }).c;
  assert.equal((await broken.match({ mode: 'ranked', difficulty: 'easy' })).rounds.length, 10, 'falls back');
});

test('local ghosts replay the recorded rounds; a ghost bet settles through the economy', async () => {
  const { c, eco } = client();
  const m = await c.match({ mode: 'ranked', difficulty: 'normal', seed: 'g1' });
  const half = m.rounds.map((r, round) => ({ round, pick: round < 5 ? best(r) : best(r) === 'a' ? 'b' : 'a', ms: 1500 }));
  const ghostRun = await c.submitRun({ matchId: m.matchId, answers: half });
  const top = await c.topGhosts({ mode: 'ranked', difficulty: 'normal' });
  assert.equal(top.source, 'local');
  assert.equal(top.mine[0].id, ghostRun.runId);
  assert.equal(top.mine[0].ms, 15000);
  const g = await c.match({ mode: 'ghost', ghost: ghostRun.runId });
  assert.deepEqual(g.rounds.map((r) => r.a.id), m.rounds.map((r) => r.a.id));
  assert.equal(g.ghost.score, ghostRun.score);
  assert.equal(g.ghost.answers.length, 10);
  eco.grant({ coins: 1000 });
  const bet = eco.placeBet(100, { game: 'clash-ghost' });
  const res = await c.submitRun({ matchId: g.matchId, answers: g.rounds.map((r, round) => ({ round, pick: best(r), ms: 500 })), ticket: bet.ticket });
  assert.equal(res.ghost.outcome, 'win');
  assert.deepEqual([res.bet.outcome, res.bet.payout], ['win', 190]);
  assert.equal(eco.getState().coins, 1090);
  await assert.rejects(c.match({ mode: 'ghost', ghost: 'nope' }), /ghost is gone/);
});

test('leaving a match refunds its bet', async () => {
  const { c, eco } = client();
  eco.grant({ coins: 400 });
  const m = await c.match({ mode: 'ghost', ghost: (await c.submitRun({ matchId: (await c.match({ mode: 'ranked' })).matchId, answers: [] })).runId });
  const t = eco.placeBet(100).ticket;
  c.cancel({ matchId: m.matchId, ticket: t });
  assert.equal(eco.getState().coins, 400);
  assert.equal(eco.betLimits().open, 0);
});

test('Percentage Vs: groups, the outcome from the snapshot, and the bet', async () => {
  const { c, eco } = client();
  eco.grant({ coins: 2000 });
  const p = await c.percentage({ kind: 'groups', difficulty: 'normal', seed: 'p' });
  assert.equal(p.a.length, 3);
  const L = await import('../src/renderer/clash/logic.js');
  const share = L.share(L.groupTotal(p.a), L.groupTotal(p.b));
  const t = eco.placeBet(100).ticket;
  const r = await c.resolvePercent({ matchId: p.matchId, guess: share > 50 ? 99 : 1, ticket: t });
  assert.equal(r.outcome, 'win');
  assert.ok(Math.abs(r.actual - share) < 1e-9);
  assert.equal(r.bet.payout, Math.floor(100 * r.multiplier));
  await assert.rejects(c.resolvePercent({ matchId: p.matchId, guess: 60 }), /expired/);
  const f = await c.percentage({ kind: 'franchises', seed: 'f' });
  assert.equal(f.a[0].type, 'f');
});

test('1 vs many: opponents from the pool only, 1 to 5 of them', async () => {
  const { c } = client();
  const champ = SNAP.characters[0];
  const o = await c.opponents({ champion: { type: 'c', id: champ.id }, difficulty: 'normal', seed: 'x' });
  assert.equal(o.pool.length, 12);
  await assert.rejects(c.resolvePick({ matchId: o.matchId, opponents: ['not-in-pool'] }), /Choose 1 to 5/);
  await assert.rejects(c.resolvePick({ matchId: o.matchId, opponents: o.pool.slice(0, 6).map((x) => x.id) }), /Choose 1 to 5/);
  const r = await c.resolvePick({ matchId: o.matchId, opponents: o.pool.slice(0, 2).map((x) => x.id) });
  assert.equal(r.opponentsTotal, o.pool[0].total + o.pool[1].total);
  assert.equal(r.outcome, champ.total > r.opponentsTotal ? 'win' : champ.total === r.opponentsTotal ? 'push' : 'loss');
  await assert.rejects(c.opponents({ champion: { type: 'f', id: SNAP.franchises[0].id } }), /character/);
});

test('groups offline: made locally, joined without verification, invalid codes refused', async () => {
  const { c } = client();
  const g = await c.createGroup({ name: 'Friday Fans' });
  assert.match(g.code, /^L-[0-9A-F]{6}$/);
  assert.equal(g.offline, true);
  assert.equal((await c.joinGroup('no!')).error.startsWith('Group codes'), true);
  const j = await c.joinGroup('abcd-12');
  assert.equal(j.code, 'ABCD-12');
  assert.deepEqual(c.groups().map((x) => x.code), ['ABCD-12', g.code]);
  const m = await c.match({ mode: 'local', difficulty: 'easy', group: 'abcd-12' });
  assert.equal(m.group, 'ABCD-12');
  c.leaveGroup('ABCD-12');
  assert.deepEqual(c.groups().map((x) => x.code), [g.code]);
});

// ---- Server (stubbed) ----

function fakeServer(over = {}) {
  const log = [];
  const ids = SNAP.characters.map((x) => x.id);
  const round = (i) => ({ round: i, kind: 'char-char', a: { type: 'character', id: ids[i] }, b: { type: 'character', id: ids[i + 12] }, totals: { a: 1000 + i, b: 500 }, answer: 'a' });
  const ghost = { runId: 5, player: { id: 'p1-abcdefgh', name: 'Top' }, mode: 'ranked', difficulty: 'normal', seed: 777, score: 900, correct: 6,
    answers: Array.from({ length: 10 }, (_, r) => ({ round: r, pick: 'b', ms: 800 })), rounds: Array.from({ length: 10 }, (_, i) => round(i)), at: '2026-10-19T00:00:00.000Z' };
  const routes = {
    'GET /v1/snapshot': () => json({ ...SNAP, generatedAt: '2026-10-20T00:00:00.000Z' }),
    'GET /v1/match': () => json({ seed: 123456, mode: 'ranked', difficulty: 'normal', rounds: Array.from({ length: 10 }, (_, i) => round(i)), registered: true }),
    'POST /v1/runs': (b) => json({ runId: 9, score: 1234, rank: 7, best: 1234, personalBest: true, echo: b }, 201),
    'GET /v1/leaderboard': () => json({ entries: [{ rank: 1, player: { id: 'p1-abcdefgh', name: 'Top' }, score: 9000, runId: 5 }, { rank: 2, player: { id: 'p2-abcdefgh', name: 'Second' }, score: 100, runId: 6 }] }),
    'POST /v1/groups': () => json({ code: 'KITE-42', name: 'Fans' }, 201),
    'GET /v1/groups/KITE-42': () => json({ code: 'KITE-42', name: 'Fans', players: 3 }),
    'GET /v1/groups/NOPE-00': () => json({ error: 'group not found' }, 404),
    'GET /v1/ghosts/top': () => json(ghost),
    'GET /v1/ghosts': (_b, u) => (u.searchParams.get('player') === 'p2-abcdefgh' ? json({ ...ghost, runId: 6, player: { id: 'p2-abcdefgh', name: 'Second' }, score: 100 }) : json({ error: 'no runs for that player' }, 404)),
    ...over,
  };
  const net = {
    fetch: async (url, opts = {}) => {
      const u = new URL(url);
      const k = `${opts.method || 'GET'} ${u.pathname}`;
      log.push({ k, url, body: opts.body ? JSON.parse(opts.body) : null });
      if (u.hostname === 'img.clash-fixture.test') return over.image ? over.image(u) : new Response(PNG, { headers: { 'Content-Type': 'image/png' } });
      const fn = routes[k];
      if (!fn) return json({ error: 'nope' }, 404);
      return fn(opts.body ? JSON.parse(opts.body) : null, u);
    },
  };
  return { net, log };
}

test('online: registered server matches, uploads, ranks, boards, groups and ghosts', async () => {
  const { net, log } = fakeServer();
  const { c } = client({ net, server: 'https://clash.example/' });
  const m = await c.match({ mode: 'ranked', difficulty: 'normal' });
  assert.equal(m.source, 'server');
  assert.equal(m.seed, 123456);
  assert.equal(m.rounds[0].a.id, SNAP.characters[0].id);
  assert.equal(m.rounds[0].a.total, 1000, 'server totals win over the local snapshot');
  assert.ok(!log.find((x) => x.k === 'GET /v1/match').url.includes('seed='), 'asks for a registered match');
  const res = await c.submitRun({ matchId: m.matchId, answers: [{ round: 0, pick: 'a', ms: 10 }] });
  assert.deepEqual([res.rank, res.serverScore, res.personalBest, res.online, res.score], [7, 1234, true, true, 150]);
  const post = log.find((x) => x.k === 'POST /v1/runs').body;
  assert.deepEqual(Object.keys(post).sort(), ['answers', 'difficulty', 'idempotencyKey', 'mode', 'player', 'seed', 'snapshot']);
  assert.match(post.idempotencyKey, /^run-[0-9a-f]{24}$/);
  assert.equal(post.seed, 123456);
  assert.deepEqual(post.answers, [{ round: 0, pick: 'a', ms: 10 }]);
  const lb = await c.leaderboard({ mode: 'ranked', difficulty: 'normal' });
  assert.equal(lb.source, 'server');
  assert.deepEqual(lb.entries.map((e) => [e.rank, e.player.name]), [[1, 'Top'], [2, 'Second']]);
  assert.equal((await c.createGroup({ name: 'x' })).code, 'KITE-42');
  assert.equal((await c.joinGroup('kite-42')).members, 3);
  assert.match((await c.joinGroup('NOPE-00')).error, /No group/);
  const lm = await c.match({ mode: 'local', difficulty: 'normal', group: 'KITE-42' });
  await c.submitRun({ matchId: lm.matchId, answers: [] });
  assert.equal(log.filter((x) => x.k === 'POST /v1/runs').at(-1).body.group, 'KITE-42');
  // Ghosts: the board's top ghost in full, other rankers by player on demand.
  const top = await c.topGhosts({ mode: 'ranked', difficulty: 'normal' });
  assert.equal(top.source, 'server');
  assert.deepEqual(top.ghosts.map((g) => [g.id, g.lazy || false]), [['srv-5', false], [null, true]]);
  const second = await c.ghosts({ player: top.ghosts[1].player.id, mode: 'ranked', difficulty: 'normal' });
  assert.equal(second.ghosts[0].id, 'srv-6');
  assert.equal((await c.ghosts({ player: 'nobody-12345' })).ghosts.length, 0);
  const g = await c.match({ mode: 'ghost', ghost: 'srv-5' });
  assert.equal(g.ghost.player.name, 'Top');
  assert.equal(g.seed, 777);
  assert.equal(g.rounds[3].a.total, 1003, 'the recorded rounds replay exactly');
  const gr = await c.submitRun({ matchId: g.matchId, answers: g.rounds.map((_, round) => ({ round, pick: 'a', ms: 1000 })) });
  assert.equal(gr.ghost.outcome, 'win');
  const gpost = log.filter((x) => x.k === 'POST /v1/runs').at(-1).body;
  assert.deepEqual([gpost.mode, gpost.ghostOf, gpost.seed], ['ghost', 5, 777]);
  const st = await c.check();
  assert.equal(st.online, true);
  assert.equal(st.snapshot.source, 'server');
  assert.equal(st.snapshot.generatedAt, '2026-10-20T00:00:00.000Z');
});

test('practice (unregistered) server matches are played locally', async () => {
  const { net } = fakeServer({ 'GET /v1/match': () => json({ seed: 1, rounds: [], registered: false }) });
  const { c } = client({ net, server: 'https://clash.example' });
  assert.equal((await c.match({ mode: 'ranked' })).source, 'local');
});

test('a run from a server match that cannot upload is queued and sent later', async () => {
  let down = false;
  const { net, log } = fakeServer({ 'POST /v1/runs': () => (down ? json({}, 503) : json({ score: 1, rank: 1 })) });
  const now = { t: 1e12 };
  const { c } = client({ net, server: 'https://clash.example', extra: { now: () => now.t } });
  const m = await c.match({ mode: 'ranked' });
  down = true;
  const r = await c.submitRun({ matchId: m.matchId, answers: [] });
  assert.equal(r.rank, null);
  assert.equal(c.status().pending, 1);
  down = false;
  now.t += 60000; // past the back-off
  await c.leaderboard({ mode: 'ranked' }); // any answer from the server flushes the queue
  await c.flushPending();
  assert.equal(c.status().pending, 0);
  // the first try plus its one quick retry (both 503), then the queued send
  assert.equal(log.filter((x) => x.k === 'POST /v1/runs').length, 3);
  const keys = new Set(log.filter((x) => x.k === 'POST /v1/runs').map((x) => x.body.idempotencyKey));
  assert.equal(keys.size, 1, 'every attempt carries the same idempotency key');
});

test('an unreachable server falls back to offline play without waiting on every call', async () => {
  let calls = 0;
  const net = { fetch: async () => { calls++; throw new Error('ECONNREFUSED'); } };
  const { c } = client({ net, server: 'https://down.example' });
  const m = await c.match({ mode: 'ranked' });
  assert.equal(m.source, 'local');
  await c.leaderboard({ mode: 'ranked' });
  await c.match({ mode: 'ranked' });
  assert.equal(calls, 2, 'one quick retry, then the breaker opens and later calls do not wait');
  assert.equal(c.status().online, false);
});

test('kclash://img: only the snapshot image of that character, https, known host, image types; cached', async () => {
  const seen = [];
  const { net } = fakeServer({ image: (u) => { seen.push(u.href); return new Response(PNG, { headers: { 'Content-Type': 'image/png' } }); } });
  const { c, dir } = client({ net });
  const ch = SNAP.characters.find((x) => x.image);
  const r = await c.imageResponse(`kclash://img/${encodeURIComponent(ch.id)}`);
  assert.equal(r.status, 200);
  assert.equal(r.headers.get('content-type'), 'image/png');
  assert.equal(r.headers.get('access-control-allow-origin'), '*');
  assert.deepEqual(Buffer.from(await r.arrayBuffer()), PNG);
  assert.deepEqual(seen, [ch.image.url]);
  await c.imageResponse(`kclash://img/${encodeURIComponent(ch.id)}`);
  assert.equal(seen.length, 1, 'served from the cache the second time');
  assert.ok(fs.readdirSync(path.join(dir, 'kayboro', 'clash', 'img')).length === 1);
  const noImg = SNAP.characters.find((x) => !x.image);
  assert.equal((await c.imageResponse(`kclash://img/${encodeURIComponent(noImg.id)}`)).status, 404);
  assert.equal((await c.imageResponse('kclash://img/not-a-character')).status, 404);
  assert.equal((await c.imageResponse('kclash://other/x')).status, 404);
  assert.equal((await c.imageResponse(`kclash://img/${encodeURIComponent('https://img.clash-fixture.test/sfw/1.png')}`)).status, 404, 'URLs are not ids');
});

test('kclash://img refuses non-image answers and oversized files', async () => {
  const { net } = fakeServer({ image: (u) => (u.pathname.endsWith('/0.png') ? new Response('<html>', { headers: { 'Content-Type': 'text/html' } }) : new Response(Buffer.alloc(13 * 1024 * 1024), { headers: { 'Content-Type': 'image/png' } })) });
  const { c } = client({ net });
  const [first, second] = SNAP.characters.filter((x) => x.image);
  assert.equal((await c.imageResponse(`kclash://img/${encodeURIComponent(first.id)}`)).status, 404);
  assert.equal((await c.imageResponse(`kclash://img/${encodeURIComponent(second.id)}`)).status, 404);
});

test('setServer accepts https (and localhost for testing) only', () => {
  const { c } = client();
  assert.match(c.setServer('ftp://x').error, /https/);
  assert.equal(c.setServer('https://clash.example').server, 'https://clash.example');
  assert.equal(c.setServer('http://localhost:8787').server, 'http://localhost:8787');
  assert.equal(c.setServer('').server, null);
});
