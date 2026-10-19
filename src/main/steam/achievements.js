'use strict';
// Achievements from Steam's local stats cache (appcache/stats): the schema (names, icons) and the
// signed-in account's unlock times. Read-only; nothing here talks to the network.
const fs = require('fs');
const path = require('path');
const vdf = require('./vdf');
const { steamRoot, regQuery } = require('./paths');

const CDN = 'https://cdn.cloudflare.steamstatic.com/steamcommunity/public/images/apps/';
const ACH_TYPES = new Set(['4', '5', 'ACHIEVEMENTS', 'GROUPACHIEVEMENTS']);
const { isObj, get } = vdf;

const statsDir = (root) => path.join(root, 'appcache', 'stats');
const readBin = (f) => {
  try {
    return vdf.parseBinary(fs.readFileSync(f));
  } catch {
    return null;
  }
};
const str = (v) => (typeof v === 'string' ? v : '');
// Localised display text: english, else any other language, else the #token.
const text = (v) => {
  if (!isObj(v)) return str(v);
  const other = Object.entries(v).find(([k, s]) => k.toLowerCase() !== 'token' && typeof s === 'string' && s);
  return str(get(v, 'english')) || (other ? other[1] : '') || str(get(v, 'token'));
};

const toAccountId = (steamId64) => {
  try {
    return Number(BigInt(String(steamId64)) & 0xffffffffn) || null;
  } catch {
    return null;
  }
};

function currentAccountId(root = steamRoot()) {
  if (!root) return null;
  if (process.platform === 'win32' && !process.env.KAYBORO_STEAM_ROOT) {
    const id = regQuery('HKCU\\Software\\Valve\\Steam\\ActiveProcess', 'ActiveUser');
    if (id > 0) return id;
  }
  let users = [];
  try {
    users = Object.entries(get(vdf.parseText(fs.readFileSync(path.join(root, 'config', 'loginusers.vdf'), 'utf8')), 'users') || {});
  } catch {}
  users = users.filter(([id, u]) => /^\d+$/.test(id) && isObj(u));
  const pick = users.find(([, u]) => String(get(u, 'MostRecent')) === '1')
    || users.sort((a, b) => Number(get(b[1], 'Timestamp') || 0) - Number(get(a[1], 'Timestamp') || 0))[0];
  if (pick) return toAccountId(pick[0]);
  // No loginusers.vdf: the account behind the most recently written stats file.
  let best = null;
  try {
    for (const f of fs.readdirSync(statsDir(root))) {
      const m = /^UserGameStats_(\d+)_\d+\.bin$/i.exec(f);
      const t = m && fs.statSync(path.join(statsDir(root), f)).mtimeMs;
      if (m && (!best || t > best.t)) best = { id: Number(m[1]), t };
    }
  } catch {}
  return best ? best.id : null;
}

// [{apiName, name, desc, icon, iconGray, hidden, statId, bit}] sorted by stat then bit; [] when not cached.
function readSchema(appid, root = steamRoot()) {
  const kv = root && readBin(path.join(statsDir(root), `UserGameStatsSchema_${Number(appid)}.bin`));
  const app = get(kv, String(Number(appid))) || Object.values(kv || {}).find(isObj);
  const out = [];
  for (const [sid, st] of Object.entries(get(app, 'stats') || {})) {
    const bits = get(st, 'bits');
    const type = String(get(st, 'type') ?? '4').toUpperCase();
    if (!isObj(bits) || !ACH_TYPES.has(type) || !/^\d+$/.test(sid)) continue;
    for (const [bk, b] of Object.entries(bits)) {
      const apiName = str(get(b, 'name'));
      const bit = Number(get(b, 'bit') ?? bk);
      if (!apiName || !Number.isInteger(bit) || bit < 0 || bit > 31) continue;
      const d = get(b, 'display');
      out.push({
        apiName,
        name: text(get(d, 'name')) || apiName,
        desc: text(get(d, 'desc')),
        icon: str(get(d, 'icon')),
        iconGray: str(get(d, 'icon_gray')),
        hidden: ['1', 'true'].includes(String(get(d, 'hidden')).toLowerCase()),
        statId: Number(sid),
        bit,
      });
    }
  }
  return out.sort((a, b) => a.statId - b.statId || a.bit - b.bit);
}

// {"<statId>:<bit>": unixSeconds} for every unlocked achievement. Keys don't need the schema, so they
// stay stable if Steam downloads it mid-session. An unlock needs a time and (when present) its data bit.
function readUnlockTimes(accountId, appid, root = steamRoot()) {
  if (!root || accountId == null) return {};
  const kv = readBin(path.join(statsDir(root), `UserGameStats_${Number(accountId)}_${Number(appid)}.bin`));
  const cache = get(kv, 'cache') || kv || {};
  const out = {};
  for (const [sid, st] of Object.entries(cache)) {
    const times = get(st, 'AchievementTimes');
    if (!isObj(times) || !/^\d+$/.test(sid)) continue;
    const data = get(st, 'data');
    for (const [bk, t] of Object.entries(times)) {
      const bit = Number(bk);
      if (!Number.isInteger(bit) || bit < 0 || bit > 31 || !(Number(t) > 0)) continue;
      if (typeof data === 'number' && !((data >>> bit) & 1)) continue;
      out[`${Number(sid)}:${bit}`] = Number(t);
    }
  }
  return out;
}

// {apiName: unixSeconds}; unlocks the schema can't name keep their "<statId>:<bit>" key.
function readUnlocks(accountId, appid, schema, root = steamRoot()) {
  const names = new Map((schema || readSchema(appid, root)).map((a) => [`${a.statId}:${a.bit}`, a.apiName]));
  const out = {};
  for (const [k, t] of Object.entries(readUnlockTimes(accountId, appid, root))) out[names.get(k) || k] = t;
  return out;
}

// Steam CDN URL of a schema icon file name (the CDN serves extension-less hashes as .jpg).
const iconUrl = (appid, icon) => {
  const m = typeof icon === 'string' && /^([\w-]+)(\.(jpe?g|png|gif))?$/i.exec(icon);
  return m ? `${CDN}${Number(appid)}/${m[1]}${m[2] || '.jpg'}` : null;
};

module.exports = { currentAccountId, toAccountId, readSchema, readUnlockTimes, readUnlocks, iconUrl, statsDir };
