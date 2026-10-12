// Unit tests for src/main/economy/revenue.js (creator pool split, pure).
const { test } = require('node:test');
const assert = require('node:assert/strict');
const { computePayouts, points, devPoints } = require('../src/main/economy/revenue');

const sum = (list) => list.reduce((s, d) => s + d.cents, 0);
const pay = (net, devs, extra = {}) => computePayouts({ netRevenueCents: net, devs, ...extra });

test('70% of net revenue split by points', () => {
  const r = pay(10000, [{ devId: 'a', points: 3 }, { devId: 'b', points: 1 }]);
  assert.deepEqual(r, [{ devId: 'a', cents: 5250 }, { devId: 'b', cents: 1750 }]);
});

test('pool is floor(net * share) and the cents add up to it exactly', () => {
  assert.equal(sum(pay(999, [{ devId: 'a', points: 1 }])), 699); // 699.3 -> 699
  assert.equal(sum(pay(100, [{ devId: 'a', points: 1 }], { creatorShare: 0.07 })), 7); // no 7.000000000000001 drift
  let seed = 7;
  const rnd = (n) => ((seed = (seed * 1103515245 + 12345) % 2147483648) % n);
  for (let i = 0; i < 300; i++) {
    const net = rnd(5_000_000), share = rnd(101) / 100;
    const devs = Array.from({ length: 1 + rnd(12) }, (_, k) => ({ devId: 'd' + k, points: 1 + rnd(5000) }));
    const r = pay(net, devs, { creatorShare: share });
    assert.equal(sum(r), Math.floor((net * Math.round(share * 100)) / 100), `net ${net} share ${share}`);
    assert.ok(r.every((d) => Number.isInteger(d.cents) && d.cents >= 0));
  }
});

test('largest remainder: leftover cents go to the biggest fractions, ties by points then devId', () => {
  assert.deepEqual(pay(100, [{ devId: 'c', points: 1 }, { devId: 'a', points: 1 }, { devId: 'b', points: 1 }]),
    [{ devId: 'c', cents: 23 }, { devId: 'a', cents: 24 }, { devId: 'b', cents: 23 }]); // 70 / 3
  // 10 cents over 6:3:1 -> 6, 3, 1 exactly; 11 cents -> 6.6, 3.3, 1.1 -> 7, 3, 1
  assert.deepEqual(pay(100, [{ devId: 'x', points: 6 }, { devId: 'y', points: 3 }, { devId: 'z', points: 1 }], { creatorShare: 0.11 }).map((d) => d.cents), [7, 3, 1]);
  // Same input in another order gives each dev the same amount.
  const a = pay(1001, [{ devId: 'p', points: 7 }, { devId: 'q', points: 7 }, { devId: 'r', points: 1 }]);
  const b = pay(1001, [{ devId: 'r', points: 1 }, { devId: 'q', points: 7 }, { devId: 'p', points: 7 }]);
  const byId = (l) => Object.fromEntries(l.map((d) => [d.devId, d.cents]));
  assert.deepEqual(byId(a), byId(b));
});

test('eligibility: minPoints, bad points, duplicates', () => {
  const r = pay(10000, [{ devId: 'a', points: 50 }, { devId: 'b', points: 9 }, { devId: 'c', points: 0 }, { devId: 'd', points: -5 },
    { devId: 'e', points: NaN }, { devId: 'a', points: 50 }, { points: 10 }, null], { minPoints: 10 });
  assert.deepEqual(r, [{ devId: 'a', cents: 7000 }]);
  assert.deepEqual(pay(10000, []), []);
  assert.deepEqual(pay(10000, [{ devId: 'a', points: 0 }]), []);
});

test('edge amounts and shares', () => {
  assert.deepEqual(pay(0, [{ devId: 'a', points: 1 }]), [{ devId: 'a', cents: 0 }]);
  assert.deepEqual(pay(1, [{ devId: 'a', points: 1 }, { devId: 'b', points: 1 }]), [{ devId: 'a', cents: 0 }, { devId: 'b', cents: 0 }]); // floor(0.7)=0
  assert.deepEqual(pay(500, [{ devId: 'a', points: 1 }], { creatorShare: 0 }), [{ devId: 'a', cents: 0 }]);
  assert.deepEqual(pay(500, [{ devId: 'a', points: 1 }], { creatorShare: 1 }), [{ devId: 'a', cents: 500 }]);
  const big = pay(Number.MAX_SAFE_INTEGER, [{ devId: 'a', points: 3 }, { devId: 'b', points: 7 }]);
  assert.equal(BigInt(big[0].cents) + BigInt(big[1].cents), (BigInt(Number.MAX_SAFE_INTEGER) * 7000n) / 10000n);
});

test('invalid input throws', () => {
  for (const net of [-1, 1.5, NaN, '100', null, 2 ** 60]) assert.throws(() => pay(net, []), RangeError, String(net));
  for (const s of [-0.1, 1.01, NaN, '0.7']) assert.throws(() => pay(100, [], { creatorShare: s }), RangeError, String(s));
});

test('points: whole play minutes + 10 per achievement, registered apps only', () => {
  const stats = { perApp: { 480: { playSeconds: 3599, achievements: 2 }, 620: { playSeconds: 600, achievements: 1 }, 999: { playSeconds: 1e6, achievements: 50 } } };
  assert.equal(points(stats, [480]), 59 + 20);
  assert.equal(points(stats, ['480', 620]), 79 + 20);
  assert.equal(points(stats, []), 0);
  assert.equal(points({}, [480]), 0);
  assert.equal(points({ perApp: { 480: { playSeconds: -50, achievements: 'x' } } }, [480]), 0);
  const devs = [{ devId: 'real', apps: [{ appid: 620 }] }, { devId: 'sample', sample: true, apps: [{ appid: 480 }] }];
  assert.deepEqual(devPoints(stats, devs), [{ devId: 'real', points: 20 }]);
});
