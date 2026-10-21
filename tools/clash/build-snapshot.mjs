#!/usr/bin/env node
// Fandom Clash snapshot builder.
//
// Builds the contestant snapshot used by the Fandom Clash game: the most-posted Danbooru
// character tags, the franchise (copyright tag) each belongs to, per-site post counts (all
// ratings) and ONE all-ages reference image per character (Danbooru rating:g, falling back to
// safebooru.org). See server/clash/README.md for the schema and the design notes.
//
// Usage:
//   node tools/clash/build-snapshot.mjs [--limit 500] [--out .cache/clash/snapshot.json]
//        [--sample 150] [--sites danbooru,e621,...] [--concurrency 3] [--ttl-days 7]
//        [--no-franchise-tags] [--verbose]
//
// Everything is cached under .cache/clash/http (git-ignored), so an interrupted build resumes
// where it stopped and a re-run within --ttl-days costs no requests.
//
// Optional site credentials (only used if present; the site is skipped otherwise):
//   GELBOORU_USER_ID + GELBOORU_API_KEY     gelbooru.com requires an API key since 2024
//   RULE34_USER_ID   + RULE34_API_KEY       api.rule34.xxx requires an API key since 2025
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { fileURLToPath } from 'node:url';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(HERE, '..', '..');
const UA = 'KayboroClash/0.1 (+https://github.com/PsychoSatsujin; Fandom Clash snapshot builder)';

// ---------------------------------------------------------------------------------------------
// CLI
function parseArgs(argv) {
  const o = {
    limit: 500,
    out: path.join(ROOT, '.cache', 'clash', 'snapshot.json'),
    sample: 150,
    sampleOut: path.join(HERE, 'sample-snapshot.json'),
    sites: null,
    concurrency: 3,
    ttlDays: 7,
    franchiseTags: true,
    verbose: false,
    minPosts: 0,
  };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    const next = () => argv[++i];
    if (a === '--limit') o.limit = Math.max(10, parseInt(next(), 10));
    else if (a === '--out') o.out = path.resolve(next());
    else if (a === '--sample') o.sample = parseInt(next(), 10);
    else if (a === '--sample-out') o.sampleOut = path.resolve(next());
    else if (a === '--sites') o.sites = next().split(',').map((s) => s.trim()).filter(Boolean);
    else if (a === '--concurrency') o.concurrency = Math.min(4, Math.max(1, parseInt(next(), 10)));
    else if (a === '--ttl-days') o.ttlDays = Number(next());
    else if (a === '--no-franchise-tags') o.franchiseTags = false;
    else if (a === '--verbose' || a === '-v') o.verbose = true;
    else if (a === '--help' || a === '-h') {
      console.log(fs.readFileSync(fileURLToPath(import.meta.url), 'utf8').split('\nimport ')[0]);
      process.exit(0);
    } else throw new Error(`unknown argument: ${a}`);
  }
  return o;
}
const OPT = parseArgs(process.argv.slice(2));
const CACHE_DIR = path.join(ROOT, '.cache', 'clash', 'http');
fs.mkdirSync(CACHE_DIR, { recursive: true });
const log = (...a) => console.log(...a);
const vlog = (...a) => { if (OPT.verbose) console.log(...a); };

// ---------------------------------------------------------------------------------------------
// Polite HTTP: one request at a time per host with a minimum gap, a small global cap,
// retries with exponential backoff (honours Retry-After), and a disk cache keyed by URL.
const HOST_GAP_MS = {
  'danbooru.donmai.us': 350,
  'e621.net': 700, // e621 asks for <= 2 req/s
  'safebooru.org': 500,
  'gelbooru.com': 500,
  'api.rule34.xxx': 500,
  'rule34.paheal.net': 1000,
  'yande.re': 700,
  'konachan.com': 700,
};
const hostState = new Map();
let globalActive = 0;
const globalWaiters = [];
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const stats = { requests: 0, cacheHits: 0, errors: 0 };

async function acquireGlobal() {
  if (globalActive < OPT.concurrency) { globalActive++; return; }
  await new Promise((r) => globalWaiters.push(r));
  globalActive++;
}
function releaseGlobal() {
  globalActive--;
  const w = globalWaiters.shift();
  if (w) w();
}
async function withHost(host, fn) {
  let st = hostState.get(host);
  if (!st) { st = { chain: Promise.resolve(), last: 0 }; hostState.set(host, st); }
  const run = st.chain.then(async () => {
    const gap = HOST_GAP_MS[host] ?? 800;
    const wait = st.last + gap - Date.now();
    if (wait > 0) await sleep(wait);
    await acquireGlobal();
    try { return await fn(); } finally { st.last = Date.now(); releaseGlobal(); }
  });
  st.chain = run.catch(() => {});
  return run;
}

const cacheFile = (url) => path.join(CACHE_DIR, crypto.createHash('sha1').update(url).digest('hex') + '.json');
const redact = (url) => url.replace(/(api_key|user_id)=[^&]+/g, '$1=***');

// Returns { status, body } where body is text; null body on hard failure. 404 is cached too.
async function get(url, { cacheKey } = {}) {
  const key = cacheKey || url;
  const file = cacheFile(key);
  try {
    const c = JSON.parse(fs.readFileSync(file, 'utf8'));
    if (Date.now() - c.t < OPT.ttlDays * 864e5) { stats.cacheHits++; return c; }
  } catch { /* miss */ }
  const host = new URL(url).host;
  return withHost(host, async () => {
    for (let attempt = 0; attempt < 5; attempt++) {
      try {
        stats.requests++;
        const res = await fetch(url, {
          headers: { 'User-Agent': UA, Accept: 'application/json, text/xml;q=0.9' },
          signal: AbortSignal.timeout(30000),
        });
        const body = await res.text();
        if (res.status === 429 || res.status >= 500) {
          const ra = Number(res.headers.get('retry-after'));
          const backoff = (ra > 0 ? ra * 1000 : 1500 * 2 ** attempt) + Math.random() * 500;
          vlog(`  ${res.status} ${redact(url)} retry in ${Math.round(backoff)}ms`);
          await sleep(backoff);
          continue;
        }
        const rec = { t: Date.now(), status: res.status, body };
        if (res.status < 500) fs.writeFileSync(file, JSON.stringify(rec));
        return rec;
      } catch (e) {
        vlog(`  network error ${redact(url)}: ${e.message}`);
        await sleep(1500 * 2 ** attempt + Math.random() * 500);
      }
    }
    stats.errors++;
    return { status: 0, body: null };
  });
}
async function getJson(url, opts) {
  const r = await get(url, opts);
  if (r.status !== 200 || !r.body) return null;
  try { return JSON.parse(r.body); } catch { return null; }
}

// Minimal parser for Gelbooru 0.2 XML tag lists: <tag type="4" count="123" name="x" .../>
function parseXmlTags(xml) {
  const out = [];
  if (!xml) return out;
  for (const m of xml.matchAll(/<tag\b([^>]*)\/?>/g)) {
    const attrs = {};
    for (const a of m[1].matchAll(/(\w+)="([^"]*)"/g)) attrs[a[1]] = a[2];
    if (attrs.name != null) {
      out.push({ name: decodeXml(attrs.name), count: Number(attrs.count) || 0, type: Number(attrs.type) });
    }
  }
  return out;
}
const decodeXml = (s) => s.replace(/&quot;/g, '"').replace(/&apos;/g, "'").replace(/&lt;/g, '<')
  .replace(/&gt;/g, '>').replace(/&#0*39;/g, "'").replace(/&amp;/g, '&');

// ---------------------------------------------------------------------------------------------
// Site adapters. Each exposes counts(names, kind) -> Map(name -> int) for names it found.
// kind is 'character' or 'copyright', used to require the right tag category where the site
// reports one (so a qualifier-stripped fallback never matches, say, an artist tag).
const CAT = { character: 4, copyright: 3 };
const qualifierBase = (name) => {
  const m = /^(.+?)_\([^()]+\)$/.exec(name);
  return m && m[1].includes('_') ? m[1] : null; // only multi-word bases, to avoid collisions
};
// Western-order alternative for two-word Japanese-order names (hakurei_reimu -> reimu_hakurei);
// e621 and paheal mostly use given-name-first tags.
const swappedName = (name) => {
  const plain = name.replace(/_\([^()]+\)$/, '');
  const parts = plain.split('_');
  return parts.length === 2 && parts.every((p) => /^[a-z]{2,}$/.test(p)) ? parts[1] + '_' + parts[0] : null;
};
const westernAlts = (name) => [qualifierBase(name), swappedName(name)].filter(Boolean);
const enc = encodeURIComponent;

function gelbooruAdapter(id, base, credEnv) {
  let creds = '';
  if (credEnv) {
    const uid = process.env[credEnv[0]];
    const key = process.env[credEnv[1]];
    if (!uid || !key) return null;
    creds = `&user_id=${enc(uid)}&api_key=${enc(key)}`;
  }
  async function one(name, kind) {
    const url = `${base}/index.php?page=dapi&s=tag&q=index&name=${enc(name)}${creds}`;
    const r = await get(url, { cacheKey: redact(url) });
    if (r.status !== 200 || !r.body || /<error>/i.test(r.body)) return null;
    let tags = parseXmlTags(r.body);
    if (!tags.length && r.body.trim().startsWith('{')) {
      try { tags = (JSON.parse(r.body).tag || []).map((t) => ({ name: t.name, count: +t.count, type: +t.type })); } catch { /* */ }
    }
    const t = tags.find((x) => x.name === name);
    if (!t) return null;
    if (kind && t.type !== CAT[kind]) return null;
    return t.count;
  }
  return {
    id,
    async counts(names, kind) {
      const out = new Map();
      await Promise.all(names.map(async (n) => {
        let c = await one(n, null);
        if (c == null && kind === 'character') {
          const b = qualifierBase(n);
          if (b) {
            const cb = await one(b, kind);
            if (cb != null && cb > 0) c = cb;
          }
        }
        if (c != null && c > 0) out.set(n, c);
      }));
      return out;
    },
  };
}

function danbooruAdapter() {
  return {
    id: 'danbooru',
    known: new Map(), // filled from the character listing (post_count included)
    async counts(names) {
      const out = new Map();
      const need = [];
      for (const n of names) (this.known.has(n) ? out.set(n, this.known.get(n)) : need.push(n));
      for (let i = 0; i < need.length; i += 50) {
        const chunk = need.slice(i, i + 50);
        const url = `https://danbooru.donmai.us/tags.json?search[name_comma]=${chunk.map(enc).join(',')}&limit=100&only=name,post_count,category`;
        const j = await getJson(url);
        for (const t of j || []) if (t.post_count > 0) out.set(t.name, t.post_count);
      }
      return out;
    },
  };
}

function e621Adapter() {
  async function batch(names, kind) {
    const out = new Map();
    for (let i = 0; i < names.length; i += 50) {
      const chunk = names.slice(i, i + 50);
      const url = `https://e621.net/tags.json?search[name]=${chunk.map(enc).join(',')}&limit=100&only=name,post_count,category`;
      const j = await getJson(url);
      const arr = Array.isArray(j) ? j : [];
      for (const t of arr) {
        if (!(t.post_count > 0)) continue;
        if (kind && t.category !== CAT[kind]) continue;
        out.set(t.name, t.post_count);
      }
    }
    return out;
  }
  return {
    id: 'e621',
    async counts(names, kind) {
      const out = await batch(names, null);
      if (kind === 'character') {
        const fall = new Map();
        for (const n of names) {
          if (out.has(n)) continue;
          for (const alt of westernAlts(n)) if (!fall.has(alt)) fall.set(alt, n);
        }
        if (fall.size) {
          const got = await batch([...fall.keys()], 'character');
          for (const [alt, orig] of fall) if (!out.has(orig) && got.has(alt)) out.set(orig, got.get(alt));
        }
      }
      return out;
    },
  };
}

function pahealAdapter() {
  async function one(name) {
    const j = await getJson(`https://rule34.paheal.net/api/internal/autocomplete?s=${enc(name)}`);
    if (!j || Array.isArray(j)) return null;
    for (const [k, v] of Object.entries(j)) {
      if (k.toLowerCase() === name.toLowerCase()) {
        const c = typeof v === 'number' ? v : v && v.count;
        return Number(c) || null;
      }
    }
    return null;
  }
  return {
    id: 'paheal',
    async counts(names, kind) {
      const out = new Map();
      await Promise.all(names.map(async (n) => {
        let c = await one(n);
        if (c == null && kind === 'character') {
          for (const alt of westernAlts(n)) { c = await one(alt); if (c) break; }
        }
        if (c) out.set(n, c);
      }));
      return out;
    },
  };
}

function moebooruAdapter(id, base) {
  async function one(name, kind) {
    const j = await getJson(`${base}/tag.json?name=${enc(name)}&order=count&limit=25`);
    const t = (Array.isArray(j) ? j : []).find((x) => x.name === name);
    if (!t) return null;
    if (kind && t.type !== CAT[kind]) return null;
    return t.count;
  }
  return {
    id,
    async counts(names, kind) {
      const out = new Map();
      await Promise.all(names.map(async (n) => {
        let c = await one(n, null);
        if (c == null && kind === 'character') {
          const b = qualifierBase(n);
          if (b) c = await one(b, 'character');
        }
        if (c) out.set(n, c);
      }));
      return out;
    },
  };
}

const ALL_ADAPTERS = [
  danbooruAdapter(),
  gelbooruAdapter('gelbooru', 'https://gelbooru.com', ['GELBOORU_USER_ID', 'GELBOORU_API_KEY']),
  gelbooruAdapter('safebooru', 'https://safebooru.org'),
  gelbooruAdapter('rule34', 'https://api.rule34.xxx', ['RULE34_USER_ID', 'RULE34_API_KEY']),
  e621Adapter(),
  pahealAdapter(),
  moebooruAdapter('yandere', 'https://yande.re'),
  moebooruAdapter('konachan', 'https://konachan.com'),
];
const skippedSites = [];
const ADAPTERS = ALL_ADAPTERS.filter((a, i) => {
  const ids = ['danbooru', 'gelbooru', 'safebooru', 'rule34', 'e621', 'paheal', 'yandere', 'konachan'];
  if (!a) { skippedSites.push(`${ids[i]} (no API key in env)`); return false; }
  if (OPT.sites && !OPT.sites.includes(a.id)) return false;
  return true;
});
const danbooru = ALL_ADAPTERS[0];

// ---------------------------------------------------------------------------------------------
// Names
const GENERIC_COPYRIGHTS = new Set([
  'original', 'virtual_youtuber', 'crossover', 'real_life', 'parody', 'style_parody',
  'copyright_request', 'commentary_request', 'company_connection', 'meme', 'cosplay',
]);
const FRANCHISE_NAMES = {
  'kantai_collection': 'Kantai Collection',
  'idolmaster': 'The Idolmaster',
  'touhou': 'Touhou Project',
  'fate_(series)': 'Fate',
  'pokemon': 'Pokémon',
  'love_live!': 'Love Live!',
  'azur_lane': 'Azur Lane',
  'blue_archive': 'Blue Archive',
  'genshin_impact': 'Genshin Impact',
  'hololive': 'Hololive',
  'vocaloid': 'Vocaloid',
  'girls_und_panzer': 'Girls und Panzer',
  'girls\'_frontline': 'Girls\' Frontline',
  'jojo_no_kimyou_na_bouken': 'JoJo\'s Bizarre Adventure',
  'mahou_shoujo_madoka_magica': 'Puella Magi Madoka Magica',
  'umamusume': 'Umamusume',
  'honkai_(series)': 'Honkai',
  'nier_(series)': 'NieR',
  'the_legend_of_zelda': 'The Legend of Zelda',
};
const SMALL_WORDS = new Set(['no', 'to', 'wa', 'ga', 'de', 'of', 'the', 'and', 'in', 'on', 'a', 'x']);
function titleCase(s) {
  return s.split(' ').map((w, i) => (w && /^[a-z]/.test(w) && !(i > 0 && SMALL_WORDS.has(w)) ? w[0].toUpperCase() + w.slice(1) : w)).join(' ')
    .replace(/([/:\-.(]\s?)([a-z])/g, (m, p, c) => p + c.toUpperCase());
}
function prettyTag(tag, { stripQualifier = true } = {}) {
  let t = tag;
  if (stripQualifier) {
    const m = /^(.+?)_\(([^()]+)\)$/.exec(t);
    if (m) t = m[1];
  }
  return titleCase(t.replace(/_/g, ' ').trim());
}
const franchiseName = (tag) => FRANCHISE_NAMES[tag] || prettyTag(tag.replace(/_\((series|game|franchise)\)$/, ''), { stripQualifier: false });
// Danbooru costume/alt-outfit tags look like name_(costume)_(series); they would duplicate the base.
const isCostumeTag = (tag) => /_\([^()]+\)_\([^()]+\)$/.test(tag);

// ---------------------------------------------------------------------------------------------
// Step 1: the character pool from Danbooru.
async function fetchCharacterPool(limit) {
  const pool = [];
  const seen = new Set();
  for (let page = 1; pool.length < limit && page <= 20; page++) {
    const url = `https://danbooru.donmai.us/tags.json?search[category]=4&search[order]=count&search[hide_empty]=true&limit=1000&page=${page}&only=name,post_count,is_deprecated`;
    const j = await getJson(url);
    if (!Array.isArray(j) || !j.length) break;
    for (const t of j) {
      if (pool.length >= limit) break;
      if (seen.has(t.name) || t.is_deprecated || isCostumeTag(t.name)) continue;
      seen.add(t.name);
      pool.push({ tag: t.name, danbooru: t.post_count });
      danbooru.known.set(t.name, t.post_count);
    }
  }
  return pool;
}

// Step 2: franchise + SFW image from one Danbooru search per character (rating:g only).
const IMG_EXT = new Set(['jpg', 'jpeg', 'png', 'webp']);
function pickDanbooruImage(posts) {
  for (const p of posts) {
    if (p.rating !== 'g' || p.is_banned || p.is_deleted) continue;
    if (!IMG_EXT.has(String(p.file_ext).toLowerCase())) continue;
    const nChars = (p.tag_string_character || '').split(' ').filter(Boolean).length;
    const nCopy = (p.tag_string_copyright || '').split(' ').filter(Boolean).length;
    if (nChars > 2 || nCopy > 3) continue; // skip crossover collages
    const variants = (p.media_asset && p.media_asset.variants) || [];
    const v = ['sample', '720x720', '360x360'].map((ty) => variants.find((x) => x.type === ty)).find(Boolean);
    if (!v || !v.url || !/^https:\/\//.test(v.url)) continue;
    return { site: 'danbooru', postId: String(p.id), url: v.url, w: v.width | 0, h: v.height | 0 };
  }
  return null;
}
function dominantCopyright(posts) {
  const score = new Map();
  for (const p of posts) {
    const cps = (p.tag_string_copyright || '').split(' ').filter((c) => c && !GENERIC_COPYRIGHTS.has(c));
    if (!cps.length || cps.length > 4) continue;
    for (const c of cps) score.set(c, (score.get(c) || 0) + 1 / cps.length + 1); // presence + specificity
  }
  let best = null;
  let bestS = 0;
  for (const [c, s] of score) if (s > bestS) { best = c; bestS = s; }
  return best;
}
async function safebooruImage(tag) {
  const j = await getJson(`https://safebooru.org/index.php?page=dapi&s=post&q=index&json=1&limit=20&tags=${enc(tag)}`);
  for (const p of Array.isArray(j) ? j : []) {
    if (!['general', 'safe', 's', 'g'].includes(String(p.rating))) continue;
    const ext = String(p.image || '').split('.').pop().toLowerCase();
    if (!IMG_EXT.has(ext)) continue;
    const useSample = p.sample && p.sample_url;
    const url = useSample ? p.sample_url : p.file_url;
    if (!url || !/^https:\/\//.test(url)) continue;
    return { site: 'safebooru', postId: String(p.id), url, w: (useSample ? p.sample_width : p.width) | 0, h: (useSample ? p.sample_height : p.height) | 0 };
  }
  return null;
}
async function characterMeta(tag) {
  const fields = 'id,rating,is_banned,is_deleted,file_ext,tag_string_character,tag_string_copyright,media_asset';
  const url = `https://danbooru.donmai.us/posts.json?tags=${enc(tag)}+rating:g+order:score&limit=60&only=${fields}`;
  const posts = (await getJson(url)) || [];
  let franchise = dominantCopyright(posts);
  if (!franchise) {
    // Fall back to any-rating sample (only copyright tags are read; no image is taken from it).
    const any = (await getJson(`https://danbooru.donmai.us/posts.json?tags=${enc(tag)}&limit=40&only=tag_string_copyright`)) || [];
    franchise = dominantCopyright(any);
  }
  let image = pickDanbooruImage(posts);
  if (!image) image = await safebooruImage(tag);
  return { franchise, image };
}

async function mapLimit(items, n, fn, label) {
  const out = new Array(items.length);
  let i = 0;
  let done = 0;
  const t0 = Date.now();
  await Promise.all(Array.from({ length: n }, async () => {
    while (i < items.length) {
      const k = i++;
      out[k] = await fn(items[k], k);
      done++;
      if (label && (done % 50 === 0 || done === items.length)) {
        log(`  ${label}: ${done}/${items.length} (${Math.round((Date.now() - t0) / 1000)}s, ${stats.requests} req, ${stats.cacheHits} cached)`);
      }
    }
  }));
  return out;
}

// ---------------------------------------------------------------------------------------------
async function main() {
  const t0 = Date.now();
  log(`Fandom Clash snapshot: ${OPT.limit} characters, sites: ${ADAPTERS.map((a) => a.id).join(', ')}`);
  if (skippedSites.length) log(`  skipped: ${skippedSites.join('; ')}`);

  log('1/4 character pool (Danbooru, category 4 by post_count)');
  const pool = await fetchCharacterPool(OPT.limit);
  log(`  ${pool.length} characters`);

  log('2/4 franchise + SFW image (Danbooru rating:g, safebooru fallback)');
  const metas = await mapLimit(pool, 2, (c) => characterMeta(c.tag), 'meta');

  log('3/4 per-site character counts');
  const tags = pool.map((c) => c.tag);
  const siteCounts = new Map();
  const siteStatus = {};
  await Promise.all(ADAPTERS.map(async (a) => {
    const chunks = [];
    for (let i = 0; i < tags.length; i += 100) chunks.push(tags.slice(i, i + 100));
    const m = new Map();
    for (const ch of chunks) for (const [k, v] of await a.counts(ch, 'character')) m.set(k, v);
    siteCounts.set(a.id, m);
    siteStatus[a.id] = m.size;
    log(`  ${a.id}: ${m.size}/${tags.length} found`);
  }));

  const characters = [];
  pool.forEach((c, i) => {
    const meta = metas[i];
    if (!meta.franchise) { vlog(`  drop ${c.tag}: no franchise`); return; }
    const counts = {};
    for (const a of ADAPTERS) {
      const v = siteCounts.get(a.id).get(c.tag);
      if (v) counts[a.id] = v;
    }
    const total = Object.values(counts).reduce((s, v) => s + v, 0);
    characters.push({ id: c.tag, name: prettyTag(c.tag), franchise: meta.franchise, counts, total, image: meta.image || null });
  });
  // Keep the qualifier where stripping it would make two display names collide.
  const byName = new Map();
  for (const c of characters) byName.set(c.name, (byName.get(c.name) || 0) + 1);
  for (const c of characters) if (byName.get(c.name) > 1) c.name = prettyTag(c.id, { stripQualifier: false });
  characters.sort((a, b) => b.total - a.total || a.id.localeCompare(b.id));

  log('4/4 franchises');
  const fr = new Map();
  for (const c of characters) {
    if (!fr.has(c.franchise)) fr.set(c.franchise, []);
    fr.get(c.franchise).push(c);
  }
  const frIds = [...fr.keys()];
  const frSiteCounts = new Map();
  if (OPT.franchiseTags) {
    await Promise.all(ADAPTERS.map(async (a) => {
      frSiteCounts.set(a.id, await a.counts(frIds, 'copyright'));
      log(`  ${a.id}: ${frSiteCounts.get(a.id).size}/${frIds.length} copyright tags found`);
    }));
  }
  // Franchise total = sum over sites of the copyright tag's own post count on that site; where a
  // site does not know the copyright tag, the sum of that site's counts for the franchise's pool
  // characters is used instead (documented in server/clash/README.md).
  // `counts` (per site) and `fallback` (the sites that used the character sum) are kept so the rule
  // can be re-checked from the snapshot alone (test/clash-numbers.test.js); `total` = sum of `counts`.
  const franchises = frIds.map((id) => {
    const chars = fr.get(id);
    const counts = {};
    const fallback = [];
    for (const a of ADAPTERS) {
      const own = OPT.franchiseTags ? frSiteCounts.get(a.id).get(id) : null;
      const v = own || chars.reduce((s, c) => s + (c.counts[a.id] || 0), 0);
      if (!own) fallback.push(a.id);
      if (v) counts[a.id] = v;
    }
    const total = Object.values(counts).reduce((s, v) => s + v, 0);
    return { id, name: franchiseName(id), total, counts, fallback, characters: chars.map((c) => c.id) };
  });
  franchises.sort((a, b) => b.total - a.total || a.id.localeCompare(b.id));

  const sites = ADAPTERS.map((a) => a.id).filter((id) => siteStatus[id] > 0);
  const snapshot = { version: 1, generatedAt: new Date().toISOString(), sites, characters, franchises };
  fs.mkdirSync(path.dirname(OPT.out), { recursive: true });
  fs.writeFileSync(OPT.out, JSON.stringify(snapshot));
  const withImg = characters.filter((c) => c.image).length;
  log(`wrote ${path.relative(ROOT, OPT.out)}: ${characters.length} characters (${withImg} with image), ${franchises.length} franchises, ${(fs.statSync(OPT.out).size / 1024).toFixed(0)} KB`);

  if (OPT.sample > 0) {
    const sample = makeSample(snapshot, OPT.sample);
    fs.writeFileSync(OPT.sampleOut, JSON.stringify(sample, null, 1) + '\n');
    log(`wrote ${path.relative(ROOT, OPT.sampleOut)}: ${sample.characters.length} characters, ${sample.franchises.length} franchises`);
  }
  log(`done in ${Math.round((Date.now() - t0) / 1000)}s; ${stats.requests} requests, ${stats.cacheHits} cache hits, ${stats.errors} failures`);
}

// A small, spread-out subset: every k-th character so all popularity tiers are represented,
// franchises restricted to those subset characters (totals kept from the full build).
function makeSample(snap, n) {
  const step = Math.max(1, snap.characters.length / n);
  const chars = [];
  for (let i = 0; i < snap.characters.length && chars.length < n; i += step) chars.push(snap.characters[Math.floor(i)]);
  const ids = new Set(chars.map((c) => c.id));
  const franchises = snap.franchises
    .map((f) => ({ ...f, characters: f.characters.filter((c) => ids.has(c)) }))
    .filter((f) => f.characters.length);
  return { ...snap, characters: chars, franchises };
}

main().catch((e) => { console.error(e); process.exit(1); });
