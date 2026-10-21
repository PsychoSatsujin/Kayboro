// Unit tests for coin bets in src/main/economy/economy.js: escrow, caps, settling, refunds after a crash.
const { test, after } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { Economy, RULES } = require('../src/main/economy/economy');

const TMP = fs.mkdtempSync(path.join(os.tmpdir(), 'kayboro-bets-'));
after(() => fs.rmSync(TMP, { recursive: true, force: true }));
let n = 0;
const freshDir = () => path.join(TMP, String(++n));
const history = (dir) => fs.readFileSync(path.join(dir, 'history.jsonl'), 'utf8').trim().split('\n').map((l) => JSON.parse(l));
const rich = (coins, dir = freshDir()) => { const e = new Economy({ dir }); e.grant({ coins }); return e; };

test('limits: 25% of the balance, at most 500', () => {
  assert.equal(rich(1000).betLimits().max, 250);
  assert.equal(rich(10000).betLimits().max, RULES.bet.max);
  assert.equal(rich(3).betLimits().max, 0);
  const l = rich(400).betLimits();
  assert.deepEqual([l.min, l.max, l.open, l.maxMultiplier], [1, 100, 0, 5]);
});

test('placeBet escrows the stake and returns a ticket', () => {
  const e = rich(1000);
  const r = e.placeBet(100, { game: 'clash-percent' });
  assert.equal(r.ok, true);
  assert.match(r.ticket, /^bet-[0-9a-f]{16}$/);
  assert.equal(r.state.coins, 900);
  assert.equal(e.betLimits().open, 1);
  assert.equal(e.betLimits().max, 225); // the cap follows the balance after the stake left it
});

test('placeBet refuses bad amounts, over-cap bets and too many open tickets', () => {
  const e = rich(1000);
  for (const bad of [0, -5, 1.5, NaN, '10', null]) assert.equal(e.placeBet(bad).reason, 'amount', String(bad));
  assert.equal(e.placeBet(251).reason, 'cap');
  assert.equal(rich(2).placeBet(5).reason, 'insufficient');
  for (let i = 0; i < RULES.bet.maxOpen; i++) assert.equal(e.placeBet(10).ok, true);
  assert.equal(e.placeBet(10).reason, 'busy');
  assert.equal(e.getState().coins, 1000 - 10 * RULES.bet.maxOpen);
});

test('settleBet: win pays stake x multiplier (rounded down, clamped 1..5), loss nothing, cancel/push refund', () => {
  const e = rich(10000);
  const t1 = e.placeBet(100).ticket, t2 = e.placeBet(100).ticket, t3 = e.placeBet(100).ticket, t4 = e.placeBet(100).ticket, t5 = e.placeBet(33).ticket;
  assert.equal(e.getState().coins, 10000 - 433);
  assert.deepEqual([e.settleBet(t1, 'win', 1.9).payout, e.settleBet(t2, 'loss').payout, e.settleBet(t3, 'cancel').payout, e.settleBet(t4, 'push').payout], [190, 0, 100, 100]);
  assert.equal(e.settleBet(t5, 'win', 99).payout, 33 * RULES.bet.maxMultiplier);
  assert.equal(e.getState().coins, 10000 - 433 + 190 + 0 + 100 + 100 + 165);
  const t6 = e.placeBet(50).ticket;
  assert.equal(e.settleBet(t6, 'win', 0.2).payout, 50); // a win never pays less than the stake
});

test('settleBet refuses unknown tickets, bad outcomes and settles each ticket once', () => {
  const e = rich(1000);
  const t = e.placeBet(50).ticket;
  assert.equal(e.settleBet('bet-nope', 'win', 2).reason, 'unknown');
  assert.equal(e.settleBet('__proto__', 'win', 2).reason, 'unknown');
  assert.equal(e.settleBet(t, 'jackpot').reason, 'outcome');
  assert.equal(e.settleBet(t, 'win', 'lots').reason, 'multiplier');
  assert.equal(e.settleBet(t, 'win', 2).ok, true);
  assert.equal(e.settleBet(t, 'win', 2).reason, 'unknown');
  assert.equal(e.getState().coins, 1050);
});

test('open tickets survive a crash and are refunded on the next load', () => {
  const dir = freshDir();
  const e = rich(1000, dir);
  e.placeBet(200);
  e.placeBet(40);
  assert.equal(e.getState().coins, 760);
  const saved = JSON.parse(fs.readFileSync(path.join(dir, 'state.json'), 'utf8'));
  assert.equal(Object.keys(saved.bets).length, 2); // persisted before placeBet returned
  const again = new Economy({ dir }); // "restart" without settling
  assert.equal(again.getState().coins, 1000);
  assert.equal(again.betLimits().open, 0);
  assert.deepEqual(JSON.parse(fs.readFileSync(path.join(dir, 'state.json'), 'utf8')).bets, {});
  assert.equal(new Economy({ dir }).getState().coins, 1000); // refunded once, not on every load
});

test('bets are logged to history.jsonl', () => {
  const dir = freshDir();
  const e = rich(1000, dir);
  const t = e.placeBet(100, { game: 'clash-ghost' }).ticket;
  e.settleBet(t, 'win', 1.9);
  const t2 = e.placeBet(10).ticket;
  void t2;
  new Economy({ dir });
  const rows = history(dir).filter((r) => r.type.startsWith('bet'));
  assert.deepEqual(rows.map((r) => r.type), ['bet', 'betSettle', 'bet', 'betRefund']);
  assert.equal(rows[0].coins, -100);
  assert.equal(rows[0].game, 'clash-ghost');
  assert.deepEqual([rows[1].outcome, rows[1].stake, rows[1].coins, rows[1].multiplier], ['win', 100, 190, 1.9]);
  assert.equal(rows[3].coins, 10);
});

test('a bet emits state changes for the HUD', () => {
  const e = rich(1000);
  const seen = [];
  e.on('state', (s) => seen.push(s.coins));
  const t = e.placeBet(100).ticket;
  e.settleBet(t, 'win', 2);
  assert.deepEqual(seen, [900, 1100]);
});
