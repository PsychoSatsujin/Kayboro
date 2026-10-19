// Profile: level ring and XP, stats, the 100-level reward track, games played inside Kayboro, and
// Settings (achievement rewards, sounds, app file check, mods).
import { h, put, icon, coinIcon, fmt, getShell, call, has, itemThumb, hueOf, reducedMotion, durNodes } from './kit.js';
import { levelProgress, rewardTrack, indexCatalog, fmtDuration, gameStats, rankTitle, initials, MAX_LEVEL } from './logic.js';
import { isMuted, setMuted, onMuteChange, play } from './sound.js';

const R = 40, CIRC = 2 * Math.PI * R;
const NODE_W = 76; // node width + gap, for paging the track

export function mountProfile(el, ctx = {}) {
  const shell = getShell(ctx), app = ctx.app || {};
  const toast = m => (ctx.toast || app.toast?.bind(app) || (() => {}))(m);
  let st = app.state || null, cat = app.catalog || {}, idx = indexCatalog(cat), trackSig = '', gamesSig = '', allGames = false, centred = false;

  // ---- Hero ----
  const arc = svg('circle', { cx: 48, cy: 48, r: R, class: 'sc-ring-fill', 'stroke-dasharray': CIRC.toFixed(2), 'stroke-dashoffset': CIRC.toFixed(2) });
  const ring = svg('svg', { viewBox: '0 0 96 96', class: 'sc-ring-svg', 'aria-hidden': 'true' }, svg('circle', { cx: 48, cy: 48, r: R, class: 'sc-ring-bg' }), arc);
  const lvNum = h('b');
  const rank = h('small', { className: 'sc-eyebrow' }), title = h('h2'), xpFill = h('i'), xpText = h('span', { className: 'meta' });
  const xpBar = h('div', { className: 'sc-xpbar', role: 'progressbar', 'aria-label': 'XP to next level', 'aria-valuemin': 0, 'aria-valuemax': 100 }, xpFill);
  const hero = h('section', { className: 'sc-hero' },
    h('div', { className: 'sc-ring' }, ring, h('span', { className: 'sc-ring-lv' }, h('small', { textContent: 'LV' }), lvNum)),
    h('div', { className: 'sc-hero-text' }, rank, title, xpBar, xpText));

  const stat = (ic, label) => {
    const v = h('b');
    return [h('div', { className: 'sc-stat' }, ic, h('span', { className: 'sc-stat-v' }, v, h('small', { textContent: label }))), v];
  };
  const [sCoins, vCoins] = stat(coinIcon('sc-coin'), 'Coins');
  const [sTime, vTime] = stat(icon('clock'), 'In Kayboro');
  const [sHost, vHost] = stat(icon('gamepad'), 'Hosted play');
  const [sAch, vAch] = stat(icon('trophy'), 'Achievements');

  // ---- Reward track ----
  const track = h('ol', { className: 'sc-track', 'aria-label': `Reward track, levels 1 to ${MAX_LEVEL}` });
  const scroller = h('div', { className: 'sc-track-scroll', tabindex: 0 }, track);
  const page = d => scroller.scrollBy({ left: d * NODE_W * 3, behavior: reducedMotion() ? 'auto' : 'smooth' });
  const trackNext = h('span', { className: 'meta' });
  const trackSec = h('section', { className: 'sc-sec' },
    h('div', { className: 'sc-sec-head' }, h('h3', {}, icon('stars'), 'Reward track'), trackNext,
      h('button', { type: 'button', className: 'icon-btn sm', 'aria-label': 'Earlier levels', title: 'Earlier levels', onclick: () => page(-1) }, icon('chevL')),
      h('button', { type: 'button', className: 'icon-btn sm', 'aria-label': 'Later levels', title: 'Later levels', onclick: () => page(1) }, icon('chevR'))),
    scroller);

  // ---- Games ----
  const games = h('ul', { className: 'sc-games' });
  const gamesSec = h('section', { className: 'sc-sec' }, h('div', { className: 'sc-sec-head' }, h('h3', {}, icon('gamepad'), 'Played in Kayboro')), games);

  // ---- Settings ----
  const settings = h('div', { className: 'sc-settings' });
  const mods = h('div', { className: 'sc-mods' });
  const settingsSec = h('section', { className: 'sc-sec' }, h('div', { className: 'sc-sec-head' }, h('h3', {}, icon('settings'), 'Settings')), settings, mods);

  // ---- Tester tools: only in the tester sandbox (KAYBORO_SANDBOX=1, see src/main/sandbox.js) ----
  const testerSec = shell?.sandbox === true ? testerTools() : null;

  el.replaceChildren(h('div', { className: 'sc-panel sc-profile' },
    hero,
    h('p', { className: 'sc-earn' }, icon('clock'), h('span', {}, 'Each minute in Kayboro: ', h('b', { className: 'c' }, '+1 coin'), ', ', h('b', { className: 'x' }, '+10 XP'))),
    h('div', { className: 'sc-stats' }, sCoins, sTime, sHost, sAch),
    testerSec, trackSec, gamesSec, settingsSec));

  function renderHero() {
    const lvl = st?.level || 1, p = levelProgress(st), max = !(st?.xpForNext > 0);
    lvNum.textContent = lvl;
    arc.setAttribute('stroke-dashoffset', (CIRC * (1 - p)).toFixed(2));
    rank.textContent = rankTitle(lvl);
    title.textContent = `Level ${lvl}`;
    xpFill.style.transform = `scaleX(${p})`;
    xpBar.setAttribute('aria-valuenow', Math.round(p * 100));
    xpText.textContent = max ? 'Max level. You did it!' : `${fmt.format(st?.xpIntoLevel || 0)} / ${fmt.format(st.xpForNext)} XP to level ${lvl + 1}`;
    vCoins.textContent = fmt.format(Math.max(0, Math.floor(st?.coins || 0)));
    const list = gameStats(st);
    vTime.replaceChildren(...durNodes(fmtDuration(st?.stats?.totalPlaySeconds)));
    vHost.replaceChildren(...durNodes(fmtDuration(list.reduce((s, g) => s + g.playSeconds, 0))));
    vAch.textContent = fmt.format(st?.stats?.achievements || 0);
  }

  function renderTrack() {
    const lvl = st?.level || 1, sig = `${lvl}|${(cat.levels || []).length}|${idx.size}`;
    if (sig === trackSig) return;
    trackSig = sig;
    const nodes = rewardTrack(cat.levels, lvl);
    const next = nodes.find(n => n.state === 'next');
    trackNext.textContent = next ? `Next: level ${next.level}` : 'All claimed';
    track.replaceChildren(...nodes.map(n => {
      const it = n.items.map(id => idx.get(id)).find(Boolean);
      const label = [`Level ${n.level}`, n.coins ? `${n.coins} coins` : null, ...n.items.map(id => idx.get(id)?.name || id)].filter(Boolean).join(', ');
      return h('li', { className: `sc-node s-${n.state}${n.milestone ? ' is-milestone' : ''}${it ? ' has-item' : ''}`, title: label, 'aria-label': `${label}. ${n.state === 'claimed' ? 'Claimed' : n.state === 'next' ? 'Next' : 'Locked'}`,
        'aria-current': n.state === 'next' ? 'step' : null },
      h('span', { className: 'sc-node-lv', textContent: n.level }),
      h('span', { className: 'sc-node-card' }, it ? itemThumb(it, 'sc-ithumb') : coinIcon('sc-coin sc-node-coin'),
        n.state === 'claimed' ? h('span', { className: 'sc-node-ok' }, icon('check')) : n.state === 'locked' ? h('span', { className: 'sc-node-lock' }, icon('lock')) : null),
      h('span', { className: 'sc-node-rw' }, n.coins ? [coinIcon('sc-coin'), fmt.format(n.coins)] : it ? 'Item' : '–'));
    }));
    centred = false;
    centre();
  }
  // Scroll the next level into the middle once the panel is visible.
  function centre() {
    if (centred || !scroller.clientWidth) return;
    const n = track.querySelector('[aria-current]');
    if (!n && !track.lastElementChild) return;
    centred = true;
    scroller.scrollLeft = n ? Math.max(0, n.offsetLeft - scroller.clientWidth / 2 + n.offsetWidth / 2 - NODE_W) : scroller.scrollWidth; // all claimed: the end
  }

  function renderGames() {
    const list = gameStats(st), sig = JSON.stringify([list, allGames]);
    if (sig === gamesSig) return;
    gamesSig = sig;
    if (!list.length) {
      return games.replaceChildren(h('li', { className: 'sc-empty sm' }, icon('gamepad'),
        h('p', { textContent: 'Games you host in a shell show up here, with your play time.' })));
    }
    const top = list[0].playSeconds || 1;
    put(games, ...(allGames ? list : list.slice(0, 6)).map(g => h('li', { className: 'sc-game' },
      h('span', { className: 'sc-avatar', style: { '--hue': hueOf(g.name) }, textContent: initials(g.name) }),
      h('span', { className: 'sc-game-main' },
        h('span', { className: 'sc-game-row' }, h('b', { textContent: g.name }), h('span', { className: 'sc-game-t' }, durNodes(fmtDuration(g.playSeconds)))),
        h('span', { className: 'sc-game-bar' }, h('i', { style: { transform: `scaleX(${Math.max(0.02, g.playSeconds / top)})` } }))),
      g.achievements ? h('span', { className: 'sc-chip', title: `${g.achievements} achievements` }, icon('trophy'), fmt.format(g.achievements)) : null)),
    list.length > 6 ? h('li', { className: 'sc-more' }, h('button', { type: 'button', className: 'btn sm ghost', textContent: allGames ? 'Show less' : `Show all ${list.length}`,
      onclick: () => { allGames = !allGames; renderGames(); } })) : null);
  }

  // ---- Settings ----
  const row = (ic, label, sub, ctrl, cls = '') => h('div', { className: `sc-set ${cls}` }, h('span', { className: 'sc-set-ic' }, ic),
    h('span', { className: 'sc-set-text' }, h('b', { textContent: label }), sub ? h('small', {}, sub) : null), ctrl);
  const sw = (checked, onchange, label) => h('label', { className: 'switch' }, h('input', { type: 'checkbox', role: 'switch', checked, onchange, 'aria-label': label }), h('span', { className: 'track', 'aria-hidden': 'true' }));

  let settingsData = null, integrity = null;
  async function loadSettings() {
    [settingsData, integrity] = await Promise.all([call(shell, 'getSettings'), call(shell, 'getIntegrity')]);
    renderSettings();
  }
  function renderSettings() {
    const rows = [];
    if (has(shell, 'getSettings') && settingsData) {
      const on = !!settingsData?.rewards?.achievements;
      rows.push(row(icon('trophy'), 'Achievement rewards (beta)', 'Unlock a Steam achievement in a hosted game: +50 coins and +120 XP.',
        sw(on, async e => {
          const want = e.target.checked;
          const r = await call(shell, 'setSettings', { rewards: { achievements: want } });
          settingsData = (r && (r.settings || (r.rewards ? r : null))) || (await call(shell, 'getSettings')) || { rewards: { achievements: want } };
          renderSettings();
          play('tap');
        }, 'Achievement rewards')));
    }
    rows.push(row(icon(isMuted() ? 'mute' : 'volume'), 'Sounds', 'Coin, unlock and level-up blips.', sw(!isMuted(), e => { setMuted(!e.target.checked); if (e.target.checked) play('coin'); }, 'Sounds')));
    if (integrity && typeof integrity === 'object') {
      const bad = [...(integrity.mismatched || []), ...(integrity.missing || [])];
      const again = h('button', { type: 'button', className: 'btn sm ghost sc-recheck', title: 'Check the app files again', onclick: async e => {
        e.currentTarget.classList.add('busy');
        integrity = (await call(shell, 'getIntegrity', { refresh: true })) || integrity;
        renderSettings();
      } }, icon('refresh'), 'Check');
      if (!integrity.checked) rows.push(row(icon('shield'), 'App files', 'Development build: nothing to check.', again, 'is-muted'));
      else if (integrity.ok || !bad.length) rows.push(row(icon('shield'), 'App files: OK', `${fmt.format(integrity.checked)} files match the installed version.`, again, 'is-ok'));
      else {
        const det = h('details', { className: 'sc-files' }, h('summary', { textContent: 'Show files' }),
          h('ul', {}, bad.slice(0, 12).map(p => h('li', { textContent: p })), bad.length > 12 ? h('li', { textContent: `…and ${bad.length - 12} more` }) : null));
        rows.push(row(icon('alert'), `${bad.length} file${bad.length === 1 ? ' differs' : 's differ'} from the installed version`,
          ['Use Steam > Properties > Installed Files > Verify integrity.', det], again, 'is-warn'));
      }
    }
    settings.replaceChildren(...rows);
  }
  const offMute = onMuteChange(() => renderSettings());

  // ---- Mods ----
  let modList = null;
  async function loadMods() {
    modList = has(shell, 'getMods') ? await call(shell, 'getMods') : null;
    renderMods();
  }
  function renderMods() {
    if (!has(shell, 'getMods')) return mods.replaceChildren();
    const list = Array.isArray(modList) ? modList : [];
    const head = h('div', { className: 'sc-mods-head' }, h('span', { className: 'sc-set-ic' }, icon('puzzle')),
      h('span', { className: 'sc-set-text' }, h('b', { textContent: 'Mods' }),
        h('small', { textContent: list.length ? `${list.length} installed. Mod items are free and yours right away.` : 'Add your own shells and wallpapers.' }),
        h('span', { className: 'sc-mods-acts' },
          h('button', { type: 'button', className: 'btn sm', onclick: reloadMods }, icon('refresh'), 'Reload'),
          h('button', { type: 'button', className: 'btn sm', onclick: () => call(shell, 'openModsFolder') }, icon('folder'), 'Open folder'))));
    const rows = list.map(m => {
      const n = Array.isArray(m.items) ? m.items.length : Number(m.items) || 0, errs = (m.errors || []).filter(Boolean);
      return h('li', { className: `sc-mod${errs.length && !n ? ' is-bad' : ''}` },
        h('span', { className: 'sc-avatar sm', style: { '--hue': hueOf(m.id || m.name) }, textContent: initials(m.name || m.id) }),
        h('span', { className: 'sc-mod-main' },
          h('span', { className: 'sc-game-row' }, h('b', { textContent: m.name || m.id }), m.version ? h('span', { className: 'sc-ver', textContent: `v${m.version}` }) : null),
          h('small', { textContent: [m.author && `by ${m.author}`, `${n} item${n === 1 ? '' : 's'}`].filter(Boolean).join(' · ') }),
          ...errs.slice(0, 3).map(e => h('small', { className: 'sc-mod-err' }, icon('alert'), String(e?.message || e)))));
    });
    mods.replaceChildren(head, rows.length ? h('ul', { className: 'sc-modlist' }, rows)
      : h('p', { className: 'hint sc-mods-empty', textContent: 'No mods yet. Put a mod folder with a mod.json in the mods folder, then reload. See docs/MODDING.md.' }));
  }
  async function reloadMods(e) {
    const b = e?.currentTarget;
    b?.classList.add('busy');
    const r = await call(shell, 'reloadMods');
    modList = Array.isArray(r) ? r : await call(shell, 'getMods');
    b?.classList.remove('busy');
    renderMods();
    await app.refreshCatalog?.();
    dispatchEvent(new CustomEvent('kayboro:catalog'));
    const n = (modList || []).length, bad = (modList || []).filter(m => m.errors?.length).length;
    toast({ title: `Mods reloaded: ${n} found`, body: bad ? `${bad} with warnings. Check the list in Settings.` : '', kind: bad ? 'warn' : 'ok' });
  }

  // ---- Tester tools (sandbox only) ----
  function testerTools() {
    const refresh = async () => update(await call(shell, 'getState'));
    const run = fn => async e => {
      const b = e.currentTarget;
      if (b.disabled) return;
      b.disabled = true;
      try { await fn(b); } catch (err) { toast({ title: 'That didn’t work', body: String(err?.message || err), kind: 'error' }); }
      finally { b.disabled = false; }
    };
    const btn = (ic, label, fn, cls = '') => h('button', { type: 'button', className: `btn sm ${cls}`.trim(), onclick: run(fn) }, ic, h('span', { textContent: label }));
    const grant = coins => async () => {
      if (!(await call(shell, 'debugGrant', { coins }))) throw new Error('No coins were granted. Restart Kayboro with START_SANDBOX.bat.');
      await refresh();
      play('coin');
      toast({ title: `+${fmt.format(coins)} coins`, body: 'Added to the sandbox profile.', kind: 'coin' });
    };
    const advance = hours => async () => {
      const r = await call(shell, 'debugAdvanceTime', hours * 3600);
      const d = k => Math.max(0, (r?.state?.[k] || 0) - (r?.before?.[k] || 0));
      await refresh();
      toast(d('xp') ? { title: `${hours} hour${hours === 1 ? '' : 's'} passed`, body: `+${fmt.format(d('coins'))} coins and +${fmt.format(d('xp'))} XP, level rewards included.`, kind: 'ok' }
        : { title: 'No time counted', body: 'Time only counts while the Kayboro window is visible. Keep it open and try again.', kind: 'warn' });
    };
    // A made-up achievement for the hosted game (Spacewar, appid 480, when nothing is hosted). Rewards arrive as the usual toast.
    const simulate = async () => {
      const appid = Number(st?.session?.appid) > 0 ? Number(st.session.appid) : 480;
      const r = await call(shell, 'debugSimulateUnlock', appid, `KB_SANDBOX_${Date.now().toString(36).toUpperCase()}`);
      if (!r) return toast({ title: 'No achievement reward', body: 'Turn on Achievement rewards (beta) in Settings below, then try again.', kind: 'warn' });
      await refresh();
    };
    // Two clicks within 4 s: the first one arms the button, the second resets.
    let armed = null;
    const disarm = b => { clearTimeout(armed); armed = null; b.classList.remove('is-armed'); b.lastChild.textContent = 'Reset Sandbox Profile'; };
    const reset = async b => {
      if (!armed) {
        armed = setTimeout(() => disarm(b), 4000);
        b.classList.add('is-armed');
        b.lastChild.textContent = 'Click Again to Reset';
        return;
      }
      disarm(b);
      const s = await call(shell, 'debugResetSandbox');
      if (!s || s.ok === false) throw new Error('The sandbox profile could not be reset. Check the terminal for details.');
      update(s);
      toast({ title: 'Sandbox profile reset', body: 'Back to level 1 with 0 coins. Mods and scenes are kept.', kind: 'ok' });
    };
    return h('section', { className: 'sc-sec sc-tester', 'aria-label': 'Tester tools' },
      h('div', { className: 'sc-sec-head' }, h('h3', {}, icon('target'), 'Tester tools'), h('span', { className: 'meta', textContent: 'Sandbox' })),
      h('p', { className: 'sc-tester-note' }, icon('info'), h('span', { textContent: 'Sandbox profile: progress here is separate and never touches your real save.' })),
      h('div', { className: 'sc-tester-acts' },
        btn(coinIcon('sc-coin'), 'Grant 1,000 Coins', grant(1000)),
        btn(coinIcon('sc-coin'), 'Grant 10,000 Coins', grant(10000)),
        btn(icon('clock'), 'Advance 1 Hour', advance(1)),
        btn(icon('clock'), 'Advance 10 Hours', advance(10)),
        btn(icon('trophy'), 'Simulate Achievement', simulate, 'sc-tester-wide'),
        btn(icon('trash'), 'Reset Sandbox Profile', reset, 'ghost sc-tester-wide sc-tester-reset')));
  }

  // ---- State ----
  function update(s) {
    if (s && typeof s === 'object') st = s;
    if (app.catalog?.levels?.length && app.catalog !== cat) { cat = app.catalog; idx = indexCatalog(cat); trackSig = ''; }
    renderHero();
    renderTrack();
    renderGames();
    if (!centred) requestAnimationFrame(centre);
  }
  const onCatalog = async () => {
    const c = await call(shell, 'listCatalog');
    if (c?.levels) { cat = { ...cat, ...c }; idx = indexCatalog(cat); trackSig = ''; renderTrack(); }
  };
  addEventListener('kayboro:catalog', onCatalog);
  const offCatalog = typeof shell?.onCatalog === 'function' ? shell.onCatalog(c => { if (c?.levels) { cat = { ...cat, ...c }; idx = indexCatalog(cat); trackSig = ''; renderTrack(); } }) : null;
  const ro = typeof ResizeObserver === 'function' ? new ResizeObserver(() => centre()) : null;
  ro?.observe(scroller);

  update(st);
  renderSettings();
  loadSettings();
  loadMods();
  if (!cat.levels?.length) onCatalog();

  return {
    update,
    destroy() { offMute(); ro?.disconnect(); removeEventListener('kayboro:catalog', onCatalog); if (typeof offCatalog === 'function') offCatalog(); el.replaceChildren(); },
  };
}

function svg(tag, attrs = {}, ...kids) {
  const e = document.createElementNS('http://www.w3.org/2000/svg', tag);
  for (const [k, v] of Object.entries(attrs)) e.setAttribute(k, v);
  e.append(...kids);
  return e;
}
