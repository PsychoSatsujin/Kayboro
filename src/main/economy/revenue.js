'use strict';
// Creator revenue split (pure). 70% of Shellcade's net revenue goes to listed indie developers,
// weighted by the play their games get inside Shellcade; 30% stays with Shellcade. payouts.js turns
// it into the payout sheet (Devs tab > Export payout sheet, tools/payouts/merge-sheets.mjs).

const BP = 10000n; // creatorShare is applied in basis points so the pool is exact integer math

// Verified play points of one user's stats for a set of registered appids:
// whole play minutes + 10 per achievement unlocked while hosted.
function points(stats, appids) {
  const ids = new Set([...(appids || [])].map(String));
  let p = 0;
  for (const [appid, a] of Object.entries((stats && stats.perApp) || {})) {
    if (!ids.has(String(appid)) || !a) continue;
    p += Math.floor(Math.max(0, Number(a.playSeconds) || 0) / 60) + 10 * Math.max(0, Math.floor(Number(a.achievements) || 0));
  }
  return p;
}

// Splits floor(netRevenueCents * creatorShare) between devs in proportion to their points using the
// largest-remainder method, so the cents always add up to the pool exactly. Devs below minPoints (or
// with no points) get nothing; duplicate devIds are merged. Returns [{devId, cents}] in input order,
// or [] when nobody qualifies (the pool is then left undistributed).
function computePayouts({ netRevenueCents, creatorShare = 0.7, devs = [], minPoints = 1 } = {}) {
  if (!Number.isSafeInteger(netRevenueCents) || netRevenueCents < 0) throw new RangeError('netRevenueCents must be a non-negative integer');
  if (typeof creatorShare !== 'number' || !(creatorShare >= 0 && creatorShare <= 1)) throw new RangeError('creatorShare must be between 0 and 1');
  const pool = (BigInt(netRevenueCents) * BigInt(Math.round(creatorShare * 10000))) / BP;

  const byId = new Map();
  for (const d of devs || []) {
    const pts = Math.floor(Number(d && d.points));
    if (!d || typeof d.devId !== 'string' || !Number.isSafeInteger(pts) || pts <= 0) continue;
    byId.set(d.devId, (byId.get(d.devId) || 0) + pts);
  }
  const elig = [...byId].filter(([, p]) => p >= Math.max(1, minPoints || 0)).map(([devId, p], i) => ({ devId, p: BigInt(p), i }));
  if (!elig.length) return [];

  const total = elig.reduce((s, d) => s + d.p, 0n);
  let left = pool;
  for (const d of elig) {
    d.cents = (pool * d.p) / total;
    d.rem = (pool * d.p) % total;
    left -= d.cents;
  }
  // Hand the leftover cents to the largest remainders (ties: more points, then devId) for determinism.
  const order = [...elig].sort((a, b) => (b.rem > a.rem ? 1 : b.rem < a.rem ? -1 : b.p > a.p ? 1 : b.p < a.p ? -1 : a.devId < b.devId ? -1 : 1));
  for (let k = 0; left > 0n; k++, left--) order[k].cents++;
  return elig.map((d) => ({ devId: d.devId, cents: Number(d.cents) }));
}

// [{devId, points}] for computePayouts from one user's stats and the developers listing (sample listings excluded).
const devPoints = (stats, developers) => (developers || []).filter((d) => d && !d.sample).map((d) => ({ devId: d.devId, points: points(stats, (d.apps || []).map((a) => a.appid)) }));

module.exports = { computePayouts, points, devPoints };
