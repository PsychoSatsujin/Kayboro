// Shell finishes and shell fills. Both are stacks of absolutely positioned layers that mirror the
// frame <img>'s box and are masked by the frame's shape (mask-image: url(frame), then its carved
// silhouette), so effects land on the shell only, never on the transparent screen hole.
//   finish layers: siblings after the frame image (z-index 1), each with its own mix-blend-mode
//   fill layer:    first child of the view, painted behind the capture and the frame
import { createScreensaver } from './screensavers.js';
import { onFrame, reducedMotion, onReducedMotionChange } from './ticker.js';
import { colorwayOf } from './colorways.js';

export const FINISH_IDS = ['none', 'matte', 'gloss', 'holo', 'pearl', 'glitter'];
// Layer recipes (classes styled in fx.css). motion: pointer tilt + time drift via --fx-x/--fx-y.
export const FINISHES = {
  none: { layers: [] },
  matte: { layers: ['matte-desat', 'matte-flat', 'matte-grain', 'matte-light'] },
  gloss: { layers: ['gloss-coat', 'gloss-pop', 'rim-low', 'gloss-spec', 'gloss-sweep', 'rim', 'rim-side', 'rim-soft'], motion: true },
  holo: { layers: ['holo-tint', 'holo-foil', 'holo-spark', 'holo-bars', 'holo-glare', 'rim'], motion: true },
  pearl: { layers: ['pearl-milk', 'pearl-hue', 'pearl-nacre', 'pearl-sheen', 'rim-pearl'], motion: true },
  glitter: { layers: ['glitter-flake a', 'glitter-flake b', 'glitter-flake c', 'glitter-flake d', 'glitter-stars'], stars: 16 },
};
export const FILL_TYPES = ['none', 'screensaver', 'image', 'video'];

// True when a shell fill can be seen: see-through frames, or any frame in a translucent colorway.
export const needsShellFill = (frame, colorwayId) => !!frame?.translucent || colorwayOf(colorwayId).shellOpacity < 1;

let cssLinked = false;
// Adds fx.css to the document once (a <link>, so it works under the app's style-src CSP).
export function ensureFxStyles(doc = document) {
  if (cssLinked || doc.querySelector('link[data-fx]')) return;
  const l = doc.createElement('link');
  Object.assign(l, { rel: 'stylesheet', href: new URL('./fx.css', import.meta.url).href });
  l.dataset.fx = '';
  doc.head.append(l);
  cssLinked = true;
}

const el = (tag, cls) => { const e = document.createElement(tag); if (cls) e.className = cls; return e; };
const cssUrl = u => `url(${JSON.stringify(new URL(u, document.baseURI).href)})`;
const noop = () => {};

// Finds the frame image and the element the layers live in. viewEl may be the box holding the frame
// <img> (the stage's .shell-front), any ancestor of an img.frame, the <img> itself, or a bare box
// sized like the frame (the stage's .shell-back), which the layers then simply fill.
function host(viewEl) {
  const img = viewEl.tagName === 'IMG' ? viewEl : viewEl.querySelector(':scope > img.frame, :scope > img') || viewEl.querySelector('img.frame');
  return { img, box: img ? img.parentElement : viewEl };
}

// The shell's silhouette as a mask image: everything not reachable from the image border through
// low-alpha pixels (< 0.4: soft drop shadows, glows), minus fully transparent pixels (the screen hole).
// Translucent plastic counts at full strength, so fills show through it exactly as much as the art
// lets them, and finishes coat it like a real surface. Cached per frame; null when pixels are unreadable.
const shapes = new Map();
export function shellShape(frameUrl) {
  if (!shapes.has(frameUrl)) shapes.set(frameUrl, new Promise((res, rej) => {
    const img = new Image();
    img.onload = () => { try { carve(img).then(res, rej); } catch (e) { rej(e); } };
    img.onerror = rej;
    img.src = frameUrl;
  }).catch(() => null));
  return shapes.get(frameUrl);
}
function carve(img) {
  const nw = img.naturalWidth, nh = img.naturalHeight, k = Math.min(4, 1024 / Math.max(nw, nh));
  if (!nw || !nh) return Promise.resolve(null); // no intrinsic size (bare SVG): keep the alpha mask
  const W = Math.round(nw * k), H = Math.round(nh * k), c = el('canvas'), g = c.getContext('2d', { willReadFrequently: true });
  Object.assign(c, { width: W, height: H });
  g.drawImage(img, 0, 0, W, H);
  const id = g.getImageData(0, 0, W, H), px = id.data, out = new Uint8Array(W * H), stack = new Int32Array(W * H);
  let n = 0;
  const push = i => { if (!out[i] && px[i * 4 + 3] < 102) { out[i] = 1; stack[n++] = i; } };
  for (let x = 0; x < W; x++) { push(x); push((H - 1) * W + x); }
  for (let y = 0; y < H; y++) { push(y * W); push(y * W + W - 1); }
  while (n) {
    const i = stack[--n], x = i % W;
    if (x > 0) push(i - 1);
    if (x < W - 1) push(i + 1);
    if (i >= W) push(i - W);
    if (i < W * (H - 1)) push(i + W);
  }
  for (let i = 0; i < out.length; i++) px[i * 4 + 3] = !out[i] && px[i * 4 + 3] > 4 ? 255 : 0;
  g.putImageData(id, 0, 0);
  return new Promise(res => c.toBlob(b => res(b ? URL.createObjectURL(b) : null)));
}

// Masks `wrap` with the frame: its own alpha right away, the carved silhouette once that is ready.
function maskWith(wrap, url) {
  if (!url || wrap.fxSrc === url) return;
  wrap.fxSrc = url;
  wrap.style.setProperty('--fx-mask', cssUrl(url));
  wrap.classList.remove('fx-shaped');
  wrap.classList.add('fx-pending');
  shellShape(new URL(url, document.baseURI).href).then(shape => {
    if (wrap.fxSrc !== url) return;
    if (shape) { wrap.style.setProperty('--fx-mask', cssUrl(shape)); wrap.classList.add('fx-shaped'); }
    wrap.classList.remove('fx-pending');
  });
}

// Keeps `layer` on top of the frame image's box (stage.place() rewrites its inline px box on every
// drag), hidden whenever the frame is, and masked by frameUrl, then by whatever src the img switches to.
function follow({ img, box }, layer, frameUrl, onSize) {
  let restorePos = null;
  if (getComputedStyle(box).position === 'static') { restorePos = box.style.position; box.style.position = 'relative'; }
  let w = 0, h = 0, src = img?.src;
  maskWith(layer, frameUrl || src);
  const sync = () => {
    let x = 0, y = 0, nw = box.clientWidth, nh = box.clientHeight;
    if (img) {
      const s = img.style;
      if (s.left && s.top && s.width && s.height) [x, y, nw, nh] = [s.left, s.top, s.width, s.height].map(parseFloat);
      else [x, y, nw, nh] = [img.offsetLeft, img.offsetTop, img.offsetWidth, img.offsetHeight];
      layer.hidden = img.hidden;
      if (img.src && img.src !== src) maskWith(layer, (src = img.src));
    }
    Object.assign(layer.style, { left: `${x}px`, top: `${y}px`, width: `${nw}px`, height: `${nh}px` });
    if (nw !== w || nh !== h) { w = nw; h = nh; onSize?.(w, h); }
  };
  const mo = img && new MutationObserver(sync);
  mo?.observe(img, { attributes: true, attributeFilter: ['style', 'hidden', 'src'] });
  const ro = new ResizeObserver(sync);
  ro.observe(img || box);
  sync();
  return () => {
    mo?.disconnect(); ro.disconnect();
    if (restorePos !== null) box.style.position = restorePos;
  };
}

// ---- Pointer tilt: one window listener shared by every animated finish ----------------------------
const pointer = { x: 0, y: 0, at: -1e9 };
let pointerUsers = 0;
const onMove = e => { pointer.x = e.clientX; pointer.y = e.clientY; pointer.at = performance.now(); };
const onOut = e => { if (!e.relatedTarget) pointer.at = -1e9; };
function usePointer() {
  if (!pointerUsers++) { addEventListener('pointermove', onMove, { passive: true }); document.addEventListener('pointerout', onOut); }
  return () => { if (!--pointerUsers) { removeEventListener('pointermove', onMove); document.removeEventListener('pointerout', onOut); } };
}

const abs = Math.abs, clamp1 = v => Math.max(-1, Math.min(1, v));
// Eased tilt in [-1, 1]: slow Lissajous drift, pulled toward the pointer while it is over the shell.
// Calls gone() once the layers have been removed from the document without being disposed.
function tilt(wrap, gone) {
  let x = 0.35, y = -0.25, pull = 0, tx = 0, ty = 0, over = false, last = '';
  return {
    read(now) {
      over = false;
      if (!wrap.isConnected) return gone();
      if (now - pointer.at > 4000) return;
      const r = wrap.getBoundingClientRect();
      if (!r.width || !r.height) return;
      tx = ((pointer.x - r.left) / r.width) * 2 - 1; ty = ((pointer.y - r.top) / r.height) * 2 - 1;
      over = abs(tx) < 1.15 && abs(ty) < 1.15;
    },
    write(now, dt) {
      if (!wrap.isConnected) return;
      const s = now / 1000, e = 1 - Math.exp(-dt / 160);
      pull += ((over ? 1 : 0) - pull) * (1 - Math.exp(-dt / 400));
      const dx = 0.7 * Math.sin(s * 0.27) + 0.2 * Math.sin(s * 0.71), dy = 0.55 * Math.sin(s * 0.19 + 1.2) + 0.15 * Math.sin(s * 0.53);
      x += (dx + (clamp1(tx) - dx) * pull - x) * e; y += (dy + (clamp1(ty) - dy) * pull - y) * e;
      const vx = x.toFixed(3), vy = y.toFixed(3);
      if (vx + vy === last) return;
      last = vx + vy;
      wrap.style.setProperty('--fx-x', vx);
      wrap.style.setProperty('--fx-y', vy);
    },
  };
}

// applyFinish(viewEl, frameUrl, finishId, { intensity = 1 }) -> dispose(). Re-applying replaces.
const finishes = new WeakMap(), fills = new WeakMap();
export function applyFinish(viewEl, frameUrl, finishId, { intensity = 1 } = {}) {
  finishes.get(viewEl)?.();
  const recipe = FINISHES[finishId];
  if (!recipe || !recipe.layers.length) return noop;
  const h = host(viewEl);
  if (!frameUrl && !h.img?.src) return noop;
  ensureFxStyles();
  const wrap = el('div', `fx-finish fx-${finishId}`);
  wrap.style.setProperty('--fx-i', String(Math.max(0, Math.min(1.5, +intensity || 0))));
  for (const name of recipe.layers) {
    const l = el('div', `fx-l ${name.split(' ').map(n => (n.length > 1 ? `fx-${n}` : `fx-v-${n}`)).join(' ')}`);
    l.append(el('i'));
    if (name === 'glitter-stars') for (let i = 0; i < recipe.stars; i++) l.append(star(i));
    wrap.append(l);
  }
  if (h.img) h.img.after(wrap); else h.box.append(wrap);
  const unfollow = follow(h, wrap, frameUrl, (w, hh) => wrap.style.setProperty('--fx-rim', `${Math.max(1.5, Math.min(5, hh * 0.0035)).toFixed(2)}px`));
  let stopAnim = noop, stopPointer = noop;
  const animate = still => {
    stopAnim(); stopPointer(); stopAnim = stopPointer = noop;
    if (recipe.motion && !still) { stopPointer = usePointer(); stopAnim = onFrame(tilt(wrap, () => dispose())); }
  };
  const offRm = recipe.motion ? onReducedMotionChange(animate) : noop;
  animate(reducedMotion());
  const dispose = () => {
    if (finishes.get(viewEl) === dispose) finishes.delete(viewEl);
    stopAnim(); stopPointer(); offRm(); unfollow(); wrap.remove();
  };
  finishes.set(viewEl, dispose);
  return dispose;
}

// Glitter glints: scattered four-point stars with their own twinkle timing (CSS animation).
function star(i) {
  const s = el('b'), r = (n => () => (n = (n * 16807) % 2147483647) / 2147483647)(i * 7919 + 13);
  s.style.left = `${(r() * 100).toFixed(1)}%`;
  s.style.top = `${(r() * 100).toFixed(1)}%`;
  s.style.setProperty('--d', `${(2.4 + r() * 3.2).toFixed(2)}s`);
  s.style.setProperty('--delay', `${(-r() * 6).toFixed(2)}s`);
  s.style.setProperty('--s', (0.6 + r() * 0.8).toFixed(2));
  return s;
}

// applyShellFill(viewEl, frameUrl, { type: 'none'|'screensaver'|'image'|'video', id, url, palette }, opts)
// -> dispose(). The fill shows through translucent shell plastic (and the 'clear' colorway).
// opts: { fps, pixelRatio } for screensavers (pixelRatio defaults to min(devicePixelRatio, 1)).
export function applyShellFill(viewEl, frameUrl, fill, { fps, pixelRatio } = {}) {
  fills.get(viewEl)?.();
  const type = fill?.type;
  if (!type || type === 'none' || !(type === 'screensaver' ? fill.id : fill.url) || !FILL_TYPES.includes(type)) return noop;
  const h = host(viewEl);
  if (!frameUrl && !h.img?.src) return noop;
  ensureFxStyles();
  const wrap = el('div', `fx-fill fx-fill-${type}`), layer = el('div', 'fx-l fx-fill-l');
  wrap.append(layer);
  let saver = null, media = null;
  if (type === 'screensaver') {
    const c = el('canvas');
    layer.append(c);
    saver = createScreensaver(fill.id, c, { palette: fill.palette, fps, pixelRatio: pixelRatio ?? Math.min(1, devicePixelRatio || 1) });
  } else {
    media = el(type === 'video' ? 'video' : 'img');
    if (type === 'video') {
      Object.assign(media, { muted: true, loop: true, playsInline: true, autoplay: !reducedMotion(), preload: 'auto' });
      media.addEventListener('error', () => wrap.classList.add('fx-failed'));
    } else Object.assign(media, { alt: '', draggable: false, decoding: 'async' });
    media.src = fill.url;
    layer.append(media);
    if (type === 'video' && !reducedMotion()) media.play().catch(noop);
  }
  h.box.prepend(wrap);
  const unfollow = follow(h, wrap, frameUrl, () => saver?.resize());
  const dispose = () => {
    if (fills.get(viewEl) === dispose) fills.delete(viewEl);
    saver?.stop();
    if (media?.tagName === 'VIDEO') { media.pause(); media.removeAttribute('src'); media.load(); }
    unfollow(); wrap.remove();
  };
  fills.set(viewEl, dispose);
  return dispose;
}
