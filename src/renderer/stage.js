// Stage: draws the background and every screen (live capture or test pattern + frame overlay),
// and handles mouse move/resize. Geometry comes from layout.js; state lives in app.scene.
import { fitRect, frameOuterRect, resizeRect, cursorToStage } from './layout.js';

const HANDLES = ['n', 's', 'e', 'w', 'ne', 'nw', 'se', 'sw'];
const OBJECT_FIT = { contain: 'contain', cover: 'cover', stretch: 'fill' };
const BG_SIZE = { cover: 'cover', contain: 'contain', stretch: '100% 100%', tile: 'auto' };
const BARS = ['#c0c0c0', '#c0c000', '#00c0c0', '#00c000', '#c000c0', '#c00000', '#0000c0'];
const make = (tag, cls) => { const e = document.createElement(tag); if (cls) e.className = cls; return e; };
const box = (e, r) => Object.assign(e.style, { left: `${r.x}px`, top: `${r.y}px`, width: `${r.w}px`, height: `${r.h}px` });

export class Stage {
  constructor(app, root) {
    this.app = app;
    this.views = new Map(); // screen id -> view
    this.layer = root.querySelector('#screens');
    this.bg = root.querySelector('#bg');
    this.cursor = root.querySelector('#cursor');
    this.bgKey = '';
    root.addEventListener('pointerdown', e => { if (!e.target.closest('.screen')) app.select(null); });
    const tick = t => { this.drawPatterns(t); requestAnimationFrame(tick); };
    requestAnimationFrame(tick);
  }

  render() {
    const { screens, selectedId } = this.app.scene;
    const ids = new Set(screens.map(s => s.id));
    for (const [id, v] of this.views) if (!ids.has(id)) this.destroy(v);
    for (const s of screens) {
      const v = this.views.get(s.id) || this.create(s.id);
      if (v.sourceId !== (s.sourceId || null)) this.capture(v, s.sourceId || null);
      this.place(s, v);
      v.el.classList.toggle('sel', s.id === selectedId);
    }
    this.renderBg();
  }

  create(id) {
    const v = { id, el: make('div', 'screen'), video: make('video'), canvas: make('canvas'), frame: make('img', 'frame'),
      sourceId: undefined, stream: null, aspect: null, frameUrl: '' };
    Object.assign(v.video, { muted: true, autoplay: true, playsInline: true });
    Object.assign(v.canvas, { width: 320, height: 180 });
    Object.assign(v.frame, { draggable: false, alt: '' });
    v.el.append(v.canvas, v.video, v.frame);
    for (const h of HANDLES) { const d = make('div', `handle h-${h}`); d.dataset.h = h; v.el.append(d); }
    const sized = () => this.onVideoSize(v);
    v.video.addEventListener('loadedmetadata', sized);
    v.video.addEventListener('resize', sized);
    v.el.addEventListener('pointerdown', e => this.down(e, id));
    v.el.addEventListener('dblclick', e => { if (!e.target.dataset.h && !this.app.playing) this.app.toggleFit(id); });
    this.layer.append(v.el);
    this.views.set(id, v);
    return v;
  }

  destroy(v) { this.stop(v); v.el.remove(); this.views.delete(v.id); }

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
      if (v.sourceId === sourceId) this.app.toast(`Capture failed: ${err?.message || err}`);
    }
  }

  onVideoSize(v) {
    const { videoWidth: w, videoHeight: h } = v.video;
    if (!w || !h || !v.stream) return;
    v.el.classList.add('live');
    if (Math.abs(w / h - (v.aspect || 0)) < 1e-3) return;
    v.aspect = w / h;
    this.app.sourceAspectChanged(v.id);
  }

  place(s, v = this.views.get(s.id)) {
    if (!v) return;
    const r = s.rect, f = this.app.frameOf(s);
    box(v.el, r);
    v.el.style.zIndex = s.z;
    v.el.hidden = s.visible === false;
    v.video.style.objectFit = v.canvas.style.objectFit = OBJECT_FIT[s.fit] || 'contain';
    v.frame.hidden = !f;
    if (!f) return;
    if (v.frameUrl !== f.url) v.frame.src = v.frameUrl = f.url;
    box(v.frame, frameOuterRect({ x: 0, y: 0, w: r.w, h: r.h }, f.hole));
  }

  // Click selects, drag moves, handles resize (aspect-locked unless Shift is held).
  down(e, id) {
    if (this.app.playing || e.button !== 0) return;
    e.preventDefault();
    document.activeElement?.blur?.(); // let arrow keys reach the stage
    this.app.select(id);
    const s = this.app.get(id), el = e.currentTarget, handle = e.target.dataset.h;
    if (!s) return;
    const start = { ...s.rect }, sx = e.clientX, sy = e.clientY;
    el.setPointerCapture(e.pointerId);
    const move = ev => {
      const dx = ev.clientX - sx, dy = ev.clientY - sy;
      s.rect = handle ? resizeRect(start, handle, dx, dy, ev.shiftKey ? null : this.app.aspectOf(s))
        : { ...start, x: start.x + dx, y: start.y + dy };
      this.place(s);
    };
    const up = () => {
      el.removeEventListener('pointermove', move);
      el.removeEventListener('pointerup', up);
      el.removeEventListener('pointercancel', up);
      this.app.changed();
    };
    el.addEventListener('pointermove', move);
    el.addEventListener('pointerup', up);
    el.addEventListener('pointercancel', up);
  }

  // Where the captured picture actually is (letterboxed or cropped inside the content rect).
  videoRect(s) {
    return fitRect(this.views.get(s.id)?.aspect || 16 / 9, s.rect, s.fit);
  }

  showCursor(s, u, v, inside) {
    const p = s && inside ? cursorToStage(u, v, this.videoRect(s)) : null, r = s?.rect;
    const ok = !!p && p.x >= r.x && p.x <= r.x + r.w && p.y >= r.y && p.y <= r.y + r.h;
    this.cursor.hidden = !ok;
    if (ok) this.cursor.style.transform = `translate(${p.x}px, ${p.y}px)`;
  }

  renderBg() {
    const b = this.app.scene.background, key = JSON.stringify(b);
    if (key === this.bgKey) return;
    this.bgKey = key;
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
      vid.addEventListener('error', () => this.app.toast('Could not play background video.'));
      this.bg.append(vid);
      vid.play().catch(() => {});
    }
  }

  // Animated colour bars on every screen that has no live picture.
  drawPatterns(t) {
    for (const v of this.views.values()) {
      if (v.el.classList.contains('live') || v.el.hidden) continue;
      const c = v.canvas.getContext('2d'), W = 320, H = 180, bw = W / BARS.length;
      BARS.forEach((col, i) => { c.fillStyle = col; c.fillRect(i * bw, 0, bw + 1, H * 0.68); });
      c.fillStyle = '#111'; c.fillRect(0, H * 0.68, W, H * 0.32);
      c.fillStyle = '#fff'; c.fillRect(((t / 6) % (W + 60)) - 60, H * 0.68, 60, 6);
      const s = this.app.get(v.id);
      c.font = '600 13px system-ui, sans-serif'; c.textAlign = 'center';
      c.fillText(v.sourceId ? `NO SIGNAL · ${s?.sourceName || ''}`.slice(0, 44) : 'NO SOURCE', W / 2, H * 0.88);
    }
  }
}
