// Unit tests for src/renderer/panels/logic.js (shop status, sorting, reward track, wallpapers, dev form).
const { test, before } = require('node:test');
const assert = require('node:assert/strict');

let L;
before(async () => { L = await import('../src/renderer/panels/logic.js'); });

const st = (o = {}) => ({ coins: 300, level: 5, inventory: ['owned-frame', 'matte'], equipped: { finish: 'matte', colorway: 'default', fill: null }, ...o });

test('itemStatus covers every card state', () => {
  const s = st();
  assert.equal(L.itemStatus({ id: 'matte', kind: 'finish' }, s), 'equipped');
  assert.equal(L.itemStatus({ id: 'owned-frame', kind: 'frame' }, s), 'owned');
  assert.equal(L.itemStatus({ id: 'crt-tv', kind: 'frame', starter: true }, s), 'owned');
  assert.equal(L.itemStatus({ id: 'm', kind: 'frame', mod: { id: 'x' } }, s), 'owned');
  assert.equal(L.itemStatus({ id: 'a', price: { coins: 200 } }, s), 'buy');
  assert.equal(L.itemStatus({ id: 'b', price: { coins: 400 } }, s), 'short');
  assert.equal(L.itemStatus({ id: 'c', price: { usd: 2.99 } }, s), 'dlc');
  assert.equal(L.itemStatus({ id: 'd', price: null, dlc: { appid: null } }, s), 'dlc');
  assert.equal(L.itemStatus({ id: 'e', unlockLevel: 9 }, s), 'level');
  assert.equal(L.itemStatus({ id: 'f' }, s), 'locked');
  assert.equal(L.coinsShort({ price: { coins: 400 } }, s), 100);
  assert.equal(L.coinsShort({ price: { coins: 100 } }, s), 0);
});

test('filter and sort: rarity, owned, featured order, stable names', () => {
  const s = st();
  const items = [
    { id: 'owned-frame', name: 'Owned', rarity: 'rare' },
    { id: 'z', name: 'Zed', rarity: 'epic', price: { coins: 100 } },
    { id: 'y', name: 'Yak', rarity: 'common', price: { coins: 900 } },
    { id: 'x', name: 'Xi', rarity: 'legendary', price: { usd: 1 } },
    { id: 'w', name: 'Wu', rarity: 'common', unlockLevel: 20 },
  ];
  assert.deepEqual(L.filterItems(items, { rarity: 'common' }, s).map(i => i.id), ['y', 'w']);
  assert.deepEqual(L.filterItems(items, { hideOwned: true }, s).map(i => i.id), ['z', 'y', 'x', 'w']);
  assert.deepEqual(L.sortItems(items, 'featured', s).map(i => i.id), ['z', 'y', 'w', 'x', 'owned-frame']);
  assert.deepEqual(L.sortItems(items, 'rarity', s).map(i => i.id), ['x', 'z', 'owned-frame', 'y', 'w']);
  assert.deepEqual(L.sortItems(items, 'price', s).map(i => i.id), ['owned-frame', 'z', 'y', 'w', 'x']);
});

test('level rewards fill in unlock levels; takedowns hide items', () => {
  const levels = [{ level: 2, rewards: { items: ['a'] } }, { level: 7, rewards: { items: ['b', 'a'] } }];
  assert.deepEqual([...L.rewardLevels(levels)], [['a', 2], ['b', 7]]);
  const out = L.withRewardLevels([{ id: 'a' }, { id: 'b', price: { coins: 5 } }, { id: 'c', unlockLevel: 3 }], levels);
  assert.deepEqual(out.map(i => i.unlockLevel), [2, undefined, 3]);
  assert.deepEqual(L.withoutTakedowns([{ id: 'a' }, { id: 'b' }], { removed: [{ id: 'b', date: '2026-10-01', reason: 'DMCA' }] }).map(i => i.id), ['a']);
  assert.deepEqual(L.withoutTakedowns([{ id: 'a' }], null).map(i => i.id), ['a']);
});

test('rewardTrack: 100 levels, claimed / next / locked, milestones', () => {
  const t = L.rewardTrack([{ level: 2, rewards: { coins: 20, items: ['px-pocket'] } }, { level: 10, rewards: { coins: 280 }, milestone: true }], 3);
  assert.equal(t.length, 100);
  assert.deepEqual(t.slice(0, 4).map(n => n.state), ['claimed', 'claimed', 'claimed', 'next']);
  assert.equal(t[4].state, 'locked');
  assert.deepEqual(t[1].items, ['px-pocket']);
  assert.equal(t[9].milestone, true);
  assert.equal(t[19].milestone, true); // every 10th
  assert.equal(L.rewardTrack([], 100).every(n => n.state === 'claimed'), true);
});

test('formatting helpers', () => {
  assert.equal(L.fmtDuration(3725), '1h 2m');
  assert.equal(L.fmtDuration(59), '0m');
  assert.equal(L.fmtDuration(400000), '111h');
  assert.equal(L.fmtUsd(123456), '$1,234.56');
  assert.equal(L.parseUsd('$1,200.5'), 120050);
  assert.equal(L.parseUsd('7'), 700);
  assert.equal(L.parseUsd('1.234'), null);
  assert.equal(L.parseUsd('-3'), null);
  assert.deepEqual(L.splitRevenue(999), { devs: 699, kayboro: 300 });
  assert.equal(L.levelProgress({ xpIntoLevel: 30, xpForNext: 60 }), 0.5);
  assert.equal(L.levelProgress({ xpForNext: 0 }), 1);
  assert.equal(L.initials('Sample Studio (example listing)'), 'SS');
  assert.equal(L.rankTitle(12), 'Arcade Regular');
});

test('steamIcon allows only https Steam CDN hosts', () => {
  assert.equal(L.steamIcon('https://cdn.cloudflare.steamstatic.com/a.jpg'), 'https://cdn.cloudflare.steamstatic.com/a.jpg');
  assert.equal(L.steamIcon('http://cdn.cloudflare.steamstatic.com/a.jpg'), null);
  assert.equal(L.steamIcon('https://evil.example/a.jpg'), null);
  assert.equal(L.steamIcon('javascript:alert(1)'), null);
});

test('wallpapers: four sources in one gallery, references, presets', () => {
  const resolve = f => `file:///app/${f}`;
  const g = L.buildGallery({
    catalog: [
      { id: 'wp-aurora', name: 'Aurora', media: { type: 'screensaver', fill: 'aurora' } },
      { id: 'wp-hills', name: 'Hills', media: { type: 'image', file: 'wallpapers/hills.gif' }, preview: 'wallpapers/hills-thumb.png', credit: { artist: 'A' } },
      { id: 'm1', name: 'Mod clip', media: { type: 'video' }, url: 'file:///mods/x/clip.webm', mod: { id: 'x', name: 'X' } },
    ],
    we: [{ id: '42', title: 'Rain', type: 'video', previewUrl: 'file:///we/42/p.gif', fileUrl: 'file:///we/42/v.mp4', usable: true },
      { id: '43', title: 'Koi', type: 'scene', previewUrl: null, fileUrl: null, usable: false }],
    files: ['file:///C:/Pics/My%20Cat.png', 'file:///C:/Pics/My%20Cat.png'],
    resolve,
  });
  assert.deepEqual(g.map(w => `${w.source}:${w.type}:${w.usable}`),
    ['kayboro:screensaver:true', 'kayboro:gif:true', 'mod:video:true', 'we:video:true', 'we:scene:false', 'file:image:true']);
  assert.equal(g[1].url, 'file:///app/wallpapers/hills.gif');
  assert.equal(g[1].preview, 'file:///app/wallpapers/hills-thumb.png');
  assert.equal(g[0].fill, 'aurora');
  assert.equal(g[5].name, 'My Cat.png');
  assert.deepEqual(L.countBySource(g), { all: 6, kayboro: 2, mod: 1, we: 2, file: 1 });
  assert.deepEqual(L.filterGallery(g, 'we').map(w => w.id), ['42', '43']);
  assert.deepEqual(L.filterGallery(g, 'all', 'ra').map(w => w.name), ['Aurora', 'Rain']);

  assert.deepEqual(L.refOf(g[3]), { source: 'we', id: '42' });
  assert.deepEqual(L.refOf(g[5]), { source: 'file', url: 'file:///C:/Pics/My%20Cat.png' });
  assert.equal(L.sameRef({ source: 'wallpaper-engine', id: 42 }, { source: 'we', id: '42' }), true);
  assert.equal(L.resolveRef({ source: 'catalog', id: 'wp-hills' }, g).name, 'Hills');
  assert.equal(L.resolveRef({ source: 'file', url: 'file:///x/clip.mp4' }, g).type, 'video');
  assert.equal(L.resolveRef({ source: 'we', id: 'gone' }, g), null);
  assert.equal(L.normRef({ source: 'nope', id: 'a' }), null);

  const sum = { screens: 2, frames: ['px-crt'], background: 'color', wallpaperOnly: false };
  assert.deepEqual(L.presetsOf({ presets: [{ slot: 0, empty: false, name: 'Cozy', summary: sum, wallpaper: null }, { slot: 1, empty: true }, { slot: 'x' }] }),
    [{ slot: 0, empty: false, name: 'Cozy', summary: sum, wallpaper: null }, { slot: 1, empty: true, name: null, summary: null, wallpaper: null }]);
  assert.deepEqual(L.presetsOf({ presets: [{ slot: 0, name: 'Wallpaper', summary: { wallpaperOnly: true }, wallpaper: { source: 'mod', id: 'm1' } }] })[0].wallpaper, { source: 'mod', id: 'm1' });
  assert.deepEqual(L.presetsOf({}), []);
  assert.deepEqual(L.activeRef({ activeWallpaper: { stage: { source: 'we', id: '42' }, fill: null } }, 'stage'), { source: 'we', id: '42' });
  assert.equal(L.activeRef({ activeWallpaper: { stage: null, fill: null } }, 'fill'), null);
  assert.deepEqual(L.activeRef({ activeWallpaper: { source: 'file', url: 'file:///a.png' } }, 'stage'), { source: 'file', url: 'file:///a.png' });
});

test('developer form validation', () => {
  const good = { name: ' Tiny Lantern ', email: 'hi@tiny.example', games: [{ name: 'Moonlit', appid: '1145360' }, { name: '', appid: '' }],
    kofi: 'ko-fi.com/tiny', paypal: 'paypal.me/tiny', patreon: '', website: 'tiny.example', notes: 'hello', agree: true };
  const r = L.validateDevForm(good);
  assert.equal(r.ok, true, JSON.stringify(r.errors));
  assert.deepEqual(r.value.games, [{ name: 'Moonlit', appid: 1145360 }]);
  assert.equal(r.value.name, 'Tiny Lantern');
  assert.equal(r.value.kofi, 'https://ko-fi.com/tiny');
  assert.equal(r.value.paypal, 'https://paypal.me/tiny');
  assert.equal(r.value.website, 'https://tiny.example/');
  assert.equal(L.validateDevForm({ ...good, paypal: 'pay@tiny.example' }).value.paypal, 'pay@tiny.example');

  const bad = L.validateDevForm({ name: '', email: 'nope', games: [{ name: 'X', appid: 'abc' }], kofi: 'https://evil.example/tiny', paypal: 'cash', agree: false });
  assert.equal(bad.ok, false);
  for (const k of ['name', 'email', 'games.0', 'kofi', 'paypal', 'payout', 'agree']) assert.ok(bad.errors[k], `expected error for ${k}`);
  assert.ok(L.validateDevForm({ ...good, games: [] }).errors.games);
  assert.ok(L.validateDevForm({ ...good, kofi: '', paypal: '', patreon: '' }).errors.payout);
  assert.ok(L.validateDevForm({ ...good, kofi: 'http://ko-fi.com/tiny' }).errors.kofi);
});

test('play stats and developer lookup', () => {
  const s = { stats: { perApp: { 10: { name: 'A', playSeconds: 60, achievements: 1 }, 20: { name: 'B', playSeconds: 600, achievements: 0 } } } };
  assert.deepEqual(L.gameStats(s).map(g => g.appid), [20, 10]);
  const devs = [{ devId: 'd', apps: [{ appid: 20, name: 'B' }] }];
  assert.equal(L.devForApp(devs, '20').devId, 'd');
  assert.equal(L.devForApp(devs, 10), null);
  assert.equal(L.devForApp(devs, null), null);
});
