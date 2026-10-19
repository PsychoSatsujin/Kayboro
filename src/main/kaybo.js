'use strict';
// Kaybo, the community art site, from inside Kayboro: browse and search the works it approves, then pull
// one down to use as a background, a shell fill or a custom shell, or save a copy. Kayboro ships none of
// this art and stores nothing on the site: it shows what the site serves for all-ages viewing, cached
// locally once used. Copyright and DMCA claims are handled by the site (see EULA.txt).
const fs = require('fs');
const path = require('path');

// Temporary address until the site has its own domain; KAYBORO_KAYBO_URL overrides it (testing).
const SITE = (process.env.KAYBORO_KAYBO_URL || 'https://50-116-48-56.ip.linodeusercontent.com').replace(/\/+$/, '');
const API = `${SITE}/api/v1`;
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const SORTS = ['popular', 'newest'];
const KINDS = ['all', 'illustration', 'animation', 'manga'];
const MIME_EXT = { 'image/webp': 'webp', 'image/png': 'png', 'image/jpeg': 'jpg', 'image/gif': 'gif', 'video/mp4': 'mp4', 'video/webm': 'webm' };

/** Absolute URL for a site path like /userContent/..., or null for anything off the site. */
function siteUrl(p) {
  if (typeof p !== 'string' || !p) return null;
  try {
    const u = new URL(p, SITE);
    return u.origin === new URL(SITE).origin ? u.href : null;
  } catch {
    return null;
  }
}

// All-ages only: the search asks for safe works, and anything rated or flagged is dropped anyway.
const allAges = (w) => w && w.ageRating === 'all' && !w.isSensitive && w.status === 'published';

// The site serves its images with Cross-Origin-Resource-Policy: same-origin, so the gallery shows them
// through Kayboro's own kaybo://img/<path> scheme (registerProtocol), fetched by the main process.
const proxied = (p) => { const u = siteUrl(p); return u ? `kaybo://img${new URL(u).pathname}` : null; };

/** A work as the gallery shows it. */
function card(w) {
  const c = w.cover || {};
  return {
    id: String(w.id), title: String(w.title || 'Untitled').slice(0, 64), kind: String(w.kind || 'illustration'),
    author: String(w.author?.username || ''), pages: Number(w.pageCount) || 1, isAi: !!w.isAi,
    thumb: proxied(c.variants?.thumb || c.url), medium: proxied(c.variants?.medium || c.url),
    width: Number(c.width) || 0, height: Number(c.height) || 0, page: `${SITE}/works/${w.id}`,
  };
}

function create({ net, userDataDir, timeoutMs = 15000 }) {
  const cacheDir = path.join(userDataDir, 'kayboro', 'kaybo-cache');
  const get = async (url) => {
    const r = await net.fetch(url, { signal: AbortSignal.timeout(timeoutMs), headers: { Accept: 'application/json' } });
    if (!r.ok) throw new Error(r.status === 429 ? 'Kaybo is busy, try again in a minute.' : `Kaybo answered ${r.status}.`);
    return r;
  };

  /** One page of works: { works: card[], total, offset, more }. */
  async function browse({ q = '', sort = 'popular', kind = 'all', offset = 0, limit = 30 } = {}) {
    const p = new URLSearchParams({
      limit: String(Math.min(60, Math.max(1, limit | 0 || 30))), offset: String(Math.max(0, offset | 0)),
      sort: SORTS.includes(sort) ? sort : 'popular', kind: KINDS.includes(kind) ? kind : 'all', rating: 'safe',
    });
    const text = String(q || '').trim().slice(0, 200);
    if (text) { p.set('q', text); p.set('match', 'text'); }
    const j = await (await get(`${API}/search?${p}`)).json();
    const raw = Array.isArray(j?.data?.works) ? j.data.works : [];
    const n = Number(p.get('limit'));
    return { works: raw.filter(allAges).map(card).filter((c) => c.thumb), total: Number(j?.data?.total) || 0, offset: Number(p.get('offset')), more: raw.length >= n };
  }

  /** The files of one work (its pages), each { url, mime, width, height }. */
  async function pages(id) {
    if (!UUID.test(String(id))) throw new Error('Not a Kaybo work.');
    const w = (await (await get(`${API}/works/${id}`)).json())?.data;
    if (!allAges(w)) throw new Error('That work is not available for all ages.');
    return (w.pages || []).map((pg) => ({ url: siteUrl(pg.url), mime: String(pg.mimeType || ''), width: pg.width, height: pg.height })).filter((pg) => pg.url && MIME_EXT[pg.mime]);
  }

  /** Downloads page `n` of a work into the local cache (once) and returns { file, url (file://), mime }. */
  async function fetchWork(id, n = 0) {
    const list = await pages(id);
    const pg = list[Math.min(Math.max(0, n | 0), list.length - 1)];
    if (!pg) throw new Error('That work has no image Kayboro can use.');
    fs.mkdirSync(cacheDir, { recursive: true });
    const file = path.join(cacheDir, `${id}-${n | 0}.${MIME_EXT[pg.mime]}`);
    if (!fs.existsSync(file)) {
      const buf = Buffer.from(await (await net.fetch(pg.url, { signal: AbortSignal.timeout(60000) })).arrayBuffer());
      if (buf.length > 64 * 1024 * 1024) throw new Error('That file is too large.');
      fs.writeFileSync(file + '.part', buf);
      fs.renameSync(file + '.part', file);
    }
    return { file, url: require('url').pathToFileURL(file).href, mime: pg.mime };
  }

  return { browse, pages, fetchWork, cacheDir };
}

// kaybo://img/userContent/... -> the site's image (redirects to its storage are followed). Only the site's
// /userContent/ path is reachable; the response keeps just the bytes and their type.
function registerProtocol(protocol, net) {
  protocol.handle('kaybo', async (req) => {
    const u = new URL(req.url);
    const target = u.host === 'img' && u.pathname.startsWith('/userContent/') ? siteUrl(u.pathname) : null;
    if (!target) return new Response(null, { status: 404 });
    try {
      const r = await net.fetch(target, { signal: AbortSignal.timeout(20000) });
      if (!r.ok) return new Response(null, { status: r.status });
      return new Response(r.body, { status: 200, headers: { 'Content-Type': r.headers.get('content-type') || 'application/octet-stream', 'Cache-Control': 'max-age=86400' } });
    } catch {
      return new Response(null, { status: 502 });
    }
  });
}
const SCHEME = { scheme: 'kaybo', privileges: { standard: true, secure: true, supportFetchAPI: true } };

module.exports = { create, siteUrl, card, allAges, registerProtocol, SCHEME, SITE, API };
