// Unit tests for src/main/economy: level curve, catalog, time-spent rewards, spending, wallpapers,
// settings, takedowns, the hosted-game session and the activity tracker.
const { test, after } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { EventEmitter } = require('node:events');

const P = require('../src/main/economy/progression');
const catalogLib = require('../src/main/economy/catalog');
const { Economy, RULES } = require('../src/main/economy/economy');
const { SessionManager } = require('../src/main/economy/session');
const { ActivityTracker } = require('../src/main/economy/activity');
const { allowedLink } = require('../src/main/economy/ipc');

const TMP = fs.mkdtempSync(path.join(os.tmpdir(), 'shellcade-eco-'));
after(() => fs.rmSync(TMP, { recursive: true, force: true }));
let n = 0;
const freshDir = () => path.join(TMP, String(++n));

const FRAME_IDS = ['px-pocket', 'px-crt', 'px-pet-egg', 'px-arcade', 'px-dungeon', 'px-cloud-castle', 'px-cat-monitor', 'px-space-console',
  'vx-sakura-handheld', 'vx-magical-compact', 'vx-mecha-hud', 'vx-cozy-wood-tv', 'vx-neko-tv', 'vx-synthwave', 'vx-ufo-pet', 'vx-gallery'];
const STARTER_IDS = ['crt-tv', 'virtual-pet', 'handheld', 'arcade', 'bezel'];

const clock = () => {
  const c = { t: new Date(2026, 0, 5, 10).getTime() };
  c.now = () => c.t;
  c.add = (sec) => { c.t += sec * 1000; };
  return c;
};

// Real catalog plus test-only items: a paid frame, a DLC frame and a coin-or-level epic frame.
const testCatalog = (extra = {}) => {
  const cat = catalogLib.load();
  return { ...cat, frames: [...cat.frames,
    { id: 't-paid', name: 'Paid', kind: 'frame', rarity: 'legendary', price: { usd: 4.99 }, unlockLevel: null, file: 'frames/t.svg' },
    { id: 't-dlc', name: 'DLC', kind: 'frame', rarity: 'legendary', price: null, unlockLevel: null, dlc: { appid: 999 }, file: 'frames/t3.svg' },
    { id: 't-epic', name: 'Epic', kind: 'frame', rarity: 'epic', price: { coins: 900 }, unlockLevel: 60, file: 'frames/t2.svg' }], ...extra };
};
const make = (c = clock(), dir = freshDir(), cat = testCatalog()) => new Economy({ dir, now: c.now, catalog: cat });
const levelCoins = (level) => catalogLib.load().levels.filter((r) => r.level > 1 && r.level <= level).reduce((t, r) => t + r.rewards.coins, 0);

// ---- Progression ---------------------------------------------------------------

test('progression: monotonic curve, quick early levels, level 100 after ~60 h of use', () => {
  assert.equal(P.xpForLevel(1), 0);
  let prevStep = 0;
  for (let l = 2; l <= 100; l++) {
    const step = P.xpForLevel(l) - P.xpForLevel(l - 1);
    assert.ok(step > 0 && step >= prevStep, `level ${l} step ${step}`);
    prevStep = step;
    assert.equal(P.levelFromXp(P.xpForLevel(l)), l);
    assert.equal(P.levelFromXp(P.xpForLevel(l) - 1), l - 1);
  }
  const minutes = (l) => P.xpForLevel(l) / RULES.time.xpPerMinute;
  assert.ok(minutes(2) <= 6 && minutes(5) <= 30, 'first levels within minutes');
  assert.ok(Math.abs(minutes(100) / 60 - 60) < 1, `level 100 at ${minutes(100) / 60} h`);
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
  assert.deepEqual(levels.filter((r) => r.milestone).map((r) => r.level), [10, 25, 50, 75, 100]);
  let prev = 0;
  for (const r of levels) {
    assert.equal(r.xpRequired, P.xpForLevel(r.level), `level ${r.level}`);
    if (r.level === 1 || r.milestone) continue;
    assert.ok(r.rewards.coins >= 20 && r.rewards.coins <= 150 && r.rewards.coins >= prev, `coins at ${r.level}`);
    prev = r.rewards.coins;
  }
  const at = new Map(levels.flatMap((r) => r.rewards.items.map((id) => [id, r.level])));
  assert.equal(levels.flatMap((r) => r.rewards.items).length, at.size, 'no item granted twice');
  for (const id of FRAME_IDS) assert.ok(at.has(id), `${id} unlocks somewhere`);
  assert.equal(at.get('vx-gallery'), 100);
  const known = new Set([...FRAME_IDS, ...finishes, ...colorways, ...fills].map((x) => x.id || x));
  for (const id of at.keys()) assert.ok(known.has(id), `unknown reward ${id}`);
  for (const it of [...finishes, ...colorways, ...fills]) if (it.unlockLevel) assert.equal(at.get(it.id), it.unlockLevel, it.id);
});

// ---- Catalog --------------------------------------------------------------------

test('catalog: cosmetic ids, prices, wallpapers and the built-in starters', async () => {
  const cat = catalogLib.load();
  assert.deepEqual(cat.finishes.map((f) => f.id), ['none', 'matte', 'gloss', 'holo', 'pearl', 'glitter']);
  assert.deepEqual(cat.fills.map((f) => f.id), ['starfield', 'bubbles', 'plasma', 'pixel-rain', 'sakura-petals', 'aurora']);
  assert.deepEqual(cat.colorways.map((f) => f.id).sort(), ['berry', 'clear', 'default', 'gold', 'midnight', 'mint', 'mono', 'sunset']);
  const f = Object.fromEntries(cat.finishes.map((x) => [x.id, x]));
  assert.deepEqual([f.matte.unlockLevel, f.gloss.unlockLevel, f.holo.unlockLevel], [3, 10, 25]);
  assert.deepEqual([f.pearl.price, f.glitter.price, f.none.price], [{ coins: 400 }, { coins: 650 }, null]);
  assert.equal(cat.developers[0].sample, true);
  assert.deepEqual(cat.takedowns, []);
  assert.equal('backdrops' in cat, false);

  // Three original screensaver wallpapers, free, with previews on disk.
  assert.ok(cat.wallpapers.length >= 3);
  for (const w of cat.wallpapers) {
    assert.equal(w.kind, 'wallpaper'); assert.equal(w.price, null);
    if (w.media.type === 'screensaver') assert.ok(catalogLib.SCREENSAVERS.includes(w.media.fill), w.id);
    else assert.match(w.media.url, /^file:\/\//);
    assert.match(w.previewUrl, /^file:\/\//, w.id);
    assert.ok(fs.existsSync(path.join(catalogLib.RENDERER, w.preview)), w.preview);
  }

  // Starters mirror the renderer's frames.js.
  const F = await import('../src/renderer/frames/frames.js');
  for (const id of STARTER_IDS) {
    const a = cat.frames.find((x) => x.id === id), b = F.frameById(id);
    assert.ok(a && a.starter && a.price === null, id);
    assert.deepEqual(a.size, b.size); assert.deepEqual(a.hole, b.hole); assert.equal(a.aspect, b.aspect);
  }
  const ids = ['frames', 'finishes', 'colorways', 'fills', 'wallpapers'].flatMap((k) => cat[k].map((x) => x.id));
  assert.equal(new Set(ids).size, ids.length, 'item ids are unique across kinds');
});

test('catalog: wallpaper and dlc normalization, takedowns hide items everywhere', () => {
  const R = catalogLib.RENDERER;
  const res = (f, re) => (re.test(String(f)) ? 'file:///x/' + f : null);
  assert.equal(catalogLib.normWallpaper({ id: 'a', media: { type: 'screensaver', fill: 'nope' } }, res), null);
  assert.equal(catalogLib.normWallpaper({ id: 'a', media: { type: 'video', file: 'x.png' } }, res), null);
  assert.equal(catalogLib.normWallpaper({ id: '../a', media: { type: 'video', file: 'x.mp4' } }, res), null);
  const w = catalogLib.normWallpaper({ id: 'a', name: 'A', media: { type: 'video', file: 'x.mp4' }, price: { coins: 50 }, credit: { artist: 'Z', url: 'javascript:x' } }, res);
  assert.deepEqual([w.media.url, w.price, w.credit.url], ['file:///x/x.mp4', null, null], 'wallpapers are never priced');
  assert.ok(R.endsWith('renderer'));
  assert.deepEqual(catalogLib.normItem({ id: 'd', file: 'frames/d.svg', dlc: { appid: 123 } }, 'frame').dlc, { appid: 123 });
  assert.deepEqual(catalogLib.normItem({ id: 'd', file: 'frames/d.svg', dlc: {} }, 'frame').dlc, { appid: null });

  const base = catalogLib.load();
  const cat = catalogLib.finish({ ...base, takedowns: ['px-crt', 'wp-night-rain', 'sample-studio'] }, { frames: [{ id: 'm1', kind: 'frame', mod: { id: 'm' } }] }, ['m1']);
  assert.ok(!cat.frames.some((x) => x.id === 'px-crt' || x.id === 'm1'));
  assert.ok(!cat.wallpapers.some((x) => x.id === 'wp-night-rain'));
  assert.ok(!cat.levels.some((r) => r.rewards.items.includes('px-crt')), 'not offered as a level reward either');
  assert.equal(cat.developers.length, 0);
  assert.deepEqual(cat.takedowns.sort(), ['m1', 'px-crt', 'sample-studio', 'wp-night-rain']);
});

// ---- Economy: earning -----------------------------------------------------------

test('economy: fresh profile owns the starters and free items', () => {
  const s = make().getState();
  assert.equal(s.coins, 0); assert.equal(s.xp, 0); assert.equal(s.level, 1);
  assert.equal(s.xpForNext, P.xpForLevel(2));
  for (const id of [...STARTER_IDS, 'none', 'default', 'starfield']) assert.ok(s.inventory.includes(id), id);
  for (const id of ['matte', 'pearl', 'clear', 't-paid', 't-dlc', 't-epic']) assert.ok(!s.inventory.includes(id), id);
  assert.deepEqual(s.equipped, { finish: 'none', colorway: 'default', fill: 'starfield' });
  assert.deepEqual(s.wallpaperPresets, []);
  assert.deepEqual(s.activeWallpaper, { stage: null, fill: null });
  assert.deepEqual(s.stats, { totalPlaySeconds: 0, achievements: 0, perApp: {} });
  assert.deepEqual(s.settings, { rewards: { achievements: false } });
  assert.equal(s.session, null);
  assert.equal('flags' in s, false);
});

test('economy: time spent pays 1 coin + 10 XP per minute, no caps, fractions carry over', () => {
  const e = make();
  assert.deepEqual(e.addTime(30), { coins: 0, xp: 0 });
  assert.deepEqual(e.addTime(45), { coins: 1, xp: 10 }, '75 s: one whole minute');
  assert.deepEqual(e.addTime(45), { coins: 1, xp: 10 }, '120 s: two');
  assert.equal(e.addTime(0), null);
  assert.equal(e.addTime(-5), null);
  assert.equal(e.addTime(NaN), null);
  const spacewar = { appid: 480, name: 'Spacewar' };
  for (let i = 0; i < 600; i++) e.addTime(60, spacewar); // 10 h, no daily cap
  e.addTime(90, { appid: null, name: 'Notepad' });
  const s = e.getState();
  assert.equal(s.xp, 10 * 603);
  assert.equal(s.coins, 603 + levelCoins(s.level));
  assert.equal(s.stats.totalPlaySeconds, 120 + 36000 + 90);
  assert.deepEqual(s.stats.perApp, { 480: { name: 'Spacewar', playSeconds: 36000, achievements: 0 } }, 'only Steam apps are tracked per appid');
  const again = make(clock(), e.dir).getState();
  assert.deepEqual([again.coins, again.xp, again.stats], [s.coins, s.xp, s.stats], 'saved in state.json');
});

test('economy: levelling up grants levels.json rewards once and emits levelUp', () => {
  const e = make();
  const ups = [];
  e.on('levelUp', (x) => ups.push(x));
  e.grant({ xp: P.xpForLevel(4) });
  assert.deepEqual(ups.map((u) => u.level), [2, 3, 4]);
  assert.deepEqual(ups[0].rewards, { coins: 20, items: ['px-pocket'] });
  const s = e.getState();
  assert.equal(s.coins, levelCoins(4));
  for (const id of ['px-pocket', 'matte', 'vx-cozy-wood-tv']) assert.ok(s.inventory.includes(id), id);
  e.grant({ xp: 1 });
  assert.equal(ups.length, 3);
  const e2 = make(clock(), e.dir);
  assert.equal(e2.getState().coins, s.coins, 'no double rewards after a reload');
  e2.grant({ xp: 1e9 });
  assert.equal(e2.getState().level, 100);
  assert.ok(e2.getState().inventory.includes('vx-gallery'));
  const log = fs.readFileSync(path.join(e.dir, 'history.jsonl'), 'utf8').trim().split('\n').map(JSON.parse);
  assert.equal(log.filter((x) => x.type === 'levelup').length, 99);
});

test('economy: achievement rewards are off by default; on, +50 coins +120 XP once each', () => {
  const e = make();
  const ach = { appid: 480, game: 'Spacewar', apiName: 'ACH_WIN', name: 'Winner', iconUrl: 'https://cdn.cloudflare.steamstatic.com/x.jpg' };
  assert.equal(e.awardAchievement(ach), null);
  const seen = [];
  e.on('settings', (s) => seen.push(s));
  assert.deepEqual(e.setSettings({ rewards: { achievements: true } }), { rewards: { achievements: true } });
  assert.deepEqual(e.setSettings({ rewards: { achievements: 'yes' }, junk: 1 }), { rewards: { achievements: true } }, 'only booleans');
  assert.equal(seen.length, 1);
  const order = [];
  e.on('unlock', (u) => order.push('unlock'));
  e.on('levelUp', (l) => order.push('level:' + l.level));
  const a = e.awardAchievement(ach);
  assert.deepEqual([a.coins, a.xp, a.name], [50, 120, 'Winner']);
  assert.deepEqual(order, ['unlock', 'level:2', 'level:3'], 'unlock before the level-ups it causes');
  assert.equal(e.awardAchievement(ach), null, 'pays once');
  assert.equal(e.awardAchievement({ appid: 620, apiName: 'ACH_WIN' }).coins, 50, 'apiName is per app');
  assert.equal(e.awardAchievement({ appid: null, apiName: 'X' }), null);
  const s = e.getState();
  assert.equal(s.stats.achievements, 2);
  assert.deepEqual(s.stats.perApp['480'], { name: 'Spacewar', playSeconds: 0, achievements: 1 });
  assert.deepEqual(make(clock(), e.dir).getSettings(), { rewards: { achievements: true } }, 'settings persist');
});

// ---- Economy: spending and choices ----------------------------------------------

test('economy: purchases (coins only), DLC and their failure reasons', () => {
  const e = make();
  const r = (id) => e.purchase(id).reason;
  assert.equal(r('pearl'), 'insufficient');
  assert.equal(r('t-paid'), 'paid');
  assert.equal(r('t-dlc'), 'paid', 'DLC is not sold for coins');
  assert.equal(r('matte'), 'locked');
  assert.equal(r('none'), 'owned');
  assert.equal(r('nope'), 'unknown');
  e.grant({ coins: 1000 });
  const ok = e.purchase('pearl');
  assert.equal(ok.ok, true);
  assert.equal(ok.state.coins, 600);
  assert.ok(ok.state.inventory.includes('pearl'));
  assert.equal(r('t-epic'), 'insufficient', 'epic frames can be bought before their level');
  e.grant({ coins: 300 });
  assert.equal(e.purchase('t-epic').ok, true);
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

test('economy: wallpapers are free; presets cost 200 coins each with no maximum', () => {
  const e = make();
  const we = { source: 'we', id: '2846051789' };
  const file = { source: 'file', url: 'file:///C:/Users/me/Videos/loop.mp4' };
  // The active wallpaper: any source, any time, stage or shell fill.
  assert.deepEqual(e.setActiveWallpaper({ source: 'shellcade', id: 'wp-nebula-drift' }).state.activeWallpaper.stage, { source: 'shellcade', id: 'wp-nebula-drift' });
  assert.deepEqual(e.setActiveWallpaper(file, 'fill').state.activeWallpaper, { stage: { source: 'shellcade', id: 'wp-nebula-drift' }, fill: file });
  assert.equal(e.setActiveWallpaper(we, 'stage').ok, true);
  assert.equal(e.setActiveWallpaper({ source: 'shellcade', id: 'nope' }).reason, 'unknown');
  assert.equal(e.setActiveWallpaper({ source: 'file', url: 'https://evil.example/x.mp4' }).reason, 'invalid');
  assert.equal(e.setActiveWallpaper({ source: 'we', id: '../x' }).reason, 'invalid');
  assert.equal(e.setActiveWallpaper(we, 'hat').reason, 'target');
  assert.equal(e.equip('fill', 'starfield').state.activeWallpaper.fill, null, 'equipping a fill replaces a wallpaper fill');
  assert.equal(e.setActiveWallpaper(null).state.activeWallpaper.stage, null);
  assert.equal(e.getState().coins, 0, 'none of that cost anything');

  assert.equal(e.buyWallpaperPreset().reason, 'insufficient');
  assert.equal(e.setWallpaperPreset(0, we).reason, 'slot');
  e.grant({ coins: 200 * 15 });
  const coins = e.getState().coins;
  for (let i = 0; i < 15; i++) assert.equal(e.buyWallpaperPreset().ok, true, `slot ${i + 1}`);
  assert.equal(e.purchase('wallpaper-preset').reason, 'insufficient', 'purchase() routes the preset product');
  const s = e.getState();
  assert.equal(s.wallpaperPresets.length, 15);
  assert.equal(s.coins, coins - 3000);
  assert.equal(e.setWallpaperPreset(1, we).ok, true);
  assert.equal(e.setWallpaperPreset(2, file).ok, true);
  assert.equal(e.setWallpaperPreset(3, { source: 'mars', id: 'x' }).reason, 'invalid');
  assert.equal(e.setWallpaperPreset(15, we).reason, 'slot');
  assert.equal(e.setWallpaperPreset(1.5, we).reason, 'slot');
  const p = make(clock(), e.dir).getState().wallpaperPresets;
  assert.deepEqual(p.slice(0, 3), [{ slot: 0, wallpaper: null }, { slot: 1, wallpaper: we }, { slot: 2, wallpaper: file }], 'presets persist');
  assert.equal(e.setWallpaperPreset(1, null).state.wallpaperPresets[1].wallpaper, null);
});

test('economy: taken-down items disappear from inventory, equipped looks and wallpapers', () => {
  const dir = freshDir();
  const e = make(clock(), dir);
  e.grant({ coins: 2000 });
  e.purchase('pearl');
  e.purchase('plasma');
  e.equip('finish', 'pearl');
  e.equip('fill', 'plasma');
  e.buyWallpaperPreset();
  e.setWallpaperPreset(0, { source: 'shellcade', id: 'wp-deep-lagoon' });
  e.setActiveWallpaper({ source: 'shellcade', id: 'wp-deep-lagoon' }, 'stage');
  e.setActiveWallpaper({ source: 'we', id: '777' }, 'fill');

  const base = catalogLib.load();
  const gone = testCatalog(catalogLib.finish({ ...base, takedowns: ['pearl', 'plasma', 'wp-deep-lagoon', '777'] }, null));
  const s = make(clock(), dir, gone).getState();
  for (const id of ['pearl', 'plasma']) assert.ok(!s.inventory.includes(id), id);
  assert.deepEqual(s.equipped, { finish: 'none', colorway: 'default', fill: 'starfield' }, 'falls back to the defaults');
  assert.deepEqual(s.wallpaperPresets, [{ slot: 0, wallpaper: null }]);
  assert.deepEqual(s.activeWallpaper, { stage: null, fill: null });
});

test('economy: mod items are free and owned', () => {
  const cat = testCatalog({ colorways: [...catalogLib.load().colorways, { id: 'm-cw', kind: 'colorway', mod: { id: 'm' }, price: null }] });
  const e = make(clock(), freshDir(), cat);
  assert.ok(e.getState().inventory.includes('m-cw'));
  assert.equal(e.equip('colorway', 'm-cw').ok, true);
});

// ---- Session and time tracking ------------------------------------------------------

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
const SPACEWAR = 'C:\\Steam\\steamapps\\common\\Spacewar\\SpaceWar.exe';

test('session: the achievement watcher only runs while achievement rewards are on', () => {
  const c = clock();
  const e = make(c);
  const steam = fakeSteam();
  const sm = new SessionManager({ economy: e, steam, now: c.now, platform: 'linux' });
  e.on('settings', () => sm.refreshWatcher());
  assert.equal(sm.sessionStart({}), null);
  assert.deepEqual(sm.sessionStart({ hwnd: '42', exePath: SPACEWAR }), { appid: 480, name: 'Spacewar' });
  assert.deepEqual(e.getState().session, { appid: 480, name: 'Spacewar', startedAt: c.t });
  assert.deepEqual(sm.app(), { appid: 480, name: 'Spacewar' });
  assert.equal(steam.watchers.length, 0, 'off by default: no watcher');

  e.setSettings({ rewards: { achievements: true } });
  const w = steam.watchers[0];
  assert.ok(w && w.running);
  assert.deepEqual(w.opts, { appid: 480, name: 'Spacewar', sessionStart: c.t });
  assert.equal(sm.sessionStart({ hwnd: '42' }).appid, 480, 'same window keeps the session');
  assert.equal(steam.watchers.length, 1);
  const unlocks = [];
  e.on('unlock', (u) => unlocks.push(u));
  w.emit('unlock', { appid: 480, game: 'Spacewar', apiName: 'ACH_A', name: 'A', desc: 'd', iconUrl: 'https://evil.example/x.png' });
  assert.deepEqual(unlocks, [{ appid: 480, game: 'Spacewar', apiName: 'ACH_A', name: 'A', desc: 'd', iconUrl: null, coins: 50, xp: 120 }]);
  w.emit('unlock', { appid: 999, apiName: 'ACH_B' });
  assert.equal(unlocks.length, 1, 'unlocks for another app are ignored');

  e.setSettings({ rewards: { achievements: false } });
  assert.equal(w.running, false, 'turning rewards off stops the watcher');
  assert.equal(sm.sessionStop(), true);
  assert.equal(e.getState().session, null);
  e.setSettings({ rewards: { achievements: true } });
  assert.equal(sm.sessionStart({ hwnd: '7', exePath: 'C:\\Windows\\notepad.exe', sourceName: 'Untitled - Notepad' }).appid, null);
  assert.equal(steam.watchers.length, 1, 'no watcher without a Steam app');
  sm.dispose();
});

test('session: simulateUnlock uses the schema and respects the setting', () => {
  const c = clock();
  const e = make(c);
  const sm = new SessionManager({ economy: e, steam: fakeSteam(), now: c.now, platform: 'linux', getProcessInfo: () => ({ exePath: SPACEWAR }) });
  sm.setPlaying(true, '42');
  assert.equal(e.getState().session.appid, 480, 'play mode starts a session from the window');
  assert.equal(sm.simulateUnlock(480, 'ACH_WIN_ONE_GAME'), null, 'rewards off');
  e.setSettings({ rewards: { achievements: true } });
  const u = sm.simulateUnlock(480, 'ACH_WIN_ONE_GAME');
  assert.deepEqual([u.name, u.game], ['Winner', 'Spacewar']);
  assert.match(u.iconUrl, /^https:\/\/cdn\.cloudflare\.steamstatic\.com\//);
  assert.equal(sm.simulateUnlock(480, 'ACH_WIN_ONE_GAME'), null);
  assert.equal(sm.simulateUnlock('x', 'A'), null);
  sm.dispose();
});

test('activity: time counts while visible or playing, credited to the hosted game', () => {
  const c = clock();
  const e = make(c);
  const win = { visible: true, minimized: false, playing: false };
  let app = null;
  const t = new ActivityTracker({ economy: e, now: c.now, tickMs: 15e3, getApp: () => app,
    isActive: () => win.playing || (win.visible && !win.minimized) });
  c.add(15); t.tick();
  c.add(15); t.tick();
  assert.equal(e.getState().stats.totalPlaySeconds, 30);
  win.minimized = true;
  c.add(10); t.tick(); // the 10 s before the minimize still count
  c.add(600); t.tick();
  assert.equal(e.getState().stats.totalPlaySeconds, 40, 'nothing while minimized');
  win.playing = true; t.tick(); // play mode with the window minimized: active again
  app = { appid: 480, name: 'Spacewar' };
  for (let i = 0; i < 8; i++) { c.add(15); t.tick(); }
  c.add(3600); t.tick(); // a late tick (sleep) counts as at most two intervals
  const s = e.getState();
  assert.equal(s.stats.totalPlaySeconds, 40 + 120 + 30);
  assert.equal(s.stats.perApp['480'].playSeconds, 150);
  assert.deepEqual([s.coins - levelCoins(s.level), s.xp], [3, 30], '1 coin + 10 XP per whole minute');
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
  game = { name: 'SpaceWar', hwnd: '2', exePath: SPACEWAR, startedAt: c.t + 5000 };
  await sm.pollLaunch();
  await sm.pollLaunch();
  assert.deepEqual(seen, [{ appid: 480, name: 'Spacewar', hwnd: '2', exePath: SPACEWAR }]);
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
