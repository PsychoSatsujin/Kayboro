'use strict';
// Mods: <userData>/shellcade/mods/<folder>/mod.json adds frames, wallpapers, fills and colorways.
// Mod items are free and owned. Their files are resolved inside the mod folder and handed to the
// renderer as file:// URLs. A broken mod.json skips the mod, a broken item skips the item; both are
// listed in the mod's `errors`.
const fs = require('fs');
const path = require('path');
const { pathToFileURL } = require('url');
const { normWallpaper, SCREENSAVERS, MEDIA, ID, HEX } = require('./catalog');

const MOD_ID = /^[a-z0-9][a-z0-9-]{0,63}$/;
const KINDS = ['frames', 'wallpapers', 'fills', 'colorways'];
const RARITY = ['common', 'rare', 'epic', 'legendary'];
const FRAME_FILE = /\.(?:svg|png|webp)$/i;
const FILTER = /^[\w\s().,%#-]{1,300}$/; // CSS filter functions, no url()
const MAX_JSON = 1 << 20;

const str = (s, max = 200) => (typeof s === 'string' ? s.replace(/[\u0000-\u001f\u007f]/g, '').trim().slice(0, max) : '');
const frac = (n) => typeof n === 'number' && n >= 0 && n <= 1;
const hexes = (a, n) => (Array.isArray(a) ? a.filter((c) => typeof c === 'string' && HEX.test(c)).slice(0, n) : []);

// (rel, re) -> file:// URL of an existing file inside dir whose name matches re, else null.
function resolver(dir) {
  const root = path.resolve(dir);
  return (rel, re) => {
    if (typeof rel !== 'string' || !rel || !re.test(rel)) return null;
    const f = path.resolve(root, rel);
    if (!f.startsWith(root + path.sep)) return null;
    try {
      return fs.statSync(f).isFile() ? pathToFileURL(f).href : null;
    } catch {
      return null;
    }
  };
}

const BUILD = {
  frames(it, resolve) {
    const sz = it.size || {}, h = it.hole || {};
    if (!(sz.w > 0 && sz.h > 0)) throw new Error('size needs w and h above 0');
    if (![h.x, h.y, h.w, h.h].every(frac) || !(h.w > 0 && h.h > 0) || h.x + h.w > 1.001 || h.y + h.h > 1.001) throw new Error('hole must be x, y, w, h fractions of size');
    const url = resolve(it.file, FRAME_FILE);
    if (!url) throw new Error(`file "${str(it.file)}" not found (an svg, png or webp inside the mod folder)`);
    return {
      kind: 'frame', style: it.style === 'pixel' ? 'pixel' : 'vector', theme: str(it.theme, 40), file: String(it.file), url,
      size: { w: Number(sz.w), h: Number(sz.h) }, hole: { x: h.x, y: h.y, w: h.w, h: h.h }, holeRadius: frac(it.holeRadius) ? it.holeRadius : 0,
      aspect: Number(it.aspect) > 0 ? Number(it.aspect) : (h.w * sz.w) / (h.h * sz.h), translucent: !!it.translucent,
    };
  },
  wallpapers(it, resolve) {
    const w = normWallpaper(it, resolve);
    if (!w) throw new Error('media needs type video, image or gif with a file inside the mod folder (or type screensaver with a fill id)');
    return w;
  },
  fills(it, resolve) {
    const colors = hexes(it.colors, 6);
    if (it.media) {
      const type = String(it.media.type || '').toLowerCase();
      const url = type !== 'preview' && MEDIA[type] ? resolve(it.media.file, MEDIA[type]) : null;
      if (!url) throw new Error('media needs type video, image or gif with a file inside the mod folder');
      return { kind: 'fill', colors, media: { type, file: String(it.media.file), url } };
    }
    if (!SCREENSAVERS.includes(it.base)) throw new Error(`base must be one of ${SCREENSAVERS.join(', ')} (or give media)`);
    return { kind: 'fill', base: it.base, colors };
  },
  colorways(it) {
    const filter = it.filter == null ? 'none' : String(it.filter);
    if (!FILTER.test(filter) || /url\s*\(/i.test(filter)) throw new Error('filter must be plain CSS filter functions, e.g. "hue-rotate(90deg) saturate(1.2)"');
    const opacity = it.opacity == null ? 1 : Number(it.opacity);
    if (!(opacity >= 0.05 && opacity <= 1)) throw new Error('opacity must be between 0.05 and 1');
    return { kind: 'colorway', swatch: hexes(it.swatch, 4), filter, opacity, translucent: !!it.translucent || opacity < 1 };
  },
};

function readModJson(dir) {
  const f = path.join(dir, 'mod.json');
  if (fs.statSync(f).size > MAX_JSON) throw new Error('mod.json is larger than 1 MB');
  const m = JSON.parse(fs.readFileSync(f, 'utf8').replace(/^﻿/, ''));
  if (!m || typeof m !== 'object' || Array.isArray(m)) throw new Error('mod.json must be an object');
  if (typeof m.id !== 'string' || !MOD_ID.test(m.id)) throw new Error('id must be lowercase letters, digits and dashes');
  return m;
}

// Scans modsDir. `reserved`: ids the catalog already uses. Returns {mods: [summary], frames, wallpapers, fills, colorways}.
function loadMods(modsDir, { reserved = new Set() } = {}) {
  const out = { mods: [], frames: [], wallpapers: [], fills: [], colorways: [] };
  let folders = [];
  try {
    folders = fs.readdirSync(modsDir, { withFileTypes: true }).filter((d) => d.isDirectory()).map((d) => d.name).sort();
  } catch {
    return out;
  }
  const used = new Set(reserved);
  const modIds = new Set();
  for (const folder of folders) {
    const dir = path.join(modsDir, folder);
    let m;
    try {
      m = readModJson(dir);
      if (modIds.has(m.id)) throw new Error(`another mod already uses id "${m.id}"`);
    } catch (err) {
      const msg = err.code === 'ENOENT' ? 'mod.json is missing' : `mod.json: ${err.message}`;
      console.warn(`[shell] mod "${folder}" skipped: ${msg}`);
      out.mods.push({ id: folder, name: folder, author: '', version: '', description: '', path: dir, items: 0, errors: [msg], skipped: true });
      continue;
    }
    modIds.add(m.id);
    const mod = { id: m.id, name: str(m.name) || m.id, author: str(m.author) };
    const summary = { ...mod, version: str(m.version, 40), description: str(m.description, 500), path: dir, items: 0, errors: [], skipped: false };
    const resolve = resolver(dir);
    for (const kind of KINDS) {
      const list = m[kind] == null ? [] : m[kind];
      if (!Array.isArray(list)) {
        summary.errors.push(`${kind} must be a list`);
        continue;
      }
      list.forEach((it, i) => {
        const label = `${kind}[${i}]${it && typeof it.id === 'string' ? ` "${str(it.id, 64)}"` : ''}`;
        try {
          if (!it || typeof it !== 'object' || typeof it.id !== 'string' || !ID.test(it.id)) throw new Error('id must be letters, digits, _ or -');
          if (used.has(it.id)) throw new Error('id is already used by the catalog or another mod');
          const built = BUILD[kind](it, resolve);
          out[kind].push({
            ...built, id: it.id, name: str(it.name) || it.id, desc: str(it.desc, 500), rarity: RARITY.includes(it.rarity) ? it.rarity : 'common',
            tags: Array.isArray(it.tags) ? it.tags.filter((t) => typeof t === 'string').slice(0, 12) : [],
            author: mod.author || str(it.author) || mod.name, price: null, unlockLevel: null, starter: false, mod,
          });
          used.add(it.id);
          summary.items++;
        } catch (err) {
          summary.errors.push(`${label}: ${err.message}`);
        }
      });
    }
    if (summary.errors.length) console.warn(`[shell] mod "${m.id}": ${summary.errors.join('; ')}`);
    out.mods.push(summary);
  }
  return out;
}

module.exports = { loadMods, resolver, MOD_ID };
