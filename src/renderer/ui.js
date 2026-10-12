// Sidebar: sources, screens, aspect/fit, frames, background, displays, scenes, play/fullscreen.
import { FRAMES } from './frames/frames.js';
import { findHole, parseAspect } from './layout.js';

const $ = id => document.getElementById(id);
const ASPECTS = ['source', 'free', '16:9', '4:3', '21:9', '32:9', '1:1', '3:2'];
const h = (tag, props = {}, ...kids) => { const e = Object.assign(document.createElement(tag), props); e.append(...kids); return e; };
const loadImage = url => new Promise((res, rej) => { const i = new Image(); i.onload = () => res(i); i.onerror = rej; i.src = url; });

export function initUI(app) {
  const { ror } = app;
  const on = (id, fn, ev = 'click') => $(id).addEventListener(ev, fn);
  let toastTimer;
  const toast = msg => {
    const t = $('toast');
    t.textContent = msg; t.classList.add('show');
    clearTimeout(toastTimer); toastTimer = setTimeout(() => t.classList.remove('show'), 3500);
  };

  // Sources
  async function refreshSources() {
    const list = await ror.listSources().catch(() => []);
    $('sources').replaceChildren(...list.map(src => h('button', { className: 'tile', title: src.name, onclick: e => app.assignSource(src, e.shiftKey) },
      h('img', src.thumbnail ? { src: src.thumbnail, alt: '' } : { alt: '' }),
      h('span', { textContent: `${src.isSteamGame ? '★ ' : ''}${src.kind === 'screen' ? '🖥 ' : ''}${src.name}` }))));
    if (!list.length) $('sources').replaceChildren(h('p', { className: 'hint', textContent: ror.stub ? 'Desktop capture needs the RateofReality app.' : 'No sources found.' }));
  }
  on('srcRefresh', refreshSources);
  on('srcSteam', async () => {
    const g = await ror.detectSteamGame().catch(() => null);
    if (!g) return toast('No running Steam game found.');
    app.assignSource(g);
    toast(`Showing ${g.name}`);
  });

  // Screens
  on('scrAdd', () => app.addScreen());
  on('scrRemove', () => app.removeScreen());
  on('scrClear', () => app.update(s => Object.assign(s, { sourceId: null, sourceName: '', hwnd: null })));
  function renderScreens() {
    const { screens, selectedId } = app.scene;
    $('screenList').replaceChildren(...[...screens].sort((a, b) => b.z - a.z).map(s => h('li', { className: s.id === selectedId ? 'on' : '', onclick: () => app.select(s.id) },
      h('input', { type: 'checkbox', checked: s.visible !== false, title: 'Visible',
        onclick: e => { e.stopPropagation(); app.update(x => { x.visible = e.target.checked; }, s.id); } }),
      h('span', { textContent: s.sourceName || 'Empty screen' }))));
  }

  // Aspect & fit
  $('aspects').append(...ASPECTS.map(a => {
    const b = h('button', { className: 'chip', textContent: a === 'source' ? 'Source' : a === 'free' ? 'Free' : a, onclick: () => app.setAspect(a) });
    b.dataset.a = a;
    return b;
  }));
  on('aspectApply', () => {
    const v = $('aspectCustom').value.replace(/\s/g, '');
    if (!parseAspect(v)) return toast('Enter an aspect like 5:4 or 1.6');
    app.setAspect(v);
  });
  on('fit', e => app.setFit(e.target.value), 'change');

  // Frames
  const frameBtns = [{ id: null, name: 'None' }, ...FRAMES].map(f => {
    const b = h('button', { className: 'tile', title: f.name, onclick: () => app.setFrame(f.id) },
      f.url ? h('img', { src: f.url, alt: '' }) : h('div', { className: 'none', textContent: '∅' }), h('span', { textContent: f.name }));
    b.dataset.id = f.id ?? '';
    return b;
  });
  $('frames').append(...frameBtns);
  on('frameCustom', async () => {
    const url = await ror.pickFile('frame').catch(() => null);
    if (!url) return;
    let img;
    try { img = await loadImage(url); } catch { return toast('Could not load that image.'); }
    const W = img.naturalWidth || 1000, H = img.naturalHeight || 1000;
    let hole = null;
    try {
      const ctx = h('canvas', { width: W, height: H }).getContext('2d', { willReadFrequently: true });
      ctx.drawImage(img, 0, 0, W, H);
      const d = ctx.getImageData(0, 0, W, H).data, alpha = new Uint8Array(W * H);
      for (let i = 0; i < alpha.length; i++) alpha[i] = d[i * 4 + 3];
      hole = findHole(alpha, W, H);
    } catch { /* unreadable pixels: fall back to manual insets */ }
    hole = hole || await askInsets();
    if (hole) app.setCustomFrame({ url, hole, aspect: (hole.w * W) / (hole.h * H) });
  });
  function askInsets() {
    const dlg = $('insets');
    return new Promise(res => {
      dlg.addEventListener('close', () => {
        if (dlg.returnValue !== 'ok') return res(null);
        const f = n => Math.min(95, Math.max(0, +dlg.querySelector(`[name=${n}]`).value || 0)) / 100;
        const l = f('l'), t = f('t'), r = f('r'), b = f('b');
        res(l + r < 0.95 && t + b < 0.95 ? { x: l, y: t, w: 1 - l - r, h: 1 - t - b } : null);
      }, { once: true });
      dlg.returnValue = '';
      dlg.showModal();
    });
  }

  // Background
  on('bgType', e => app.setBackground({ type: e.target.value }), 'change');
  on('bgColor', e => app.setBackground({ color: e.target.value }), 'input');
  on('bgFit', e => app.setBackground({ fit: e.target.value }), 'change');
  for (const [id, kind, type] of [['bgImage', 'image', 'image'], ['bgVideo', 'video', 'video']]) {
    on(id, async () => { const url = await ror.pickFile(kind).catch(() => null); if (url) app.setBackground({ type, url }); });
  }

  // Displays
  async function refreshDisplays() {
    const ds = await ror.getDisplays().catch(() => []);
    $('displays').replaceChildren(...ds.map(d => h('option', { value: d.id,
      textContent: `${d.label || 'Display'} · ${d.bounds.width}×${d.bounds.height}${d.primary ? ' (primary)' : ''}` })));
  }
  on('dispRefresh', refreshDisplays);
  on('dispMove', async () => {
    const s = app.sel(), id = $('displays').value;
    if (!s?.hwnd) return toast('Select a screen showing a game window.');
    if (!id) return toast('Pick a display first.');
    toast(await ror.moveWindowToDisplay(s.hwnd, id).catch(() => false) ? 'Window moved.' : 'Could not move window.');
  });

  // Scenes
  async function refreshScenes() {
    const names = await ror.listScenes().catch(() => []);
    $('scenes').replaceChildren(...names.map(n => h('option', { value: n, textContent: n })));
  }
  async function saveScene() {
    const name = $('sceneName').value.trim() || $('scenes').value || 'default';
    const ok = await ror.saveScene(name, app.scene).catch(() => false);
    toast(ok ? `Saved “${name}”` : 'Save failed.');
    $('sceneName').value = name;
    await refreshScenes();
    $('scenes').value = name;
  }
  on('sceneSave', saveScene);
  on('sceneLoad', async () => {
    const n = $('scenes').value;
    if (!n) return;
    if (!app.loadScene(await ror.loadScene(n).catch(() => null))) return toast('Could not load scene.');
    $('sceneName').value = n;
    toast(`Loaded “${n}”`);
  });
  on('sceneDelete', async () => {
    const n = $('scenes').value;
    if (n && await ror.deleteScene(n).catch(() => false)) { await refreshScenes(); toast(`Deleted “${n}”`); }
  });

  // Play, fullscreen, panel
  on('play', () => app.togglePlay());
  on('fullscreen', e => app.setFullscreen(e.target.checked), 'change');
  on('hideUi', () => app.toggleUI(true));
  on('showUi', () => app.toggleUI(false));

  function render() {
    const s = app.sel(), bg = app.scene.background;
    renderScreens();
    for (const b of $('aspects').children) b.classList.toggle('on', !!s && b.dataset.a === s.aspect);
    const custom = s && !ASPECTS.includes(s.aspect) ? s.aspect : '';
    if (document.activeElement !== $('aspectCustom')) $('aspectCustom').value = custom;
    $('fit').value = s?.fit || 'contain';
    for (const b of frameBtns) b.classList.toggle('on', !!s && !s.customFrame && (s.frame ?? '') === b.dataset.id);
    $('bgType').value = bg.type;
    $('bgColor').value = /^#[0-9a-f]{6}$/i.test(bg.color) ? bg.color : '#000000';
    $('bgFit').value = bg.fit;
    $('play').textContent = app.playing ? '■ Stop (Ctrl+Alt+P)' : '▶ Play (Ctrl+Alt+P)';
    $('fullscreen').checked = app.fullscreen;
    document.querySelectorAll('[data-needs-sel]').forEach(e => { e.disabled = !s; });
  }

  refreshSources(); refreshDisplays(); refreshScenes();
  return { render, toast, saveScene, refreshSources };
}
