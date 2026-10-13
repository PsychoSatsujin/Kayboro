// Devs: the hosted game and its developer's support links, how the 70/30 creator pool works, listed
// developers, the "List your game" form (saved on this PC) and the payout sheet export.
import { h, put, icon, getShell, call, has, hueOf, durNodes } from './kit.js';
import { devForApp, gameStats, fmtSince, fmtDuration, initials, validateDevForm, parseUsd, splitRevenue, fmtUsd, DEV_SHARE } from './logic.js';
import { play } from './sound.js';

const LINKS = [['patreon', 'Patreon', 'patreon'], ['kofi', 'Ko-fi', 'coffee'], ['itch', 'itch.io', 'gamepad'], ['website', 'Website', 'world']];
const FIELDS = [
  ['name', 'Studio or developer name', 'text', 'Tiny Lantern Games', true],
  ['email', 'Contact email', 'email', 'you@studio.com', true],
  ['kofi', 'Ko-fi', 'url', 'https://ko-fi.com/yourname'],
  ['paypal', 'PayPal', 'text', 'Email or paypal.me/yourname'],
  ['patreon', 'Patreon', 'url', 'https://patreon.com/yourname'],
  ['website', 'Website', 'url', 'https://yourstudio.com'],
];
const REV_KEY = 'shellcade.payoutRevenue';

export function mountDevs(el, ctx = {}) {
  const shell = getShell(ctx), app = ctx.app || {};
  const toast = m => (ctx.toast || app.toast?.bind(app) || (() => {}))(m);
  let st = app.state || null, devs = [], subs = [], nowSig = '', playSig = '';

  const now = h('section', { className: 'sc-now' });
  const yourPlay = h('ul', { className: 'sc-support' });
  const directory = h('div', { className: 'sc-devlist' });
  const subList = h('div', { className: 'sc-subs' });
  const form = buildForm();
  const payout = buildPayout();

  el.replaceChildren(h('div', { className: 'sc-panel sc-devs' },
    h('header', { className: 'sc-ph' }, h('div', {}, h('h2', { textContent: 'Developers' }), h('p', { textContent: 'Support the people who make the games you play.' }))),
    now,
    h('section', { className: 'sc-sec sc-pool' },
      h('div', { className: 'sc-sec-head' }, h('h3', {}, icon('heart'), 'The creator pool')),
      h('div', { className: 'sc-split', role: 'img', 'aria-label': `${DEV_SHARE}% to developers, ${100 - DEV_SHARE}% to Shellcade` },
        h('span', { className: 'd', style: { flex: DEV_SHARE } }, h('b', { textContent: `${DEV_SHARE}%` }), h('small', { textContent: 'Developers' })),
        h('span', { className: 's', style: { flex: 100 - DEV_SHARE } }, h('b', { textContent: `${100 - DEV_SHARE}%` }), h('small', { textContent: 'Shellcade' }))),
      h('p', { className: 'sc-copy', textContent: `Paid shells ship as Steam DLC. ${DEV_SHARE}% of the net revenue goes to listed developers, split by how much their games are played inside Shellcade. Payouts start with the Steam release.` }),
      yourPlay),
    h('section', { className: 'sc-sec' }, h('div', { className: 'sc-sec-head' }, h('h3', {}, icon('stars'), 'Listed developers')), directory),
    h('section', { className: 'sc-sec sc-join', id: 'sc-join' },
      h('div', { className: 'sc-sec-head' }, h('h3', {}, icon('send'), 'List your game')),
      h('p', { className: 'sc-copy', textContent: 'Made a game people play in Shellcade? List it to get your support links shown here and a share of the creator pool.' }),
      form.el),
    h('section', { className: 'sc-sec' }, h('div', { className: 'sc-sec-head' }, h('h3', {}, icon('table'), 'Submissions & payouts')), subList, payout.el)));

  // ---- Now hosting ----
  function renderNow() {
    const s = st?.session, dev = s && devForApp(devs, s.appid);
    const sig = JSON.stringify([s?.appid, s?.name, dev?.devId, Math.floor((Date.now() - (s?.startedAt || 0)) / 60000)]);
    if (sig === nowSig) return;
    nowSig = sig;
    if (!s) {
      return now.replaceChildren(h('div', { className: 'sc-now-card is-idle' },
        h('span', { className: 'sc-now-ic' }, icon('gamepad')),
        h('div', {}, h('b', { textContent: 'No game hosted right now' }), h('p', { textContent: 'Put a game in a shell and its developer shows up here.' })),
        h('button', { type: 'button', className: 'btn sm', 'data-goto': 'stage' }, 'Pick a game')));
    }
    now.replaceChildren(h('div', { className: 'sc-now-card' },
      h('small', { className: 'sc-eyebrow' }, h('i', { className: 'sc-live' }), `Now hosting · ${fmtSince(s.startedAt)}`),
      h('b', { className: 'sc-now-game', textContent: s.name || `App ${s.appid}` }),
      dev ? devCard(dev, true) : h('div', { className: 'sc-unlisted' },
        h('span', { className: 'sc-now-ic' }, icon('heart')),
        h('div', {}, h('b', { textContent: 'Not listed yet' }),
          h('p', { textContent: `When this game's developer lists it, their support links show up here and your play counts toward their share. Developers can use the form below (see docs/DEVELOPERS.md).` })),
        h('button', { type: 'button', className: 'btn sm ghost', onclick: () => document.getElementById('sc-join')?.scrollIntoView({ behavior: 'smooth', block: 'start' }) }, 'I made this game'))));
  }

  function devCard(d, featured = false) {
    const links = LINKS.filter(([k]) => d.links?.[k]);
    return h('article', { className: `sc-dev${d.sample ? ' is-sample' : ''}${featured ? ' is-featured' : ''}` },
      h('div', { className: 'sc-dev-head' },
        h('span', { className: 'sc-avatar', style: { '--hue': hueOf(d.devId || d.name) }, textContent: initials(d.name) }),
        h('div', { className: 'sc-dev-id' },
          h('b', {}, h('span', { textContent: d.name }), d.sample ? h('span', { className: 'sc-tag ex', textContent: 'Example' }) : d.verified ? h('span', { className: 'sc-verified', title: 'Verified developer', 'aria-label': 'Verified' }, icon('check')) : null),
          h('small', { textContent: (d.apps || []).map(a => a.name).join(', ') || 'No games yet' }))),
      d.blurb ? h('p', { className: 'sc-dev-blurb', textContent: d.blurb }) : null,
      links.length ? h('div', { className: 'sc-links' }, links.map(([k, label, ic]) => h('button', { type: 'button', className: `sc-link l-${k}`, title: d.links[k],
        onclick: async () => { if (!(await call(shell, 'openLink', d.links[k]))) toast({ title: `Couldn't open ${label}`, body: 'Only https links to known sites open from Shellcade.', kind: 'error' }); } },
      icon(ic), label, icon('external', 'i sc-ext')))) : null);
  }

  // ---- Your play ----
  function renderPlay() {
    const list = gameStats(st).slice(0, 4), sig = JSON.stringify([list.map(g => [g.appid, Math.floor(g.playSeconds / 60)]), devs.length, subs.length]);
    const submitted = appid => subs.some(s => (s.games || []).some(x => String(x.appid) === String(appid))); // saved here, waiting to be listed
    if (sig === playSig) return;
    playSig = sig;
    yourPlay.replaceChildren(...list.map(g => {
      const d = devForApp(devs, g.appid);
      return h('li', {}, h('b', { textContent: g.name }), h('span', { className: 'meta' }, durNodes(fmtDuration(g.playSeconds))),
        h('span', { className: `sc-tag ${d && !d.sample ? 'ok' : d ? 'ex' : submitted(g.appid) ? 'dlc' : 'off'}`, textContent: d ? (d.sample ? 'Example' : 'Listed') : submitted(g.appid) ? 'Submitted' : 'Not listed' }));
    }));
    if (list.length) yourPlay.prepend(h('li', { className: 'sc-support-head' }, h('small', { textContent: 'Your hosted play' })));
  }

  function renderDirectory() {
    const list = [...devs].sort((a, b) => (!!a.sample - !!b.sample) || String(a.name).localeCompare(String(b.name)));
    directory.replaceChildren(...(list.length ? list.map(d => devCard(d)) : [h('p', { className: 'sc-empty sm', textContent: 'No developers listed yet. Be the first!' })]));
  }

  // ---- Form ----
  function buildForm() {
    const inputs = {}, errs = {};
    const field = ([key, label, type, ph, req]) => {
      const id = `sc-dev-${key}`, err = h('small', { className: 'sc-err', id: `${id}-err` });
      inputs[key] = h('input', { id, name: key, type: type === 'url' ? 'text' : type, inputMode: type === 'url' ? 'url' : type === 'email' ? 'email' : null, placeholder: ph,
        autocomplete: key === 'email' ? 'email' : key === 'name' ? 'organization' : 'off', spellcheck: false, required: !!req, 'aria-describedby': `${id}-err` });
      errs[key] = err;
      return h('div', { className: 'sc-field' }, h('label', { for: id }, label, req ? h('span', { className: 'sc-req', 'aria-hidden': 'true', textContent: '*' }) : null), inputs[key], err);
    };
    const gameRows = h('div', { className: 'sc-gamerows' });
    errs.games = h('small', { className: 'sc-err', id: 'sc-dev-games-err' });
    const addGame = (g = {}) => {
      const r = h('div', { className: 'sc-gamerow' },
        h('input', { type: 'text', name: 'gameName', placeholder: 'Game name', 'aria-label': 'Game name', value: g.name || '', spellcheck: false, autocomplete: 'off' }),
        h('input', { type: 'text', name: 'appid', placeholder: 'Steam appid', 'aria-label': 'Steam appid', inputMode: 'numeric', value: g.appid || '', autocomplete: 'off', className: 'sc-appid' }),
        h('button', { type: 'button', className: 'icon-btn sm', 'aria-label': 'Remove this game', title: 'Remove', onclick: () => { if (gameRows.children.length > 1) r.remove(); else r.querySelectorAll('input').forEach(i => { i.value = ''; }); } }, icon('x')));
      gameRows.append(r);
      return r;
    };
    addGame();
    const notes = h('textarea', { id: 'sc-dev-notes', name: 'notes', rows: 3, maxLength: 2000, placeholder: 'Anything we should know (optional)' });
    const agree = h('input', { type: 'checkbox', id: 'sc-dev-agree', name: 'agree', 'aria-describedby': 'sc-dev-agree-err' });
    errs.agree = h('small', { className: 'sc-err', id: 'sc-dev-agree-err' });
    errs.payout = h('small', { className: 'sc-err' });
    const submit = h('button', { type: 'submit', className: 'btn primary wide' }, icon('send', 'i'), 'Submit listing');
    const [nameF, emailF, ...payF] = FIELDS.map(field);
    const f = h('form', { className: 'sc-form', noValidate: true },
      nameF, emailF,
      h('fieldset', { className: 'sc-field' }, h('legend', {}, 'Games and Steam appids', h('span', { className: 'sc-req', 'aria-hidden': 'true', textContent: '*' })), gameRows,
        h('button', { type: 'button', className: 'btn sm ghost sc-addgame', onclick: () => addGame().querySelector('input').focus() }, icon('plus'), 'Add another game'), errs.games),
      h('fieldset', { className: 'sc-field sc-payf' }, h('legend', {}, 'Where should we pay you?'), h('p', { className: 'hint', textContent: 'Add at least one.' }), ...payF.slice(0, 3), errs.payout),
      payF[3],
      h('div', { className: 'sc-field' }, h('label', { for: 'sc-dev-notes' }, 'Notes'), notes),
      h('label', { className: 'sc-check' }, agree, h('span', { className: 'sc-checkbox', 'aria-hidden': 'true' }, icon('check')),
        h('span', {}, `I agree to the ${DEV_SHARE}/${100 - DEV_SHARE} split (${DEV_SHARE}% to developers, ${100 - DEV_SHARE}% to Shellcade)`)), errs.agree,
      submit, h('p', { className: 'hint sc-center', textContent: 'Saved on this PC with your other submissions.' }));

    const read = () => ({
      ...Object.fromEntries(Object.entries(inputs).map(([k, i]) => [k, i.value])), notes: notes.value, agree: agree.checked,
      games: [...gameRows.children].map(r => ({ name: r.querySelector('[name=gameName]').value, appid: r.querySelector('[name=appid]').value })),
    });
    const showErrors = errors => {
      for (const [k, e] of Object.entries(errs)) e.textContent = errors[k] || '';
      for (const [k, i] of Object.entries(inputs)) i.setAttribute('aria-invalid', String(!!errors[k]));
      [...gameRows.children].forEach((r, i) => r.querySelector('[name=appid]').setAttribute('aria-invalid', String(!!errors[`games.${i}`])));
      const gameErr = Object.keys(errors).find(k => k.startsWith('games'));
      errs.games.textContent = gameErr ? errors[gameErr] : '';
      agree.setAttribute('aria-invalid', String(!!errors.agree));
    };
    f.addEventListener('submit', async e => {
      e.preventDefault();
      const v = validateDevForm(read());
      showErrors(v.errors);
      if (!v.ok) {
        play('error');
        const first = f.querySelector('[aria-invalid=true]');
        first?.focus();
        return;
      }
      submit.disabled = true;
      const r = await call(shell, 'submitDeveloper', { ...v.value, appids: v.value.games.map(g => g.appid) });
      submit.disabled = false;
      if (!r?.ok) {
        play('error');
        if (r?.errors && Object.keys(r.errors).length) { showErrors(r.errors); f.querySelector('[aria-invalid=true]')?.focus(); return; }
        return toast({ title: 'Could not save your listing', body: r?.reason || (has(shell, 'submitDeveloper') ? 'Please check the form and try again.' : 'Listing needs the Shellcade desktop app.'), kind: 'error' });
      }
      play('coin');
      toast({ title: 'Listing saved', body: `${v.value.name}, thanks! Your games: ${v.value.games.map(g => g.name).join(', ')}.`, kind: 'ok' });
      f.reset();
      gameRows.replaceChildren();
      addGame();
      showErrors({});
      loadSubs();
    });
    f.addEventListener('input', e => { // clear a field's error as soon as it is edited
      const k = e.target.name;
      if (errs[k]?.textContent) { errs[k].textContent = ''; e.target.setAttribute('aria-invalid', 'false'); }
      if (['kofi', 'paypal', 'patreon'].includes(k)) errs.payout.textContent = '';
    });
    agree.addEventListener('change', () => { if (agree.checked) errs.agree.textContent = ''; });
    return { el: f };
  }

  // ---- Submissions + payout sheet ----
  function renderSubs() {
    if (!has(shell, 'listSubmissions')) return subList.replaceChildren();
    if (!subs.length) return subList.replaceChildren(h('p', { className: 'hint', textContent: 'No submissions saved on this PC yet.' }));
    put(subList, h('ul', { className: 'sc-sublist' }, subs.slice(0, 20).map(s => {
      const games = s.games || (s.appids || []).map(a => ({ appid: a }));
      const pays = [['kofi', 'Ko-fi'], ['paypal', 'PayPal'], ['patreon', 'Patreon']].filter(([k]) => s[k]).map(([, t]) => t);
      const at = s.submittedAt || s.createdAt || s.date;
      return h('li', {},
        h('span', { className: 'sc-avatar sm', style: { '--hue': hueOf(s.name || s.id) }, textContent: initials(s.name) }),
        h('span', { className: 'sc-mod-main' },
          h('span', { className: 'sc-game-row' }, h('b', { textContent: s.name || 'Unnamed' }), at ? h('span', { className: 'sc-ver', textContent: new Date(at).toLocaleDateString() }) : null),
          h('small', { textContent: games.map(g => (g.name ? `${g.name} (${g.appid})` : g.appid)).join(', ') || 'No games' }),
          h('small', { className: 'meta', textContent: [s.email, pays.join(' · ')].filter(Boolean).join(' · ') })));
    })), subs.length > 20 ? h('p', { className: 'hint', textContent: `…and ${subs.length - 20} more in the sheet.` }) : null);
  }

  function buildPayout() {
    let saved = '';
    try { saved = localStorage.getItem(REV_KEY) || ''; } catch {}
    const input = h('input', { type: 'text', id: 'sc-rev', inputMode: 'decimal', placeholder: '0.00', value: saved, autocomplete: 'off', 'aria-describedby': 'sc-rev-split' });
    const split = h('div', { className: 'sc-paysplit', id: 'sc-rev-split', 'aria-live': 'polite' });
    const btn = h('button', { type: 'button', className: 'btn wide' }, icon('download'), 'Export payout sheet');
    const show = () => {
      const c = parseUsd(input.value);
      input.setAttribute('aria-invalid', String(input.value.trim() !== '' && c == null));
      const s = splitRevenue(c || 0);
      split.replaceChildren(h('span', { className: 'd' }, h('small', { textContent: `Developers ${DEV_SHARE}%` }), h('b', { textContent: fmtUsd(s.devs) })),
        h('span', { className: 's' }, h('small', { textContent: `Shellcade ${100 - DEV_SHARE}%` }), h('b', { textContent: fmtUsd(s.shellcade) })));
      btn.disabled = c == null || !has(shell, 'exportPayoutSheet');
    };
    input.addEventListener('input', () => { show(); try { localStorage.setItem(REV_KEY, input.value); } catch {} });
    btn.addEventListener('click', async () => {
      const cents = parseUsd(input.value);
      if (cents == null) return;
      btn.disabled = true;
      const r = await call(shell, 'exportPayoutSheet', { revenueCents: cents });
      btn.disabled = false;
      const path = typeof r === 'string' ? r : r?.path;
      if (path) { play('coin'); toast({ title: 'Payout sheet saved', body: path, kind: 'ok' }); }
      else if (r && r.ok === false && r.reason !== 'canceled' && r.reason !== 'cancelled') toast({ title: 'Could not save the sheet', body: 'Please try again.', kind: 'error' });
    });
    show();
    return { el: h('div', { className: 'sc-payout' },
      h('label', { for: 'sc-rev', className: 'label' }, 'Net revenue to split (USD)'),
      h('div', { className: 'sc-money' }, h('span', { textContent: '$' }), input), split, btn,
      h('p', { className: 'hint', textContent: 'Save as CSV for Excel (one row per developer with play minutes, points, share and payout, plus the Shellcade row and totals), or as JSON to merge with other installs.' })) };
  }

  async function loadDevs() {
    const d = await call(shell, 'listDevelopers');
    devs = Array.isArray(d) ? d.filter(x => x && x.name) : [];
    nowSig = playSig = '';
    renderNow(); renderPlay(); renderDirectory();
  }
  async function loadSubs() {
    const s = await call(shell, 'listSubmissions');
    const at = x => Date.parse(x?.submittedAt || x?.createdAt || x?.date || 0) || 0;
    subs = Array.isArray(s) ? [...s].sort((a, b) => at(b) - at(a)) : [];
    renderSubs();
    renderPlay();
  }

  function update(s) {
    if (s && typeof s === 'object') st = s;
    renderNow();
    renderPlay();
  }

  update(st);
  renderDirectory();
  renderSubs();
  loadDevs();
  loadSubs();
  return { update, destroy() { el.replaceChildren(); } };
}
