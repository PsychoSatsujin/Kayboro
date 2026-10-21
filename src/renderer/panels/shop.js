// Shop: Frames / Finishes / Colors / Fills as cards with live previews (rarity glow, owned, equipped,
// level, DLC and price states, buy with confirm + coin flight), and Wallpapers: the free active
// wallpaper, saved presets (coins buy more slots) and a gallery of every wallpaper the user has.
import { h, icon, coinIcon, fmt, rarityName, reducedMotion, getShell, call, has, replay, coinFlight } from './kit.js';
import { RARITIES, PRESET_PRICE, itemStatus, coinsShort, filterItems, sortItems, withoutTakedowns, withRewardLevels, buildGallery, filterGallery,
  countBySource, presetsOf, activeRef, refOf, sameRef, resolveRef, fromFile } from './logic.js';
import { play } from './sound.js';
import { frameById } from '../frames/frames.js';

const TABS = [
  { id: 'weekly', label: 'Weekly', icon: 'sparkles' },
  { id: 'frames', label: 'Frames', icon: 'tv', noun: ['frame', 'frames'] },
  { id: 'finishes', label: 'Finishes', icon: 'sparkles', noun: ['finish', 'finishes'] },
  { id: 'colorways', label: 'Colors', icon: 'palette', noun: ['colorway', 'colorways'] },
  { id: 'fills', label: 'Fills', icon: 'stars', noun: ['fill', 'fills'] },
  { id: 'wallpapers', label: 'Wallpapers', icon: 'wallpaper' },
];
const KIND_LABEL = { frame: 'Frame', finish: 'Finish', colorway: 'Colorway', fill: 'Shell fill' };
const SOURCES = [['all', 'All'], ['kayboro', 'Kayboro'], ['mod', 'Mods'], ['we', 'Wallpaper Engine'], ['file', 'Files']];
const SOURCE_LABEL = { kayboro: 'Kayboro', mod: 'Mod', we: 'Wallpaper Engine', file: 'File' };
const TYPE_LABEL = { video: 'Video', image: 'Image', gif: 'GIF', screensaver: 'Animated', scene: 'Scene', web: 'Web' };
const PREFS_KEY = 'kayboro.shop', RECENT_KEY = 'kayboro.recentWallpapers';
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
      h('div', {}, h('h2', { textContent: 'Shop' }), h('p', { textContent: 'You earn 1 coin every minute in Kayboro.' })), wallet),
    tabList, body));

  const items = () => {
    const kind = TABS.find(t => t.id === prefs.tab)?.id;
    return withRewardLevels(withoutTakedowns(cat?.[kind] || [], cat?.takedowns), cat?.levels);
  };

  function setTab(id) {
    prefs.tab = TABS.some(t => t.id === id) ? id : 'weekly';
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
        toast({ title: `${fmt.format(coinsShort(it, st))} more coins for ${it.name}`, body: 'You earn 1 coin every minute in Kayboro.', kind: 'coin' });
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
      return toast({ title: `Couldn't buy ${it.name}`, body: why || (r ? 'Please try again.' : 'The shop needs the Kayboro desktop app.'), kind: 'error' });
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
      onclick: () => (w.usable ? apply(on ? null : w, target) : toast({ title: `${w.name} needs Wallpaper Engine`, body: 'Scene and web wallpapers only run inside Wallpaper Engine. Pick a video or image one.', kind: 'info' })) },
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

  // w = null takes the wallpaper off: the stage goes back to its color, the shell fill to none.
  async function apply(w, target) {
    if (w && !w.usable) return;
    const ref = w ? refOf(w) : null;
    active[target] = ref;
    play('tap');
    let r = null;
    if (app.setWallpaper) r = await app.setWallpaper(ref, target, w);
    else {
      if (target === 'stage') {
        if (!w) app.setBackground?.({ type: 'color' });
        else if (w.type === 'screensaver') app.setBackground?.({ type: 'screensaver', id: w.fill });
        else app.setBackground?.({ type: w.type === 'video' ? 'video' : 'image', url: w.url });
      } else if (w?.type === 'screensaver') await app.setLook?.('fill', w.fill);
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
      return toast({ title: `${fmt.format(price - (st?.coins || 0))} more coins for a preset slot`, body: 'You earn 1 coin every minute in Kayboro.', kind: 'coin' });
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
      h('div', {}, h('h2', { textContent: 'Wallpaper gallery' }), h('p', { textContent: `Click to put it ${target === 'stage' ? 'on your stage' : 'in your shell fill'}, and again to take it off. Every wallpaper is free to use.` })),
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
    if (prefs.tab === 'weekly') return JSON.stringify([prefs, st?.coins, (st?.inventory || []).length, weekly?.bundle?.id, studio.items.length]);
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
    if (prefs.tab === 'wallpapers') { loadWallpapers(); renderWallpapers(); } else if (prefs.tab === 'weekly') renderWeekly(); else renderItems();
  }

  // ---- Weekly bundle ---------------------------------------------------------------------------
  // This week's bundle (curated by a developer, or picked automatically) at a discount; buying it
  // unlocks every item in it you don't own yet. Running from source adds the Bundle Studio below it.
  let weekly = null, weeklyAt = 0;
  const studio = { name: '', week: nextWeek(), desc: '', discount: 0.3, items: [], q: '' };
  async function loadWeekly(force = false) {
    if (!force && weekly && Date.now() - weeklyAt < 60000) return;
    weekly = await call(shell, 'getWeeklyBundle').catch(() => null);
    weeklyAt = Date.now();
    sig = '';
    render();
  }
  function renderWeekly() {
    if (!weekly) { loadWeekly(); body.replaceChildren(h('p', { className: 'sc-foot-note', textContent: "Loading this week's bundle…" })); return; }
    const { bundle: b, price } = weekly;
    const all = withRewardLevels(withoutTakedowns(['frames', 'finishes', 'colorways', 'fills'].flatMap(k => cat?.[k] || []), cat?.takedowns), cat?.levels);
    const byId = new Map(all.map(it => [it.id, it]));
    const list = b.items.map(id => byId.get(id)).filter(Boolean);
    const short = Math.max(0, price.coins - (st?.coins || 0)), off = Math.round(b.discount * 100);
    const buyBtn = !price.missing.length ? h('button', { type: 'button', className: 'sc-act is-on', disabled: true }, icon('check'), 'You own all of it')
      : h('button', { type: 'button', className: `sc-act ${short ? 'short' : 'buy'}`, 'aria-label': `Buy ${b.name} for ${fmt.format(price.coins)} coins`,
        onclick: e => {
          if (!short) return buyBundle(b, e.currentTarget);
          replay(e.currentTarget, 'sc-shake'); play('error');
          toast({ title: `${fmt.format(short)} more coins for this bundle`, body: 'You earn 1 coin every minute in Kayboro.', kind: 'coin' });
        } }, coinIcon('sc-coin'), fmt.format(price.coins));
    const grid = h('div', { className: 'sc-grid' }, list.map(card));
    body.replaceChildren(
      h('section', { className: 'sc-bundle' },
        h('div', { className: 'sc-bundle-head' },
          h('div', {}, h('small', { textContent: `${b.week.replace('-W', ' · Week ')} · ${b.curated ? 'Curated' : 'Weekly pick'}` }), h('h3', { textContent: b.name }),
            b.desc ? h('p', { textContent: b.desc }) : null),
          h('div', { className: 'sc-bundle-buy' }, price.missing.length ? h('s', { textContent: fmt.format(price.full) }) : null,
            price.missing.length ? h('b', { textContent: `${off}% off` }) : null, buyBtn)),
        price.missing.length && price.missing.length < list.length ? h('p', { className: 'sc-foot-note', textContent: `You own ${list.length - price.missing.length} of ${list.length}; the price only counts the rest.` }) : null,
        grid),
      shell?.devTools ? renderStudio(all) : null);
    loadFx(app).then(fx => { if (fx) for (const c of grid.children) c._preview?.(fx); });
  }
  async function buyBundle(b, btn) {
    btn.disabled = true;
    const r = await call(shell, 'buyBundle', b.id);
    if (!r?.ok) {
      btn.disabled = false;
      play('error');
      if (r?.state) setState(r.state);
      const why = { insufficient: 'Not enough coins.', owned: 'You already own all of it.', expired: "This week's bundle changed. Have a look at the new one." }[r?.reason];
      return toast({ title: `Couldn't buy ${b.name}`, body: why || 'Please try again.', kind: 'error' });
    }
    play('spend');
    coinFlight(document.querySelector('[data-hud-coin]') || wallet, btn);
    setState(r.state);
    loadWeekly(true);
    toast({ title: `${b.name} unlocked`, body: 'Everything in it is in your collection.', kind: 'ok' });
  }

  // Bundle Studio: compose a bundle for a coming week and save it as a file; a developer then publishes it
  // with tools/bundles/publish.mjs. Weeks nobody curates get an automatic bundle.
  function renderStudio(all) {
    const sellable = all.filter(it => !it.starter && !it.dlc && !it.price?.usd && it.license !== 'fan-art' && it.id !== 'default' && it.id !== 'none');
    const picked = new Set(studio.items);
    const field = (label, input) => h('label', { className: 'sc-studio-field' }, h('span', { textContent: label }), input);
    const text = (key, ph, max) => h('input', { type: 'text', value: studio[key], placeholder: ph, maxLength: max, oninput: e => { studio[key] = e.target.value; } });
    const q = studio.q.trim().toLowerCase();
    const shown = sellable.filter(it => !q || `${it.name} ${it.id} ${it.kind} ${it.collection || ''} ${it.theme || ''}`.toLowerCase().includes(q)).slice(0, 80);
    const toggle = (id, on) => { studio.items = on ? [...studio.items, id] : studio.items.filter(x => x !== id); sig = ''; render(); };
    const row = it => h('label', { className: 'sc-studio-item' },
      h('input', { type: 'checkbox', checked: picked.has(it.id), disabled: !picked.has(it.id) && picked.size >= 8, onchange: e => toggle(it.id, e.target.checked) }),
      h('span', { textContent: it.name }), h('small', { textContent: `${KIND_LABEL[it.kind] || it.kind} · ${rarityName(it.rarity || 'common')}` }));
    const search = h('input', { type: 'text', value: studio.q, placeholder: 'Find items…', 'aria-label': 'Find items',
      onchange: e => { studio.q = e.target.value; sig = ''; render(); } });
    return h('section', { className: 'sc-studio' },
      h('div', { className: 'sc-bundle-head' }, h('div', {}, h('small', { textContent: 'Developers only (running from source)' }), h('h3', { textContent: 'Bundle Studio' }),
        h('p', { textContent: "Pick 2 to 8 items, name the bundle and save it. Publish the file with tools/bundles/publish.mjs and it becomes that week's bundle; any week without one gets an automatic pick." }))),
      h('div', { className: 'sc-studio-form' },
        field('Name', text('name', 'Midnight Masterpieces', 48)), field('Week', text('week', '2026-W44', 8)),
        field('Discount', h('select', { className: 'sc-select', onchange: e => { studio.discount = +e.target.value; } },
          [0.2, 0.3, 0.4, 0.5].map(d => h('option', { value: d, textContent: `${d * 100}% off`, selected: studio.discount === d })))),
        field('Description', text('desc', 'One line for the shop.', 200))),
      h('p', { className: 'sc-foot-note', textContent: `${studio.items.length} of 8 picked: ${studio.items.map(id => sellable.find(it => it.id === id)?.name || id).join(', ') || 'none yet'}` }),
      search, h('div', { className: 'sc-studio-list' }, shown.map(row)),
      h('button', { type: 'button', className: 'btn', onclick: saveStudio }, icon('download'), h('span', { textContent: 'Save Bundle File…' })));
  }
  async function saveStudio() {
    const r = await call(shell, 'exportBundle', { name: studio.name, week: studio.week.trim().toUpperCase(), desc: studio.desc, items: studio.items, discount: studio.discount });
    if (!r) return;
    if (r.error) return toast({ title: 'Bundle not saved', body: r.error, kind: 'error' });
    toast({ title: 'Bundle saved', body: `${r.file}. Publish it with: node tools/bundles/publish.mjs "<that file>"`, kind: 'ok' });
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
  addEventListener('kayboro:catalog', refreshCatalog);
  const offCatalog = typeof shell?.onCatalog === 'function' ? shell.onCatalog(c => {
    if (c && typeof c === 'object') { cat = { ...cat, ...c }; ownCat = true; sig = ''; render(); }
  }) : null;
  render();
  refreshCatalog();

  return {
    update,
    showTab: setTab,
    destroy() { dispose(); dlg?.remove(); removeEventListener('kayboro:catalog', refreshCatalog); if (typeof offCatalog === 'function') offCatalog(); el.replaceChildren(); },
  };
}

// The ISO week after this one, 'YYYY-Www' (the Bundle Studio's default target).
function nextWeek(now = new Date()) {
  const d = new Date(Date.UTC(now.getFullYear(), now.getMonth(), now.getDate() + 7));
  const day = d.getUTCDay() || 7;
  d.setUTCDate(d.getUTCDate() + 4 - day);
  const y = d.getUTCFullYear(), w = Math.ceil(((d - Date.UTC(y, 0, 1)) / 86400000 + 1) / 7);
  return `${y}-W${String(w).padStart(2, '0')}`;
}

const swatch = it => {
  const c = it.swatch || it.colors;
  return c?.length > 1 ? `linear-gradient(135deg, ${c.join(', ')})` : c?.[0] || 'var(--panel-3)';
};
