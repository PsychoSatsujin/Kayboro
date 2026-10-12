'use strict';
// Level curve (pure). Level 1 starts at 0 XP; each step costs ~50 XP early and ~670 XP near the cap,
// so level 100 (~30k XP) takes roughly 40 h of hosted play plus a typical run of achievements.
const MAX_LEVEL = 100;

const stepCost = (l) => 5 * Math.round((50 + 0.65 * Math.pow(l - 1, 1.5)) / 5); // XP from level l to l+1
const TABLE = [0, 0]; // TABLE[l] = total XP needed to reach level l
for (let l = 2; l <= MAX_LEVEL; l++) TABLE[l] = TABLE[l - 1] + stepCost(l - 1);

const clampLevel = (l) => Math.min(MAX_LEVEL, Math.max(1, Math.floor(Number(l) || 1)));
const xpForLevel = (l) => TABLE[clampLevel(l)];

function levelFromXp(xp) {
  xp = Math.max(0, Number(xp) || 0);
  let lo = 1, hi = MAX_LEVEL;
  while (lo < hi) {
    const mid = (lo + hi + 1) >> 1;
    if (TABLE[mid] <= xp) lo = mid; else hi = mid - 1;
  }
  return lo;
}

// { level, xpIntoLevel, xpForNext } for the HUD; xpForNext is 0 at the cap.
function progress(xp) {
  xp = Math.max(0, Math.floor(Number(xp) || 0));
  const level = levelFromXp(xp);
  return { level, xpIntoLevel: xp - TABLE[level], xpForNext: level >= MAX_LEVEL ? 0 : TABLE[level + 1] - TABLE[level] };
}

// Rewards for reaching `level`, from the levels.json table ([{level, rewards:{coins, items}}]).
function rewardsFor(level, levels) {
  const row = (levels || []).find((r) => r && r.level === level);
  const r = (row && row.rewards) || {};
  return { coins: Math.max(0, Math.floor(r.coins) || 0), items: Array.isArray(r.items) ? r.items.filter((i) => typeof i === 'string') : [] };
}

module.exports = { MAX_LEVEL, xpForLevel, levelFromXp, progress, rewardsFor };
