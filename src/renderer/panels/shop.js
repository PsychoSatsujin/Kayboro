// Shop: Frames / Finishes / Colors / Fills as cards with live previews (rarity glow, owned, equipped,
// level, DLC and price states, buy with confirm + coin flight), and Wallpapers: the free active
// wallpaper, saved presets (coins buy more slots) and a gallery of every wallpaper the user has.
import { h, icon, coinIcon, fmt, rarityName, reducedMotion, getShell, call, has, replay, coinFlight } from './kit.js';
import { RARITIES, PRESET_PRICE, itemStatus, coinsShort, filterItems, sortItems, withoutTakedowns, withRewardLevels, buildGallery, filterGallery,
  countBySource, presetsOf, activeRef, refOf, sameRef, resolveRef, fromFile } from './logic.js';
import { play } from './sound.js';
import { frameById } from '../frames/frames.js';

const TABS = [
  { id: 'frames', label: 'Frames', icon: 'tv', noun: ['frame', 'frames'] },
  { id: 'finishes', label: 'Finishes', icon: 'sparkles', noun: ['finish', 'finishes'] },
  { id: 'colorways', label: 'Colors', icon: 'palette', noun: ['colorway', 'colorways'] },
  { id: 'fills', label: 'Fills', icon: 'stars', noun: ['fill', 'fills'] },
  { id: 'wallpapers', label: 'Wallpapers', icon: 'wallpaper' },
];
const KIND_LABEL = { frame: 'Frame', finish: 'Finish', colorway: 'Colorway', fill: 'Shell fill' };
const SOURCES = [['all', 'All'], ['shellcade', 'Shellcade'], ['mod', 'Mods'], ['we', 'Wallpaper Engine'], ['file', 'Files']];
const SOURCE_LABEL = { shellcade: 'Shellcade', mod: 'Mod', we: 'Wallpaper Engine', file: 'File' };
const TYPE_LABEL = { video: 'Video', image: 'Image', gif: 'GIF', screensaver: 'Animated', scene: 'Scene', web: 'Web' };
const PREFS_KEY = 'shellcade.shop', RECENT_KEY = 'shellcade.recentWallpapers';
const load = (k, d) => { try { return { ...d, ...JSON.parse(localStorage.getItem(k)) }; } catch { return d; } };
const save = (k, v) => { try { localStorage.setItem(k, JSON.stringify(v)); } catch {} };

let fxP = null;
const loadFx = app => (fxP ||= (app?.fx?.applyFinish ? Promise.resolve(app.fx)
  : Promise.all([import('../fx/finishes.js'), import('../fx/colorways.js'), import('../fx/screensavers.js')]).then(m => Object.assign({}, ...m)).catch(() => null)));

export function mountShop(el, ctx = {}) {
  const shell = getShell(ctx), app = ctx.app || {};
  const toast = m => (ctx.toast || app.toast?.bind(app) || (() => {}))(m);
  const prefs = load(PREFS_KEY, { tab: 'frames', rarity: 'all', sort: 'featured', hideOwned: false, source: 'all', target: 'stage' });
  let st = app.state || null, cat = app.catalog || {}, ownCat = false, we = [], weLoaded = false, sig = '', disposers = [];
  let order = { key: '', ids: [] }; // card order stays put while only statuses change (coins ticking, a purchase)
  let recent = (() => { try { return JSON.parse(localStorage.getItem(RECENT_KEY)) || []; } catch { return []; } })();
  let active = { stage: null, fill: null };

  const wallet = h('span', { className: 'sc-wallet', title: 'Your coins' }, coinIcon('sc-coin'), h('b'));
  // Sections are a radio group, not nested tabs: the sidebar itself is the tablist.
  const tabBtns = TABS.map(t => h('button', { type: 'button', role: 'radio', id: `sc-shop-${t.id}`, 'aria-controls': 'sc-shop-body', className: 'sc-subtab',
    onclick: () => setTab(t.id) }, icon(t.icon), h('span', { textContent: t.label })));
  const tabList = h('div', { className: 'sc-subtabs', role: 'radiogroup', 'aria-label': 'Shop sections' }, tabBtns);
  tabList.addEventListener('keydown', e => {
    const i = TABS.findIndex(t => t.id === prefs.tab), n = TABS.length;
    const j = { ArrowRight: i + 1, ArrowDown: i + 1, ArrowLeft: i - 1 + n, ArrowUp: i - 1 + n, Home: 0, End: n - 1 }[e.key];
    if (j == null) return;
    e.preventDefault(); e.stopPropagation();
    setTab(TABS[j % n].id);
    tabBtns[j % n].focus();
  });
  const body = h('div', { className: 'sc-shop-body', id: 'sc-shop-body', role: 'region', 'aria-live': 'off' });
  el.replaceChildren(h('div', { className: 'sc-panel sc-shop' },
    h('header', { className: 'sc-ph' },
      h('div', {}, h('h2', { textContent: 'Shop' }), h('p', { textContent: 'You earn 1 coin every minute in Shellcade.' })), wallet),
    tabList, body));

  const items = () => {
    const kind = TABS.find(t => t.id === prefs.tab)?.id;
    return withRewardLevels(withoutTakedowns(cat?.[kind] || [], cat?.takedowns), cat?.levels);
  };

  function setTab(id) {
    prefs.tab = TABS.some(t => t.id === id) ? id : 'frames';
    save(PREFS_KEY, prefs);
    sig = '';
    render();
    body.scrollTop = 0;
    el.scrollTop = 0;
  }

  function dispose() { for (const d of disposers.splice(0)) { try { d(); } catch {} } }

  // ---- Item grid -------------------------------------------------------------------------------
  function renderItems() {
    const tab = TABS.find(t => t.id === prefs.tab), all = items(), key = JSON.stringify([prefs.tab, prefs.rarity, prefs.sort, all.map(i => i.id)]);
    let shown = filterItems(all, prefs, st);
    if (order.key === key) shown.sort((a, b) => rank(a) - rank(b));
    else { shown = sortItems(shown, prefs.sort, st); order = { key, ids: shown.map(i => i.id) }; }
    const ownedN = all.filter(it => ['owned', 'equipped'].includes(itemStatus(it, st))).length;
    const rar = h('div', { className: 'sc-rarity', role: 'radiogroup', 'aria-label': 'Rarity' },
      ['all', ...RARITIES].map(r => h('button', { type: 'button', role: 'radio', className: `sc-rar r-${r}`, 'aria-checked': String(prefs.rarity === r),
        title: r === 'all' ? 'All rarities' : rarityName(r), 'aria-label': r === 'all' ? 'All rarities' : rarityName(r),
        onclick: () => { prefs.rarity = r; save(PREFS_KEY, prefs); sig = ''; render(); } }, r === 'all' ? 'All' : h('i'))));
    const sort = h('select', { className: 'sc-select', 'aria-label': 'Sort', onchange: e => { prefs.sort = e.target.value; save(PREFS_KEY, prefs); sig = ''; render(); } },
      [['featured', 'Featured'], ['rarity', 'Rarity'], ['price', 'Price']].map(([v, t]) => h('option', { value: v, textContent: t, selected: prefs.sort === v })));
    const hide = h('button', { type: 'button', className: 'sc-toggle', 'aria-pressed': String(!!prefs.hideOwned), title: 'Hide items you own', 'aria-label': 'Hide items you own',
      onclick: () => { prefs.hideOwned = !prefs.hideOwned; save(PREFS_KEY, prefs); sig = ''; render(); } }, icon('eyeOff'));
    const grid = h('div', { className: 'sc-grid' }, shown.map(card));
    body.replaceChildren(
      h('div', { className: 'sc-toolbar' }, rar, h('span', { className: 'sc-sp' }), hide, sort),
      shown.length ? grid : h('div', { className: 'sc-empty' }, icon('search'), h('p', { textContent: all.length ? 'Nothing matches these filters.' : `No ${tab.noun[1]} in the catalog yet.` }),
        all.length ? h('button', { type: 'button', className: 'btn sm', textContent: 'Clear filters', onclick: () => { Object.assign(prefs, { rarity: 'all', hideOwned: false }); save(PREFS_KEY, prefs); sig = ''; render(); } }) : null),
      h('p', { className: 'sc-foot-note', textContent: `${all.length} ${tab.noun[all.length === 1 ? 0 : 1]} · ${ownedN} owned` }));
    loadFx(app).then(fx => { if (fx) for (const c of grid.children) c._preview?.(fx); });
  }

  function rank(it) { const i = order.ids.indexOf(it.id); return i < 0 ? 1e9 : i; }

  function card(it) {
    const status = itemStatus(it, st), r = RARITIES.includes(it.rarity) ? it.rarity : 'common';
    const art = h('div', { className: 'sc-card-art' }, preview(it));
    if (it.dlc || it.price?.usd) art.append(h('span', { className: 'sc-tag dlc', title: 'Available on Steam', textContent: 'DLC' }));
    else if (it.mod) art.append(h('span', { className: 'sc-tag mod', title: `Mod by ${it.mod.author || 'unknown'}`, textContent: 'Mod' }));
    if (status === 'equipped') art.append(h('span', { className: 'sc-tag on', title: 'Equipped' }, icon('check'), 'On'));
    const foot = h('div', { className: 'sc-card-foot' });
    const c = h('article', { className: `sc-card r-${r} s-${status}`, 'data-id': it.id, title: it.desc || it.name },
      art, h('div', { className: 'sc-card-body' }, h('b', { className: 'sc-card-name', textContent: it.name }),
        h('span', { className: 'sc-card-sub' }, h('i', { className: 'sc-gem' }), `${rarityName(r)} ${KIND_LABEL[it.kind] || ''}`.trim())), foot);
    c._preview = art.firstChild._preview;
    foot.append(...action(it, status, c));
    return c;
  }

  // Live preview: frame art, a finish or colorway on a small shell, a fill's screensaver.
  function preview(it) {
    const box = h('div', { className: `sc-prev k-${it.kind}` });
    if (it.kind === 'frame') {
      box.classList.toggle('is-pixel', it.style === 'pixel');
      box.append(h('img', { src: it.url || new URL(`../${it.file}`, import.meta.url).href, alt: '', decoding: 'async', draggable: false }));
      return box;
    }
    box.style.setProperty('--sw', swatch(it));
    if (it.kind === 'finish' || it.kind === 'colorway') {
      const f = previewFrame();
      if (!f) return box;
      const img = h('img', { className: 'frame', src: f.url, alt: '', decoding: 'async', draggable: false });
      const shellBox = h('div', { className: `sc-mini${f.style === 'pixel' ? ' is-pixel' : ''}${it.id === 'clear' ? ' is-clear' : ''}` }, img);
      box.append(shellBox);
      box._preview = fx => {
        if (it.kind === 'finish' && fx.applyFinish) disposers.push(fx.applyFinish(shellBox, f.url, it.id, { intensity: 1.1 }));
        if (it.kind === 'colorway' && fx.COLORWAYS?.[it.id]) disposers.push(fx.applyColorway(img, it.id));
        else if (it.kind === 'colorway') Object.assign(img.style, { filter: it.filter && it.filter !== 'none' ? it.filter : '', opacity: it.opacity < 1 ? String(it.opacity) : '' });
      };
    } else if (it.kind === 'fill' && !it.media) { // mod fills reuse a screensaver (base) in their own colors
      const cv = h('canvas', { 'aria-hidden': 'true' });
      box.append(cv);
      box._preview = fx => saverOn(box, cv, it.base || it.id, fx, it.base ? it.colors : undefined);
    }
    return box;
  }

  // A still screensaver frame that runs while hovered.
  function saverOn(box, cv, id, fx, palette) {
    if (!fx?.createScreensaver) return;
    let s = null;
    const start = () => { s?.stop(); s = fx.createScreensaver(id, cv, { palette, fps: 30, pixelRatio: 1 }); };
    const still = () => { start(); requestAnimationFrame(() => { s?.stop(); s = null; }); };
    requestAnimationFrame(still);
    const hostEl = box.closest('.sc-card, .sc-wp, .sc-wp-hero') || box;
    hostEl.addEventListener('pointerenter', () => { if (!reducedMotion()) start(); });
    hostEl.addEventListener('pointerleave', () => { s?.stop(); s = null; });
    disposers.push(() => { s?.stop(); s = null; });
  }

  // The frame finishes and colorways are shown on: the selected screen's, else the handheld starter.
  function previewFrame() {
    const sel = app.sel?.(), f = sel && app.frameOf?.(sel);
    return f?.url ? f : frameById('handheld');
  }

  function action(it, status, c) {
    const btn = (cls, kids, onclick, extra = {}) => h('button', { type: 'button', className: `sc-act ${cls}`, onclick, ...extra }, kids);
    switch (status) {
      case 'equipped': return [btn('is-on', [icon('check'), 'Equipped'], null, { disabled: true })];
      case 'owned':
        if (it.kind === 'frame') return [btn('use', 'Use', () => useFrame(it))];
        return [btn('use', 'Equip', () => equip(it))];
      case 'buy': return [btn('buy', [coinIcon('sc-coin'), fmt.format(it.price.coins)], () => confirmBuy(it, c), { 'aria-label': `Buy ${it.name} for ${fmt.format(it.price.coins)} coins` })];
      case 'short': return [btn('short', [coinIcon('sc-coin'), fmt.format(it.price.coins)], e => {
        replay(e.currentTarget, 'sc-shake'); play('error');
        toast({ title: `${fmt.format(coinsShort(it, st))} more coins for ${it.name}`, body: 'You earn 1 coin every minute in Shellcade.', kind: 'coin' });
      }, { 'aria-label': `${it.name} costs ${fmt.format(it.price.coins)} coins, you need ${fmt.format(coinsShort(it, st))} more` }),
      h('small', { className: 'sc-need', textContent: `Need ${fmt.format(coinsShort(it, st))}` })];
      case 'level': return [btn('lvl', [icon('lock'), `Lv ${it.unlockLevel}`], () => toast({ title: `${it.name} unlocks at level ${it.unlockLevel}`,
        body: `You're level ${st?.level || 1}. Keep playing to level up.`, kind: 'info', action: { label: 'Reward track', onClick: () => app.showTab?.('profile') } }),
      { 'aria-label': `${it.name} unlocks at level ${it.unlockLevel}` })];
      case 'dlc': return [btn('dlc', [icon('steam'), 'Steam DLC'], () => {
        const appid = it.dlc?.appid;
        if (appid && has(shell, 'openLink')) call(shell, 'openLink', `https://store.steampowered.com/app/${appid}/`);
        else toast({ title: `${it.name} is Steam DLC`, body: 'Available on Steam. Coming with the Steam release.', kind: 'info' });
      }, { title: 'Available on Steam' })];
      default: return [btn('lock', [icon('lock'), 'Locked'], null, { disabled: true })];
    }
  }

  function confirmBuy(it, c) {
    const foot = c.querySelector('.sc-card-foot'), prev = [...foot.childNodes];
    const cancel = () => { c.classList.remove('is-confirm'); foot.replaceChildren(...prev); prev[0]?.focus(); };
    const yes = h('button', { type: 'button', className: 'sc-act buy is-confirm', onclick: () => buy(it, c, yes) }, icon('check'), 'Buy');
    const no = h('button', { type: 'button', className: 'sc-act-x', 'aria-label': 'Cancel', title: 'Cancel', onclick: cancel }, icon('x'));
    c.classList.add('is-confirm');
    foot.replaceChildren(yes, no);
    foot.addEventListener('keydown', e => { if (e.key === 'Escape') { e.stopPropagation(); cancel(); } }, { once: true });
    yes.focus();
    play('tap');
  }

  async function buy(it, c, btn) {
    btn.disabled = true;
    btn.classList.add('is-busy');
    const r = await call(shell, 'purchase', it.id);
    if (!r?.ok) {
      btn.disabled = false;
      btn.classList.remove('is-busy');
      play('error');
      const why = { insufficient: 'Not enough coins.', paid: 'This one is Steam DLC.', owned: 'You already own it.',
        locked: it.unlockLevel ? `Unlocks at level ${it.unlockLevel}.` : 'Not for sale.', unknown: 'This item is no longer available.' }[r?.reason];
      if (r?.state) setState(r.state);
      return toast({ title: `Couldn't buy ${it.name}`, body: why || (r ? 'Please try again.' : 'The shop needs the Shellcade desktop app.'), kind: 'error' });
    }
    play('spend');
    const from = document.querySelector('[data-hud-coin]') || wallet;
    coinFlight(from, c.querySelector('.sc-card-art'));
    setState(r.state);
    const fresh = body.querySelector(`.sc-card[data-id="${CSS.escape(it.id)}"]`);
    if (fresh) replay(fresh, 'sc-unlocked');
    toast({ title: `${it.name} unlocked`, body: it.kind === 'frame' ? 'Find it under Stage > Shell.' : 'It is in your collection.', kind: 'ok',
      action: it.kind === 'frame' ? { label: 'Use now', onClick: () => useFrame(it) } : { label: 'Equip', onClick: () => equip(it) } });
  }

  async function equip(it) {
    play('tap');
    if (app.setLook) await app.setLook(it.kind, it.id);
    else { const r = await call(shell, 'equip', it.kind, it.id); if (r?.state) setState(r.state); }
  }

  function useFrame(it) {
    if (!app.sel?.()) return toast({ title: 'Select a screen first', body: 'Click a screen on the stage, then pick the frame.', kind: 'info' });
    app.setFrame?.(it.id);
    play('tap');
    toast({ title: `${it.name} is on your screen`, kind: 'ok' });
  }

  // ---- Wallpapers --------------------------------------------------------------------------------
  const resolveFile = f => new URL(`../${f}`, import.meta.url).href;
  const gallery = () => buildGallery({ catalog: withoutTakedowns(cat?.wallpapers || [], cat?.takedowns), we: withoutTakedowns(we, cat?.takedowns), files: recent, resolve: resolveFile });
  const presetPrice = () => PRESET_PRICE;

  async function loadWallpapers(force = false) {
    if (weLoaded && !force) return;
    weLoaded = true;
    const list = force || !app.wallpapers?.length ? await call(shell, 'listLocalWallpapers') : app.wallpapers;
    we = Array.isArray(list) ? list : [];
    sig = '';
    if (prefs.tab === 'wallpapers') render();
  }

  function currentRef(target) {
    return activeRef(st, target) || active[target] || sceneRef(target);
  }
  // What the stage shows now when the state does not say (an image/video/screensaver background).
  function sceneRef(target) {
    if (target !== 'stage') return null;
    const b = app.scene?.background;
    if (!b) return null;
    if (b.type === 'screensaver' && b.id) return refOf(gallery().find(w => w.fill === b.id) || null);
    if ((b.type === 'image' || b.type === 'video') && b.url) return refOf(gallery().find(w => w.url === b.url) || fromFile(b.url));
    return null;
  }

  function renderWallpapers() {
    const all = gallery(), target = prefs.target === 'fill' ? 'fill' : 'stage';
    const cur = resolveRef(currentRef(target), all);
    const presets = presetsOf(st);

    const hero = h('div', { className: 'sc-wp-hero' }, wpArt(cur, true),
      h('div', { className: 'sc-wp-hero-cap' },
        h('small', { textContent: target === 'stage' ? 'On your stage' : 'In your shell fill' }),
        h('b', { textContent: cur ? cur.name : 'Nothing yet' }),
        h('span', { textContent: cur ? `${SOURCE_LABEL[cur.source]}${cur.credit?.artist && cur.credit.artist !== SOURCE_LABEL[cur.source] ? ` · by ${cur.credit.artist}` : ''}` : 'Pick any wallpaper below. It is free.' })),
      h('span', { className: 'sc-free', textContent: 'Free slot' }));
    hoverPlay(hero);
    const seg = h('div', { className: 'seg sc-target', role: 'radiogroup', 'aria-label': 'Apply wallpapers to' },
      [['stage', 'Stage backdrop', 'photo'], ['fill', 'Shell fill', 'sparkles']].map(([v, t, ic]) => h('label', {},
        h('input', { type: 'radio', name: 'sc-wp-target', value: v, checked: target === v, onchange: () => { prefs.target = v; save(PREFS_KEY, prefs); sig = ''; render(); } }),
        icon(ic), h('span', { textContent: t }))));

    const tiles = presets.map(p => presetTile(p, all, target));
    tiles.push(h('button', { type: 'button', className: 'sc-preset is-buy', onclick: e => buyPreset(e.currentTarget),
      'aria-label': `Buy a preset slot for ${presetPrice()} coins`, disabled: !has(shell, 'buyWallpaperPreset') },
    h('span', { className: 'sc-preset-art' }, icon('plus')), h('span', { className: 'sc-preset-name' }, 'Buy slot'),
    h('span', { className: 'sc-preset-price' }, coinIcon('sc-coin'), fmt.format(presetPrice()))));

    body.replaceChildren(
      h('section', { className: 'sc-wp-now' }, hero, seg),
      h('section', { className: 'sc-wp-sec' },
        h('div', { className: 'sc-sec-head' }, h('h3', {}, icon('bookmark'), 'Presets'),
          h('span', { className: 'meta', textContent: presets.length ? `${presets.filter(p => p.wallpaper).length} of ${presets.length} saved` : 'Quick swaps' })),
        h('div', { className: 'sc-presets', role: 'list' }, tiles),
        h('p', { className: 'hint', textContent: presets.length ? 'Click a preset to swap. Click an empty one to save what is showing now.' : `Save wallpapers for one-click swaps. Each preset slot costs ${presetPrice()} coins.` })),
      h('section', { className: 'sc-wp-sec' },
        h('div', { className: 'sc-sec-head' }, h('h3', {}, icon('photo'), 'Gallery'),
          h('button', { type: 'button', className: 'icon-btn sm', title: 'Rescan Wallpaper Engine', 'aria-label': 'Rescan Wallpaper Engine', onclick: e => { e.currentTarget.classList.add('busy'); loadWallpapers(true); } }, icon('refresh')),
          h('button', { type: 'button', className: 'icon-btn sm', title: 'Open the big gallery', 'aria-label': 'Open the big gallery', onclick: openBig }, icon('maximize'))),
        galleryView(all, target, false),
        h('p', { className: 'hint sc-we-note' }, icon('info'), 'Wallpaper Engine wallpapers come from your own subscriptions and stay on this PC. Video and image ones work here; scene and web ones need Wallpaper Engine.')));
    loadFx(app).then(fx => { if (fx) for (const t of body.querySelectorAll('[data-saver]')) t._preview?.(fx); });
  }

  // Source chips + wallpaper grid. Used in the sidebar and in the big gallery dialog.
  function galleryView(all, target, big) {
    const counts = countBySource(all), shown = SOURCES.filter(([s]) => s !== 'mod' || counts.mod);
    if (!shown.some(([s]) => s === prefs.source)) prefs.source = 'all';
    const list = filterGallery(all, prefs.source);
    const chips = h('div', { className: 'chips sc-src', role: 'radiogroup', 'aria-label': 'Wallpaper source' },
      shown.map(([s, t]) => h('button', { type: 'button', role: 'radio', className: `chip${prefs.source === s ? ' on' : ''}`,
        'aria-checked': String(prefs.source === s), onclick: () => { prefs.source = s; save(PREFS_KEY, prefs); sig = ''; big ? refreshBig() : render(); } },
      t, h('span', { className: 'sc-n', textContent: counts[s] }))));
    const cur = currentRef(target);
    const grid = h('div', { className: `sc-wp-grid${big ? ' big' : ''}` }, list.map(w => wpTile(w, target, sameRef(refOf(w), cur))));
    if (prefs.source === 'all' || prefs.source === 'file') grid.append(h('button', { type: 'button', className: 'sc-wp is-add', onclick: addFile },
      h('span', { className: 'sc-wp-thumb' }, icon('upload')), h('span', { className: 'sc-wp-meta' }, h('b', { textContent: 'Add a file…' }), h('small', { textContent: 'Image, GIF or video' }))));
    if (!list.length && prefs.source === 'we') grid.prepend(h('p', { className: 'sc-empty sm', textContent: weLoaded ? 'No Wallpaper Engine wallpapers found on this PC.' : 'Looking for Wallpaper Engine wallpapers…' }));
    return h('div', { className: 'sc-gallery' }, chips, grid);
  }

  function wpTile(w, target, on) {
    const t = h('button', { type: 'button', className: `sc-wp${on ? ' on' : ''}${w.usable ? '' : ' is-off'}`, 'aria-pressed': String(on), title: tileTitle(w),
      onclick: () => (w.usable ? apply(w, target) : toast({ title: `${w.name} needs Wallpaper Engine`, body: 'Scene and web wallpapers only run inside Wallpaper Engine. Pick a video or image one.', kind: 'info' })) },
    wpArt(w), h('span', { className: 'sc-wp-meta' }, h('b', { textContent: w.name }), h('small', { textContent: `${SOURCE_LABEL[w.source]} · ${TYPE_LABEL[w.type] || w.type}` })));
    if (on) t.append(h('span', { className: 'sc-tag on' }, icon('check'), target === 'stage' ? 'Showing' : 'In fill'));
    if (!w.usable) t.append(h('span', { className: 'sc-tag off', textContent: 'Needs WE' }));
    if (w.source === 'mod') t.append(h('span', { className: 'sc-tag mod', textContent: 'Mod' }));
    hoverPlay(t);
    let hoverT = 0, previewing = false;
    t.addEventListener('pointerenter', () => {
      if (app.previewWallpaper && w.usable) hoverT = setTimeout(() => { previewing = true; app.previewWallpaper(w, target); }, 350);
    });
    t.addEventListener('pointerleave', () => {
      clearTimeout(hoverT);
      if (previewing) { previewing = false; app.previewWallpaper(null, target); }
    });
    return t;
  }
  // Video thumbnails play while hovered and rewind after.
  function hoverPlay(el) {
    el.addEventListener('pointerenter', () => { const v = el.querySelector('video'); if (v && !reducedMotion()) v.play().catch(() => {}); });
    el.addEventListener('pointerleave', () => { const v = el.querySelector('video'); if (v) { v.pause(); try { v.currentTime = 0; } catch {} } });
  }
  const tileTitle = w => [w.name, w.credit?.artist && `by ${w.credit.artist}`, w.mod?.name && `from ${w.mod.name}`].filter(Boolean).join(' · ');

  // Thumbnail: preview image, a paused muted video (plays on hover), or a screensaver still.
  function wpArt(w, hero = false) {
    const box = h('span', { className: `sc-wp-thumb${hero ? ' hero' : ''}` });
    if (!w) { box.append(icon('wallpaper')); return box; }
    if (w.type === 'screensaver' && w.fill) {
      const cv = h('canvas', { 'aria-hidden': 'true' });
      box.append(cv);
      box.dataset.saver = '';
      box._preview = fx => saverOn(box, cv, w.fill, fx, w.palette || undefined);
    } else if (w.preview) {
      box.append(h('img', { src: w.preview, alt: '', decoding: 'async', loading: 'lazy', draggable: false, onerror: e => e.target.replaceWith(icon('photo')) }));
    }
    if (w.type === 'video' && w.url) { // a still (preview or first frame) that plays while hovered
      box.append(h('video', { src: w.url, muted: true, loop: true, playsInline: true, preload: w.preview ? 'none' : 'metadata', className: w.preview ? 'on-hover' : '', 'aria-hidden': 'true' }));
    }
    if (!box.childNodes.length) box.append(icon(w.type === 'video' ? 'movie' : 'photo'));
    return box;
  }

  function presetTile(p, all, target) {
    const w = p.wallpaper && resolveRef(p.wallpaper, all);
    if (!p.wallpaper) {
      return h('button', { type: 'button', role: 'listitem', className: 'sc-preset is-empty', onclick: () => savePreset(p.slot, target), 'aria-label': `Preset ${p.slot + 1} is empty. Save the current wallpaper here.` },
        h('span', { className: 'sc-preset-art' }, icon('plus')), h('span', { className: 'sc-preset-name', textContent: 'Save current' }), h('span', { className: 'sc-preset-price', textContent: `Slot ${p.slot + 1}` }));
    }
    const on = sameRef(p.wallpaper, currentRef(target));
    const tile = h('div', { role: 'listitem', className: `sc-preset is-filled${on ? ' on' : ''}${w ? '' : ' is-missing'}` },
      h('button', { type: 'button', className: 'sc-preset-pick', title: w ? `${w.name}: click to swap` : 'This wallpaper is gone', 'aria-pressed': String(on), disabled: !w?.usable,
        onclick: () => apply(w, target) },
      h('span', { className: 'sc-preset-art' }, wpArt(w)), h('span', { className: 'sc-preset-name', textContent: w ? w.name : 'Missing' }), h('span', { className: 'sc-preset-price', textContent: `Slot ${p.slot + 1}` })),
      h('button', { type: 'button', className: 'sc-preset-x', title: 'Clear this preset', 'aria-label': `Clear preset ${p.slot + 1}`, onclick: () => clearPreset(p.slot) }, icon('x')));
    return tile;
  }

  async function apply(w, target) {
    if (!w?.usable) return;
    const ref = refOf(w);
    active[target] = ref;
    play('tap');
    let r = null;
    if (app.setWallpaper) r = await app.setWallpaper(ref, target, w);
    else {
      if (target === 'stage') {
        if (w.type === 'screensaver') app.setBackground?.({ type: 'screensaver', id: w.fill });
        else app.setBackground?.({ type: w.type === 'video' ? 'video' : 'image', url: w.url });
      } else if (w.type === 'screensaver') await app.setLook?.('fill', w.fill);
      r = await call(shell, 'setActiveWallpaper', ref, target);
    }
    if (r?.state) setState(r.state);
    sig = '';
    render();
    refreshBig();
  }

  async function savePreset(slot, target) {
    const ref = currentRef(target);
    if (!ref) return toast({ title: 'Pick a wallpaper first', body: 'Choose one in the gallery, then save it to this preset.', kind: 'info' });
    const r = await call(shell, 'setWallpaperPreset', slot, ref);
    if (!r?.ok) return toast({ title: 'Could not save the preset', body: 'Please try again.', kind: 'error' });
    play('coin');
    setState(r.state);
  }

  async function clearPreset(slot) {
    const r = await call(shell, 'setWallpaperPreset', slot, null);
    if (r?.state) setState(r.state);
  }

  async function buyPreset(btn) {
    const price = presetPrice();
    if ((st?.coins || 0) < price) {
      replay(btn, 'sc-shake'); play('error');
      return toast({ title: `${fmt.format(price - (st?.coins || 0))} more coins for a preset slot`, body: 'You earn 1 coin every minute in Shellcade.', kind: 'coin' });
    }
    if (!btn.classList.contains('is-confirm')) {
      btn.classList.add('is-confirm');
      btn.querySelector('.sc-preset-name').textContent = 'Confirm?';
      setTimeout(() => { if (btn.isConnected && btn.classList.contains('is-confirm')) { btn.classList.remove('is-confirm'); btn.querySelector('.sc-preset-name').textContent = 'Buy slot'; } }, 4000);
      return play('tap');
    }
    btn.disabled = true;
    const r = await call(shell, 'buyWallpaperPreset');
    if (!r?.ok) { btn.disabled = false; play('error'); return toast({ title: 'Could not buy a preset slot', body: r?.reason === 'insufficient' ? 'Not enough coins.' : 'Please try again.', kind: 'error' }); }
    play('spend');
    coinFlight(document.querySelector('[data-hud-coin]') || wallet, btn);
    setState(r.state);
    toast({ title: 'New preset slot', body: 'Click it to save the wallpaper showing now.', kind: 'ok' });
  }

  async function addFile() {
    const url = await (app.ror?.pickFile || globalThis.window?.ror?.pickFile)?.('media').catch(() => null);
    if (!url) return;
    const f = fromFile(url);
    recent = [url, ...recent.filter(u => u !== url)].slice(0, 12);
    save(RECENT_KEY, recent);
    await apply(f, prefs.target === 'fill' ? 'fill' : 'stage');
  }

  // ---- Big gallery dialog ------------------------------------------------------------------------
  let dlg = null;
  function openBig() {
    dlg?.remove();
    dlg = h('dialog', { className: 'sc-gallery-dlg', 'aria-label': 'Wallpaper gallery' });
    dlg.addEventListener('close', () => { dlg?.remove(); dlg = null; sig = ''; render(); });
    dlg.addEventListener('click', e => { if (e.target === dlg) dlg.close(); });
    document.body.append(dlg);
    refreshBig();
    dlg.showModal();
  }
  function refreshBig() {
    if (!dlg) return;
    const target = prefs.target === 'fill' ? 'fill' : 'stage', y = dlg.scrollTop;
    dlg.replaceChildren(h('header', { className: 'sc-dlg-head' },
      h('div', {}, h('h2', { textContent: 'Wallpaper gallery' }), h('p', { textContent: `Click to put it ${target === 'stage' ? 'on your stage' : 'in your shell fill'}. Every wallpaper is free to use.` })),
      h('button', { type: 'button', className: 'icon-btn', 'aria-label': 'Close', onclick: () => dlg.close() }, icon('x'))),
    galleryView(gallery(), target, true));
    dlg.scrollTop = y;
    loadFx(app).then(fx => { if (fx && dlg) for (const t of dlg.querySelectorAll('[data-saver]')) t._preview?.(fx); });
  }

  // ---- State -------------------------------------------------------------------------------------
  function setState(s) {
    if (!s || typeof s !== 'object') return;
    if (app.setState) app.setState(s); // fans out to every panel's update()
    else update(s);
  }

  function signature() {
    if (prefs.tab === 'wallpapers') {
      return JSON.stringify([prefs, presetsOf(st), activeRef(st, 'stage'), activeRef(st, 'fill'), (st?.coins || 0) >= presetPrice(), we.length, recent.length, (cat?.wallpapers || []).length]);
    }
    return JSON.stringify([prefs, items().map(it => `${it.id}:${itemStatus(it, st)}`)]);
  }

  function render() {
    wallet.lastChild.textContent = fmt.format(Math.max(0, Math.floor(st?.coins || 0)));
    for (const [i, t] of TABS.entries()) { const on = t.id === prefs.tab; tabBtns[i].setAttribute('aria-checked', String(on)); tabBtns[i].tabIndex = on ? 0 : -1; }
    body.setAttribute('aria-labelledby', `sc-shop-${prefs.tab}`);
    const s = signature();
    if (s === sig) return;
    sig = s;
    dispose();
    if (prefs.tab === 'wallpapers') { loadWallpapers(); renderWallpapers(); } else renderItems();
  }

  function update(s) {
    if (s && typeof s === 'object') st = s;
    if (app.catalog?.frames?.length && app.catalog !== cat && !ownCat) cat = app.catalog;
    render();
  }

  // Fresh catalog (mods may have been reloaded since the app booted).
  const refreshCatalog = async () => {
    const c = await call(shell, 'listCatalog');
    if (c && typeof c === 'object') { cat = { ...cat, ...c }; ownCat = true; sig = ''; render(); }
  };
  addEventListener('shellcade:catalog', refreshCatalog);
  const offCatalog = typeof shell?.onCatalog === 'function' ? shell.onCatalog(c => {
    if (c && typeof c === 'object') { cat = { ...cat, ...c }; ownCat = true; sig = ''; render(); }
  }) : null;
  render();
  refreshCatalog();

  return {
    update,
    showTab: setTab,
    destroy() { dispose(); dlg?.remove(); removeEventListener('shellcade:catalog', refreshCatalog); if (typeof offCatalog === 'function') offCatalog(); el.replaceChildren(); },
  };
}

const swatch = it => {
  const c = it.swatch || it.colors;
  return c?.length > 1 ? `linear-gradient(135deg, ${c.join(', ')})` : c?.[0] || 'var(--panel-3)';
};
