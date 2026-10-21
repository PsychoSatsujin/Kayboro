// Saved configurations (presets and game setups): the whole stage plus the shell effect switches.
// Pure helpers, unit tested in test/setups.test.js. Main checks and stores them (src/main/setups.js).

const SOURCE = ['sourceId', 'sourceName', 'hwnd', 'exePath'];
const NO_SOURCE = { sourceId: null, sourceName: '', hwnd: null, exePath: null };
const plain = o => JSON.parse(JSON.stringify(o));

// What gets saved: every screen (shell, skin, colour, finish, fill, clarity, layout, pop-out spot), the
// background or wallpaper, and the effect switches. Game windows are not saved: they only exist while running.
export function captureConfig(scene, fx) {
  const sc = plain(scene);
  sc.screens = sc.screens.map(s => ({ ...s, ...NO_SOURCE }));
  return { version: 1, scene: sc, fx: fx ? { particles: fx.particles !== false, glass: fx.glass !== false, depth: fx.depth !== false } : null };
}

// The scene a configuration loads into, keeping the games on screen now: the hosted game first, then the
// others top to bottom, go to the saved screens in the same order (the selected one first).
// reserveSelected: the selected screen is left empty for a game about to go there (a game setup loading at launch).
// A wallpaper-only preset (from before full presets) changes only the background.
export function sceneFromConfig(config, current, hostedId = null, { reserveSelected = false } = {}) {
  if (!config) return null;
  if (!config.scene) {
    if (!config.wallpaper || !current) return null;
    return { ...plain(current), background: { ...current.background, type: 'wallpaper', ref: { ...config.wallpaper } } };
  }
  const sc = plain(config.scene);
  if (!Array.isArray(sc.screens)) return null;
  const live = (current?.screens || []).filter(s => s.sourceId)
    .sort((a, b) => (b.id === hostedId) - (a.id === hostedId) || b.z - a.z);
  const order = [...sc.screens].sort((a, b) => (b.id === sc.selectedId) - (a.id === sc.selectedId) || b.z - a.z);
  for (const s of sc.screens) Object.assign(s, NO_SOURCE);
  const skip = reserveSelected ? 1 : 0;
  order.forEach((s, i) => { const g = i >= skip && live[i - skip]; if (g) for (const k of SOURCE) s[k] = g[k] ?? NO_SOURCE[k]; });
  return sc;
}

// The game a screen shows, as a setup link { appid, exe, name }, or null for a screen or a non-program source.
export function gameOf(s, appid = null) {
  if (!s?.exePath && !appid) return null;
  const exe = s?.exePath ? String(s.exePath).split(/[\\/]/).pop().toLowerCase() : null;
  const name = String(s?.sourceName || '').trim().slice(0, 120) || (exe ? exe.replace(/\.exe$/, '') : `App ${appid}`);
  return { appid: appid || null, exe, name };
}

// One line about a saved configuration: "2 screens · Neko TV, Pixel Arcade" or "Wallpaper only".
export function describe(summary, nameOf = id => id) {
  if (!summary) return '';
  if (summary.wallpaperOnly) return 'Wallpaper only';
  const shells = summary.frames.map(id => (id === 'custom' ? 'Custom shell' : nameOf(id))).filter(Boolean);
  const n = summary.screens;
  return [`${n} screen${n === 1 ? '' : 's'}`, shells.slice(0, 2).join(', ') + (shells.length > 2 ? ` +${shells.length - 2}` : '')].filter(Boolean).join(' · ');
}
