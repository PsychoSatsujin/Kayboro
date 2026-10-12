// Unit tests for src/main/economy: ledger hash chain, level curve, catalog and the earning/spending rules.
const { test, after } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { EventEmitter } = require('node:events');

const { Ledger, totals } = require('../src/main/economy/ledger');
const P = require('../src/main/economy/progression');
const catalogLib = require('../src/main/economy/catalog');
const { Economy, RULES } = require('../src/main/economy/economy');
const { SessionManager } = require('../src/main/economy/session');
const { allowedLink } = require('../src/main/economy/ipc');

const TMP = fs.mkdtempSync(path.join(os.tmpdir(), 'shellcade-eco-'));
after(() => fs.rmSync(TMP, { recursive: true, force: true }));
let n = 0;
const freshDir = () => path.join(TMP, String(++n));

const FRAME_IDS = ['px-pocket', 'px-crt', 'px-pet-egg', 'px-arcade', 'px-dungeon', 'px-cloud-castle', 'px-cat-monitor', 'px-space-console',
  'vx-sakura-handheld', 'vx-magical-compact', 'vx-mecha-hud', 'vx-cozy-wood-tv', 'vx-neko-tv', 'vx-synthwave', 'vx-ufo-pet', 'vx-gallery'];
const STARTER_IDS = ['crt-tv', 'virtual-pet', 'handheld', 'arcade', 'bezel'];

// A clock the tests move by hand (local time, so day boundaries are local midnights).
const clock = (y = 2026, m = 0, d = 5, h = 10) => {
  const c = { t: new Date(y, m, d, h).getTime() };
  c.now = () => c.t;
  c.add = (sec) => { c.t += sec * 1000; };
  c.nextDay = () => { const x = new Date(c.t); c.t = new Date(x.getFullYear(), x.getMonth(), x.getDate() + 1, 10).getTime(); };
  return c;
};

// Real catalog plus test-only items: a paid frame and a coin-or-level epic frame.
const testCatalog = () => {
  const cat = catalogLib.load();
  return { ...cat, frames: [...cat.frames,
    { id: 't-paid', name: 'Paid', kind: 'frame', rarity: 'legendary', price: { usd: 4.99 }, unlockLevel: null, file: 'frames/t.svg' },
    { id: 't-epic', name: 'Epic', kind: 'frame', rarity: 'epic', price: { coins: 900 }, unlockLevel: 60, file: 'frames/t2.svg' }] };
};
const make = (c = clock(), dir = freshDir()) => new Economy({ dir, now: c.now, catalog: testCatalog() });

// ---- Ledger ------------------------------------------------------------------

test('ledger: entries chain by hash and replay after reload', () => {
  const dir = freshDir();
  const l = new Ledger(dir);
  l.load();
  const a = l.append('grant', { coins: 10, xp: 5 }, { why: 'a' });
  const b = l.append('purchase', { coins: -4, xp: 0 }, { itemId: 'x' });
  assert.equal(b.prev, a.hash);
  assert.match(a.hash, /^[0-9a-f]{64}$/);
  const l2 = new Ledger(dir);
  assert.equal(l2.load().length, 2);
  assert.equal(l2.tampered, false);
  assert.deepEqual(totals(l2.entries), { coins: 6, xp: 5 });
  assert.deepEqual(l2.entries[1].ref, { itemId: 'x' });
});

test('ledger: an edited entry keeps the valid prefix, flags tampering and repairs the file', () => {
  const dir = freshDir();
  const l = new Ledger(dir, { now: () => 1000 });
  l.load();
  for (let i = 0; i < 4; i++) l.append('grant', { coins: 10, xp: 0 }, null);
  const file = path.join(dir, 'ledger.jsonl');
  const lines = fs.readFileSync(file, 'utf8').trim().split('\n');
  lines[2] = lines[2].replace('"coins":10', '"coins":9999');
  fs.writeFileSync(file, lines.join('\n') + '\n');

  const l2 = new Ledger(dir, { now: () => 2000 });
  assert.equal(l2.load().length, 2);
  assert.equal(l2.tampered, true);
  assert.deepEqual(totals(l2.entries), { coins: 20, xp: 0 });
  assert.ok(fs.existsSync(file + '.tampered-2000'), 'original kept for inspection');
  l2.append('grant', { coins: 1, xp: 0 }, null);
  const l3 = new Ledger(dir);
  assert.equal(l3.load().length, 3);
  assert.equal(l3.tampered, false, 'chain is valid again after the repair');

  // Deleting a line in the middle breaks the chain too.
  const ls = fs.readFileSync(file, 'utf8').trim().split('\n');
  fs.writeFileSync(file, [ls[0], ls[2]].join('\n') + '\n');
  const l4 = new Ledger(dir);
  assert.equal(l4.load().length, 1);
  assert.equal(l4.tampered, true);
});

test('ledger: a torn last line (crash mid-write) is dropped without a tamper flag', () => {
  const dir = freshDir();
  const l = new Ledger(dir);
  l.load();
  l.append('grant', { coins: 1, xp: 1 }, null);
  fs.appendFileSync(path.join(dir, 'ledger.jsonl'), '{"t":12,"type":"gr');
  const l2 = new Ledger(dir);
  assert.equal(l2.load().length, 1);
  assert.equal(l2.tampered, false);
  assert.ok(fs.readFileSync(path.join(dir, 'ledger.jsonl'), 'utf8').endsWith('\n'));
});

test('economy: a tampered ledger adds the ledger-tampered flag, persisted in the ledger', () => {
  const dir = freshDir();
  const e = make(clock(), dir);
  e.grant({ coins: 100 });
  e.grant({ coins: 100 });
  const file = path.join(dir, 'ledger.jsonl');
  fs.writeFileSync(file, fs.readFileSync(file, 'utf8').replace('"coins":100', '"coins":100000'));
  const e2 = make(clock(), dir);
  assert.ok(e2.getState().flags.includes('ledger-tampered'));
  assert.equal(e2.getState().coins, 0);
  assert.ok(make(clock(), dir).getState().flags.includes('ledger-tampered'));
});

// ---- Progression ---------------------------------------------------------------

test('progression: monotonic curve, quick early levels, capped at 100', () => {
  assert.equal(P.xpForLevel(1), 0);
  let prevStep = 0;
  for (let l = 2; l <= 100; l++) {
    const step = P.xpForLevel(l) - P.xpForLevel(l - 1);
    assert.ok(step > 0 && step >= prevStep, `level ${l} step ${step}`);
    prevStep = step;
    assert.equal(P.levelFromXp(P.xpForLevel(l)), l);
    assert.equal(P.levelFromXp(P.xpForLevel(l) - 1), l - 1);
  }
  assert.ok(P.xpForLevel(5) <= 300, 'level 5 within ~30 min of play');
  const hours = P.xpForLevel(100) / (RULES.play.xpPerMinute * 60);
  assert.ok(hours > 35 && hours < 60, `level 100 at ${hours} h of play-only XP`);
  assert.equal(P.levelFromXp(1e12), 100);
  assert.equal(P.levelFromXp(-5), 1);
  assert.equal(P.levelFromXp(NaN), 1);
  assert.deepEqual(P.progress(P.xpForLevel(100) + 999), { level: 100, xpIntoLevel: 999, xpForNext: 0 });
  assert.deepEqual(P.progress(P.xpForLevel(3) + 7), { level: 3, xpIntoLevel: 7, xpForNext: P.xpForLevel(4) - P.xpForLevel(3) });
  assert.equal(P.xpForLevel(500), P.xpForLevel(100));
});

test('levels.json: matches the curve, coins 20 -> 150, every frame unlocks once', () => {
  const { levels, finishes, colorways, fills } = catalogLib.load();
  assert.equal(levels.length, 100);
  const milestones = levels.filter((r) => r.milestone).map((r) => r.level);
  assert.deepEqual(milestones, [10, 25, 50, 75, 100]);
  let prev = 0;
  for (const r of levels) {
    assert.equal(r.xpRequired, P.xpForLevel(r.level), `level ${r.level}`);
    if (r.level === 1 || r.milestone) continue;
    assert.ok(r.rewards.coins >= 20 && r.rewards.coins <= 150 && r.rewards.coins >= prev, `coins at ${r.level}`);
    prev = r.rewards.coins;
  }
  assert.equal(levels[1].rewards.coins, 20);
  assert.equal(levels[99].rewards.coins - 3000, 150);
  const at = new Map(levels.flatMap((r) => r.rewards.items.map((id) => [id, r.level])));
  assert.equal(levels.flatMap((r) => r.rewards.items).length, at.size, 'no item granted twice');
  for (const id of FRAME_IDS) assert.ok(at.has(id), `${id} unlocks somewhere`);
  assert.equal(at.get('vx-gallery'), 100);
  assert.equal(at.get('px-cloud-castle'), 90);
  for (const id of FRAME_IDS.filter((x) => !['vx-gallery', 'px-cloud-castle'].includes(x))) assert.ok(at.get(id) >= 2 && at.get(id) <= 80, id);
  const known = new Set([...FRAME_IDS, ...finishes, ...colorways, ...fills].map((x) => x.id || x));
  for (const id of at.keys()) assert.ok(known.has(id), `unknown reward ${id}`);
  for (const it of [...finishes, ...colorways, ...fills]) if (it.unlockLevel) assert.equal(at.get(it.id), it.unlockLevel, it.id);
});

// ---- Catalog --------------------------------------------------------------------

test('catalog: cosmetic ids, prices and the built-in starters', async () => {
  const cat = catalogLib.load();
  assert.deepEqual(cat.finishes.map((f) => f.id), ['none', 'matte', 'gloss', 'holo', 'pearl', 'glitter']);
  assert.deepEqual(cat.fills.map((f) => f.id), ['starfield', 'bubbles', 'plasma', 'pixel-rain', 'sakura-petals', 'aurora']);
  assert.deepEqual(cat.colorways.map((f) => f.id).sort(), ['berry', 'clear', 'default', 'gold', 'midnight', 'mint', 'mono', 'sunset']);
  const f = Object.fromEntries(cat.finishes.map((x) => [x.id, x]));
  assert.deepEqual([f.matte.unlockLevel, f.gloss.unlockLevel, f.holo.unlockLevel], [3, 10, 25]);
  assert.deepEqual([f.pearl.price, f.glitter.price, f.none.price], [{ coins: 400 }, { coins: 650 }, null]);
  const clear = cat.colorways.find((c) => c.id === 'clear');
  assert.equal(clear.translucent, true); assert.equal(clear.rarity, 'epic'); assert.equal(clear.unlockLevel, 35);
  assert.equal(cat.backdrops[0].price.coins, 200);
  const dev = cat.developers;
  assert.equal(dev.length, 1);
  assert.equal(dev[0].sample, true);
  assert.equal(dev[0].apps[0].appid, 480);

  // Starters mirror the renderer's frames.js.
  const F = await import('../src/renderer/frames/frames.js');
  for (const id of STARTER_IDS) {
    const a = cat.frames.find((x) => x.id === id), b = F.frameById(id);
    assert.ok(a && a.starter && a.price === null, id);
    assert.deepEqual(a.size, b.size); assert.deepEqual(a.hole, b.hole); assert.equal(a.aspect, b.aspect);
    assert.ok(fs.existsSync(path.join(__dirname, '..', 'src', 'renderer', a.file)), a.file);
  }
  const ids = Object.keys(cat).filter((k) => !['levels', 'developers'].includes(k)).flatMap((k) => cat[k].map((x) => x.id));
  assert.equal(new Set(ids).size, ids.length, 'item ids are unique across kinds');
  for (const fr of cat.frames) assert.match(fr.file, /^frames\/[\w/-]+\.(svg|png|webp)$/);
});

// ---- Economy rules --------------------------------------------------------------

test('economy: fresh profile owns the starters and free items', () => {
  const s = make().getState();
  assert.equal(s.coins, 0); assert.equal(s.xp, 0); assert.equal(s.level, 1);
  assert.equal(s.xpForNext, P.xpForLevel(2));
  for (const id of [...STARTER_IDS, 'none', 'default', 'starfield']) assert.ok(s.inventory.includes(id), id);
  for (const id of ['matte', 'pearl', 'clear', 't-paid', 't-epic']) assert.ok(!s.inventory.includes(id), id);
  assert.deepEqual(s.equipped, { finish: 'none', colorway: 'default', fill: 'starfield' });
  assert.deepEqual(s.backdropSlots, []);
  assert.deepEqual(s.stats, { totalPlaySeconds: 0, achievements: 0, perApp: {} });
  assert.equal(s.session, null);
  assert.deepEqual(s.flags, []);
});

test('economy: achievements pay 50 coins + 120 XP, +25 for the first of the day, once each', () => {
  const c = clock();
  const e = make(c);
  const a = e.awardAchievement({ appid: 480, game: 'Spacewar', apiName: 'ACH_WIN', name: 'Winner', iconUrl: 'https://cdn.cloudflare.steamstatic.com/x.jpg' });
  assert.equal(a.coins, 75); assert.equal(a.xp, 120); assert.equal(a.name, 'Winner');
  assert.equal(e.awardAchievement({ appid: 480, game: 'Spacewar', apiName: 'ACH_WIN' }), null, 'same achievement pays once');
  assert.equal(e.awardAchievement({ appid: 480, apiName: 'ACH_TWO' }).coins, 50);
  assert.equal(e.awardAchievement({ appid: 620, apiName: 'ACH_WIN' }).coins, 50, 'apiName is per app');
  c.nextDay();
  assert.equal(e.awardAchievement({ appid: 480, apiName: 'ACH_THREE' }).coins, 75);
  assert.equal(e.awardAchievement({ appid: null, apiName: 'X' }), null);
  const s = e.getState();
  assert.equal(s.stats.achievements, 4);
  assert.deepEqual(s.stats.perApp['480'], { name: 'Spacewar', playSeconds: 0, achievements: 3 });
  assert.equal(s.xp, 480);
  // Coins: achievements 250 + level rewards for every level reached.
  const lv = catalogLib.load().levels;
  const levelCoins = lv.filter((r) => r.level > 1 && r.level <= s.level).reduce((t, r) => t + r.rewards.coins, 0);
  assert.equal(s.coins, 250 + levelCoins);
});

test('economy: unlock is emitted before the level-ups it causes', () => {
  const e = make();
  const seen = [];
  e.on('unlock', (u) => seen.push('unlock:' + u.apiName));
  e.on('levelUp', (l) => seen.push('level:' + l.level));
  e.awardAchievement({ appid: 480, apiName: 'A' });
  assert.deepEqual(seen, ['unlock:A', 'level:2', 'level:3']);
});

test('economy: play time pays 10 XP/min and 1 coin/5 min with daily caps', () => {
  const c = clock();
  const e = make(c);
  const app = { appid: 480, name: 'Spacewar' };
  assert.deepEqual(e.addPlayTime(30, app), { coins: 0, xp: 5 });
  for (let i = 0; i < 9; i++) e.addPlayTime(30, app); // 5 min
  let play = e.ledger.entries.filter((x) => x.type === 'play');
  assert.deepEqual(totals(play), { coins: 1, xp: 50 });
  assert.equal(e.addPlayTime(0, app), null);
  assert.equal(e.addPlayTime(10_000, app).xp, 20, 'one tick counts at most 120 s');
  for (let i = 0; i < 300; i++) e.addPlayTime(60, app); // +5 h
  play = e.ledger.entries.filter((x) => x.type === 'play');
  assert.deepEqual(totals(play), { coins: 60, xp: 900 }, 'daily caps');
  const s = e.getState();
  assert.equal(s.stats.totalPlaySeconds, 300 + 120 + 18000, 'time past the cap still counts in stats');
  assert.equal(s.stats.perApp['480'].playSeconds, s.stats.totalPlaySeconds);
  c.nextDay();
  assert.deepEqual(e.addPlayTime(60, app), { coins: 0, xp: 10 }, 'caps reset the next day');
  e.addPlayTime(60, { appid: null, name: 'Notepad' });
  assert.equal(Object.keys(e.getState().stats.perApp).length, 1, 'non-Steam play only counts in the total');
});

test('economy: levelling up grants levels.json rewards and emits levelUp once per level', () => {
  const e = make();
  const ups = [];
  e.on('levelUp', (x) => ups.push(x));
  e.grant({ xp: P.xpForLevel(4) });
  assert.deepEqual(ups.map((u) => u.level), [2, 3, 4]);
  assert.deepEqual(ups[0].rewards, { coins: 20, items: ['px-pocket'] });
  const s = e.getState();
  assert.equal(s.level, 4);
  assert.equal(s.coins, 20 + 20 + 25);
  for (const id of ['px-pocket', 'matte', 'vx-cozy-wood-tv']) assert.ok(s.inventory.includes(id), id);
  e.grant({ xp: 1 });
  assert.equal(ups.length, 3);
  // Reload: no double rewards.
  const e2 = new Economy({ dir: e.dir, catalog: testCatalog() });
  assert.equal(e2.getState().coins, s.coins);
  e2.grant({ xp: 1e9 });
  assert.equal(e2.getState().level, 100);
  assert.ok(e2.getState().inventory.includes('vx-gallery'));
  assert.equal(e2.ledger.entries.filter((x) => x.type === 'levelup').length, 99);
});

test('economy: purchases (coins only) and their failure reasons', () => {
  const e = make();
  const r = (id) => e.purchase(id).reason;
  assert.equal(r('pearl'), 'insufficient');
  assert.equal(r('t-paid'), 'paid');
  assert.equal(r('matte'), 'locked');
  assert.equal(r('none'), 'owned');
  assert.equal(r('nope'), 'unknown');
  e.grant({ coins: 1000 });
  const ok = e.purchase('pearl');
  assert.equal(ok.ok, true);
  assert.equal(ok.state.coins, 600);
  assert.ok(ok.state.inventory.includes('pearl'));
  assert.equal(r('pearl'), 'owned');
  assert.equal(r('t-epic'), 'insufficient', 'epic frames can be bought before their level');
  e.grant({ coins: 300 });
  assert.equal(e.purchase('t-epic').ok, true);
  assert.equal(e.getState().coins, 0);
  assert.ok(make(clock(), e.dir).getState().inventory.includes('t-epic'), 'purchases survive a reload');
});

test('economy: equip checks slot, kind and ownership, and persists', () => {
  const e = make();
  assert.equal(e.equip('finish', 'pearl').reason, 'locked');
  assert.equal(e.equip('finish', 'berry').reason, 'unknown');
  assert.equal(e.equip('hat', 'none').reason, 'slot');
  assert.equal(e.equip('__proto__', 'none').reason, 'slot');
  e.grant({ coins: 400 });
  e.purchase('pearl');
  assert.equal(e.equip('finish', 'pearl').ok, true);
  assert.equal(e.equip('fill', null).state.equipped.fill, null, 'fill can be turned off');
  assert.deepEqual(make(clock(), e.dir).getState().equipped, { finish: 'pearl', colorway: 'default', fill: null });
  assert.equal(e.equip('finish', null).state.equipped.finish, 'none');
});

test('economy: backdrop slots cost 200 coins, first one free at level 5', () => {
  const e = make();
  assert.equal(e.buyBackdropSlot().reason, 'insufficient');
  assert.equal(e.setBackdropSlot(0, '123').reason, 'slot');
  e.grant({ coins: 200 });
  const b = e.buyBackdropSlot();
  assert.equal(b.ok, true);
  assert.equal(b.state.coins, 0);
  assert.deepEqual(b.state.backdropSlots, [{ slot: 0, wallpaperId: null }]);
  e.grant({ xp: P.xpForLevel(5) });
  assert.equal(e.getState().backdropSlots.length, 2);
  assert.equal(e.setBackdropSlot(1, '2846051789').ok, true);
  assert.equal(e.setBackdropSlot(1, '../evil').reason, 'invalid');
  assert.equal(e.setBackdropSlot(2, '1').reason, 'slot');
  assert.equal(e.setBackdropSlot(1.5, '1').reason, 'slot');
  assert.deepEqual(make(clock(), e.dir).getState().backdropSlots, [{ slot: 0, wallpaperId: null }, { slot: 1, wallpaperId: '2846051789' }]);
  assert.equal(e.setBackdropSlot(1, null).state.backdropSlots[1].wallpaperId, null);
  e.grant({ coins: 200 * 20 });
  while (e.buyBackdropSlot().ok);
  assert.equal(e.getState().backdropSlots.length, RULES.backdrop.maxSlots);
  assert.equal(e.buyBackdropSlot().reason, 'max');
  assert.equal(e.purchase('backdrop-slot').reason, 'max', 'purchase() routes the slot product');
});

// ---- Session ----------------------------------------------------------------------

function fakeSteam() {
  const watchers = [];
  class AchievementWatcher extends EventEmitter {
    constructor() { super(); watchers.push(this); }
    start(o) { this.opts = o; this.running = true; return true; }
    stop() { this.running = false; }
  }
  return {
    watchers, AchievementWatcher,
    appForExe: (exe) => (/spacewar/i.test(exe) ? { appid: 480, name: 'Spacewar' } : null),
    readSchema: () => [{ apiName: 'ACH_WIN_ONE_GAME', name: 'Winner', desc: 'Win one game', icon: 'abc' }],
    iconUrl: (appid, icon) => `https://cdn.cloudflare.steamstatic.com/steamcommunity/public/images/apps/${appid}/${icon}.jpg`,
    installedApps: () => [{ appid: 480, name: 'Spacewar' }],
  };
}

test('session: hosted Steam game, achievement watcher, unlock + suspicious events', () => {
  const c = clock();
  const e = make(c);
  const steam = fakeSteam();
  const sm = new SessionManager({ economy: e, steam, now: c.now, platform: 'linux' });
  const unlocks = [];
  e.on('unlock', (u) => unlocks.push(u));
  assert.equal(sm.sessionStart({}), null);
  assert.deepEqual(sm.sessionStart({ hwnd: '42', exePath: 'C:\\Steam\\steamapps\\common\\Spacewar\\SpaceWar.exe' }), { appid: 480, name: 'Spacewar' });
  assert.deepEqual(e.getState().session, { appid: 480, name: 'Spacewar', startedAt: c.t });
  const w = steam.watchers[0];
  assert.deepEqual(w.opts, { appid: 480, name: 'Spacewar', sessionStart: c.t });
  assert.equal(sm.sessionStart({ hwnd: '42' }).appid, 480, 'same window keeps the session');
  assert.equal(steam.watchers.length, 1);

  w.emit('unlock', { appid: 480, game: 'Spacewar', apiName: 'ACH_A', name: 'A', desc: 'd', iconUrl: 'https://evil.example/x.png' });
  assert.equal(unlocks.length, 1);
  assert.deepEqual(unlocks[0], { appid: 480, game: 'Spacewar', apiName: 'ACH_A', name: 'A', desc: 'd', iconUrl: null, coins: 75, xp: 120 });
  w.emit('unlock', { appid: 999, apiName: 'ACH_B' });
  assert.equal(unlocks.length, 1, 'unlocks for another app are ignored');

  const coins = e.getState().coins;
  w.emit('suspicious', { appid: 480, count: 40 });
  assert.ok(e.getState().flags.includes('suspicious-achievements'));
  assert.equal(e.getState().coins, coins, 'suspicious bursts award nothing');

  assert.equal(sm.sessionStop(), true);
  assert.equal(w.running, false);
  assert.equal(e.getState().session, null);
  assert.equal(sm.sessionStart({ hwnd: '7', exePath: 'C:\\Windows\\notepad.exe', sourceName: 'Untitled - Notepad' }).appid, null);
  assert.equal(steam.watchers.length, 1, 'no watcher without a Steam app');
  sm.dispose();
});

test('session: play ticks only while play mode is on, and simulateUnlock uses the schema', () => {
  const c = clock();
  const e = make(c);
  const steam = fakeSteam();
  const pi = { 42: { exePath: 'D:\\SteamLibrary\\steamapps\\common\\Spacewar\\SpaceWar.exe' } };
  const sm = new SessionManager({ economy: e, steam, now: c.now, platform: 'linux', getProcessInfo: (h) => pi[h] || null });
  sm.setPlaying(true, '42');
  assert.equal(e.getState().session.appid, 480, 'play mode starts a session from the window');
  c.add(30); sm._tick();
  c.add(30); sm._tick();
  c.add(3600); sm._tick(); // a late tick (sleep) counts as at most two intervals
  c.add(15); sm.setPlaying(false);
  assert.equal(e.getState().stats.totalPlaySeconds, 30 + 30 + 60 + 15);
  c.add(600); sm._tick();
  assert.equal(e.getState().stats.totalPlaySeconds, 135, 'no play time while not playing');

  const u = sm.simulateUnlock(480, 'ACH_WIN_ONE_GAME');
  assert.equal(u.name, 'Winner');
  assert.equal(u.game, 'Spacewar');
  assert.match(u.iconUrl, /^https:\/\/cdn\.cloudflare\.steamstatic\.com\//);
  assert.equal(sm.simulateUnlock(480, 'ACH_WIN_ONE_GAME'), null);
  assert.equal(sm.simulateUnlock('x', 'A'), null);
  sm.dispose();
});

test('session: launch polling reports each newly started Steam game once (Windows only)', async () => {
  const c = clock();
  const e = make(c);
  let game = null;
  const sm = new SessionManager({ economy: e, steam: fakeSteam(), now: c.now, platform: 'win32', pollMs: 1e9, detectSteamGame: async () => game });
  assert.equal(new SessionManager({ economy: e, platform: 'linux' }).startLaunchPolling(), false);
  assert.equal(sm.startLaunchPolling(), true);
  const seen = [];
  sm.on('gameLaunched', (g) => seen.push(g));
  game = { name: 'Old', hwnd: '1', exePath: 'C:\\x\\old.exe', startedAt: c.t - 60e3 };
  await sm.pollLaunch();
  assert.equal(seen.length, 0, 'games already running at startup are not "launched"');
  game = { name: 'SpaceWar', hwnd: '2', exePath: 'C:\\Steam\\steamapps\\common\\Spacewar\\SpaceWar.exe', startedAt: c.t + 5000 };
  await sm.pollLaunch();
  await sm.pollLaunch();
  assert.deepEqual(seen, [{ appid: 480, name: 'Spacewar', hwnd: '2', exePath: game.exePath }]);
  sm.dispose();
});

// ---- Links ------------------------------------------------------------------------

test('openLink allowlist: https, known hosts and listed developer websites only', () => {
  const dev = new Set(['example.com']);
  for (const ok of ['https://www.patreon.com/someone', 'https://ko-fi.com/x', 'https://someone.itch.io/game', 'https://store.steampowered.com/app/480/',
    'https://github.com/a/b', 'https://example.com/', 'https://www.example.com/page']) assert.ok(allowedLink(ok, dev), ok);
  for (const bad of ['http://patreon.com/x', 'https://patreon.com.evil.io/', 'https://evilpatreon.com/', 'https://user:pw@github.com/',
    'https://github.com:8443/', 'javascript:alert(1)', 'file:///C:/Windows', 'https://sub.example.com/', 'not a url', null, 42]) assert.equal(allowedLink(bad, dev), null, String(bad));
});
