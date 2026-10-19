// Stage: draws the background and every screen, and handles mouse move/resize. Geometry comes from
// layout.js; state lives in app.scene. Per screen, back to front: shell fill (seen through translucent
// shells) -> live capture or test pattern, clipped to the hole -> frame image (colorway) -> finish overlay.
import { fitRect, frameOuterRect, holeRect, resizeRect, cursorToStage, zoomRect, zoomFor, clampPan, clampZoom, isZoomed } from './layout.js';
// Particles and screen glass come from fx/particles.js and fx/glass.js through app.fx (optional modules).

const HANDLES = ['n', 's', 'e', 'w', 'ne', 'nw', 'se', 'sw'];
const OBJECT_FIT = { contain: 'contain', cover: 'cover', stretch: 'fill' };
const BG_SIZE = { cover: 'cover', contain: 'contain', stretch: '100% 100%', tile: 'auto' };
const BARS = ['#eee9ff', '#ffd166', '#7af0ff', '#6ee7a8', '#ff6ad5', '#ff6b6b', '#7a6cff'];
const make = (tag, cls) => { const e = document.createElement(tag); if (cls) e.className = cls; return e; };
const box = (e, r) => Object.assign(e.style, { left: `${r.x}px`, top: `${r.y}px`, width: `${r.w}px`, height: `${r.h}px` });
// FX calls return a disposer function (or an object with dispose/destroy/stop); normalise to a function.
const disposer = r => typeof r === 'function' ? r : r && ['dispose', 'destroy', 'stop'].map(k => r[k]?.bind(r)).find(Boolean) || null;

export class Stage {
  constructor(app, root) {
    this.app = app;
    this.views = new Map(); // screen id -> view
    this.layer = root.querySelector('#screens');
    this.bg = root.querySelector('#bg');
    this.cursor = root.querySelector('#cursor');
    this.empty = root.querySelector('#stageEmpty');
    this.bgKey = '';
    this.saver = null;
    root.addEventListener('pointerdown', e => { if (!e.target.closest('.screen, #stageEmpty')) app.select(null); });
    addEventListener('resize', () => this.saver?.resize?.());
    const tick = t => { this.drawPatterns(t); requestAnimationFrame(tick); };
    requestAnimationFrame(tick);
  }

  get fx() { return this.app.fx || {}; }

  render() {
    const { screens, selectedId } = this.app.scene;
    const ids = new Set(screens.map(s => s.id));
    for (const [id, v] of this.views) if (!ids.has(id)) this.destroy(v);
    for (const s of screens) {
      const v = this.views.get(s.id) || this.create(s.id);
      const away = !!s.popout && !this.app.popout; // shown by its own pop-out window: no second capture here
      const src = away ? null : s.sourceId || null;
      if (v.sourceId !== src) this.capture(v, src);
      this.place(s, v);
      if (away) v.el.hidden = true;
      v.el.classList.toggle('sel', s.id === selectedId && !this.app.popout);
    }
    if (this.empty) this.empty.hidden = this.app.popout || screens.some(s => !s.popout);
    this.renderBg();
  }

  create(id) {
    const v = { id, el: make('div', 'screen'), back: make('div', 'shell-back'), media: make('div', 'media'), video: make('video'),
      canvas: make('canvas'), front: make('div', 'shell-front'), frame: make('img', 'frame'), glass: make('div', 'glass'), sparks: make('canvas', 'particles'),
      particles: null, glassKey: '', sourceId: undefined, stream: null, aspect: null, frameUrl: '', look: {}, undo: {} };
    Object.assign(v.video, { muted: true, autoplay: true, playsInline: true });
    Object.assign(v.canvas, { width: 320, height: 180 });
    Object.assign(v.frame, { draggable: false, alt: '', decoding: 'async' });
    v.media.append(v.canvas, v.video);
    v.front.append(v.frame);
    v.glass.hidden = v.sparks.hidden = true;
    v.el.append(v.back, v.media, v.glass, v.front, v.sparks);
    for (const h of HANDLES) { const d = make('div', `handle h-${h}`); d.dataset.h = h; v.el.append(d); }
    // With a shell: square handles on its outline resize the shell (the game scales with it), round ones
    // on the game resize just the game inside the opening.
    v.shellBox = make('div', 'hbox shell-box');
    v.picBox = make('div', 'hbox pic-box');
    for (const [box, part, tip] of [[v.shellBox, 'shell', 'Resize the shell'], [v.picBox, 'pic', 'Resize the game inside the shell']]) {
      for (const h of HANDLES) { const d = make('div', `handle h-${h}`); Object.assign(d.dataset, { h, part }); d.title = tip; box.append(d); }
    }
    v.el.append(v.shellBox, v.picBox);
    const sized = () => this.onVideoSize(v);
    v.video.addEventListener('loadedmetadata', sized);
    v.video.addEventListener('resize', sized);
    v.el.addEventListener('pointerdown', e => this.down(e, id));
    v.el.addEventListener('dblclick', e => { if (!e.target.dataset.h && !this.app.playing && !this.app.popout) this.app.toggleFit(id); });
    this.layer.append(v.el);
    this.views.set(id, v);
    return v;
  }

  destroy(v) { v.particles?.dispose(); this.stop(v); for (const l of ['finish', 'fill', 'depth']) this.setLayer(v, l, ''); v.el.remove(); this.views.delete(v.id); }

  stop(v) {
    v.stream?.getTracks().forEach(t => t.stop());
    v.stream = null; v.video.srcObject = null; v.aspect = null;
    v.el.classList.remove('live');
  }

  async capture(v, sourceId) {
    this.stop(v);
    v.sourceId = sourceId;
    if (!sourceId) return;
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: false,
        video: { mandatory: { chromeMediaSource: 'desktop', chromeMediaSourceId: sourceId, maxFrameRate: 60 } } });
      if (v.sourceId !== sourceId || this.views.get(v.id) !== v) return stream.getTracks().forEach(t => t.stop());
      v.stream = stream;
      v.video.srcObject = stream;
      v.video.play().catch(() => {});
      stream.getVideoTracks()[0]?.addEventListener('ended', () => { if (v.stream === stream) { this.stop(v); this.app.toast('Capture ended.'); } });
    } catch (err) {
      if (v.sourceId === sourceId) this.app.toast({ title: `Capture failed: ${err?.message || err}`, body: 'Keep the window open and not minimized, then pick it again.' });
    }
  }

  onVideoSize(v) {
    const { videoWidth: w, videoHeight: h } = v.video;
    if (!w || !h || !v.stream) return;
    v.el.classList.add('live');
    if (Math.abs(w / h - (v.aspect || 0)) < 1e-3) return;
    v.aspect = w / h;
    const s = this.app.get(v.id);
    if (s) this.place(s, v); // the game handles hug the picture
    this.app.sourceAspectChanged(v.id);
  }

  place(s, v = this.views.get(s.id)) {
    if (!v) return;
    const r = s.rect, f = this.app.frameOf(s);
    box(v.el, r);
    v.el.style.zIndex = s.z;
    v.el.hidden = s.visible === false;
    v.video.style.objectFit = v.canvas.style.objectFit = OBJECT_FIT[s.fit] || 'contain';
    // The game's own size inside a shell (round handles): scaled about the opening's centre, then panned.
    v.video.style.transform = v.canvas.style.transform = f && isZoomed(s)
      ? `translate(${clampPan(s.pan?.x) * 100}%, ${clampPan(s.pan?.y) * 100}%) scale(${clampZoom(s.zoom)})` : '';
    v.media.style.borderRadius = f?.holeRadius > 0 ? `${f.holeRadius * r.w}px` : '';
    v.el.classList.toggle('framed', !!f);
    v.frame.hidden = v.front.hidden = v.back.hidden = !f;
    if (!f) {
      for (const l of ['finish', 'fill', 'depth']) this.setLayer(v, l, '');
      v.fillShown = false;
      this.fx.setFillClarity?.(v.front, v.back, null, 0);
      this.applyFx(s, v);
      return;
    }
    if (v.frameUrl !== f.url) v.frame.src = v.frameUrl = f.url;
    const outer = frameOuterRect({ x: 0, y: 0, w: r.w, h: r.h }, f.hole), vr = this.videoRect(s);
    box(v.front, outer); box(v.back, outer); box(v.shellBox, outer);
    box(v.picBox, { x: vr.x - r.x, y: vr.y - r.y, w: vr.w, h: vr.h });
    this.applyLook(s, v, f);
    this.applyFx(s, v);
  }

  // Colorway on the frame image, finish overlay above it, shell fill behind it (only where it can show).
  // Looks the catalog no longer has (taken down) or the user doesn't own fall back to the defaults.
  applyLook(s, v, f) {
    const fx = this.fx, app = this.app;
    const look = (kind, id, dflt) => (id && app.item(kind, id) && app.owns(id) ? id : dflt);
    const cw = look('colorways', s.colorway, 'default'), item = app.item('colorways', cw);
    const known = !!fx.COLORWAYS?.[cw]; // FX recipe; mod colorways bring their own filter/opacity
    if (v.look.colorway !== `${cw}|${f.url}`) {
      v.look.colorway = `${cw}|${f.url}`;
      try {
        if (fx.applyColorway) fx.applyColorway(v.frame, known ? cw : 'default');
        if (!known || !fx.applyColorway) {
          Object.assign(v.frame.style, { filter: item?.filter && item.filter !== 'none' ? item.filter : '',
            opacity: item?.opacity < 1 ? String(item.opacity) : item?.translucent ? '0.55' : '' });
        }
      } catch (err) { console.warn('[kayboro] colorway failed:', err); }
    }
    const seeThrough = known && fx.needsShellFill ? fx.needsShellFill(f, cw) : f.translucent || !!item?.translucent || item?.opacity < 1;
    const fin = look('finishes', s.finish, 'none');
    this.setLayer(v, 'finish', fin !== 'none' && fx.applyFinish ? `${fin}|${f.url}` : '', () => fx.applyFinish(v.front, f.url, fin, { intensity: 1 }));
    const p = app.preview?.target === 'fill' && s.id === app.scene.selectedId ? app.preview.entry : null;
    const fill = seeThrough ? (p ? app.wallpaperSpec(p) : app.fillSpec(s.fill)) : null;
    // 3D depth (unless switched off): every shell is shaded from its depth map, see-through ones as glass,
    // and the fill behind clear plastic bends near the edges as if held inside it.
    const depth = app.fxPrefs?.depth !== false, grid = f.style === 'pixel' && f.size?.w ? f.size : null;
    this.setLayer(v, 'fill', fill && fx.applyShellFill ? `${JSON.stringify(fill)}|${f.url}|${depth}` : '',
      () => fx.applyShellFill(v.back, f.url, { ...fill, palette: fill.palette || undefined }, { refract: depth, grid }));
    this.setLayer(v, 'depth', depth && fx.applyDepth ? `${seeThrough ? 'glass' : 'solid'}|${f.url}` : '',
      () => fx.applyDepth(v.front, f.url, { glass: seeThrough, grid }));
    // Fill clarity: the user can clear the shell's face over its fill (the edges keep their look).
    v.fillShown = !!fill;
    fx.setFillClarity?.(v.front, v.back, f.url, fill ? s.fillClarity : 0, { grid });
  }

  // Screen glass over the opening and particles around the shell, from the frame's fx, unless the user
  // switched them off. Particles stop while the screen is hidden or shown by its pop-out instead.
  applyFx(s, v) {
    const away = !!s.popout && !this.app.popout, f = this.app.frameOf(s), fx = f?.fx, prefs = this.app.fxPrefs || {}, r = s.rect;
    const glass = fx?.glass && prefs.glass !== false && this.fx.glassSvg ? fx.glass : null, rad = (f?.holeRadius || 0) * r.w;
    const gk = glass ? `${glass}|${Math.round(r.w)}x${Math.round(r.h)}|${Math.round(rad)}` : '';
    if (v.glassKey !== gk) {
      v.glassKey = gk;
      v.glass.hidden = !glass;
      v.glass.style.backgroundImage = glass ? `url("data:image/svg+xml,${encodeURIComponent(this.fx.glassSvg(r.w, r.h, rad, glass))}")` : '';
      v.glass.style.borderRadius = rad ? `${rad}px` : '';
    }
    const type = fx?.particles && prefs.particles !== false && !away && s.visible !== false && this.fx.createParticles ? fx.particles : null;
    if (!type) { v.particles?.dispose(); v.particles = null; v.sparks.hidden = true; return; }
    const o = frameOuterRect({ x: 0, y: 0, w: r.w, h: r.h }, f.hole);
    box(v.sparks, o);
    v.sparks.hidden = false;
    const opts = { type, palette: fx.palette, density: fx.density, pixel: f.style === 'pixel' && f.size?.w ? o.w / f.size.w : 0,
      hole: { x: -o.x, y: -o.y, w: r.w, h: r.h, r: rad } };
    if (v.particles) v.particles.update(opts);
    else v.particles = this.fx.createParticles(v.sparks, opts);
  }

  setLayer(v, name, key, apply) {
    if ((v.look[name] || '') === key) return;
    try { v.undo[name]?.(); } catch {}
    v.undo[name] = null;
    v.look[name] = key;
    if (!key) return;
    try { v.undo[name] = disposer(apply()); } catch (err) { console.warn(`[kayboro] ${name} failed:`, err); }
  }

  // Click selects, drag moves, handles resize (aspect-locked unless Shift is held). With a shell, square
  // handles resize the shell (the game scales with it), round ones resize the game inside the opening
  // (always at the game's own aspect), and Alt+drag slides the game inside the opening.
  down(e, id) {
    if (this.app.playing || this.app.popout || e.button !== 0) return; // pop-outs drag the whole window instead
    e.preventDefault();
    document.activeElement?.blur?.(); // let arrow keys reach the stage
    this.app.select(id);
    const s = this.app.get(id), el = e.currentTarget, handle = e.target.dataset.h, f = s && this.app.frameOf(s);
    if (!s) return;
    const part = f ? e.target.dataset.part || (!handle && e.altKey ? 'pan' : '') : '';
    const start = { ...s.rect }, sx = e.clientX, sy = e.clientY;
    const outer = f && frameOuterRect(start, f.hole), pic = f && this.videoRect(s), pan = { x: clampPan(s.pan?.x), y: clampPan(s.pan?.y) };
    const base = f && fitRect(this.views.get(id)?.aspect || 16 / 9, start, s.fit);
    el.setPointerCapture(e.pointerId);
    el.classList.add('dragging');
    const move = ev => {
      const dx = ev.clientX - sx, dy = ev.clientY - sy;
      if (part === 'shell') {
        const a = ev.shiftKey || this.app.aspectOf(s) == null ? null : outer.w / outer.h;
        s.rect = holeRect(resizeRect(outer, handle, dx, dy, a, 60), f.hole);
      } else if (part === 'pic') Object.assign(s, zoomFor(base, start, resizeRect(pic, handle, dx, dy, pic.w / pic.h, 24)));
      else if (part === 'pan') s.pan = { x: clampPan(pan.x + dx / start.w), y: clampPan(pan.y + dy / start.h) };
      else s.rect = handle ? resizeRect(start, handle, dx, dy, ev.shiftKey ? null : this.app.aspectOf(s))
        : { ...start, x: start.x + dx, y: start.y + dy };
      this.place(s);
    };
    const up = () => {
      el.removeEventListener('pointermove', move);
      el.removeEventListener('pointerup', up);
      el.removeEventListener('pointercancel', up);
      el.classList.remove('dragging');
      this.app.changed();
    };
    el.addEventListener('pointermove', move);
    el.addEventListener('pointerup', up);
    el.addEventListener('pointercancel', up);
  }

  // Where the captured picture actually is (letterboxed or cropped inside the content rect, then sized
  // inside a shell's opening by the game's own zoom and pan).
  videoRect(s) {
    const r = fitRect(this.views.get(s.id)?.aspect || 16 / 9, s.rect, s.fit);
    return this.app.frameOf(s) && isZoomed(s) ? zoomRect(r, s.rect, s.zoom, s.pan) : r;
  }

  // The picture's rect in the window's client area (the stage fills it): play mode hands the cursor
  // between this spot and the game.
  playRect(s) {
    const r = this.videoRect(s), b = this.layer.getBoundingClientRect();
    return { x: b.left + r.x, y: b.top + r.y, w: r.w, h: r.h };
  }

  showCursor(s, u, v, inside) {
    const p = s && inside ? cursorToStage(u, v, this.videoRect(s)) : null, r = s?.rect;
    const ok = !!p && p.x >= r.x && p.x <= r.x + r.w && p.y >= r.y && p.y <= r.y + r.h;
    this.cursor.hidden = !ok;
    if (ok) this.cursor.style.transform = `translate(${p.x}px, ${p.y}px)`;
  }

  renderBg() {
    const b = this.app.bgSource(), key = JSON.stringify(b);
    if (key === this.bgKey) return;
    this.bgKey = key;
    this.saver?.stop?.();
    this.saver = null;
    this.bg.querySelector('video')?.removeAttribute('src');
    this.bg.replaceChildren();
    Object.assign(this.bg.style, { backgroundColor: b.color || '#000', backgroundImage: 'none' });
    if (b.type === 'image' && b.url) {
      Object.assign(this.bg.style, { backgroundImage: `url(${JSON.stringify(b.url)})`, backgroundSize: BG_SIZE[b.fit] || 'cover',
        backgroundRepeat: b.fit === 'tile' ? 'repeat' : 'no-repeat' });
    } else if (b.type === 'video' && b.url) {
      const vid = make('video');
      Object.assign(vid, { muted: true, loop: true, autoplay: true, playsInline: true, src: b.url });
      vid.style.objectFit = OBJECT_FIT[b.fit] || 'cover';
      vid.addEventListener('error', () => this.app.toast({ title: 'Could not play background video.', body: 'Try an MP4 (H.264) or WebM file.' }));
      this.bg.append(vid);
      vid.play().catch(() => {});
    } else if (b.type === 'screensaver' && b.id && this.fx.createScreensaver) {
      const c = make('canvas', 'saver');
      this.bg.append(c);
      try { this.saver = this.fx.createScreensaver(b.id, c, { palette: b.palette || undefined }); } catch (err) { console.warn('[kayboro] screensaver failed:', err); }
    }
  }

  // Animated colour bars on every screen that has no live picture, drawn at the screen's own size and
  // shape so the pattern fills the hole crisply instead of a letterboxed, upscaled 16:9 bitmap.
  drawPatterns(t) {
    for (const v of this.views.values()) {
      if (v.el.classList.contains('live') || v.el.hidden) continue;
      const s = this.app.get(v.id), r = s?.rect;
      if (!r || !(r.w > 0 && r.h > 0)) continue;
      const k = Math.min(2, devicePixelRatio || 1), W = Math.max(64, Math.round(Math.min(r.w * k, 1600))), H = Math.max(36, Math.round(W * r.h / r.w));
      if (v.canvas.width !== W || v.canvas.height !== H) Object.assign(v.canvas, { width: W, height: H });
      const c = v.canvas.getContext('2d'), bw = W / BARS.length, top = Math.round(H * 0.68), u = Math.max(2, Math.round(H / 60));
      BARS.forEach((col, i) => { c.fillStyle = col; c.fillRect(Math.round(i * bw), 0, Math.ceil(bw) + 1, top); });
      c.fillStyle = '#0f0d16'; c.fillRect(0, top, W, H - top);
      const sw = W / 5;
      c.fillStyle = '#ff6ad5'; c.fillRect(((t / 2400) * (W + sw)) % (W + sw) - sw, top, sw, u);
      const label = v.sourceId ? `NO SIGNAL · ${s.sourceName || ''}`.slice(0, 40) : 'NO SOURCE';
      let px = Math.round(Math.min(H * 0.1, W * 0.07));
      c.font = `700 ${px}px "Pixelify Sans", ui-monospace, monospace`;
      const fit = c.measureText(label).width;
      if (fit > W * 0.86) { px = Math.max(8, Math.floor(px * W * 0.86 / fit)); c.font = `700 ${px}px "Pixelify Sans", ui-monospace, monospace`; }
      c.fillStyle = '#eee9ff'; c.textAlign = 'center'; c.textBaseline = 'middle';
      c.fillText(label, W / 2, top + (H - top) / 2 + u / 2);
    }
  }
}
