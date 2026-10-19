// Sidebar: tabs (Stage, Shop, Profile, Devs), the Stage controls (sources, screens, aspect & fit, shell,
// background, displays, scenes), the HUD, toasts and the Play footer. Shop/Profile/Devs/HUD/toasts are
// panel modules (app.mods); each gets a small built-in fallback so the app works without them.
import { FRAMES } from './frames/frames.js';
import { findHole, parseAspect } from './layout.js';

const $ = id => document.getElementById(id);
const NS = 'http://www.w3.org/2000/svg';
const ASPECTS = ['source', 'free', '16:9', '4:3', '21:9', '32:9', '1:1', '3:2'];
const TABS = ['stage', 'kaybo', 'shop', 'profile', 'devs'];
const RARITY_ORDER = { common: 0, rare: 1, epic: 2, legendary: 3 };
const fmt = new Intl.NumberFormat();

export function h(tag, props = {}, ...kids) {
  const e = document.createElement(tag);
  for (const [k, v] of Object.entries(props)) {
    if (v == null || v === false) continue;
    if (/^(aria-|data-|role$|for$)/.test(k)) e.setAttribute(k, v === true ? 'true' : v);
    else e[k] = v;
  }
  e.append(...kids.flat().filter(k => k != null && k !== false));
  return e;
}
export function icon(name, cls = 'i') {
  const s = document.createElementNS(NS, 'svg'), u = document.createElementNS(NS, 'use');
  s.setAttribute('class', cls); s.setAttribute('aria-hidden', 'true');
  u.setAttribute('href', `#i-${name}`);
  s.append(u);
  return s;
}
const coin = () => icon('coin-px', 'coin');
const secName = d => d.querySelector('summary').textContent.trim();
const loadImage = url => new Promise((res, rej) => { const i = new Image(); i.onload = () => res(i); i.onerror = rej; i.src = url; });
const swatchBg = (cols = []) => cols.length > 1 ? `linear-gradient(135deg, ${cols.join(', ')})` : cols[0] || 'var(--panel-2)';

export function initUI(app) {
  const { ror, shell } = app;
  const on = (id, fn, ev = 'click') => $(id).addEventListener(ev, fn);
  const ctx = { shell, app, toast: m => app.toast(m) };
  const toaster = makeToaster(app);

  // ---- Tabs ----
  const mounted = {};
  function mountPanel(name) {
    if (name === 'stage' || mounted[name]) return;
    const el = $(`panel-${name}`), fn = app.mods[name];
    try { mounted[name] = fn ? fn(el, ctx) : fallbackPanel(el, name, app); }
    catch (err) { console.warn(`[kayboro] ${name} panel failed:`, err); mounted[name] = fallbackPanel(el, name, app); }
    try { mounted[name]?.update?.(app.state); } catch {}
  }
  function showTab(name, focus = false) {
    if (!TABS.includes(name)) name = 'stage';
    for (const t of TABS) {
      const b = $(`tab-${t}`), on = t === name;
      b.setAttribute('aria-selected', String(on));
      b.tabIndex = on ? 0 : -1;
      $(`panel-${t}`).hidden = !on;
    }
    app.tab = name;
    mountPanel(name);
    if (focus) $(`tab-${name}`).focus();
    if (app.uiHidden) app.toggleUI(false);
    try { localStorage.setItem('kayboro.tab', name); } catch {}
  }
  for (const t of TABS) on(`tab-${t}`, () => showTab(t));
  $('tabs').addEventListener('keydown', e => {
    const i = TABS.indexOf(app.tab), n = TABS.length;
    const j = { ArrowRight: i + 1, ArrowLeft: i - 1 + n, Home: 0, End: n - 1 }[e.key];
    if (j == null) return;
    e.preventDefault();
    showTab(TABS[j % n], true);
  });
  document.addEventListener('click', e => { const g = e.target.closest?.('[data-goto]'); if (g) showTab(g.dataset.goto); });

  // Stage sections remember whether they are open.
  const SEC_KEY = 'kayboro.sections', secs = [...$('panel-stage').querySelectorAll('details')];
  try { const o = JSON.parse(localStorage.getItem(SEC_KEY)) || {}; for (const d of secs) if (typeof o[secName(d)] === 'boolean') d.open = o[secName(d)]; } catch {}
  for (const d of secs) d.addEventListener('toggle', () => {
    try { localStorage.setItem(SEC_KEY, JSON.stringify(Object.fromEntries(secs.map(x => [secName(x), x.open])))); } catch {}
  });

  // ---- HUD ----
  let hud;
  try { hud = app.mods.hud ? app.mods.hud($('hudMount'), ctx) : miniHud($('hudMount')); }
  catch (err) { console.warn('[kayboro] HUD failed:', err); hud = miniHud($('hudMount')); }

  // ---- Sources ----
  async function refreshSources() {
    const btn = $('srcRefresh');
    btn.classList.add('busy'); btn.setAttribute('aria-busy', 'true');
    if (!$('sources').querySelector('.tile')) $('sources').replaceChildren(...[0, 1].map(() => h('span', { className: 'tile skeleton', 'aria-hidden': 'true' }, h('span', { className: 'thumb' }), h('span', { className: 'name' }))));
    const list = await ror.listSources().catch(() => []);
    btn.classList.remove('busy'); btn.removeAttribute('aria-busy');
    $('sources').replaceChildren(...list.map(src => h('button', { type: 'button', className: 'tile src', title: src.name, 'data-kind': src.kind,
      'aria-label': `${src.name} (${src.kind === 'screen' ? 'monitor' : src.isSteamGame ? 'Steam game' : 'window'})`, onclick: e => app.assignSource(src, e.shiftKey) },
      h('span', { className: 'thumb' }, h('img', { src: src.thumbnail || '', alt: '', width: 160, height: 90, decoding: 'async' })),
      h('span', { className: 'name' }, icon(src.kind === 'screen' ? 'monitor' : src.isSteamGame ? 'steam' : 'window'), h('span', { textContent: src.name })))));
    if (!list.length) $('sources').replaceChildren(h('p', { className: 'empty', textContent: ror.stub ? 'Desktop capture needs the Kayboro desktop app.' : 'No windows or monitors found. Open your game, then refresh.' }));
  }
  on('srcRefresh', refreshSources);
  on('srcSteam', async () => {
    const g = await ror.detectSteamGame().catch(() => null);
    if (!g) return app.toast({ title: 'No running Steam game found.', body: 'Start the game first, or pick its window under Sources.' });
    app.assignSource(g);
    app.toast(`Showing ${g.name}`);
  });

  // ---- Panel width: drag the left edge (or arrow keys on it); remembered; double-click resets ----
  const W_KEY = 'kayboro.sidebarW', W_MIN = 300, W_DEF = 348, wMax = () => Math.max(W_MIN, Math.min(640, Math.round(innerWidth * 0.6)));
  const setW = (w, save = true) => {
    const v = Math.round(Math.min(wMax(), Math.max(W_MIN, w)));
    document.documentElement.style.setProperty('--sidebar-w', `${v}px`);
    $('uiResize').setAttribute('aria-valuenow', String(v));
    if (save) { try { localStorage.setItem(W_KEY, String(v)); } catch {} }
    return v;
  };
  try { const w = Number(localStorage.getItem(W_KEY)); if (w) setW(w, false); } catch {}
  $('uiResize').addEventListener('pointerdown', e => {
    if (e.button !== 0) return;
    e.preventDefault();
    const grip = e.currentTarget, x0 = e.clientX, w0 = $('ui').offsetWidth;
    grip.setPointerCapture(e.pointerId);
    document.body.classList.add('resizing-ui');
    const move = ev => setW(w0 + (x0 - ev.clientX), false);
    const up = ev => {
      grip.removeEventListener('pointermove', move); grip.removeEventListener('pointerup', up); grip.removeEventListener('pointercancel', up);
      document.body.classList.remove('resizing-ui');
      setW(w0 + (x0 - ev.clientX));
      app.keepOnStage();
    };
    grip.addEventListener('pointermove', move); grip.addEventListener('pointerup', up); grip.addEventListener('pointercancel', up);
  });
  $('uiResize').addEventListener('dblclick', () => { setW(W_DEF); app.keepOnStage(); });
  $('uiResize').addEventListener('keydown', e => {
    const d = { ArrowLeft: 16, ArrowRight: -16 }[e.key];
    if (!d) return;
    e.preventDefault();
    setW($('ui').offsetWidth + (e.shiftKey ? d * 4 : d));
    app.keepOnStage();
  });
  addEventListener('resize', () => { const w = $('ui').offsetWidth; if (w > wMax()) setW(w, false); });

  // ---- Screens ----
  on('scrAdd', () => app.addScreen());
  on('stageAdd', () => app.addScreen());
  on('scrRemove', () => app.removeScreen());
  on('scrClear', () => app.clearSource());
  on('scrPop', () => (app.sel()?.popout ? app.dock() : app.popOut()));
  on('scrHide', () => app.toggleHidden());
  function renderScreens() {
    const { screens, selectedId } = app.scene;
    const hid = app.isHidden(app.sel()), hideBtn = $('scrHide');
    hideBtn.querySelector('span').textContent = hid ? 'Show Game Window' : 'Hide Game Window';
    hideBtn.querySelector('use').setAttribute('href', hid ? '#i-eye' : '#i-eye-off');
    hideBtn.disabled = !app.sel() || app.vs.busy;
    $('scrHideHint').textContent = !app.vs.available && app.vs.checked
      ? 'Hiding the game needs the Kayboro Virtual Screen driver. See Displays.'
      : hid ? 'The game runs on an invisible screen. Show it to put it back where it was.'
      : 'Moves the game to an invisible screen. It keeps running at full speed, and Kayboro is the only place it shows.';
    const pop = $('scrPop'), out = !!app.sel()?.popout;
    pop.querySelector('span').textContent = out ? 'Dock Back' : 'Pop Out';
    pop.title = out ? 'Bring this console back into the Kayboro window' : 'Put this console in its own window you can place anywhere';
    $('screenList').replaceChildren(...[...screens].sort((a, b) => b.z - a.z).map(s => {
      const vis = s.visible !== false;
      return h('li', { className: s.id === selectedId ? 'on' : '' },
        h('button', { type: 'button', className: 'icon-btn sm', 'aria-pressed': String(vis), 'aria-label': vis ? 'Hide screen' : 'Show screen', title: vis ? 'Hide' : 'Show',
          onclick: () => app.update(x => { x.visible = !vis; }, s.id) }, icon(vis ? 'eye' : 'eye-off')),
        h('button', { type: 'button', className: 'pick', 'aria-current': s.id === selectedId ? 'true' : null, onclick: () => app.select(s.id) },
          h('span', { textContent: s.sourceName || 'Empty screen' }),
          s.hwnd && app.hosted?.id === s.id ? h('em', { className: 'tag', textContent: 'Hosting' }) : null,
          s.popout ? h('em', { className: 'tag', textContent: 'Popped Out' }) : null));
    }));
    if (!screens.length) $('screenList').replaceChildren(h('li', { className: 'empty-row', textContent: 'No screens. Add one to start.' }));
  }

  // ---- Aspect & fit ----
  $('aspects').append(...ASPECTS.map(a => h('button', { type: 'button', className: 'chip', 'data-a': a, textContent: a === 'source' ? 'Source' : a === 'free' ? 'Free' : a,
    onclick: () => app.setAspect(a) })));
  on('aspectApply', () => {
    const v = $('aspectCustom').value.replace(/\s/g, '');
    if (!parseAspect(v)) return app.toast({ title: 'Enter an aspect like 5:4 or 1.6', body: 'Width and height separated by a colon, or a single ratio.' });
    app.setAspect(v);
  });
  $('aspectCustom').addEventListener('keydown', e => { if (e.key === 'Enter') $('aspectApply').click(); });
  on('fit', e => { if (e.target.name === 'fit') app.setFit(e.target.value); }, 'change');
  on('gameReset', () => app.resetGameSize());
  on('fillClarity', e => app.setFillClarity(e.target.value / 100), 'input');

  // ---- Shell: frame picker + finish / colorway / fill ----
  const ownsFrame = f => f.starter || app.owns(f.id);
  function lockedInfo(f) {
    const st = app.state || {};
    if (f.price?.usd) return app.toast({ title: `${f.name} is a paid shell`, body: 'Coming with the Steam release.' });
    if (f.price?.coins) return app.toast({ title: `${f.name} costs ${fmt.format(f.price.coins)} coins`, body: `You have ${fmt.format(st.coins || 0)}.`,
      action: { label: 'Open Shop', onClick: () => showTab('shop') } });
    if (f.unlockLevel) return app.toast({ title: `${f.name} unlocks at level ${f.unlockLevel}`, body: `You are level ${st.level || 1}. Host games and play to earn XP.`,
      action: { label: 'See Rewards', onClick: () => showTab('profile') } });
    app.toast(`${f.name} is locked.`);
  }
  function badge(f, owned) {
    if (owned) return null;
    if (f.price?.usd) return h('span', { className: 'badge paid', textContent: 'Soon' });
    if (f.price?.coins) return h('span', { className: 'badge price' }, coin(), fmt.format(f.price.coins));
    return h('span', { className: 'badge lvl' }, icon('lock'), `Lv ${f.unlockLevel ?? '?'}`);
  }
  let frameBtns = [];
  function buildFrames() {
    const list = FRAMES.map(f => ({ f, owned: ownsFrame(f) }))
      .sort((a, b) => (b.owned - a.owned) || (a.owned ? 0 : (a.f.unlockLevel ?? 999) - (b.f.unlockLevel ?? 999)) ||
        RARITY_ORDER[a.f.rarity] - RARITY_ORDER[b.f.rarity]);
    frameBtns = [{ f: { id: null, name: 'None' }, owned: true }, ...list].map(({ f, owned }) => {
      const label = owned ? f.name : `${f.name}, locked${f.unlockLevel ? `, level ${f.unlockLevel}` : ''}`;
      return h('button', { type: 'button', className: `tile ftile r-${f.rarity || 'common'}${owned ? '' : ' locked'}`, 'data-id': f.id ?? '', title: f.name,
        'aria-label': label, 'aria-pressed': 'false', onclick: () => owned ? app.setFrame(f.id) : lockedInfo(f) },
        h('span', { className: 'thumb' }, f.url ? h('img', { src: f.url, alt: '', width: 80, height: 80, decoding: 'async', draggable: false }) : icon('x', 'none')),
        h('span', { className: 'name', textContent: f.name }), badge(f, owned));
    });
    $('frames').replaceChildren(...frameBtns);
    const n = FRAMES.filter(f => !ownsFrame(f)).length;
    $('framesMeta').textContent = n ? `${FRAMES.length - n} of ${FRAMES.length} unlocked` : `All ${FRAMES.length} unlocked`;
  }
  on('frameCustom', async () => {
    const url = await ror.pickFile('frame').catch(() => null);
    if (url) await customFrameFrom(url);
  });
  // Any image as the selected screen's shell: its transparent screen opening is found automatically,
  // otherwise the user sets the edges by hand. Also used by the Kaybo panel.
  async function customFrameFrom(url) {
    let img;
    try { img = await loadImage(url); } catch { return app.toast({ title: 'Could not load that image.', body: 'Use a PNG, WebP or SVG with a transparent screen opening.' }); }
    const W = img.naturalWidth || 1000, H = img.naturalHeight || 1000;
    let hole = null;
    try {
      const c = h('canvas', { width: W, height: H }).getContext('2d', { willReadFrequently: true });
      c.drawImage(img, 0, 0, W, H);
      const d = c.getImageData(0, 0, W, H).data, alpha = new Uint8Array(W * H);
      for (let i = 0; i < alpha.length; i++) alpha[i] = d[i * 4 + 3];
      hole = findHole(alpha, W, H);
    } catch { /* unreadable pixels: fall back to manual insets */ }
    hole = hole || await askInsets();
    if (hole) app.setCustomFrame({ url, hole, aspect: (hole.w * W) / (hole.h * H) });
  }
  app.customFrameFrom = customFrameFrom;
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
  // Owned finishes / colorways / fills as swatch chips. data-v '' = none (fills only).
  const LOOKS = { finish: ['finishes', 'finishes'], colorway: ['colorways', 'colorways'], fill: ['fills', 'fills'] };
  function buildLooks() {
    for (const [slot, [kind, el]] of Object.entries(LOOKS)) {
      const items = app.catalog[kind].filter(it => app.owns(it.id));
      const chips = (slot === 'fill' ? [{ id: null, name: 'None', swatch: [] }, ...items] : items).map(it => h('button', {
        type: 'button', className: `swatch r-${it.rarity || 'common'}`, 'data-v': it.id ?? '', 'aria-pressed': 'false', title: it.desc || it.name,
        onclick: () => app.setLook(slot, it.id) },
      h('span', { className: 'dot', style: `background: ${swatchBg(it.swatch || it.colors)}` }), h('span', { textContent: it.name })));
      const more = app.catalog[kind].length - items.length;
      if (more > 0) chips.push(h('button', { type: 'button', className: 'swatch more', 'data-goto': 'shop', title: 'See them in the Shop' }, icon('lock'), `${more} more`));
      $(el).replaceChildren(...chips);
    }
  }
  // The same chip markup also lists owned animated fills as stage screensavers.
  function buildSavers() {
    const items = app.catalog.fills.filter(it => app.owns(it.id) && !it.media);
    $('bgSavers').replaceChildren(...items.map(it => h('button', { type: 'button', className: 'swatch', 'data-v': it.id, 'aria-pressed': 'false', title: it.desc || it.name,
      onclick: () => app.setBackground({ type: 'screensaver', id: it.id }) },
    h('span', { className: 'dot', style: `background: ${swatchBg(it.colors)}` }), h('span', { textContent: it.name }))));
    if (!items.length) $('bgSavers').replaceChildren(h('p', { className: 'empty', textContent: 'No screensavers yet. Unlock fills in the Shop.' }));
  }

  // ---- Background ----
  on('bgType', e => {
    if (e.target.name !== 'bgType') return;
    const type = e.target.value, b = app.scene.background;
    if (type === 'screensaver' && !b.id) b.id = app.catalog.fills.find(it => app.owns(it.id) && !it.media)?.id || null;
    if (type === 'wallpaper') {
      const st = app.state || {}, first = app.wallpaperGallery().find(w => w.usable);
      const ref = b.ref || st.activeWallpaper?.stage || st.wallpaperPresets?.find(p => p.wallpaper)?.wallpaper || (first && { source: first.source, id: first.id });
      return app.setWallpaper(ref || null, 'stage');
    }
    app.setBackground({ type });
  }, 'change');
  on('bgColor', e => app.setBackground({ color: e.target.value }), 'input');
  for (const b of $('bgPresets').children) b.style.background = b.dataset.c;
  $('bgPresets').addEventListener('click', e => { const c = e.target.closest('[data-c]')?.dataset.c; if (c) app.setBackground({ type: 'color', color: c }); });
  on('bgFit', e => { if (e.target.name === 'bgFit') app.setBackground({ fit: e.target.value }); }, 'change');
  for (const [id, kind, type] of [['bgImage', 'image', 'image'], ['bgVideo', 'video', 'video']]) {
    on(id, async () => { const url = await ror.pickFile(kind).catch(() => null); if (url) app.setBackground({ type, url }); });
  }
  on('wpRefresh', () => app.refreshWallpapers());
  on('wpGallery', () => { showTab('shop'); mounted.shop?.showTab?.('wallpapers'); });
  // The wallpaper on the stage, then the saved presets (one click swaps). Every wallpaper is free.
  function renderWallPane() {
    const b = app.scene.background, cur = b.type === 'wallpaper' ? app.wallpaperEntry(b.ref) : null;
    const presets = (app.state?.wallpaperPresets || []).filter(p => p.wallpaper);
    const tile = (w, ref, label, on) => h('button', { type: 'button', className: `slot${on ? ' on' : ''}`, 'aria-pressed': String(on), disabled: !w?.usable,
      title: w ? w.name : 'This wallpaper is gone', onclick: () => app.setWallpaper(ref, 'stage') },
    h('span', { className: 'thumb' }, w?.preview ? h('img', { src: w.preview, alt: '', width: 64, height: 36 }) : icon('wallpaper')),
    h('span', { className: 'name', textContent: label }));
    const same = (a, x) => !!a && !!x && a.source === x.source && (a.id ?? a.url) === (x.id ?? x.url);
    const rows = [];
    if (cur && !presets.some(p => same(p.wallpaper, b.ref))) rows.push(tile(cur, b.ref, cur.name, true));
    for (const p of presets) { const w = app.wallpaperEntry(p.wallpaper); rows.push(tile(w, p.wallpaper, `${p.slot + 1}. ${w ? w.name : 'Missing wallpaper'}`, b.type === 'wallpaper' && same(p.wallpaper, b.ref))); }
    if (!rows.length) rows.push(h('p', { className: 'empty', textContent: 'Pick any wallpaper in the gallery. They are all free. Coins buy preset slots for quick swaps.' }));
    $('bgSlots').replaceChildren(...rows);
  }

  // ---- Displays ----
  async function refreshVirtualScreen() {
    await app.refreshVirtualScreens();
    const v = app.vs, btn = $('vsInstall');
    btn.hidden = !v.canInstall || v.backend === 'kayboro';
    btn.disabled = v.busy;
    btn.querySelector('span').textContent = v.backend === 'parsec' ? 'Install Kayboro Driver' : 'Install Virtual Screen Driver';
    btn.title = 'Windows asks for administrator approval. EULA.txt explains what the driver does.';
    if (v.backend === 'kayboro') app.driverNotice();
    $('vsStatus').textContent = v.backend === 'kayboro' ? 'Kayboro Virtual Screen driver ready: Hide Game Window makes an invisible screen sized for your shell.'
      : v.backend === 'parsec' ? 'Using the Parsec virtual display driver for invisible screens until the Kayboro driver is installed.'
      : 'No virtual screen driver found. Install the Kayboro Virtual Screen driver (it comes with the Steam version) to hide game windows.';
    renderScreens();
  }
  refreshVirtualScreen();
  on('vsInstall', async () => { await app.installScreenDriver(); refreshVirtualScreen(); });

  async function refreshDisplays() {
    const ds = await ror.getDisplays().catch(() => []);
    $('displays').replaceChildren(...ds.map(d => h('option', { value: d.id,
      textContent: `${d.label || 'Display'} · ${d.bounds.width}×${d.bounds.height}${d.primary ? ' (primary)' : ''}` })));
  }
  on('dispRefresh', () => { refreshDisplays(); refreshVirtualScreen(); });
  on('dispMove', async () => {
    const s = app.sel(), id = $('displays').value;
    if (!s?.hwnd) return app.toast({ title: 'Select a screen showing a game window.', body: 'Monitor sources cannot be moved.' });
    if (!id) return app.toast('Pick a display first.');
    app.toast(await ror.moveWindowToDisplay(s.hwnd, id).catch(() => false) ? 'Window moved.' : 'Could not move window.');
  });

  // ---- Scenes ----
  async function refreshScenes() {
    const names = await ror.listScenes().catch(() => []);
    $('scenes').replaceChildren(...names.map(n => h('option', { value: n, textContent: n })));
    $('scenes').disabled = $('sceneLoad').disabled = $('sceneDelete').disabled = !names.length;
  }
  async function saveScene() {
    const name = $('sceneName').value.trim() || $('scenes').value || 'default';
    const ok = await ror.saveScene(name, app.scene).catch(() => false);
    app.toast(ok ? `Saved “${name}”` : 'Save failed.');
    $('sceneName').value = name;
    await refreshScenes();
    $('scenes').value = name;
  }
  on('sceneSave', saveScene);
  on('sceneLoad', async () => {
    const n = $('scenes').value;
    if (!n) return;
    if (!app.loadScene(await ror.loadScene(n).catch(() => null))) return app.toast('Could not load scene.');
    $('sceneName').value = n;
    app.toast(`Loaded “${n}”`);
  });
  on('sceneDelete', async () => {
    const n = $('scenes').value;
    if (n && await ror.deleteScene(n).catch(() => false)) { await refreshScenes(); app.toast(`Deleted “${n}”`); }
  });

  // ---- Play, fullscreen, panel ----
  on('play', () => app.togglePlay());
  on('fullscreen', e => app.setFullscreen(e.target.checked), 'change');
  on('fxParticles', e => app.setFxPref('particles', e.target.checked), 'change');
  on('fxGlass', e => app.setFxPref('glass', e.target.checked), 'change');
  on('fxDepth', e => app.setFxPref('depth', e.target.checked), 'change');
  on('hideUi', () => app.toggleUI(true));
  on('showUi', () => app.toggleUI(false));

  const setRadio = (name, v) => { for (const r of document.querySelectorAll(`input[name="${name}"]`)) r.checked = r.value === v; };
  const press = (el, on) => { el.classList.toggle('on', on); el.setAttribute('aria-pressed', String(on)); };

  function render() {
    const s = app.sel(), bg = app.scene.background, eq = app.equipped();
    renderScreens();
    for (const b of $('aspects').children) b.classList.toggle('on', !!s && b.dataset.a === s.aspect);
    const custom = s && !ASPECTS.includes(s.aspect) ? s.aspect : '';
    if (document.activeElement !== $('aspectCustom')) $('aspectCustom').value = custom;
    setRadio('fit', s?.fit || 'contain');
    $('gameReset').hidden = !app.gameZoomed(s);
    const fc = Math.round((s?.fillClarity || 0) * 100);
    $('fillClarityRow').hidden = !app.fillShown(s);
    if (document.activeElement !== $('fillClarity')) $('fillClarity').value = fc;
    $('fillClarityVal').textContent = `${fc}%`;
    for (const b of frameBtns) press(b, !!s && !s.customFrame && (s.frame ?? '') === b.dataset.id);
    for (const slot of Object.keys(LOOKS)) {
      const cur = s ? s[slot] : eq[slot];
      for (const b of $(LOOKS[slot][1]).children) if ('v' in b.dataset) press(b, b.dataset.v === (cur ?? ''));
    }
    setRadio('bgType', bg.type);
    setRadio('bgFit', bg.fit);
    $('bgPanel').dataset.type = bg.type;
    $('bgColor').value = /^#[0-9a-f]{6}$/i.test(bg.color) ? bg.color : '#000000';
    for (const b of $('bgSavers').children) if ('v' in b.dataset) press(b, bg.type === 'screensaver' && b.dataset.v === bg.id);
    renderWallPane();
    $('bgFile').textContent = bg.url && /^(image|video)$/.test(bg.type) ? decodeURIComponent(bg.url.split(/[\\/]/).pop()).slice(0, 60) : '';
    $('play').querySelector('span').textContent = app.playing ? 'Stop' : 'Play';
    $('play').querySelector('use').setAttribute('href', app.playing ? '#i-stop' : '#i-play');
    $('play').classList.toggle('stop', app.playing);
    $('fullscreen').checked = app.fullscreen;
    $('fxParticles').checked = app.fxPrefs.particles !== false;
    $('fxGlass').checked = app.fxPrefs.glass !== false;
    $('fxDepth').checked = app.fxPrefs.depth !== false;
    document.querySelectorAll('[data-needs-sel]').forEach(e => { e.disabled = !s; });
    $('selName').textContent = s ? s.sourceName || 'Empty screen' : 'Nothing. Click a screen on the stage.';
    $('selName').classList.toggle('none', !s);
  }

  // Economy state changed (coins, level, inventory, presets): rebuild what depends on ownership.
  let owned = null;
  function stateChanged() {
    const inv = [...(app.state?.inventory || [])].sort().join();
    if (inv !== owned) { owned = inv; buildFrames(); buildLooks(); buildSavers(); }
    try { hud?.update?.(app.state); } catch {}
    for (const m of Object.values(mounted)) { try { m?.update?.(app.state); } catch {} }
    render();
  }
  // New catalog (mods reloaded, takedowns): rebuild every list even if the inventory is the same.
  function catalogChanged() { owned = null; stateChanged(); }

  stateChanged();
  let tab = 'stage';
  try { tab = localStorage.getItem('kayboro.tab') || 'stage'; } catch {}
  showTab(tab);
  refreshSources(); refreshDisplays(); refreshScenes();
  return { render, stateChanged, catalogChanged, saveScene, refreshSources, showTab, toaster };
}

// ---- Fallbacks (used only when a panel module is missing) ----

function miniHud(el) {
  const coins = h('b', { className: 'num' }), lvl = h('b', { className: 'num' }), fill = h('span', { className: 'fill' });
  el.replaceChildren(h('div', { className: 'mini-hud' },
    h('span', { className: 'hud-coins', title: 'Coins' }, icon('coin-px', 'coin'), coins),
    h('span', { className: 'hud-level', title: 'Level' }, h('span', { textContent: 'Lv' }), lvl),
    h('span', { className: 'hud-xp', role: 'progressbar', 'aria-label': 'XP to next level', 'aria-valuemin': 0, 'aria-valuemax': 100 }, fill)));
  return {
    update(st) {
      if (!st) return;
      coins.textContent = new Intl.NumberFormat().format(st.coins || 0);
      lvl.textContent = st.level || 1;
      const p = st.xpForNext ? Math.min(1, (st.xpIntoLevel || 0) / st.xpForNext) : 1;
      fill.style.transform = `scaleX(${p})`;
      fill.parentElement.setAttribute('aria-valuenow', Math.round(p * 100));
    },
    destroy() { el.replaceChildren(); },
  };
}

function fallbackPanel(el, name, app) {
  const title = { shop: 'Shop', profile: 'Profile', devs: 'Developers' }[name];
  el.replaceChildren(h('div', { className: 'panel-empty' }, h('h2', { textContent: title }),
    h('p', { textContent: `The ${title} panel could not be loaded. The stage still works.` }),
    h('button', { type: 'button', className: 'btn sm', 'data-goto': 'stage' }, 'Back to Stage')));
  return { update() {}, destroy() { el.replaceChildren(); } };
}

function makeToaster(app) {
  const root = document.getElementById('toasts');
  if (app.mods.toaster) {
    try {
      const t = app.mods.toaster(root);
      if (t && typeof t.show === 'function') {
        return {
          show: o => t.show(o),
          achievement: e => (t.achievement ? t.achievement(e) : t.show({ title: e.name, body: `+${e.coins} coins, +${e.xp} XP`, kind: 'achievement' })),
          levelUp: e => (t.levelUp ? t.levelUp(e) : t.show({ title: `Level ${e.level}!`, kind: 'level' })),
        };
      }
    } catch (err) { console.warn('[kayboro] toaster failed:', err); }
  }
  const show = ({ title = '', body = '', action = null, kind = 'info' } = {}) => {
    const el = h('div', { className: `toast ${kind}`, role: 'status' },
      h('div', { className: 'toast-text' }, h('b', { textContent: title }), body ? h('span', { textContent: body }) : null),
      action ? h('button', { type: 'button', className: 'btn sm', textContent: action.label, onclick: () => { el.remove(); action.onClick?.(); } }) : null,
      h('button', { type: 'button', className: 'icon-btn sm', 'aria-label': 'Dismiss', onclick: () => el.remove() }, icon('x')));
    root.append(el);
    while (root.children.length > 4) root.firstElementChild.remove();
    setTimeout(() => el.remove(), action ? 9000 : 4000);
  };
  return {
    show,
    achievement: e => show({ title: e.name || 'Achievement unlocked', body: `${e.game ? e.game + ': ' : ''}+${e.coins} coins, +${e.xp} XP`, kind: 'achievement' }),
    levelUp: e => show({ title: `Level ${e.level}!`, body: e.rewards?.coins ? `+${e.rewards.coins} coins` : '', kind: 'level' }),
  };
}
