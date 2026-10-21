// Fandom Clash server logic that does not touch I/O: request validation, run scoring, group codes
// and the rate-limit window. CommonJS so node:test can require it directly; the Worker bundles it.
'use strict';

const { DIFFICULTIES, MODES } = require('../../../tools/clash/matchmaking.js');

const LIMITS = Object.freeze({
  nameMax: 24,
  answerMsMax: 10 * 60 * 1000,
  humanMsMin: 200, // faster than this earns no speed bonus (still scores if correct)
  leaderboardMax: 100,
});

// ---------------------------------------------------------------------------------------------
// Validation
const PLAYER_ID = /^[A-Za-z0-9_-]{8,64}$/;
const GROUP_CODE = /^[A-Z]{3,6}-\d{2,3}$/;

function cleanName(name) {
  if (typeof name !== 'string') return null;
  // Strip control / bidi-override characters, collapse whitespace.
  const s = name.replace(/[\u0000-\u001f\u007f-\u009f​-‏‪-‮⁦-⁩]/g, '')
    .replace(/\s+/g, ' ').trim();
  if (!s) return null;
  return Array.from(s).slice(0, LIMITS.nameMax).join('');
}
const normGroup = (g) => (typeof g === 'string' ? g.trim().toUpperCase() : '');

// Validates POST /runs. Returns { ok: true, value } or { ok: false, error }.
function validateRun(body) {
  if (!body || typeof body !== 'object') return { ok: false, error: 'body must be a JSON object' };
  const p = body.player || {};
  if (typeof p.id !== 'string' || !PLAYER_ID.test(p.id)) return { ok: false, error: 'player.id must be 8-64 chars of [A-Za-z0-9_-]' };
  const name = cleanName(p.name);
  if (!name) return { ok: false, error: 'player.name is required' };
  const kaybo = p.kayboId == null ? null : String(p.kayboId).slice(0, 64);
  if (!MODES.includes(body.mode)) return { ok: false, error: `mode must be one of ${MODES.join(', ')}` };
  if (!DIFFICULTIES[body.difficulty]) return { ok: false, error: `difficulty must be one of ${Object.keys(DIFFICULTIES).join(', ')}` };
  const seed = body.seed;
  if (!Number.isInteger(seed) || seed < 0 || seed > 0xffffffff) return { ok: false, error: 'seed must be a uint32' };
  const group = body.group == null || body.group === '' ? null : normGroup(body.group);
  if (group != null && !GROUP_CODE.test(group)) return { ok: false, error: 'group must look like KITE-42' };
  if (body.mode === 'local' && !group) return { ok: false, error: 'local mode needs a group code' };
  let ghostOf = null;
  if (body.mode === 'ghost') {
    if (!Number.isInteger(body.ghostOf) || body.ghostOf <= 0) return { ok: false, error: 'ghost mode needs ghostOf (a run id)' };
    ghostOf = body.ghostOf;
  }
  if (!Array.isArray(body.answers) || body.answers.length > 50) return { ok: false, error: 'answers must be an array (max 50)' };
  const seen = new Set();
  const answers = [];
  for (const a of body.answers) {
    if (!a || !Number.isInteger(a.round) || a.round < 0 || a.round >= 50) return { ok: false, error: 'answer.round must be an integer index' };
    if (seen.has(a.round)) return { ok: false, error: `duplicate answer for round ${a.round}` };
    seen.add(a.round);
    const okPick = a.pick === 'a' || a.pick === 'b' || (typeof a.pick === 'number' && Number.isFinite(a.pick) && a.pick >= 0 && a.pick <= 100);
    if (!okPick) return { ok: false, error: "answer.pick must be 'a', 'b' or a number 0-100" };
    const ms = Number.isFinite(a.ms) ? Math.max(0, Math.min(LIMITS.answerMsMax, Math.round(a.ms))) : LIMITS.answerMsMax;
    answers.push({ round: a.round, pick: a.pick, ms });
  }
  answers.sort((x, y) => x.round - y.round);
  return {
    ok: true,
    value: {
      player: { id: p.id, name, kayboId: kaybo },
      mode: body.mode, difficulty: body.difficulty, group, seed, ghostOf, answers,
      snapshot: typeof body.snapshot === 'string' ? body.snapshot.slice(0, 64) : null,
    },
  };
}

// ---------------------------------------------------------------------------------------------
// Scoring
//
// Binary round (pick 'a' | 'b'): correct = 100 x difficulty multiplier, plus a small speed bonus
// of up to 50 (full under 2 s, fading to 0 at 12 s; none under 200 ms). Wrong or unanswered = 0.
// There is no game over and no streak multiplier: every match is a fixed number of rounds, so a
// miss costs one round and nothing more (rankings are meant to be low pressure).
//
// Percentage round: pick 'a' | 'b' scores like a binary round on the winning side. A numeric pick
// is the predicted share (0-100) of side a: right side = 100 x multiplier, plus up to 100
// closeness points (full at an exact guess, 0 at 25 points or more off), plus the speed bonus.
// A numeric pick of exactly 50 picks no side.
function speedBonus(ms) {
  if (!(ms >= LIMITS.humanMsMin)) return 0;
  if (ms <= 2000) return 50;
  if (ms >= 12000) return 0;
  return Math.round(50 * (1 - (ms - 2000) / 10000));
}

function scoreRound(round, answer, mult) {
  if (!answer) return { round: round.round, correct: false, points: 0, ms: null };
  const winner = round.answer;
  let side = answer.pick;
  let closeness = 0;
  if (typeof answer.pick === 'number') {
    side = answer.pick > 50 ? 'a' : answer.pick < 50 ? 'b' : null;
    if (typeof round.share === 'number') {
      closeness = Math.round(100 * Math.max(0, 1 - Math.abs(answer.pick - round.share) / 25));
    }
  }
  const correct = side === winner;
  const points = correct ? Math.round(100 * mult) + speedBonus(answer.ms) + closeness : 0;
  return { round: round.round, correct, points, ms: answer.ms };
}

// match: output of matchmaking.buildMatch (or the stored rounds of a ghost run).
function scoreRun(match, answers) {
  const cfg = DIFFICULTIES[match.difficulty];
  if (!cfg) throw new Error('bad difficulty');
  const byRound = new Map((answers || []).map((a) => [a.round, a]));
  const details = match.rounds.map((r, i) => scoreRound(Object.assign({ round: i }, r), byRound.get(r.round ?? i), cfg.mult));
  const score = details.reduce((s, d) => s + d.points, 0);
  const correct = details.filter((d) => d.correct).length;
  const durationMs = details.reduce((s, d) => s + (d.ms || 0), 0);
  const extra = (answers || []).filter((a) => a.round >= match.rounds.length).length;
  return { score, correct, rounds: match.rounds.length, durationMs, details, ignoredAnswers: extra };
}

function ghostOutcome(mine, theirs) {
  if (mine > theirs) return 'win';
  if (mine < theirs) return 'lose';
  return 'draw';
}

// ---------------------------------------------------------------------------------------------
// Group codes: WORD-NN, easy to read aloud (no look-alike words, no offensive combos).
const WORDS = [
  'KITE', 'MOON', 'STAR', 'FERN', 'COMET', 'TIDE', 'PIXEL', 'LOTUS', 'MAPLE', 'CEDAR', 'EMBER', 'FROST',
  'ORBIT', 'RIVER', 'SPARK', 'NOVA', 'PANDA', 'OTTER', 'RAVEN', 'FINCH', 'CORAL', 'AMBER', 'JADE', 'ONYX',
  'BLAZE', 'CLOUD', 'DUNE', 'GROVE', 'HAVEN', 'IRIS', 'LYNX', 'MANGO', 'OPAL', 'PLUM', 'QUILL', 'ROBIN',
  'SAGE', 'TULIP', 'VELA', 'WREN', 'YUZU', 'ZEPHYR', 'BREEZE', 'CANDY', 'DAISY', 'ECHO', 'FABLE', 'GLOW',
];
// 48 words x 90 two-digit numbers is only 4,320 codes; once those get crowded the caller asks for a
// three-digit one (48 x 900 more), so making a group never starts failing as the table grows.
function groupCode(rand = Math.random, wide = false) {
  const w = WORDS[Math.floor(rand() * WORDS.length)];
  const n = wide ? 100 + Math.floor(rand() * 900) : 10 + Math.floor(rand() * 90);
  return `${w}-${n}`;
}

// Fixed-window rate limit bucket id: same value for every request inside one window.
const windowOf = (nowMs, windowSec) => Math.floor(nowMs / 1000 / windowSec);

function clampLimit(v, def = 25) {
  const n = parseInt(v, 10);
  if (!Number.isFinite(n) || n <= 0) return def;
  return Math.min(LIMITS.leaderboardMax, n);
}

module.exports = {
  LIMITS, PLAYER_ID, GROUP_CODE, WORDS,
  cleanName, normGroup, validateRun, speedBonus, scoreRound, scoreRun, ghostOutcome,
  groupCode, windowOf, clampLimit,
};
