'use strict';
// Real shells for brand compositions: loads every frame listed in src/catalog/frames-*.json with its SVG,
// picks good-looking subsets deterministically and emits an SVG fragment of a shell with a colourful mock
// game showing through its opening (like tools/shells/preview.cjs draws them). Pure where it can be, so the
// selection and fitting maths are unit tested in test/brand.test.js.
//
//   const S = require('./shells.cjs');
//   const all = S.loadShells();                                // [{ id, name, style, rarity, theme, size, hole, ..., svg }]
//   const some = S.pick(all, 6, { prefer: ['px-crt'] });      // rarity-first, pixel/vector interleaved, themes spread out
//   const { defs, body } = S.place(some[0], { x, y, w, h }, { game: 1, id: 'a' });   // fragment for one shell in a box

const fs = require('fs');
const path = require('path');
const { P, rr, circle, lg } = require('../vectorart/lib.js');

const ROOT = path.resolve(__dirname, '..', '..');
const RARITY = { common: 0, rare: 1, epic: 2, legendary: 3 };

/** Every catalog frame (all src/catalog/frames-*.json) with its SVG text; missing files are skipped. */
function loadShells(root = ROOT) {
  const dir = path.join(root, 'src', 'catalog'), out = [];
  for (const name of fs.readdirSync(dir).filter((n) => /^frames-.*\.json$/.test(n)).sort()) {
    const d = JSON.parse(fs.readFileSync(path.join(dir, name), 'utf8'));
    for (const it of d.frames || []) {
      const file = path.join(root, 'src', 'renderer', String(it.file || ''));
      if (!it.id || !it.hole || !it.size || !fs.existsSync(file)) continue;
      out.push({ ...it, svg: fs.readFileSync(file, 'utf8') });
    }
  }
  return out;
}

/**
 * Choose n shells for a composition. Rarer first, pixel and vector shells interleaved, no two of the same
 * theme next to each other when avoidable, `prefer` ids (if present) first, `exclude` ids never.
 * Deterministic: the same catalog always gives the same list.
 */
function pick(shells, n, { prefer = [], exclude = [], translucent = true } = {}) {
  const pool = shells.filter((s) => !exclude.includes(s.id) && (translucent || !s.translucent));
  const rank = (s) => (prefer.includes(s.id) ? -10 + prefer.indexOf(s.id) : -(RARITY[s.rarity] ?? 0));
  const byStyle = { pixel: [], vector: [] }, sorted = [...pool].sort((a, b) => rank(a) - rank(b) || a.id.localeCompare(b.id));
  for (const s of sorted) (byStyle[s.style] || byStyle.vector).push(s);
  const out = [];
  let turn = sorted.length && byStyle[sorted[0].style] ? sorted[0].style : 'vector'; // the best-ranked shell goes first
  while (out.length < n && (byStyle.pixel.length || byStyle.vector.length)) {
    const list = byStyle[turn].length ? byStyle[turn] : byStyle[turn === 'pixel' ? 'vector' : 'pixel'];
    const last = out[out.length - 1];
    let i = list.findIndex((s) => !last || s.theme !== last.theme);
    if (i < 0) i = 0;
    out.push(list.splice(i, 1)[0]);
    turn = turn === 'pixel' ? 'vector' : 'pixel';
  }
  return out;
}

/** Fit a shell into a box: pixel shells scale by whole numbers when they can (crisp), vectors freely. */
function fit(shell, box) {
  const { w: W, h: H } = shell.size;
  let k = Math.min(box.w / W, box.h / H);
  if (shell.style === 'pixel' && k >= 1) k = Math.floor(k);
  const w = W * k, h = H * k;
  return { k, x: box.x + (box.w - w) / 2, y: box.y + (box.h - h) / 2, w, h };
}

/** Pixel rect of the opening inside a fitted shell, plus its corner radius. */
function hole(shell, f) {
  const h = shell.hole, hw = h.w * f.w, hh = h.h * f.h;
  return { x: f.x + h.x * f.w, y: f.y + h.y * f.h, w: hw, h: hh, r: (shell.holeRadius || 0) * hw };
}

/** A tiny flat mock game filling (x, y, w, h). variant 0: meadow, 1: space, 2: sunset road, 3: candy. */
function mockGame(x, y, w, h, variant = 0, id = 'g') {
  const v = ((variant % 4) + 4) % 4, u = Math.min(w, h), px = Math.max(1, Math.round(u / 48)), defs = [], out = [];
  const R = (rx, ry, rw, rh, fill, o) => out.push(`<rect x="${P(x + rx * w)}" y="${P(y + ry * h)}" width="${P(rw * w)}" height="${P(rh * h)}" fill="${fill}"${o ? ` opacity="${o}"` : ''}/>`);
  const C = (cx, cy, r, fill) => out.push(`<path d="${circle(x + cx * w, y + cy * h, r * u)}" fill="${fill}"/>`);
  const dots = (seed, n, fill, k = 1) => { let s = seed; for (let i = 0; i < n; i++) { s = (s * 16807) % 2147483647; const a = s / 2147483647; s = (s * 16807) % 2147483647; const b = s / 2147483647;
    out.push(`<rect x="${P(x + a * (w - px * k))}" y="${P(y + b * (h - px * k))}" width="${px * k}" height="${px * k}" fill="${fill}"/>`); } };
  if (v === 0) { // meadow platformer
    defs.push(lg(`${id}-sky`, [0, 0, 0, 1], [[0, '#4aa8ff'], [1, '#b8ecff']]));
    R(0, 0, 1, 1, `url(#${id}-sky)`);
    C(0.78, 0.22, 0.09, '#fff4a8');
    R(0.17, 0.18, 0.16, 0.05, '#fff'); R(0.21, 0.14, 0.08, 0.05, '#fff'); R(0.5, 0.3, 0.14, 0.05, '#fff');
    R(0, 0.66, 1, 0.34, '#5cc85c'); R(0, 0.84, 1, 0.16, '#2f8a3c');
    R(0.62, 0.52, 0.12, 0.14, '#8d5a2b'); R(0.56, 0.36, 0.24, 0.2, '#3da64a');
    R(0.3, 0.55, 0.05, 0.11, '#d0452f'); R(0.3, 0.5, 0.05, 0.05, '#ffd9b0');
  } else if (v === 1) { // space shooter
    defs.push(lg(`${id}-sky`, [0, 0, 0, 1], [[0, '#0b1030'], [1, '#2a1f6a']]));
    R(0, 0, 1, 1, `url(#${id}-sky)`); dots(11, 40, '#ffffff'); dots(23, 12, '#7af0ff', 2);
    C(0.76, 0.3, 0.13, '#ff8fcf'); C(0.73, 0.27, 0.05, '#ffc6e8');
    R(0.64, 0.3, 0.26, 0.03, '#ffd166');
    R(0.22, 0.6, 0.12, 0.08, '#eaeaff'); R(0.26, 0.52, 0.04, 0.08, '#eaeaff'); R(0.2, 0.68, 0.16, 0.04, '#7af0ff');
    R(0.27, 0.42, 0.02, 0.08, '#ffd166'); R(0.27, 0.28, 0.02, 0.08, '#ffd166');
  } else if (v === 2) { // sunset road
    defs.push(lg(`${id}-sky`, [0, 0, 0, 1], [[0, '#2b1b5a'], [0.6, '#ff6ad5'], [1, '#ffb15c']]));
    R(0, 0, 1, 1, `url(#${id}-sky)`);
    C(0.5, 0.52, 0.2, '#ffd166'); R(0, 0.46, 1, 0.025, `url(#${id}-sky)`); R(0, 0.52, 1, 0.03, `url(#${id}-sky)`);
    R(0, 0.6, 1, 0.4, '#1a0f33');
    out.push(`<path d="M${P(x + w * 0.36, y + h)}L${P(x + w * 0.47, y + h * 0.6)}L${P(x + w * 0.53, y + h * 0.6)}L${P(x + w * 0.64, y + h)}Z" fill="#3b2d66"/>`);
    out.push(`<path d="M${P(x + w * 0.5, y + h * 0.6)}V${P(y + h)}" stroke="#ffd166" stroke-width="${px}" stroke-dasharray="${px * 3} ${px * 3}"/>`);
    R(0.46, 0.8, 0.08, 0.1, '#ff6ad5'); R(0.47, 0.76, 0.06, 0.05, '#7af0ff');
  } else { // candy puzzle
    defs.push(lg(`${id}-sky`, [0, 0, 1, 1], [[0, '#2a1250'], [1, '#4b1d6e']]));
    R(0, 0, 1, 1, `url(#${id}-sky)`);
    const cols = ['#ff6ad5', '#7af0ff', '#ffd166', '#6ee7a8', '#c58cff'];
    for (let j = 0; j < 4; j++) for (let i = 0; i < 6; i++) R(0.08 + i * 0.14, 0.12 + j * 0.2, 0.12, 0.16, cols[(i * 3 + j * 2) % cols.length], 0.95);
    R(0.08 + 2 * 0.14, 0.12 + 1 * 0.2, 0.12, 0.16, '#ffffff', 0.5);
  }
  return { defs: defs.join(''), body: out.join('') };
}

const b64 = (s) => Buffer.from(s).toString('base64');

/**
 * SVG fragment of one shell fitted into `box`, with a mock game in the opening (clipped to its rounded
 * corners) and, for translucent shells, a dark fill glowing through the plastic. Returns { defs, body, fit }.
 */
function place(shell, box, { game = 0, id = 's', shadow = true } = {}) {
  const f = fit(shell, box), h = hole(shell, f), href = `data:image/svg+xml;base64,${b64(shell.svg)}`;
  const pixel = shell.style === 'pixel', defs = [], body = [];
  const img = `<image href="${href}" x="${P(f.x)}" y="${P(f.y)}" width="${P(f.w)}" height="${P(f.h)}"${pixel ? ' style="image-rendering:pixelated"' : ''}/>`;
  if (shadow) body.push(`<ellipse cx="${P(f.x + f.w / 2)}" cy="${P(f.y + f.h * 0.98)}" rx="${P(f.w * 0.42)}" ry="${P(f.h * 0.035)}" fill="#000" opacity=".35"/>`);
  if (shell.translucent) { // fill masked by the shell's own alpha
    defs.push(`<mask id="${id}-m" maskUnits="userSpaceOnUse" mask-type="alpha">${img}</mask>`);
    defs.push(lg(`${id}-fill`, [0, 0, 0, 1], [[0, '#120b2e'], [1, '#2a1250']]));
    body.push(`<rect x="${P(f.x)}" y="${P(f.y)}" width="${P(f.w)}" height="${P(f.h)}" fill="url(#${id}-fill)" mask="url(#${id}-m)"/>`);
  }
  const mg = mockGame(h.x, h.y, h.w, h.h, game, `${id}-g`);
  defs.push(mg.defs, `<clipPath id="${id}-c"><path d="${rr(h.x, h.y, h.w, h.h, h.r)}"/></clipPath>`);
  body.push(`<g clip-path="url(#${id}-c)">${mg.body}</g>`, img);
  return { defs: defs.join(''), body: body.join(''), fit: f, hole: h };
}

module.exports = { ROOT, RARITY, loadShells, pick, fit, hole, mockGame, place };
