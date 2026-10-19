// Toasts: a stack in the bottom-left corner (newest last). show() for plain notes, achievement() for a
// Steam unlock (game icon, +coins, +XP, shine sweep) and levelUp() for the big card with a pixel
// confetti burst. Auto-dismiss pauses while hovered or focused; Escape or x dismisses.
import { h, put, icon, coinIcon, fmt, reducedMotion, getShell, call, itemThumb } from './kit.js';
import { steamIcon, indexCatalog, mergeRewards, rankTitle } from './logic.js';
import { play } from './sound.js';

const MAX = 3;
const KIND_ICON = { info: 'info', ok: 'circleCheck', success: 'circleCheck', warn: 'alert', error: 'alert', coin: null, achievement: 'trophy', level: 'stars' };
const CONFETTI = ['#ff6ad5', '#7af0ff', '#ffd166', '#6ee7a8', '#c58cff', '#ffffff'];

export function createToaster(root, opts = {}) {
  root.classList.add('sc-toasts');
  root.setAttribute('aria-live', 'polite');
  root.setAttribute('aria-relevant', 'additions');
  let catP = null, lvl = null; // lvl: the visible level-up toast, so a burst of level-ups merges into one card
  const catalog = () => (catP ||= Promise.resolve(opts.catalog?.() || call(getShell(opts), 'listCatalog')).then(indexCatalog).catch(() => new Map()));

  function dismiss(el) {
    if (!el.isConnected || el.classList.contains('is-out')) return;
    clearTimeout(el._t);
    if (el === lvl?.el) lvl = null;
    const back = el.contains(document.activeElement);
    if (reducedMotion()) el.remove();
    else { el.classList.add('is-out'); setTimeout(() => el.remove(), 220); }
    if (back) root.querySelector('.sc-toast:not(.is-out)')?.focus();
  }

  // Adds a toast and runs its timer: paused on hover/focus, resumed with the time that was left.
  function mount(el, ttl) {
    el.tabIndex = -1;
    el.style.setProperty('--ttl', `${ttl}ms`);
    let left = ttl, at = 0;
    const run = () => { at = performance.now(); clearTimeout(el._t); el._t = setTimeout(() => dismiss(el), left); el.classList.remove('is-paused'); };
    const pause = () => { clearTimeout(el._t); left = Math.max(1200, left - (performance.now() - at)); el.classList.add('is-paused'); };
    el.addEventListener('pointerenter', pause);
    el.addEventListener('pointerleave', () => { if (!el.contains(document.activeElement)) run(); });
    el.addEventListener('focusin', pause);
    el.addEventListener('focusout', e => { if (!el.contains(e.relatedTarget)) run(); });
    el.addEventListener('keydown', e => { if (e.key === 'Escape') { e.preventDefault(); e.stopPropagation(); dismiss(el); } });
    el.reset = (ms = ttl) => { left = ms; el.querySelector('.sc-toast-timer')?.replaceWith(timer()); el.style.setProperty('--ttl', `${ms}ms`); run(); };
    root.append(el);
    const live = [...root.querySelectorAll('.sc-toast:not(.is-out)')];
    for (const old of live.slice(0, Math.max(0, live.length - MAX))) dismiss(old);
    run();
    return el;
  }

  const closeBtn = el => h('button', { type: 'button', className: 'sc-toast-x', 'aria-label': 'Dismiss', title: 'Dismiss (Esc)', onclick: () => dismiss(el()) }, icon('x'));
  const actionBtn = (action, el) => action?.label ? h('button', { type: 'button', className: 'btn sm sc-toast-act', textContent: action.label,
    onclick: () => { dismiss(el()); try { action.onClick?.(); } catch (err) { console.warn('[kayboro] toast action failed:', err); } } }) : null;
  const timer = () => h('i', { className: 'sc-toast-timer', 'aria-hidden': 'true' });

  function show({ title = '', body = '', icon: ic = null, action = null, kind = 'info', ttl } = {}) {
    let el;
    const glyph = ic instanceof Node ? ic : kind === 'coin' ? coinIcon('sc-coin') : icon(typeof ic === 'string' ? ic : KIND_ICON[kind] || 'info');
    el = h('div', { className: `sc-toast kind-${kind}`, role: kind === 'error' ? 'alert' : 'status' },
      h('span', { className: 'sc-toast-ic' }, glyph),
      h('div', { className: 'sc-toast-text' }, h('b', { textContent: title }), body ? h('span', { textContent: body }) : null),
      actionBtn(action, () => el), closeBtn(() => el), timer());
    if (kind === 'error') play('error');
    return mount(el, ttl ?? (action ? 9000 : body ? 5200 : 4000));
  }

  function achievement(e = {}) {
    let el;
    const src = steamIcon(e.iconUrl), art = h('span', { className: 'sc-ach-art' });
    const fallback = () => art.replaceChildren(icon('trophy', 'sc-ach-trophy'));
    if (src) art.append(h('img', { src, alt: '', width: 56, height: 56, decoding: 'async', referrerPolicy: 'no-referrer', onerror: fallback }));
    else fallback();
    const gains = h('div', { className: 'sc-gains' },
      e.coins ? h('span', { className: 'sc-gain is-coin' }, coinIcon('sc-coin'), `+${fmt.format(e.coins)}`) : null,
      e.xp ? h('span', { className: 'sc-gain is-xp' }, `+${fmt.format(e.xp)} XP`) : null);
    el = h('div', { className: 'sc-toast sc-ach', role: 'status', 'aria-label': `Achievement unlocked: ${e.name || e.apiName || ''}${e.game ? ` in ${e.game}` : ''}. ${e.coins ? `+${e.coins} coins` : ''} ${e.xp ? `+${e.xp} XP` : ''}` },
      art,
      h('div', { className: 'sc-toast-text' },
        h('small', { className: 'sc-eyebrow' }, h('span', { textContent: 'Achievement unlocked' }), e.game ? h('span', { className: 'sc-eyebrow-game', textContent: e.game }) : null),
        h('b', { textContent: e.name || e.apiName || 'Achievement' }),
        e.desc ? h('span', { textContent: e.desc }) : null, gains),
      closeBtn(() => el), h('i', { className: 'sc-shine', 'aria-hidden': 'true' }), timer());
    play('unlock');
    return mount(el, 7000);
  }

  function levelUp(e = {}) {
    const level = Math.max(1, Math.floor(e.level) || 1);
    if (lvl?.el.isConnected) { // merge a burst of level-ups into the visible card
      lvl.level = Math.max(lvl.level, level);
      lvl.rewards = mergeRewards(lvl.rewards, e.rewards);
      fillLevel(lvl);
      lvl.el.reset();
      burst(lvl.el.querySelector('.sc-lvl-badge'), 18);
      return lvl.el;
    }
    let el;
    const badge = h('div', { className: 'sc-lvl-badge', 'aria-hidden': 'true' }, h('small', { textContent: 'LV' }), h('b'));
    el = h('div', { className: 'sc-toast sc-lvl', role: 'status' },
      h('i', { className: 'sc-lvl-rays', 'aria-hidden': 'true' }), badge,
      h('div', { className: 'sc-toast-text' }, h('small', { className: 'sc-eyebrow', textContent: 'Level up!' }), h('b', { className: 'sc-lvl-title' }),
        h('span', { className: 'sc-lvl-rank' }), h('div', { className: 'sc-lvl-rewards' }),
        h('div', { className: 'sc-lvl-acts' }, h('button', { type: 'button', className: 'btn sm', 'data-goto': 'profile', textContent: 'See Rewards', onclick: () => dismiss(el) }))),
      closeBtn(() => el), timer());
    lvl = { el, level, rewards: mergeRewards({}, e.rewards) };
    fillLevel(lvl);
    mount(el, 8000);
    play('levelUp');
    requestAnimationFrame(() => burst(badge, 44));
    return el;
  }

  function fillLevel(l) {
    const { el, level, rewards } = l;
    el.querySelector('.sc-lvl-badge b').textContent = level;
    el.querySelector('.sc-lvl-title').textContent = `Level ${level}`;
    el.querySelector('.sc-lvl-rank').textContent = rankTitle(level);
    el.setAttribute('aria-label', `Level up! You reached level ${level}.${rewards.coins ? ` +${rewards.coins} coins.` : ''}`);
    const box = el.querySelector('.sc-lvl-rewards');
    const items = rewards.items || [];
    put(box,
      rewards.coins ? h('span', { className: 'sc-gain is-coin' }, coinIcon('sc-coin'), `+${fmt.format(rewards.coins)}`) : null,
      ...items.slice(0, 3).map(id => h('span', { className: 'sc-gain is-item', 'data-item': id }, h('span', { className: 'sc-ithumb-ph' }), h('span', { textContent: prettyId(id) }))),
      items.length > 3 ? h('span', { className: 'sc-gain', textContent: `+${items.length - 3} more` }) : null);
    if (items.length) catalog().then(m => {
      for (const chip of box.querySelectorAll('[data-item]')) {
        const it = m.get(chip.dataset.item);
        if (it) chip.replaceChildren(itemThumb(it, 'sc-ithumb sm'), h('span', { textContent: it.name }));
      }
    });
  }

  // Pixel confetti from the middle of `from` (fixed-position squares; skipped for reduced motion).
  function burst(from, n = 40) {
    if (!from?.isConnected || reducedMotion() || typeof document.body.animate !== 'function') return;
    const r = from.getBoundingClientRect(), x0 = r.left + r.width / 2, y0 = r.top + r.height / 2;
    for (let i = 0; i < n; i++) {
      const s = 4 + 2 * Math.floor(Math.random() * 3), p = h('i', { className: 'sc-confetti', style: { width: `${s}px`, height: `${s}px`, background: CONFETTI[i % CONFETTI.length], left: `${x0}px`, top: `${y0}px` } });
      document.body.append(p);
      const a = (Math.random() * 1.6 - 1.3) * Math.PI / 2 - Math.PI / 4, v = 90 + Math.random() * 170;
      const dx = Math.cos(a) * v, dy = Math.sin(a) * v, fall = 140 + Math.random() * 120, spin = (Math.random() < 0.5 ? -1 : 1) * (180 + Math.random() * 360);
      p.animate([
        { transform: 'translate(-50%, -50%) rotate(0deg)', opacity: 1 },
        { transform: `translate(calc(-50% + ${dx}px), calc(-50% + ${dy}px)) rotate(${spin / 2}deg)`, opacity: 1, offset: 0.45 },
        { transform: `translate(calc(-50% + ${dx * 1.25}px), calc(-50% + ${dy + fall}px)) rotate(${spin}deg)`, opacity: 0 },
      ], { duration: 1100 + Math.random() * 700, easing: 'cubic-bezier(.2,.7,.4,1)', fill: 'both' }).finished.catch(() => {}).then(() => p.remove());
    }
  }

  const onKey = e => {
    if (e.key !== 'Escape' || !root.contains(document.activeElement)) return;
    const t = document.activeElement.closest('.sc-toast');
    if (t) { e.preventDefault(); dismiss(t); }
  };
  document.addEventListener('keydown', onKey);

  return {
    show, achievement, levelUp, burst,
    clear() { for (const t of root.querySelectorAll('.sc-toast')) dismiss(t); },
    destroy() { document.removeEventListener('keydown', onKey); for (const t of root.querySelectorAll('.sc-toast')) { clearTimeout(t._t); t.remove(); } },
  };
}

const prettyId = id => String(id).replace(/^(px|vx)-/, '').replace(/[-_]+/g, ' ').replace(/\b\w/g, c => c.toUpperCase());
