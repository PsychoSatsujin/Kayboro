// FX demo: every finish / colorway / fill on real frames, laid out like the stage (.view = screen
// rect, img.frame = frame box from frameOuterRect). Used by demo-shot.cjs for screenshots.
import { FRAMES } from '../frames/frames.js';
import { frameOuterRect } from '../layout.js';
import { applyFinish, applyShellFill, FINISH_IDS, ensureFxStyles } from './finishes.js';
import { applyColorway, COLORWAY_IDS } from './colorways.js';
import { createScreensaver, SCREENSAVER_IDS } from './screensavers.js';

const q = new URLSearchParams(location.search);
const view = q.get('view') || 'all';
const out = document.getElementById('out');
const make = (tag, cls, text) => { const e = document.createElement(tag); if (cls) e.className = cls; if (text) e.textContent = text; return e; };
const catalog = {};
const frameOf = id => FRAMES.find(f => f.id === id) || catalog[id];

async function loadCatalog() {
  for (const f of ['frames-pixel', 'frames-vector']) {
    try {
      const url = new URL(`../../catalog/${f}.json`, import.meta.url).href;
      const j = (await import(url, { with: { type: 'json' } })).default;
      for (const fr of j.frames) catalog[fr.id] = { ...fr, url: new URL(`../${fr.file}`, import.meta.url).href };
    } catch { /* catalog not readable via fetch: built-in frames only */ }
  }
}

// A fake "game" in the screen hole so it is obvious that effects never touch it.
function game(canvas, hue) {
  const g = canvas.getContext('2d'), W = canvas.width = 320, H = canvas.height = 240;
  const lg = g.createLinearGradient(0, 0, W, H);
  lg.addColorStop(0, `hsl(${hue} 70% 55%)`); lg.addColorStop(1, `hsl(${hue + 60} 70% 30%)`);
  g.fillStyle = lg; g.fillRect(0, 0, W, H);
  g.fillStyle = 'rgba(255,255,255,.9)'; g.font = 'bold 34px system-ui'; g.textAlign = 'center'; g.fillText('GAME', W / 2, H / 2 + 12);
}

function cell(parent, label, frameId, height, { finish = 'none', colorway = 'default', fill = null } = {}) {
  const f = frameOf(frameId);
  if (!f) return;
  const fw = height * (f.size.w / f.size.h), sw = fw * f.hole.w, sh = height * f.hole.h;
  const c = make('div', 'cell'), box = make('div', 'stagebox'), v = make('div', 'view'), cv = make('canvas', 'game'), img = make('img', 'frame');
  Object.assign(box.style, { width: `${fw}px`, height: `${height}px` });
  const r = frameOuterRect({ x: 0, y: 0, w: sw, h: sh }, f.hole);
  Object.assign(v.style, { left: `${-r.x}px`, top: `${-r.y}px`, width: `${sw}px`, height: `${sh}px` });
  Object.assign(img.style, { left: `${r.x}px`, top: `${r.y}px`, width: `${r.w}px`, height: `${r.h}px` });
  img.src = f.url; img.alt = ''; img.draggable = false;
  game(cv, (label.length * 47) % 360);
  v.append(cv, img); box.append(v); c.append(box, make('span', 'lbl', label)); parent.append(c);
  applyColorway(img, colorway);
  if (fill) applyShellFill(v, f.url, fill);
  if (q.has('ghost')) img.style.opacity = q.get('ghost'); // debug: see the fill behind the frame
  applyFinish(v, f.url, finish);
}

function section(title, build) {
  out.append(make('h2', '', title));
  const row = make('div', 'row');
  out.append(row);
  build(row);
}

const H = +q.get('h') || 400;
const views = {
  finishes: () => section('Finishes · handheld', row => FINISH_IDS.forEach(id => cell(row, id, q.get('frame') || 'handheld', H, { finish: id, colorway: q.get('colorway') || 'default' }))),
  colorways: () => section('Colorways · handheld', row => COLORWAY_IDS.forEach(id => cell(row, id, q.get('frame') || 'handheld', H * 0.7, { colorway: id, finish: q.get('finish') || 'none',
    fill: id === 'clear' ? { type: 'screensaver', id: 'starfield' } : null }))),
  fills: () => section('Shell fills · translucent frames', row => SCREENSAVER_IDS.forEach((id, i) => {
    const fr = q.get('frame') || ['vx-sakura-handheld', 'px-pocket', 'vx-ufo-pet', 'handheld', 'px-pet-egg', 'vx-sakura-handheld'][i];
    cell(row, `${id} · ${fr}`, fr, H * (frameOf(fr)?.size.w > frameOf(fr)?.size.h ? 0.42 : 0.62),
      { fill: { type: 'screensaver', id }, colorway: fr === 'handheld' ? 'clear' : 'default', finish: q.get('finish') || 'gloss' });
  })),
  savers: () => section('Screensavers', row => SCREENSAVER_IDS.forEach(id => {
    const c = make('div', 'cell'), s = make('div', 'saver'), cv = make('canvas');
    if (q.has('sw')) Object.assign(s.style, { width: `${q.get('sw')}px`, height: `${q.get('sh') || 300}px` });
    s.append(cv); c.append(s, make('span', 'lbl', id)); row.append(c);
    createScreensaver(id, cv);
  })),
  combos: () => section('Combos', row => {
    cell(row, 'holo · sakura fill', 'vx-sakura-handheld', H * 0.42, { finish: 'holo', fill: { type: 'screensaver', id: 'sakura-petals' } });
    cell(row, 'glitter · starfield', 'px-pocket', H * 0.8, { finish: 'glitter', fill: { type: 'screensaver', id: 'starfield' } });
    cell(row, 'gloss · gold', 'vx-gallery', H * 0.42, { finish: 'gloss', colorway: 'gold' });
    cell(row, 'pearl · berry', 'vx-neko-tv', H * 0.45, { finish: 'pearl', colorway: 'berry' });
    cell(row, 'holo · midnight', 'px-crt', H * 0.5, { finish: 'holo', colorway: 'midnight' });
  }),
};

(async () => {
  ensureFxStyles();
  await loadCatalog();
  const nav = document.getElementById('nav');
  for (const k of ['all', ...Object.keys(views)]) {
    const a = make('a', k === view ? 'on' : '', k);
    a.href = `?view=${k}`;
    nav.append(a);
  }
  for (const [k, fn] of Object.entries(views)) if (view === 'all' || view === k) fn();
  document.body.dataset.ready = '1';
})();
