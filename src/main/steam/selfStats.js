'use strict';
// Kayboro's own Steam achievements and DLC (for the Steam release). Uses steamworks.js when it is
// installed and Steam is running; otherwise every call is a no-op. The app id comes from
// KAYBORO_STEAM_APPID or steamworks.js's own steam_appid.txt lookup.
// Unlocks never happen in the tester sandbox (KAYBORO_SANDBOX=1) or in test runs (KAYBORO_TEST=1).
let sw = null;
try {
  sw = require('steamworks.js');
} catch {}

const RETRY_MS = 30e3; // Steam not running: try init again no sooner than this

let client = null, failedAt = 0;
function getClient(now = Date.now()) {
  if (!client && sw && now - failedAt >= RETRY_MS) {
    try {
      client = sw.init(Number(process.env.KAYBORO_STEAM_APPID) || undefined);
    } catch {
      client = null;
      failedAt = now;
    }
  }
  return client;
}

const call = (fn) => {
  try {
    const c = getClient();
    return c ? !!fn(c) : false;
  } catch {
    return false;
  }
};
const valid = (n) => typeof n === 'string' && /^[\w.-]{1,128}$/.test(n);
const muted = (env = process.env) => env.KAYBORO_SANDBOX === '1' || env.KAYBORO_TEST === '1';

module.exports = {
  available: !!sw,
  muted,
  unlock: (apiName) => !muted() && valid(apiName) && call((c) => c.achievement.activate(apiName)),
  isUnlocked: (apiName) => valid(apiName) && call((c) => c.achievement.isActivated(apiName)),
  // Persists stat/achievement changes right away (Steam also stores them on exit).
  store: () => call((c) => c.stats.store()),
  // Steam DLC (catalog items with "dlc": {"appid": N}): installed for this account?
  ownsDlc: (appid) => Number.isSafeInteger(appid) && appid > 0 && call((c) => c.apps.isDlcInstalled(appid)),
  // The Steam client is up and the API initialised (false without steamworks.js or outside Steam).
  connected: () => !!getClient(),
};
