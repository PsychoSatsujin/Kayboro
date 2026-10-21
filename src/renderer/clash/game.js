// Fandom Clash: the full-window game, opened from the Arcade tab. "Which one has more posts across all
// booru sites?" Four modes (Ranked Vs, Local Ranking, Percentage Vs, Ghost Battle), four difficulties,
// leaderboards, optional coin bets. Main (src/main/clash.js) makes matches, scores runs and settles bets;
// this file is presentation: an animated versus splash, big character cards, rolling counters, combo
// pops, pixel confetti, synth blips (panels/sound.js) and keyboard play (left/right, A/D, 1-4, Esc).
// Low pressure by design: no countdowns, no lives, no streak guilt, no nagging. Reduced motion is honoured.
// Images: only kclash://img/<id> (the snapshot's SFW image, via main); otherwise the pixel placeholder.
import { h, icon, put, coinIcon, fmt, reducedMotion, coinFlight, call } from '../panels/kit.js';
import { play as sfx, isMuted, toggleMuted, onMuteChange } from '../panels/sound.js';
import * as L from './logic.js';
import { avatar, imageUrl, placeholderUrl, pixelFor, playerAvatarRef, prefetch } from './icons.js';

let inst = null;
const motion = () => !reducedMotion();
const wait = ms => new Promise(r => setTimeout(r, ms));
// Next animation frame, or ~50 ms later if frames are not coming (hidden window): counters always finish.
const nextFrame = cb => { let done = false; const f = () => { if (!done) { done = true; cb(); } }; requestAnimationFrame(f); setTimeout(f, 50); };
// Resolves when the animation ends, or shortly after it should have (a hidden or occluded window gets no
// frames, and the game must never wait on one).
const anim = (el, frames, opts) => {
  if (!motion() || !el?.animate) return Promise.resolve();
  const a = el.animate(frames, opts);
  const ms = (opts?.duration || 0) + (opts?.delay || 0) + 120;
  return Promise.race([a.finished.catch(() => {}), wait(ms).then(() => { try { a.finish(); } catch {} })]);
};
const BET_REASONS = { insufficient: 'Not enough coins for that bet.', cap: 'Bets are capped at 25% of your coins (500 at most).', busy: 'Finish your other bets first.', amount: 'Pick a bet amount.' };

/** Opens the game (or brings it to `mode`). */
export function openClash(app, opts = {}) {
  if (inst) { inst.go(opts.mode); return inst; }
  inst = createGame(app, opts);
  return inst;
}
/** Plays the game inside `host` (a console's screen opening): a 1280x720 game scaled to fit, keys only while it has focus. Returns { close }. */
export function embedClash(app, host, opts = {}) { return createGame(app, { ...opts, host }); }
export const clashOpen = () => !!inst;
export const updateClash = st => inst?.update(st);

function createGame(app, opts) {
  const ror = app.ror || window.ror, shell = app.shell || window.shell;
  const rpc = async (name, ...a) => (await call(ror, name, ...a)) ?? { error: 'Fandom Clash needs the Kayboro desktop app.' };
  const toast = m => app.toast?.(m);
  const copy = (text, msg) => navigator.clipboard?.writeText(String(text)).then(() => { sfx('coin'); toast({ title: msg, body: String(text), kind: 'ok' }); }, () => toast({ title: 'Copy failed', body: String(text) }));
  const embed = opts.host || null;
  let alive = true;
  const S = { status: null, snap: null, limits: null, mode: 'ranked', difficulty: readPref('difficulty', 'normal'), group: readPref('group', null), onKey: null, leave: null };
  let nav = 0;

  // ---- Frame ----
  const bg = h('canvas', { className: 'cl-bgfx', 'aria-hidden': 'true' });
  const crumb = h('span', { className: 'cl-crumb' });
  const pill = h('span', { className: 'cl-pill', role: 'status' });
  const walletN = h('b', { textContent: fmt.format(app.state?.coins || 0) });
  const wallet = h('span', { className: 'sc-wallet cl-wallet', title: 'Your coins' }, coinIcon(), walletN);
  const muteBtn = h('button', { type: 'button', className: 'cl-icon', onclick: () => { toggleMuted(); sfx('tap'); } });
  const syncMute = () => { put(muteBtn, icon(isMuted() ? 'mute' : 'volume')); muteBtn.setAttribute('aria-label', isMuted() ? 'Sound on' : 'Sound off'); muteBtn.title = muteBtn.getAttribute('aria-label'); };
  syncMute();
  const offMute = onMuteChange(syncMute);
  const closeBtn = h('button', { type: 'button', className: 'cl-icon', 'aria-label': 'Close Fandom Clash (Esc)', title: 'Close (Esc)', onclick: () => tryClose() }, icon('x'));
  const homeBtn = h('button', { type: 'button', className: 'cl-brand', title: 'Fandom Clash home', onclick: () => leaveTo(hub) },
    h('span', { className: 'cl-brand-mark', 'aria-hidden': 'true' }, 'FC'), h('span', { className: 'cl-brand-name' }, 'Fandom Clash'));
  const view = h('main', { className: 'cl-view' });
  const root = h('div', { className: `cl-root${embed ? ' cl-embed' : ''}`, role: embed ? 'region' : 'dialog', 'aria-modal': embed ? null : 'true', 'aria-label': 'Fandom Clash', tabindex: '-1' },
    bg, h('div', { className: 'cl-vignette', 'aria-hidden': 'true' }),
    h('header', { className: 'cl-top' }, homeBtn, crumb, h('span', { className: 'cl-grow' }), pill, wallet, muteBtn, closeBtn), view);
  // Embedded: a fixed 1280x720 game scaled into the host; full window otherwise.
  const EW = 1280, EH = 720;
  let fit = null;
  if (embed) {
    embed.append(root);
    const scale = () => {
      const w = embed.clientWidth, hh = embed.clientHeight;
      if (!w || !hh) return;
      const k = Math.min(w / EW, hh / EH);
      root.style.transform = `translate(${((w - EW * k) / 2).toFixed(1)}px, ${((hh - EH * k) / 2).toFixed(1)}px) scale(${k.toFixed(4)})`;
    };
    fit = new ResizeObserver(scale);
    fit.observe(embed);
    scale();
    root.addEventListener('pointerdown', () => root.contains(document.activeElement) || root.focus({ preventScroll: true }));
  } else {
    document.body.append(root);
    document.body.classList.add('clash-open');
  }
  const stopBg = backdrop(bg, embed ? () => [EW, EH] : undefined);
  anim(root, [{ opacity: 0, transform: 'scale(1.02)' }, { opacity: 1, transform: 'none' }], { duration: 260, easing: 'cubic-bezier(.2,.8,.2,1)' });
  const returnFocus = document.activeElement;
  if (!embed) root.focus();

  // Keys: everything typed while the game is open stays in the game (the stage's arrows, H and Del must not fire).
  const onKey = e => {
    if (!alive) return;
    const typing = e.target.closest?.('input, textarea, select');
    if (!root.contains(e.target) && (embed || e.target !== document.body)) return;
    if (typing) { if (e.key === 'Escape') { e.target.blur(); e.stopImmediatePropagation(); } return; }
    e.stopImmediatePropagation();
    const dlg = root.querySelector('.cl-confirm');
    if (dlg) { if (e.key === 'Escape') { e.preventDefault(); dlg.querySelector('.primary')?.click(); } return; } // Enter/Space press the focused button
    if (e.ctrlKey || e.altKey || e.metaKey) return;
    if (S.onKey && S.onKey(e) === true) { e.preventDefault(); return; }
    if (e.key === 'Escape') { e.preventDefault(); if (S.leave) S.leave(); else if (S.back) S.back(); else tryClose(); }
  };
  addEventListener('keydown', onKey, true);

  function setPill() {
    const st = S.status;
    const on = st?.online === true, server = !!st?.server;
    pill.className = `cl-pill ${on ? 'on' : server && st?.online == null ? 'wait' : 'off'}`;
    pill.textContent = on ? 'Online' : server && st?.online == null ? 'Connecting' : 'Offline';
    pill.title = on ? 'Connected to the Fandom Clash server: global boards and ghosts.'
      : 'Playing offline: the bundled data, your own scores on this PC and your own ghosts. Nothing is lost.';
  }

  // ---- Navigation ----
  async function show(build, title = '') {
    const token = ++nav;
    S.onKey = null; S.leave = null; S.back = null; S.abort = null;
    const old = view.firstElementChild;
    if (old) await anim(old, [{ opacity: 1, transform: 'none' }, { opacity: 0, transform: 'translateY(-10px) scale(.985)' }], { duration: 150, easing: 'ease-in', fill: 'forwards' });
    if (token !== nav) return;
    const el = h('div', { className: 'cl-screen' });
    put(view, el);
    crumb.textContent = title;
    const p = build(el, () => token === nav && alive);
    anim(el, [{ opacity: 0, transform: 'translateY(16px)' }, { opacity: 1, transform: 'none' }], { duration: 280, easing: 'cubic-bezier(.2,.8,.2,1)' });
    await p;
    if (token === nav) (el.querySelector('[data-autofocus]') || root).focus({ preventScroll: true });
  }
  function leaveTo(fn) { if (S.leave) S.leave(fn); else fn(); }
  function tryClose() { if (embed) { leaveTo(hub); return; } if (S.leave) S.leave(close); else close(); } // embedded: Esc and x go home
  function close() {
    if (!alive) return;
    try { S.abort?.(); } catch {}
    alive = false;
    nav++;
    removeEventListener('keydown', onKey, true);
    offMute();
    fit?.disconnect();
    const r = root;
    if (!embed) { inst = null; document.body.classList.remove('clash-open'); }
    anim(r, [{ opacity: 1 }, { opacity: 0, transform: 'scale(.985)' }], { duration: 180, easing: 'ease-in', fill: 'forwards' }).then(() => { stopBg(); r.remove(); });
    try { returnFocus?.focus?.(); } catch {}
  }

  async function ensureData() {
    if (!S.status) { S.status = await rpc('clashStatus'); setPill(); rpc('clashCheck').then(st => { if (st && !st.error) { S.status = st; setPill(); } }); }
    if (!S.snap) { const s = await rpc('clashSnapshot'); if (s && !s.error) S.snap = s; else return s?.error || 'No Fandom Clash data yet.'; }
    return null;
  }
  async function refreshLimits() {
    S.limits = (await call(shell, 'betLimits')) || { min: 1, max: 0 };
    return S.limits;
  }

  // ---- Hub ----
  function hub() {
    show(async (el, live) => {
      const err = await ensureData();
      if (!live()) return;
      if (err) return put(el, emptyBox('No data yet', err));
      const modes = ['ranked', 'local', 'percent', 'ghost'];
      const MODE_ICON = { ranked: 'trophy', local: 'heart', percent: 'palette', ghost: 'eyeOff' };
      const cards = modes.map((m, i) => h('button', { type: 'button', className: `cl-mode is-${m}`, 'data-autofocus': i === 0 ? '' : null,
        onclick: () => { sfx('tap'); openMode(m); } },
        h('span', { className: 'cl-mode-ic' }, icon(MODE_ICON[m])),
        h('span', { className: 'cl-mode-t' }, L.MODE[m].label),
        h('span', { className: 'cl-mode-b' }, L.MODE[m].blurb),
        h('kbd', { className: 'cl-kbd' }, String(i + 1))));
      const nameIn = h('input', { type: 'text', className: 'cl-name-in', value: S.status?.player?.name || '', maxLength: 20, 'aria-label': 'Your player name', spellcheck: false,
        onchange: async () => { const r = await rpc('clashSetName', nameIn.value); if (r?.error) { toast({ title: r.error, kind: 'error' }); nameIn.value = S.status.player.name; } else { S.status.player = r; sfx('tap'); } } });
      const snapLine = S.status?.snapshot ? `${fmt.format(S.status.snapshot.characters)} characters · ${fmt.format(S.status.snapshot.franchises)} franchises · data from ${dateOf(S.status.snapshot.generatedAt)}` : '';
      put(el,
        h('section', { className: 'cl-hero' },
          h('div', { className: 'cl-hero-copy' },
            h('p', { className: 'cl-eyebrow' }, 'Kayboro Arcade'),
            h('h1', { className: 'cl-title', 'aria-label': 'Fandom Clash' }, h('span', {}, 'FANDOM'), h('span', {}, 'CLASH')),
            h('p', { className: 'cl-tag' }, 'Who has more fan art? Trust your fandom instincts. Counts cover every rating across the big booru sites; only safe-for-work pictures are ever shown.'),
            h('div', { className: 'cl-hero-actions' },
              h('button', { type: 'button', className: 'cl-btn primary big', onclick: () => { sfx('tap'); openMode('ranked'); } }, icon('gamepad'), h('span', {}, 'Quick Play')),
              h('button', { type: 'button', className: 'cl-btn big', onclick: () => { sfx('tap'); boards(); } }, icon('trophy'), h('span', {}, 'Leaderboards'), h('kbd', { className: 'cl-kbd' }, 'L')))),
          attract(live)),
        h('section', { className: 'cl-modes', 'aria-label': 'Modes' }, cards),
        h('footer', { className: 'cl-foot' },
          h('label', { className: 'cl-name' }, h('span', {}, 'Playing as'), nameIn),
          h('button', { type: 'button', className: 'cl-btn ghost sm', title: 'Your player id: friends can race your ghost with it', onclick: () => copy(S.status.player.id, 'Player id copied') },
            icon('bookmark'), h('span', {}, `ID ${S.status?.player?.id?.slice(0, 8) || ''}…`)),
          h('span', { className: 'cl-grow' }),
          h('span', { className: 'cl-meta' }, snapLine)));
      S.onKey = e => {
        const i = ['1', '2', '3', '4'].indexOf(e.key);
        if (i >= 0) { sfx('tap'); openMode(modes[i]); return true; }
        if (e.key === 'l' || e.key === 'L') { boards(); return true; }
        return false;
      };
    }, '');
  }

  // Two random characters with pictures, sparring in the hero (changes every few seconds).
  function attract(live) {
    const pool = (S.snap?.characters || []).filter(c => c.img);
    const box = h('div', { className: 'cl-attract', 'aria-hidden': 'true' });
    if (pool.length < 2) { box.append(h('div', { className: 'cl-attract-vs' }, 'VS')); return box; }
    let k = Math.floor(Math.random() * pool.length);
    const round = () => {
      const a = pool[k % pool.length], b = pool[(k + 1 + Math.floor(pool.length / 2)) % pool.length];
      k += 1;
      put(box, miniCard(a, 'l'), h('div', { className: 'cl-attract-vs' }, 'VS'), miniCard(b, 'r'));
      for (const [i, c] of [...box.querySelectorAll('.cl-mini')].entries()) anim(c, [{ opacity: 0, transform: `translateX(${i ? 40 : -40}px) rotate(${i ? 8 : -8}deg)` }, { opacity: 1 }], { duration: 420, easing: 'cubic-bezier(.2,.9,.25,1.2)' });
    };
    round();
    if (motion()) { const t = setInterval(() => { if (!live()) return clearInterval(t); round(); }, 4200); }
    return box;
  }
  const miniCard = (r, side) => h('div', { className: `cl-mini is-${side}` }, picture(r, 'cl-mini-img'), h('span', {}, r.name));

  function openMode(m) {
    S.mode = m;
    if (m === 'ranked' || m === 'local') return setupVs(m);
    if (m === 'percent') return percentHub();
    if (m === 'ghost') return ghostSelect();
  }

  // ---- Vs setup (Ranked / Local) ----
  function setupVs(mode) {
    show(async (el, live) => {
      const err = await ensureData();
      if (!live()) return;
      if (err) return put(el, emptyBox('No data yet', err));
      S.back = hub;
      const start = h('button', { type: 'button', className: 'cl-btn primary big', 'data-autofocus': '' }, icon('gamepad'), h('span', {}, 'Start'), h('kbd', { className: 'cl-kbd' }, 'Enter'));
      const groupBox = mode === 'local' ? h('div', { className: 'cl-groups' }) : null;
      const go = async () => {
        if (mode === 'local' && !S.group) { sfx('error'); toast({ title: 'Pick or make a group first.' }); return; }
        start.disabled = true;
        const m = await rpc('clashMatch', { mode, difficulty: S.difficulty, group: mode === 'local' ? S.group : undefined });
        start.disabled = false;
        if (m?.error) { sfx('error'); toast({ title: 'Could not start', body: m.error, kind: 'error' }); return; }
        runVs(m);
      };
      start.onclick = go;
      if (groupBox) renderGroups(groupBox, live);
      put(el, h('div', { className: 'cl-setup' },
        h('div', { className: 'cl-setup-head' }, h('h2', {}, L.MODE[mode].label), h('p', {}, mode === 'ranked'
          ? 'Ten match-ups: mostly character vs character, with franchise rounds mixed in. A miss only resets your combo; every run goes the full ten.'
          : 'Same game, your own board: only people with the group code show up on it.')),
        h('div', { className: 'cl-field' }, h('span', { className: 'cl-label' }, 'Difficulty'), diffPicker(d => { S.difficulty = d; writePref('difficulty', d); })),
        groupBox,
        h('div', { className: 'cl-setup-go' }, start, h('button', { type: 'button', className: 'cl-btn ghost', onclick: () => boards(mode) }, icon('trophy'), h('span', {}, 'Board')))));
      S.onKey = e => (e.key === 'Enter' ? (go(), true) : false);
    }, L.MODE[mode].label);
  }

  async function renderGroups(box, live) {
    const groups = (await rpc('clashGroups')) || [];
    if (!live()) return;
    if (S.group && !groups.some(g => g.code === S.group)) S.group = null;
    if (!S.group && groups[0]) S.group = groups[0].code;
    const nameIn = h('input', { type: 'text', className: 'cl-in', placeholder: 'Group name, e.g. Friday Fans', maxLength: 40, 'aria-label': 'New group name' });
    const codeIn = h('input', { type: 'text', className: 'cl-in mono', placeholder: 'CODE', maxLength: 16, 'aria-label': 'Group code to join', spellcheck: false, autocapitalize: 'characters' });
    const list = groups.length ? h('div', { className: 'cl-glist', role: 'radiogroup', 'aria-label': 'Your groups' }, groups.map(g => h('button', {
      type: 'button', role: 'radio', className: 'cl-gitem', 'aria-checked': String(g.code === S.group),
      onclick: () => { S.group = g.code; writePref('group', g.code); renderGroups(box, live); } },
      h('b', {}, g.name), h('code', {}, g.code), g.offline ? h('span', { className: 'sc-tag off', title: 'Made or joined while offline: only scores on this PC.' }, 'This PC') : null,
      h('span', { className: 'cl-grow' }),
      h('span', { className: 'cl-gact', role: 'button', tabindex: '0', title: 'Copy code', onclick: e => { e.stopPropagation(); copy(g.code, 'Group code copied'); } }, icon('bookmark')),
      h('span', { className: 'cl-gact', role: 'button', tabindex: '0', title: 'Leave group', onclick: async e => { e.stopPropagation(); await rpc('clashLeaveGroup', g.code); renderGroups(box, live); } }, icon('x'))))) : h('p', { className: 'cl-muted' }, 'No groups yet. Make one and share the code, or join with a friend\'s code.');
    put(box, h('span', { className: 'cl-label' }, 'Group'), list,
      h('div', { className: 'cl-grow-row' }, nameIn, h('button', { type: 'button', className: 'cl-btn', onclick: async () => {
        const r = await rpc('clashCreateGroup', { name: nameIn.value });
        if (r?.error) return toast({ title: r.error, kind: 'error' });
        S.group = r.code; writePref('group', r.code); sfx('unlock');
        toast({ title: `Group ${r.code} ready`, body: r.offline ? 'Offline for now: it is only on this PC until the server is reachable.' : 'Share the code so friends can join.', kind: 'ok' });
        renderGroups(box, live);
      } }, icon('plus'), h('span', {}, 'Make'))),
      h('div', { className: 'cl-grow-row' }, codeIn, h('button', { type: 'button', className: 'cl-btn', onclick: async () => {
        const r = await rpc('clashJoinGroup', codeIn.value);
        if (r?.error) { sfx('error'); return toast({ title: r.error, kind: 'error' }); }
        S.group = r.code; writePref('group', r.code); sfx('coin');
        renderGroups(box, live);
      } }, icon('send'), h('span', {}, 'Join'))));
  }

  // ---- The Vs run ----
  function runVs(m, { ticket = null } = {}) {
    show((el, live) => {
      const rounds = m.rounds, n = rounds.length, base = L.DIFFICULTY[m.difficulty]?.points || 150;
      const answers = [];
      let streak = 0, score = 0, picker = null, nexter = null, done = false;
      const pips = h('div', { className: 'cl-pips', 'aria-label': 'Rounds' }, rounds.map(() => h('i')));
      const roundN = h('b', {}, `1/${n}`);
      const scoreN = h('b', { className: 'cl-score-n' }, '0');
      const comboN = h('span', { className: 'cl-combo' });
      const track = m.ghost ? ghostTrack(m, n) : null;
      const arena = h('div', { className: 'cl-arena' });
      const prompt = h('p', { className: 'cl-prompt' }, 'Who has ', h('em', {}, 'more posts'), '?');
      const hint = h('p', { className: 'cl-hint' }, h('kbd', { className: 'cl-kbd' }, '←'), ' or ', h('kbd', { className: 'cl-kbd' }, 'A'), ' left · ', h('kbd', { className: 'cl-kbd' }, '→'), ' or ', h('kbd', { className: 'cl-kbd' }, 'D'), ' right · no timer: quick picks just earn a small bonus');
      put(el, h('div', { className: 'cl-hud' },
        h('div', { className: 'cl-hud-l' }, h('span', { className: 'cl-label' }, 'Round'), roundN, pips),
        track ? track.el : h('div', { className: 'cl-hud-c' }, h('span', { className: 'cl-label' }, `${L.MODE[m.mode]?.label || ''} · ${L.DIFFICULTY[m.difficulty].label}`)),
        h('div', { className: 'cl-hud-r' }, h('span', { className: 'cl-label' }, 'Score'), scoreN, comboN)),
      prompt, arena, hint);

      S.onKey = e => {
        const k = e.key.toLowerCase();
        if (picker && (k === 'arrowleft' || k === 'a')) { picker('a'); return true; }
        if (picker && (k === 'arrowright' || k === 'd')) { picker('b'); return true; }
        if (nexter && [' ', 'enter', 'arrowleft', 'arrowright', 'a', 'd'].includes(k)) { nexter(); return true; }
        return false;
      };
      S.leave = async after => {
        if (done) return (after || hub)();
        if (!(await confirmBox(root, 'Leave this run?', ticket ? 'Your bet comes back in full.' : 'This run won\'t be saved.', 'Keep playing', 'Leave'))) return;
        done = true;
        track?.stop();
        rpc('clashCancel', { matchId: m.matchId, ticket });
        (after || hub)();
      };
      // The game being taken away mid-run (an embedded screen changing source): refund at once, no prompt.
      S.abort = () => { if (done) return; done = true; track?.stop(); rpc('clashCancel', { matchId: m.matchId, ticket }); };

      (async () => {
        await versusSplash(arena, m);
        const t0 = performance.now();
        track?.start(t0);
        for (let i = 0; i < n; i++) {
          if (!live() || done) return;
          const r = rounds[i];
          roundN.textContent = `${i + 1}/${n}`;
          pips.children[i].className = 'now';
          const cards = { a: card(r.a, 'a'), b: card(r.b, 'b') };
          const vs = h('div', { className: 'cl-vs' }, h('span', {}, 'VS'));
          put(arena, cards.a.el, vs, cards.b.el);
          if (rounds[i + 1]) prefetch([rounds[i + 1].a, rounds[i + 1].b].flatMap(x => (x.type === 'g' ? x.members : [x])));
          sfx('whoosh');
          Promise.all([ // not awaited: a pick during the entrance counts
            anim(cards.a.el, [{ opacity: 0, transform: 'translateX(-60px) rotate(-4deg)' }, { opacity: 1, transform: 'none' }], { duration: 340, easing: 'cubic-bezier(.2,.9,.25,1.15)' }),
            anim(cards.b.el, [{ opacity: 0, transform: 'translateX(60px) rotate(4deg)' }, { opacity: 1, transform: 'none' }], { duration: 340, easing: 'cubic-bezier(.2,.9,.25,1.15)' }),
            anim(vs, [{ transform: 'scale(0)' }, { transform: 'scale(1.25)' }, { transform: 'scale(1)' }], { duration: 300, delay: 120, easing: 'ease-out' }),
          ]);
          const shownAt = performance.now();
          const pick = await new Promise(res => {
            picker = p => { picker = null; res(p); };
            cards.a.el.onclick = () => picker?.('a');
            cards.b.el.onclick = () => picker?.('b');
          });
          if (!live() || done) return;
          const ms = Math.round(performance.now() - shownAt);
          answers.push({ round: i, pick, ms });
          const ok = L.isCorrect(r, pick);
          streak = ok ? streak + 1 : 0;
          const bonus = ok ? L.speedBonus(ms) : 0, pts = ok ? base + bonus : 0;
          const from = score;
          score += pts;
          cards[pick].el.classList.add('is-picked');
          sfx('tap');
          await Promise.all([cards.a.roll(), cards.b.roll()]);
          const win = L.winnerOf(r);
          for (const s of ['a', 'b']) cards[s].el.classList.add(s === win ? 'is-win' : 'is-lose');
          pips.children[i].className = ok ? 'ok' : 'miss';
          if (m.ghost) track.reveal(i, cards);
          if (ok) {
            sfx(streak >= 2 ? 'combo' : 'right');
            burst(cards[pick].el, streak >= 3 ? 26 : 16);
            floatText(cards[pick].el, `+${fmt.format(pts)}`, 'pts');
            if (bonus) floatText(cards[pick].el, `+${bonus} quick`, 'combo', 140);
            if (streak >= 2) floatText(cards[pick].el, `${streak} in a row!`, 'streak', 280);
          } else {
            sfx('miss');
            anim(cards[pick].el, [{ transform: 'translateX(0)' }, { transform: 'translateX(-7px) rotate(-1deg)' }, { transform: 'translateX(6px) rotate(1deg)' }, { transform: 'translateX(0)' }], { duration: 320 });
            floatText(cards[pick].el, L.lineFor(false, i), 'miss');
          }
          rollTo(scoreN, from, score, 600);
          comboN.textContent = streak >= 2 ? `${streak}× streak` : '';
          comboN.className = `cl-combo${streak >= 2 ? ' on' : ''}${streak >= 5 ? ' max' : ''}`;
          track?.you(i + 1);
          await new Promise(res => {
            const t = setTimeout(() => { nexter = null; res(); }, ok ? 1500 : 1900);
            nexter = () => { clearTimeout(t); nexter = null; res(); };
            arena.onclick = () => nexter?.();
          });
          arena.onclick = null;
          if (i < n - 1) await Promise.all([
            anim(cards.a.el, [{ opacity: 1 }, { opacity: 0, transform: 'translateY(24px) scale(.96)' }], { duration: 180, easing: 'ease-in', fill: 'forwards' }),
            anim(cards.b.el, [{ opacity: 1 }, { opacity: 0, transform: 'translateY(24px) scale(.96)' }], { duration: 180, easing: 'ease-in', fill: 'forwards' }),
          ]);
        }
        done = true;
        track?.stop();
        put(arena, h('div', { className: 'cl-tally' }, h('span', { className: 'cl-spin' }), 'Tallying…'));
        const res = await rpc('clashSubmitRun', { matchId: m.matchId, answers, ticket });
        if (!live()) return;
        results(m, res, answers);
      })();
    }, `${L.MODE[m.mode]?.label || 'Vs'} · ${L.DIFFICULTY[m.difficulty]?.label || ''}`);
  }

  // The big entrance: two slabs slide in, VS slams down with a flash and a shake.
  async function versusSplash(arena, m) {
    const me = S.status?.player || { name: 'You', id: 'me' };
    const leftRef = playerAvatarRef(me.id, S.snap?.characters);
    const rightName = m.ghost ? m.ghost.player.name : 'The Fandom';
    const rightRef = m.ghost ? playerAvatarRef(m.ghost.player.id, S.snap?.characters) : { type: 'c', id: 'fandom', name: 'Fandom' };
    const L1 = h('div', { className: 'cl-slab l' }, avatar(leftRef, 'cl-px xl'), h('b', {}, me.name), h('span', {}, 'You'));
    const R1 = h('div', { className: 'cl-slab r' }, avatar(rightRef, 'cl-px xl'), h('b', {}, rightName), h('span', {}, m.ghost ? `Ghost · ${fmt.format(m.ghost.score)} pts` : L.DIFFICULTY[m.difficulty].label));
    const V = h('div', { className: 'cl-splash-vs' }, 'VS');
    const flash = h('div', { className: 'cl-flash' });
    const sp = h('div', { className: 'cl-splash' }, L1, V, R1, flash);
    put(arena, sp);
    if (!motion()) { sfx('slam'); await wait(700); return; }
    sfx('whoosh');
    await Promise.all([
      anim(L1, [{ transform: 'translateX(-120%) skewX(-8deg)' }, { transform: 'translateX(0) skewX(-8deg)' }], { duration: 380, easing: 'cubic-bezier(.2,.9,.3,1)', fill: 'both' }),
      anim(R1, [{ transform: 'translateX(120%) skewX(-8deg)' }, { transform: 'translateX(0) skewX(-8deg)' }], { duration: 380, easing: 'cubic-bezier(.2,.9,.3,1)', fill: 'both' }),
    ]);
    sfx('slam');
    anim(flash, [{ opacity: 0.85 }, { opacity: 0 }], { duration: 380, easing: 'ease-out', fill: 'both' });
    anim(view, [{ transform: 'translate(0,0)' }, { transform: 'translate(-6px,4px)' }, { transform: 'translate(5px,-3px)' }, { transform: 'translate(-3px,2px)' }, { transform: 'none' }], { duration: 300 });
    await anim(V, [{ transform: 'scale(4) rotate(-12deg)', opacity: 0 }, { transform: 'scale(.9) rotate(-6deg)', opacity: 1, offset: 0.7 }, { transform: 'scale(1) rotate(-6deg)', opacity: 1 }], { duration: 380, easing: 'cubic-bezier(.5,0,.75,0)', fill: 'both' });
    await wait(650);
    await anim(sp, [{ opacity: 1 }, { opacity: 0, transform: 'scale(1.06)' }], { duration: 220, fill: 'forwards' });
  }

  // A big card for one side of a round. roll() reveals its count.
  function card(r, side) {
    const count = h('b', { className: 'cl-count' }, '???');
    const team = r.type === 'g';
    const el = h('button', { type: 'button', className: `cl-card is-${side}${team ? ' is-team' : ''}`, 'aria-label': `${r.name}${r.franchise ? `, ${r.franchise}` : ''}${r.type === 'f' ? ', franchise' : team ? ', combined' : ''}` },
      team ? h('span', { className: `cl-card-art cl-collage n${Math.min(4, r.members.length)}` }, r.members.slice(0, 4).map(m => picture(m, 'cl-card-img')))
        : h('span', { className: 'cl-card-art' }, picture(r, 'cl-card-img')),
      h('span', { className: 'cl-card-tag' }, r.type === 'f' ? `Franchise · ${r.members} characters` : team ? `Team of ${r.members.length} · combined` : 'Character'),
      team ? null : avatar(r, 'cl-px cl-card-px'),
      h('span', { className: 'cl-card-info' },
        team ? h('span', { className: 'cl-card-team' }, r.members.map(m => h('span', {}, avatar(m, 'cl-px sm'), m.name))) : h('span', { className: 'cl-card-name' }, r.name),
        r.type === 'c' && r.franchise ? h('span', { className: 'cl-card-fr' }, r.franchise) : null,
        h('span', { className: 'cl-card-count' }, count, h('small', {}, 'posts'))),
      h('kbd', { className: 'cl-kbd cl-card-key' }, side === 'a' ? '← A' : 'D →'));
    tilt(el);
    return { el, roll: () => rollTo(count, 0, r.total || 0, 900, true) };
  }

  // Ghost race: two lanes, the ghost's marker moves on its recorded timing and lights its picks live.
  function ghostTrack(m, n) {
    const g = m.ghost, me = S.status?.player || { id: 'me', name: 'You' };
    const lane = (who, ref, name) => {
      const marker = h('span', { className: `cl-marker ${who}` }, avatar(ref, 'cl-px sm'));
      const ticks = h('span', { className: 'cl-ticks' }, Array.from({ length: n }, () => h('i')));
      return { el: h('div', { className: `cl-lane ${who}` }, h('span', { className: 'cl-lane-n' }, name), h('span', { className: 'cl-lane-bar' }, ticks, marker)), marker, ticks };
    };
    const you = lane('you', playerAvatarRef(me.id, S.snap?.characters), 'You'), gh = lane('ghost', playerAvatarRef(g.player.id, S.snap?.characters), g.player.name);
    let raf = 0, t0 = 0, lit = 0;
    const ok = i => { const a = g.answers.find(x => x.round === i); return a ? L.isCorrect(m.rounds[i], a.pick) : false; };
    const frame = () => {
      const p = L.ghostProgress(g.answers, performance.now() - t0);
      gh.marker.style.left = `${(p / n) * 100}%`;
      while (lit < Math.floor(p) && lit < n) { gh.ticks.children[lit].className = ok(lit) ? 'ok' : 'miss'; lit++; }
      if (lit < n) raf = requestAnimationFrame(frame);
    };
    return {
      el: h('div', { className: 'cl-track', 'aria-label': `Race against ${g.player.name}` }, you.el, gh.el),
      start(t) { t0 = t; raf = requestAnimationFrame(frame); },
      stop() { cancelAnimationFrame(raf); },
      you(k) { you.marker.style.left = `${(k / n) * 100}%`; you.ticks.children[k - 1].className = 'mine'; },
      reveal(i, cards) { // after your pick: where the ghost went on this round
        const a = g.answers.find(x => x.round === i);
        if (!a) return;
        const b = h('span', { className: 'cl-ghostpick' }, avatar(playerAvatarRef(g.player.id, S.snap?.characters), 'cl-px sm'), `${g.player.name} picked this`);
        cards[a.pick].el.append(b);
        anim(b, [{ opacity: 0, transform: 'translateY(8px)' }, { opacity: 1, transform: 'none' }], { duration: 240 });
      },
    };
  }

  function results(m, res, answers) {
    show(async (el, live) => {
      S.back = hub;
      if (!res || res.error) {
        put(el, emptyBox('Could not save the run', res?.error || 'Something went wrong.'), h('div', { className: 'cl-row center' }, h('button', { type: 'button', className: 'cl-btn primary', onclick: hub }, 'Home')));
        return;
      }
      // A ghost race is judged against the ghost, not against your other runs: no personal best or PC rank there.
      const best = !m.ghost && res.score >= res.localBest && res.score > 0;
      const scoreN = h('b', { className: 'cl-big-score' }, '0');
      const medals = h('div', { className: 'cl-medals', 'aria-label': 'Winners of each round' }, m.rounds.map((r, i) => {
        const side = r[L.winnerOf(r)], w = side.type === 'g' ? { ...side.members[0], name: side.name, total: side.total } : side, ok = res.rounds?.[i]?.correct;
        return h('span', { className: `cl-medal${ok ? ' ok' : ''}`, title: `${w.name}: ${L.fmtCount(w.total)} posts${ok ? '' : ' (missed)'}` }, avatar(w, 'cl-px'));
      }));
      const rankLine = m.ghost ? '' : res.rank ? `#${fmt.format(res.rank)} ${m.mode === 'local' ? 'in your group' : 'worldwide'}` : res.localRank ? `Your #${res.localRank} run on this PC` : '';
      let ghostLine = null;
      if (res.ghost) {
        const g = res.ghost;
        ghostLine = h('p', { className: `cl-ghost-res ${g.outcome}` }, g.outcome === 'win' ? `You beat ${g.name}, ${fmt.format(res.score)} to ${fmt.format(g.score)}!`
          : g.outcome === 'push' ? `Dead heat with ${g.name}: ${fmt.format(g.score)} each.` : `${g.name} takes this one, ${fmt.format(g.score)} to ${fmt.format(res.score)}. Rematch any time.`);
      }
      const betLine = res.bet ? h('p', { className: 'cl-bet-res' }, coinIcon(), res.bet.outcome === 'win' ? `+${fmt.format(res.bet.payout)} coins (bet ${fmt.format(res.bet.stake)})`
        : res.bet.outcome === 'loss' ? `Bet of ${fmt.format(res.bet.stake)} coins lost` : `Bet of ${fmt.format(res.bet.stake)} coins refunded`) : null;
      const again = h('button', { type: 'button', className: 'cl-btn primary big', 'data-autofocus': '', onclick: () => (m.ghost ? ghostSelect() : setupVs(m.mode)) }, icon('refresh'), h('span', {}, m.ghost ? 'Another Ghost' : 'Play Again'));
      put(el, h('div', { className: 'cl-results' },
        h('p', { className: 'cl-eyebrow' }, best ? 'New personal best!' : 'Run complete'),
        scoreN,
        h('p', { className: 'cl-res-sub' }, `${res.correct} of ${res.total} right · best combo ${res.bestCombo}`, rankLine ? h('span', { className: 'cl-rank' }, rankLine) : null),
        ghostLine, betLine, medals,
        h('div', { className: 'cl-row center' }, again,
          h('button', { type: 'button', className: 'cl-btn big', onclick: () => boards(m.mode === 'ghost' ? 'ranked' : m.mode) }, icon('trophy'), h('span', {}, 'Leaderboard')),
          h('button', { type: 'button', className: 'cl-btn ghost big', onclick: hub }, h('span', {}, 'Home'))),
        !res.online && m.mode !== 'ghost' ? h('p', { className: 'cl-muted' }, 'Saved on this PC. Global boards return when the server is reachable.') : null));
      await rollTo(scoreN, 0, res.score, 1100, true);
      if (!live()) return;
      if (best || res.ghost?.outcome === 'win') { sfx('levelUp'); burst(scoreN, 36); } else sfx('coin');
      if (res.bet?.outcome === 'win') coinFlight(betLine, wallet);
      for (const [i, md] of [...medals.children].entries()) anim(md, [{ opacity: 0, transform: 'translateY(10px) scale(.6)' }, { opacity: 1, transform: 'none' }], { duration: 260, delay: i * 50, fill: 'both', easing: 'cubic-bezier(.2,.9,.25,1.3)' });
      S.onKey = e => (e.key === 'Enter' ? (again.click(), true) : false);
    }, 'Results');
  }

  // ---- Ghost select ----
  function ghostSelect() {
    show(async (el, live) => {
      const err = await ensureData();
      if (!live()) return;
      if (err) return put(el, emptyBox('No data yet', err));
      S.back = hub;
      let stake = 0;
      const listBox = h('div', { className: 'cl-ghosts' }, h('p', { className: 'cl-muted' }, 'Loading ghosts…'));
      const idIn = h('input', { type: 'text', className: 'cl-in mono', placeholder: 'Player id', maxLength: 64, 'aria-label': 'Player id to race', spellcheck: false });
      const stakeBox = h('div', { className: 'cl-field' });
      const load = async (pid) => {
        put(listBox, h('p', { className: 'cl-muted' }, 'Loading ghosts…'));
        const r = pid ? await rpc('clashGhosts', { player: pid, mode: 'ranked' }) : await rpc('clashTopGhosts', { mode: 'ranked', difficulty: S.difficulty });
        if (!live()) return;
        const sections = [];
        const tiles = list => h('div', { className: 'cl-glist' }, list.map(g => h('button', { type: 'button', className: 'cl-ghost', onclick: () => race(g) },
          avatar(playerAvatarRef(g.player.id, S.snap.characters), 'cl-px'),
          h('span', { className: 'cl-ghost-n' }, h('b', {}, g.player.name), h('small', {}, g.lazy ? `#${g.rank} on ${L.DIFFICULTY[g.difficulty]?.label || ''}` : `${L.DIFFICULTY[g.difficulty]?.label || ''} · ${g.rounds} picks in ${secs(g.ms)}${g.local ? ' · this PC' : ''}`)),
          h('span', { className: 'cl-grow' }), g.score != null ? h('b', { className: 'cl-ghost-s' }, fmt.format(g.score)) : null, icon('chevR'))));
        if (r?.error) sections.push(emptyBox('Could not load ghosts', r.error));
        if (pid) sections.push(r?.ghosts?.length ? tiles(r.ghosts) : h('p', { className: 'cl-muted' }, r?.offline ? 'Finding other players needs the server, which is not reachable right now.' : 'No ghosts for that player yet.'));
        else {
          if (r?.ghosts?.length) sections.push(h('span', { className: 'cl-label' }, 'Top rankers'), tiles(r.ghosts));
          else if (r?.source !== 'server') sections.push(h('p', { className: 'cl-muted' }, 'Offline: race your own best runs. Top rankers appear when the server is reachable.'));
          if (r?.mine?.length) sections.push(h('span', { className: 'cl-label' }, 'Your runs'), tiles(r.mine));
          if (!r?.ghosts?.length && !r?.mine?.length) sections.push(h('p', { className: 'cl-muted' }, `No ghosts on ${L.DIFFICULTY[S.difficulty].label} yet. Play a Ranked run and it becomes one.`));
        }
        put(listBox, sections);
      };
      const race = async g => {
        if (g.lazy) { // a top ranker: fetch their best run on this board first
          const r = await rpc('clashGhosts', { player: g.player.id, mode: 'ranked', difficulty: g.difficulty });
          const got = r?.ghosts?.[0];
          if (!got) { sfx('error'); return toast({ title: `No ghost for ${g.player.name} yet`, body: r?.error || 'Try another ranker.' }); }
          g = got;
        }
        let ticket = null;
        if (stake > 0) {
          const b = await shell.placeBet(stake, { game: 'clash-ghost' }).catch(() => null);
          if (!b?.ok) { sfx('error'); return toast({ title: BET_REASONS[b?.reason] || 'Could not place the bet.', kind: 'error' }); }
          ticket = b.ticket; sfx('spend');
        }
        const m = await rpc('clashMatch', { mode: 'ghost', ghost: g.id, difficulty: g.difficulty });
        if (m?.error) { if (ticket) shell.settleBet(ticket, 'cancel'); sfx('error'); return toast({ title: 'Could not start', body: m.error, kind: 'error' }); }
        runVs(m, { ticket });
      };
      await refreshLimits();
      put(stakeBox, h('span', { className: 'cl-label' }, `Optional bet: beat the ghost for ×${L.BET.ghostMultiplier}`), stakePicker(S.limits, v => { stake = v; }));
      put(el, h('div', { className: 'cl-setup wide' },
        h('div', { className: 'cl-setup-head' }, h('h2', {}, 'Ghost Battle'), h('p', {}, 'Replay someone\'s recorded run: same match-ups, their picks and timing racing beside you. Their marker moves on their own clock; yours moves when you pick. No rush.')),
        h('div', { className: 'cl-field' }, h('span', { className: 'cl-label' }, 'Difficulty'), diffPicker(d => { S.difficulty = d; writePref('difficulty', d); load(); })),
        h('div', { className: 'cl-grow-row' }, idIn, h('button', { type: 'button', className: 'cl-btn', onclick: () => load(idIn.value.trim()) }, icon('search'), h('span', {}, 'Find')),
          h('button', { type: 'button', className: 'cl-btn ghost', onclick: () => { idIn.value = ''; load(); } }, h('span', {}, 'Top'))),
        stakeBox, listBox));
      idIn.addEventListener('keydown', e => { if (e.key === 'Enter') load(idIn.value.trim()); });
      load();
    }, 'Ghost Battle');
  }

  // ---- Percentage Vs ----
  function percentHub() {
    show(async (el, live) => {
      const err = await ensureData();
      if (!live()) return;
      if (err) return put(el, emptyBox('No data yet', err));
      S.back = hub;
      const opt = (title, blurb, ic, fn, af) => h('button', { type: 'button', className: 'cl-mode is-percent', 'data-autofocus': af ? '' : null, onclick: () => { sfx('tap'); fn(); } },
        h('span', { className: 'cl-mode-ic' }, icon(ic)), h('span', { className: 'cl-mode-t' }, title), h('span', { className: 'cl-mode-b' }, blurb));
      put(el, h('div', { className: 'cl-setup wide' },
        h('div', { className: 'cl-setup-head' }, h('h2', {}, 'Percentage Vs'), h('p', {}, 'Slide your guess of how the posts split, then (if you like) bet a few coins on it. Bets are optional and capped at 25% of your coins.')),
        h('div', { className: 'cl-field' }, h('span', { className: 'cl-label' }, 'Difficulty'), diffPicker(d => { S.difficulty = d; writePref('difficulty', d); })),
        h('div', { className: 'cl-modes three' },
          opt('Group vs Group', 'Two or three contestants a side, characters or whole series. Which team has more?', 'stars', () => percentForced('groups'), true),
          opt('Franchise vs Franchise', 'Two whole series, head to head.', 'tv', () => percentForced('franchises')),
          opt('1 vs Many', 'Pick a champion, then choose who they face. More opponents, bigger payout.', 'target', () => pickChampion()))));
    }, 'Percentage Vs');
  }

  function percentForced(kind) {
    show(async (el, live) => {
      S.back = percentHub;
      put(el, h('div', { className: 'cl-tally' }, h('span', { className: 'cl-spin' }), 'Finding a match-up…'));
      const [m] = await Promise.all([rpc('clashPercentage', { kind, difficulty: S.difficulty }), refreshLimits()]);
      if (!live()) return;
      if (m?.error) return put(el, emptyBox('No match-up', m.error));
      let guess = 50, stake = 0, locked = false;
      const colA = groupCol(m.a, 'a'), colB = groupCol(m.b, 'b');
      const split = splitBar(v => { guess = v; lock.disabled = v === 50; }, { a: kind === 'franchises' ? m.a[0].name : 'Side A', b: kind === 'franchises' ? m.b[0].name : 'Side B' });
      const lock = h('button', { type: 'button', className: 'cl-btn primary big', disabled: true }, icon('lock'), h('span', {}, 'Lock In'), h('kbd', { className: 'cl-kbd' }, 'Enter'));
      const out = h('div', { className: 'cl-outcome', role: 'status' });
      lock.onclick = async () => {
        if (locked || guess === 50) return;
        locked = true; lock.disabled = true; split.lock();
        let ticket = null;
        if (stake > 0) {
          const b = await shell.placeBet(stake, { game: 'clash-percent' }).catch(() => null);
          if (!b?.ok) { locked = false; lock.disabled = false; split.unlock(); sfx('error'); return toast({ title: BET_REASONS[b?.reason] || 'Could not place the bet.', kind: 'error' }); }
          ticket = b.ticket; sfx('spend');
        }
        const res = await rpc('clashResolvePercent', { matchId: m.matchId, guess, ticket });
        if (!live()) return;
        if (res?.error) return put(out, emptyBox('Could not settle', res.error));
        await Promise.all([split.reveal(res.actual), colA.reveal(), colB.reveal()]);
        showOutcome(out, res, `Actual split ${pct(res.actual)} / ${100 - Math.round(Number(res.actual) || 0)}% · you said ${pct(guess)}`);
        put(again, h('button', { type: 'button', className: 'cl-btn primary big', 'data-autofocus': '', onclick: () => percentForced(kind) }, icon('refresh'), h('span', {}, 'Another Match-up')),
          h('button', { type: 'button', className: 'cl-btn ghost big', onclick: percentHub }, h('span', {}, 'Back')));
        again.querySelector('button')?.focus();
        S.onKey = e => (e.key === 'Enter' ? (percentForced(kind), true) : false);
      };
      const again = h('div', { className: 'cl-row center' });
      put(el, h('div', { className: 'cl-pct' },
        h('p', { className: 'cl-prompt' }, 'How do the ', h('em', {}, 'posts'), ' split?'),
        h('div', { className: 'cl-pct-sides' }, colA.el, h('div', { className: 'cl-vs' }, h('span', {}, 'VS')), colB.el),
        split.el,
        h('div', { className: 'cl-field center' }, h('span', { className: 'cl-label' }, 'Bet (optional): right side ×1.8, within 10% ×2.1, within 3% ×2.4'), stakePicker(S.limits, v => { stake = v; })),
        h('div', { className: 'cl-row center' }, lock), out, again));
      split.focus();
      S.onKey = e => {
        if (e.key === 'Enter' && !locked) { lock.click(); return true; }
        return split.key(e);
      };
    }, kind === 'franchises' ? 'Franchise vs Franchise' : 'Group vs Group');
  }

  function pickChampion() {
    show(async (el, live) => {
      S.back = percentHub;
      const chars = S.snap?.characters || [];
      const q = h('input', { type: 'search', className: 'cl-in', placeholder: 'Search characters or series…', 'aria-label': 'Search characters', 'data-autofocus': '' });
      const grid = h('div', { className: 'cl-pickgrid' });
      const sample = [...chars].sort(() => Math.random() - 0.5).slice(0, 24);
      const draw = () => {
        const t = q.value.trim().toLowerCase();
        const list = t ? chars.filter(c => c.name.toLowerCase().includes(t) || (c.franchise || '').toLowerCase().includes(t)).slice(0, 48) : sample;
        put(grid, list.length ? list.map(c => h('button', { type: 'button', className: 'cl-pick', onclick: () => { sfx('tap'); pickOpponents(c); } },
          avatar(c, 'cl-px'), h('b', {}, c.name), h('small', {}, c.franchise || ''))) : h('p', { className: 'cl-muted' }, 'Nobody by that name in this snapshot.'));
      };
      q.addEventListener('input', draw);
      draw();
      put(el, h('div', { className: 'cl-setup wide' },
        h('div', { className: 'cl-setup-head' }, h('h2', {}, 'Choose your champion'), h('p', {}, 'Then pick who they face. They win if their posts beat everyone you picked, combined.')),
        h('div', { className: 'cl-grow-row' }, q, h('button', { type: 'button', className: 'cl-btn', onclick: () => pickOpponents(chars[Math.floor(Math.random() * chars.length)]) }, icon('sparkles'), h('span', {}, 'Surprise Me'))),
        grid));
    }, '1 vs Many');
  }

  function pickOpponents(champ) {
    if (!champ) return;
    show(async (el, live) => {
      S.back = pickChampion;
      put(el, h('div', { className: 'cl-tally' }, h('span', { className: 'cl-spin' }), 'Lining up challengers…'));
      const [m] = await Promise.all([rpc('clashOpponents', { champion: { type: 'c', id: champ.id }, difficulty: S.difficulty }), refreshLimits()]);
      if (!live()) return;
      if (m?.error) return put(el, emptyBox('No challengers', m.error));
      const chosen = new Set();
      let stake = 0, locked = false;
      const multEl = h('b', { className: 'cl-mult' }, '×0');
      const champCard = card(m.champion, 'a');
      champCard.el.disabled = true;
      const tiles = m.pool.map(o => {
        const count = h('b', { className: 'cl-count sm' }, '???');
        const t = h('button', { type: 'button', className: 'cl-opp', 'aria-pressed': 'false' }, avatar(o, 'cl-px'), h('span', { className: 'cl-opp-n' }, h('b', {}, o.name), h('small', {}, o.franchise || '')), count);
        t.onclick = () => {
          if (locked) return;
          if (chosen.has(o.id)) chosen.delete(o.id); else if (chosen.size < m.maxOpponents) chosen.add(o.id); else { sfx('error'); return; }
          t.setAttribute('aria-pressed', String(chosen.has(o.id)));
          sfx('tap'); sync();
        };
        return { o, t, roll: () => rollTo(count, 0, o.total, 800, true) };
      });
      const lock = h('button', { type: 'button', className: 'cl-btn primary big', disabled: true }, icon('lock'), h('span', {}, 'Lock In'));
      const sync = () => {
        const k = chosen.size;
        multEl.textContent = k ? `×${L.pickMultiplier(k)}` : '×0';
        lock.disabled = !k;
        summary.textContent = k ? `${champ.name} vs ${k} challenger${k > 1 ? 's' : ''} combined` : `Pick 1 to ${m.maxOpponents} challengers`;
      };
      const summary = h('span', {});
      const bar = splitBar(null, { a: m.champion.name, b: 'Challengers' }, true);
      const out = h('div', { className: 'cl-outcome', role: 'status' });
      const again = h('div', { className: 'cl-row center' });
      lock.onclick = async () => {
        if (locked || !chosen.size) return;
        locked = true; lock.disabled = true;
        let ticket = null;
        if (stake > 0) {
          const b = await shell.placeBet(stake, { game: 'clash-pick' }).catch(() => null);
          if (!b?.ok) { locked = false; lock.disabled = false; sfx('error'); return toast({ title: BET_REASONS[b?.reason] || 'Could not place the bet.', kind: 'error' }); }
          ticket = b.ticket; sfx('spend');
        }
        const res = await rpc('clashResolvePick', { matchId: m.matchId, opponents: [...chosen], ticket });
        if (!live()) return;
        if (res?.error) { locked = false; return toast({ title: res.error, kind: 'error' }); }
        bar.el.hidden = false;
        await Promise.all([champCard.roll(), ...tiles.filter(x => chosen.has(x.o.id)).map(x => x.roll()), bar.reveal(res.actual)]);
        for (const x of tiles) if (!chosen.has(x.o.id)) x.t.classList.add('is-out');
        showOutcome(out, res, `${m.champion.name} has ${pct(res.actual)} of the posts in this fight`);
        put(again, h('button', { type: 'button', className: 'cl-btn primary big', onclick: () => pickOpponents(champ) }, icon('refresh'), h('span', {}, 'Rematch')),
          h('button', { type: 'button', className: 'cl-btn big', onclick: pickChampion }, h('span', {}, 'New Champion')));
      };
      sync();
      put(el, h('div', { className: 'cl-pick-layout' },
        h('div', { className: 'cl-pick-champ' }, champCard.el),
        h('div', { className: 'cl-pick-side' },
          h('div', { className: 'cl-setup-head' }, h('h2', {}, 'Who do they face?'), h('p', {}, 'Challengers of similar popularity. Each one you add raises the payout and the odds against your champion.')),
          h('div', { className: 'cl-opps' }, tiles.map(x => x.t)),
          h('p', { className: 'cl-pick-sum' }, summary, multEl),
          h('div', { className: 'cl-field' }, h('span', { className: 'cl-label' }, 'Bet (optional)'), stakePicker(S.limits, v => { stake = v; })),
          h('div', { className: 'cl-row' }, lock), bar.el, out, again)));
      bar.el.hidden = true;
    }, '1 vs Many');
  }

  function showOutcome(out, res, detail) {
    const won = res.outcome === 'win', push = res.outcome === 'push';
    const b = res.bet;
    put(out, h('div', { className: `cl-banner ${res.outcome}` },
      h('b', {}, won ? L.lineFor(true, Math.floor(Math.random() * 6)) : push ? 'Too close to call!' : L.lineFor(false, Math.floor(Math.random() * 6))),
      h('span', {}, detail),
      b ? h('span', { className: 'cl-bet-res' }, coinIcon(), b.outcome === 'win' ? `+${fmt.format(b.payout)} coins (×${res.multiplier})` : b.outcome === 'push' ? `${fmt.format(b.stake)} coins refunded` : `${fmt.format(b.stake)} coins lost. Easy come, easy go.`) : null));
    anim(out.firstChild, [{ opacity: 0, transform: 'scale(.8)' }, { opacity: 1, transform: 'scale(1.04)' }, { transform: 'none' }], { duration: 380, easing: 'cubic-bezier(.2,.9,.25,1.3)' });
    if (won) { sfx(b ? 'coin' : 'right'); burst(out.firstChild, 28); if (b) coinFlight(out.firstChild, wallet); } else sfx(push ? 'tap' : 'miss');
  }

  // A column of one group (Percentage Vs) with a hidden total that rolls up on reveal().
  function groupCol(list, side) {
    const total = h('b', { className: 'cl-count' }, '???');
    const big = list.length === 1;
    const el = h('div', { className: `cl-gcol is-${side}${big ? ' big' : ''}` },
      big ? h('span', { className: 'cl-card-art' }, picture(list[0], 'cl-card-img')) : null,
      h('div', { className: 'cl-gmembers' }, list.map(r => h('div', { className: 'cl-gmember' }, avatar(r, 'cl-px'), h('span', {}, h('b', {}, r.name), h('small', {}, r.type === 'f' ? `${r.members} characters` : r.franchise || ''))))),
      h('div', { className: 'cl-gtotal' }, total, h('small', {}, 'posts')));
    return { el, reveal: () => rollTo(total, 0, L.groupTotal(list), 1000, true) };
  }

  // The interactive split slider: drag, click or arrow keys set your guess of A's share.
  function splitBar(onChange, labels, readonly = false) {
    let v = 50, locked = readonly;
    const fill = h('span', { className: 'cl-split-a' }), knob = h('span', { className: 'cl-split-knob' });
    const truth = h('span', { className: 'cl-split-truth', hidden: true }, h('span', {}, 'Actual'));
    const la = h('b', {}, '50%'), lb = h('b', {}, '50%');
    const track = h('div', { className: 'cl-split-track', role: readonly ? 'img' : 'slider', tabindex: readonly ? null : '0', 'aria-label': `Your guess of ${labels.a}'s share`,
      'aria-valuemin': '0', 'aria-valuemax': '100', 'aria-valuenow': '50' }, fill, h('span', { className: 'cl-split-mid' }), readonly ? null : knob, truth);
    const el = h('div', { className: `cl-split${readonly ? ' ro' : ''}` },
      h('div', { className: 'cl-split-labels' }, h('span', { className: 'a' }, labels.a, ' ', la), h('span', { className: 'b' }, lb, ' ', labels.b)), track,
      readonly ? null : h('p', { className: 'cl-hint' }, 'Drag, or use ', h('kbd', { className: 'cl-kbd' }, '←'), h('kbd', { className: 'cl-kbd' }, '→'), ' (Shift for 5). Slide toward the side you think is bigger.'));
    const set = (n, quiet) => {
      v = Math.round(L.clamp(n, 0, 100));
      fill.style.width = `${v}%`; knob.style.left = `${v}%`;
      la.textContent = `${v}%`; lb.textContent = `${100 - v}%`;
      track.setAttribute('aria-valuenow', String(v));
      track.setAttribute('aria-valuetext', `${labels.a} ${v}%, ${labels.b} ${100 - v}%`);
      el.classList.toggle('lean-a', v > 50); el.classList.toggle('lean-b', v < 50);
      if (!quiet) { onChange?.(v); sfx('tick'); }
    };
    if (!readonly) {
      const fromX = x => { const r = track.getBoundingClientRect(); return ((x - r.left) / r.width) * 100; };
      track.addEventListener('pointerdown', e => { if (locked) return; track.setPointerCapture(e.pointerId); set(fromX(e.clientX)); });
      track.addEventListener('pointermove', e => { if (!locked && track.hasPointerCapture(e.pointerId)) set(fromX(e.clientX)); });
    }
    set(50, true);
    return {
      el,
      focus: () => track.focus({ preventScroll: true }),
      lock() { locked = true; el.classList.add('locked'); },
      unlock() { locked = false; el.classList.remove('locked'); },
      key(e) {
        if (locked) return false;
        const step = e.shiftKey ? 5 : 1;
        const d = { ArrowLeft: -step, ArrowDown: -step, ArrowRight: step, ArrowUp: step }[e.key];
        if (d != null) { set(v + d); return true; } // the bar fills from A's side (left): right means more for A
        if (e.key === 'Home') { set(0); return true; }
        if (e.key === 'End') { set(100); return true; }
        return false;
      },
      async reveal(actual) {
        truth.hidden = false;
        if (readonly) { set(actual, true); }
        const t0 = performance.now(), dur = motion() ? 1100 : 0;
        await new Promise(res => {
          const step = () => {
            const t = dur ? Math.min(1, (performance.now() - t0) / dur) : 1;
            const x = 50 + (actual - 50) * (1 - Math.pow(1 - t, 3));
            truth.style.left = `${x}%`;
            if (readonly) { fill.style.width = `${x}%`; la.textContent = `${Math.round(x)}%`; lb.textContent = `${100 - Math.round(x)}%`; }
            if (t < 1) { sfx('tick'); nextFrame(step); } else res();
          };
          step();
        });
      },
    };
  }

  // ---- Leaderboards ----
  function boards(mode = 'ranked') {
    show(async (el, live) => {
      const err = await ensureData();
      if (!live()) return;
      if (err) return put(el, emptyBox('No data yet', err));
      S.back = hub;
      const groups = (await rpc('clashGroups')) || [];
      if (!live()) return;
      let diff = S.difficulty, grp = S.group && groups.some(g => g.code === S.group) ? S.group : groups[0]?.code || null;
      const list = h('ol', { className: 'cl-board' });
      const src = h('span', { className: 'cl-meta' });
      const modeSeg = seg([['ranked', 'Global'], ['local', 'Group']], mode, v => { mode = v; draw(); grpSel.hidden = mode !== 'local'; });
      const grpSel = h('select', { className: 'cl-in', hidden: mode !== 'local', 'aria-label': 'Group', onchange: () => { grp = grpSel.value; draw(); } },
        groups.length ? groups.map(g => h('option', { value: g.code, selected: g.code === grp }, `${g.name} (${g.code})`)) : h('option', { value: '' }, 'No groups yet'));
      const draw = async () => {
        put(list, h('li', { className: 'cl-muted' }, 'Loading…'));
        const r = await rpc('clashLeaderboard', { mode, difficulty: diff, group: mode === 'local' ? grp : undefined, limit: 50 });
        if (!live()) return;
        src.textContent = r?.source === 'server' ? 'Live board' : 'This PC only (offline)';
        if (r?.error) return put(list, h('li', {}, emptyBox('Could not load the board', r.error)));
        if (r?.needGroup) return put(list, h('li', { className: 'cl-muted' }, 'Make or join a group in Local Ranking to see its board.'));
        const rows = r?.entries || [];
        if (!rows.length) return put(list, h('li', { className: 'cl-muted' }, 'No scores here yet. Yours could be the first!'));
        put(list, rows.map((e, i) => {
          const you = e.player.id === r.you;
          const row = h('li', { className: `cl-brow${you ? ' you' : ''}${e.rank <= 3 ? ` top${e.rank}` : ''}` },
            h('span', { className: 'cl-brank' }, e.rank <= 3 ? h('span', { className: `cl-medal-px m${e.rank}`, 'aria-label': `Rank ${e.rank}` }, String(e.rank)) : `#${e.rank}`),
            avatar(playerAvatarRef(e.player.id, S.snap.characters, e.avatar), 'cl-px'),
            h('span', { className: 'cl-bname' }, e.player.name, you ? h('span', { className: 'sc-tag on' }, 'You') : null),
            h('b', { className: 'cl-bscore' }, fmt.format(e.score)));
          anim(row, [{ opacity: 0, transform: 'translateX(-12px)' }, { opacity: 1, transform: 'none' }], { duration: 220, delay: Math.min(i, 15) * 25, fill: 'both' });
          return row;
        }));
      };
      put(el, h('div', { className: 'cl-setup wide' },
        h('div', { className: 'cl-setup-head' }, h('h2', {}, 'Leaderboards'), h('p', {}, 'Good-faith boards, just for fun. Every run counts; your best stays put.')),
        h('div', { className: 'cl-row' }, modeSeg, grpSel, h('span', { className: 'cl-grow' }), src),
        diffPicker(d => { diff = d; draw(); }, diff),
        list));
      draw();
    }, 'Leaderboards');
  }

  // ---- Small parts ----
  function diffPicker(onChange, value = S.difficulty) {
    const btns = L.DIFFICULTIES.map((d, i) => h('button', { type: 'button', role: 'radio', className: `cl-diff d-${d}`, 'aria-checked': String(d === value),
      onclick: () => { value = d; for (const b of btns) b.setAttribute('aria-checked', String(b.dataset.d === d)); sfx('tap'); onChange(d); }, 'data-d': d },
      h('span', { className: 'cl-diff-pips', 'aria-hidden': 'true' }, Array.from({ length: 4 }, (_, k) => h('i', { className: k <= i ? 'on' : '' }))),
      h('b', {}, L.DIFFICULTY[d].label), h('small', {}, L.DIFFICULTY[d].blurb)));
    return h('div', { className: 'cl-diffs', role: 'radiogroup', 'aria-label': 'Difficulty' }, btns);
  }
  function seg(opts, value, onChange) {
    const btns = opts.map(([v, label]) => h('button', { type: 'button', role: 'radio', className: 'cl-seg-b', 'aria-checked': String(v === value), 'data-v': v,
      onclick: () => { for (const b of btns) b.setAttribute('aria-checked', String(b.dataset.v === v)); onChange(v); } }, label));
    return h('div', { className: 'cl-seg', role: 'radiogroup' }, btns);
  }
  function stakePicker(limits, onChange) {
    const max = Math.max(0, limits?.max || 0);
    if (max < 1) { onChange(0); return h('p', { className: 'cl-muted' }, 'Playing for fun. Bets unlock with a few more coins (up to 25% of your balance).'); }
    const opts = [0, ...[10, 25, 50, 100, 250].filter(n => n < max), max];
    let cur = 0;
    const btns = opts.map(n => h('button', { type: 'button', role: 'radio', className: 'cl-stake', 'aria-checked': String(n === 0), 'data-n': String(n),
      onclick: () => { cur = n; for (const b of btns) b.setAttribute('aria-checked', String(Number(b.dataset.n) === n)); sfx(n ? 'coin' : 'tap'); onChange(n); } },
      n ? [coinIcon(), h('span', {}, n === max ? `${fmt.format(n)} max` : fmt.format(n))] : h('span', {}, 'No bet')));
    onChange(cur);
    return h('div', { className: 'cl-stakes', role: 'radiogroup', 'aria-label': 'Bet' }, btns);
  }

  function update(st) {
    if (!st) return;
    const to = st.coins || 0, from = Number(walletN.dataset.v ?? to);
    walletN.dataset.v = String(to);
    if (from !== to) { rollTo(walletN, from, to, 600); anim(wallet, [{ transform: 'scale(1)' }, { transform: 'scale(1.12)' }, { transform: 'scale(1)' }], { duration: 300 }); }
  }
  walletN.dataset.v = String(app.state?.coins || 0);

  function go(mode) { if (S.leave) return; if (mode && L.MODES.includes(mode)) openMode(mode); }
  ensureData().then(() => { if (opts.mode && L.MODES.includes(opts.mode)) openMode(opts.mode); else hub(); });
  return { go, update, close };
}

// ---- Shared presentation helpers ----

/** The entity's SFW picture (kclash://img/... only) or its big pixel placeholder. */
function picture(r, cls) {
  const url = imageUrl(r);
  const ph = h('img', { className: `${cls} is-ph`, src: placeholderUrl(r), alt: '', draggable: false });
  if (!url) return ph;
  const img = h('img', { className: cls, src: url, alt: '', draggable: false, decoding: 'async', crossOrigin: 'anonymous', referrerPolicy: 'no-referrer' });
  img.addEventListener('error', () => img.replaceWith(ph), { once: true });
  return img;
}

/** Rolls a number element from `from` to `to` (ease-out), ticking as it goes. */
function rollTo(el, from, to, dur = 800, tick = false) {
  if (!motion() || dur <= 0 || from === to) { el.textContent = L.fmtCount(to); return Promise.resolve(); }
  const t0 = performance.now();
  return new Promise(res => {
    const step = () => {
      const t = Math.min(1, (performance.now() - t0) / dur);
      el.textContent = L.fmtCount(L.rollValue(from, to, t));
      if (tick) sfx('tick');
      if (t < 1) nextFrame(step); else res();
    };
    step();
  });
}

/** Pixel confetti from an element. */
function burst(el, n = 18) {
  if (!motion() || !el?.getBoundingClientRect) return;
  const r = el.getBoundingClientRect(), x = r.left + r.width / 2, y = r.top + r.height / 3;
  const COLORS = ['#ff6ad5', '#7af0ff', '#ffd166', '#6ee7a8', '#c58cff', '#ffffff'];
  for (let i = 0; i < n; i++) {
    const s = document.createElement('span');
    s.className = 'cl-spark';
    s.style.background = COLORS[i % COLORS.length];
    const size = 4 + (i % 3) * 2;
    s.style.width = s.style.height = `${size}px`;
    document.body.append(s);
    const ang = (Math.PI * 2 * i) / n + Math.random() * 0.5, dist = 70 + Math.random() * 120;
    const dx = Math.cos(ang) * dist, dy = Math.sin(ang) * dist - 40;
    s.animate([
      { transform: `translate(${x}px, ${y}px) scale(1)`, opacity: 1 },
      { transform: `translate(${x + dx}px, ${y + dy}px) scale(1) rotate(${dx > 0 ? 90 : -90}deg)`, opacity: 1, offset: 0.6 },
      { transform: `translate(${x + dx * 1.15}px, ${y + dy + 80}px) scale(.4)`, opacity: 0 },
    ], { duration: 800 + Math.random() * 400, easing: 'cubic-bezier(.2,.7,.4,1)' }).finished.catch(() => {}).then(() => s.remove());
  }
}

function floatText(el, text, cls, delay = 0) {
  const f = h('span', { className: `cl-float ${cls}` }, text);
  el.append(f);
  const done = () => f.remove();
  if (!motion()) { setTimeout(done, 1200); return; }
  f.animate([{ opacity: 0, transform: 'translate(-50%, 10px) scale(.7)' }, { opacity: 1, transform: 'translate(-50%, -14px) scale(1.1)', offset: 0.25 }, { opacity: 1, transform: 'translate(-50%, -30px) scale(1)', offset: 0.75 }, { opacity: 0, transform: 'translate(-50%, -46px) scale(.95)' }],
    { duration: 1300, delay, easing: 'ease-out', fill: 'both' }).finished.catch(() => {}).then(done);
}

/** Cards lean toward the pointer a little. */
function tilt(el) {
  if (!motion()) return;
  el.addEventListener('pointermove', e => {
    const r = el.getBoundingClientRect();
    el.style.setProperty('--ry', `${((e.clientX - r.left) / r.width - 0.5) * 8}deg`);
    el.style.setProperty('--rx', `${(0.5 - (e.clientY - r.top) / r.height) * 6}deg`);
  });
  el.addEventListener('pointerleave', () => { el.style.removeProperty('--rx'); el.style.removeProperty('--ry'); });
}

function confirmBox(root, title, body, stay, leave) {
  return new Promise(res => {
    const done = v => { box.remove(); res(v); };
    const leaveBtn = h('button', { type: 'button', className: 'cl-btn', onclick: () => done(true) }, leave);
    const stayBtn = h('button', { type: 'button', className: 'cl-btn primary', onclick: () => done(false) }, stay);
    const box = h('div', { className: 'cl-confirm', role: 'alertdialog', 'aria-label': title },
      h('div', { className: 'cl-confirm-card' }, h('b', {}, title), h('p', {}, body), h('div', { className: 'cl-row center' }, stayBtn, leaveBtn)));
    root.append(box);
    stayBtn.focus();
  });
}

const emptyBox = (title, body) => h('div', { className: 'sc-empty cl-empty' }, icon('info'), h('b', {}, title), h('p', {}, body));
const pct = n => `${Math.round(Number(n) || 0)}%`;
const secs = ms => `${Math.max(1, Math.round((Number(ms) || 0) / 1000))}s`;
const dateOf = iso => { const d = new Date(iso); return Number.isNaN(+d) ? 'unknown' : d.toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' }); };
function readPref(k, d) { try { const v = JSON.parse(localStorage.getItem('kayboro.clash') || '{}')[k]; return v ?? d; } catch { return d; } }
function writePref(k, v) { try { const o = JSON.parse(localStorage.getItem('kayboro.clash') || '{}'); o[k] = v; localStorage.setItem('kayboro.clash', JSON.stringify(o)); } catch {} }

// The backdrop: a low-res synthwave grid rolling toward a pink horizon, pixel stars above. Drawn at a
// third of the window size and scaled up with crisp pixels. Static under reduced motion; pauses when hidden.
function backdrop(cv, dims = () => [innerWidth, innerHeight]) {
  const ctx = cv.getContext('2d');
  const stars = Array.from({ length: 90 }, () => ({ x: Math.random(), y: Math.random() * 0.6, s: Math.random() < 0.15 ? 2 : 1, p: Math.random() * 6.28 }));
  let raf = 0, w = 0, hgt = 0, stopped = false;
  const size = () => { const [dw, dh] = dims(); w = cv.width = Math.max(160, Math.round(dw / 3)); hgt = cv.height = Math.max(100, Math.round(dh / 3)); };
  size();
  addEventListener('resize', size);
  const draw = t => {
    const hz = Math.round(hgt * 0.58);
    const sky = ctx.createLinearGradient(0, 0, 0, hz);
    sky.addColorStop(0, '#0a0812'); sky.addColorStop(0.7, '#1b1033'); sky.addColorStop(1, '#3a1546');
    ctx.fillStyle = sky; ctx.fillRect(0, 0, w, hz);
    const ground = ctx.createLinearGradient(0, hz, 0, hgt);
    ground.addColorStop(0, '#1a0c26'); ground.addColorStop(1, '#07060c');
    ctx.fillStyle = ground; ctx.fillRect(0, hz, w, hgt - hz);
    for (const s of stars) { // twinkle
      const a = 0.35 + 0.65 * Math.abs(Math.sin(s.p + t / 900));
      ctx.fillStyle = `rgba(238,233,255,${a.toFixed(2)})`;
      ctx.fillRect(Math.round(s.x * w), Math.round(s.y * hz), s.s, s.s);
    }
    const sunR = Math.round(hgt * 0.16), cx = Math.round(w / 2); // striped sun
    for (let y = -sunR; y < 0; y++) {
      if ((y + sunR) % 6 > 3 && y > -sunR * 0.55) continue;
      const half = Math.round(Math.sqrt(sunR * sunR - y * y));
      ctx.fillStyle = y < -sunR * 0.5 ? '#ffd166' : '#ff6ad5';
      ctx.fillRect(cx - half, hz + y, half * 2, 1);
    }
    ctx.fillStyle = 'rgba(255,106,213,.55)'; // horizon line
    ctx.fillRect(0, hz, w, 1);
    const off = (t / 1400) % 1; // horizontal grid lines, rolling forward
    ctx.fillStyle = 'rgba(255,106,213,.35)';
    for (let i = 0; i < 14; i++) {
      const z = (i + off) / 14;
      const y = Math.round(hz + (hgt - hz) * z * z);
      ctx.fillRect(0, y, w, 1);
    }
    ctx.strokeStyle = 'rgba(122,240,255,.22)'; // converging verticals
    ctx.lineWidth = 1;
    ctx.beginPath();
    for (let i = -12; i <= 12; i++) { ctx.moveTo(cx + i * 3, hz); ctx.lineTo(cx + i * w * 0.12, hgt); }
    ctx.stroke();
  };
  const loop = t => {
    if (stopped) return;
    if (!document.hidden) draw(t);
    raf = requestAnimationFrame(loop);
  };
  draw(0); // a first frame right away (rAF does not run while the window is hidden or occluded)
  if (!reducedMotion()) raf = requestAnimationFrame(loop);
  return () => { stopped = true; cancelAnimationFrame(raf); removeEventListener('resize', size); };
}
