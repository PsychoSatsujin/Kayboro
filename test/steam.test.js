// Unit tests for src/main/steam/** against a synthetic Steam install in a temp dir.
const { test, after } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');

const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'shellcade-steam-'));
const ROOT = path.join(tmp, 'Steam');
const LIB2 = path.join(tmp, 'Library2');
process.env.SHELLCADE_STEAM_ROOT = ROOT;
after(() => fs.rmSync(tmp, { recursive: true, force: true }));

const vdf = require('../src/main/steam/vdf');
const paths = require('../src/main/steam/paths');
const lib = require('../src/main/steam/library');
const ach = require('../src/main/steam/achievements');
const { AchievementWatcher } = require('../src/main/steam/watcher');
const selfStats = require('../src/main/steam/selfStats');

// ---- Tiny binary KeyValues encoder ----
const typed = (t, v) => ({ __t: t, v });
const cstr = (s) => Buffer.concat([Buffer.from(String(s), 'utf8'), Buffer.from([0])]);
function encodeTyped(t, v) {
  const b = Buffer.alloc(t === 7 || t === 10 ? 8 : 4);
  if (t === 1) return cstr(v);
  if (t === 5) return Buffer.concat([Buffer.from(v, 'utf16le'), Buffer.alloc(2)]);
  if (t === 3) b.writeFloatLE(v);
  else if (t === 7) b.writeBigUInt64LE(v);
  else if (t === 10) b.writeBigInt64LE(v);
  else b.writeInt32LE(v);
  return b;
}
function bkv(root, end = 8) {
  const out = [];
  const node = (o) => {
    for (const [k, v] of Object.entries(o)) {
      if (v && v.__t !== undefined) out.push(Buffer.from([v.__t]), cstr(k), encodeTyped(v.__t, v.v));
      else if (v && typeof v === 'object') {
        out.push(Buffer.from([0]), cstr(k));
        node(v);
        out.push(Buffer.from([end]));
      } else if (typeof v === 'string') out.push(Buffer.from([1]), cstr(k), cstr(v));
      else out.push(Buffer.from([Number.isInteger(v) ? 2 : 3]), cstr(k), encodeTyped(Number.isInteger(v) ? 2 : 3, v));
    }
  };
  node(root);
  out.push(Buffer.from([end]));
  return Buffer.concat(out);
}

const put = (f, data) => {
  fs.mkdirSync(path.dirname(f), { recursive: true });
  fs.writeFileSync(f, data);
};
const q = (s) => `"${String(s).replace(/\\/g, '\\\\')}"`;
const STATS = path.join(ROOT, 'appcache', 'stats');
const STEAMID = '76561197960287930';
const ACCT = 22202;

// Fixture: two libraries (the root listed twice), four games, loginusers, a 440 schema.
put(path.join(ROOT, 'steamapps', 'libraryfolders.vdf'), `"libraryfolders"
{
  "0" { "path" ${q(ROOT)} "apps" { "440" "123" } }
  "1" { "path" ${q(LIB2)} }
  "2" { "path" ${q(ROOT + path.sep)} }
  "3" { "path" ${q(path.join(tmp, 'missing'))} }
}`);
const manifest = (dir, appid, name, installdir) =>
  put(path.join(dir, 'steamapps', `appmanifest_${appid}.acf`), `"AppState"\n{\n\t"appid"\t\t"${appid}"\n\t"name"\t\t"${name}"\n\t"installdir"\t\t"${installdir}"\n}\n`);
manifest(ROOT, 440, 'Team Fortress 2', 'Team Fortress 2');
manifest(ROOT, 70, 'Half-Life', 'Half-Life');
manifest(ROOT, 220, 'Half-Life 2', 'Half-Life 2');
manifest(LIB2, 620, 'Portal 2', 'Portal 2');
put(path.join(ROOT, 'steamapps', 'appmanifest_999.acf'), '"AppState" { "appid" "999" '); // truncated, no installdir
put(path.join(ROOT, 'config', 'loginusers.vdf'), `"users"
{
  "76561197960265729" { "AccountName" "old" "MostRecent" "0" "Timestamp" "1700000000" }
  ${q(STEAMID)} { "AccountName" "me" "PersonaName" "Me" "MostRecent" "1" "Timestamp" "1600000000" }
}`);

const bitDef = (name, english, extra = {}) => ({
  name, display: { name: { english, token: `#${name}_NAME` }, desc: { english: `${english} desc` }, hidden: '0', icon: `${name.toLowerCase()}.jpg`, icon_gray: 'gray.jpg', ...extra },
});
const bits16 = Object.fromEntries(Array.from({ length: 16 }, (_, i) => [String(i), bitDef(`ACH_${i}`, `Achievement ${i}`)]));
bits16['3'].display.name = { french: 'Troisieme', token: '#T' };
bits16['4'].display.hidden = '1';
put(path.join(STATS, 'UserGameStatsSchema_440.bin'), bkv({
  440: {
    gamename: 'Team Fortress 2',
    stats: {
      1: { type: typed(2, 4), id: '1', bits: bits16 },
      2: { type: 'INT', name: 'kills', bits: { 0: bitDef('NOT_ACH', 'nope') } },
      3: { type: 'ACHIEVEMENTS', bits: { 0: { name: 'ACH_GROUP2', bit: 0, display: { name: 'Plain string name' } } } },
    },
  },
}));

// Writes UserGameStats for 440 with stat 1 unlocks {bit: unixSeconds} plus an int stat (no AchievementTimes).
const writeUnlocks = (times, kills = 0, account = ACCT, appid = 440) => {
  let data = 0;
  for (const b of Object.keys(times)) data |= 1 << Number(b);
  put(path.join(STATS, `UserGameStats_${account}_${appid}.bin`), bkv({
    cache: { crc: 1234, PendingChanges: 0, 1: { data, AchievementTimes: times }, 2: { data: kills } },
  }));
};

// ---- vdf ----

test('vdf.parseText: nesting, escapes, comments, unquoted tokens, conditionals', () => {
  const r = vdf.parseText(`\uFEFF// header
"Root" {
  "path"  "C:\\\\Program Files (x86)\\\\Steam"
  unquoted value  // trailing comment
  "quote" "a \\"b\\" c\\n"
  "win"  "1" [$WIN32]
  "Nested" { "Deep" { "k" "v" } }
}`);
  assert.equal(vdf.get(r, 'root', 'PATH'), 'C:\\Program Files (x86)\\Steam');
  assert.equal(vdf.get(r, 'Root', 'unquoted'), 'value');
  assert.equal(vdf.get(r, 'Root', 'quote'), 'a "b" c\n');
  assert.equal(vdf.get(r, 'Root', 'win'), '1');
  assert.equal(vdf.get(r, 'root', 'nested', 'deep', 'K'), 'v');
  assert.equal(vdf.get(r, 'Root', 'missing', 'x'), undefined);
  assert.equal(vdf.get(null, 'x'), undefined);
});

test('vdf.parseText: truncated input keeps what parsed, never throws', () => {
  const src = '"a" { "b" "1" "c" { "d" "2" } "e" "unterminated';
  for (let n = 0; n <= src.length; n++) assert.doesNotThrow(() => vdf.parseText(src.slice(0, n)));
  const r = vdf.parseText(src);
  assert.equal(r.a.b, '1');
  assert.equal(r.a.c.d, '2');
  assert.equal(r.a.e, 'unterminated');
  assert.deepEqual(Object.keys(vdf.parseText('')), []);
  assert.equal(vdf.parseText('"__proto__" "x"').__proto__, 'x'); // null-prototype objects
});

test('vdf.parseBinary: every type, both end markers', () => {
  const buf = bkv({
    root: {
      s: 'héllo', i: typed(2, -5), f: typed(3, 1.5), p: typed(4, 7), w: typed(5, 'wïde'), c: typed(6, 0x11223344),
      u: typed(7, 76561197960287930n), small: typed(7, 42n), n: typed(10, -9n), nested: { k: 'v' },
    },
  });
  const r = vdf.parseBinary(buf);
  assert.deepEqual({ ...r.root, nested: { ...r.root.nested } }, {
    s: 'héllo', i: -5, f: 1.5, p: 7, w: 'wïde', c: 0x11223344, u: '76561197960287930', small: 42, n: -9, nested: { k: 'v' },
  });
  const alt = vdf.parseBinary(bkv({ a: { b: 'c' }, d: 'e' }, 0x0b));
  assert.equal(alt.a.b, 'c');
  assert.equal(alt.d, 'e');
});

test('vdf.parseBinary: truncation and garbage never throw', () => {
  const buf = bkv({ app: { stats: { 1: { data: 3, AchievementTimes: { 0: 1700000000, 1: 1700000001 } } }, name: 'x' } });
  for (let n = 0; n <= buf.length; n++) assert.doesNotThrow(() => vdf.parseBinary(buf.subarray(0, n)));
  const half = vdf.parseBinary(buf.subarray(0, buf.length - 12));
  assert.equal(half.app.stats[1].data, 3);
  assert.deepEqual(Object.keys(vdf.parseBinary(Buffer.from([0x42, 0x41, 0x00, 1, 2]))), []); // unknown type byte
  assert.doesNotThrow(() => vdf.parseBinary(Buffer.alloc(200, 0))); // deep nesting is capped
  assert.deepEqual(Object.keys(vdf.parseBinary(null)), []);
});

// ---- paths ----

test('paths: env override and reg query parsing', () => {
  assert.equal(paths.steamRoot(), path.resolve(ROOT));
  assert.equal(paths.steamPath('config'), path.join(path.resolve(ROOT), 'config'));
  const out = '\r\nHKEY_CURRENT_USER\\Software\\Valve\\Steam\r\n    SteamPath    REG_SZ    c:/program files (x86)/steam\r\n\r\n';
  assert.equal(paths.parseRegValue(out, 'SteamPath'), 'c:/program files (x86)/steam');
  assert.equal(paths.parseRegValue('    ActiveUser    REG_DWORD    0x56ba\r\n', 'activeuser'), 0x56ba);
  assert.equal(paths.parseRegValue(out, 'Other'), null);
  assert.equal(paths.parseRegValue('', 'SteamPath'), null);
  if (process.platform !== 'win32') assert.equal(paths.regQuery('HKCU\\Software\\Valve\\Steam', 'SteamPath'), null);
});

// ---- library ----

test('library: libraries are deduped, missing ones dropped', () => {
  assert.deepEqual(lib.libraries(), [ROOT, LIB2].map((p) => path.resolve(p)));
  assert.deepEqual(lib.libraries(null), []);
});

test('library: installed apps from every library', () => {
  const apps = lib.installedApps();
  assert.deepEqual(apps.map((a) => a.appid).sort((a, b) => a - b), [70, 220, 440, 620]);
  assert.deepEqual(apps.find((a) => a.appid === 620), { appid: 620, name: 'Portal 2', installdir: 'Portal 2', libraryPath: path.resolve(LIB2) });
});

test('library: appForExe matches the install dir, case- and slash-insensitive', () => {
  const apps = lib.installedApps();
  const id = (exe) => (lib.appForExe(exe, apps) || {}).appid ?? null;
  assert.equal(id(path.join(ROOT, 'steamapps', 'common', 'Team Fortress 2', 'hl2.exe')), 440);
  assert.equal(id(path.join(ROOT, 'steamapps', 'common', 'Half-Life 2', 'bin', 'hl2.exe')), 220); // not "Half-Life"
  assert.equal(id(path.join(ROOT, 'steamapps', 'common', 'Half-Life', 'hl.exe')), 70);
  assert.equal(id(path.join(LIB2, 'STEAMAPPS', 'Common', 'portal 2', 'portal2.exe').toUpperCase()), 620);
  assert.equal(id(path.join(ROOT, 'steamapps', 'common', 'Unknown', 'x.exe')), null);
  assert.equal(id(path.join(ROOT, 'steamapps', 'common', 'Team Fortress 2')), null); // the folder itself
  assert.equal(id(''), null);
  assert.equal(lib.appForExe(null), null);

  const win = [{ appid: 620, name: 'Portal 2', installdir: 'Portal 2', libraryPath: 'D:\\SteamLibrary' }];
  assert.equal(lib.appForExe('d:\\steamlibrary\\steamapps\\common\\Portal 2\\portal2.exe', win).appid, 620);
  assert.equal(lib.appForExe('\\\\?\\D:\\SteamLibrary\\steamapps\\common\\PORTAL 2\\bin\\win64\\portal2.exe', win).appid, 620);
  assert.equal(lib.appForExe('D:/SteamLibrary//steamapps/common/Portal 2/portal2.exe', win).appid, 620);
  // Library seen under another path (symlink, remapped drive): falls back to the common/<installdir> segment.
  assert.equal(lib.appForExe('E:\\Games\\steamapps\\common\\Portal 2\\portal2.exe', win).appid, 620);
  assert.equal(lib.appForExe('D:\\SteamLibrary\\steamapps\\common\\Portal 2 Demo\\p.exe', win), null);
});

// ---- achievements ----

test('achievements: account id from loginusers, with fallbacks', () => {
  assert.equal(ach.toAccountId(STEAMID), ACCT);
  assert.equal(ach.toAccountId('garbage'), null);
  assert.equal(ach.currentAccountId(), ACCT);

  const r2 = path.join(tmp, 'Steam2');
  put(path.join(r2, 'config', 'loginusers.vdf'), `"users" { "76561197960265729" { "Timestamp" "10" } "76561197960265730" { "Timestamp" "20" } }`);
  assert.equal(ach.currentAccountId(r2), 2); // newest Timestamp when nobody is MostRecent

  const r3 = path.join(tmp, 'Steam3');
  put(path.join(r3, 'appcache', 'stats', 'UserGameStats_555_10.bin'), bkv({ cache: {} }));
  assert.equal(ach.currentAccountId(r3), 555); // no loginusers.vdf: owner of the stats files
  assert.equal(ach.currentAccountId(path.join(tmp, 'nothing')), null);
  assert.equal(ach.currentAccountId(null), null);
});

test('achievements: readSchema names, descriptions, icons, hidden flag', () => {
  const s = ach.readSchema(440);
  assert.equal(s.length, 17); // 16 bits in stat 1 + 1 in stat 3; the INT stat's bits are ignored
  assert.deepEqual(s[2], {
    apiName: 'ACH_2', name: 'Achievement 2', desc: 'Achievement 2 desc', icon: 'ach_2.jpg', iconGray: 'gray.jpg', hidden: false, statId: 1, bit: 2,
  });
  assert.equal(s[3].name, 'Troisieme'); // no english: another language before the #token
  assert.equal(s[4].hidden, true);
  assert.deepEqual(s.at(-1), { apiName: 'ACH_GROUP2', name: 'Plain string name', desc: '', icon: '', iconGray: '', hidden: false, statId: 3, bit: 0 });
  assert.ok(!s.some((a) => a.apiName === 'NOT_ACH'));
  assert.deepEqual(ach.readSchema(12345), []);
  assert.equal(ach.iconUrl(440, 'abc_1.jpg'), 'https://cdn.cloudflare.steamstatic.com/steamcommunity/public/images/apps/440/abc_1.jpg');
  assert.equal(ach.iconUrl(440, 'abc'), 'https://cdn.cloudflare.steamstatic.com/steamcommunity/public/images/apps/440/abc.jpg');
  assert.equal(ach.iconUrl(440, '../x.jpg'), null);
  assert.equal(ach.iconUrl(440, ''), null);
});

test('achievements: readUnlocks needs a time and a set data bit', () => {
  put(path.join(STATS, `UserGameStats_${ACCT}_440.bin`), bkv({
    cache: {
      crc: 1, PendingChanges: 0,
      1: { data: typed(2, (1 << 0) | (1 << 2) | (1 << 31)), AchievementTimes: { 0: 1600000000, 1: 1600000100, 2: 1600000200, 31: 1600000300, 5: 0 } },
      2: { data: 255 }, // an int stat: no AchievementTimes, not achievements
      9: { AchievementTimes: { 0: 1600000400 } }, // no data bitfield: the time alone counts
    },
  }));
  assert.deepEqual(ach.readUnlockTimes(ACCT, 440), { '1:0': 1600000000, '1:2': 1600000200, '1:31': 1600000300, '9:0': 1600000400 });
  assert.deepEqual(ach.readUnlocks(ACCT, 440), { ACH_0: 1600000000, ACH_2: 1600000200, '1:31': 1600000300, '9:0': 1600000400 });
  assert.deepEqual(ach.readUnlocks(1, 440), {});
  assert.deepEqual(ach.readUnlocks(null, 440), {});
  fs.writeFileSync(path.join(STATS, `UserGameStats_${ACCT}_440.bin`), Buffer.from([0, 0x63, 0x61])); // corrupt
  assert.deepEqual(ach.readUnlocks(ACCT, 440), {});
});

// ---- watcher ----

const T0 = 1700000000; // session start, unix seconds
function watch(opts = {}) {
  const clock = { t: T0 * 1000 };
  const w = new AchievementWatcher({ pollMs: 3600e3, now: () => clock.t, ...opts });
  const events = [];
  w.on('unlock', (e) => events.push(['unlock', e]));
  return { w, clock, events };
}

test('watcher: emits only achievements unlocked during the session, once', () => {
  writeUnlocks({ 0: T0 - 86400, 1: T0 - 3600 });
  const { w, events } = watch();
  assert.equal(w.start({ appid: 440, name: 'Team Fortress 2', sessionStart: T0 * 1000 }), true);
  assert.equal(w.check(), 0);

  // 2: new; 3: synced from another PC long ago; 5: just before start (within the grace window); kills changed.
  writeUnlocks({ 0: T0 - 86400, 1: T0 - 3600, 2: T0 + 30, 3: T0 - 7200, 5: T0 - 20 }, 99);
  assert.equal(w.check(), 2);
  assert.deepEqual(events.map(([, e]) => e.apiName), ['ACH_2', 'ACH_5']);
  assert.deepEqual(events[0], ['unlock', {
    appid: 440, game: 'Team Fortress 2', apiName: 'ACH_2', name: 'Achievement 2', desc: 'Achievement 2 desc',
    iconUrl: 'https://cdn.cloudflare.steamstatic.com/steamcommunity/public/images/apps/440/ach_2.jpg', unlockedAt: (T0 + 30) * 1000,
  }]);
  assert.equal(w.check(), 0); // no repeats
  w.stop();
  assert.equal(w.running, false);
  assert.equal(w.check(), 0);
});

test('watcher: many unlocks at once are all reported', () => {
  writeUnlocks({ 0: T0 - 86400 });
  const { w, events } = watch();
  w.start({ appid: 440, name: 'TF2', sessionStart: T0 }); // unix seconds are accepted too
  const many = { 0: T0 - 86400 };
  for (let b = 1; b <= 11; b++) many[b] = T0 + b;
  writeUnlocks(many);
  assert.equal(w.check(), 11);
  assert.deepEqual(events.map(([k, e]) => `${k}:${e.apiName}`), Array.from({ length: 11 }, (_, i) => `unlock:ACH_${i + 1}`));
  assert.equal(events[0][1].game, 'TF2');
  w.stop();
});

test('watcher: stop() flushes unlocks written as the game exits', () => {
  writeUnlocks({});
  const { w, events } = watch();
  w.start({ appid: 440, name: 'TF2', sessionStart: T0 * 1000 });
  writeUnlocks({ 6: T0 + 5 });
  w.stop();
  assert.deepEqual(events.map(([, e]) => e.apiName), ['ACH_6']);
});

test('watcher: unknown achievements (schema not cached) still emit with their stat key', () => {
  const { w, events } = watch();
  w.start({ appid: 777, name: 'No Schema', sessionStart: T0 * 1000 });
  writeUnlocks({ 4: T0 + 1 }, 0, ACCT, 777);
  assert.equal(w.check(), 1);
  assert.deepEqual(events[0][1], { appid: 777, game: 'No Schema', apiName: '1:4', name: 'Achievement unlocked', desc: '', iconUrl: null, unlockedAt: (T0 + 1) * 1000 });
  w.stop();
});

test('watcher: picks up changes on its own (fs.watch / poll)', async () => {
  writeUnlocks({});
  const w = new AchievementWatcher({ pollMs: 40, debounceMs: 10 });
  assert.equal(w.start({ appid: 440, name: 'TF2' }), true);
  let timer;
  const got = new Promise((resolve, reject) => {
    w.once('unlock', resolve);
    timer = setTimeout(() => reject(new Error('no unlock event')), 3000);
  });
  writeUnlocks({ 7: Math.floor(Date.now() / 1000) });
  try {
    assert.equal((await got).apiName, 'ACH_7');
  } finally {
    clearTimeout(timer);
    w.stop();
  }
});

test('watcher: refuses bad input', () => {
  const w = new AchievementWatcher();
  assert.equal(w.start({}), false);
  assert.equal(w.start({ appid: 'abc' }), false);
  assert.equal(w.running, false);
  w.stop();
});

test('selfStats: a safe no-op without steamworks.js', () => {
  assert.equal(typeof selfStats.available, 'boolean');
  if (!selfStats.available) {
    assert.equal(selfStats.unlock('ACH_X'), false);
    assert.equal(selfStats.isUnlocked('ACH_X'), false);
  }
  assert.equal(selfStats.unlock(''), false);
});

test('steam index re-exports the modules', () => {
  const steam = require('../src/main/steam');
  for (const k of ['steamRoot', 'libraries', 'installedApps', 'appForExe', 'currentAccountId', 'readSchema', 'readUnlocks', 'AchievementWatcher', 'selfStats'])
    assert.ok(steam[k], k);
});
