'use strict';
// Steam store and library assets for Kayboro, composed from the mark, the lockup, Kay and a collage of real
// shells from src/catalog/frames-*.json (Electron, no deps). Re-run after shells land in the catalog: the
// collage picks a fresh subset automatically (tools/brand/shells.cjs: rarer first, styles interleaved).
//
//   npx electron tools/brand/steam-assets.cjs [--out=DIR] [--only=name,name]
//
// Sizes verified against the Steamworks docs on 2026-10-13:
//   https://partner.steamgames.com/doc/store/assets/standard       (store capsules, page background)
//   https://partner.steamgames.com/doc/store/assets/libraryassets  (library capsule, hero, logo, header)
//   https://partner.steamgames.com/doc/store/assets/community      (app icon 184 jpg, shortcut icon 256 ico/png)
// Rules baked in: only the game's logo as text on capsules (no taglines), the logotype legible on every
// capsule, the small capsule nearly filled by the logo, NO text or logo on the library hero (its critical
// content stays in the centred safe area; the logo is overlaid by Steam from library_logo.png), the library
// logo a transparent PNG, the page background ambient and dim. Screenshots are real captures, not generated.
// Writes steam/assets/<name> and steam/assets/MANIFEST.json (file, size, doc URL, shells used).

const fs = require('fs');
const path = require('path');
const { run } = require('./render.cjs');
const { ico } = require('./ico.cjs');
const { P, rr, circle, lg, rg, path: p_, g, rng, sparkle } = require('../vectorart/lib.js');
const A = require('./art.cjs');
const M = require('./marks.cjs');
const S = require('./shells.cjs');

const ROOT = path.resolve(__dirname, '..', '..');
const argv = process.argv.slice(process.argv.findIndex((a) => a.endsWith('steam-assets.cjs')) + 1);
const flag = (k) => { const a = argv.find((x) => x.startsWith(`--${k}=`)); return a ? a.slice(k.length + 3) : null; };
const OUT = path.resolve(flag('out') || path.join(ROOT, 'steam', 'assets'));
const ONLY = (flag('only') || '').split(',').filter(Boolean);
const DOC = {
  standard: 'https://partner.steamgames.com/doc/store/assets/standard',
  library: 'https://partner.steamgames.com/doc/store/assets/libraryassets',
  community: 'https://partner.steamgames.com/doc/store/assets/community',
};
// Iconic shells first (one of each family: TV, pet, handheld, arcade, castle...), then rarity decides.
const PREFER = ['px-crt', 'vx-neko-tv', 'px-pet-egg', 'vx-sakura-handheld', 'px-arcade', 'vx-cozy-wood-tv', 'px-cloud-castle', 'vx-ufo-pet', 'vx-magical-compact', 'px-pocket', 'vx-synthwave', 'px-cat-monitor', 'vx-gallery', 'px-space-console', 'vx-mecha-hud', 'px-dungeon'];

const svgDoc = (w, h, defs, body) => `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${w} ${h}" width="${w}" height="${h}">\n<defs>${defs}</defs>\n${body}\n</svg>\n`;

/** Night-arcade backdrop: violet gradient, pixel stars, one pink and one cyan glow. dim: page background. */
function backdrop(id, w, h, { dim = false, stars = 90 } = {}) {
  const r = rng(w * 31 + h), defs = [
    lg(`${id}-bg`, [0, 0, 1, 1], [[0, dim ? '#15102a' : '#221a3f'], [1, '#0f0d16']]),
    rg(`${id}-g1`, [0.18, 0.95, 0.5], [[0, '#ff6ad5', dim ? 0.12 : 0.3], [1, '#ff6ad5', 0]]),
    rg(`${id}-g2`, [0.88, 0.05, 0.45], [[0, '#7af0ff', dim ? 0.08 : 0.22], [1, '#7af0ff', 0]]),
  ].join('');
  let body = `<rect width="${w}" height="${h}" fill="url(#${id}-bg)"/><rect width="${w}" height="${h}" fill="url(#${id}-g1)"/><rect width="${w}" height="${h}" fill="url(#${id}-g2)"/>`;
  const z = Math.max(2, Math.round(Math.min(w, h) / 220));
  for (let i = 0; i < stars; i++) {
    const x = Math.floor(r() * w / z) * z, y = Math.floor(r() * h / z) * z, c = r(), big = r() < 0.12;
    body += `<rect x="${x}" y="${y}" width="${big ? z * 2 : z}" height="${big ? z * 2 : z}" fill="${c < 0.15 ? '#7af0ff' : c < 0.3 ? '#ff6ad5' : '#ffffff'}" opacity="${(0.25 + r() * 0.5).toFixed(2)}"/>`;
  }
  for (let i = 0; i < Math.round(stars / 15); i++) body += p_(sparkle(r() * w, r() * h, z * (2 + r() * 2)), { fill: '#fff', opacity: 0.5 });
  return { defs, body };
}

/** Lockup inlined (crisp, not a nested image), scaled to `w` wide, top-left at (x, y). Returns { defs, body, h }. */
function lockup(id, x, y, w, stacked = false) {
  const l = A.lockupParts({ stacked, u: 16, p: id }), k = w / l.W;
  return { defs: l.defs, body: `<g transform="translate(${P(x, y)}) scale(${P(k)})">${l.body}</g>`, h: l.H * k, w };
}

/** Kay in a pose, `s` px tall, bottom-left at (x, yBottom). */
function kay(id, pose, x, yBottom, s) {
  const k = A.kayPose(pose, id);
  return { defs: k.defs, body: `<g transform="translate(${P(x, yBottom - s)}) scale(${P(s / 1024)})">${k.body}</g>` };
}

/** A row of shells in equal cells inside box (cells can overlap with gap < 0), alternating a little bob. */
function row(id, shells, box, { gap = 0, bob = 0, game = 0 } = {}) {
  const cw = (box.w - gap * (shells.length - 1)) / shells.length, defs = [], body = [];
  shells.forEach((sh, i) => {
    const dy = bob * (i % 2 ? 1 : -1), r = S.place(sh, { x: box.x + i * (cw + gap), y: box.y + dy, w: cw, h: box.h - Math.abs(bob) }, { game: game + i, id: `${id}${i}` });
    defs.push(r.defs); body.push(r.body);
  });
  return { defs: defs.join(''), body: body.join('') };
}

const join = (...parts) => ({ defs: parts.map((p) => p.defs).join(''), body: parts.map((p) => p.body).join('') });

// ---- the assets -------------------------------------------------------------------------------------
// Each entry: file, w, h, doc, and make(all shells) -> { svg, shells: [ids], ...rasterOptions }.
const ASSETS = [
  { file: 'small_capsule.png', w: 462, h: 174, doc: DOC.standard, note: 'logo nearly fills it; used in lists and search',
    make: () => { const L = lockup('sc', 16, 0, 430); L.body = L.body.replace('translate(16 0)', `translate(16 ${P((174 - L.h) / 2)})`);
      return { svg: svgDoc(462, 174, join(backdrop('scb', 462, 174, { stars: 30 }), L).defs, join(backdrop('scb', 462, 174, { stars: 30 }), L).body), shells: [] }; } },
  { file: 'header_capsule.png', w: 920, h: 430, doc: DOC.standard, note: 'store page top; logo left, three shells right',
    make: (all) => { const sh = S.pick(all, 3, { prefer: PREFER }), L = lockup('hc', 50, 0, 300, true); L.body = L.body.replace('translate(50 0)', `translate(50 ${P((430 - L.h) / 2)})`);
      const R = row('hcs', sh, { x: 380, y: 40, w: 520, h: 350 }, { gap: -10, bob: 14 });
      return { svg: svgDoc(920, 430, join(backdrop('hcb', 920, 430), R, L).defs, join(backdrop('hcb', 920, 430), R, L).body), shells: sh.map((s) => s.id) }; } },
  { file: 'library_header.png', w: 920, h: 430, doc: DOC.library, note: 'same art as the header capsule, no extra text',
    make: (all) => { const sh = S.pick(all, 3, { prefer: PREFER, exclude: ['px-crt'] }), L = lockup('lh', 50, 0, 300, true); L.body = L.body.replace('translate(50 0)', `translate(50 ${P((430 - L.h) / 2)})`);
      const R = row('lhs', sh, { x: 380, y: 40, w: 520, h: 350 }, { gap: -10, bob: 14, game: 1 });
      return { svg: svgDoc(920, 430, join(backdrop('lhb', 920, 430), R, L).defs, join(backdrop('lhb', 920, 430), R, L).body), shells: sh.map((s) => s.id) }; } },
  { file: 'main_capsule.png', w: 1232, h: 706, doc: DOC.standard, note: 'front page carousel; six shells around the stacked lockup and Kay',
    make: (all) => { const sh = S.pick(all, 6, { prefer: PREFER }), L = lockup('mc', 0, 0, 440, true); L.body = L.body.replace('translate(0 0)', `translate(${P((1232 - 440) / 2)} ${P((706 - L.h) / 2 - 60)})`);
      const left = row('mcl', sh.slice(0, 3), { x: 30, y: 30, w: 380, h: 646 }, { gap: -40, bob: 60 }), right = row('mcr', sh.slice(3), { x: 822, y: 30, w: 380, h: 646 }, { gap: -40, bob: -60, game: 3 });
      const K = kay('mck', 'cheer', 436, 700, 190);
      const all2 = join(backdrop('mcb', 1232, 706, { stars: 140 }), left, right, L, K);
      return { svg: svgDoc(1232, 706, all2.defs, all2.body), shells: sh.map((s) => s.id) }; } },
  { file: 'vertical_capsule.png', w: 748, h: 896, doc: DOC.standard, note: 'seasonal sale pages; lockup on top, six shells below',
    make: (all) => { const sh = S.pick(all, 6, { prefer: PREFER }), L = lockup('vc', 124, 36, 500, true), top = Math.round(36 + L.h + 24), rh = Math.floor((896 - top - 40) / 2);
      const r1 = row('vc1', sh.slice(0, 3), { x: 24, y: top, w: 700, h: rh }, { gap: 10, bob: 10 }), r2 = row('vc2', sh.slice(3), { x: 24, y: top + rh + 16, w: 700, h: rh }, { gap: 10, bob: -10, game: 3 });
      const all2 = join(backdrop('vcb', 748, 896, { stars: 110 }), r1, r2, L);
      return { svg: svgDoc(748, 896, all2.defs, all2.body), shells: sh.map((s) => s.id) }; } },
  { file: 'library_capsule.png', w: 600, h: 900, doc: DOC.library, note: 'library grid; lockup on top, four shells and Kay',
    make: (all) => { const sh = S.pick(all, 4, { prefer: PREFER }), L = lockup('lc', 60, 50, 480, true);
      const r1 = row('lc1', sh.slice(0, 2), { x: 30, y: 400, w: 540, h: 240 }, { gap: 16, bob: 8 }), r2 = row('lc2', sh.slice(2), { x: 30, y: 650, w: 540, h: 240 }, { gap: 16, bob: -8, game: 2 });
      const all2 = join(backdrop('lcb', 600, 900, { stars: 90 }), r1, r2, L);
      return { svg: svgDoc(600, 900, all2.defs, all2.body), shells: sh.map((s) => s.id) }; } },
  { file: 'library_hero.png', w: 3840, h: 1240, doc: DOC.library, note: 'NO text or logo; key shells inside the centred safe area; Steam overlays library_logo.png',
    make: (all) => { const sh = S.pick(all, 7, { prefer: PREFER }); // composed at 1920 x 620, rendered at 2x
      const mid = row('lhm', [sh[2], sh[0], sh[1]], { x: 560, y: 60, w: 800, h: 500 }, { gap: 10, bob: 20 }); // safe area 860 x 380 centred
      const l = row('lhl', sh.slice(3, 5), { x: 40, y: 90, w: 500, h: 440 }, { gap: 10, bob: -30, game: 2 }), r = row('lhr', sh.slice(5), { x: 1380, y: 90, w: 500, h: 440 }, { gap: 10, bob: 30, game: 3 });
      const all2 = join(backdrop('lhb', 1920, 620, { stars: 200 }), l, r, mid);
      return { svg: svgDoc(1920, 620, all2.defs, all2.body), shells: sh.map((s) => s.id) }; } },
  { file: 'library_logo.png', w: 1280, h: 349, doc: DOC.library, note: 'transparent; only the logotype and mark (1280 wide, under 720 tall)',
    make: () => { const l = A.lockupParts({ u: 16, p: 'll' }), h = Math.round(l.H * 1280 / l.W); return { svg: svgDoc(1280, h, l.defs, `<g transform="scale(${P(1280 / l.W)})">${l.body}</g>`), shells: [], h, transparent: true }; } },
  { file: 'page_background.png', w: 1438, h: 810, doc: DOC.standard, note: 'ambient: dim shells, no logo (Steam applies its own template over it)',
    make: (all) => { const sh = S.pick(all, 8, { prefer: PREFER.slice().reverse() });
      const r1 = row('pb1', sh.slice(0, 4), { x: -60, y: -40, w: 1560, h: 420 }, { gap: 20, bob: 30 }), r2 = row('pb2', sh.slice(4), { x: 120, y: 420, w: 1560, h: 420 }, { gap: 20, bob: -30, game: 2 });
      const bg = backdrop('pbb', 1438, 810, { dim: true, stars: 60 });
      return { svg: svgDoc(1438, 810, bg.defs + r1.defs + r2.defs, `${bg.body}<g opacity=".22">${r1.body}${r2.body}</g><rect width="1438" height="810" fill="url(#pbb-bg)" opacity=".35"/>`), shells: sh.map((s) => s.id) }; } },
  { file: 'community_icon.jpg', w: 184, h: 184, doc: DOC.community, note: 'app icon, jpg (no alpha): the vector mark on the panel colour',
    make: () => ({ svg: svgDoc(184, 184, '', `<rect width="184" height="184" fill="#17141f"/><image href="data:image/svg+xml;base64,${Buffer.from(A.markSvg()).toString('base64')}" x="6" y="6" width="172" height="172"/>`), shells: [], type: 'jpeg', quality: 0.95 }) },
  { file: 'shortcut_icon.png', w: 256, h: 256, doc: DOC.community, note: 'desktop shortcut; Steam makes the .ico from it (we ship one too)',
    make: () => ({ svg: A.markSvg(), shells: [], transparent: true }) },
];

run(async (r) => {
  fs.mkdirSync(OUT, { recursive: true });
  const all = S.loadShells();
  console.log(`steam assets -> ${OUT}  (${all.length} shells in the catalog)`);
  const manifest = { generated: 'tools/brand/steam-assets.cjs', docs: DOC, shellsInCatalog: all.map((s) => s.id), files: [] };
  for (const a of ASSETS) {
    if (ONLY.length && !ONLY.some((o) => a.file.startsWith(o))) continue;
    const m = a.make(all), h = m.h || a.h;
    const buf = await r.raster(m.svg, a.w, h, { type: m.type || 'png', quality: m.quality, bg: m.transparent ? null : undefined });
    fs.writeFileSync(path.join(OUT, a.file), buf);
    manifest.files.push({ file: a.file, size: `${a.w}x${h}`, doc: a.doc, note: a.note, shells: m.shells });
    console.log(`  ${a.file}  ${a.w}x${h}  ${(buf.length / 1024).toFixed(0)} KB${m.shells.length ? `  [${m.shells.join(' ')}]` : ''}`);
  }
  if (!ONLY.length || ONLY.some((o) => 'shortcut_icon.ico'.startsWith(o) || 'client_icon.ico'.startsWith(o))) {
    const entries = [];
    for (const n of [16, 24, 32, 48, 64, 128, 256]) entries.push({ size: n, png: await r.raster(M.GRIDS[n] ? M.gridSvg(n) : A.markSvg(), n, n, { smooth: n > 32 }) });
    const buf = ico(entries);
    for (const f of ['shortcut_icon.ico', 'client_icon.ico']) {
      fs.writeFileSync(path.join(OUT, f), buf);
      manifest.files.push({ file: f, size: '16,24,32,48,64,128,256', doc: DOC.community, note: f === 'client_icon.ico' ? 'Steamworks installation client icon (multi-size .ico)' : 'desktop shortcut icon', shells: [] });
      console.log(`  ${f}  ${(buf.length / 1024).toFixed(0)} KB`);
    }
  }
  fs.writeFileSync(path.join(OUT, 'MANIFEST.json'), `${JSON.stringify(manifest, null, 2)}\n`);
});
