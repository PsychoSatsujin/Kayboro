// Compact HUD: pixel coin with a counting number, level badge with an XP bar, and the sound toggle.
// Coins and level open the Shop and Profile (data-goto, handled by the sidebar).
import { h, icon, coinIcon, fmt, replay, reducedMotion } from './kit.js';
import { levelProgress } from './logic.js';
import { isMuted, toggleMuted, onMuteChange } from './sound.js';

// Animated number: counts from what is shown to `to` (ease-out), instantly when motion is reduced.
function counter(el) {
  let shown = null, raf = 0;
  const set = n => { shown = n; el.textContent = fmt.format(n); };
  return {
    to(n) {
      cancelAnimationFrame(raf);
      if (shown == null || reducedMotion() || shown === n) return set(n);
      const from = shown, t0 = performance.now(), dur = Math.min(1100, 350 + Math.abs(n - from) * 3);
      const step = now => {
        const k = Math.min(1, Math.max(0, (now - t0) / dur)); // a frame stamp can predate t0
        set(Math.round(from + (n - from) * (1 - (1 - k) ** 3)));
        if (k < 1) raf = requestAnimationFrame(step);
      };
      raf = requestAnimationFrame(step);
    },
    stop() { cancelAnimationFrame(raf); },
  };
}

export function mountHud(el, ctx = {}) {
  const coinNum = h('b', { className: 'sc-hud-num' });
  const coinBtn = h('button', { type: 'button', className: 'sc-hud-coins', 'data-goto': 'shop', 'data-hud-coin': '' }, coinIcon('sc-coin sc-hud-coin'), coinNum);
  const lvNum = h('b', { className: 'sc-hud-num' });
  const fill = h('span', { className: 'sc-hud-fill' });
  const bar = h('span', { className: 'sc-hud-xp', role: 'progressbar', 'aria-label': 'XP to next level', 'aria-valuemin': 0, 'aria-valuemax': 100 }, fill);
  const lvBtn = h('button', { type: 'button', className: 'sc-hud-level', 'data-goto': 'profile' }, h('span', { className: 'sc-hud-lv' }, h('small', { textContent: 'Lv' }), lvNum), bar);
  const mute = h('button', { type: 'button', className: 'sc-hud-mute', onclick: () => toggleMuted() });
  const root = h('div', { className: 'sc-hud' }, coinBtn, lvBtn, mute);
  el.replaceChildren(root);

  const coins = counter(coinNum);
  let prev = null, resetT = 0;
  const showMute = m => {
    mute.replaceChildren(icon(m ? 'mute' : 'volume'));
    mute.setAttribute('aria-pressed', String(m));
    mute.setAttribute('aria-label', m ? 'Sounds off' : 'Sounds on');
    mute.title = m ? 'Sounds off (click to turn on)' : 'Sounds on (click to mute)';
  };
  showMute(isMuted());
  const offMute = onMuteChange(showMute);

  // +12 / -400 floating under the coin. One at a time: a change that lands while one is still
  // floating replaces it (same direction: shows the running total) instead of stacking on top.
  let floater = null;
  function floatDelta(d) {
    if (reducedMotion()) return;
    if (floater?.isConnected) {
      if (Math.sign(floater._d) === Math.sign(d)) d += floater._d;
      floater.remove();
    }
    const f = floater = h('span', { className: `sc-hud-delta ${d > 0 ? 'up' : 'down'}`, textContent: `${d > 0 ? '+' : '−'}${fmt.format(Math.abs(d))}`, 'aria-hidden': 'true' });
    f._d = d;
    coinBtn.append(f);
    setTimeout(() => f.remove(), 1300);
  }

  function setXp(p, rolled) {
    clearTimeout(resetT);
    if (!rolled || reducedMotion()) { fill.style.transform = `scaleX(${p})`; return; }
    fill.style.transform = 'scaleX(1)'; // finish the old level, then refill from empty
    resetT = setTimeout(() => {
      fill.classList.add('no-anim');
      fill.style.transform = 'scaleX(0)';
      void fill.offsetWidth;
      fill.classList.remove('no-anim');
      fill.style.transform = `scaleX(${p})`;
    }, 420);
  }

  function update(st) {
    if (!st) { root.classList.add('is-empty'); return; }
    root.classList.remove('is-empty');
    const c = Math.max(0, Math.floor(st.coins || 0)), lvl = st.level || 1, p = levelProgress(st), max = !(st.xpForNext > 0);
    coins.to(c);
    lvNum.textContent = lvl;
    if (prev) {
      if (c !== prev.coins) { replay(coinBtn, c > prev.coins ? 'pulse-up' : 'pulse-down'); floatDelta(c - prev.coins); }
      if (lvl > prev.level) replay(lvBtn, 'pulse-level');
      else if ((st.xp || 0) > (prev.xp || 0)) replay(bar, 'pulse-xp');
    }
    setXp(p, !!prev && lvl > prev.level);
    const xpText = max ? 'Max level' : `${fmt.format(st.xpIntoLevel || 0)} / ${fmt.format(st.xpForNext)} XP to level ${lvl + 1}`;
    bar.setAttribute('aria-valuenow', Math.round(p * 100));
    bar.setAttribute('aria-valuetext', xpText);
    coinBtn.title = `${fmt.format(c)} coins. Open the Shop`;
    coinBtn.setAttribute('aria-label', `${fmt.format(c)} coins, open the Shop`);
    lvBtn.title = `Level ${lvl}. ${xpText}`;
    lvBtn.setAttribute('aria-label', `Level ${lvl}, ${xpText}, open your profile`);
    lvBtn.classList.toggle('is-max', max);
    prev = { coins: c, level: lvl, xp: st.xp || 0 };
  }

  update(ctx.app?.state || null);
  return {
    update,
    destroy() { coins.stop(); clearTimeout(resetT); offMute(); el.replaceChildren(); },
  };
}
