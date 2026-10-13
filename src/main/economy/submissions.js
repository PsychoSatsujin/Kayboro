'use strict';
// "List your game" form submissions, saved locally to <dir>/dev-submissions.json for the Shellcade
// team to pick up. Same rules as the Devs tab form (src/renderer/panels/logic.js validateDevForm).
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const EMAIL = /^[^\s@<>()",;:]+@[^\s@<>()",;:]+\.[a-z]{2,}$/i;
const hostIs = (u, host) => u.hostname === host || u.hostname.endsWith(`.${host}`);
function httpsUrl(s) {
  try {
    const u = new URL(/^[a-z]+:\/\//i.test(s) ? s : `https://${s}`);
    return u.protocol === 'https:' && u.hostname.includes('.') && !u.username && !u.password ? u : null;
  } catch {
    return null;
  }
}

// {ok, errors: {field: message}, value} with trimmed, normalized fields.
function validateSubmission(f) {
  f = f && typeof f === 'object' ? f : {};
  const t = (k, max = 300) => String(f[k] ?? '').replace(/[\u0000-\u0008\u000b-\u001f\u007f]/g, '').trim().slice(0, max);
  const errors = {};
  const value = { name: t('name', 120), email: t('email', 200), games: [], kofi: '', paypal: '', patreon: '', website: '', notes: t('notes', 2000), agree: f.agree === true };
  if (!value.name || value.name.length > 80) errors.name = 'Add your studio or developer name (up to 80 characters).';
  if (!EMAIL.test(value.email)) errors.email = 'Add an email we can reach you at.';
  const games = (Array.isArray(f.games) ? f.games : []).map((g) => ({ name: String(g?.name ?? '').trim(), appid: String(g?.appid ?? '').trim() })).filter((g) => g.name || g.appid);
  games.forEach((g, i) => {
    if (!/^\d{1,10}$/.test(g.appid) || !Number(g.appid)) errors[`games.${i}`] = 'Steam appids are numbers, e.g. 1145360.';
    else if (!g.name) errors[`games.${i}`] = 'Add the game name.';
    else value.games.push({ name: g.name.slice(0, 120), appid: Number(g.appid) });
  });
  if (!games.length) errors.games = 'Add at least one game with its Steam appid.';
  for (const [key, host] of [['kofi', 'ko-fi.com'], ['patreon', 'patreon.com'], ['website', null]]) {
    const s = t(key, 500);
    if (!s) continue;
    const u = httpsUrl(s);
    if (!u || (host && !hostIs(u, host))) errors[key] = 'That link does not look right.';
    else value[key] = u.href;
  }
  const pp = t('paypal', 300);
  if (pp) {
    const u = !EMAIL.test(pp) && httpsUrl(pp);
    if (EMAIL.test(pp)) value.paypal = pp;
    else if (u && (hostIs(u, 'paypal.me') || hostIs(u, 'paypal.com'))) value.paypal = u.href;
    else errors.paypal = 'Use your PayPal email or a paypal.me link.';
  }
  if (!value.kofi && !value.paypal && !value.patreon) errors.payout = 'Add Ko-fi, PayPal or Patreon so we can pay you.';
  if (!value.agree) errors.agree = 'Agree to the 70/30 split to list your game.';
  return { ok: !Object.keys(errors).length, errors, value };
}

class Submissions {
  constructor(dir, { now = Date.now } = {}) {
    this.file = path.join(dir, 'dev-submissions.json');
    this.now = now;
  }

  list() {
    try {
      const d = JSON.parse(fs.readFileSync(this.file, 'utf8'));
      return Array.isArray(d.submissions) ? d.submissions.filter((s) => s && typeof s.id === 'string') : [];
    } catch {
      return [];
    }
  }

  add(form) {
    const v = validateSubmission(form);
    if (!v.ok) return { ok: false, reason: 'invalid', errors: v.errors };
    const t = this.now();
    const id = `sub-${t.toString(36)}-${crypto.randomBytes(3).toString('hex')}`;
    const list = [...this.list(), { id, submittedAt: new Date(t).toISOString(), ...v.value }];
    fs.mkdirSync(path.dirname(this.file), { recursive: true });
    fs.writeFileSync(this.file + '.tmp', JSON.stringify({ v: 1, submissions: list }, null, 2));
    fs.renameSync(this.file + '.tmp', this.file);
    return { ok: true, id };
  }
}

module.exports = { Submissions, validateSubmission };
