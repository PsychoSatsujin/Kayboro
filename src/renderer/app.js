// App state + actions. Wires the Stage (rendering/mouse), the sidebar UI, the economy (window.shell),
// keyboard and main-process events. Panels and FX are optional modules: if one fails to load the app
// still runs with a built-in fallback.
import { Stage } from './stage.js';
import { initUI } from './ui.js';
import { parseAspect, scaleRect, frameOuterRect } from './layout.js';
import { frameById, setCatalogFrames, STARTERS } from './frames/frames.js';

const ror = window.ror || makeRorStub();
const shell = window.shell || makeShellStub();
const uid = () => Math.random().toString(36).slice(2, 10);
const LAST_KEY = 'shellcade.lastScene', OLD_KEY = 'ror.lastScene';
const LOOK = ['finish', 'colorway', 'fill'];
let stage, ui, saveTimer;

const optional = (path, css) => import(path).then(m => { if (css) addStylesheet(css); return m; })
  .catch(err => { console.warn(`[shellcade] ${path} unavailable: ${err?.message || err}`); return null; });
function addStylesheet(href) {
  if (!document.querySelector(`link[href="${href}"]`)) document.head.append(Object.assign(document.createElement('link'), { rel: 'stylesheet', href }));
}

const app = {
  ror, shell, scene: null, playing: false, playId: null, fullscreen: false, uiHidden: false,
  state: null, catalog: emptyCatalog(), wallpapers: [], fx: null, mods: {}, hosted: null, // hosted = { id, hwnd } of the session screen

  get(id) { return this.scene.screens.find(s => s.id === id) || null; },
  sel() { return this.get(this.scene.selectedId); },
  frameOf(s) {
    return s.customFrame?.url ? { aspect: s.customFrame.hole.w / s.customFrame.hole.h, holeRadius: 0, translucent: false, ...s.customFrame } : frameById(s.frame);
  },
  // Effective lock ratio: explicit preset, else the frame opening, else the captured source.
  aspectOf(s) {
    if (s.aspect === 'free') return null;
    if (s.aspect !== 'source') return parseAspect(s.aspect);
    return this.frameOf(s)?.aspect || stage.views.get(s.id)?.aspect || 16 / 9;
  },
  applyAspect(s) {
    const a = this.aspectOf(s), r = s.rect;
    if (a) { const h = r.w / a; s.rect = { ...r, y: r.y + (r.h - h) / 2, h }; }
  },

  // ---- Economy ----
  owns(id) { return id == null || !!this.state?.inventory?.includes(id) || !!frameById(id)?.starter; },
  item(kind, id) { return (this.catalog[kind] || []).find(it => it.id === id) || null; },
  equipped() { return this.state?.equipped || { finish: 'none', colorway: 'default', fill: null }; },
  setState(st) {
    if (!st || typeof st !== 'object') return;
    this.state = st;
    ui?.stateChanged();
    stage?.renderBg();
  },
  // Finish, colorway or shell fill: set on the selected screen and remembered as the default for new ones.
  async setLook(slot, id) {
    if (!LOOK.includes(slot)) return;
    this.update(s => { s[slot] = id; });
    const r = await shell.equip(slot, id).catch(() => null);
    if (r?.state) this.setState(r.state);
  },

  // ---- Scene ----
  changed() {
    stage.render(); ui.render();
    this.syncSession();
    clearTimeout(saveTimer);
    saveTimer = setTimeout(() => { try { localStorage.setItem(LAST_KEY, JSON.stringify(this.scene)); } catch {} }, 400);
  },
  // toast('text') or toast({ title, body, action: { label, onClick }, kind }).
  // Every toast is also announced as a 'shellcade:toast' DOM event ({ text, kind }) for tests and tooling.
  toast(msg, via = 'show') {
    const t = typeof msg === 'string' ? { title: msg } : msg || {};
    const text = via === 'achievement' ? `Achievement unlocked: ${t.name || t.apiName} +${t.coins} coins` : via === 'levelUp' ? `Level ${t.level}!` : [t.title, t.body].filter(Boolean).join(' ');
    document.dispatchEvent(new CustomEvent('shellcade:toast', { detail: { text, kind: via === 'show' ? t.kind || 'info' : via } }));
    try { ui?.toaster[via](t); } catch (err) { console.warn('[shellcade] toast failed:', err); }
  },
  select(id) { if (this.scene.selectedId !== id) { this.scene.selectedId = id; this.changed(); } },
  update(fn, id = this.scene.selectedId) { const s = this.get(id); if (s) { fn(s); this.changed(); } return s; },
  showTab(name) { ui?.showTab(name); },

  addScreen(fields = {}) {
    const z = Math.max(0, ...this.scene.screens.map(s => s.z)) + 1;
    const s = { ...blankScreen(), rect: centredRect(480, 270), z, ...fields };
    this.scene.screens.push(s);
    this.scene.selectedId = s.id;
    this.applyAspect(s);
    this.changed();
    return s;
  },
  removeScreen(id = this.scene.selectedId) {
    const list = this.scene.screens.filter(s => s.id !== id);
    if (list.length === this.scene.screens.length) return;
    this.scene.screens = list;
    if (this.scene.selectedId === id) this.scene.selectedId = [...list].sort((a, b) => b.z - a.z)[0]?.id ?? null;
    this.changed();
  },
  assignSource(src, asNew = false) {
    const fields = { sourceId: src.id, sourceName: src.name, hwnd: src.hwnd || null, exePath: src.exePath || null };
    let s;
    if (asNew || !this.sel()) s = this.addScreen(fields);
    else {
      const v = stage.views.get(this.scene.selectedId);
      if (v && !v.stream) v.sourceId = undefined; // re-picking a dead/failed source retries the capture
      s = this.update(x => Object.assign(x, fields));
    }
    if (s?.hwnd) this.host(s);
    return s;
  },
  clearSource() { this.update(s => Object.assign(s, { sourceId: null, sourceName: '', hwnd: null, exePath: null })); },
  sourceAspectChanged(id) {
    const s = this.get(id);
    if (s?.aspect === 'source' && !this.frameOf(s)) { this.applyAspect(s); this.changed(); }
  },
  setAspect(a) { this.update(s => { s.aspect = a; this.applyAspect(s); }); },
  setFit(fit) { this.update(s => { s.fit = fit; }); },
  toggleFit(id) { this.update(s => { s.fit = s.fit === 'contain' ? 'cover' : 'contain'; }, id); },
  // Picking a frame snaps the screen to the frame opening's native aspect and keeps the whole shell on the stage.
  setFrame(frameId) { this.update(s => { Object.assign(s, { frame: frameId, customFrame: null, aspect: 'source' }); this.applyAspect(s); this.fitShell(s); }); },
  setCustomFrame(cf) { this.update(s => { Object.assign(s, { frame: null, customFrame: cf, aspect: 'source' }); this.applyAspect(s); this.fitShell(s); }); },
  fitShell(s, m = 16) {
    const f = this.frameOf(s), a = stageArea();
    if (!f) return;
    const top = this.uiHidden ? m : Math.max(m, (document.getElementById('hud')?.getBoundingClientRect().bottom || 0) + 12); // clear of the HUD
    const o = frameOuterRect(s.rect, f.hole), k = Math.min(1, (a.w - 2 * m) / o.w, (a.h - top - m) / o.h);
    if (k < 1) s.rect = scaleRect(s.rect, k);
    const p = frameOuterRect(s.rect, f.hole);
    const d = (lo, len, min, max) => (lo < min ? min - lo : lo + len > max ? max - lo - len : 0);
    s.rect = { ...s.rect, x: s.rect.x + d(p.x, p.w, m, a.w - m), y: s.rect.y + d(p.y, p.h, top, a.h - m) };
  },
  setBackground(patch) { Object.assign(this.scene.background, patch); this.changed(); },
  // A wallpaper backdrop resolves to an image/video background (or the colour when its slot is empty).
  bgSource() {
    const b = this.scene.background;
    if (b.type !== 'wallpaper') return b;
    const id = this.state?.backdropSlots?.find(x => x.slot === b.slot)?.wallpaperId;
    const w = id && this.wallpapers.find(x => x.id === id);
    return w?.usable && w.fileUrl ? { ...b, type: w.type === 'video' ? 'video' : 'image', url: w.fileUrl } : { ...b, type: 'color' };
  },
  async refreshWallpapers() {
    const list = await shell.listLocalWallpapers().catch(() => []);
    this.wallpapers = Array.isArray(list) ? list : [];
    stage.renderBg();
    return this.wallpapers;
  },
  nudge(dx, dy) { this.update(s => { s.rect = { ...s.rect, x: s.rect.x + dx, y: s.rect.y + dy }; }); },
  scale(f) { this.update(s => { const r = scaleRect(s.rect, f); if (Math.min(r.w, r.h) >= 40) s.rect = r; }); },
  reorder(d) {
    const list = [...this.scene.screens].sort((a, b) => a.z - b.z), i = list.findIndex(s => s.id === this.scene.selectedId), j = i + d;
    if (i < 0 || j < 0 || j >= list.length) return;
    [list[i], list[j]] = [list[j], list[i]];
    list.forEach((s, k) => { s.z = k + 1; });
    this.changed();
  },
  loadScene(obj) {
    const sc = normalizeScene(obj);
    if (sc) { this.scene = sc; this.changed(); }
    return !!sc;
  },

  // ---- Hosted-game session: the game on the screen it was last assigned to ----
  async host(s) {
    this.hosted = { id: s.id, hwnd: s.hwnd };
    ui?.render();
    const r = await shell.sessionStart({ hwnd: s.hwnd, exePath: s.exePath || null, sourceName: s.sourceName || '' }).catch(() => null);
    if (r?.appid != null && this.hosted?.hwnd === s.hwnd) this.toast({ title: `Hosting ${r.name}`, body: 'Achievements you unlock now earn coins.', kind: 'info' });
  },
  syncSession() {
    const h = this.hosted;
    if (!h || this.get(h.id)?.hwnd === h.hwnd) return;
    this.hosted = null;
    shell.sessionStop().catch(() => {});
  },
  // "Put it in a shell" for a game that just launched.
  async adoptGame(ev) {
    const list = await ror.listSources().catch(() => []);
    const src = list.find(x => ev.hwnd && String(x.hwnd) === String(ev.hwnd)) || await ror.detectSteamGame().catch(() => null);
    if (!src) return this.toast({ title: `Could not find the ${ev.name} window`, body: 'Keep the game open, then pick it under Sources.' });
    this.assignSource(src, !!this.sel()?.sourceId);
    this.showTab('stage');
  },

  toggleUI(force) {
    this.uiHidden = force ?? !this.uiHidden;
    document.body.classList.toggle('ui-hidden', this.uiHidden);
  },
  async setFullscreen(on) {
    if (await ror.setFullscreen(!!on).catch(() => false)) this.fullscreen = !!on;
    ui.render();
  },
  setPlaying(on) {
    this.playing = !!on;
    document.body.classList.toggle('playing', this.playing);
    if (!this.playing) stage.showCursor(null);
    ui.render();
  },
  async togglePlay() {
    if (this.playing) { await ror.stopPlay().catch(() => false); return this.setPlaying(false); }
    const s = this.sel();
    // Monitor sources (e.g. a virtual display) have no hwnd: drive the latest Steam game instead.
    const hwnd = s && (s.hwnd || (await ror.detectSteamGame().catch(() => null))?.hwnd);
    if (!hwnd) return this.toast({ title: 'Select a screen showing a game window to play.', body: 'Pick the game under Sources first.' });
    this.playId = s.id;
    if (await ror.startPlay(hwnd).catch(() => false)) this.setPlaying(true);
    else this.toast(ror.stub ? 'Play mode needs the Shellcade desktop app.' : 'Could not start play mode.');
  },
};

function blankScreen() {
  const eq = app.equipped();
  return { id: uid(), sourceId: null, sourceName: '', hwnd: null, exePath: null, rect: { x: 80, y: 80, w: 480, h: 270 },
    aspect: 'source', fit: 'contain', frame: null, customFrame: null, z: 1, visible: true,
    finish: eq.finish ?? 'none', colorway: eq.colorway ?? 'default', fill: eq.fill ?? null };
}

// Visible stage: the window minus the sidebar (full width when the sidebar is hidden).
function stageArea() {
  const side = app.uiHidden ? 0 : document.getElementById('ui')?.offsetWidth || 0;
  return { w: Math.max(innerWidth - side, 1), h: innerHeight };
}

// A w x h rect centred in the visible stage (shrunk to fit if the stage is smaller).
function centredRect(w, h) {
  const a = stageArea(), k = Math.min(1, a.w / w, a.h / h);
  w = Math.round(w * k); h = Math.round(h * k);
  return { x: Math.round((a.w - w) / 2), y: Math.round((a.h - h) / 2), w, h };
}

// Background types: color, image, video, screensaver (id = fill id), wallpaper (slot = backdrop slot).
const defaultBackground = () => ({ type: 'color', color: '#0f0d16', url: '', fit: 'cover', id: null, slot: 0 });

function defaultScene() {
  const w = Math.round(Math.min(960, stageArea().w * 0.6)), h = Math.round(w * 9 / 16);
  const s = { ...blankScreen(), rect: centredRect(w, h) };
  return { version: 1, background: defaultBackground(), screens: [s], selectedId: s.id };
}

function normalizeScene(sc) {
  if (!sc || typeof sc !== 'object' || !Array.isArray(sc.screens)) return null;
  const screens = sc.screens.filter(s => s && s.rect && [s.rect.x, s.rect.y, s.rect.w, s.rect.h].every(Number.isFinite))
    .map((s, i) => ({ ...blankScreen(), ...s, id: String(s.id || uid()), z: Number.isFinite(s.z) ? s.z : i + 1 }));
  const background = { ...defaultBackground(), ...sc.background };
  const selectedId = screens.some(s => s.id === sc.selectedId) ? sc.selectedId : screens[0]?.id ?? null;
  return { version: 1, background, screens, selectedId };
}

function emptyCatalog() {
  return { frames: [], finishes: [], colorways: [], fills: [], backdrops: [], levels: [] };
}

// Plain-browser fallback so the UI still works without the Electron preload.
function makeRorStub() {
  const KEY = 'ror.scenes', none = async () => null, empty = async () => [], no = async () => false, off = () => () => {};
  const all = () => { try { return JSON.parse(localStorage.getItem(KEY)) || {}; } catch { return {}; } };
  const put = o => { try { localStorage.setItem(KEY, JSON.stringify(o)); return true; } catch { return false; } };
  const accept = { image: 'image/*', video: 'video/*', media: 'image/*,video/*', frame: 'image/png,image/webp,image/svg+xml' };
  return {
    stub: true, listSources: empty, detectSteamGame: none, getDisplays: empty,
    moveWindowToDisplay: no, startPlay: no, stopPlay: no, onCursor: off, onPlayState: off, onHotkey: off,
    pickFile: kind => new Promise(res => {
      const i = Object.assign(document.createElement('input'), { type: 'file', accept: accept[kind] || '' });
      i.onchange = () => res(i.files[0] ? URL.createObjectURL(i.files[0]) : null);
      i.oncancel = () => res(null);
      i.click();
    }),
    listScenes: async () => Object.keys(all()),
    loadScene: async n => all()[n] ?? null,
    saveScene: async (n, o) => put({ ...all(), [n]: o }),
    deleteScene: async n => { const o = all(); delete o[n]; return put(o); },
    setFullscreen: async on => {
      try { if (on) await document.documentElement.requestFullscreen(); else if (document.fullscreenElement) await document.exitFullscreen(); return true; }
      catch { return false; }
    },
  };
}

// In-memory economy for a plain browser: the starter frames and default looks, nothing to earn.
function makeShellStub() {
  const catalog = {
    ...emptyCatalog(),
    frames: STARTERS.map(f => ({ ...f, kind: 'frame', file: `frames/${f.id}.svg`, price: null, unlockLevel: null, author: 'Shellcade', tags: ['starter'] })),
    finishes: [{ id: 'none', name: 'Factory', kind: 'finish', rarity: 'common', price: null, swatch: ['#3a3550', '#2a263a'] }],
    colorways: [{ id: 'default', name: 'Original', kind: 'colorway', rarity: 'common', price: null, swatch: ['#6b6680', '#2c2740'], filter: 'none' }],
    levels: [{ level: 1, xpRequired: 0, rewards: { coins: 0, items: [] } }],
  };
  const state = {
    coins: 0, xp: 0, level: 1, xpIntoLevel: 0, xpForNext: 50, inventory: [...STARTERS.map(f => f.id), 'none', 'default'],
    equipped: { finish: 'none', colorway: 'default', fill: null }, backdropSlots: [],
    stats: { totalPlaySeconds: 0, achievements: 0, perApp: {} }, session: null, flags: [],
  };
  const get = async () => structuredClone(state), off = () => () => {};
  return {
    stub: true, getState: get, listCatalog: async () => structuredClone(catalog), listDevelopers: async () => [],
    purchase: async () => ({ ok: false, reason: 'offline', state: await get() }),
    equip: async (slot, id) => { if (slot in state.equipped && (id === null || state.inventory.includes(id))) state.equipped[slot] = id; return { ok: true, state: await get() }; },
    setBackdropSlot: async () => ({ ok: false, reason: 'offline', state: await get() }), buyBackdropSlot: async () => ({ ok: false, reason: 'offline', state: await get() }),
    listLocalWallpapers: async () => [], sessionStart: async () => null, sessionStop: async () => false, openLink: async () => false,
    onState: off, onUnlock: off, onLevelUp: off, onGameLaunched: off,
  };
}

function onKey(e) {
  if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 's') { e.preventDefault(); ui.saveScene(); return; }
  if (e.defaultPrevented || e.ctrlKey || e.altKey || e.metaKey || e.target.closest?.('input, select, textarea, dialog, [role=tablist]')) return;
  const step = e.shiftKey ? 10 : 1;
  const act = {
    ArrowLeft: () => app.nudge(-step, 0), ArrowRight: () => app.nudge(step, 0),
    ArrowUp: () => app.nudge(0, -step), ArrowDown: () => app.nudge(0, step),
    '+': () => app.scale(1.05), '=': () => app.scale(1.05), '-': () => app.scale(0.95), _: () => app.scale(0.95),
    Delete: () => app.removeScreen(), Backspace: () => app.removeScreen(),
    '[': () => app.reorder(-1), ']': () => app.reorder(1),
    h: () => app.toggleUI(), H: () => app.toggleUI(),
    Escape: () => app.fullscreen && app.setFullscreen(false),
  }[e.key];
  if (act) { e.preventDefault(); act(); }
}

// ---- Boot ----
const [fx, panels, st, cat] = await Promise.all([
  Promise.all([optional('./fx/finishes.js'), optional('./fx/colorways.js'), optional('./fx/screensavers.js')])
    .then(([f, c, s]) => ({ ...f, ...c, ...s })),
  Promise.all(['shop', 'profile', 'devs', 'toasts', 'hud'].map(n => optional(`./panels/${n}.js`, 'panels/panels.css')))
    .then(([shop, profile, devs, toasts, hud]) => ({ shop: shop?.mountShop, profile: profile?.mountProfile, devs: devs?.mountDevs,
      toaster: toasts?.createToaster, hud: hud?.mountHud })),
  shell.getState().catch(() => null),
  shell.listCatalog().catch(() => null),
]);
app.fx = fx;
app.mods = panels;
app.state = st && typeof st === 'object' ? st : await makeShellStub().getState();
if (cat && typeof cat === 'object') app.catalog = { ...emptyCatalog(), ...cat };
setCatalogFrames(app.catalog.frames);

let restored = null;
try { restored = normalizeScene(JSON.parse(localStorage.getItem(LAST_KEY) || localStorage.getItem(OLD_KEY))); } catch {}
app.scene = restored || defaultScene();
stage = new Stage(app, document.getElementById('stage'));
ui = initUI(app);
app.changed();
if (app.scene.background.type === 'wallpaper') app.refreshWallpapers();
addEventListener('keydown', onKey);
ror.onHotkey(name => { if (name === 'toggle-play') app.togglePlay(); else if (name === 'toggle-ui') app.toggleUI(); });
ror.onPlayState(p => { if (p) app.setPlaying(p.playing); });
ror.onCursor(c => { if (app.playing && c) stage.showCursor(app.get(app.playId), c.u, c.v, c.inside); });
shell.onState(s => app.setState(s));
shell.onUnlock(e => app.toast(e, 'achievement'));
shell.onLevelUp(e => app.toast(e, 'levelUp'));
shell.onGameLaunched(ev => app.toast({
  title: `${ev.name} launched`, body: 'Host it in Shellcade to earn XP and coins while you play.', kind: 'info',
  action: { label: 'Put it in a shell', onClick: () => app.adoptGame(ev) },
}));
// First run: show the most recently started Steam game if nothing is captured yet.
if (!app.scene.screens.some(s => s.sourceId)) {
  ror.detectSteamGame().then(g => { if (g) { app.assignSource(g); app.toast(`Showing ${g.name}`); } }).catch(() => {});
}
