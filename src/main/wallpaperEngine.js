'use strict';
// The user's own Wallpaper Engine wallpapers, read from disk: workshop subscriptions
// (steamapps/workshop/content/431960) and projects they made (wallpaper_engine/projects/myprojects).
// Only video and image wallpapers can be shown as a Shellcade backdrop; scene/web ones need Wallpaper Engine.
const fs = require('fs');
const path = require('path');
const { pathToFileURL } = require('url');
const { libraries } = require('./steam/library');

const WE_APPID = '431960';
const VIDEO = new Set(['.mp4', '.webm', '.m4v', '.mov']);
const IMAGE = new Set(['.png', '.jpg', '.jpeg', '.gif', '.webp', '.bmp']);
const TYPES = new Set(['video', 'scene', 'web', 'image']);
const PREVIEWS = ['preview.gif', 'preview.jpg', 'preview.jpeg', 'preview.png', 'preview.webp'];

// A file in dir named by an untrusted project.json field; null when missing or outside dir.
function inside(dir, name) {
  if (typeof name !== 'string' || !name) return null;
  const f = path.resolve(dir, name);
  if (!f.startsWith(dir + path.sep)) return null;
  try {
    return fs.statSync(f).isFile() ? f : null;
  } catch {
    return null;
  }
}

function readProject(dir, id) {
  let p;
  try {
    if (fs.statSync(path.join(dir, 'project.json')).size > 1 << 20) return null;
    p = JSON.parse(fs.readFileSync(path.join(dir, 'project.json'), 'utf8').replace(/^﻿/, ''));
  } catch {
    return null;
  }
  if (!p || typeof p !== 'object') return null;
  const file = inside(dir, p.file);
  const ext = file ? path.extname(file).toLowerCase() : '';
  let type = String(p.type || '').toLowerCase();
  if (!TYPES.has(type)) type = VIDEO.has(ext) ? 'video' : IMAGE.has(ext) ? 'image' : null;
  if (!type) return null; // applications and unknown kinds
  const usable = (type === 'video' && VIDEO.has(ext)) || (type === 'image' && IMAGE.has(ext));
  const preview = inside(dir, p.preview) || PREVIEWS.map((n) => inside(dir, n)).find(Boolean);
  const title = String(p.title || '').replace(/[\u0000-\u001f\u007f]/g, '').trim().slice(0, 200) || id;
  return { id, title, type, previewUrl: preview ? pathToFileURL(preview).href : null, fileUrl: usable ? pathToFileURL(file).href : null, usable };
}

// Usable wallpapers first, then by title.
function listLocalWallpapers(libs = libraries()) {
  const found = new Map();
  for (const lib of libs || []) {
    const roots = [
      path.resolve(lib, 'steamapps', 'workshop', 'content', WE_APPID),
      path.resolve(lib, 'steamapps', 'common', 'wallpaper_engine', 'projects', 'myprojects'),
    ];
    for (const r of roots) {
      let dirs = [];
      try {
        dirs = fs.readdirSync(r, { withFileTypes: true }).filter((d) => d.isDirectory()).map((d) => d.name);
      } catch {}
      for (const id of dirs) {
        if (found.has(id)) continue;
        const w = readProject(path.join(r, id), id);
        if (w) found.set(id, w);
      }
    }
  }
  return [...found.values()].sort((a, b) => b.usable - a.usable || a.title.localeCompare(b.title));
}

module.exports = { listLocalWallpapers, readProject };
