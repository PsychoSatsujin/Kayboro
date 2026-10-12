// App state + actions. Wires the Stage (rendering/mouse), the sidebar UI, keyboard and main-process events.
import { Stage } from './stage.js';
import { initUI } from './ui.js';
import { parseAspect, scaleRect } from './layout.js';
import { frameById } from './frames/frames.js';

const ror = window.ror || makeStub();
const uid = () => Math.random().toString(36).slice(2, 10);
const LAST_KEY = 'ror.lastScene';
let stage, ui, saveTimer;

const app = {
  ror, scene: null, playing: false, playId: null, fullscreen: false, uiHidden: false,

  get(id) { return this.scene.screens.find(s => s.id === id) || null; },
  sel() { return this.get(this.scene.selectedId); },
  frameOf(s) { return s.customFrame?.url ? { aspect: s.customFrame.hole.w / s.customFrame.hole.h, ...s.customFrame } : frameById(s.frame); },
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

  changed() {
    stage.render(); ui.render();
    clearTimeout(saveTimer);
    saveTimer = setTimeout(() => { try { localStorage.setItem(LAST_KEY, JSON.stringify(this.scene)); } catch {} }, 400);
  },
  toast(msg) { ui?.toast(msg); },
  select(id) { if (this.scene.selectedId !== id) { this.scene.selectedId = id; this.changed(); } },
  update(fn, id = this.scene.selectedId) { const s = this.get(id); if (s) { fn(s); this.changed(); } return s; },

  addScreen(fields = {}) {
    const n = this.scene.screens.length, z = Math.max(0, ...this.scene.screens.map(s => s.z)) + 1;
    const s = { ...blankScreen(), rect: { x: 80 + n * 30, y: 80 + n * 30, w: 480, h: 270 }, z, ...fields };
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
    const fields = { sourceId: src.id, sourceName: src.name, hwnd: src.hwnd || null };
    if (asNew || !this.sel()) return this.addScreen(fields);
    const v = stage.views.get(this.scene.selectedId);
    if (v && !v.stream) v.sourceId = undefined; // re-picking a dead/failed source retries the capture
    return this.update(s => Object.assign(s, fields));
  },
  sourceAspectChanged(id) {
    const s = this.get(id);
    if (s?.aspect === 'source' && !this.frameOf(s)) { this.applyAspect(s); this.changed(); }
  },
  setAspect(a) { this.update(s => { s.aspect = a; this.applyAspect(s); }); },
  setFit(fit) { this.update(s => { s.fit = fit; }); },
  toggleFit(id) { this.update(s => { s.fit = s.fit === 'contain' ? 'cover' : 'contain'; }, id); },
  // Picking a frame snaps the screen to the frame opening's native aspect.
  setFrame(frameId) { this.update(s => { Object.assign(s, { frame: frameId, customFrame: null, aspect: 'source' }); this.applyAspect(s); }); },
  setCustomFrame(cf) { this.update(s => { Object.assign(s, { frame: null, customFrame: cf, aspect: 'source' }); this.applyAspect(s); }); },
  setBackground(patch) { Object.assign(this.scene.background, patch); this.changed(); },
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
    if (!hwnd) return this.toast('Select a screen showing a game window to play.');
    this.playId = s.id;
    if (await ror.startPlay(hwnd).catch(() => false)) this.setPlaying(true);
    else this.toast(ror.stub ? 'Play mode needs the RateofReality desktop app.' : 'Could not start play mode.');
  },
};

function blankScreen() {
  return { id: uid(), sourceId: null, sourceName: '', hwnd: null, rect: { x: 80, y: 80, w: 480, h: 270 },
    aspect: 'source', fit: 'contain', frame: null, customFrame: null, z: 1, visible: true };
}

function defaultScene() {
  const w = Math.round(Math.min(960, innerWidth * 0.6)), h = Math.round(w * 9 / 16);
  const s = { ...blankScreen(), rect: { x: Math.round((innerWidth - w) / 2), y: Math.round((innerHeight - h) / 2), w, h } };
  return { version: 1, background: { type: 'color', color: '#000000', url: '', fit: 'cover' }, screens: [s], selectedId: s.id };
}

function normalizeScene(sc) {
  if (!sc || typeof sc !== 'object' || !Array.isArray(sc.screens)) return null;
  const screens = sc.screens.filter(s => s && s.rect && [s.rect.x, s.rect.y, s.rect.w, s.rect.h].every(Number.isFinite))
    .map((s, i) => ({ ...blankScreen(), ...s, id: String(s.id || uid()), z: Number.isFinite(s.z) ? s.z : i + 1 }));
  const background = { type: 'color', color: '#000000', url: '', fit: 'cover', ...sc.background };
  const selectedId = screens.some(s => s.id === sc.selectedId) ? sc.selectedId : screens[0]?.id ?? null;
  return { version: 1, background, screens, selectedId };
}

// Plain-browser fallback so the UI still works without the Electron preload.
function makeStub() {
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

function onKey(e) {
  if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 's') { e.preventDefault(); ui.saveScene(); return; }
  if (e.ctrlKey || e.altKey || e.metaKey || e.target.closest?.('input, select, textarea, dialog')) return;
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

// Boot
let restored = null;
try { restored = normalizeScene(JSON.parse(localStorage.getItem(LAST_KEY))); } catch {}
app.scene = restored || defaultScene();
stage = new Stage(app, document.getElementById('stage'));
ui = initUI(app);
app.changed();
addEventListener('keydown', onKey);
ror.onHotkey(name => { if (name === 'toggle-play') app.togglePlay(); else if (name === 'toggle-ui') app.toggleUI(); });
ror.onPlayState(st => { if (st) app.setPlaying(st.playing); });
ror.onCursor(c => { if (app.playing && c) stage.showCursor(app.get(app.playId), c.u, c.v, c.inside); });
// First run: show the most recently started Steam game if nothing is captured yet.
if (!app.scene.screens.some(s => s.sourceId)) {
  ror.detectSteamGame().then(g => { if (g) { app.assignSource(g); app.toast(`Showing ${g.name}`); } }).catch(() => {});
}
