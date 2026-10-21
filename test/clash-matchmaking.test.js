// Fandom Clash matchmaking: seeded determinism, difficulty bands, tier floors, group rounds.
const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const mm = require('../tools/clash/matchmaking.js');
const { DIFFICULTIES, MODES, mulberry32, pickRound, pickPercentage, buildMatch, totalOf } = mm;

// A dense synthetic snapshot shaped like the real one: 2,000 characters with a long-tailed
// (Zipf-like) total distribution spread over 200 franchises.
function synthetic(nChars = 2000, nFr = 200) {
  const rng = mulberry32(12345);
  const characters = [];
  for (let i = 0; i < nChars; i++) {
    const total = Math.round(400000 / (1 + i) ** 0.85 * (0.9 + rng() * 0.2)) + 50;
    characters.push({ id: `char_${i}`, name: `Char ${i}`, franchise: `fr_${Math.floor((rng() ** 2) * nFr)}`, counts: { danbooru: total }, total, image: null });
  }
  characters.sort((a, b) => b.total - a.total);
  const frMap = new Map();
  for (const c of characters) {
    if (!frMap.has(c.franchise)) frMap.set(c.franchise, []);
    frMap.get(c.franchise).push(c);
  }
  const franchises = [...frMap].map(([id, cs]) => ({ id, name: id, total: Math.round(cs.reduce((s, c) => s + c.total, 0) * 0.8), characters: cs.map((c) => c.id) }))
    .sort((a, b) => b.total - a.total);
  return { version: 1, generatedAt: '2026-01-01T00:00:00.000Z', sites: ['danbooru'], characters, franchises };
}
const SNAP = synthetic();
const charRank = new Map(SNAP.characters.map((c, i) => [c.id, i]));
const charFr = new Map(SNAP.characters.map((c) => [c.id, c.franchise]));
const ratio = (r) => Math.max(r.totals.a, r.totals.b) / Math.min(r.totals.a, r.totals.b);
const sideKeys = (s) => (s.type === 'group' ? s.members : [s]).map((m) => `${m.type}:${m.id}`);

test('mulberry32 is deterministic and in [0,1)', () => {
  const a = mulberry32(42);
  const b = mulberry32(42);
  for (let i = 0; i < 1000; i++) {
    const x = a();
    assert.equal(x, b());
    assert.ok(x >= 0 && x < 1);
  }
  assert.notEqual(mulberry32(1)(), mulberry32(2)());
});

test('the same seed reproduces the same match (ghost replays)', () => {
  for (const mode of MODES) {
    for (const difficulty of Object.keys(DIFFICULTIES)) {
      const m1 = buildMatch({ snapshot: SNAP, mode, difficulty, seed: 987654321 });
      const m2 = buildMatch({ snapshot: SNAP, mode, difficulty, seed: 987654321 });
      assert.deepEqual(m1, m2, `${mode}/${difficulty}`);
      assert.equal(m1.rounds.length, mm.ROUNDS[mode]);
    }
  }
  const a = buildMatch({ snapshot: SNAP, mode: 'ranked', difficulty: 'normal', seed: 1 });
  const b = buildMatch({ snapshot: SNAP, mode: 'ranked', difficulty: 'normal', seed: 2 });
  assert.notDeepEqual(a.rounds, b.rounds);
});

test('every round respects its difficulty ratio band and reports the right answer', () => {
  for (const [d, cfg] of Object.entries(DIFFICULTIES)) {
    const rng = mulberry32(7 + d.length);
    for (let i = 0; i < 400; i++) {
      const r = pickRound({ snapshot: SNAP, mode: 'ranked', difficulty: d, rng });
      const q = ratio(r);
      assert.ok(q >= cfg.lo - 1e-9 && q <= cfg.hi + 1e-9, `${d} ${r.kind} ratio ${q.toFixed(3)} outside ${cfg.lo}-${cfg.hi}`);
      assert.equal(r.answer, r.totals.a > r.totals.b ? 'a' : 'b');
      assert.equal(totalOf(SNAP, r.a), r.totals.a);
      assert.equal(totalOf(SNAP, r.b), r.totals.b);
    }
  }
});

test('never a very popular contestant against an unknown one (max 4x, any difficulty)', () => {
  for (const d of Object.keys(DIFFICULTIES)) {
    for (let seed = 0; seed < 40; seed++) {
      for (const r of buildMatch({ snapshot: SNAP, mode: 'ranked', difficulty: d, seed }).rounds) {
        assert.ok(ratio(r) <= 4 + 1e-9, `${d} seed ${seed}: ratio ${ratio(r)}`);
      }
    }
  }
});

test('easy keeps characters in the top tier (top 600 of 2,000)', () => {
  const rng = mulberry32(99);
  let checked = 0;
  for (let i = 0; i < 500; i++) {
    const r = pickRound({ snapshot: SNAP, mode: 'ranked', difficulty: 'easy', rng });
    for (const s of [r.a, r.b]) {
      if (s.type === 'character') { assert.ok(charRank.get(s.id) < 600, `${s.id} rank ${charRank.get(s.id)}`); checked++; }
    }
  }
  assert.ok(checked > 300);
});

test('round kinds: mostly character vs character, some franchise rounds, groups on master', () => {
  const count = (d) => {
    const rng = mulberry32(5);
    const k = {};
    for (let i = 0; i < 600; i++) { const r = pickRound({ snapshot: SNAP, mode: 'ranked', difficulty: d, rng }); k[r.kind] = (k[r.kind] || 0) + 1; }
    return k;
  };
  const normal = count('normal');
  assert.ok(normal['char-char'] > 300, JSON.stringify(normal));
  assert.ok(normal['char-franchise'] > 20, JSON.stringify(normal));
  assert.ok(normal['franchise-franchise'] > 20, JSON.stringify(normal));
  assert.ok(!normal['group-group']);
  const master = count('master');
  assert.ok(master['group-group'] > 60, JSON.stringify(master));
});

test('master group rounds pit one hugely popular character against several contestants', () => {
  const rng = mulberry32(3);
  let seen = 0;
  for (let i = 0; i < 300 && seen < 30; i++) {
    const r = pickRound({ snapshot: SNAP, mode: 'ranked', difficulty: 'master', rng });
    if (r.kind !== 'group-group') continue;
    seen++;
    const [one, many] = r.a.members.length === 1 ? [r.a, r.b] : [r.b, r.a];
    assert.equal(one.members.length, 1);
    assert.ok(many.members.length >= 2 && many.members.length <= 4);
    assert.ok(charRank.get(one.members[0].id) < 100);
  }
  assert.ok(seen >= 30);
});

test('no character ever faces (or shares a group with) its own franchise; no repeats in a round', () => {
  for (const d of Object.keys(DIFFICULTIES)) {
    for (const mode of ['ranked', 'percentage']) {
      for (let seed = 100; seed < 130; seed++) {
        for (const r of buildMatch({ snapshot: SNAP, mode, difficulty: d, seed }).rounds) {
          const keys = sideKeys(r.a).concat(sideKeys(r.b));
          assert.equal(new Set(keys).size, keys.length, 'duplicate contestant in a round');
          const frs = new Set(keys.filter((k) => k.startsWith('franchise:')).map((k) => k.slice(10)));
          for (const k of keys) if (k.startsWith('character:')) assert.ok(!frs.has(charFr.get(k.slice(10))), `${k} vs own franchise`);
        }
      }
    }
  }
});

test('a match does not repeat contestants across rounds', () => {
  const m = buildMatch({ snapshot: SNAP, mode: 'ranked', difficulty: 'hard', seed: 4242 });
  const keys = m.rounds.flatMap((r) => sideKeys(r.a).concat(sideKeys(r.b)));
  assert.equal(new Set(keys).size, keys.length);
});

test('pickPercentage: two groups of 2-3, share matches the totals, band respected', () => {
  for (const [d, cfg] of Object.entries(DIFFICULTIES)) {
    const rng = mulberry32(77);
    for (let i = 0; i < 60; i++) {
      const r = pickPercentage({ snapshot: SNAP, difficulty: d, rng });
      assert.equal(r.kind, 'group-group');
      for (const s of [r.a, r.b]) assert.ok(s.members.length >= 2 && s.members.length <= 3);
      const q = ratio(r);
      assert.ok(q >= cfg.lo - 1e-9 && q <= cfg.hi + 1e-9, `${d} ratio ${q}`);
      const share = Math.round((1000 * r.totals.a) / (r.totals.a + r.totals.b)) / 10;
      assert.equal(r.share, share);
      assert.equal(r.answer, r.share > 50 ? 'a' : 'b');
    }
  }
});

test('bad input is rejected', () => {
  assert.throws(() => pickRound({ snapshot: SNAP, mode: 'nope', difficulty: 'easy' }));
  assert.throws(() => pickRound({ snapshot: SNAP, mode: 'ranked', difficulty: 'insane' }));
  assert.throws(() => buildMatch({ snapshot: SNAP, mode: 'ranked', difficulty: 'easy', seed: -1 }));
  assert.throws(() => buildMatch({ snapshot: SNAP, mode: 'ranked', difficulty: 'easy', seed: 1.5 }));
  assert.throws(() => pickRound({ snapshot: {}, mode: 'ranked', difficulty: 'easy' }));
});

test('the committed sample snapshot follows the contract and supports every mode/difficulty', () => {
  const file = path.join(__dirname, '..', 'tools', 'clash', 'sample-snapshot.json');
  const s = JSON.parse(fs.readFileSync(file, 'utf8'));
  assert.equal(s.version, 1);
  assert.ok(!Number.isNaN(Date.parse(s.generatedAt)));
  assert.ok(Array.isArray(s.sites) && s.sites.length >= 1);
  assert.ok(s.characters.length >= 100 && s.characters.length <= 200);
  const frIds = new Set(s.franchises.map((f) => f.id));
  let prev = Infinity;
  for (const c of s.characters) {
    assert.deepEqual(Object.keys(c).sort(), ['counts', 'franchise', 'id', 'image', 'name', 'total']);
    assert.ok(c.total <= prev, 'sorted by total desc');
    prev = c.total;
    assert.equal(c.total, Object.values(c.counts).reduce((a, b) => a + b, 0));
    for (const site of Object.keys(c.counts)) assert.ok(s.sites.includes(site));
    assert.ok(frIds.has(c.franchise), `${c.id} franchise ${c.franchise}`);
    if (c.image) {
      assert.deepEqual(Object.keys(c.image).sort(), ['h', 'postId', 'site', 'url', 'w']);
      assert.match(c.image.url, /^https:\/\//);
      assert.ok(['danbooru', 'safebooru'].includes(c.image.site), 'images only from SFW-rated sources');
    }
  }
  prev = Infinity;
  for (const f of s.franchises) {
    assert.deepEqual(Object.keys(f).sort(), ['characters', 'counts', 'fallback', 'id', 'name', 'total']);
    assert.equal(f.total, Object.values(f.counts).reduce((a, b) => a + b, 0), `${f.id}: total = sum of per-site counts`);
    assert.ok(f.total <= prev);
    prev = f.total;
  }
  for (const mode of MODES) {
    for (const difficulty of Object.keys(DIFFICULTIES)) {
      const m = buildMatch({ snapshot: s, mode, difficulty, seed: 2024 });
      assert.equal(m.rounds.length, mm.ROUNDS[mode]);
    }
  }
});
