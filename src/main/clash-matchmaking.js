// Fandom Clash matchmaking: pure, deterministic, dependency-free.
//
// Shared by the Cloudflare Worker (server/clash), the Electron app and the tests. Everything is a
// function of (snapshot, mode, difficulty, seed), so a stored seed reproduces a whole match; that
// is what makes ghost battles and server-side re-scoring possible.
//
// Difficulty = how close the two sides' post totals are, inside a popularity tier:
//   easy    both sides in the most popular tier (top ~600 of 2,000), totals 1.8x to 4x apart
//   normal  top ~1,200, 1.35x to 2x apart
//   hard    whole pool, 1.1x to 1.4x apart (some group rounds)
//   master  whole pool, 1.02x to 1.15x apart, many multi-contestant group rounds
//           (e.g. one hugely popular character vs several franchises)
// The ratio cap is what guarantees a very popular character is never paired with an unknown one,
// on any difficulty: the most lopsided pairing allowed anywhere is 4x (easy).
'use strict';

const DIFFICULTIES = Object.freeze({
  easy: Object.freeze({ id: 'easy', tierFrac: 0.3, rankCap: 600, lo: 1.8, hi: 4, groupChance: 0, mult: 1 }),
  normal: Object.freeze({ id: 'normal', tierFrac: 0.6, rankCap: 1200, lo: 1.35, hi: 2, groupChance: 0, mult: 1.5 }),
  hard: Object.freeze({ id: 'hard', tierFrac: 1, rankCap: Infinity, lo: 1.1, hi: 1.4, groupChance: 0.1, mult: 2 }),
  master: Object.freeze({ id: 'master', tierFrac: 1, rankCap: Infinity, lo: 1.02, hi: 1.15, groupChance: 0.3, mult: 3 }),
});
const MODES = Object.freeze(['ranked', 'local', 'percentage', 'ghost']);
const ROUNDS = Object.freeze({ ranked: 10, local: 10, ghost: 10, percentage: 5 });
// Share of pairing kinds for the non-percentage modes, before group rounds are mixed in.
const KIND_WEIGHTS = Object.freeze([['char-char', 0.7], ['char-franchise', 0.18], ['franchise-franchise', 0.12]]);
const MIN_TIER = 30; // never shrink a tier below this many entries on tiny snapshots

// ---------------------------------------------------------------------------------------------
// Seeded RNG
function mulberry32(seed) {
  let a = seed >>> 0;
  return function rng() {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
// Accepts a function, an integer seed or a string; returns an rng function.
function toRng(rng) {
  if (typeof rng === 'function') return rng;
  if (typeof rng === 'number') return mulberry32(rng);
  if (typeof rng === 'string') return mulberry32(seedFromString(rng));
  return Math.random;
}
function seedFromString(s) {
  let h = 2166136261 >>> 0; // FNV-1a
  for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619) >>> 0; }
  return h >>> 0;
}
const pick = (arr, rng) => arr[Math.floor(rng() * arr.length)];
const between = (rng, lo, hi) => lo + rng() * (hi - lo);

function difficultyOf(d) {
  const cfg = DIFFICULTIES[d];
  if (!cfg) throw new Error(`unknown difficulty: ${d}`);
  return cfg;
}

// ---------------------------------------------------------------------------------------------
// Snapshot index (memoised per snapshot object)
const INDEX = new WeakMap();
function indexOf(snapshot) {
  if (!snapshot || !Array.isArray(snapshot.characters)) throw new Error('invalid snapshot');
  let ix = INDEX.get(snapshot);
  if (ix) return ix;
  const chars = snapshot.characters
    .filter((c) => c && c.id && c.total > 0)
    .map((c) => ({ type: 'character', id: c.id, total: c.total, franchise: c.franchise }))
    .sort((a, b) => b.total - a.total || (a.id < b.id ? -1 : 1));
  const frs = (snapshot.franchises || [])
    .filter((f) => f && f.id && f.total > 0)
    .map((f) => ({ type: 'franchise', id: f.id, total: f.total }))
    .sort((a, b) => b.total - a.total || (a.id < b.id ? -1 : 1));
  const byKey = new Map();
  for (const e of chars) byKey.set('character:' + e.id, e);
  for (const e of frs) byKey.set('franchise:' + e.id, e);
  ix = { chars, frs, byKey };
  INDEX.set(snapshot, ix);
  return ix;
}
const tierSize = (n, cfg) => Math.min(n, Math.max(Math.min(MIN_TIER, n), Math.min(cfg.rankCap, Math.ceil(n * cfg.tierFrac))));
const tier = (list, cfg) => list.slice(0, tierSize(list.length, cfg));
const ref = (e) => ({ type: e.type, id: e.id });
const key = (e) => e.type + ':' + e.id;

// Look up the total of a side ({type,id} or {type:'group',members}); null if unknown.
function totalOf(snapshot, side) {
  const ix = indexOf(snapshot);
  if (side && side.type === 'group') {
    let s = 0;
    for (const m of side.members || []) {
      const e = ix.byKey.get(key(m));
      if (!e) return null;
      s += e.total;
    }
    return s;
  }
  const e = side && ix.byKey.get(key(side));
  return e ? e.total : null;
}

// ---------------------------------------------------------------------------------------------
// Conflicts: a character and its own franchise must never both appear in one round (the
// franchise trivially contains the character), and nothing appears twice.
function conflicts(e, used) {
  if (used.keys.has(key(e))) return true;
  if (e.type === 'character' && used.franchises.has(e.franchise)) return true;
  if (e.type === 'franchise' && used.charFranchises.has(e.id)) return true;
  return false;
}
function newUsed(base) {
  const u = { keys: new Set(), franchises: new Set(), charFranchises: new Set() };
  if (base) for (const k of base) u.keys.add(k);
  return u;
}
function use(e, used) {
  used.keys.add(key(e));
  if (e.type === 'character') used.charFranchises.add(e.franchise);
  else used.franchises.add(e.id);
}

// Find b in pool whose total is lo..hi times larger, or lo..hi times smaller, than `t`.
function inBand(pool, t, lo, hi, used, rng, maxTotal) {
  const upLo = t * lo, upHi = t * hi, dnLo = t / hi, dnHi = t / lo;
  const cands = [];
  for (const e of pool) {
    if (e.total === t || conflicts(e, used)) continue;
    if (maxTotal != null && e.total > maxTotal) continue;
    if ((e.total >= upLo && e.total <= upHi) || (e.total >= dnLo && e.total <= dnHi)) cands.push(e);
  }
  return cands.length ? pick(cands, rng) : null;
}

function pairFrom(poolA, poolB, cfg, rng, exclude) {
  let lo = cfg.lo, hi = cfg.hi;
  for (let widen = 0; widen < 5; widen++) {
    for (let attempt = 0; attempt < 40; attempt++) {
      const a = pick(poolA, rng);
      if (!a) return null;
      const used = newUsed(exclude);
      if (conflicts(a, used)) continue;
      use(a, used);
      const b = inBand(poolB, a.total, lo, hi, used, rng);
      if (b) return [a, b];
    }
    // Tiny or lumpy snapshots only: relax the band gradually (never beyond 6x).
    lo = Math.max(1.01, lo / 1.1);
    hi = Math.min(6, hi * 1.2);
  }
  return null;
}

// Build a group of `k` members whose summed total lands near `target`.
function makeGroup(pool, target, k, used, rng) {
  for (let attempt = 0; attempt < 60; attempt++) {
    const u = { keys: new Set(used.keys), franchises: new Set(used.franchises), charFranchises: new Set(used.charFranchises) };
    const members = [];
    let sum = 0;
    for (let i = 0; i < k - 1; i++) {
      const remaining = target - sum;
      const share = remaining / (k - i);
      const cands = pool.filter((e) => e.total >= share * 0.4 && e.total <= share * 1.6 && !conflicts(e, u));
      if (!cands.length) break;
      const e = pick(cands, rng);
      members.push(e); use(e, u); sum += e.total;
    }
    if (members.length !== k - 1) continue;
    const need = target - sum;
    if (need <= 0) continue;
    let best = null;
    for (const e of pool) {
      if (conflicts(e, u)) continue;
      if (!best || Math.abs(e.total - need) < Math.abs(best.total - need)) best = e;
    }
    if (!best) continue;
    members.push(best); sum += best.total;
    return { members, sum, used: (use(best, u), u) };
  }
  return null;
}
const ratio = (x, y) => (x > y ? x / y : y / x);
const groupSide = (members) => ({ type: 'group', members: members.map(ref) });

function finish(kind, a, b, totA, totB, rng, extra) {
  // Coin-flip the sides so the bigger one is not always on the left.
  if (rng() < 0.5) { [a, b] = [b, a]; [totA, totB] = [totB, totA]; }
  return Object.assign({ kind, a, b, totals: { a: totA, b: totB }, answer: totA > totB ? 'a' : 'b' }, extra || {});
}

// ---------------------------------------------------------------------------------------------
// Rounds
function pickKind(cfg, rng, ix) {
  if (cfg.groupChance && rng() < cfg.groupChance) return 'group-group';
  let r = rng();
  for (const [k, w] of KIND_WEIGHTS) {
    if (r < w) return (k !== 'char-char' && ix.frs.length < 4) ? 'char-char' : k;
    r -= w;
  }
  return 'char-char';
}

// One-vs-many: a hugely popular character (top of the pool) against 2-4 franchises/characters.
function pickGroupRound(ix, cfg, rng, exclude) {
  const heads = ix.chars.slice(0, Math.max(5, Math.ceil(ix.chars.length * 0.05)));
  const pool = ix.chars.concat(ix.frs);
  for (let attempt = 0; attempt < 30; attempt++) {
    const head = pick(heads, rng);
    const used = newUsed(exclude);
    if (conflicts(head, used)) continue;
    use(head, used);
    const r = between(rng, cfg.lo, cfg.hi) ** (rng() < 0.5 ? 1 : -1);
    const k = 2 + Math.floor(rng() * 3);
    const g = makeGroup(pool.filter((e) => e.total < head.total), head.total * r, k, used, rng);
    if (!g) continue;
    const rr = ratio(head.total, g.sum);
    if (rr < cfg.lo || rr > cfg.hi || g.sum === head.total) continue;
    return finish('group-group', groupSide([head]), groupSide(g.members), head.total, g.sum, rng);
  }
  return null;
}

function pickRound({ snapshot, mode = 'ranked', difficulty = 'normal', rng, exclude } = {}) {
  if (!MODES.includes(mode)) throw new Error(`unknown mode: ${mode}`);
  const cfg = difficultyOf(difficulty);
  rng = toRng(rng);
  if (mode === 'percentage') return pickPercentage({ snapshot, difficulty, rng, exclude });
  const ix = indexOf(snapshot);
  if (ix.chars.length < 2) throw new Error('snapshot has too few characters');
  const chars = tier(ix.chars, cfg);
  const frs = tier(ix.frs, cfg);
  const kind = pickKind(cfg, rng, ix);
  let res = null;
  if (kind === 'group-group') {
    res = pickGroupRound(ix, cfg, rng, exclude);
  } else if (kind === 'franchise-franchise') {
    const p = pairFrom(frs, frs, cfg, rng, exclude);
    if (p) res = finish(kind, ref(p[0]), ref(p[1]), p[0].total, p[1].total, rng);
  } else if (kind === 'char-franchise') {
    // Franchises are bigger than most characters, so start from the franchise side and look for a
    // character near it in the whole character list (still bounded by the ratio band).
    const p = pairFrom(frs, chars, cfg, rng, exclude) || pairFrom(frs, ix.chars, cfg, rng, exclude);
    if (p) res = finish(kind, ref(p[1]), ref(p[0]), p[1].total, p[0].total, rng);
  }
  if (!res) {
    const p = pairFrom(chars, chars, cfg, rng, exclude) || pairFrom(ix.chars, ix.chars, cfg, rng, exclude);
    if (!p) throw new Error('no pairing possible in this snapshot');
    res = finish('char-char', ref(p[0]), ref(p[1]), p[0].total, p[1].total, rng);
  }
  return res;
}

// Percentage Vs: two groups (2-3 members each, characters and/or franchises) whose totals are
// within the difficulty's ratio band. `share` is side a's percentage of the combined total
// (0-100, one decimal); players bet coins on a side and set a % slider predicting that share.
function pickPercentage({ snapshot, difficulty = 'normal', rng, exclude } = {}) {
  const cfg = difficultyOf(difficulty);
  rng = toRng(rng);
  const ix = indexOf(snapshot);
  const pool = tier(ix.chars, cfg).concat(tier(ix.frs, cfg));
  for (let widen = 0; widen < 4; widen++) {
    const lo = Math.max(1.01, cfg.lo / 1.1 ** widen);
    const hi = Math.min(6, cfg.hi * 1.2 ** widen);
    for (let attempt = 0; attempt < 40; attempt++) {
      const used = newUsed(exclude);
      const kA = 2 + Math.floor(rng() * 2);
      const seedE = pick(pool, rng);
      if (!seedE || conflicts(seedE, used)) continue;
      const targetA = seedE.total * between(rng, 1.3, kA + 0.5);
      const gA = makeGroup(pool, targetA, kA, used, rng);
      if (!gA) continue;
      const kB = 2 + Math.floor(rng() * 2);
      const r = between(rng, lo, hi) ** (rng() < 0.5 ? 1 : -1);
      const gB = makeGroup(pool, gA.sum * r, kB, gA.used, rng);
      if (!gB) continue;
      const rr = ratio(gA.sum, gB.sum);
      if (rr < lo || rr > hi || gA.sum === gB.sum) continue;
      const res = finish('group-group', groupSide(gA.members), groupSide(gB.members), gA.sum, gB.sum, rng);
      res.share = Math.round((1000 * res.totals.a) / (res.totals.a + res.totals.b)) / 10;
      return res;
    }
  }
  throw new Error('no percentage pairing possible in this snapshot');
}

function sideKeys(side) {
  return side.type === 'group' ? side.members.map(key) : [key(side)];
}

// A whole match from a seed. Entities are not repeated within a match.
function buildMatch({ snapshot, mode = 'ranked', difficulty = 'normal', seed, rounds } = {}) {
  if (!MODES.includes(mode)) throw new Error(`unknown mode: ${mode}`);
  difficultyOf(difficulty);
  if (!Number.isInteger(seed) || seed < 0 || seed > 0xffffffff) throw new Error('seed must be a uint32');
  const n = rounds || ROUNDS[mode];
  const rng = mulberry32(seed);
  const seen = new Set();
  const out = [];
  for (let i = 0; i < n; i++) {
    let r;
    try {
      r = mode === 'percentage'
        ? pickPercentage({ snapshot, difficulty, rng, exclude: seen })
        : pickRound({ snapshot, mode, difficulty, rng, exclude: seen });
    } catch {
      // Small snapshots can run out of fresh entities; allow repeats rather than fail.
      r = mode === 'percentage'
        ? pickPercentage({ snapshot, difficulty, rng })
        : pickRound({ snapshot, mode, difficulty, rng });
    }
    for (const k of sideKeys(r.a).concat(sideKeys(r.b))) seen.add(k);
    out.push(Object.assign({ round: i }, r));
  }
  return { seed, mode, difficulty, snapshot: snapshot.generatedAt || null, rounds: out };
}

function randomSeed(rand = Math.random) {
  return Math.floor(rand() * 4294967296) >>> 0;
}

module.exports = {
  DIFFICULTIES, MODES, ROUNDS,
  mulberry32, seedFromString, randomSeed,
  pickRound, pickPercentage, buildMatch, totalOf,
};
