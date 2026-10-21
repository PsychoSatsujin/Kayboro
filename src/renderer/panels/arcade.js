// Arcade: Kayboro's mini-games. For now one: Fandom Clash (src/renderer/clash/game.js), which opens over the
// whole window. The tab shows what it is, the four modes, and whether it is playing online or offline.
import { h, icon, put, call } from './kit.js';

const CSS = 'clash/clash.css';
let gameP = null;
const game = () => (gameP ||= import('../clash/game.js'));
function addCss() {
  if (!document.querySelector(`link[href="${CSS}"]`)) document.head.append(Object.assign(document.createElement('link'), { rel: 'stylesheet', href: CSS }));
}

const MODES = [
  ['ranked', 'Ranked Vs', 'trophy', 'Global board'],
  ['local', 'Local Ranking', 'heart', 'Friends with a code'],
  ['percent', 'Percentage Vs', 'palette', 'Slide, bet, reveal'],
  ['ghost', 'Ghost Battle', 'eyeOff', 'Race a recorded run'],
];

export function mountArcade(el, ctx = {}) {
  addCss();
  const app = ctx.app || {}, ror = app.ror || window.ror;
  const open = mode => game().then(g => g.openClash(app, { mode })).catch(err => ctx.toast?.({ title: 'Fandom Clash could not start', body: String(err?.message || err), kind: 'error' }));
  const status = h('p', { className: 'sc-copy cl-side-status' }, 'Checking for game data…');
  put(el, h('div', { className: 'sc-panel sc-arcade' },
    h('header', { className: 'sc-ph' }, h('div', {}, h('h2', { textContent: 'Arcade' }), h('p', { textContent: 'Little games to play between sessions. Just for fun.' }))),
    h('button', { type: 'button', className: 'cl-side-hero', onclick: () => open(), 'aria-label': 'Play Fandom Clash' },
      h('span', { className: 'cl-side-art', 'aria-hidden': 'true' }, h('span', { className: 'a' }), h('b', {}, 'VS'), h('span', { className: 'b' })),
      h('span', { className: 'cl-side-title' }, h('span', {}, 'FANDOM'), h('span', {}, 'CLASH')),
      h('span', { className: 'cl-side-tag' }, 'Which character has more fan art? Higher or lower, across all the big booru sites.'),
      h('span', { className: 'btn primary cl-side-play' }, icon('gamepad'), h('span', {}, 'Play'))),
    h('div', { className: 'cl-side-modes' }, MODES.map(([id, label, ic, sub]) => h('button', { type: 'button', className: 'cl-side-mode', onclick: () => open(id) },
      icon(ic), h('span', {}, h('b', {}, label), h('small', {}, sub))))),
    status,
    h('p', { className: 'sc-copy' }, 'Post counts include every rating; the game only ever shows each character\'s safe-for-work picture. Coin bets are optional and capped at 25% of your coins.')));

  call(ror, 'clashStatus').then(st => {
    if (!st || st.error) { status.textContent = 'Fandom Clash needs the Kayboro desktop app.'; return; }
    const s = st.snapshot;
    status.textContent = !s ? 'No game data yet: it downloads once the Clash server is reachable.'
      : `${s.characters.toLocaleString()} characters, ${s.franchises.toLocaleString()} franchises. ${st.server ? 'Global boards when online.' : 'Offline: local boards and ghosts.'}`;
  });
  return { update(st) { if (gameP) gameP.then(g => g.updateClash(st)); } };
}
