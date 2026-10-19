// Kaybo: community art from the Kaybo site (main process: src/main/kaybo.js). Browse and search what the
// site approves for all ages, then use a work as a background, a shell fill or a custom shell, or save a
// copy. Kayboro bundles none of this art; the notice up top says so, and where copyright claims go.
import { h, icon, put } from './kit.js';

const PREFS_KEY = 'kayboro.kaybo';
const SORTS = [['popular', 'Popular'], ['newest', 'Newest']];
const load = () => { try { return { q: '', sort: 'popular', ...JSON.parse(localStorage.getItem(PREFS_KEY)) }; } catch { return { q: '', sort: 'popular' }; } };
const save = v => { try { localStorage.setItem(PREFS_KEY, JSON.stringify(v)); } catch {} };

export function mountKaybo(el, ctx = {}) {
  const app = ctx.app || {}, ror = app.ror || window.ror;
  const toast = m => (ctx.toast || app.toast?.bind(app) || (() => {}))(m);
  const prefs = load();
  let works = [], offset = 0, more = false, busy = false, picked = null, seq = 0;

  const search = h('input', { type: 'search', className: 'sc-input', placeholder: 'Search Kaybo…', value: prefs.q, 'aria-label': 'Search Kaybo',
    onkeydown: e => { if (e.key === 'Enter') reload(); } });
  const sortBtns = SORTS.map(([id, label]) => h('button', { type: 'button', className: 'sc-chip', 'data-sort': id, textContent: label,
    onclick: () => { prefs.sort = id; reload(); } }));
  const grid = h('div', { className: 'sc-kaybo-grid', role: 'list', 'aria-label': 'Kaybo works' });
  const status = h('p', { className: 'sc-kaybo-status', role: 'status' });
  const moreBtn = h('button', { type: 'button', className: 'btn ghost wide', textContent: 'Load more', hidden: true, onclick: () => fetchPage() });
  const detail = h('div', { className: 'sc-kaybo-detail', hidden: true });

  el.replaceChildren(h('div', { className: 'sc-panel sc-kaybo' },
    h('header', { className: 'sc-ph' },
      h('div', {}, h('h2', { textContent: 'Kaybo' }), h('p', { textContent: 'Community art from the Kaybo site.' })),
      h('button', { type: 'button', className: 'btn ghost', title: 'Open the Kaybo site in your browser', onclick: () => ror.kayboOpen('/').catch(() => {}) },
        icon('external'), h('span', { textContent: 'Open Kaybo' }))),
    h('div', { className: 'sc-kaybo-notice', role: 'note' },
      icon('info'),
      h('div', {},
        h('b', { textContent: 'Use any image here in Kayboro, or save a copy, at your own discretion.' }),
        h('p', { textContent: 'Make it a background, a shell fill or your own custom shell. Kayboro does not include or own this art: it shows the works the Kaybo site has approved, whatever their tag or category. Copyright and DMCA claims are handled by the Kaybo site.' }))),
    h('div', { className: 'sc-kaybo-bar' }, search, h('div', { className: 'sc-chips', role: 'group', 'aria-label': 'Sort' }, sortBtns)),
    detail, grid, status, moreBtn));

  function reload() {
    prefs.q = search.value.trim();
    save(prefs);
    works = []; offset = 0; more = false;
    grid.replaceChildren();
    fetchPage();
  }

  async function fetchPage() {
    if (busy) return;
    busy = true;
    const mine = ++seq;
    for (const b of sortBtns) b.setAttribute('aria-pressed', String(b.dataset.sort === prefs.sort));
    status.textContent = 'Loading…';
    moreBtn.hidden = true;
    const r = await ror.kayboBrowse({ q: prefs.q, sort: prefs.sort, offset, limit: 30 }).catch(err => ({ error: err.message }));
    busy = false;
    if (mine !== seq) return;
    if (!r || r.error) { status.textContent = r?.error ? `Could not reach Kaybo: ${r.error}` : 'Could not reach Kaybo.'; return; }
    works.push(...r.works);
    offset = r.offset + 30;
    more = r.more;
    grid.append(...r.works.map(tile));
    status.textContent = works.length ? '' : prefs.q ? `Nothing on Kaybo matches "${prefs.q}".` : 'Nothing here yet.';
    moreBtn.hidden = !more;
  }

  function tile(w) {
    const img = h('img', { src: w.thumb, alt: '', loading: 'lazy', decoding: 'async', draggable: false, referrerPolicy: 'no-referrer' });
    return h('button', { type: 'button', className: 'sc-kaybo-tile', role: 'listitem', title: `${w.title}${w.author ? ` by ${w.author}` : ''}`,
      onclick: () => open(w) }, img, h('span', { textContent: w.title }));
  }

  function open(w) {
    picked = w;
    const act = (label, ic, fn, title) => h('button', { type: 'button', className: 'btn', title, onclick: () => run(label, fn) }, icon(ic), h('span', { textContent: label }));
    put(detail,
      h('img', { src: w.medium || w.thumb, alt: w.title, className: 'sc-kaybo-preview', referrerPolicy: 'no-referrer' }),
      h('div', { className: 'sc-kaybo-meta' },
        h('b', { textContent: w.title }),
        h('span', { textContent: [w.author && `by ${w.author}`, w.kind !== 'illustration' && w.kind, w.isAi && 'AI'].filter(Boolean).join(' · ') }),
        h('div', { className: 'sc-kaybo-actions' },
          act('Background', 'wallpaper', useAs('stage'), 'Show it behind your consoles'),
          act('Shell Fill', 'stars', useAs('fill'), 'Show it inside a clear or see-through shell'),
          act('Custom Shell', 'tv', asShell, 'Use it as the selected screen\'s shell (needs a transparent screen opening, or set the edges by hand)'),
          act('Save Copy', 'download', saveCopy, 'Download it to your computer'),
          act('On Kaybo', 'external', () => ror.kayboOpen(w.page), 'Open this work on the Kaybo site')),
        h('button', { type: 'button', className: 'icon-btn sc-kaybo-close', 'aria-label': 'Close', onclick: () => { detail.hidden = true; picked = null; } }, icon('x'))));
    detail.hidden = false;
    detail.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
  }

  async function run(label, fn) {
    const w = picked;
    if (!w) return;
    try { await fn(w); } catch (err) { toast({ title: `${label} failed`, body: String(err?.message || err), kind: 'error' }); }
  }
  async function local(w) {
    const r = await ror.kayboUse(w.id, 0);
    if (!r || r.error) throw new Error(r?.error || 'Could not download it.');
    return r;
  }
  const useAs = target => async w => {
    if (target === 'fill' && !app.sel?.()) throw new Error('Select a screen first.');
    const r = await local(w);
    await app.setWallpaper({ source: 'file', url: r.url }, target);
    toast({ title: target === 'fill' ? 'Shell fill set' : 'Background set', body: target === 'fill' ? 'It shows through clear and see-through shells.' : w.title, kind: 'ok' });
  };
  async function asShell(w) {
    if (!app.sel?.()) throw new Error('Select a screen first.');
    const r = await local(w);
    if (!app.customFrameFrom) throw new Error('Custom shells are not available.');
    await app.customFrameFrom(r.url);
  }
  async function saveCopy(w) {
    const r = await ror.kayboSave(w.id, w.title);
    if (r?.error) throw new Error(r.error);
    if (r?.file) toast({ title: 'Saved', body: r.file, kind: 'ok' });
  }

  fetchPage();
  return { update() {} };
}
