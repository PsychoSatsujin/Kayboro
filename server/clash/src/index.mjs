// Fandom Clash API (Cloudflare Worker). Bindings (see wrangler.toml):
//   DB        D1 database  (schema.sql)
//   CLASH_KV  KV namespace holding snapshots: "snapshot:current" -> id, "snapshot:<id>" -> JSON
//   IP_SALT   secret used to hash client IPs for rate limiting (never stored raw)
import mm from '../../../tools/clash/matchmaking.js';
import logic from './logic.js';

const { buildMatch, randomSeed, DIFFICULTIES, MODES } = mm;
const { validateRun, scoreRun, ghostOutcome, groupCode, windowOf, clampLimit, cleanName, normGroup, GROUP_CODE, PLAYER_ID } = logic;

// Requests per window per hashed IP. Generous: this is a friendly game, not a fortress.
const RATE = {
  match: { limit: 60, windowSec: 60 },
  runs: { limit: 30, windowSec: 60 },
  groups: { limit: 10, windowSec: 3600 },
  read: { limit: 240, windowSec: 60 },
};
const MATCH_TTL_MS = 24 * 3600 * 1000;
const SNAPSHOT_MEMO_MS = 5 * 60 * 1000;
// Idempotency keys (POST /v1/runs, POST /v1/groups): a retried request with the same key gets the
// first answer back instead of a 409 or a second group. Kept for 48 h (longer than a match lives).
const IDEM_KEY = /^[A-Za-z0-9_-]{8,80}$/;
const IDEM_TTL_MS = 48 * 3600 * 1000;

const HEADERS = {
  'content-type': 'application/json; charset=utf-8',
  'access-control-allow-origin': '*',
  'access-control-allow-methods': 'GET, POST, OPTIONS',
  'access-control-allow-headers': 'content-type, idempotency-key, if-none-match',
  'x-content-type-options': 'nosniff',
  'cache-control': 'no-store', // dynamic by default; the snapshot and boards opt in to caching
};
const json = (data, status = 200, extra) => new Response(JSON.stringify(data), { status, headers: { ...HEADERS, ...extra } });
const fail = (status, error, extra) => json({ error }, status, extra);

// ---------------------------------------------------------------------------------------------
// Snapshots (memoised per isolate; KV is eventually consistent anyway)
const memo = { currentId: null, checkedAt: 0, byId: new Map() };
async function loadSnapshot(env, id) {
  if (memo.byId.has(id)) return memo.byId.get(id);
  const text = await env.CLASH_KV.get(`snapshot:${id}`);
  if (!text) return null;
  const entry = { id, text, data: JSON.parse(text) };
  memo.byId.set(id, entry);
  while (memo.byId.size > 3) memo.byId.delete(memo.byId.keys().next().value);
  return entry;
}
async function currentSnapshot(env, now) {
  if (!memo.currentId || now - memo.checkedAt > SNAPSHOT_MEMO_MS) {
    memo.currentId = await env.CLASH_KV.get('snapshot:current');
    memo.checkedAt = now;
  }
  return memo.currentId ? loadSnapshot(env, memo.currentId) : null;
}

// ---------------------------------------------------------------------------------------------
// Rate limiting
const sha256hex = async (text, bytes = 32) => {
  const buf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(text));
  return [...new Uint8Array(buf).slice(0, bytes)].map((b) => b.toString(16).padStart(2, '0')).join('');
};
// The client IP: Cloudflare's header on Workers; on the Linode, node/server.mjs puts the address Caddy saw
// into cf-connecting-ip (overwriting anything the client sent). x-forwarded-for is a last resort: its last
// entry is the one our own proxy appended.
async function ipHash(request, env) {
  const xff = (request.headers.get('x-forwarded-for') || '').split(',').map((s) => s.trim()).filter(Boolean);
  const ip = request.headers.get('cf-connecting-ip') || xff[xff.length - 1] || 'local';
  return sha256hex(`${env.IP_SALT || 'dev-salt'}|${ip}`, 12);
}
// Fixed window per hashed IP and bucket. Returns null when allowed, else the seconds until the window resets.
async function limited(env, ctx, bucket, now) {
  const { limit, windowSec } = RATE[bucket];
  const win = windowOf(now, windowSec);
  const row = await env.DB.prepare(
    `INSERT INTO rate (key, win, count) VALUES (?1, ?2, 1)
     ON CONFLICT(key) DO UPDATE SET count = CASE WHEN rate.win = excluded.win THEN rate.count + 1 ELSE 1 END, win = excluded.win
     RETURNING count`,
  ).bind(`${bucket}:${ctx.ip}`, win).first();
  if (!row || row.count <= limit) return null;
  return Math.max(1, Math.ceil((win + 1) * windowSec - now / 1000));
}
const slowDown = (retryAfter, msg = 'slow down a little') => fail(429, msg, { 'retry-after': String(retryAfter) });

// Runs `fn` at most once per (route, scope, key): a replay returns the stored status and body. A key reused
// with a different request body is refused (422). 5xx and 429 answers are not stored, so those retry for real.
async function idempotent(request, env, ctx, route, scope, body, fn) {
  const key = request.headers.get('idempotency-key') ?? (body && typeof body === 'object' ? body.idempotencyKey : null);
  if (key == null || key === '') return fn();
  if (typeof key !== 'string' || !IDEM_KEY.test(key)) return fail(400, 'idempotency key must be 8-80 chars of [A-Za-z0-9_-]');
  const { idempotencyKey: _k, ...rest } = body && typeof body === 'object' ? body : {};
  const fingerprint = await sha256hex(JSON.stringify(rest));
  const id = `${route}:${scope}:${key}`;
  const prev = await env.DB.prepare('SELECT fingerprint, status, body FROM idem WHERE key = ?1').bind(id).first();
  if (prev) {
    if (prev.fingerprint !== fingerprint) return fail(422, 'this idempotency key was already used for a different request');
    return new Response(prev.body, { status: prev.status, headers: { ...HEADERS, 'idempotent-replay': 'true' } });
  }
  const res = await fn();
  if (res.status < 500 && res.status !== 429) {
    const text = await res.clone().text();
    await env.DB.prepare('INSERT OR IGNORE INTO idem (key, fingerprint, status, body, created_at) VALUES (?1, ?2, ?3, ?4, ?5)')
      .bind(id, fingerprint, res.status, text, ctx.now).run();
  }
  return res;
}

// ---------------------------------------------------------------------------------------------
// Handlers
async function getSnapshot(request, env, ctx) {
  const url = new URL(request.url);
  const id = url.searchParams.get('id');
  const snap = id ? await loadSnapshot(env, id) : await currentSnapshot(env, ctx.now);
  if (!snap) return fail(404, 'no snapshot uploaded yet');
  const etag = `"${snap.id}"`;
  const headers = { etag, 'cache-control': id ? 'public, max-age=31536000, immutable' : 'public, max-age=300' };
  // If-None-Match may list several tags, weak (W/"...") or not; Caddy's encoder adds and strips its own -gzip/-zstd.
  const inm = (request.headers.get('if-none-match') || '').split(',').map((t) => t.trim().replace(/^W\//, ''));
  if (inm.includes(etag) || inm.includes('*')) return new Response(null, { status: 304, headers: { ...HEADERS, ...headers } });
  return new Response(snap.text, { status: 200, headers: { ...HEADERS, ...headers } });
}

function modeAndDifficulty(params) {
  const mode = params.get('mode') || 'ranked';
  const difficulty = params.get('difficulty') || 'normal';
  if (!MODES.includes(mode)) return { error: `mode must be one of ${MODES.join(', ')}` };
  if (!DIFFICULTIES[difficulty]) return { error: `difficulty must be one of ${Object.keys(DIFFICULTIES).join(', ')}` };
  return { mode, difficulty };
}

async function getMatch(request, env, ctx) {
  const params = new URL(request.url).searchParams;
  const md = modeAndDifficulty(params);
  if (md.error) return fail(400, md.error);
  if (md.mode === 'ghost') return fail(400, 'ghost matches come from GET /v1/ghosts (replay the stored seed)');
  const snap = await currentSnapshot(env, ctx.now);
  if (!snap) return fail(503, 'no snapshot uploaded yet');
  const wait = await limited(env, ctx, 'match', ctx.now);
  if (wait) return slowDown(wait);
  const asked = params.get('seed');
  if (asked != null) {
    // Practice / preview: any seed may be looked at, but it is not registered for submission.
    const seed = Number(asked);
    if (!Number.isInteger(seed) || seed < 0 || seed > 0xffffffff) return fail(400, 'seed must be a uint32');
    return json({ ...buildMatch({ snapshot: snap.data, mode: md.mode, difficulty: md.difficulty, seed }), registered: false });
  }
  for (let attempt = 0; attempt < 5; attempt++) {
    const seed = randomSeed(() => crypto.getRandomValues(new Uint32Array(1))[0] / 4294967296);
    const res = await env.DB.prepare(
      'INSERT OR IGNORE INTO matches (seed, snapshot_id, mode, difficulty, issued_at) VALUES (?1, ?2, ?3, ?4, ?5)',
    ).bind(seed, snap.id, md.mode, md.difficulty, ctx.now).run();
    if (res.meta && res.meta.changes === 0) continue; // seed collision, draw again
    return json({ ...buildMatch({ snapshot: snap.data, mode: md.mode, difficulty: md.difficulty, seed }), registered: true });
  }
  return fail(503, 'could not allocate a match, try again');
}

async function upsertPlayer(env, player, now) {
  await env.DB.prepare(
    `INSERT INTO players (id, name, kaybo_user_id, created_at, updated_at) VALUES (?1, ?2, ?3, ?4, ?4)
     ON CONFLICT(id) DO UPDATE SET name = excluded.name,
       kaybo_user_id = COALESCE(excluded.kaybo_user_id, players.kaybo_user_id), updated_at = excluded.updated_at`,
  ).bind(player.id, player.name, player.kayboId, now).run();
}

async function boardRank(env, mode, difficulty, group, score) {
  const row = await env.DB.prepare(
    'SELECT COUNT(*) AS better FROM best WHERE mode = ?1 AND difficulty = ?2 AND group_code = ?3 AND score > ?4',
  ).bind(mode, difficulty, group, score).first();
  return (row ? row.better : 0) + 1;
}

async function postRun(request, env, ctx) {
  let body;
  try { body = await request.json(); } catch { return fail(400, 'invalid JSON'); }
  const v = validateRun(body);
  if (!v.ok) return fail(400, v.error);
  const run = v.value;
  // A retry of the same submission (same player + key) gets the original result, never a 409.
  return idempotent(request, env, ctx, 'runs', run.player.id, body, () => submitRun(env, ctx, run));
}

async function submitRun(env, ctx, run) {
  const wait = await limited(env, ctx, 'runs', ctx.now);
  if (wait) return slowDown(wait);

  let match;
  let snapshotId;
  let ghost = null;
  if (run.mode === 'ghost') {
    ghost = await env.DB.prepare(
      'SELECT r.id, r.seed, r.snapshot_id, r.difficulty, r.rounds, r.score, p.id AS pid, p.name FROM runs r JOIN players p ON p.id = r.player_id WHERE r.id = ?1',
    ).bind(run.ghostOf).first();
    if (!ghost) return fail(404, 'ghost run not found');
    if (ghost.seed !== run.seed) return fail(400, 'seed does not match the ghost run');
    if (ghost.pid === run.player.id) return fail(400, 'you cannot race your own ghost for score (practice is fine offline)');
    match = { difficulty: ghost.difficulty, rounds: JSON.parse(ghost.rounds) };
    snapshotId = ghost.snapshot_id;
  } else {
    const issued = await env.DB.prepare('SELECT * FROM matches WHERE seed = ?1').bind(run.seed).first();
    if (!issued) return fail(400, 'unknown seed: get one from GET /v1/match');
    if (issued.used_at) return fail(409, 'this match was already submitted');
    if (issued.mode !== run.mode && !(issued.mode === 'ranked' && run.mode === 'local') && !(issued.mode === 'local' && run.mode === 'ranked')) {
      return fail(400, 'mode does not match the issued match');
    }
    if (issued.difficulty !== run.difficulty) return fail(400, 'difficulty does not match the issued match');
    if (ctx.now - issued.issued_at > MATCH_TTL_MS) return fail(410, 'match expired');
    const snap = await loadSnapshot(env, issued.snapshot_id);
    if (!snap) return fail(409, 'the snapshot for this match is gone');
    if (run.mode === 'local') {
      const g = await env.DB.prepare('SELECT code FROM groups WHERE code = ?1').bind(run.group).first();
      if (!g) return fail(404, 'group not found');
    }
    // Claim the seed atomically so a double submit cannot score twice.
    const claim = await env.DB.prepare('UPDATE matches SET used_at = ?1 WHERE seed = ?2 AND used_at IS NULL').bind(ctx.now, run.seed).run();
    if (claim.meta && claim.meta.changes === 0) return fail(409, 'this match was already submitted');
    match = buildMatch({ snapshot: snap.data, mode: issued.mode, difficulty: issued.difficulty, seed: run.seed });
    snapshotId = issued.snapshot_id;
  }

  const result = scoreRun(match, run.answers);
  await upsertPlayer(env, run.player, ctx.now);
  const group = run.mode === 'local' ? run.group : '';
  const ins = await env.DB.prepare(
    `INSERT INTO runs (player_id, mode, difficulty, group_code, seed, snapshot_id, answers, rounds, score, correct, duration_ms, ghost_of, created_at)
     VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10, ?11, ?12, ?13) RETURNING id`,
  ).bind(run.player.id, run.mode, match.difficulty, group, run.seed, snapshotId, JSON.stringify(run.answers),
    JSON.stringify(match.rounds), result.score, result.correct, result.durationMs, run.ghostOf, ctx.now).first();
  const runId = ins.id;

  const out = { runId, score: result.score, correct: result.correct, rounds: result.rounds, details: result.details };
  if (ghost) {
    out.rank = null;
    out.ghost = { runId: ghost.id, player: { id: ghost.pid, name: ghost.name }, score: ghost.score };
    out.outcome = ghostOutcome(result.score, ghost.score);
    return json(out, 201);
  }
  // Keep the best score per board, then report the rank on that board.
  await env.DB.prepare(
    `INSERT INTO best (player_id, mode, difficulty, group_code, score, run_id, updated_at) VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7)
     ON CONFLICT(player_id, mode, difficulty, group_code) DO UPDATE SET score = excluded.score, run_id = excluded.run_id, updated_at = excluded.updated_at
     WHERE excluded.score > best.score`,
  ).bind(run.player.id, run.mode, run.difficulty, group, result.score, runId, ctx.now).run();
  const best = await env.DB.prepare('SELECT score FROM best WHERE player_id = ?1 AND mode = ?2 AND difficulty = ?3 AND group_code = ?4')
    .bind(run.player.id, run.mode, run.difficulty, group).first();
  out.best = best ? best.score : result.score;
  out.rank = await boardRank(env, run.mode, run.difficulty, group, out.best);
  out.personalBest = out.best === result.score;
  return json(out, 201);
}

async function getLeaderboard(request, env) {
  const params = new URL(request.url).searchParams;
  const md = modeAndDifficulty(params);
  if (md.error) return fail(400, md.error);
  const group = normGroup(params.get('group') || '');
  if (md.mode === 'local' && !group) return fail(400, 'local leaderboards need ?group=');
  if (group && !GROUP_CODE.test(group)) return fail(400, 'bad group code');
  const limit = clampLimit(params.get('limit'));
  const { results } = await env.DB.prepare(
    `SELECT b.player_id, p.name, b.score, b.run_id, b.updated_at FROM best b JOIN players p ON p.id = b.player_id
     WHERE b.mode = ?1 AND b.difficulty = ?2 AND b.group_code = ?3 ORDER BY b.score DESC, b.updated_at ASC LIMIT ?4`,
  ).bind(md.mode, md.difficulty, group, limit).all();
  // Standard competition ranking (1, 2, 2, 4).
  let rank = 0;
  let prev = null;
  const entries = results.map((r, i) => {
    if (r.score !== prev) { rank = i + 1; prev = r.score; }
    return { rank, player: { id: r.player_id, name: r.name }, score: r.score, runId: r.run_id, at: new Date(r.updated_at).toISOString() };
  });
  return json({ mode: md.mode, difficulty: md.difficulty, group: group || null, entries }, 200, { 'cache-control': 'public, max-age=15' });
}

async function postGroup(request, env, ctx) {
  let body = {};
  try { body = await request.json(); } catch { /* empty body is fine */ }
  if (!body || typeof body !== 'object' || Array.isArray(body)) body = {};
  const createdBy = body.player && PLAYER_ID.test(String(body.player.id || '')) ? body.player.id : null;
  return idempotent(request, env, ctx, 'groups', createdBy || `ip-${ctx.ip}`, body, () => createGroup(env, ctx, body, createdBy));
}

async function createGroup(env, ctx, body, createdBy) {
  const wait = await limited(env, ctx, 'groups', ctx.now);
  if (wait) return slowDown(wait, 'too many groups, try again later');
  const name = cleanName(body.name) || 'Clash group';
  const rand = () => crypto.getRandomValues(new Uint32Array(1))[0] / 4294967296;
  for (let attempt = 0; attempt < 8; attempt++) {
    const code = groupCode(rand, attempt >= 3);
    const res = await env.DB.prepare('INSERT OR IGNORE INTO groups (code, name, created_by, created_at) VALUES (?1, ?2, ?3, ?4)')
      .bind(code, name, createdBy, ctx.now).run();
    if (res.meta && res.meta.changes === 1) return json({ code, name, createdAt: new Date(ctx.now).toISOString() }, 201);
  }
  return fail(503, 'could not allocate a group code, try again');
}

async function getGroup(env, code) {
  try { code = normGroup(decodeURIComponent(code)); } catch { return fail(400, 'bad group code'); }
  if (!GROUP_CODE.test(code)) return fail(400, 'bad group code');
  const g = await env.DB.prepare('SELECT code, name, created_at FROM groups WHERE code = ?1').bind(code).first();
  if (!g) return fail(404, 'group not found');
  const m = await env.DB.prepare('SELECT COUNT(DISTINCT player_id) AS n FROM best WHERE group_code = ?1').bind(code).first();
  return json({ code: g.code, name: g.name, createdAt: new Date(g.created_at).toISOString(), players: m ? m.n : 0 });
}

function ghostPayload(r) {
  return {
    runId: r.id, player: { id: r.player_id, name: r.name }, mode: r.mode, difficulty: r.difficulty,
    group: r.group_code || null, seed: r.seed, snapshot: r.snapshot_id, score: r.score, correct: r.correct,
    answers: JSON.parse(r.answers), rounds: JSON.parse(r.rounds), at: new Date(r.created_at).toISOString(),
  };
}
const GHOST_COLS = 'r.id, r.player_id, p.name, r.mode, r.difficulty, r.group_code, r.seed, r.snapshot_id, r.score, r.correct, r.answers, r.rounds, r.created_at';

async function getGhost(request, env) {
  const params = new URL(request.url).searchParams;
  const player = params.get('player') || '';
  if (!PLAYER_ID.test(player)) return fail(400, 'player must be a player id');
  const mode = params.get('mode');
  const difficulty = params.get('difficulty');
  if (mode && !MODES.includes(mode)) return fail(400, 'bad mode');
  if (difficulty && !DIFFICULTIES[difficulty]) return fail(400, 'bad difficulty');
  // Prefer the player's best run on that board; else their latest run.
  const where = ['r.player_id = ?1', "r.mode != 'ghost'"];
  const args = [player];
  if (mode) { args.push(mode); where.push(`r.mode = ?${args.length}`); }
  if (difficulty) { args.push(difficulty); where.push(`r.difficulty = ?${args.length}`); }
  const r = await env.DB.prepare(
    `SELECT ${GHOST_COLS} FROM runs r JOIN players p ON p.id = r.player_id WHERE ${where.join(' AND ')}
     ORDER BY r.score DESC, r.created_at DESC LIMIT 1`,
  ).bind(...args).first();
  if (!r) return fail(404, 'no runs for that player');
  return json(ghostPayload(r));
}

async function getTopGhost(request, env) {
  const params = new URL(request.url).searchParams;
  const md = modeAndDifficulty(params);
  if (md.error) return fail(400, md.error);
  const group = normGroup(params.get('group') || '');
  const r = await env.DB.prepare(
    `SELECT ${GHOST_COLS} FROM best b JOIN runs r ON r.id = b.run_id JOIN players p ON p.id = r.player_id
     WHERE b.mode = ?1 AND b.difficulty = ?2 AND b.group_code = ?3 ORDER BY b.score DESC, b.updated_at ASC LIMIT 1`,
  ).bind(md.mode === 'ghost' ? 'ranked' : md.mode, md.difficulty, group).first();
  if (!r) return fail(404, 'no runs on that board yet');
  return json(ghostPayload(r));
}

// Liveness + readiness for monitoring (uptime checks, Docker HEALTHCHECK, deploy.sh): the database answers
// and a snapshot is loaded. Never cached, never rate limited, no personal data.
async function getHealth(env, ctx) {
  const out = { ok: false, time: new Date(ctx.now).toISOString(), db: false, snapshot: null };
  try { out.db = !!(await env.DB.prepare('SELECT 1 AS one').first()); } catch { /* reported below */ }
  try { const snap = await currentSnapshot(env, ctx.now); if (snap) out.snapshot = snap.id; } catch { /* reported below */ }
  out.ok = out.db && !!out.snapshot;
  return json(out, out.ok ? 200 : 503);
}

// ---------------------------------------------------------------------------------------------
async function route(request, env, ctx) {
  const url = new URL(request.url);
  const p = url.pathname.replace(/\/+$/, '');
  const m = request.method;
  if (m === 'OPTIONS') return new Response(null, { status: 204, headers: HEADERS });
  if (m === 'GET' && (p === '' || p === '/v1')) return json({ name: 'fandom-clash', version: 1 });
  if ((m === 'GET' || m === 'HEAD') && p === '/v1/health') return getHealth(env, ctx);
  if (m === 'GET' && p === '/v1/snapshot') return getSnapshot(request, env, ctx);
  if (m === 'GET' && p === '/v1/match') return getMatch(request, env, ctx);
  if (m === 'POST' && p === '/v1/runs') return postRun(request, env, ctx);
  if (m === 'GET' && p === '/v1/leaderboard') return getLeaderboard(request, env, ctx);
  if (m === 'POST' && p === '/v1/groups') return postGroup(request, env, ctx);
  if (m === 'GET' && p.startsWith('/v1/groups/')) return getGroup(env, p.slice('/v1/groups/'.length));
  if (m === 'GET' && p === '/v1/ghosts/top') return getTopGhost(request, env, ctx);
  if (m === 'GET' && p === '/v1/ghosts') return getGhost(request, env, ctx);
  return fail(404, 'not found');
}

export async function handle(request, env, now = Date.now()) {
  const ctx = { now, ip: await ipHash(request, env) };
  try {
    // Snapshot reads are cheap (memoised KV) and /match has its own bucket; the rest share 'read'.
    const path = new URL(request.url).pathname;
    const readLimited = request.method === 'GET' && /^\/v1\/(leaderboard|groups|ghosts)/.test(path);
    const wait = readLimited ? await limited(env, ctx, 'read', now) : null;
    if (wait) return slowDown(wait);
    return await route(request, env, ctx);
  } catch (e) {
    console.error(e && e.stack ? e.stack : e);
    return fail(500, 'internal error');
  }
}

// Daily cleanup: expired unused matches, stale rate-limit rows and old idempotency records.
export async function cleanup(env, now = Date.now()) {
  await env.DB.prepare('DELETE FROM matches WHERE used_at IS NULL AND issued_at < ?1').bind(now - MATCH_TTL_MS).run();
  await env.DB.prepare('DELETE FROM matches WHERE used_at IS NOT NULL AND used_at < ?1').bind(now - 30 * 864e5).run();
  for (const [bucket, { windowSec }] of Object.entries(RATE)) {
    await env.DB.prepare('DELETE FROM rate WHERE key LIKE ?1 AND win < ?2').bind(`${bucket}:%`, windowOf(now, windowSec) - 1).run();
  }
  await env.DB.prepare('DELETE FROM idem WHERE created_at < ?1').bind(now - IDEM_TTL_MS).run();
}

export default {
  fetch: (request, env) => handle(request, env),
  scheduled: (event, env, ctx) => ctx.waitUntil(cleanup(env)),
};
