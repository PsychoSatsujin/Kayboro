// Shell finishes and shell fills. Both are stacks of absolutely positioned layers that mirror the
// frame <img>'s box and are masked by the frame itself (mask-image: url(frame), then masks carved
// from it), so effects land on the shell only, never on the transparent screen hole.
//   finish layers: siblings after the frame image (z-index 1), each with its own mix-blend-mode
//   fill layer:    first child of the view, painted behind the capture and the frame
//   depth layer:   right after the frame image: the shell's 3D shading (depth.js), solid or glass
import { createScreensaver } from './screensavers.js';
import { shellDepth, isShadow } from './depth.js';
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

// Masks carved from the frame, cached per URL: everything not reachable from the image border through
// low-alpha pixels (< 0.4: soft drop shadows, glows), minus fully transparent pixels (the screen hole).
//   shape: that region at full strength. Fills show through translucent plastic exactly as much as
//          the art lets them; edge lights trace real edges only.
//   skin:  the frame's own alpha inside it. Finishes scale with the plastic's opacity, because the
//          stage's .shell-front is an isolated group where a blend layer over see-through pixels would
//          otherwise make the shell opaque.
// Resolves to null when the pixels are unreadable; callers then keep the plain alpha mask.
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
async function carve(img) {
  const nw = img.naturalWidth, nh = img.naturalHeight, k = Math.min(4, 1024 / Math.max(nw, nh));
  if (!nw || !nh) return null; // no intrinsic size (bare SVG): keep the alpha mask
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
  const blob = () => new Promise(res => c.toBlob(b => res(b && URL.createObjectURL(b)))); // snapshots the canvas now
  for (let i = 0; i < out.length; i++) if (out[i]) px[i * 4 + 3] = 0;
  g.putImageData(id, 0, 0);
  const skin = blob();
  // The silhouette leaves out drop shadows (dark and see-through), so a fill stays inside the shell.
  for (let i = 3; i < px.length; i += 4) {
    const luma = (0.2126 * px[i - 3] + 0.7152 * px[i - 2] + 0.0722 * px[i - 1]) / 255;
    px[i] = px[i] > 4 && !isShadow(px[i] / 255, luma) ? 255 : 0;
  }
  g.putImageData(id, 0, 0);
  const [s, sh] = await Promise.all([skin, blob()]);
  return s && sh ? { skin: s, shape: sh } : null;
}

// Masks `wrap` with the frame: its plain alpha right away, the carved masks once they are ready.
function maskWith(wrap, url) {
  if (!url || wrap.fxSrc === url) return;
  wrap.fxSrc = url;
  wrap.style.setProperty('--fx-skin', cssUrl(url));
  wrap.style.setProperty('--fx-shape', cssUrl(url));
  wrap.classList.remove('fx-shaped');
  wrap.classList.add('fx-pending');
  shellShape(new URL(url, document.baseURI).href).then(m => {
    if (wrap.fxSrc !== url) return;
    if (m) {
      wrap.style.setProperty('--fx-skin', cssUrl(m.skin));
      wrap.style.setProperty('--fx-shape', cssUrl(m.shape));
      wrap.classList.add('fx-shaped');
    }
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
      layer.style.setProperty('--fx-shell', s.opacity || 1); // a 'clear' colorway thins the coating too
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

// applyDepth(viewEl, frameUrl, { glass, grid }) -> dispose(). Lights the shell as a moulded 3D part from
// its depth map: `glass` for see-through plastic (rims, caustics), `grid` ({w, h}) for pixel shells
// (computed on their pixel grid, scaled up crisp). Re-applying replaces.
const depths = new WeakMap();
export function applyDepth(viewEl, frameUrl, { glass = false, grid = null } = {}) {
  depths.get(viewEl)?.();
  const h = host(viewEl), url = frameUrl || h.img?.src;
  if (!url) return noop;
  ensureFxStyles();
  const wrap = el('div', `fx-depth${glass ? ' fx-depth-glass' : ''}${grid ? ' fx-depth-pixel' : ''}`);
  if (h.img) h.img.after(wrap); else h.box.append(wrap);
  const unfollow = follow(h, wrap, url);
  let live = true;
  shellDepth(new URL(url, document.baseURI).href, { grid }).then(m => {
    if (live && m) wrap.style.backgroundImage = cssUrl(glass ? m.glass : m.light);
  });
  const dispose = () => {
    live = false;
    if (depths.get(viewEl) === dispose) depths.delete(viewEl);
    unfollow(); wrap.remove();
  };
  depths.set(viewEl, dispose);
  return dispose;
}

// Bends `layer` (the fill behind clear plastic) with the shell's refraction maps: an SVG displacement
// filter sized to the layer in px, so it follows every resize. The map blends from the full one (edges
// and a gentle dome over the body) to the edges-only one as fill clarity rises. Returns
// { resize(w, h), clarity(v), dispose() }; `onFilter(css)` receives the CSS filter to use (or '').
let refractIds = 0;
function refraction(layer, frameUrl, grid, onFilter) {
  const NS = 'http://www.w3.org/2000/svg', id = `fx-refract-${++refractIds}`, mk = (t, a) => { const e = document.createElementNS(NS, t); for (const k in a) e.setAttribute(k, a[k]); return e; };
  const svg = mk('svg', { width: 0, height: 0, 'aria-hidden': 'true', class: 'fx-defs' });
  const filter = mk('filter', { id, filterUnits: 'userSpaceOnUse', primitiveUnits: 'userSpaceOnUse', 'color-interpolation-filters': 'sRGB', x: 0, y: 0 });
  const full = mk('feImage', { result: 'full', x: 0, y: 0, preserveAspectRatio: 'none' });
  const lip = mk('feImage', { result: 'lip', x: 0, y: 0, preserveAspectRatio: 'none' });
  const mix = mk('feComposite', { in: 'full', in2: 'lip', operator: 'arithmetic', k1: 0, k2: 1, k3: 0, k4: 0, result: 'map' });
  const disp = mk('feDisplacementMap', { in: 'SourceGraphic', in2: 'map', xChannelSelector: 'R', yChannelSelector: 'G', scale: 0 });
  filter.append(full, lip, mix, disp);
  svg.append(filter);
  layer.parentElement.append(svg);
  let bevel = 0.045, w = 0, h = 0, v = 0, ready = false, live = true;
  const apply = () => {
    mix.setAttribute('k2', (1 - v).toFixed(3));
    mix.setAttribute('k3', v.toFixed(3));
    if (!ready || !w || !h) return;
    for (const e of [filter, full, lip]) { e.setAttribute('width', w); e.setAttribute('height', h); }
    disp.setAttribute('scale', (Math.min(w, h) * bevel * 1.25).toFixed(1)); // up to ~60% of the bevel width
    onFilter(`url(#${id})`);
  };
  shellDepth(new URL(frameUrl, document.baseURI).href, { grid }).then(m => {
    if (!live || !m) return;
    full.setAttribute('href', m.refract);
    lip.setAttribute('href', m.refractEdge);
    bevel = m.bevel;
    ready = true;
    apply();
  });
  return {
    resize(nw, nh) { w = nw; h = nh; apply(); },
    clarity(nv) { v = nv; apply(); },
    dispose() { live = false; onFilter(''); svg.remove(); },
  };
}

// applyShellFill(viewEl, frameUrl, { type: 'none'|'screensaver'|'image'|'video', id, url, palette }, opts)
// -> dispose(). The fill shows through translucent shell plastic (and the 'clear' colorway).
// opts: { fps, pixelRatio } for screensavers (pixelRatio defaults to min(devicePixelRatio, 1));
// { refract: true, grid } bends the fill near the shell's edges, as if held inside curved plastic.
// setFillClarity() adjusts a live fill (its colour and bend) without rebuilding it.
const fillLooks = new WeakMap(); // viewEl -> { clarity(v) }
export function applyShellFill(viewEl, frameUrl, fill, { fps, pixelRatio, refract = false, grid = null } = {}) {
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
  // The layer's CSS filter: the bend (if any), then a little extra colour as clarity rises.
  let bendCss = '', v = 0;
  const paint = () => { layer.style.filter = [bendCss, v > 0 ? `saturate(${(1 + 0.3 * v).toFixed(3)})` : ''].filter(Boolean).join(' '); };
  const bend = refract && (frameUrl || h.img?.src) ? refraction(layer, frameUrl || h.img.src, grid, css => { bendCss = css; paint(); }) : null;
  fillLooks.set(viewEl, { clarity(nv) { v = nv; bend?.clarity(nv); paint(); } });
  const unfollow = follow(h, wrap, frameUrl, (w, hh) => { saver?.resize(); bend?.resize(w, hh); });
  const dispose = () => {
    if (fills.get(viewEl) === dispose) fills.delete(viewEl);
    fillLooks.delete(viewEl);
    bend?.dispose();
    saver?.stop();
    if (media?.tagName === 'VIDEO') { media.pause(); media.removeAttribute('src'); media.load(); }
    unfollow(); wrap.remove();
  };
  fills.set(viewEl, dispose);
  return dispose;
}

// Fill clarity (0..1) of a see-through shell: how much its face stops covering the fill. The face (frame
// art, finish and depth shading in `frontEl`) thins to 1 - 0.9 * v over the body while a band along every
// edge stays as it is (rims, glare, corners); the fill in `backEl` bends only at the edges and gets a
// little more colour. 0 = the shell's normal look. Cheap to call on every render.
export function setFillClarity(frontEl, backEl, frameUrl, v, { grid = null } = {}) {
  v = Math.min(1, Math.max(0, Number(v) || 0));
  fillLooks.get(backEl)?.clarity(v);
  const key = v > 0 && frameUrl ? `${frameUrl}|${grid ? `${grid.w}x${grid.h}` : ''}|${v.toFixed(3)}` : '';
  if (frontEl.fxClarity === key) return;
  frontEl.fxClarity = key;
  const clear = () => { for (const k of ['maskImage', 'maskSize', 'maskRepeat', 'maskComposite']) frontEl.style[k] = ''; };
  if (!key) return clear();
  shellDepth(new URL(frameUrl, document.baseURI).href, { grid }).then(m => {
    if (frontEl.fxClarity !== key) return;
    if (!m) return clear();
    const a = (1 - 0.9 * v).toFixed(3);
    Object.assign(frontEl.style, { maskImage: `linear-gradient(rgba(0,0,0,${a}), rgba(0,0,0,${a})), ${cssUrl(m.edge)}`,
      maskSize: '100% 100%', maskRepeat: 'no-repeat', maskComposite: 'add' });
  });
}
