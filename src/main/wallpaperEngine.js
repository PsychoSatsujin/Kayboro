'use strict';
// The user's own Wallpaper Engine wallpapers, read from disk: workshop subscriptions
// (steamapps/workshop/content/431960) and projects they made (wallpaper_engine/projects/myprojects).
// Only video and image wallpapers can be shown as a Kayboro backdrop; scene/web ones need Wallpaper Engine.
// Everything is async with a few reads in flight at once: a big subscription list (1,000 projects over
// several drives, some asleep) must never stall the main process, which also drives play mode.
const fs = require('fs');
const fsp = fs.promises;
const path = require('path');
const { pathToFileURL } = require('url');
const { libraries } = require('./steam/library');

const WE_APPID = '431960';
const VIDEO = new Set(['.mp4', '.webm', '.m4v', '.mov']);
const IMAGE = new Set(['.png', '.jpg', '.jpeg', '.gif', '.webp', '.bmp']);
const TYPES = new Set(['video', 'scene', 'web', 'image']);
const PREVIEWS = ['preview.gif', 'preview.jpg', 'preview.jpeg', 'preview.png', 'preview.webp'];

const PARALLEL = 16; // project folders read at once

// A file in dir named by an untrusted project.json field; null when missing or outside dir.
async function inside(dir, name) {
  if (typeof name !== 'string' || !name) return null;
  const f = path.resolve(dir, name);
  if (!f.startsWith(dir + path.sep)) return null;
  try {
    return (await fsp.stat(f)).isFile() ? f : null;
  } catch {
    return null;
  }
}

async function readProject(dir, id) {
  let p;
  try {
    const file = path.join(dir, 'project.json');
    if ((await fsp.stat(file)).size > 1 << 20) return null;
    p = JSON.parse((await fsp.readFile(file, 'utf8')).replace(/^﻿/, ''));
  } catch {
    return null;
  }
  if (!p || typeof p !== 'object') return null;
  const file = await inside(dir, p.file);
  const ext = file ? path.extname(file).toLowerCase() : '';
  let type = String(p.type || '').toLowerCase();
  if (!TYPES.has(type)) type = VIDEO.has(ext) ? 'video' : IMAGE.has(ext) ? 'image' : null;
  if (!type) return null; // applications and unknown kinds
  const usable = (type === 'video' && VIDEO.has(ext)) || (type === 'image' && IMAGE.has(ext));
  let preview = await inside(dir, p.preview);
  for (const n of PREVIEWS) if (!preview) preview = await inside(dir, n);
  const title = String(p.title || '').replace(/[\u0000-\u001f\u007f]/g, '').trim().slice(0, 200) || id;
  return { id, title, type, previewUrl: preview ? pathToFileURL(preview).href : null, fileUrl: usable ? pathToFileURL(file).href : null, usable };
}

// Usable wallpapers first, then by title. The first library that has an id wins.
async function listLocalWallpapers(libs = libraries()) {
  const jobs = [], seen = new Set();
  for (const lib of libs || []) {
    const roots = [
      path.resolve(lib, 'steamapps', 'workshop', 'content', WE_APPID),
      path.resolve(lib, 'steamapps', 'common', 'wallpaper_engine', 'projects', 'myprojects'),
    ];
    for (const r of roots) {
      let dirs = [];
      try {
        dirs = (await fsp.readdir(r, { withFileTypes: true })).filter((d) => d.isDirectory()).map((d) => d.name);
      } catch {}
      for (const id of dirs) if (!seen.has(id)) { seen.add(id); jobs.push([path.join(r, id), id]); }
    }
  }
  const out = new Array(jobs.length);
  let next = 0;
  const worker = async () => { while (next < jobs.length) { const i = next++; out[i] = await readProject(...jobs[i]); } };
  await Promise.all(Array.from({ length: Math.min(PARALLEL, jobs.length) }, worker));
  return out.filter(Boolean).sort((a, b) => b.usable - a.usable || a.title.localeCompare(b.title));
}

module.exports = { listLocalWallpapers, readProject };
