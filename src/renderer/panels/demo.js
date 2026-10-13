// Panels demo: mounts the HUD, toaster and one panel against a fake window.shell with a rich catalog
// and player state. Open demo.html in Electron, or screenshot it with demo-shot.cjs.
import { STARTERS, setCatalogFrames, frameById } from '../frames/frames.js';
import { mountHud } from './hud.js';
import { createToaster } from './toasts.js';

const q = new URLSearchParams(location.search);
if (!q.has('keep')) try { localStorage.clear(); } catch {} // same look on every run (shop tab, filters, mute)
const view = q.get('view') || 'shop';
const MIN = 60, HOUR = 3600;
const clone = o => structuredClone(o);

async function json(name) {
  try { return (await import(new URL(`../../catalog/${name}.json`, import.meta.url).href, { with: { type: 'json' } })).default; } catch { return {}; }
}

// Wallpaper-ish preview images drawn on a canvas (stand-ins for Wallpaper Engine previews).
function art(seed, w = 384, h = 216) {
  const c = document.createElement('canvas'), g = c.getContext('2d');
  c.width = w; c.height = h;
  const r = (n => () => (n = (n * 16807) % 2147483647) / 2147483647)(seed * 977 + 3);
  const hue = (seed * 67) % 360, sky = g.createLinearGradient(0, 0, 0, h);
  sky.addColorStop(0, `hsl(${hue} 60% 18%)`); sky.addColorStop(0.65, `hsl(${(hue + 40) % 360} 70% 45%)`); sky.addColorStop(1, `hsl(${(hue + 70) % 360} 80% 62%)`);
  g.fillStyle = sky; g.fillRect(0, 0, w, h);
  for (let i = 0; i < 60; i++) { g.fillStyle = `rgba(255,255,255,${r() * 0.8})`; g.fillRect(r() * w, r() * h * 0.5, 1.5, 1.5); }
  g.fillStyle = `hsl(${(hue + 50) % 360} 90% 75%)`; g.beginPath(); g.arc(w * (0.2 + r() * 0.6), h * 0.55, h * 0.18, 0, 7); g.fill();
  for (let k = 0; k < 3; k++) {
    g.fillStyle = `hsl(${(hue + 200 + k * 10) % 360} 40% ${10 + k * 6}%)`;
    g.beginPath(); g.moveTo(0, h);
    for (let x = 0; x <= w; x += 16) g.lineTo(x, h * (0.62 + k * 0.1) + Math.sin(x / (40 + k * 20) + seed + k) * 14 - r() * 10);
    g.lineTo(w, h); g.fill();
  }
  return c.toDataURL('image/png');
}

const pixel = await json('frames-pixel'), vector = await json('frames-vector');
const cat = {
  frames: [
    ...STARTERS.map(f => ({ id: f.id, name: f.name, kind: 'frame', style: 'vector', rarity: 'common', price: null, unlockLevel: null, file: `frames/${f.id}.svg`, starter: true, size: f.size, hole: f.hole, author: 'Shellcade' })),
    ...(pixel.frames || []), ...(vector.frames || []),
    { id: 'dlc-royal-cab', name: 'Royal Cabinet', kind: 'frame', style: 'vector', rarity: 'legendary', price: { usd: 2.99 }, dlc: { appid: null }, unlockLevel: null, file: 'frames/arcade.svg', size: { w: 800, h: 1000 }, hole: { x: .19, y: .2, w: .62, h: .375 }, author: 'Shellcade', desc: 'Gilded cabinet, Steam DLC.' },
    { id: 'mod-wood-bezel', name: 'Walnut Bezel', kind: 'frame', style: 'vector', rarity: 'common', price: null, unlockLevel: null, url: new URL('../frames/bezel.svg', import.meta.url).href, size: { w: 1000, h: 600 }, hole: { x: .02, y: .033, w: .96, h: .9 }, mod: { id: 'example-shell', name: 'Example Shell', author: 'Mira' } },
  ],
  finishes: (await json('finishes')).finishes || [],
  colorways: (await json('colorways')).colorways || [],
  fills: (await json('fills')).fills || [],
  backdrops: (await json('backdrops')).backdrops || [],
  levels: (await json('levels')).levels || [],
  wallpapers: [
    ...((await json('wallpapers')).wallpapers || []),
    { id: 'wp-petal-drift', kind: 'wallpaper', name: 'Petal Drift', media: { type: 'screensaver', fill: 'sakura-petals' }, credit: { artist: 'Shellcade' }, price: null },
    { id: 'wp-dusk-hills', kind: 'wallpaper', name: 'Dusk Hills', media: { type: 'image', url: art(11, 960, 540) }, preview: art(11), credit: { artist: 'Shellcade' }, price: null },
    { id: 'mod-wp-neon', kind: 'wallpaper', name: 'Neon Alley', media: { type: 'image' }, url: art(5, 960, 540), previewUrl: art(5), mod: { id: 'example-shell', name: 'Example Shell', author: 'Mira' }, price: null },
  ],
  takedowns: { removed: [] },
};
setCatalogFrames(cat.frames);
const WE = [
  { id: '2814', title: 'Lofi Rooftop Rain', type: 'video', previewUrl: art(2), fileUrl: 'file:///demo/lofi.mp4', usable: true },
  { id: '3005', title: 'Synth Sunset Drive', type: 'video', previewUrl: art(9), fileUrl: 'file:///demo/synth.mp4', usable: true },
  { id: '3122', title: 'Cozy Pixel Cafe', type: 'image', previewUrl: art(14), fileUrl: art(14, 960, 540), usable: true },
  { id: '3390', title: 'Interactive Koi Pond', type: 'scene', previewUrl: art(21), fileUrl: null, usable: false },
];

const fresh = q.has('empty');
let state = {
  coins: q.has('poor') ? 90 : fresh ? 0 : 1240, xp: fresh ? 0 : 2410, level: fresh ? 1 : 12, xpIntoLevel: fresh ? 0 : 340, xpForNext: fresh ? 50 : 600,
  inventory: [...STARTERS.map(f => f.id), 'none', 'default', 'starfield', ...(fresh ? [] : ['px-pocket', 'matte', 'vx-cozy-wood-tv', 'berry', 'px-crt', 'bubbles', 'gloss', 'px-pet-egg', 'mint'])],
  equipped: { finish: fresh ? 'none' : 'gloss', colorway: 'default', fill: 'starfield' },
  wallpaperPresets: fresh ? [] : [
    { slot: 0, wallpaper: { source: 'shellcade', id: 'wp-nebula-drift' } },
    { slot: 1, wallpaper: { source: 'we', id: '2814' } },
    { slot: 2, wallpaper: null },
  ],
  activeWallpaper: { stage: fresh ? null : { source: 'shellcade', id: 'wp-petal-drift' }, fill: null },
  stats: fresh ? { totalPlaySeconds: 0, achievements: 0, perApp: {} } : {
    totalPlaySeconds: 14 * HOUR + 22 * MIN, achievements: 23,
    perApp: {
      480: { name: 'Spacewar', playSeconds: 2 * HOUR + 5 * MIN, achievements: 2 },
      1001: { name: 'Moonlit Arcade', playSeconds: 6 * HOUR + 40 * MIN, achievements: 12 },
      1002: { name: 'Pixel Garden Story', playSeconds: 3 * HOUR + 12 * MIN, achievements: 9 },
      1003: { name: 'Hollow Lantern', playSeconds: 48 * MIN, achievements: 0 },
    },
  },
  session: q.has('nosession') || fresh ? null : { appid: q.has('unlisted') ? 1002 : 1001, name: q.has('unlisted') ? 'Pixel Garden Story' : 'Moonlit Arcade', startedAt: Date.now() - 25 * MIN * 1000 },
  flags: [],
};
const devs = [
  ...((await json('developers')).developers || []),
  { devId: 'tiny-lantern', name: 'Tiny Lantern Games', sample: false, verified: true, apps: [{ appid: 1001, name: 'Moonlit Arcade' }, { appid: 1003, name: 'Hollow Lantern' }],
    links: { patreon: 'https://patreon.com/tinylantern', kofi: 'https://ko-fi.com/tinylantern', itch: 'https://tinylantern.itch.io', website: 'https://tinylantern.example' },
    blurb: 'Two friends making cozy arcade games with too many secrets.' },
];
let settings = { rewards: { achievements: false } };
const submissions = [{ id: 's1', name: 'Bitwise Bakery', email: 'hello@bitwise.example', games: [{ name: 'Crumb Quest', appid: 2210 }], kofi: 'https://ko-fi.com/bitwise', submittedAt: Date.now() - 86400e3 * 3 }];
const mods = [
  { id: 'example-shell', name: 'Example Shell', author: 'Mira', version: '1.0.0', items: 2, errors: [] },
  { id: 'broken-mod', name: 'broken-mod', author: null, version: null, items: 0, errors: ['mod.json: "frames[0].hole" is missing'] },
];

const subs = { state: new Set(), unlock: new Set(), levelUp: new Set(), gameLaunched: new Set() };
const emit = () => { const s = clone(state); for (const f of subs.state) f(s); };
const ok = () => ({ ok: true, state: clone(state) });
const find = id => Object.values(cat).flat().find(it => it?.id === id);
window.shell = {
  getState: async () => clone(state),
  listCatalog: async () => clone(cat),
  listDevelopers: async () => clone(devs),
  purchase: async id => {
    const it = find(id);
    if (!it) return { ok: false, reason: 'unknown', state: clone(state) };
    if (it.price?.usd || it.dlc) return { ok: false, reason: 'paid', state: clone(state) };
    if (state.coins < (it.price?.coins || 0)) return { ok: false, reason: 'coins', state: clone(state) };
    state.coins -= it.price.coins; state.inventory.push(id); emit(); return ok();
  },
  equip: async (slot, id) => { state.equipped[slot] = id; emit(); return ok(); },
  buyWallpaperPreset: async () => {
    if (state.coins < 200) return { ok: false, reason: 'coins', state: clone(state) };
    state.coins -= 200; state.wallpaperPresets.push({ slot: state.wallpaperPresets.length, wallpaper: null }); emit(); return ok();
  },
  setWallpaperPreset: async (slot, wallpaper) => { const p = state.wallpaperPresets.find(x => x.slot === slot); if (p) p.wallpaper = wallpaper; emit(); return ok(); },
  setActiveWallpaper: async (wallpaper, target) => { state.activeWallpaper[target] = wallpaper; emit(); return ok(); },
  listLocalWallpapers: async () => clone(WE),
  sessionStart: async () => null, sessionStop: async () => true,
  openLink: async url => { console.log('openLink', url); return true; },
  getSettings: async () => clone(settings),
  setSettings: async p => { settings = { ...settings, ...p, rewards: { ...settings.rewards, ...p.rewards } }; return clone(settings); },
  getIntegrity: async () => (q.has('tampered') ? { ok: false, checked: 412, mismatched: ['renderer/app.js', 'renderer/frames/frames.js'], missing: ['catalog/fills.json'] } : { ok: true, checked: 412, mismatched: [], missing: [] }),
  getMods: async () => clone(mods), reloadMods: async () => clone(mods), openModsFolder: async () => true,
  submitDeveloper: async f => { const id = `s${submissions.length + 1}`; submissions.push({ ...f, id, submittedAt: Date.now() }); return { ok: true, id }; },
  listSubmissions: async () => clone(submissions),
  exportPayoutSheet: async ({ revenueCents }) => `C:\\Users\\you\\Documents\\shellcade-payouts-${revenueCents}.csv`,
  onState: cb => { subs.state.add(cb); return () => subs.state.delete(cb); },
  onUnlock: cb => { subs.unlock.add(cb); return () => subs.unlock.delete(cb); },
  onLevelUp: cb => { subs.levelUp.add(cb); return () => subs.levelUp.delete(cb); },
  onGameLaunched: cb => { subs.gameLaunched.add(cb); return () => subs.gameLaunched.delete(cb); },
};

// Stage backdrop: a soft gradient with a few "screens" so translucent UI reads like the app.
(function paintBg() {
  const c = document.getElementById('demoBg'), g = c.getContext('2d');
  c.width = innerWidth; c.height = innerHeight;
  const bg = g.createRadialGradient(innerWidth * 0.3, innerHeight * 0.2, 50, innerWidth * 0.4, innerHeight * 0.5, innerWidth * 0.8);
  bg.addColorStop(0, '#2a1d4a'); bg.addColorStop(1, '#0f0d16');
  g.fillStyle = bg; g.fillRect(0, 0, c.width, c.height);
  const img = new Image();
  img.onload = () => g.drawImage(img, innerWidth * 0.14, innerHeight * 0.16, innerHeight * 0.62 * 1.25, innerHeight * 0.62);
  img.src = frameById('crt-tv').url;
})();

const toaster = createToaster(document.getElementById('toasts'));
const panels = [];
const app = {
  state: clone(state), catalog: cat, wallpapers: [], fx: null,
  scene: { background: { type: 'screensaver', id: 'sakura-petals' } },
  sel: () => ({ id: 'a', frame: 'px-pocket' }),
  frameOf: s => frameById(s.frame),
  setFrame: id => console.log('setFrame', id),
  setBackground: b => { app.scene.background = { ...app.scene.background, ...b }; },
  async setLook(slot, id) { const r = await window.shell.equip(slot, id); app.setState(r.state); },
  setState(s) { app.state = s; for (const p of panels) p.update?.(s); },
  showTab: name => go(name),
  toast: m => toaster.show(typeof m === 'string' ? { title: m } : m),
  ror: { pickFile: async () => null },
};
window.shell.onState(s => app.setState(s));
const ctx = { shell: window.shell, app, toast: app.toast };
panels.push(mountHud(document.getElementById('hudMount'), ctx));

const panelEl = document.getElementById('panel');
let current = null;
async function go(name) {
  for (const b of document.querySelectorAll('#tabs [role=tab]')) b.setAttribute('aria-selected', String(b.dataset.v === name));
  if (current) { panels.splice(panels.indexOf(current), 1); current.destroy(); current = null; }
  const mod = { shop: ['./shop.js', 'mountShop'], profile: ['./profile.js', 'mountProfile'], devs: ['./devs.js', 'mountDevs'] }[name];
  if (!mod) return panelEl.replaceChildren();
  const m = await import(mod[0]);
  current = m[mod[1]](panelEl, ctx);
  panels.push(current);
  if (name === 'shop' && q.get('tab')) current.showTab?.(q.get('tab'));
}
document.getElementById('tabs').addEventListener('click', e => { const t = e.target.closest('[data-v]'); if (t) go(t.dataset.v); });
document.addEventListener('click', e => { const g = e.target.closest?.('[data-goto]'); if (g) go(g.dataset.goto); });

if (view === 'toasts' || view === 'gallery') await go(view === 'gallery' ? 'shop' : 'profile');
else await go(view);
if (view === 'gallery') { current.showTab('wallpapers'); setTimeout(() => document.querySelector('[aria-label="Open the big gallery"]')?.click(), 400); }
if (view === 'toasts') {
  toaster.show({ title: 'Moonlit Arcade launched', body: 'Host it in Shellcade to earn XP and coins while you play.', kind: 'info', action: { label: 'Put it in a shell', onClick() {} } });
  setTimeout(() => toaster.achievement({ appid: 1001, game: 'Moonlit Arcade', apiName: 'ACH_FIRST', name: 'High Score Hero', desc: 'Beat the high score on every cabinet.', iconUrl: null, coins: 50, xp: 120 }), 150);
  setTimeout(() => toaster.levelUp({ level: 13, rewards: { coins: 35, items: ['px-crt', 'gloss'] } }), 300);
}
if (q.has('tick')) setInterval(() => { state.coins += 1; state.xp += 10; state.xpIntoLevel = Math.min(state.xpForNext - 1, state.xpIntoLevel + 10); emit(); }, 1500);
window.__demo = { toaster, go, app, ctx, emit, state: () => state, set: s => { state = { ...state, ...s }; emit(); } };
document.body.dataset.ready = '1';
