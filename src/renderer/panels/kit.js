// DOM helpers shared by the panels: element builder, inline icons (Tabler, MIT; pixel coin and trophy
// are Shellcade's), number formatting, item thumbnails and the coin-flight animation.
export const fmt = new Intl.NumberFormat('en-US');
const NS = 'http://www.w3.org/2000/svg';

export function h(tag, props = {}, ...kids) {
  const e = document.createElement(tag);
  for (const [k, v] of Object.entries(props || {})) {
    if (v == null || v === false) continue;
    if (k === 'style' && typeof v === 'object') Object.assign(e.style, v);
    else if (/^(aria-|data-|role$|for$|tabindex$)/.test(k)) e.setAttribute(k, v === true ? 'true' : v);
    else e[k] = v;
  }
  e.append(...kids.flat(Infinity).filter(k => k != null && k !== false));
  return e;
}

const S = (...d) => d.map(x => `<path d="${x}"/>`).join('');
const STROKE = {
  lock: S('M5 13a2 2 0 0 1 2 -2h10a2 2 0 0 1 2 2v6a2 2 0 0 1 -2 2h-10a2 2 0 0 1 -2 -2v-6z', 'M11 16a1 1 0 1 0 2 0a1 1 0 0 0 -2 0', 'M8 11v-4a4 4 0 1 1 8 0v4'),
  check: S('M5 12l5 5l10 -10'),
  x: S('M18 6l-12 12', 'M6 6l12 12'),
  plus: S('M12 5l0 14', 'M5 12l14 0'),
  info: S('M3 12a9 9 0 1 0 18 0a9 9 0 0 0 -18 0', 'M12 9h.01', 'M11 12h1v4h1'),
  alert: S('M3 12a9 9 0 1 0 18 0a9 9 0 0 0 -18 0', 'M12 8v4', 'M12 16h.01'),
  clock: S('M3 12a9 9 0 1 0 18 0a9 9 0 0 0 -18 0', 'M12 7v5l3 3'),
  trophy: S('M8 21l8 0', 'M12 17l0 4', 'M7 4l10 0', 'M17 4v8a5 5 0 0 1 -10 0v-8', 'M3 9a2 2 0 1 0 4 0a2 2 0 1 0 -4 0', 'M17 9a2 2 0 1 0 4 0a2 2 0 1 0 -4 0'),
  tv: S('M3 9a2 2 0 0 1 2 -2h14a2 2 0 0 1 2 2v9a2 2 0 0 1 -2 2h-14a2 2 0 0 1 -2 -2z', 'M16 3l-4 4l-4 -4', 'M15 7v13', 'M18 15v.01', 'M18 12v.01'),
  sparkles: S('M16 18a2 2 0 0 1 2 2a2 2 0 0 1 2 -2a2 2 0 0 1 -2 -2a2 2 0 0 1 -2 2zm0 -12a2 2 0 0 1 2 2a2 2 0 0 1 2 -2a2 2 0 0 1 -2 -2a2 2 0 0 1 -2 2zm-7 12a6 6 0 0 1 6 -6a6 6 0 0 1 -6 -6a6 6 0 0 1 -6 6a6 6 0 0 1 6 6z'),
  palette: S('M12 21a9 9 0 0 1 0 -18c4.97 0 9 3.582 9 8c0 1.06 -.474 2.078 -1.318 2.828c-.844 .75 -1.989 1.172 -3.182 1.172h-2.5a2 2 0 0 0 -1 3.75a1.3 1.3 0 0 1 -1 2.25',
    'M7.5 10.5a1 1 0 1 0 2 0a1 1 0 1 0 -2 0', 'M11.5 7.5a1 1 0 1 0 2 0a1 1 0 1 0 -2 0', 'M15.5 10.5a1 1 0 1 0 2 0a1 1 0 1 0 -2 0'),
  stars: S('M17.8 19.817l-2.172 1.138a.392 .392 0 0 1 -.568 -.41l.415 -2.411l-1.757 -1.707a.389 .389 0 0 1 .217 -.665l2.428 -.352l1.086 -2.193a.392 .392 0 0 1 .702 0l1.086 2.193l2.428 .352a.39 .39 0 0 1 .217 .665l-1.757 1.707l.414 2.41a.39 .39 0 0 1 -.567 .411l-2.172 -1.138z',
    'M6.2 19.817l-2.172 1.138a.392 .392 0 0 1 -.568 -.41l.415 -2.411l-1.757 -1.707a.389 .389 0 0 1 .217 -.665l2.428 -.352l1.086 -2.193a.392 .392 0 0 1 .702 0l1.086 2.193l2.428 .352a.39 .39 0 0 1 .217 .665l-1.757 1.707l.414 2.41a.39 .39 0 0 1 -.567 .411l-2.172 -1.138z',
    'M12 9.817l-2.172 1.138a.392 .392 0 0 1 -.568 -.41l.415 -2.411l-1.757 -1.707a.389 .389 0 0 1 .217 -.665l2.428 -.352l1.086 -2.193a.392 .392 0 0 1 .702 0l1.086 2.193l2.428 .352a.39 .39 0 0 1 .217 .665l-1.757 1.707l.414 2.41a.39 .39 0 0 1 -.567 .411l-2.172 -1.138z'),
  wallpaper: S('M8 6h10a2 2 0 0 1 2 2v10a2 2 0 0 1 -2 2h-12', 'M4 18a2 2 0 1 0 4 0a2 2 0 1 0 -4 0', 'M8 18v-12a2 2 0 1 0 -4 0v12'),
  photo: S('M15 8h.01', 'M3 6a3 3 0 0 1 3 -3h12a3 3 0 0 1 3 3v12a3 3 0 0 1 -3 3h-12a3 3 0 0 1 -3 -3v-12z', 'M3 16l5 -5c.928 -.893 2.072 -.893 3 0l5 5', 'M14 14l1 -1c.928 -.893 2.072 -.893 3 0l3 3'),
  movie: S('M4 6a2 2 0 0 1 2 -2h12a2 2 0 0 1 2 2v12a2 2 0 0 1 -2 2h-12a2 2 0 0 1 -2 -2z', 'M8 4l0 16', 'M16 4l0 16', 'M4 8l4 0', 'M4 16l4 0', 'M4 12l16 0', 'M16 8l4 0', 'M16 16l4 0'),
  refresh: S('M20 11a8.1 8.1 0 0 0 -15.5 -2m-.5 -4v4h4', 'M4 13a8.1 8.1 0 0 0 15.5 2m.5 4v-4h-4'),
  gamepad: S('M12 5h3.5a5 5 0 0 1 0 10h-5.5l-4.015 4.227a2.3 2.3 0 0 1 -3.923 -2.035l1.634 -8.173a5 5 0 0 1 4.904 -4.019h3.4z', 'M14 15l4.07 4.284a2.3 2.3 0 0 0 3.925 -2.023l-1.6 -8.232', 'M8 9v2', 'M7 10h2', 'M14 10h2'),
  heart: S('M19.5 12.572l-7.5 7.428l-7.5 -7.428a5 5 0 1 1 7.5 -6.566a5 5 0 1 1 7.5 6.572'),
  external: S('M12 6h-6a2 2 0 0 0 -2 2v10a2 2 0 0 0 2 2h10a2 2 0 0 0 2 -2v-6', 'M11 13l9 -9', 'M15 4h5v5'),
  world: S('M3 12a9 9 0 1 0 18 0a9 9 0 0 0 -18 0', 'M3.6 9h16.8', 'M3.6 15h16.8', 'M11.5 3a17 17 0 0 0 0 18', 'M12.5 3a17 17 0 0 1 0 18'),
  patreon: S('M20 8.408c-.003 -2.299 -1.746 -4.182 -3.79 -4.862c-2.54 -.844 -5.888 -.722 -8.312 .453c-2.939 1.425 -3.862 4.545 -3.896 7.656c-.028 2.559 .22 9.297 3.92 9.345c2.75 .036 3.159 -3.603 4.43 -5.356c.906 -1.247 2.071 -1.599 3.506 -1.963c2.465 -.627 4.146 -2.626 4.142 -5.273z'),
  coffee: S('M3 14c.83 .642 2.077 1.017 3.5 1c1.423 .017 2.67 -.358 3.5 -1c.83 -.642 2.077 -1.017 3.5 -1c1.423 -.017 2.67 .358 3.5 1', 'M8 3a2.4 2.4 0 0 0 -1 2a2.4 2.4 0 0 0 1 2', 'M12 3a2.4 2.4 0 0 0 -1 2a2.4 2.4 0 0 0 1 2', 'M3 10h14v5a6 6 0 0 1 -6 6h-2a6 6 0 0 1 -6 -6v-5z', 'M16.746 16.726a3 3 0 1 0 .252 -5.555'),
  store: S('M3 21l18 0', 'M3 7v1a3 3 0 0 0 6 0v-1m0 1a3 3 0 0 0 6 0v-1m0 1a3 3 0 0 0 6 0v-1h-18l2 -4h14l2 4', 'M5 21l0 -10.15', 'M19 21l0 -10.15', 'M9 21v-4a2 2 0 0 1 2 -2h2a2 2 0 0 1 2 2v4'),
  volume: S('M15 8a5 5 0 0 1 0 8', 'M17.7 5a9 9 0 0 1 0 14', 'M6 15h-2a1 1 0 0 1 -1 -1v-4a1 1 0 0 1 1 -1h2l3.5 -4.5a.8 .8 0 0 1 1.5 .5v14a.8 .8 0 0 1 -1.5 .5l-3.5 -4.5'),
  mute: S('M6 15h-2a1 1 0 0 1 -1 -1v-4a1 1 0 0 1 1 -1h2l3.5 -4.5a.8 .8 0 0 1 1.5 .5v14a.8 .8 0 0 1 -1.5 .5l-3.5 -4.5', 'M16 10l4 4m0 -4l-4 4'),
  chevL: S('M15 6l-6 6l6 6'), chevR: S('M9 6l6 6l-6 6'),
  target: S('M11 12a1 1 0 1 0 2 0a1 1 0 1 0 -2 0', 'M7 12a5 5 0 1 0 10 0a5 5 0 1 0 -10 0', 'M3 12a9 9 0 1 0 18 0a9 9 0 1 0 -18 0'),
  steam: S('M16.5 5a4.5 4.5 0 1 1 -.653 8.953l-4.347 3.009l0 .038a3 3 0 0 1 -2.824 3l-.176 0a3 3 0 0 1 -2.94 -2.402l-2.56 -1.098v-3.5l3.51 1.755a2.989 2.989 0 0 1 2.834 -.635l2.727 -3.818a4.5 4.5 0 0 1 4.429 -5.302z'),
};
// Pixel-art icons (crisp 1-unit grid).
const PIXEL = {
  coin: ['0 0 9 9', '<path fill="#9a5b12" d="M2 0h5v1H2zM2 8h5v1H2zM0 2h1v5H0zM8 2h1v5H8zM1 1h1v1H1zM7 1h1v1H7zM1 7h1v1H1zM7 7h1v1H7z"/><path fill="#ffd166" d="M2 1h5v7H2zM1 2h7v5H1z"/><path fill="#e8a33a" d="M7 2h1v5H7zM2 7h5v1H2zM4 3h1v3H4z"/><path fill="#fff5cf" d="M2 2h1v3H2zM3 2h1v1H3z"/>'],
  trophy: ['0 0 12 12', '<path fill="#9a5b12" d="M2 1h8v1H2zM1 2h1v3H1zM10 2h1v3h-1zM2 5h1v1H2zM9 5h1v1H9zM3 6h1v1H3zM8 6h1v1H8zM4 7h4v1H4zM5 8h2v1H5zM3 9h6v1H3zM3 10h6v1H3z"/><path fill="#ffd166" d="M3 2h6v4H3zM4 6h4v1H4zM5 7h2v1H5zM4 10h4v1H4z"/><path fill="#fff5cf" d="M4 2h1v3H4z"/><path fill="#e8a33a" d="M8 2h1v4H8zM7 6h1v1H7z"/>'],
  star: ['0 0 9 9', '<path fill="currentColor" d="M4 0h1v2H4zM3 2h3v1H3zM0 3h9v1H0zM1 4h7v1H1zM2 5h5v1H2zM2 6h2v1H2zM5 6h2v1H5zM1 7h2v1H1zM6 7h2v1H6z"/>'],
};

export function icon(name, cls = 'i') {
  const s = document.createElementNS(NS, 'svg');
  s.setAttribute('class', cls);
  s.setAttribute('aria-hidden', 'true');
  s.setAttribute('focusable', 'false');
  if (PIXEL[name]) {
    s.setAttribute('viewBox', PIXEL[name][0]);
    s.setAttribute('shape-rendering', 'crispEdges');
    s.innerHTML = PIXEL[name][1];
  } else {
    for (const [k, v] of [['viewBox', '0 0 24 24'], ['fill', 'none'], ['stroke', 'currentColor'], ['stroke-width', '2'], ['stroke-linecap', 'round'], ['stroke-linejoin', 'round']]) s.setAttribute(k, v);
    s.innerHTML = STROKE[name] || STROKE.info;
  }
  return s;
}

export const coinIcon = (cls = 'sc-coin') => icon('coin', cls);
export const coinAmount = (n, cls = '') => h('span', { className: `sc-amt ${cls}`.trim() }, coinIcon(), h('b', { textContent: fmt.format(n || 0) }));
export const rarityName = r => (r || 'common')[0].toUpperCase() + (r || 'common').slice(1);
export const reducedMotion = () => typeof matchMedia === 'function' && matchMedia('(prefers-reduced-motion: reduce)').matches;
export const getShell = ctx => ctx?.shell || globalThis.window?.shell || null;
// Catalog file paths are relative to src/renderer/.
export const assetUrl = file => new URL(`../${file}`, import.meta.url).href;
export const swatchBg = cols => (cols?.length > 1 ? `linear-gradient(135deg, ${cols.join(', ')})` : cols?.[0] || 'var(--panel-3)');
// Restart a one-shot CSS animation class.
export function replay(el, cls) { el.classList.remove(cls); void el.offsetWidth; el.classList.add(cls); }
// Stable hue for a name or id (avatars).
export const hueOf = s => [...String(s)].reduce((a, c) => (a * 31 + c.charCodeAt(0)) % 360, 7);

// A small visual for any catalog item: frame art, a swatch dot or the backdrop-slot glyph.
export function itemThumb(it, cls = 'sc-ithumb') {
  if (!it) return h('span', { className: `${cls} sc-ithumb-x` }, icon('sparkles'));
  if (it.kind === 'frame' && it.file) {
    return h('span', { className: `${cls} is-frame${it.style === 'pixel' ? ' is-pixel' : ''}` },
      h('img', { src: assetUrl(it.file), alt: '', decoding: 'async', loading: 'lazy', draggable: false }));
  }
  if (it.kind === 'backdrop-slot') return h('span', { className: `${cls} is-glyph` }, icon('wallpaper'));
  return h('span', { className: `${cls} is-dot`, style: { background: swatchBg(it.swatch || it.colors) } });
}

// Pixel coins arcing from one element to another (a purchase: wallet -> item). Resolves when done.
export function coinFlight(from, to, n = 7) {
  if (!from || !to || reducedMotion() || typeof document.body.animate !== 'function') return Promise.resolve();
  const a = from.getBoundingClientRect(), b = to.getBoundingClientRect();
  if (!a.width || !b.width) return Promise.resolve();
  const x0 = a.left + a.width / 2, y0 = a.top + a.height / 2, x1 = b.left + b.width / 2, y1 = b.top + b.height / 2;
  const runs = Array.from({ length: n }, (_, i) => {
    const c = h('span', { className: 'sc-fly-coin' }, coinIcon());
    document.body.append(c);
    const sx = (Math.random() - 0.5) * 36, lift = -60 - Math.random() * 60, mx = (x0 + x1) / 2 + sx, my = Math.min(y0, y1) + lift;
    const anim = c.animate([
      { transform: `translate(${x0 - 8}px, ${y0 - 8}px) scale(.6)`, opacity: 0 },
      { transform: `translate(${x0 - 8 + sx}px, ${y0 - 22}px) scale(1.1)`, opacity: 1, offset: 0.18 },
      { transform: `translate(${mx - 8}px, ${my - 8}px) scale(1)`, opacity: 1, offset: 0.55 },
      { transform: `translate(${x1 - 8 + sx / 3}px, ${y1 - 8}px) scale(.5)`, opacity: 0 },
    ], { duration: 720 + i * 40, delay: i * 55, easing: 'cubic-bezier(.3,.6,.4,1)', fill: 'both' });
    return anim.finished.catch(() => {}).then(() => c.remove());
  });
  return Promise.all(runs);
}
