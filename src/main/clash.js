'use strict';
// Fandom Clash, main-process side: the network client for the Clash Worker (server/clash/), with timeouts
// and an offline fallback; the player's id and name, local runs, ghosts and groups, and the cached
// snapshot, all in <userData>/kayboro/clash/; matches and authoritative scoring/bet payouts for runs played
// here; and the kclash://img/<characterId> scheme that serves a character's SFW snapshot image to the
// renderer (the app's CSP blocks remote images). Only the exact image URL the snapshot lists for that
// character is ever fetched, only over https and only from a host the snapshot's images use.
//
// Offline (no server configured, or it does not answer): the bundled sample snapshot, local matchmaking,
// local scores and leaderboards (this PC's runs) and local ghosts (your own runs). Runs from server
// matches that could not be uploaded are queued and sent the next time the server answers.
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const { pathToFileURL } = require('url');

const SCHEME = { scheme: 'kclash', privileges: { standard: true, secure: true, supportFetchAPI: true, corsEnabled: true } };
// The Fandom Clash API on Linode (server/clash/node). KAYBORO_CLASH_URL or settings.json { serverUrl } override it.
const DEFAULT_SERVER = 'https://45-33-87-79.ip.linodeusercontent.com';
const LOGIC = path.join(__dirname, '..', 'renderer', 'clash', 'logic.js');
const BUNDLED = [
  process.env.KAYBORO_CLASH_SNAPSHOT, // testing
  path.join(__dirname, '..', 'catalog', 'clash-snapshot.json'), // shipped with the app (built from tools/clash)
  path.join(__dirname, '..', '..', 'tools', 'clash', 'sample-snapshot.json'), // running from source
].filter(Boolean);
const MATCHMAKING = [path.join(__dirname, 'clash-matchmaking.js'), path.join(__dirname, '..', '..', 'tools', 'clash', 'matchmaking.js')];
const VS_MODES = ['ranked', 'local', 'ghost'];
const DIFFS = ['easy', 'normal', 'hard', 'master'];
const IMG_TYPES = { 'image/jpeg': 'jpg', 'image/png': 'png', 'image/webp': 'webp', 'image/gif': 'gif' };
// Danbooru tags may contain '/', '?' and '#' (fate/grand_order, ranma_1/2, gochuumon_wa_usagi_desu_ka?): they are
// allowed (kclash://img/ ids are percent-encoded by the renderer and decoded here); control characters and '\' are not.
const ID = /^[^\u0000-\u001f\u007f\\]{1,160}$/;
const GROUP = /^[A-Z0-9-]{4,16}$/;
const LIMITS = { runs: 300, ghosts: 100, pending: 50, matches: 40, images: 400, imageBytes: 12 * 1024 * 1024, jsonBytes: 40 * 1024 * 1024 };
// Resilience: the circuit breaker's open time (doubling per consecutive failure), the one quick retry of a
// repeatable call, and the upload queue's exponential back-off with jitter. A queued run is only worth sending
// while the server still accepts its match (24 h after it was issued).
const BREAKER = { baseMs: 15000, maxMs: 5 * 60e3 };
const RETRY = { max: 1, baseMs: 400 };
const QUEUE = { baseMs: 30000, maxMs: 2 * 3600e3, maxAgeMs: 23 * 3600e3, maxAttempts: 16 };
const NOT_MODIFIED = Symbol('not modified');
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
/** Queue back-off after `attempts` failures: exponential, capped, "equal jitter" (half fixed, half random). */
const queueDelay = (attempts, rand = Math.random) => {
  const cap = Math.min(QUEUE.maxMs, QUEUE.baseMs * 2 ** Math.max(0, Math.min(20, attempts - 1)));
  return Math.round(cap / 2 + rand() * (cap / 2));
};

const str = (v, n = 120) => String(v ?? '').replace(/[\u0000-\u001f\u007f]/g, '').trim().slice(0, n);
const int = (v) => Math.max(0, Math.floor(Number(v)) || 0);
const okId = (v) => (typeof v === 'string' || typeof v === 'number') && ID.test(String(v));
const hex = (n = 8) => crypto.randomBytes(n).toString('hex');

function readJson(file, fallback) {
  try { return JSON.parse(fs.readFileSync(file, 'utf8')); } catch { return fallback; }
}
function writeJson(file, data) {
  try {
    fs.mkdirSync(path.dirname(file), { recursive: true });
    fs.writeFileSync(file + '.tmp', JSON.stringify(data));
    fs.renameSync(file + '.tmp', file);
  } catch (err) { console.error('[clash] write failed:', file, err.message); }
}

// ---- Snapshot ------------------------------------------------------------------

/** { site, postId, url, w, h } with an https URL, or null. The snapshot's image field is SFW by contract. */
function cleanImage(im) {
  if (!im || typeof im !== 'object' || typeof im.url !== 'string' || im.url.length > 2048) return null;
  let u;
  try { u = new URL(im.url); } catch { return null; }
  if (u.protocol !== 'https:' || u.username || u.password) return null;
  return { site: str(im.site, 40), postId: str(im.postId, 40), url: u.href, w: int(im.w), h: int(im.h) };
}

/** Validates and trims a snapshot ({ version: 1, generatedAt, sites, characters, franchises }); null if unusable. */
function sanitizeSnapshot(raw, source = 'bundled') {
  if (!raw || typeof raw !== 'object' || raw.version !== 1 || !Array.isArray(raw.characters)) return null;
  const sites = (Array.isArray(raw.sites) ? raw.sites : []).map((s) => str(typeof s === 'object' ? s?.id ?? s?.name : s, 40)).filter(Boolean).slice(0, 64);
  const characters = [], byId = new Map();
  for (const c of raw.characters) {
    if (!c || !okId(c.id) || byId.has(String(c.id))) continue;
    const counts = {};
    for (const [k, v] of Object.entries(c.counts && typeof c.counts === 'object' ? c.counts : {})) if (str(k, 40)) counts[str(k, 40)] = int(v);
    const total = c.total != null ? int(c.total) : Object.values(counts).reduce((a, b) => a + b, 0);
    const e = { id: String(c.id), name: str(c.name || c.id), franchise: c.franchise == null ? null : str(c.franchise), counts, total, image: cleanImage(c.image) };
    characters.push(e);
    byId.set(e.id, e);
  }
  if (characters.length < 2) return null;
  const franchises = [], fById = new Map();
  for (const f of Array.isArray(raw.franchises) ? raw.franchises : []) {
    if (!f || !okId(f.id) || fById.has(String(f.id))) continue;
    const members = (Array.isArray(f.characters) ? f.characters : []).map(String).filter((id) => byId.has(id));
    const e = { id: String(f.id), name: str(f.name || f.id), total: f.total != null ? int(f.total) : members.reduce((a, id) => a + byId.get(id).total, 0), characters: members };
    franchises.push(e);
    fById.set(e.id, e);
  }
  const hosts = new Set(characters.filter((c) => c.image).map((c) => new URL(c.image.url).hostname));
  return { version: 1, generatedAt: str(raw.generatedAt, 40), sites, characters, franchises, byId, fById, hosts, source };
}

const newer = (a, b) => !b || (Date.parse(a.generatedAt) || 0) > (Date.parse(b.generatedAt) || 0);

// ---- Client --------------------------------------------------------------------------

function create({ net, userDataDir, economy = () => null, serverUrl, timeoutMs = 6000, imageTimeoutMs = 20000, now = Date.now, bundled = BUNDLED, matchmaking } = {}) {
  const dir = path.join(userDataDir, 'kayboro', 'clash');
  const F = (n) => path.join(dir, n);
  const imgDir = F('img');
  let logicP = null;
  const logic = () => (logicP ||= import(pathToFileURL(LOGIC).href));
  let mm = matchmaking === undefined ? null : matchmaking, mmTried = matchmaking !== undefined;
  const mmod = () => {
    if (!mmTried) {
      mmTried = true;
      for (const p of MATCHMAKING) { try { mm = require(p); break; } catch (err) { if (err.code !== 'MODULE_NOT_FOUND') console.warn('[clash] matchmaking:', err.message); } }
    }
    return mm;
  };

  // Server address: the env var wins, then the player's own choice in settings.json ('' = play offline), then the
  // caller's serverUrl, then the built-in default (the Linode server).
  let settings = readJson(F('settings.json'), {}) || {};
  const base = () => {
    const u = process.env.KAYBORO_CLASH_URL || (typeof settings.serverUrl === 'string' ? settings.serverUrl : serverUrl ?? DEFAULT_SERVER);
    return u ? String(u).replace(/\/+$/, '') : '';
  };
  let online = null;

  // Circuit breaker: a failed call (network error, timeout, 5xx) opens it for BREAKER.baseMs, doubling with each
  // further failure up to BREAKER.maxMs (with jitter), so no screen waits on a server that is not there. When it
  // has cooled down, one call goes through as a probe (half-open); success closes it, failure re-opens it longer.
  let failures = 0, openUntil = 0, probing = false;
  const breakerOpen = () => now() < openUntil || (failures > 0 && probing);
  const tripBreaker = () => {
    failures++;
    online = false;
    openUntil = now() + Math.round(Math.min(BREAKER.maxMs, BREAKER.baseMs * 2 ** (failures - 1)) * (0.8 + Math.random() * 0.4));
  };
  const resetBreaker = () => { failures = 0; openUntil = 0; online = true; };
  const offlineErr = (cause, extra) => Object.assign(new Error('offline'), { offline: true, cause, ...extra });

  // One HTTP call with a timeout. Calls that are safe to repeat (GET, or a POST carrying an idempotency key)
  // are retried once after a short jittered pause when they fail fast (a reset connection, 502/503/504);
  // a timeout is not retried (it already took timeoutMs). 429 carries the server's Retry-After (seconds).
  // opts.etag: send If-None-Match and resolve to NOT_MODIFIED on 304.
  async function api(method, p, body, opts = {}) {
    const b = base();
    if (!b) throw offlineErr(null);
    if (breakerOpen()) throw offlineErr(null, { skipped: true });
    const retryable = method === 'GET' || !!(body && body.idempotencyKey);
    const halfOpen = failures > 0;
    if (halfOpen) probing = true;
    try {
      for (let attempt = 0; ; attempt++) {
        let r;
        try {
          const headers = { Accept: 'application/json' };
          if (body) headers['Content-Type'] = 'application/json';
          if (opts.etag) headers['If-None-Match'] = opts.etag;
          r = await net.fetch(b + p, { method, signal: AbortSignal.timeout(timeoutMs), cache: 'no-store', headers, body: body ? JSON.stringify(body) : undefined });
        } catch (err) {
          const timedOut = err && (err.name === 'TimeoutError' || err.name === 'AbortError');
          if (retryable && !timedOut && attempt < RETRY.max && !halfOpen) { await sleep(RETRY.baseMs * 2 ** attempt * (0.5 + Math.random())); continue; }
          tripBreaker();
          throw offlineErr(err, { timedOut });
        }
        if ([502, 503, 504].includes(r.status) && retryable && attempt < RETRY.max && !halfOpen) {
          await sleep(RETRY.baseMs * 2 ** attempt * (0.5 + Math.random()));
          continue;
        }
        if (r.status >= 500) { tripBreaker(); throw Object.assign(new Error(`Clash server answered ${r.status}.`), { status: r.status }); }
        resetBreaker();
        if (r.status === 304 && opts.etag) return NOT_MODIFIED;
        if (!r.ok) {
          const retryAfter = Math.max(0, Number(r.headers.get('retry-after')) || 0);
          throw Object.assign(new Error(`Clash server answered ${r.status}.`), { status: r.status, retryAfter });
        }
        const text = await r.text();
        if (text.length > LIMITS.jsonBytes) throw new Error('Clash server sent too much data.');
        if (!flushP && pending().length) setTimeout(flushPending, 0); // the server is back: send what is waiting
        if (opts.withHeaders) return { data: text ? JSON.parse(text) : null, headers: r.headers };
        return text ? JSON.parse(text) : null;
      }
    } finally { if (halfOpen) probing = false; }
  }
  const tryApi = (...a) => api(...a).catch((err) => { if (!err.offline && err.status !== 404) console.warn('[clash]', a[1], err.message); return null; });

  // ---- Player ----
  let player = readJson(F('player.json'), null);
  if (!player || typeof player.id !== 'string' || !/^[\w-]{8,64}$/.test(player.id)) {
    const id = crypto.randomUUID();
    player = { id, name: `Player ${id.slice(0, 4).toUpperCase()}` };
    writeJson(F('player.json'), player);
  }
  const me = () => ({ id: player.id, name: player.name });
  function setName(name) {
    const n = str(name, 40).replace(/\s+/g, ' ').slice(0, 20);
    if (n.length < 2) return { error: 'Names need 2 to 20 characters.' };
    player.name = n;
    writeJson(F('player.json'), player);
    return me();
  }
  function setServer(url) {
    const u = str(url, 300);
    if (u && !/^https:\/\/[^/\s]+/i.test(u) && !/^http:\/\/(localhost|127\.0\.0\.1)(:\d+)?(\/|$)/i.test(u)) return { error: 'The server address must start with https://.' };
    settings = { ...settings, serverUrl: u }; // '' = offline by choice
    writeJson(F('settings.json'), settings);
    online = null; failures = 0; openUntil = 0;
    return status();
  }

  // ---- Snapshot ----
  let snap = null, refreshedAt = 0, refreshing = null;
  function loadSnapshot() {
    if (snap) return snap;
    const cached = sanitizeSnapshot(readJson(F('snapshot.json'), null), 'cache');
    for (const file of bundled) {
      const s = sanitizeSnapshot(readJson(file, null), 'bundled');
      if (s && newer(s, snap)) snap = s;
    }
    if (cached && newer(cached, snap)) snap = cached;
    return snap;
  }
  async function refreshSnapshot(force = false) {
    if (!base() || (!force && now() - refreshedAt < 6 * 3600e3)) return loadSnapshot();
    if (refreshing) return refreshing;
    refreshing = (async () => {
      refreshedAt = now();
      // Conditional GET: the server's ETag is the snapshot id, so an unchanged snapshot costs a 304, not ~200 KB.
      const meta = readJson(F('snapshot-meta.json'), null);
      const etag = meta && typeof meta.etag === 'string' && meta.generatedAt === loadSnapshot()?.generatedAt ? meta.etag : null;
      const got = await api('GET', '/v1/snapshot', null, { etag, withHeaders: true }).catch((err) => {
        if (!err.offline && err.status !== 404) console.warn('[clash] /v1/snapshot', err.message);
        return null;
      });
      if (got && got !== NOT_MODIFIED) {
        const s = sanitizeSnapshot(got.data, 'server');
        if (s && newer(s, loadSnapshot())) { snap = s; writeJson(F('snapshot.json'), got.data); }
        const tag = got.headers.get('etag');
        if (s && tag && loadSnapshot()?.generatedAt === s.generatedAt) writeJson(F('snapshot-meta.json'), { etag: tag.slice(0, 120), generatedAt: s.generatedAt });
      }
      return loadSnapshot();
    })().finally(() => { refreshing = null; });
    return refreshing;
  }
  const needSnap = () => {
    const s = loadSnapshot();
    if (!s) throw new Error('No Fandom Clash data yet. Connect to the internet once, or reinstall Kayboro.');
    return s;
  };

  // An entity as the renderer sees it: a character (type 'c') or franchise ('f'). `img` is the character
  // id whose SFW image kclash://img/<img> serves, or null (the pixel placeholder shows instead).
  function ref(e, s = needSnap()) {
    if (!e) return null;
    if (e.characters) {
      const face = e.characters.map((id) => s.byId.get(id)).filter((c) => c && c.image).sort((a, b) => b.total - a.total)[0];
      return { type: 'f', id: e.id, name: e.name, total: e.total, members: e.characters.length, img: face ? face.id : null };
    }
    const fr = e.franchise != null ? s.fById.get(e.franchise) : null;
    return { type: 'c', id: e.id, name: e.name, franchise: fr ? fr.name : e.franchise, franchiseId: fr ? fr.id : null, total: e.total, img: e.image ? e.id : null };
  }
  const entKey = (e) => ({ type: e.characters ? 'franchise' : 'character', id: e.id });
  // Resolves an entity from anything a server or matchmaking hands back: an object, an id, or { type, id }.
  function resolve(x, s = needSnap(), prefer) {
    if (x == null) return null;
    if (typeof x === 'object' && !x.type && Array.isArray(x.characters)) return s.fById.get(String(x.id)) || null;
    const t = typeof x === 'object' ? x.type || x.kind : prefer;
    const id = String(typeof x === 'object' ? x.id : x);
    if (t === 'f' || t === 'franchise') return s.fById.get(id) || null;
    if (t === 'c' || t === 'character') return s.byId.get(id) || null;
    return s.byId.get(id) || s.fById.get(id) || null;
  }
  // An entity the local snapshot does not know (the server's is newer): a stand-in so the match stays aligned.
  const stub = (x) => {
    const id = str(typeof x === 'object' ? x?.id : x, 160) || '?';
    const name = id.replace(/_\([^)]*\)$/, '').replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase()).slice(0, 120);
    return x?.type === 'franchise' ? { id, name, total: 0, characters: [] } : { id, name, franchise: null, counts: {}, total: 0, image: null };
  };
  // A round side: one entity, or a group of them (matchmaking's one-vs-many rounds). `total` may be given
  // (server rounds carry the server snapshot's totals, which is what the server scores against).
  function toSide(x, s, total) {
    if (x && x.type === 'group' && Array.isArray(x.members)) {
      const members = x.members.map((m) => resolve(m, s) || stub(m));
      if (!members.length) return null;
      if (members.length === 1) return toSide(x.members[0], s, total);
      return { group: members, total: Number.isFinite(total) ? total : members.reduce((a, e) => a + e.total, 0) };
    }
    const e = resolve(x, s) || (x && (typeof x === 'string' || x.id != null) ? stub(x) : null);
    return e ? { e, total: Number.isFinite(total) ? total : e.total } : null;
  }
  const sideKey = (sd) => (sd.group ? { type: 'group', members: sd.group.map(entKey) } : entKey(sd.e));
  // Renderer view of a side; a group is type 'g' with its members and the face of its biggest member.
  function sideRef(sd, s) {
    if (!sd.group) return { ...ref(sd.e, s), total: sd.total };
    const members = sd.group.map((e) => ref(e, s));
    const face = [...members].filter((m) => m.img).sort((a, b) => b.total - a.total)[0];
    return { type: 'g', id: members.map((m) => `${m.type}:${m.id}`).join('+').slice(0, 300), name: members.map((m) => m.name).join(' + ').slice(0, 160),
      members, total: sd.total, img: face ? face.img : null };
  }
  const fromRounds = (list, s) => list.map((x) => {
    const a = toSide(x?.a ?? x?.left, s, Number(x?.totals?.a)), b = toSide(x?.b ?? x?.right, s, Number(x?.totals?.b));
    return a && b ? { kind: str(x.kind, 24) || 'pair', a, b } : null;
  });
  function snapshotForRenderer() {
    const s = needSnap();
    refreshSnapshot().catch(() => {});
    return { version: 1, generatedAt: s.generatedAt, source: s.source, sites: s.sites,
      characters: s.characters.map((c) => ref(c, s)), franchises: s.franchises.map((f) => ref(f, s)) };
  }

  // ---- Local data ----
  const runs = () => { const r = readJson(F('runs.json'), []); return Array.isArray(r) ? r : []; };
  const saveRuns = (list) => writeJson(F('runs.json'), list.slice(-LIMITS.runs));
  const groupsList = () => { const g = readJson(F('groups.json'), []); return Array.isArray(g) ? g : []; };
  const saveGroups = (g) => writeJson(F('groups.json'), g.slice(0, 20));
  const ghostCache = new Map(); // id -> server ghost seen this session

  // ---- Upload queue (pending.json) ----
  // Runs from server matches that could not be sent: { id, body, at, attempts, nextAt }. The file is the queue's
  // only state (atomic writes), so it survives a crash or a quit; every change is a fresh read-modify-write by
  // item id, so a run queued while a flush is in flight is never lost. Each run carries an idempotency key
  // (body.idempotencyKey = id): if the server stored it but the answer was lost, the retry gets the original
  // result back. Back-off: exponential with jitter (queueDelay), at least the server's Retry-After.
  const pending = () => {
    const p = readJson(F('pending.json'), []);
    let migrated = false;
    const list = (Array.isArray(p) ? p : []).map((x) => {
      if (x && x.body && typeof x.body === 'object' && typeof x.id === 'string') return x;
      if (x && typeof x === 'object' && x.player && x.seed != null) { // the pre-queue format: a bare request body
        migrated = true;
        const id = x.idempotencyKey || 'q-' + crypto.createHash('sha1').update(JSON.stringify(x)).digest('hex').slice(0, 24);
        return { id, body: { ...x, idempotencyKey: id }, at: now(), attempts: 0, nextAt: 0 };
      }
      migrated = true; // junk
      return null;
    }).filter(Boolean);
    if (migrated) writeJson(F('pending.json'), list);
    return list;
  };
  const editQueue = (fn) => writeJson(F('pending.json'), fn(pending()).slice(-LIMITS.pending));
  let flushP = null, flushTimer = null;
  function scheduleFlush() {
    clearTimeout(flushTimer);
    const list = pending();
    if (!list.length || !base()) return;
    const due = Math.max(openUntil, Math.min(...list.map((x) => x.nextAt || 0)));
    flushTimer = setTimeout(() => { flushPending().catch(() => {}); }, Math.min(2 ** 31 - 1, Math.max(1000, due - now())));
    flushTimer.unref?.();
  }
  function enqueue(body) {
    editQueue((q) => [...q.filter((x) => x.id !== body.idempotencyKey), { id: body.idempotencyKey, body, at: now(), attempts: 1, nextAt: now() + queueDelay(1) }]);
    scheduleFlush();
  }
  function flushPending() {
    if (flushP) return flushP;
    if (!base()) return Promise.resolve();
    flushP = (async () => {
      for (const item of pending()) {
        if (now() - (item.at || 0) > QUEUE.maxAgeMs || item.attempts >= QUEUE.maxAttempts) { // the server would refuse it now
          editQueue((q) => q.filter((x) => x.id !== item.id));
          continue;
        }
        if ((item.nextAt || 0) > now()) continue;
        let outcome;
        try {
          await api('POST', '/v1/runs', { ...item.body, idempotencyKey: item.body.idempotencyKey || item.id });
          outcome = 'sent';
        } catch (err) {
          if (err.skipped) break; // the breaker is open: nothing was tried, wait for it
          const transient = err.offline || err.status >= 500 || err.status === 408 || err.status === 429;
          outcome = transient ? { retryAfter: err.retryAfter || 0 } : 'drop'; // other 4xx: the server will never take it
          if (outcome === 'drop') console.warn('[clash] dropping a queued run:', err.message);
        }
        editQueue((q) => (outcome === 'sent' || outcome === 'drop' ? q.filter((x) => x.id !== item.id)
          : q.map((x) => (x.id !== item.id ? x : { ...x, attempts: (x.attempts || 0) + 1, nextAt: now() + Math.max(queueDelay((x.attempts || 0) + 1), outcome.retryAfter * 1000) }))));
        if (outcome !== 'sent' && outcome !== 'drop') break; // the server is struggling: don't hammer it with the rest
      }
    })().finally(() => { flushP = null; scheduleFlush(); });
    return flushP;
  }
  scheduleFlush();

  const matches = new Map();
  const remember = (m) => {
    m.id = 'm-' + hex(6);
    matches.set(m.id, m);
    while (matches.size > LIMITS.matches) matches.delete(matches.keys().next().value);
    return m;
  };
  const roundOut = (r, s) => ({ kind: r.kind, a: sideRef(r.a, s), b: sideRef(r.b, s) });
  // Seeds are uint32, as matchmaking.buildMatch and the server want; anything else is hashed into one.
  const toSeed = (v, L) => {
    const n = Number(v);
    if (v !== '' && v != null && Number.isInteger(n) && n >= 0 && n <= 0xffffffff) return n;
    return v == null || v === '' ? crypto.randomInt(0, 0x100000000) : L.hash32(String(v));
  };

  // Rounds from the real matchmaking (tools/clash/matchmaking.js buildMatch) when it is there, else the fallback.
  async function localRounds(s, { mode, difficulty, seed, n }) {
    const L = await logic();
    const m = mmod();
    if (m && typeof m.buildMatch === 'function') {
      try {
        const got = m.buildMatch({ snapshot: s, mode, difficulty, seed, rounds: n });
        const out = fromRounds(got.rounds || [], s);
        if (out.length === n && out.every(Boolean)) return out;
      } catch (err) { console.warn('[clash] matchmaking failed, using the fallback:', err.message); }
    }
    return L.fallbackRounds(s, { difficulty, seed, n }).map((r) => ({ kind: r.kind, a: { e: r.a, total: r.a.total }, b: { e: r.b, total: r.b.total } }));
  }

  /** A Vs match: { matchId, seed, mode, difficulty, source, rounds, ghost }. */
  async function match({ mode = 'ranked', difficulty = 'normal', group, ghost } = {}) {
    const L = await logic();
    if (!VS_MODES.includes(mode)) throw new Error('Unknown mode.');
    if (!DIFFS.includes(difficulty)) throw new Error('Unknown difficulty.');
    const s = needSnap();
    let g = null;
    if (ghost) {
      g = ghostCache.get(String(ghost)) || runs().find((x) => x.id === String(ghost)) || null;
      if (!g) throw new Error('That ghost is gone. Pick another one.');
      difficulty = DIFFS.includes(g.difficulty) ? g.difficulty : difficulty;
    }
    let seed = null, rounds = null, source = 'local';
    if (g) {
      seed = toSeed(g.seed, L);
      if (Array.isArray(g.rounds) && g.rounds.length) { // the recorded rounds replay exactly
        const got = fromRounds(g.rounds, s);
        if (got.every(Boolean)) rounds = got;
      }
      source = g.source === 'server' ? 'server' : 'local';
    } else {
      // A registered server match (its seed is the only one the server accepts a run for).
      const q = new URLSearchParams({ mode, difficulty });
      const r = await tryApi('GET', `/v1/match?${q}`);
      if (r && Array.isArray(r.rounds) && r.registered !== false && Number.isInteger(r.seed)) {
        const got = fromRounds(r.rounds, s);
        if (got.length >= 3 && got.every(Boolean)) { rounds = got; seed = r.seed; source = 'server'; }
      }
    }
    if (seed == null) seed = toSeed(null, L);
    const gmode = g ? (g.mode === 'local' ? 'local' : 'ranked') : mode;
    if (!rounds) rounds = await localRounds(s, { mode: gmode, difficulty, seed, n: L.ROUNDS });
    if (rounds.length < 3) throw new Error('Not enough data for this difficulty yet.');
    let ghostOut = null;
    if (g) {
      const answers = L.cleanAnswers(g.answers, rounds.length);
      ghostOut = { id: g.id, runId: g.runId ?? null, source: g.source === 'server' ? 'server' : 'local',
        player: { id: str(g.player?.id, 64), name: str(g.player?.name, 24) || 'Ghost' }, answers, score: L.scoreRun(rounds, answers, difficulty).score };
    }
    const m = remember({ kind: 'vs', mode, difficulty, seed, group: mode === 'local' ? normGroup(group) : null, rounds, source, ghost: ghostOut });
    return { matchId: m.id, seed, mode, difficulty, group: m.group, source, rounds: rounds.map((r) => roundOut(r, s)),
      ghost: ghostOut && { id: ghostOut.id, player: ghostOut.player, answers: ghostOut.answers, score: ghostOut.score } };
  }

  const settle = (ticket, outcome, multiplier) => {
    if (!ticket) return null;
    const e = economy();
    if (!e) return null;
    const r = e.settleBet(String(ticket), outcome, multiplier);
    return r && r.ok ? { outcome: r.outcome, stake: r.stake, payout: r.payout, state: r.state } : null;
  };

  // Bets are a small saga: placeBet escrows the stake (renderer) -> the round is played -> exactly one of
  // settle(win/loss/push) or settle(cancel) here. Any failure on the way refunds (cancel); a crash refunds on the
  // next start (Economy.load). Settling an already-settled ticket is a no-op, so the compensations are safe.
  const withRefund = (fn) => async (o = {}) => {
    try { return await fn(o); } catch (err) { settle(o && o.ticket, 'cancel'); throw err; }
  };

  /** Scores a finished Vs run here (from the match's own rounds), saves it, settles a ghost bet, then uploads it. */
  const submitRun = withRefund(async ({ matchId, answers, ticket } = {}) => {
    const L = await logic();
    const m = matches.get(String(matchId));
    if (!m || m.kind !== 'vs') { settle(ticket, 'cancel'); throw new Error('That match has expired.'); }
    matches.delete(m.id);
    const clean = L.cleanAnswers(answers, m.rounds.length);
    const res = L.scoreRun(m.rounds, clean, m.difficulty);
    const rec = {
      id: 'run-' + hex(6), player: me(), mode: m.ghost ? 'ghost' : m.mode, difficulty: m.difficulty, group: m.group, seed: m.seed, answers: clean,
      score: res.score, correct: res.correct, total: res.total, bestCombo: res.bestCombo, at: new Date(now()).toISOString(), source: m.source,
      rounds: m.rounds.map((r) => ({ kind: r.kind, a: sideKey(r.a), b: sideKey(r.b), totals: { a: r.a.total, b: r.b.total } })), snapshot: loadSnapshot()?.generatedAt || null,
      vs: m.ghost ? { id: m.ghost.id, name: m.ghost.player.name, score: m.ghost.score } : undefined,
    };
    const all = runs();
    all.push(rec);
    saveRuns(all);
    const same = all.filter((x) => x.mode === rec.mode && x.difficulty === m.difficulty && (m.mode !== 'local' || x.group === m.group));
    const localRank = 1 + same.filter((x) => x.score > rec.score).length;
    const localBest = Math.max(...same.map((x) => x.score));
    let body = null;
    if (m.source === 'server' && !m.ghost && (m.mode === 'ranked' || (m.mode === 'local' && m.group && !m.group.startsWith('L-')))) {
      body = { player: me(), mode: m.mode, difficulty: m.difficulty, group: m.mode === 'local' ? m.group : undefined, seed: m.seed, answers: clean, snapshot: rec.snapshot || undefined };
    } else if (m.ghost && m.ghost.source === 'server' && Number.isInteger(m.ghost.runId) && m.ghost.player.id !== player.id) {
      body = { player: me(), mode: 'ghost', difficulty: m.difficulty, seed: m.seed, ghostOf: m.ghost.runId, answers: clean };
    }
    // The bet depends only on the local score, so it settles before the (slow, fallible) upload.
    let ghost = null, bet = null;
    if (m.ghost) {
      ghost = { ...L.ghostOutcome(res.score, m.ghost.score), score: m.ghost.score, name: m.ghost.player.name };
      bet = settle(ticket, ghost.outcome, ghost.multiplier);
    } else if (ticket) bet = settle(ticket, 'cancel');
    if (body) body.idempotencyKey = 'run-' + hex(12);
    const server = body ? await api('POST', '/v1/runs', body).catch((err) => {
      // Not delivered (offline, timeout, server trouble, rate limited): queue it. A timeout may have reached the
      // server: the idempotency key makes the retry return that result instead of a 409.
      if (err.offline || err.status >= 500 || err.status === 408 || err.status === 429) enqueue(body);
      else console.warn('[clash] run upload refused:', err.message);
      return null;
    }) : null;
    const num = (v) => (v != null && Number.isFinite(Number(v)) ? Number(v) : null);
    return { runId: rec.id, ...res, rank: num(server?.rank), serverScore: num(server?.score), personalBest: server ? server.personalBest === true : null,
      localRank, localBest, ghost, bet, online: online === true, queued: !!body && !server };
  });

  /** Drops a match (the player left mid-run) and refunds its bet. */
  function cancel({ matchId, ticket } = {}) {
    matches.delete(String(matchId));
    return settle(ticket, 'cancel');
  }

  // ---- Percentage Vs ----
  async function percentage({ kind = 'groups', difficulty = 'normal', seed } = {}) {
    const L = await logic();
    if (!DIFFS.includes(difficulty)) throw new Error('Unknown difficulty.');
    kind = kind === 'franchises' ? 'franchises' : 'groups';
    const s = needSnap();
    const sd = toSeed(seed, L);
    let got = null;
    const m = mmod();
    if (kind === 'groups' && m && typeof m.pickPercentage === 'function') {
      try {
        const r = m.pickPercentage({ snapshot: s, difficulty, rng: L.rng(sd) });
        const members = (side) => (side?.type === 'group' ? side.members : [side]).map((x) => resolve(x, s)).filter(Boolean);
        const a = members(r?.a), b = members(r?.b);
        if (a.length && b.length) got = { a, b };
      } catch (err) { console.warn('[clash] pickPercentage failed, using the fallback:', err.message); }
    }
    got ||= L.fallbackPercentage(s, { difficulty, seed: sd, kind });
    if (!got) throw new Error('Not enough data for this match-up yet.');
    const mt = remember({ kind: 'percent', difficulty, seed: sd, a: got.a, b: got.b });
    return { matchId: mt.id, kind, difficulty, a: got.a.map((e) => ref(e, s)), b: got.b.map((e) => ref(e, s)) };
  }
  const resolvePercent = withRefund(async ({ matchId, guess, ticket } = {}) => {
    const L = await logic();
    const m = matches.get(String(matchId));
    if (!m || m.kind !== 'percent') { settle(ticket, 'cancel'); throw new Error('That match-up has expired.'); }
    matches.delete(m.id);
    const aTotal = L.groupTotal(m.a), bTotal = L.groupTotal(m.b);
    const out = L.percentOutcome({ aTotal, bTotal, guess: Number(guess) });
    return { ...out, aTotal, bTotal, guess: Number(guess), bet: settle(ticket, out.outcome, out.multiplier) };
  });

  // ---- Pick-your-own 1-vs-many ----
  async function opponents({ champion, difficulty = 'normal', seed } = {}) {
    const L = await logic();
    const s = needSnap();
    const c = resolve(champion, s, 'c');
    if (!c || c.characters) throw new Error('Pick a character to champion.');
    if (!DIFFS.includes(difficulty)) throw new Error('Unknown difficulty.');
    const pool = L.fallbackOpponents(s, c, { difficulty, seed: toSeed(seed, L), count: 12 });
    const mt = remember({ kind: 'pick', difficulty, champion: c, pool });
    return { matchId: mt.id, champion: ref(c, s), pool: pool.map((e) => ref(e, s)), maxOpponents: L.BET.maxOpponents };
  }
  const resolvePick = withRefund(async ({ matchId, opponents: ids, ticket } = {}) => {
    const L = await logic();
    const m = matches.get(String(matchId));
    if (!m || m.kind !== 'pick') { settle(ticket, 'cancel'); throw new Error('That match-up has expired.'); }
    const chosen = [...new Set((Array.isArray(ids) ? ids : []).map(String))].map((id) => m.pool.find((e) => e.id === id)).filter(Boolean);
    if (!chosen.length || chosen.length > L.BET.maxOpponents) throw new Error(`Choose 1 to ${L.BET.maxOpponents} opponents.`);
    matches.delete(m.id);
    const out = L.pickOutcome({ champion: m.champion, opponents: chosen });
    return { ...out, championTotal: m.champion.total, opponentsTotal: L.groupTotal(chosen), opponents: chosen.map((e) => ({ id: e.id, total: e.total })), bet: settle(ticket, out.outcome, out.multiplier) };
  });

  // ---- Leaderboards ----
  const normEntry = (e, i) => e && typeof e === 'object' ? {
    rank: int(e.rank) || i + 1, score: int(e.score),
    player: { id: str(e.player?.id ?? e.playerId ?? e.id, 64), name: str(e.player?.name ?? e.name, 24) || 'Player' },
    avatar: okId(e.avatar) ? String(e.avatar) : null, at: str(e.at, 40) || null, runId: Number.isInteger(e.runId) ? e.runId : null,
  } : null;
  async function leaderboard({ mode = 'ranked', difficulty = 'normal', group, limit = 50 } = {}) {
    const g = mode === 'local' ? normGroup(group) : null;
    if (mode === 'local' && !g) return { source: 'local', entries: [], you: player.id, needGroup: true };
    const lim = Math.min(100, Math.max(1, int(limit) || 50));
    const q = new URLSearchParams({ mode, difficulty, limit: String(lim) });
    if (g) q.set('group', g);
    const r = await tryApi('GET', `/v1/leaderboard?${q}`);
    const list = Array.isArray(r?.entries) ? r.entries : Array.isArray(r) ? r : null;
    if (list) return { source: 'server', entries: list.slice(0, lim).map(normEntry).filter(Boolean), you: player.id, total: int(r?.total) || null };
    const mine = runs().filter((x) => x.mode === mode && x.difficulty === difficulty && (!g || x.group === g)).sort((a, b) => b.score - a.score || a.at.localeCompare(b.at));
    return { source: 'local', you: player.id, entries: mine.slice(0, lim).map((x, i) => ({ rank: i + 1, score: x.score, player: x.player || me(), avatar: null, at: x.at, runId: x.id })) };
  }

  // ---- Groups ----
  function normGroup(code) {
    const c = str(code, 20).toUpperCase().replace(/\s+/g, '');
    return GROUP.test(c) ? c : null;
  }
  async function createGroup({ name } = {}) {
    const n = str(name, 40) || `${player.name}'s group`;
    // The idempotency key lets api() retry a dropped request without making a second group.
    const r = await tryApi('POST', '/v1/groups', { name: n, player: me(), idempotencyKey: 'grp-' + hex(12) });
    const code = normGroup(r?.code);
    const entry = code ? { code, name: str(r?.name, 40) || n, joinedAt: new Date(now()).toISOString(), offline: false }
      : { code: 'L-' + hex(3).toUpperCase(), name: n, joinedAt: new Date(now()).toISOString(), offline: true }; // this PC only
    saveGroups([entry, ...groupsList().filter((x) => x.code !== entry.code)]);
    return entry;
  }
  async function joinGroup(code) {
    const c = normGroup(code);
    if (!c) return { error: 'Group codes are 4 to 16 letters, digits or dashes.' };
    let info = null;
    try { info = await api('GET', `/v1/groups/${encodeURIComponent(c)}`); } catch (err) {
      if (err.status === 404) return { error: 'No group with that code. Check it with whoever made it.' };
      if (!err.offline) return { error: err.message };
    }
    const entry = { code: c, name: str(info?.name, 40) || c, joinedAt: new Date(now()).toISOString(), offline: !info, members: info ? int(info.players ?? info.members ?? info.memberCount) || null : null };
    saveGroups([entry, ...groupsList().filter((x) => x.code !== c)]);
    return entry;
  }
  function leaveGroup(code) {
    const c = normGroup(code);
    saveGroups(groupsList().filter((x) => x.code !== c));
    return groupsList();
  }

  // ---- Ghosts ----
  // The server hands out one ghost per request: GET /v1/ghosts?player= (that player's best run on a board)
  // and GET /v1/ghosts/top (the board's best). Top rankers come from the leaderboard and are fetched by
  // player on demand. Locally, every finished run of yours is a ghost.
  const normGhost = (g) => {
    if (!g || typeof g !== 'object' || g.seed == null || !Array.isArray(g.answers)) return null;
    const p = { id: str(g.player?.id ?? g.playerId, 64), name: str(g.player?.name ?? g.name, 24) || 'Ghost' };
    const runId = Number.isInteger(g.runId) ? g.runId : Number.isInteger(g.id) ? g.id : null;
    const out = { id: runId != null ? `srv-${runId}` : str(g.id, 80) || `${p.id}:${g.seed}`, runId, player: p, mode: g.mode === 'local' ? 'local' : 'ranked',
      difficulty: DIFFS.includes(g.difficulty) ? g.difficulty : 'normal', seed: g.seed, answers: g.answers.slice(0, 50),
      score: g.score != null ? int(g.score) : null, at: str(g.at, 40) || null, source: 'server', rounds: Array.isArray(g.rounds) ? g.rounds.slice(0, 50) : null };
    ghostCache.set(out.id, out);
    return out;
  };
  const ghostList = (r) => (Array.isArray(r) ? r : Array.isArray(r?.ghosts) ? r.ghosts : r && typeof r === 'object' ? [r] : []).map(normGhost).filter(Boolean);
  const brief = (g, local) => ({ id: g.id, player: g.player, mode: g.mode, difficulty: g.difficulty, score: g.score, at: g.at, local: !!local,
    ms: (g.answers || []).reduce((a, x) => a + (Number(x?.ms) || 0), 0), rounds: (g.answers || []).length });
  const localGhosts = (mode, difficulty) => runs().filter((x) => x.mode !== 'ghost' && (!mode || x.mode === mode) && (!difficulty || x.difficulty === difficulty))
    .sort((a, b) => b.score - a.score).slice(0, 20).map((x) => brief(x, true));
  async function ghosts({ player: pid, mode = 'ranked', difficulty } = {}) {
    const id = str(pid, 64);
    if (!id) return { source: 'local', ghosts: [] };
    if (id === player.id) return { source: 'local', ghosts: localGhosts(mode, difficulty) };
    const q = new URLSearchParams({ player: id });
    if (mode) q.set('mode', mode);
    if (difficulty) q.set('difficulty', difficulty);
    let r = null, missing = false;
    try { r = await api('GET', `/v1/ghosts?${q}`); } catch (err) { missing = err.status === 404 || err.status === 400; }
    if (!r) return { source: missing ? 'server' : 'local', ghosts: [], offline: !missing };
    return { source: 'server', ghosts: ghostList(r).slice(0, 30).map((g) => brief(g)) };
  }
  async function topGhosts({ mode = 'ranked', difficulty = 'normal' } = {}) {
    const [top, lb] = await Promise.all([tryApi('GET', `/v1/ghosts/top?${new URLSearchParams({ mode, difficulty })}`), tryApi('GET', `/v1/leaderboard?${new URLSearchParams({ mode, difficulty, limit: '10' })}`)]);
    const have = ghostList(top).map((g) => brief(g));
    const rankers = (Array.isArray(lb?.entries) ? lb.entries : []).map(normEntry).filter((e) => e && e.player.id && e.player.id !== player.id && !have.some((g) => g.player.id === e.player.id))
      .map((e) => ({ id: null, lazy: true, player: e.player, mode, difficulty, score: e.score, rank: e.rank }));
    const list = [...have, ...rankers].slice(0, 10);
    return { source: top || lb ? 'server' : 'local', ghosts: list, mine: localGhosts(mode, difficulty) };
  }

  function status() {
    const s = loadSnapshot();
    return { server: base() || null, online, player: me(), pending: pending().length, groups: groupsList(),
      snapshot: s ? { generatedAt: s.generatedAt, source: s.source, characters: s.characters.length, franchises: s.franchises.length, sites: s.sites } : null };
  }
  async function check() { // one cheap call to learn whether the server is there
    if (base()) await refreshSnapshot(true).catch(() => {});
    return status();
  }

  // ---- Images ----
  const inflight = new Map();
  async function image(id) {
    const s = loadSnapshot();
    const c = s && s.byId.get(String(id));
    const im = c && c.image;
    if (!im) return null;
    const u = new URL(im.url);
    if (u.protocol !== 'https:' || !s.hosts.has(u.hostname)) return null;
    const stem = path.join(imgDir, crypto.createHash('sha1').update(im.url).digest('hex'));
    for (const [type, ext] of Object.entries(IMG_TYPES)) {
      if (fs.existsSync(`${stem}.${ext}`)) return { type, file: `${stem}.${ext}` };
    }
    if (inflight.has(stem)) return inflight.get(stem);
    const p = (async () => {
      const r = await net.fetch(im.url, { signal: AbortSignal.timeout(imageTimeoutMs), headers: { Accept: 'image/webp,image/png,image/jpeg,image/gif' } });
      if (!r.ok) return null;
      const type = String(r.headers.get('content-type') || '').split(';')[0].trim().toLowerCase();
      if (!IMG_TYPES[type]) return null;
      const buf = Buffer.from(await r.arrayBuffer());
      if (!buf.length || buf.length > LIMITS.imageBytes) return null;
      fs.mkdirSync(imgDir, { recursive: true });
      const file = `${stem}.${IMG_TYPES[type]}`;
      fs.writeFileSync(file + '.part', buf);
      fs.renameSync(file + '.part', file);
      pruneImages();
      return { type, file };
    })().catch(() => null).finally(() => inflight.delete(stem));
    inflight.set(stem, p);
    return p;
  }
  function pruneImages() {
    try {
      const list = fs.readdirSync(imgDir).filter((f) => !f.endsWith('.part')).map((f) => ({ f, t: fs.statSync(path.join(imgDir, f)).mtimeMs }));
      if (list.length <= LIMITS.images) return;
      list.sort((a, b) => a.t - b.t).slice(0, list.length - LIMITS.images).forEach(({ f }) => fs.rmSync(path.join(imgDir, f), { force: true }));
    } catch {}
  }
  async function imageResponse(reqUrl) {
    let u;
    try { u = new URL(reqUrl); } catch { return new Response(null, { status: 400 }); }
    const id = u.host === 'img' ? decodeURIComponent(u.pathname.slice(1)) : '';
    const got = okId(id) ? await image(id) : null;
    if (!got) return new Response(null, { status: 404 });
    return new Response(fs.readFileSync(got.file), { status: 200, headers: { 'Content-Type': got.type, 'Access-Control-Allow-Origin': '*', 'Cache-Control': 'max-age=604800' } });
  }

  return {
    dir, status, check, setName, setServer, snapshotForRenderer, refreshSnapshot, match, submitRun, cancel, percentage, resolvePercent,
    opponents, resolvePick, leaderboard, createGroup, joinGroup, leaveGroup, groups: groupsList, ghosts, topGhosts, image, imageResponse,
    flushPending, _matches: matches,
  };
}

/** kclash://img/<characterId> -> that character's SFW snapshot image (see create().imageResponse). */
function registerProtocol(protocol, getClient) {
  protocol.handle('kclash', (req) => getClient().imageResponse(req.url).catch(() => new Response(null, { status: 502 })));
}

module.exports = { create, registerProtocol, sanitizeSnapshot, cleanImage, queueDelay, SCHEME, DEFAULT_SERVER, BREAKER, QUEUE, RETRY };
