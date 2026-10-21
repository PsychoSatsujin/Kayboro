// Unit tests for Fandom Clash's pure logic: src/renderer/clash/logic.js (scoring, combos, ghosts,
// Percentage Vs maths, fallback matchmaking) and src/renderer/clash/pixel.js (the pixel-art icon pipeline).
const { test, before } = require('node:test');
const assert = require('node:assert/strict');
const SNAP = require('./fixtures/clash-snapshot.json');

let L, P;
before(async () => { L = await import('../src/renderer/clash/logic.js'); P = await import('../src/renderer/clash/pixel.js'); });

const R = (a, b) => ({ a: { total: a }, b: { total: b } });

test('isCorrect: the bigger side wins (b on an exact tie, like the server); junk picks are wrong', () => {
  assert.equal(L.isCorrect(R(10, 5), 'a'), true);
  assert.equal(L.isCorrect(R(10, 5), 'b'), false);
  assert.equal(L.isCorrect(R(3, 9), 'b'), true);
  assert.equal(L.isCorrect(R(7, 7), 'b'), true);
  assert.equal(L.isCorrect(R(7, 7), 'a'), false);
  assert.equal(L.isCorrect(R(10, 5), 'left'), false);
  assert.equal(L.winnerOf(R(1, 2)), 'b');
});

test('speed bonus: up to 50 for quick picks, fading to 0 at 12 s, none under 200 ms', () => {
  assert.deepEqual([undefined, 100, 199, 200, 2000, 7000, 12000, 60000].map(L.speedBonus), [0, 0, 0, 50, 50, 25, 0, 0]);
});

test('scoreRun: difficulty points plus speed bonus; a miss scores 0 and only resets the streak', () => {
  const rounds = [R(2, 1), R(2, 1), R(2, 1), R(1, 2), R(2, 1)];
  const answers = ['a', 'a', 'a', 'a', 'a'].map((pick, round) => ({ round, pick, ms: 1000 }));
  const s = L.scoreRun(rounds, answers, 'normal');
  assert.equal(s.score, 4 * (150 + 50));
  assert.deepEqual([s.correct, s.total, s.bestCombo], [4, 5, 3]);
  assert.deepEqual(s.rounds.map((r) => r.combo), [1, 2, 3, 0, 1]);
  assert.deepEqual(s.rounds.map((r) => r.points), [200, 200, 200, 0, 200]);
  assert.equal(L.scoreRun(rounds, answers, 'master').rounds[0].points, 350);
  assert.equal(L.scoreRun(rounds, answers, 'nonsense').rounds[0].points, 200);
});

test('scoreRun ignores duplicate and missing answers; maxScore is a perfect quick run', () => {
  const rounds = [R(2, 1), R(2, 1)];
  const s = L.scoreRun(rounds, [{ round: 0, pick: 'a' }, { round: 0, pick: 'b' }], 'easy');
  assert.deepEqual([s.score, s.correct], [100, 1]);
  assert.equal(L.maxScore(10, 'normal'), 2000);
  assert.equal(L.maxScore(10, 'master'), 3500);
});

test('local scoring matches the Clash server on real matchmaking output', () => {
  const mm = require('../tools/clash/matchmaking.js');
  const server = require('../server/clash/src/logic.js');
  const r = L.rng('cross-check');
  for (const difficulty of L.DIFFICULTIES) {
    for (let k = 0; k < 6; k++) {
      const seed = Math.floor(r() * 2 ** 32);
      const match = mm.buildMatch({ snapshot: SNAP, mode: 'ranked', difficulty, seed });
      const answers = match.rounds.map((_, round) => ({ round, pick: r() < 0.5 ? 'a' : 'b', ms: Math.floor(r() * 15000) }));
      const mine = L.scoreRun(match.rounds.map((x) => ({ a: { total: x.totals.a }, b: { total: x.totals.b } })), answers, difficulty);
      const theirs = server.scoreRun(match, answers);
      assert.equal(mine.score, theirs.score, `${difficulty} seed ${seed}`);
      assert.equal(mine.correct, theirs.correct);
    }
  }
});

test('cleanAnswers keeps one valid answer per round in order', () => {
  const c = L.cleanAnswers([{ round: 2, pick: 'b', ms: 12.6 }, { round: 0, pick: 'a', ms: -4 }, { round: 0, pick: 'b' }, { round: 11, pick: 'a' }, { round: 1, pick: 'x' }, null, { round: 1.5, pick: 'a' }], 10);
  assert.deepEqual(c, [{ round: 0, pick: 'a', ms: 0 }, { round: 2, pick: 'b', ms: 13 }]);
});

test('rng is deterministic per seed', () => {
  const a = L.rng('seed-1'), b = L.rng('seed-1'), c = L.rng('seed-2');
  const xs = [a(), a(), a()];
  assert.deepEqual(xs, [b(), b(), b()]);
  assert.notDeepEqual(xs, [c(), c(), c()]);
  assert.ok(xs.every((x) => x >= 0 && x < 1));
});

test('ghost timeline and progress follow the recorded timing', () => {
  const ans = [{ round: 0, pick: 'a', ms: 1000 }, { round: 1, pick: 'b', ms: 2000 }, { round: 2, pick: 'a', ms: 100 }];
  assert.deepEqual(L.ghostTimeline(ans), [1000, 3000, 3250]); // very fast picks count as 250 ms
  assert.equal(L.ghostProgress(ans, 0), 0);
  assert.equal(L.ghostProgress(ans, 500), 0.5);
  assert.equal(L.ghostProgress(ans, 2000), 1.5);
  assert.equal(L.ghostProgress(ans, 99999), 3);
  assert.deepEqual(L.ghostOutcome(10, 5), { outcome: 'win', multiplier: L.BET.ghostMultiplier });
  assert.equal(L.ghostOutcome(5, 10).outcome, 'loss');
  assert.equal(L.ghostOutcome(7, 7).outcome, 'push');
});

test('share and percentOutcome: side, closeness bonus, pushes', () => {
  assert.equal(L.share(3, 1), 75);
  assert.equal(L.share(0, 0), 50);
  assert.equal(L.groupTotal([{ total: 2 }, { total: 3 }, {}]), 5);
  const near = L.percentOutcome({ aTotal: 62, bTotal: 38, guess: 60 });
  assert.deepEqual([near.outcome, near.multiplier], ['win', 2.4]);
  assert.equal(L.percentOutcome({ aTotal: 62, bTotal: 38, guess: 55 }).multiplier, 2.1);
  assert.equal(L.percentOutcome({ aTotal: 62, bTotal: 38, guess: 90 }).multiplier, 1.8);
  assert.equal(L.percentOutcome({ aTotal: 62, bTotal: 38, guess: 40 }).outcome, 'loss');
  assert.equal(L.percentOutcome({ aTotal: 62, bTotal: 38, guess: 50 }).outcome, 'push');
  assert.equal(L.percentOutcome({ aTotal: 5, bTotal: 5, guess: 70 }).outcome, 'push');
  assert.equal(L.payoutOf(100, near), 240);
  assert.equal(L.payoutOf(100, { outcome: 'push' }), 100);
  assert.equal(L.payoutOf(100, { outcome: 'loss' }), 0);
});

test('pickOutcome: the champion must beat everyone chosen, combined; more opponents pay more', () => {
  const w = L.pickOutcome({ champion: { total: 100 }, opponents: [{ total: 40 }, { total: 50 }] });
  assert.deepEqual([w.outcome, w.multiplier], ['win', 2.6]);
  assert.ok(Math.abs(w.actual - (100 / 190) * 100) < 1e-9);
  assert.equal(L.pickOutcome({ champion: { total: 100 }, opponents: [{ total: 60 }, { total: 50 }] }).outcome, 'loss');
  assert.equal(L.pickOutcome({ champion: { total: 100 }, opponents: [{ total: 100 }] }).outcome, 'push');
  assert.equal(L.pickOutcome({ champion: { total: 100 }, opponents: [] }).outcome, 'push');
  assert.deepEqual([1, 2, 3, 4, 5].map(L.pickMultiplier), [1.8, 2.6, 3.4, 4, 4]);
});

test('fallback matchmaking: ten rounds, no repeats, popularity close by difficulty, deterministic', () => {
  for (const d of L.DIFFICULTIES) {
    const r = L.fallbackRounds(SNAP, { difficulty: d, seed: 's' });
    assert.equal(r.length, L.ROUNDS, d);
    const ids = r.flatMap((x) => [x.a.id, x.b.id]);
    assert.equal(new Set(ids).size, ids.length, `${d}: no entity twice`);
    const [, hi] = L.BANDS[d];
    for (const x of r) assert.ok(Math.max(x.a.total, x.b.total) / Math.min(x.a.total, x.b.total) <= hi, `${d}: close enough`);
    assert.deepEqual(L.fallbackRounds(SNAP, { difficulty: d, seed: 's' }).map((x) => x.a.id), r.map((x) => x.a.id));
  }
  const easy = L.fallbackRounds(SNAP, { difficulty: 'easy', seed: 'x' });
  assert.ok(easy.every((x) => Math.max(x.a.total, x.b.total) / Math.min(x.a.total, x.b.total) <= 6), 'never a giant against an unknown');
});

test('fallback Percentage Vs groups and 1-vs-many opponents', () => {
  const g = L.fallbackPercentage(SNAP, { difficulty: 'normal', seed: 'p' });
  assert.equal(g.a.length, 3);
  assert.equal(g.b.length, 3);
  assert.equal(new Set([...g.a, ...g.b].map((e) => e.id)).size, 6);
  const f = L.fallbackPercentage(SNAP, { kind: 'franchises', seed: 'p' });
  assert.ok(f.a[0].characters && f.b[0].characters);
  const champ = SNAP.characters[0];
  const opp = L.fallbackOpponents(SNAP, champ, { seed: 'o', count: 12 });
  assert.equal(opp.length, 12);
  assert.ok(!opp.some((o) => o.id === champ.id));
});

test('fmt helpers', () => {
  assert.equal(L.fmtCount(1234567.4), '1,234,567');
  assert.equal(L.fmtShort(1234567), '1.2M');
  assert.equal(L.fmtShort(45678), '46K');
  assert.equal(L.rollValue(0, 100, 0), 0);
  assert.equal(L.rollValue(0, 100, 1), 100);
  assert.ok(L.rollValue(0, 100, 0.5) > 50); // ease-out
});

// ---- pixel.js on synthetic images ----

const solid = (w, h, f) => {
  const a = new Uint8ClampedArray(w * h * 4);
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) { const c = f(x, y); a.set([...c, 255], (y * w + x) * 4); }
  return a;
};

test('cropRect takes a square from the upper part of portraits and the centre of landscapes', () => {
  assert.deepEqual(P.cropRect(600, 900), { x: 21, y: 36, w: 558, h: 558 });
  const l = P.cropRect(1600, 900);
  assert.deepEqual([l.w, l.h, l.y], [558, 558, 171]);
  assert.equal(l.x, Math.round((1600 - 558) / 2));
});

test('downsample averages blocks', () => {
  const img = solid(4, 4, (x) => (x < 2 ? [0, 0, 0] : [200, 100, 50]));
  const d = P.downsample(img, 4, 4, 2);
  assert.deepEqual([...d.slice(0, 4)], [0, 0, 0, 255]);
  assert.deepEqual([...d.slice(4, 8)], [200, 100, 50, 255]);
  const mid = P.downsample(solid(2, 2, (x) => (x ? [200, 0, 0] : [0, 0, 0])), 2, 2, 1);
  assert.deepEqual([...mid], [100, 0, 0, 255]);
});

test('quantize: at most k colours, exact for few-colour images, every pixel mapped', () => {
  const two = solid(8, 8, (x, y) => ((x + y) % 2 ? [255, 0, 0] : [0, 0, 255]));
  const q2 = P.quantize(two, 16);
  assert.equal(q2.palette.length, 2);
  assert.ok(q2.palette.some((c) => c.join() === '255,0,0') && q2.palette.some((c) => c.join() === '0,0,255'));
  const grad = solid(32, 32, (x, y) => [x * 8, y * 8, (x * y) % 256]);
  const q = P.quantize(grad, 16);
  assert.equal(q.palette.length, 16);
  assert.ok(q.indices.every((i) => i >= 0 && i < 16));
});

test('pixelIcon: 32x32, <= 16 colours plus outline/highlights, dark outline, transparent corners', () => {
  const img = solid(300, 450, (x, y) => [(x * 7) % 256, (y * 3) % 256, ((x + y) * 5) % 256]);
  const { rgba, size, palette } = P.pixelIcon(img, 300, 450);
  assert.equal(size, 32);
  assert.equal(rgba.length, 32 * 32 * 4);
  assert.ok(palette.length <= 16);
  const at = (x, y) => [...rgba.slice((y * 32 + x) * 4, (y * 32 + x) * 4 + 4)];
  assert.equal(at(0, 0)[3], 0, 'corner cut');
  assert.deepEqual(at(16, 0), [...P.OUTLINE, 255], 'top edge is the outline');
  assert.deepEqual(at(0, 16), [...P.OUTLINE, 255], 'left edge is the outline');
  assert.deepEqual(at(31, 16), [...P.OUTLINE, 255], 'right edge is the outline');
  const colours = new Set();
  for (let i = 0; i < rgba.length; i += 4) if (rgba[i + 3]) colours.add(`${rgba[i]},${rgba[i + 1]},${rgba[i + 2]}`);
  assert.ok(colours.size <= 16 * 3 + 2, `palette stays small (${colours.size})`); // base, lit and shaded tones + outline + glint
  // The highlight: the inner top row is lighter than the same colour further in.
  const flat = P.pixelIcon(solid(64, 64, () => [100, 60, 140]), 64, 64).rgba;
  const px = (x, y) => [...flat.slice((y * 32 + x) * 4, (y * 32 + x) * 4 + 3)];
  assert.ok(px(16, 1)[0] > px(16, 16)[0], 'top inner edge lit');
  assert.ok(px(16, 30)[0] < px(16, 16)[0], 'bottom inner edge shaded');
  assert.deepEqual(px(16, 16), [100, 60, 140]);
});

test('placeholderIcon is deterministic per seed and differs between seeds', () => {
  const a = P.placeholderIcon('c:aria', 32).rgba, b = P.placeholderIcon('c:aria', 32).rgba, c = P.placeholderIcon('c:mio', 32).rgba;
  assert.deepEqual(a, b);
  assert.notDeepEqual(a, c);
  assert.equal(a[3], 0);
});
