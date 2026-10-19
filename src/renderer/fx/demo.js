// FX demo: every finish / colorway / fill on real frames, built like the stage's screens:
// .screen (hole rect) > .shell-back (fill) + .media (the "game") + .shell-front > img.frame (+ finish).
// Open in Electron, or screenshot with demo-shot.cjs.
import { FRAMES } from '../frames/frames.js';
import { frameOuterRect } from '../layout.js';
import { applyFinish, applyShellFill, applyDepth, setFillClarity, FINISH_IDS, ensureFxStyles } from './finishes.js';
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
    } catch { /* catalogue not importable: built-in frames only */ }
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

function cell(parent, label, frameId, height, { finish = 'none', colorway = 'default', fill = null, depth = q.has('depth'), clarity = 0 } = {}) {
  const f = frameOf(frameId);
  if (!f) return;
  const fw = height * (f.size.w / f.size.h), sw = fw * f.hole.w, sh = height * f.hole.h;
  const c = make('div', 'cell'), box = make('div', 'stagebox'), scr = make('div', 'screen'), media = make('div', 'media');
  const back = make('div', 'shell-back'), front = make('div', 'shell-front'), cv = make('canvas'), img = make('img', 'frame');
  Object.assign(box.style, { width: `${fw}px`, height: `${height}px` });
  const r = frameOuterRect({ x: 0, y: 0, w: sw, h: sh }, f.hole), outer = { left: `${r.x}px`, top: `${r.y}px`, width: `${r.w}px`, height: `${r.h}px` };
  Object.assign(scr.style, { left: `${-r.x}px`, top: `${-r.y}px`, width: `${sw}px`, height: `${sh}px` });
  Object.assign(back.style, outer); Object.assign(front.style, outer);
  Object.assign(img, { src: f.url, alt: '', draggable: false });
  game(cv, (label.length * 47) % 360);
  media.append(cv); front.append(img); scr.append(back, media, front); box.append(scr);
  c.append(box, make('span', 'lbl', label)); parent.append(c);
  applyColorway(img, colorway);
  const grid = f.style === 'pixel' && f.size?.w ? f.size : null;
  if (fill) applyShellFill(back, f.url, fill, { refract: depth, grid });
  if (depth) applyDepth(front, f.url, { glass: !!f.translucent || colorway === 'clear', grid });
  if (q.has('ghost')) img.style.opacity = q.get('ghost'); // debug: see the fill behind the frame
  applyFinish(front, f.url, finish);
  if (fill && clarity) setFillClarity(front, back, f.url, clarity, { grid });
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
  depth: () => {
    const ids = (q.get('frames') || 'crt-tv,handheld,px-crt,vx-neko-tv').split(','), h = H * 0.55;
    const fill = q.has('fillurl') ? { type: 'image', url: q.get('fillurl') } : { type: 'screensaver', id: q.get('saver') || 'aurora' };
    const part = q.get('part') || 'both';
    if (part === 'clarity') return section('Fill clarity · 0% / 50% / 100%', row => ids.forEach(id => {
      for (const c of [0, 0.5, 1]) cell(row, `${id} · ${c * 100}%`, id, h, { colorway: 'clear', fill, depth: true, finish: q.get('finish') || 'gloss', clarity: c });
    }));
    if (part !== 'clear') section('3D depth · flat / with depth', row => ids.forEach(id => {
      cell(row, `${id} · flat`, id, h, { depth: false });
      cell(row, `${id} · depth`, id, h, { depth: true });
    }));
    if (part !== 'solid') section('Clear colorway · the fill held inside', row => ids.forEach(id => {
      cell(row, `${id} · clear, flat`, id, h, { colorway: 'clear', fill, depth: false });
      cell(row, `${id} · clear, depth`, id, h, { colorway: 'clear', fill, depth: true });
    }));
  },
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
