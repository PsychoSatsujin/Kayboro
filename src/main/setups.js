'use strict';
// Saved configurations: everything on the stage (every screen with its shell, skin, colour, finish, fill,
// clarity and layout, the background or wallpaper) plus the shell effect switches.
//   - Presets: bought slots in the economy (economy.js keeps them; this module checks what goes in).
//   - Game setups: free and unlimited, kept in <userData>/setups.json. One linked to a game (Steam app id
//     and/or program file name) is loaded automatically when that game launches.
// Old named scenes (<userData>/scenes.json) become setups with no game linked, once, on first read.
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const MAX_BYTES = 256 * 1024; // a scene with a dozen screens is ~10 KB
const MAX_SCREENS = 32;
const MAX_SETUPS = 500;
const FX = ['particles', 'glass', 'depth'];

const plainObject = (o) => !!o && typeof o === 'object' && !Array.isArray(o);
const cleanName = (n) => (typeof n === 'string' && n.trim() && n.length <= 120 && !/[\u0000-\u001f]/.test(n) ? n.trim() : null);

// A saved configuration { version: 1, scene, fx }, or null when malformed. The renderer normalizes the scene
// again when it loads one; here it only has to be the right shape and size. Old wallpaper-only presets are
// { version: 1, wallpaper: ref } (the caller checks the ref).
function cleanConfig(c) {
  if (!plainObject(c)) return null;
  let json;
  try { json = JSON.stringify(c); } catch { return null; }
  if (!json || json.length > MAX_BYTES) return null;
  const copy = JSON.parse(json);
  if (plainObject(copy.wallpaper) && !copy.scene) return { version: 1, wallpaper: copy.wallpaper };
  const sc = copy.scene;
  if (!plainObject(sc) || !Array.isArray(sc.screens) || sc.screens.length > MAX_SCREENS || !sc.screens.every(plainObject)) return null;
  const fx = plainObject(copy.fx) ? Object.fromEntries(FX.map((k) => [k, copy.fx[k] !== false])) : null;
  return { version: 1, scene: sc, fx };
}

// What a configuration shows, for tiles and lists: { screens, frames: [shell ids], background, wallpaperOnly }.
function summarize(c) {
  if (!c) return null;
  if (!c.scene) return { screens: 0, frames: [], background: 'wallpaper', wallpaperOnly: true };
  const frames = c.scene.screens.map((s) => (s.customFrame ? 'custom' : typeof s.frame === 'string' ? s.frame : null)).filter(Boolean);
  const bg = plainObject(c.scene.background) && typeof c.scene.background.type === 'string' ? c.scene.background.type.slice(0, 20) : 'color';
  return { screens: c.scene.screens.length, frames: [...new Set(frames)].slice(0, 8), background: bg, wallpaperOnly: false };
}

// The program part of an exe path, lower case ("C:\Games\Foo\foo.exe" -> "foo.exe").
function exeName(p) {
  if (typeof p !== 'string' || !p || p.length > 1024) return null;
  const base = p.split(/[\\/]/).pop().trim().toLowerCase();
  return base && base.length <= 260 && !/[\u0000-\u001f]/.test(base) ? base : null;
}

// A game link { appid, exe, name }: a Steam app id and/or a program file name; null when it has neither.
function cleanGame(g) {
  if (!plainObject(g)) return null;
  const appid = Number.isSafeInteger(Number(g.appid)) && Number(g.appid) > 0 ? Number(g.appid) : null;
  const exe = exeName(g.exe);
  if (!appid && !exe) return null;
  return { appid, exe, name: cleanName(g.name) || (exe ? exe.replace(/\.exe$/, '') : `App ${appid}`) };
}

// The game setup for a launched game ({ appid, exePath }): a match on the Steam app id first, then on the
// program name; the most recently saved wins.
function matchGame(setups, ev) {
  if (!ev) return null;
  const appid = Number(ev.appid) || null, exe = exeName(ev.exePath || ev.exe);
  const linked = setups.filter((s) => s.game).sort((a, b) => b.savedAt - a.savedAt);
  return (appid && linked.find((s) => s.game.appid === appid)) || (exe && linked.find((s) => s.game.exe === exe)) || null;
}

function create({ dir, now = Date.now } = {}) {
  const file = path.join(dir, 'setups.json');
  const scenesFile = path.join(dir, 'scenes.json');
  let cache = null;

  const meta = (s) => ({ id: s.id, name: s.name, game: s.game, savedAt: s.savedAt, summary: summarize(s.config) });

  function clean(raw) {
    const out = [];
    for (const s of Array.isArray(raw) ? raw : []) {
      const name = cleanName(s && s.name), config = cleanConfig(s && s.config);
      if (!name || !config || !config.scene || typeof s.id !== 'string' || !/^[a-z0-9]{6,32}$/.test(s.id)) continue;
      out.push({ id: s.id, name, game: cleanGame(s.game), savedAt: Number(s.savedAt) || 0, config });
    }
    return out.slice(0, MAX_SETUPS);
  }

  // Old named scenes, once: each becomes a setup with no game linked (scenes.json is left as it was).
  function fromScenes() {
    let scenes, at = now();
    try { scenes = JSON.parse(fs.readFileSync(scenesFile, 'utf8')); at = fs.statSync(scenesFile).mtimeMs; } catch { return []; }
    if (!plainObject(scenes)) return [];
    return clean(Object.entries(scenes).map(([name, scene]) => ({ id: newId(), name, game: null, savedAt: Math.floor(at), config: { version: 1, scene, fx: null } })));
  }

  function read() {
    if (cache) return cache;
    try {
      cache = clean(JSON.parse(fs.readFileSync(file, 'utf8')));
    } catch (err) {
      if (err.code !== 'ENOENT') console.error('[setups] setups.json unreadable:', err.message);
      cache = fromScenes();
      if (cache.length) write(cache);
    }
    return cache;
  }

  function write(list) {
    try {
      fs.mkdirSync(dir, { recursive: true });
      fs.writeFileSync(file + '.tmp', JSON.stringify(list));
      fs.renameSync(file + '.tmp', file); // atomic replace
      cache = list;
      return true;
    } catch (err) {
      console.error('[setups] write failed:', err);
      return false;
    }
  }

  return {
    list: () => read().map(meta).sort((a, b) => a.name.localeCompare(b.name)),
    load: (id) => read().find((s) => s.id === id) || null,
    // { id?, name, game, config }: updates the setup with that id (or that name), else adds one. Returns its meta.
    save(input) {
      if (!plainObject(input)) return null;
      const name = cleanName(input.name), config = cleanConfig(input.config);
      if (!name || !config || !config.scene) return null;
      const list = read().slice();
      const i = list.findIndex((s) => (typeof input.id === 'string' && s.id === input.id) || s.name === name);
      if (i < 0 && list.length >= MAX_SETUPS) return null;
      const s = { id: i >= 0 ? list[i].id : newId(), name, game: cleanGame(input.game), savedAt: now(), config };
      if (i >= 0) list[i] = s; else list.push(s);
      return write(list) ? meta(s) : null;
    },
    remove(id) {
      const list = read().filter((s) => s.id !== id);
      return list.length !== read().length && write(list);
    },
    forGame: (ev) => matchGame(read(), ev),
    // Program names some setup is linked to (launch detection looks for these as well as Steam games).
    exes: () => new Set(read().map((s) => s.game && s.game.exe).filter(Boolean)),
  };
}

const newId = () => crypto.randomBytes(6).toString('hex');

module.exports = { create, cleanConfig, cleanGame, summarize, matchGame, exeName, MAX_BYTES };
