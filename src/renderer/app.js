// App state + actions. Wires the Stage (rendering/mouse), the sidebar UI, the economy (window.shell),
// keyboard and main-process events. Panels and FX are optional modules: if one fails to load the app
// still runs with a built-in fallback.
import './legacy-storage.js'; // first: copies pre-rename settings before any module reads them
import { Stage } from './stage.js';
import { initUI } from './ui.js';
import { parseAspect, scaleRect, frameOuterRect, clampZoom, clampPan, isZoomed } from './layout.js';
import { frameById, setCatalogFrames, STARTERS } from './frames/frames.js';
import { buildGallery, resolveRef, normRef } from './panels/logic.js';

const ror = window.ror || makeRorStub();
const shell = window.shell || makeShellStub();
const uid = () => Math.random().toString(36).slice(2, 10);
const LAST_KEY = 'kayboro.lastScene', OLD_KEY = 'ror.lastScene', FX_KEY = 'kayboro.fx', DRIVER_NOTICE_KEY = 'kayboro.driverNoticeSeen';
const LOOK = ['finish', 'colorway', 'fill'];
const POP = new URLSearchParams(location.search).get('popout'); // this window is a pop-out of that screen
const sent = new Map(); // screen id -> last screen JSON relayed to its pop-out
let stage, ui, saveTimer;

const optional = (path, css) => import(path).then(m => { if (css) addStylesheet(css); return m; })
  .catch(err => { console.warn(`[kayboro] ${path} unavailable: ${err?.message || err}`); return null; });
function addStylesheet(href) {
  if (!document.querySelector(`link[href="${href}"]`)) document.head.append(Object.assign(document.createElement('link'), { rel: 'stylesheet', href }));
}

const app = {
  ror, shell, scene: null, playing: false, playId: null, popout: null,
  fxPrefs: readFxPrefs(), // { particles, glass, depth }: shell effects on or off, shared with pop-out windows
  vs: { checked: false, available: false, backend: null, active: [], canInstall: false, busy: false }, // invisible screens (main/vdd) fullscreen: false, uiHidden: false,
  state: null, catalog: emptyCatalog(), wallpapers: [], fx: null, mods: {}, hosted: null, // hosted = { id, hwnd } of the session screen
  preview: null, // { entry, target } while a gallery tile is hovered

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
    if (this.popout) return stage.render(); // a pop-out shows its one screen; the main window owns the scene
    stage.render(); ui.render();
    this.relayPopouts();
    this.syncSession();
    clearTimeout(saveTimer);
    saveTimer = setTimeout(() => { try { localStorage.setItem(LAST_KEY, JSON.stringify(this.scene)); } catch {} }, 400);
  },
  // toast('text') or toast({ title, body, action: { label, onClick }, kind }).
  // Every toast is also announced as a 'kayboro:toast' DOM event ({ text, kind }) for tests and tooling.
  toast(msg, via = 'show') {
    const t = typeof msg === 'string' ? { title: msg } : msg || {};
    const text = via === 'achievement' ? `Achievement unlocked: ${t.name || t.apiName} +${t.coins} coins` : via === 'levelUp' ? `Level ${t.level}!` : [t.title, t.body].filter(Boolean).join(' ');
    document.dispatchEvent(new CustomEvent('kayboro:toast', { detail: { text, kind: via === 'show' ? t.kind || 'info' : via } }));
    try { ui?.toaster[via](t); } catch (err) { console.warn('[kayboro] toast failed:', err); }
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
  // Picking a fit puts the game back to filling the opening (it drops the game's own size inside a shell).
  setFit(fit) { this.update(s => { s.fit = fit; Object.assign(s, NO_ZOOM()); }); },
  toggleFit(id) { this.update(s => { s.fit = s.fit === 'contain' ? 'cover' : 'contain'; Object.assign(s, NO_ZOOM()); }, id); },
  resetGameSize(id) { this.update(s => Object.assign(s, NO_ZOOM()), id); },
  // How much a see-through shell's face stops covering its fill (0 = normal look, 1 = clearest).
  setFillClarity(v) { this.update(s => { s.fillClarity = clamp01(v); }); },
  fillShown(s = this.sel()) { return !!s && !!stage?.views.get(s.id)?.fillShown; },
  gameZoomed(s = this.sel()) { return !!s && !!this.frameOf(s) && isZoomed(s); },
  // Picking a frame snaps the screen to the frame opening's native aspect and keeps the whole shell on the stage.
  setFrame(frameId) { this.update(s => { Object.assign(s, { frame: frameId, customFrame: null, aspect: 'source' }); this.applyAspect(s); if (this.frameOf(s)) this.fitShell(s); }); },
  setCustomFrame(cf) { this.update(s => { Object.assign(s, { frame: null, customFrame: cf, aspect: 'source' }); this.applyAspect(s); this.fitShell(s); }); },
  // Scales a screen down and nudges it so its whole shell (or the bare screen) sits on the visible stage.
  fitShell(s, m = 16) {
    const f = this.frameOf(s), a = stageArea(), hole = f?.hole || { x: 0, y: 0, w: 1, h: 1 };
    const top = this.uiHidden ? m : Math.max(m, (document.getElementById('hud')?.getBoundingClientRect().bottom || 0) + 12); // clear of the HUD
    const o = frameOuterRect(s.rect, hole), k = Math.min(1, (a.w - 2 * m) / o.w, (a.h - top - m) / o.h);
    if (k < 1) s.rect = scaleRect(s.rect, k);
    const p = frameOuterRect(s.rect, hole);
    const d = (lo, len, min, max) => (lo < min ? min - lo : lo + len > max ? max - lo - len : 0);
    s.rect = { ...s.rect, x: s.rect.x + d(p.x, p.w, m, a.w - m), y: s.rect.y + d(p.y, p.h, top, a.h - m) };
  },
  // After the window shrinks: pull every shell that now pokes out of the visible stage back in.
  keepOnStage() {
    if (this.playing || !this.scene) return;
    const a = stageArea();
    let moved = false;
    for (const s of this.scene.screens) {
      const o = frameOuterRect(s.rect, this.frameOf(s)?.hole || { x: 0, y: 0, w: 1, h: 1 });
      if (o.x >= -1 && o.y >= -1 && o.x + o.w <= a.w + 1 && o.y + o.h <= a.h + 1) continue;
      const before = JSON.stringify(s.rect);
      this.fitShell(s);
      moved ||= JSON.stringify(s.rect) !== before;
    }
    if (moved) this.changed();
  },
  setBackground(patch) {
    Object.assign(this.scene.background, patch);
    this.changed();
    // The stage now shows something other than a gallery wallpaper: the free active slot is cleared.
    if (this.scene.background.type !== 'wallpaper' && this.state?.activeWallpaper?.stage) {
      shell.setActiveWallpaper?.(null, 'stage').then(r => r?.state && this.setState(r.state)).catch(() => {});
    }
  },

  // ---- Wallpapers: one gallery (catalog + mods, Wallpaper Engine, files), as the backdrop or a shell fill ----
  wallpaperGallery() {
    const gone = new Set(this.catalog.takedowns || []); // taken-down ids are hidden everywhere
    return buildGallery({ catalog: this.catalog.wallpapers, we: this.wallpapers.filter(w => !gone.has(String(w.id))), resolve: f => new URL(`./${f}`, import.meta.url).href });
  },
  wallpaperEntry(ref) { return ref ? resolveRef(ref, this.wallpaperGallery()) : null; },
  // Gallery entry -> what the stage draws: { type: 'screensaver', id, palette } | { type: 'image'|'video', url }.
  wallpaperSpec(w) {
    if (!w?.usable) return null;
    if (w.type === 'screensaver') return { type: 'screensaver', id: w.fill, palette: w.palette || null };
    return { type: w.type === 'video' ? 'video' : 'image', url: w.url };
  },
  // A screen's shell fill (a fill item id or a wallpaper reference) -> the spec, or null when it can't show.
  fillSpec(fill) {
    if (!fill) return null;
    if (typeof fill === 'object') return this.wallpaperSpec(this.wallpaperEntry(fill));
    const it = this.item('fills', fill);
    if (!it || !this.owns(fill)) return null;
    if (it.media?.url) return { type: it.media.type === 'video' ? 'video' : 'image', url: it.media.url };
    return { type: 'screensaver', id: it.base || it.id, palette: it.base ? it.colors || null : null };
  },
  // Any wallpaper, any time, free: on the stage or in the selected screen's shell fill.
  async setWallpaper(ref, target = 'stage') {
    ref = normRef(ref);
    this.preview = null;
    if (target === 'fill') this.update(s => { s.fill = ref; });
    else { this.scene.background = { ...this.scene.background, type: ref ? 'wallpaper' : 'color', ref }; this.changed(); }
    const r = await shell.setActiveWallpaper(ref, target).catch(() => null);
    if (r?.state) this.setState(r.state);
    return r;
  },
  // Live preview while a gallery tile is hovered (null restores).
  previewWallpaper(entry, target = 'stage') {
    this.preview = entry?.usable ? { entry, target } : null;
    stage.render();
  },
  // What the stage background draws: wallpapers and fill-based savers resolve to image/video/screensaver.
  bgSource() {
    const b = this.scene.background, p = this.preview?.target === 'stage' ? this.preview.entry : null;
    if (p || b.type === 'wallpaper') {
      const spec = this.wallpaperSpec(p || this.wallpaperEntry(b.ref));
      return spec ? { ...b, ...spec, palette: spec.palette || null } : { ...b, type: 'color' };
    }
    if (b.type === 'screensaver') {
      const it = this.item('fills', b.id);
      if (it?.media?.url) return { ...b, type: it.media.type === 'video' ? 'video' : 'image', url: it.media.url };
      if (it?.base) return { ...b, id: it.base, palette: it.colors || null };
    }
    return b;
  },
  async refreshWallpapers() {
    const list = await shell.listLocalWallpapers().catch(() => []);
    this.wallpapers = Array.isArray(list) ? list : [];
    stage.render();
    ui?.stateChanged();
    return this.wallpapers;
  },
  // Fresh catalog (mods reloaded, takedowns): frames, looks and wallpapers everywhere.
  async refreshCatalog(cat = null) {
    cat = cat || await shell.listCatalog().catch(() => null);
    if (!cat || typeof cat !== 'object') return;
    this.catalog = { ...emptyCatalog(), ...cat };
    setCatalogFrames(this.catalog.frames);
    ui?.catalogChanged();
    stage?.render();
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
    if (sc) { this.scene = sc; this.changed(); this.reopenPopouts(); }
    return !!sc;
  },

  // ---- Hosted-game session: the game on the screen it was last assigned to ----
  async host(s) {
    this.hosted = { id: s.id, hwnd: s.hwnd };
    ui?.render();
    const r = await shell.sessionStart({ hwnd: s.hwnd, exePath: s.exePath || null, sourceName: s.sourceName || '' }).catch(() => null);
    if (r?.appid != null && this.hosted?.hwnd === s.hwnd) {
      this.toast({ title: `Hosting ${r.name}`, kind: 'info',
        body: this.state?.settings?.rewards?.achievements ? 'Achievements you unlock now earn coins.' : 'Your play time here counts toward its developer.' });
    }
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

  // ---- Pop-outs: a screen in its own transparent window, just the console and the game ----
  // The main window keeps the screen in its scene (hidden on the stage) and relays every change.
  async popOut(id = this.scene.selectedId) {
    const s = this.get(id), f = s && this.frameOf(s);
    if (!s) return;
    const o = frameOuterRect(s.rect, f?.hole || { x: 0, y: 0, w: 1, h: 1 });
    s.popout = { pinned: true };
    this.changed();
    const side = !this.uiHidden && document.getElementById('ui')?.getBoundingClientRect();
    const avoid = side && side.width > 0 ? { x: side.left, y: side.top, w: side.width, h: side.height } : null;
    if (!(await ror.popOut(s.id, plain(s), { x: o.x, y: o.y, w: o.w, h: o.h }, null, avoid).catch(() => false))) {
      delete s.popout;
      this.changed();
      this.toast(ror.stub ? 'Pop-out needs the Kayboro desktop app.' : 'Could not pop out this screen.');
    }
  },
  dock(id = this.scene.selectedId) { if (this.get(id)?.popout) ror.popoutClose(id).catch(() => {}); },
  relayPopouts() {
    const ids = new Set();
    for (const s of this.scene.screens) {
      if (!s.popout) continue;
      ids.add(s.id);
      const json = JSON.stringify(plain(s));
      if (sent.get(s.id) !== json) { sent.set(s.id, json); ror.popoutUpdate?.(s.id, plain(s)).catch(() => {}); }
    }
    for (const id of sent.keys()) if (!ids.has(id)) { sent.delete(id); ror.popoutClose?.(id).catch(() => {}); }
  },
  // Reopens the pop-outs a loaded scene remembers, where they were left.
  reopenPopouts() {
    for (const s of this.scene.screens) {
      if (!s.popout) continue;
      sent.set(s.id, JSON.stringify(plain(s)));
      ror.popOut(s.id, plain(s), null, s.popout).then(ok => { if (!ok) { delete s.popout; sent.delete(s.id); this.changed(); } }).catch(() => {});
    }
  },
  onPopout(ev) {
    const s = ev && this.get(ev.id);
    if (!s) return;
    if (ev.type === 'closed') { delete s.popout; sent.delete(s.id); this.changed(); }
    else if (ev.type === 'bounds' && s.popout) { s.popout = { bounds: ev.bounds, pinned: !!ev.pinned }; this.changed(); }
  },

  setFxPref(key, on) {
    this.fxPrefs = { ...this.fxPrefs, [key]: !!on };
    try { localStorage.setItem(FX_KEY, JSON.stringify(this.fxPrefs)); } catch {} // pop-outs follow via the storage event
    stage.render(); ui.render();
  },

  // ---- Invisible screens: the game runs on a virtual monitor nobody sees, Kayboro shows it ----
  async refreshVirtualScreens() {
    const s = await ror.virtualScreenStatus?.().catch(() => null);
    this.vs = { ...this.vs, checked: true, available: !!s?.available, backend: s?.backend || null, active: s?.active || [], canInstall: !!s?.canInstall };
    ui?.render();
  },
  // Installs the driver that came with Kayboro; Windows asks the player for administrator approval.
  async installScreenDriver() {
    if (this.vs.busy) return;
    this.vs.busy = true; ui.render();
    try {
      const r = await ror.installScreenDriver?.().catch(err => ({ ok: false, error: err.message }));
      if (r?.ok) this.toast({ title: 'Kayboro Virtual Screen installed', body: r.restart ? 'Restart Windows to finish, then Hide Game Window is ready.' : 'Hide Game Window is ready.', kind: 'ok' });
      else this.toast({ title: 'The driver was not installed.', body: r?.error || 'Try again from the Displays section.' });
    } finally {
      this.vs.busy = false;
      await this.refreshVirtualScreens();
    }
  },
  // One-time notice the first time Kayboro finds its driver installed (Steam installs it during first-time setup).
  driverNotice() {
    try { if (localStorage.getItem(DRIVER_NOTICE_KEY)) return; localStorage.setItem(DRIVER_NOTICE_KEY, '1'); } catch { return; }
    const dlg = document.getElementById('driverNotice');
    if (dlg && !dlg.open && !this.popout) dlg.showModal();
  },
  isHidden(s) { return !!s?.hwnd && this.vs.active.some(a => String(a.hwnd) === String(s.hwnd)); },
  async toggleHidden(s = this.sel()) {
    if (!s || this.vs.busy) return;
    const hwnd = s.hwnd || (await ror.detectSteamGame().catch(() => null))?.hwnd;
    if (!hwnd) return this.toast({ title: 'Pick the game window under Sources first.', body: 'Hiding works with a game window, not a whole monitor.' });
    this.vs.busy = true; ui.render();
    try {
      if (this.isHidden(s)) {
        await ror.showGame(hwnd);
        this.toast({ title: 'Game window is back', body: 'It is where it was before you hid it.', kind: 'ok' });
      } else {
        const r = await ror.hideGame(hwnd, this.frameOf(s)?.aspect || stage.views.get(s.id)?.aspect || 16 / 9);
        if (!r || r.error) return this.toast({ title: 'Could not hide the game window.', body: r?.error || 'Check the Displays section for the virtual screen driver.' });
        this.toast({ title: 'Game window hidden', body: 'It runs on an invisible screen now. Press Play to control it.', kind: 'ok' });
      }
    } finally {
      this.vs.busy = false;
      await this.refreshVirtualScreens();
    }
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
    if (s.popout) return void ror.popoutPlay(s.id).catch(() => false); // the pop-out window starts it (it knows where its picture is)
    this.playId = s.id;
    if (await ror.startPlay(hwnd, null, stage.playRect(s)).catch(() => false)) this.setPlaying(true);
    else this.toast(ror.stub ? 'Play mode needs the Kayboro desktop app.' : 'Could not start play mode.');
  },
};

function readFxPrefs() {
  try { const p = JSON.parse(localStorage.getItem(FX_KEY)); if (p && typeof p === 'object') return { particles: p.particles !== false, glass: p.glass !== false, depth: p.depth !== false }; } catch {}
  return { particles: true, glass: true, depth: true };
}

// A screen as plain data for the pop-out window (no live objects, no saved pop-out bounds).
function plain(s) { const { popout, ...rest } = s; return JSON.parse(JSON.stringify(rest)); }

const NO_ZOOM = () => ({ zoom: 1, pan: { x: 0, y: 0 } }); // the game fills its shell's opening
const clamp01 = v => Math.min(1, Math.max(0, Number(v) || 0));

function blankScreen() {
  const eq = app.equipped();
  return { id: uid(), sourceId: null, sourceName: '', hwnd: null, exePath: null, rect: { x: 80, y: 80, w: 480, h: 270 },
    aspect: 'source', fit: 'contain', ...NO_ZOOM(), fillClarity: 0, frame: null, customFrame: null, z: 1, visible: true,
    finish: eq.finish ?? 'none', colorway: eq.colorway ?? 'default', fill: app.state?.activeWallpaper?.fill || eq.fill || null };
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

// Background types: color, image, video, screensaver (id = fill id), wallpaper (ref = gallery wallpaper reference).
const defaultBackground = () => ({ type: 'color', color: '#0f0d16', url: '', fit: 'cover', id: null, ref: null });

function defaultScene() {
  const w = Math.round(Math.min(960, stageArea().w * 0.6)), h = Math.round(w * 9 / 16);
  const s = { ...blankScreen(), rect: centredRect(w, h) };
  return { version: 1, background: defaultBackground(), screens: [s], selectedId: s.id };
}

function normalizeScene(sc) {
  if (!sc || typeof sc !== 'object' || !Array.isArray(sc.screens)) return null;
  const screens = sc.screens.filter(s => s && s.rect && [s.rect.x, s.rect.y, s.rect.w, s.rect.h].every(Number.isFinite))
    .map((s, i) => ({ ...blankScreen(), ...s, id: String(s.id || uid()), z: Number.isFinite(s.z) ? s.z : i + 1 }))
    .map(s => (s.fill && typeof s.fill === 'object' ? { ...s, fill: normRef(s.fill) } : s))
    .map(s => ({ ...s, zoom: clampZoom(s.zoom), pan: { x: clampPan(s.pan?.x), y: clampPan(s.pan?.y) }, fillClarity: clamp01(s.fillClarity) }));
  const background = { ...defaultBackground(), ...sc.background };
  background.ref = normRef(background.ref);
  if (background.type === 'wallpaper' && !background.ref) background.type = 'color'; // old backdrop-slot scenes
  const selectedId = screens.some(s => s.id === sc.selectedId) ? sc.selectedId : screens[0]?.id ?? null;
  return { version: 1, background, screens, selectedId };
}

function emptyCatalog() {
  return { frames: [], finishes: [], colorways: [], fills: [], wallpapers: [], levels: [], takedowns: [] };
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
    popOut: no, popoutUpdate: no, popoutClose: no, popoutPlay: no, onPopout: off, virtualScreenStatus: none, hideGame: none, showGame: no, installScreenDriver: none,
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
    frames: STARTERS.map(f => ({ ...f, kind: 'frame', file: `frames/${f.id}.svg`, price: null, unlockLevel: null, author: 'Kayboro', tags: ['starter'] })),
    finishes: [{ id: 'none', name: 'Factory', kind: 'finish', rarity: 'common', price: null, swatch: ['#3a3550', '#2a263a'] }],
    colorways: [{ id: 'default', name: 'Original', kind: 'colorway', rarity: 'common', price: null, swatch: ['#6b6680', '#2c2740'], filter: 'none' }],
    levels: [{ level: 1, xpRequired: 0, rewards: { coins: 0, items: [] } }],
  };
  const state = {
    coins: 0, xp: 0, level: 1, xpIntoLevel: 0, xpForNext: 60, inventory: [...STARTERS.map(f => f.id), 'none', 'default'],
    equipped: { finish: 'none', colorway: 'default', fill: null }, wallpaperPresets: [], activeWallpaper: { stage: null, fill: null },
    stats: { totalPlaySeconds: 0, achievements: 0, perApp: {} }, session: null, settings: { rewards: { achievements: false } },
  };
  const get = async () => structuredClone(state), off = () => () => {}, offline = async () => ({ ok: false, reason: 'offline', state: await get() });
  return {
    stub: true, getState: get, listCatalog: async () => structuredClone(catalog), listDevelopers: async () => [],
    purchase: offline, buyWallpaperPreset: offline, setWallpaperPreset: offline,
    equip: async (slot, id) => { if (slot in state.equipped && (id === null || state.inventory.includes(id))) state.equipped[slot] = id; return { ok: true, state: await get() }; },
    setActiveWallpaper: async (ref, target = 'stage') => { if (target in state.activeWallpaper) state.activeWallpaper[target] = ref || null; return { ok: true, state: await get() }; },
    listLocalWallpapers: async () => [], sessionStart: async () => null, sessionStop: async () => false, openLink: async () => false,
    getSettings: async () => structuredClone(state.settings), setSettings: async () => structuredClone(state.settings),
    onState: off, onUnlock: off, onLevelUp: off, onGameLaunched: off, onCatalog: off,
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
  Promise.all([optional('./fx/finishes.js'), optional('./fx/colorways.js'), optional('./fx/screensavers.js'), optional('./fx/particles.js'), optional('./fx/glass.js')])
    .then(([f, c, s, p, g]) => ({ ...f, ...c, ...s, createParticles: p?.createParticles, glassSvg: g?.glassSvg })),
  Promise.all(['shop', 'profile', 'devs', 'toasts', 'hud', 'kaybo'].map(n => optional(`./panels/${n}.js`, 'panels/panels.css')))
    .then(([shop, profile, devs, toasts, hud, kaybo]) => ({ shop: shop?.mountShop, profile: profile?.mountProfile, devs: devs?.mountDevs, kaybo: kaybo?.mountKaybo,
      toaster: toasts?.createToaster, hud: hud?.mountHud })),
  shell.getState().catch(() => null),
  shell.listCatalog().catch(() => null),
]);
app.fx = fx;
app.mods = panels;
app.state = st && typeof st === 'object' ? st : await makeShellStub().getState();
if (cat && typeof cat === 'object') app.catalog = { ...emptyCatalog(), ...cat };
setCatalogFrames(app.catalog.frames);

if (POP) {
  ui = { render() {}, stateChanged() {}, catalogChanged() {}, showTab() {}, saveScene() {}, toaster: {} };
  stage = await (await import('./popout.js')).bootPopout(app, POP, Stage);
  shell.onState(st2 => app.setState(st2));
  shell.onCatalog?.(c => app.refreshCatalog(c));
} else {
  let restored = null;
  try { restored = normalizeScene(JSON.parse(localStorage.getItem(LAST_KEY) || localStorage.getItem(OLD_KEY))); } catch {}
  app.scene = restored || defaultScene();
  stage = new Stage(app, document.getElementById('stage'));
  ui = initUI(app);
  app.reopenPopouts();
  app.changed();
  app.refreshWallpapers(); // the user's own Wallpaper Engine folder, for the gallery and saved references
  ror.onPopout(ev => app.onPopout(ev));
  addEventListener('keydown', onKey);
  let fitTimer = 0;
  addEventListener('resize', () => { clearTimeout(fitTimer); fitTimer = setTimeout(() => app.keepOnStage(), 150); });
  ror.onHotkey(name => { if (name === 'toggle-play') app.togglePlay(); else if (name === 'toggle-ui') app.toggleUI(); });
  ror.onPlayState(p => { if (p) app.setPlaying(p.playing); });
  ror.onCursor(c => { if (app.playing && c) stage.showCursor(app.get(app.playId), c.u, c.v, c.inside); });
  shell.onState(s => app.setState(s));
  shell.onCatalog?.(c => app.refreshCatalog(c));
  shell.onUnlock(e => app.toast(e, 'achievement'));
  shell.onLevelUp(e => app.toast(e, 'levelUp'));
  shell.onGameLaunched(ev => app.toast({
    title: `${ev.name} launched`, body: 'Host it in Kayboro to earn XP and coins while you play.', kind: 'info',
    action: { label: 'Put it in a shell', onClick: () => app.adoptGame(ev) },
  }));
  // First run: show the most recently started Steam game if nothing is captured yet.
  if (!app.scene.screens.some(s => s.sourceId)) {
    ror.detectSteamGame().then(g => { if (g) { app.assignSource(g); app.toast(`Showing ${g.name}`); } }).catch(() => {});
  }
}
