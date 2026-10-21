// Fandom Clash API on a plain Node server (Linode), the same handler as the Cloudflare Worker (../src/index.mjs).
//   DB        node:sqlite file (schema.sql applied on start), wrapped to look like D1
//   CLASH_KV  snapshots as files in DATA_DIR/kv/ ("snapshot:current" -> id, "snapshot:<id>" -> JSON)
//   IP_SALT   from the environment (or DATA_DIR/ip-salt, made once)
// Listens on 127.0.0.1:PORT (default 8787) behind Caddy, which terminates HTTPS and sets X-Real-IP / X-Forwarded-For.
//   node --experimental-sqlite server/clash/node/server.mjs
//
// Hardening: request bodies over MAX_BODY are refused (413) before they are read in full; slow clients are cut
// off (headers in 10 s, the whole request in 15 s); keep-alive outlives Caddy's upstream keep-alive so Caddy never
// reuses a socket Node is closing. SIGTERM / SIGINT (systemd stop, docker stop) or an IPC 'shutdown' message
// drain: no new connections, in-flight requests finish (up to 10 s), then SQLite is checkpointed and closed.
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { DatabaseSync } from 'node:sqlite';
import { fileURLToPath } from 'node:url';
import { handle, cleanup } from '../src/index.mjs';
import { d1, fileKv } from './shim.mjs';

export { d1, fileKv };

const HERE = path.dirname(fileURLToPath(import.meta.url));
const DATA = process.env.DATA_DIR || path.join(HERE, '..', '.data');
const PORT = process.env.PORT != null && process.env.PORT !== '' ? Number(process.env.PORT) : 8787;
const HOST = process.env.HOST || '127.0.0.1';
const MAX_BODY = 64 * 1024; // a run is ~3 KB; Caddy refuses bigger bodies too
const DRAIN_MS = 10000;
// Behind our own proxy (the Linode: Caddy on the same host) its headers are trusted; TRUST_PROXY=0 when Node faces
// clients directly (e.g. a bare docker run), so a client cannot pick its own rate-limit bucket with a header.
const TRUST_PROXY = process.env.TRUST_PROXY !== '0';

fs.mkdirSync(path.join(DATA, 'kv'), { recursive: true });

// The client address: X-Real-IP is set by our Caddy (overwriting whatever the client sent), else the last
// X-Forwarded-For entry (the one the nearest proxy appended), else the socket (direct, e.g. docker or tests).
export function clientIp(req, trust = TRUST_PROXY) {
  if (!trust) return req.socket.remoteAddress || '';
  const real = String(req.headers['x-real-ip'] || '').trim();
  if (real) return real;
  const xff = String(req.headers['x-forwarded-for'] || '').split(',').map((s) => s.trim()).filter(Boolean);
  return xff[xff.length - 1] || req.socket.remoteAddress || '';
}

const db = new DatabaseSync(path.join(DATA, 'clash.sqlite'));
db.exec('PRAGMA journal_mode = WAL; PRAGMA busy_timeout = 3000; PRAGMA synchronous = NORMAL;');
db.exec(fs.readFileSync(path.join(HERE, '..', 'schema.sql'), 'utf8').replace(/CREATE TABLE (?!IF NOT EXISTS)/g, 'CREATE TABLE IF NOT EXISTS ').replace(/CREATE INDEX (?!IF NOT EXISTS)/g, 'CREATE INDEX IF NOT EXISTS '));
const saltFile = path.join(DATA, 'ip-salt');
if (!process.env.IP_SALT && !fs.existsSync(saltFile)) fs.writeFileSync(saltFile, crypto.randomBytes(16).toString('hex'), { mode: 0o600 });
const env = { DB: d1(db), CLASH_KV: fileKv(path.join(DATA, 'kv')), IP_SALT: process.env.IP_SALT || fs.readFileSync(saltFile, 'utf8').trim() };

const sendJson = (res, status, obj, extra = {}) => {
  if (res.headersSent) return res.end();
  res.writeHead(status, { 'content-type': 'application/json; charset=utf-8', 'x-content-type-options': 'nosniff', 'cache-control': 'no-store', ...extra });
  res.end(JSON.stringify(obj));
};

let draining = false;
const server = http.createServer(async (req, res) => {
  if (draining) res.setHeader('connection', 'close');
  try {
    const declared = Number(req.headers['content-length']);
    if (declared > MAX_BODY) { sendJson(res, 413, { error: 'request too large' }, { connection: 'close' }); req.resume(); return; }
    const chunks = [];
    let size = 0;
    for await (const c of req) {
      size += c.length;
      if (size > MAX_BODY) { sendJson(res, 413, { error: 'request too large' }, { connection: 'close' }); req.destroy(); return; }
      chunks.push(c);
    }
    const headers = new Headers();
    for (const [k, v] of Object.entries(req.headers)) if (typeof v === 'string') headers.set(k, v);
    headers.set('cf-connecting-ip', clientIp(req)); // the handler reads the client IP from here (as on Cloudflare)
    const body = ['GET', 'HEAD'].includes(req.method) ? undefined : Buffer.concat(chunks);
    const out = await handle(new Request(`https://${req.headers.host || 'localhost'}${req.url}`, { method: req.method, headers, body }), env);
    const resHeaders = {};
    out.headers.forEach((v, k) => { resHeaders[k] = v; });
    res.writeHead(out.status, resHeaders);
    res.end(req.method === 'HEAD' ? undefined : Buffer.from(await out.arrayBuffer()));
  } catch (err) {
    console.error('[clash]', err);
    sendJson(res, 500, { error: 'server error' });
  }
});
server.headersTimeout = 10000; // slowloris: all headers within 10 s
server.requestTimeout = 15000; // the whole request (headers + body) within 15 s
server.keepAliveTimeout = 65000; // longer than Caddy's upstream keepalive (30 s, see Caddyfile)
server.maxHeadersCount = 64;
server.maxRequestsPerSocket = 1000;

server.listen(PORT, HOST, () => {
  const a = server.address();
  console.log(`[clash] listening on ${HOST}:${a && typeof a === 'object' ? a.port : PORT}, data in ${DATA}`);
  if (process.send) process.send({ listening: a && typeof a === 'object' ? a.port : PORT });
});

// The Worker's daily cron: expire unused matches, old rate rows and idempotency records. Once shortly after
// start too, so frequent deploys (restarts) never starve it.
const runCleanup = () => cleanup(env).catch((err) => console.error('[clash] cleanup', err));
const firstCleanup = setTimeout(runCleanup, 60000);
firstCleanup.unref();
setInterval(runCleanup, 6 * 3600 * 1000).unref();

function shutdown(signal) {
  if (draining) return;
  draining = true;
  console.log(`[clash] ${signal}: draining`);
  clearTimeout(firstCleanup);
  const done = (code) => {
    try { db.exec('PRAGMA wal_checkpoint(TRUNCATE);'); } catch {}
    try { db.close(); } catch {}
    console.log('[clash] closed');
    process.exit(code);
  };
  server.close(() => done(0)); // stops accepting; calls back once in-flight requests have finished
  server.closeIdleConnections();
  setTimeout(() => { console.error('[clash] drain timed out'); server.closeAllConnections(); done(1); }, DRAIN_MS).unref();
}
process.on('SIGTERM', () => shutdown('SIGTERM'));
process.on('SIGINT', () => shutdown('SIGINT'));
process.on('message', (m) => { if (m === 'shutdown') shutdown('shutdown message'); });
