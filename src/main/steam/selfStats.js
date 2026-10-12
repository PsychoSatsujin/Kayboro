'use strict';
// Shellcade's own Steam achievements (for the Steam release). Uses steamworks.js when it is installed
// and Steam is running; otherwise every call is a no-op. The app id comes from SHELLCADE_STEAM_APPID or
// steamworks.js's own steam_appid.txt lookup.
let sw = null;
try {
  sw = require('steamworks.js');
} catch {}

let client = null;
function getClient() {
  if (!client && sw) {
    try {
      client = sw.init(Number(process.env.SHELLCADE_STEAM_APPID) || undefined);
    } catch {
      client = null; // Steam not running: retried on the next call
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

module.exports = {
  available: !!sw,
  unlock: (apiName) => valid(apiName) && call((c) => c.achievement.activate(apiName)),
  isUnlocked: (apiName) => valid(apiName) && call((c) => c.achievement.isActivated(apiName)),
};
