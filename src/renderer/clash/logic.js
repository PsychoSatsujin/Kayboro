// Fandom Clash: pure game rules shared by the renderer (live HUD), the main process (authoritative local
// scores and bet payouts, loaded with dynamic import()) and the unit tests. No DOM, no Node APIs.
//
// The game: "which one has more posts across all booru sites?". A Vs run is ROUNDS higher/lower picks;
// counts include every rating, but only the snapshot's SFW image is ever shown.

export const ROUNDS = 10;
export const MODES = ['ranked', 'local', 'percent', 'ghost'];
export const DIFFICULTIES = ['easy', 'normal', 'hard', 'master'];
// Points per right answer = 100 x the difficulty multiplier of tools/clash/matchmaking.js (1, 1.5, 2, 3),
// exactly as the Clash server scores runs (server/clash/src/logic.js), so offline and online scores agree.
export const DIFFICULTY = {
  easy: { label: 'Easy', blurb: 'Clear favourites', points: 100 },
  normal: { label: 'Normal', blurb: 'Fair fights', points: 150 },
  hard: { label: 'Hard', blurb: 'Close calls', points: 200 },
  master: { label: 'Master', blurb: 'Photo finishes', points: 300 },
};
export const MODE = {
  ranked: { label: 'Ranked Vs', blurb: 'Climb the global board. Characters, franchises, or both.' },
  local: { label: 'Local Ranking', blurb: 'A board just for your friends: make or join a group code.' },
  percent: { label: 'Percentage Vs', blurb: 'Slide your guess, bet a few coins, see who takes the bigger slice.' },
  ghost: { label: 'Ghost Battle', blurb: "Race someone's recorded run, pick by pick." },
};
export const SPEED = { min: 200, full: 2000, zero: 12000, max: 50 }; // a small bonus for quick picks, never a penalty
export const BET = { ghostMultiplier: 1.9, pickMultipliers: [0, 1.8, 2.6, 3.4, 4, 4], maxOpponents: 5 };

export const clamp = (n, lo, hi) => Math.min(hi, Math.max(lo, n));
export const isDifficulty = d => DIFFICULTIES.includes(d);
export const isMode = m => MODES.includes(m);

// ---- Seeds ----------------------------------------------------------------

/** 32-bit FNV-1a hash of a string (seeds from text, stable avatar picks). */
export function hash32(s) {
  let h = 0x811c9dc5;
  for (const ch of String(s)) { h ^= ch.codePointAt(0); h = Math.imul(h, 0x01000193); }
  return h >>> 0;
}
/** Mulberry32: a small seeded rng returning [0, 1). Same seed, same sequence (ghost replays). */
export function rng(seed) {
  let a = (typeof seed === 'number' ? seed : hash32(seed)) >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
export const newSeed = (r = Math.random) => Math.floor(r() * 2 ** 31).toString(36) + Math.floor(r() * 2 ** 31).toString(36);

// ---- Vs scoring --------------------------------------------------------------

/** The bigger side of a round { a: { total }, b: { total } } ('b' on an exact tie, as the server does). */
export const winnerOf = round => ((Number(round?.a?.total) || 0) > (Number(round?.b?.total) || 0) ? 'a' : 'b');
/** pick is 'a' or 'b'. */
export const isCorrect = (round, pick) => (pick === 'a' || pick === 'b') && pick === winnerOf(round);
/** Up to 50 extra points for a quick right answer: full under 2 s, fading to 0 at 12 s (none under 200 ms). */
export function speedBonus(ms) {
  if (!(ms >= SPEED.min)) return 0;
  if (ms <= SPEED.full) return SPEED.max;
  if (ms >= SPEED.zero) return 0;
  return Math.round(SPEED.max * (1 - (ms - SPEED.full) / (SPEED.zero - SPEED.full)));
}

/**
 * Scores a run like the server: each right answer is worth the difficulty's points plus the speed bonus;
 * a miss is worth 0 and costs nothing else (no lives, no streak multiplier, every run goes the distance).
 * The streak (`combo`) is tracked for the show only. answers: [{ round, pick, ms }] (0-based round index).
 */
export function scoreRun(rounds, answers, difficulty = 'normal') {
  const base = DIFFICULTY[difficulty]?.points || DIFFICULTY.normal.points;
  const byRound = new Map();
  for (const a of answers || []) if (a && Number.isInteger(a.round) && !byRound.has(a.round)) byRound.set(a.round, a);
  let score = 0, correct = 0, streak = 0, bestCombo = 0;
  const per = (rounds || []).map((r, i) => {
    const ans = byRound.get(i);
    const ok = !!ans && isCorrect(r, ans.pick);
    streak = ok ? streak + 1 : 0;
    bestCombo = Math.max(bestCombo, streak);
    const bonus = ok ? speedBonus(ans.ms) : 0;
    const points = ok ? base + bonus : 0;
    score += points;
    if (ok) correct++;
    return { correct: ok, points, bonus, combo: streak, pick: ans?.pick ?? null, ms: ans?.ms ?? null };
  });
  return { score, correct, total: per.length, bestCombo, rounds: per };
}
export const maxScore = (n = ROUNDS, difficulty = 'normal') => n * ((DIFFICULTY[difficulty]?.points || DIFFICULTY.normal.points) + SPEED.max);

/** Sanitised answers for storage or upload: one per round, pick a|b, ms a non-negative integer. */
export function cleanAnswers(answers, n = ROUNDS) {
  const out = [], seen = new Set();
  for (const a of Array.isArray(answers) ? answers : []) {
    if (!a || !Number.isInteger(a.round) || a.round < 0 || a.round >= n || seen.has(a.round)) continue;
    if (a.pick !== 'a' && a.pick !== 'b') continue;
    seen.add(a.round);
    out.push({ round: a.round, pick: a.pick, ms: clamp(Math.round(Number(a.ms) || 0), 0, 3600e3) });
  }
  return out.sort((x, y) => x.round - y.round);
}

// ---- Ghosts ----------------------------------------------------------------

/** Cumulative time (ms from the run's start) at which the ghost answered each round. */
export function ghostTimeline(answers) {
  let t = 0;
  return cleanAnswers(answers, 1e6).map(a => (t += Math.max(250, a.ms)));
}
/** How far along the ghost is after `elapsed` ms: rounds done (fractional between answers, for the marker). */
export function ghostProgress(answers, elapsed) {
  const tl = ghostTimeline(answers);
  if (!tl.length) return 0;
  let prev = 0;
  for (let i = 0; i < tl.length; i++) {
    if (elapsed < tl[i]) return i + clamp((elapsed - prev) / (tl[i] - prev), 0, 0.95);
    prev = tl[i];
  }
  return tl.length;
}
/** Beat the ghost: win, loss or push (equal scores refund a bet). */
export function ghostOutcome(mine, theirs) {
  if (mine === theirs) return { outcome: 'push', multiplier: 1 };
  return mine > theirs ? { outcome: 'win', multiplier: BET.ghostMultiplier } : { outcome: 'loss', multiplier: 0 };
}

// ---- Percentage Vs ------------------------------------------------------------

export const groupTotal = list => (list || []).reduce((s, e) => s + (Number(e?.total) || 0), 0);
/** Side A's share of the combined posts, in percent (50 when both are empty). */
export function share(a, b) {
  const s = (Number(a) || 0) + (Number(b) || 0);
  return s > 0 ? (100 * (Number(a) || 0)) / s : 50;
}
/**
 * Forced group-vs-group: the player slides a guess of A's share. Picking the right side wins; a close guess
 * pays a little extra. A guess of exactly 50 (no side) or an exact 50/50 refunds.
 */
export function percentOutcome({ aTotal, bTotal, guess }) {
  const actual = share(aTotal, bTotal), g = clamp(Number(guess), 0, 100);
  const off = Math.abs(actual - g); // how far the guess was (not named `error`: IPC results use that for failures)
  if (!Number.isFinite(g) || g === 50 || actual === 50) return { outcome: 'push', multiplier: 1, actual, off };
  const won = (g > 50) === (actual > 50);
  if (!won) return { outcome: 'loss', multiplier: 0, actual, off };
  const bonus = off <= 3 ? 0.6 : off <= 10 ? 0.3 : 0;
  return { outcome: 'win', multiplier: Math.round((1.8 + bonus) * 100) / 100, actual, off, bonus };
}
/** Payout multiplier for 1-vs-many with k opponents. */
export const pickMultiplier = k => BET.pickMultipliers[clamp(Math.floor(k) || 0, 0, BET.pickMultipliers.length - 1)];
/** Pick-your-own 1-vs-many: the champion has to out-post everyone they chose to face, combined. */
export function pickOutcome({ champion, opponents }) {
  const c = Number(champion?.total ?? champion) || 0;
  const k = (opponents || []).length;
  const o = (opponents || []).reduce((s, x) => s + (Number(x?.total ?? x) || 0), 0);
  const actual = share(c, o);
  if (!k) return { outcome: 'push', multiplier: 1, actual };
  if (c === o) return { outcome: 'push', multiplier: 1, actual };
  return c > o ? { outcome: 'win', multiplier: pickMultiplier(k), actual } : { outcome: 'loss', multiplier: 0, actual };
}
/** Coins paid back for a settled stake (what economy.settleBet pays: floor(stake * multiplier)). */
export const payoutOf = (stake, { outcome, multiplier }) => (outcome === 'win' ? Math.floor(stake * multiplier) : outcome === 'push' ? stake : 0);

// ---- Fallback matchmaking ----------------------------------------------------------
// Used only when tools/clash/matchmaking.js (the real one) is not available. Popularity closeness by
// difficulty, as a ratio band of the larger total over the smaller: never a giant against an unknown.

export const BANDS = { easy: [2.2, 6], normal: [1.4, 2.6], hard: [1.12, 1.5], master: [1, 1.15] };

const sortedPool = list => list.filter(e => e.total > 0).sort((x, y) => x.total - y.total);
function pickPair(pool, difficulty, r, used) {
  const [lo, hi] = BANDS[difficulty] || BANDS.normal;
  for (let tries = 0; tries < 200; tries++) {
    const a = pool[Math.floor(r() * pool.length)];
    if (!a || used.has(a.id)) continue;
    const cands = pool.filter(b => b.id !== a.id && !used.has(b.id) && (b.franchise == null || b.franchise !== a.franchise || tries > 120)).filter(b => {
      const ratio = Math.max(a.total, b.total) / Math.min(a.total, b.total);
      return ratio >= lo && ratio <= hi;
    });
    if (!cands.length) continue;
    const b = cands[Math.floor(r() * cands.length)];
    return r() < 0.5 ? [a, b] : [b, a];
  }
  return null;
}
/** Round kinds by mode: Ranked is mostly character vs character, with some franchise and mixed rounds. */
export function roundKind(r) {
  const x = r();
  return x < 0.7 ? 'cc' : x < 0.85 ? 'ff' : 'cf';
}
/** n rounds of { kind, a, b } from a snapshot { characters, franchises }. Entities are the snapshot objects. */
export function fallbackRounds(snapshot, { difficulty = 'normal', seed = 'x', n = ROUNDS } = {}) {
  const r = rng(`${seed}|${difficulty}`);
  const chars = sortedPool(snapshot?.characters || []), fr = sortedPool(snapshot?.franchises || []);
  const used = new Set(), out = [];
  for (let i = 0; i < n * 3 && out.length < n; i++) {
    let kind = roundKind(r);
    if (fr.length < 2 && kind !== 'cc') kind = 'cc';
    const pool = kind === 'cc' ? chars : kind === 'ff' ? fr : [...chars, ...fr].sort((x, y) => x.total - y.total);
    let pair = pickPair(pool, difficulty, r, used);
    if (pair && kind === 'cf' && (pair[0].characters ? 1 : 0) + (pair[1].characters ? 1 : 0) !== 1) pair = pickPair(pool, difficulty, r, used) || pair;
    if (!pair) continue;
    used.add(pair[0].id); used.add(pair[1].id);
    out.push({ kind: pair[0].characters && pair[1].characters ? 'ff' : pair[0].characters || pair[1].characters ? 'cf' : 'cc', a: pair[0], b: pair[1] });
  }
  return out;
}
/** Two groups of similar popularity for forced Percentage Vs: characters (kind 'groups') or franchises. */
export function fallbackPercentage(snapshot, { difficulty = 'normal', seed = 'x', kind = 'groups', size = 3 } = {}) {
  const r = rng(`${seed}|pct|${kind}|${difficulty}`);
  const pool = sortedPool(kind === 'franchises' ? snapshot?.franchises || [] : snapshot?.characters || []);
  const n = kind === 'franchises' ? 1 : size;
  if (pool.length < n * 2) return null;
  const [lo, hi] = BANDS[difficulty] || BANDS.normal;
  for (let tries = 0; tries < 300; tries++) {
    const start = Math.floor(r() * Math.max(1, pool.length - n * 2 * 3));
    const window = pool.slice(start, start + Math.max(n * 2 * 3, 12));
    const picked = [];
    while (picked.length < n * 2 && picked.length < window.length) {
      const e = window[Math.floor(r() * window.length)];
      if (!picked.includes(e)) picked.push(e);
    }
    const a = picked.filter((_, i) => i % 2 === 0), b = picked.filter((_, i) => i % 2 === 1);
    const ta = groupTotal(a), tb = groupTotal(b);
    if (!ta || !tb) continue;
    const ratio = Math.max(ta, tb) / Math.min(ta, tb);
    if (ratio <= hi * 1.2 && (ratio >= lo || tries > 200)) return { kind, a, b };
  }
  return null;
}
/** Opponents a champion may pick from for 1-vs-many: `count` characters near its popularity, by difficulty. */
export function fallbackOpponents(snapshot, champion, { difficulty = 'normal', seed = 'x', count = 12 } = {}) {
  const r = rng(`${seed}|opp|${champion?.id}|${difficulty}`);
  const [, hi] = BANDS[difficulty] || BANDS.normal;
  const c = Number(champion?.total) || 0;
  const pool = sortedPool(snapshot?.characters || []).filter(e => e.id !== champion?.id);
  // Close enough to make it a contest; widen the band until there are enough to choose from.
  for (let band = hi * 2.5; band < 1e6; band *= 2) {
    const near = pool.filter(e => Math.max(e.total, c) / Math.max(1, Math.min(e.total, c)) <= band);
    if (near.length >= Math.min(count, pool.length)) {
      const out = [];
      const copy = [...near];
      while (out.length < count && copy.length) out.push(copy.splice(Math.floor(r() * copy.length), 1)[0]);
      return out;
    }
  }
  return pool.slice(0, count);
}

// ---- Presentation helpers -------------------------------------------------------

/** Ease-out for the rolling counter: value at t in [0, 1]. */
export const rollValue = (from, to, t) => Math.round(from + (to - from) * (1 - Math.pow(1 - clamp(t, 0, 1), 3)));
const NF = new Intl.NumberFormat('en-US');
export const fmtCount = n => NF.format(Math.max(0, Math.round(Number(n) || 0)));
export const fmtShort = n => {
  const v = Math.max(0, Number(n) || 0);
  return v >= 1e6 ? `${(v / 1e6).toFixed(v >= 1e7 ? 0 : 1)}M` : v >= 1e4 ? `${Math.round(v / 1e3)}K` : NF.format(Math.round(v));
};
/** Friendly, never-scolding line after a miss. */
export const MISS_LINES = ['So close!', 'Plot twist!', 'Fans are full of surprises', 'Ooh, unexpected', 'That one was sneaky', 'Nobody saw that coming'];
export const HIT_LINES = ['Nice!', 'Called it!', 'Big brain', 'Spot on', 'Fan instinct', 'Clean read'];
export const lineFor = (ok, i) => (ok ? HIT_LINES : MISS_LINES)[Math.abs(i) % (ok ? HIT_LINES : MISS_LINES).length];
