// Fandom Clash numbers: every number a player sees or is paid must be exact. Checks the shipped snapshot
// (character and franchise totals), every matchmaking round (totals, answer, share), client vs server
// scoring (speed-bonus edges, difficulty points), what main hands the renderer, bet payouts and ghost
// replays. A wider sweep (1M+ checks) lives in scratchpad tooling; these are the same checks on fewer seeds.
const { test, after } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { pathToFileURL } = require('node:url');

const mm = require('../tools/clash/matchmaking.js');
const SL = require('../server/clash/src/logic.js');
const clashLib = require('../src/main/clash');
const { Economy } = require('../src/main/economy/economy');

const ROOT = path.join(__dirname, '..');
const load = (p) => JSON.parse(fs.readFileSync(path.join(ROOT, p), 'utf8'));
const FULL = load('src/catalog/clash-snapshot.json');
const SAMPLE = load('tools/clash/sample-snapshot.json');
const SNAPS = [['shipped', FULL], ['sample', SAMPLE]];
const DIFFS = Object.keys(mm.DIFFICULTIES);
const sum = (o) => Object.values(o || {}).reduce((s, v) => s + v, 0);
const clientLogic = () => import(pathToFileURL(path.join(ROOT, 'src/renderer/clash/logic.js')).href);
const TMP = fs.mkdtempSync(path.join(os.tmpdir(), 'kayboro-numbers-'));
after(() => fs.rmSync(TMP, { recursive: true, force: true }));
// round half up to one decimal, in exact integer arithmetic
const exactShare = (a, b) => Number((2000n * BigInt(a) + BigInt(a + b)) / (2n * BigInt(a + b))) / 10;
const entity = (snap, x) => (x.type === 'character' || x.type === 'c' ? snap.characters : snap.franchises).find((e) => e.id === x.id);
const sideTotal = (snap, side) => (side.type === 'group' ? side.members.reduce((s, m) => s + entity(snap, m).total, 0) : entity(snap, side).total);

test('character totals are the sum of their per-site counts; lists are sorted and unique', () => {
  for (const [name, snap] of SNAPS) {
    const ids = new Set();
    let prev = Infinity;
    for (const c of snap.characters) {
      assert.equal(c.total, sum(c.counts), `${name} ${c.id}`);
      assert.ok(Number.isSafeInteger(c.total) && c.total > 0);
      for (const [site, v] of Object.entries(c.counts)) assert.ok(snap.sites.includes(site) && Number.isSafeInteger(v) && v > 0, `${c.id} ${site}`);
      assert.ok(!ids.has(c.id), `duplicate ${c.id}`);
      ids.add(c.id);
      assert.ok(c.total <= prev, `${name} sorted at ${c.id}`);
      prev = c.total;
    }
  }
  for (const c of SAMPLE.characters) assert.deepEqual(c, FULL.characters.find((x) => x.id === c.id), 'the sample is a subset of the shipped build');
});

test('franchise totals follow the documented rule: copyright tag count per site, else the pool characters\' sum', () => {
  for (const f of FULL.franchises) {
    const members = FULL.characters.filter((c) => c.franchise === f.id);
    assert.deepEqual([...f.characters].sort(), members.map((c) => c.id).sort(), `${f.id}: members`);
    assert.equal(f.total, sum(f.counts), `${f.id}: total = sum(counts)`);
    for (const site of FULL.sites) {
      const charSum = members.reduce((s, c) => s + (c.counts[site] || 0), 0);
      if (f.fallback.includes(site)) assert.equal(f.counts[site] || 0, charSum, `${f.id} ${site}: fallback = characters' sum`);
      else assert.ok(f.counts[site] > 0, `${f.id} ${site}: the copyright tag's own count`);
    }
  }
  for (const c of FULL.characters) assert.ok(FULL.franchises.some((f) => f.id === c.franchise), `${c.id}'s franchise is listed`);
  for (const f of SAMPLE.franchises) assert.equal(f.total, FULL.franchises.find((x) => x.id === f.id).total, `sample keeps ${f.id}'s full total`);
});

test('every round of every mode and difficulty carries the snapshot totals; answer is the bigger side; never a tie', () => {
  let rounds = 0;
  for (const [name, snap] of SNAPS) for (const mode of mm.MODES) for (const difficulty of DIFFS) for (let s = 0; s < 40; s++) {
    const seed = (s * 2654435761 + 12345) >>> 0;
    const m = mm.buildMatch({ snapshot: snap, mode, difficulty, seed });
    assert.equal(m.rounds.length, mm.ROUNDS[mode]);
    for (const r of m.rounds) {
      rounds++;
      const ta = sideTotal(snap, r.a), tb = sideTotal(snap, r.b);
      assert.deepEqual(r.totals, { a: ta, b: tb }, `${name} ${mode}/${difficulty}/${seed} r${r.round}`);
      assert.notEqual(ta, tb, 'no ties');
      assert.equal(r.answer, ta > tb ? 'a' : 'b');
      if (mode === 'percentage') assert.equal(r.share, exactShare(ta, tb), `share of ${ta}/${tb}`);
    }
  }
  assert.ok(rounds > 10000);
});

test('share = a/(a+b)*100 rounded half up to one decimal, exactly', () => {
  for (let a = 1; a <= 200; a++) for (let b = 1; b <= 200; b++) assert.equal(Math.round((1000 * a) / (a + b)) / 10, exactShare(a, b), `${a}/${b}`);
  for (const [a, b] of [[1, 7], [1, 15], [3, 5], [33, 7], [123456789, 987654321], [2 ** 40, 3]]) {
    assert.equal(Math.round((1000 * a) / (a + b)) / 10, exactShare(a, b), `${a}/${b}`);
  }
});

test('client and server score the same answers and timings identically (speed-bonus edges, difficulty points)', async () => {
  const CL = await clientLogic();
  for (const d of DIFFS) assert.equal(CL.DIFFICULTY[d].points, Math.round(100 * mm.DIFFICULTIES[d].mult), d);
  const P = { id: 'numbers-test-01', name: 'N' };
  for (const ms of [0, 1, 199, 199.4, 199.5, 200, 201, 1999, 2000, 2000.4, 2000.5, 2001, 2500, 6999, 7000, 7001, 11999, 11999.5, 12000, 12001, 600000, 600001, 3600001, -5, NaN, undefined, 1e12]) {
    const c = CL.cleanAnswers([{ round: 0, pick: 'a', ms }], 1)[0].ms;
    const v = SL.validateRun({ player: P, mode: 'ranked', difficulty: 'easy', seed: 1, answers: [{ round: 0, pick: 'a', ms }] });
    assert.equal(CL.speedBonus(c), SL.speedBonus(v.value.answers[0].ms), `ms=${ms}`);
  }
  assert.deepEqual([199, 200, 2000, 2001, 7000, 11999, 12000].map(CL.speedBonus), [0, 50, 50, 50, 25, 0, 0]);
  let x = 7;
  const rnd = () => ((x = (x * 1103515245 + 12345) >>> 0) / 4294967296);
  for (const [, snap] of SNAPS) for (const difficulty of DIFFS) for (let s = 0; s < 60; s++) {
    const m = mm.buildMatch({ snapshot: snap, mode: 'ranked', difficulty, seed: s * 7919 + 3 });
    const answers = [];
    m.rounds.forEach((r, i) => {
      if (rnd() < 0.1) return;
      const ms = [150, 200, 1999, 2000, 2001, 6999, 7000, 11999, 12000, 30000][Math.floor(rnd() * 10)] + (rnd() < 0.3 ? rnd() : 0);
      answers.push({ round: i, pick: rnd() < 0.6 ? r.answer : r.answer === 'a' ? 'b' : 'a', ms });
    });
    const server = SL.scoreRun(m, SL.validateRun({ player: P, mode: 'ranked', difficulty, seed: m.seed, answers }).value.answers);
    const client = CL.scoreRun(m.rounds.map((r) => ({ a: { total: r.totals.a }, b: { total: r.totals.b } })), CL.cleanAnswers(answers, m.rounds.length), difficulty);
    assert.equal(client.score, server.score, `${difficulty} ${m.seed}`);
    assert.equal(client.correct, server.correct);
    assert.deepEqual(client.rounds.map((r) => r.points), server.details.map((d) => d.points));
  }
});

test('main shows the renderer exactly the snapshot numbers and scores runs like the server', async () => {
  const CL = await clientLogic();
  const dir = path.join(TMP, 'main');
  const eco = new Economy({ dir: path.join(dir, 'kayboro') });
  const c = clashLib.create({ net: { fetch: async () => { throw new Error('offline'); } }, userDataDir: dir, economy: () => eco, bundled: [path.join(ROOT, 'src/catalog/clash-snapshot.json')], serverUrl: '' });
  assert.equal(c.status().snapshot.franchises, FULL.franchises.length, 'no franchise is dropped (ids with / and ? included)');
  const P = { id: 'numbers-test-01', name: 'N' };
  for (const difficulty of DIFFS) for (let k = 0; k < 15; k++) {
    const m = await c.match({ mode: 'ranked', difficulty });
    const ref = mm.buildMatch({ snapshot: FULL, mode: 'ranked', difficulty, seed: m.seed });
    m.rounds.forEach((r, i) => {
      assert.deepEqual([r.a.total, r.b.total], [ref.rounds[i].totals.a, ref.rounds[i].totals.b], `${difficulty} ${m.seed} r${i}`);
      assert.equal(CL.winnerOf(r), ref.rounds[i].answer);
      for (const side of [r.a, r.b]) {
        if (side.type === 'g') {
          assert.equal(side.total, side.members.reduce((t, e) => t + e.total, 0));
          for (const e of side.members) assert.equal(e.total, entity(FULL, e).total);
        } else assert.equal(side.total, entity(FULL, side).total);
      }
    });
    const answers = m.rounds.map((_, i) => ({ round: i, pick: (i * 7 + k) % 3 ? 'a' : 'b', ms: (i * 1733 + k * 911) % 14000 }));
    const res = await c.submitRun({ matchId: m.matchId, answers });
    const server = SL.scoreRun(ref, SL.validateRun({ player: P, mode: 'ranked', difficulty, seed: m.seed, answers }).value.answers);
    assert.deepEqual([res.score, res.correct], [server.score, server.correct]);
  }
  for (let k = 0; k < 24; k++) {
    const p = await c.percentage({ kind: k % 2 ? 'franchises' : 'groups', difficulty: DIFFS[k % 4] });
    const ta = p.a.reduce((t, e) => t + entity(FULL, e).total, 0), tb = p.b.reduce((t, e) => t + entity(FULL, e).total, 0);
    const r = await c.resolvePercent({ matchId: p.matchId, guess: (k * 37) % 101 });
    assert.deepEqual([r.aTotal, r.bTotal, r.actual], [ta, tb, (100 * ta) / (ta + tb)]);
  }
});

test('bet payouts are exact: multipliers, rounding down, caps and refunds', async () => {
  const CL = await clientLogic();
  const eco = new Economy({ dir: path.join(TMP, 'bets', 'kayboro') });
  eco.grant({ coins: 1_000_000 });
  const mults = [...new Set([CL.BET.ghostMultiplier, ...CL.BET.pickMultipliers.filter(Boolean), 1.8, 2.1, 2.4])];
  for (const m of mults) for (let stake = 1; stake <= 500; stake++) {
    const exact = Number((BigInt(stake) * BigInt(Math.round(m * 100))) / 100n);
    assert.equal(CL.payoutOf(stake, { outcome: 'win', multiplier: m }), exact, `payoutOf ${stake} x ${m}`);
    if (stake % 7 && stake !== 30 && stake !== 500) continue; // the economy path on a spread of stakes
    const before = eco.getState().coins;
    const b = eco.placeBet(stake, { game: 'numbers' });
    assert.equal(eco.getState().coins, before - stake);
    const r = eco.settleBet(b.ticket, 'win', m);
    assert.equal(r.payout, exact, `settle ${stake} x ${m}`);
    assert.equal(eco.getState().coins, before - stake + exact);
  }
  for (const [m, want] of [[0.5, 100], [1, 100], [5, 500], [7, 500], [4.999, 499]]) {
    const b = eco.placeBet(100, { game: 'numbers' });
    assert.equal(eco.settleBet(b.ticket, 'win', m).payout, want, `x${m} capped to 1..5`);
  }
  for (const [outcome, want] of [['loss', 0], ['push', 77], ['cancel', 77]]) {
    const before = eco.getState().coins;
    const b = eco.placeBet(77, { game: 'numbers' });
    assert.equal(eco.settleBet(b.ticket, outcome, 3).payout, want);
    assert.equal(eco.getState().coins, before - 77 + want);
    assert.equal(eco.settleBet(b.ticket, 'win', 2).ok, false, 'a ticket settles once');
  }
  for (const [a, b, guess, outcome, mult] of [[60, 40, 60, 'win', 2.4], [60, 40, 57, 'win', 2.4], [60, 40, 63, 'win', 2.4], [60, 40, 56.9, 'win', 2.1],
    [60, 40, 70, 'win', 2.1], [60, 40, 70.1, 'win', 1.8], [60, 40, 50, 'push', 1], [50, 50, 70, 'push', 1], [60, 40, 49, 'loss', 0], [1, 2, 0, 'win', 1.8]]) {
    const r = CL.percentOutcome({ aTotal: a, bTotal: b, guess });
    assert.deepEqual([r.outcome, r.multiplier], [outcome, mult], `${a}/${b} guess ${guess}`);
  }
  assert.deepEqual([1, 2, 3, 4, 5].map(CL.pickMultiplier), [1.8, 2.6, 3.4, 4, 4]);
  assert.deepEqual(CL.ghostOutcome(10, 10), { outcome: 'push', multiplier: 1 });
  assert.deepEqual(CL.ghostOutcome(11, 10), { outcome: 'win', multiplier: 1.9 });
});

test('a ghost replay reproduces the original rounds from its seed, and its score', () => {
  for (const difficulty of DIFFS) for (let s = 0; s < 40; s++) {
    const seed = (s * 40503 + 17) >>> 0;
    const stored = JSON.parse(JSON.stringify(mm.buildMatch({ snapshot: FULL, mode: 'ranked', difficulty, seed }).rounds));
    const again = mm.buildMatch({ snapshot: JSON.parse(JSON.stringify(FULL)), mode: 'ranked', difficulty, seed }); // fresh object, no memo
    assert.deepEqual(again.rounds, stored, `${difficulty} ${seed}`);
    const answers = stored.map((r, i) => ({ round: i, pick: i % 3 ? r.answer : 'a', ms: 1000 + i * 900 }));
    assert.equal(SL.scoreRun({ difficulty, rounds: stored }, answers).score, SL.scoreRun(again, answers).score);
  }
});
