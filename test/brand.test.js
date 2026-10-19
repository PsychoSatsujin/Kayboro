// Brand pipeline (tools/brand): the pure parts that do not need Electron. The pixel grids must be well formed
// and keyed, the wordmark and badges must be rect-only pixel art, the ICO writer must produce a valid file and
// the shell picker must behave the same whether the catalog has 0, 1 or many shells. The generated files
// (assets/brand, build/icon.*, steam/assets, steam/achievement-icons) are checked only when they exist.
const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const zlib = require('node:zlib');

const ROOT = path.join(__dirname, '..');
const A = require('../tools/brand/art.cjs');
const M = require('../tools/brand/marks.cjs');
const { ico, readIco, pngSize } = require('../tools/brand/ico.cjs');
const S = require('../tools/brand/shells.cjs');
const B = require('../tools/brand/badges.cjs');
const { FIXTURE, readList } = require('../tools/brand/achievement-icons.cjs');

const RECTS = /^(?:M-?\d+(?:\.\d+)? -?\d+(?:\.\d+)?h-?\d+(?:\.\d+)?v-?\d+(?:\.\d+)?h-?\d+(?:\.\d+)?z)+$/;
const pathData = (svg) => [...svg.matchAll(/ d="([^"]*)"/g)].map((m) => m[1]);
const selfContained = (svg) => !/<script|<foreignObject|<text|xlink:href|@import|https?:\/\/(?!www\.w3\.org\/2000\/svg)/i.test(svg);

// A minimal valid PNG (1 pixel, RGBA) of the given square size, for the ICO tests.
function fakePng(n) {
  const crc = (buf) => { let c = ~0; for (const b of buf) { c ^= b; for (let k = 0; k < 8; k++) c = (c >>> 1) ^ (0xedb88320 & -(c & 1)); } return (~c) >>> 0; };
  const chunk = (type, data) => { const len = Buffer.alloc(4); len.writeUInt32BE(data.length); const td = Buffer.concat([Buffer.from(type), data]); const c = Buffer.alloc(4); c.writeUInt32BE(crc(td)); return Buffer.concat([len, td, c]); };
  const ihdr = Buffer.alloc(13); ihdr.writeUInt32BE(n, 0); ihdr.writeUInt32BE(n, 4); ihdr[8] = 8; ihdr[9] = 6;
  const raw = Buffer.alloc(n * (1 + n * 4));
  return Buffer.concat([Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]), chunk('IHDR', ihdr), chunk('IDAT', zlib.deflateSync(raw)), chunk('IEND', Buffer.alloc(0))]);
}

test('pixel marks: 16, 24 and 32 px grids are square, keyed and use the brand palette', () => {
  for (const n of [16, 24, 32]) {
    const g = M.parse(M.GRIDS[n]);
    assert.equal(g.w, n); assert.equal(g.h, n);
    assert.ok(g.px.length > n * n * 0.5, `${n}: mostly painted`);
    const colours = new Set(g.px.map((p) => p[2]));
    for (const c of ['#2a0b22', '#ff6ad5', '#7af0ff', '#fff3fa']) assert.ok(colours.has(c), `${n} uses ${c}`);
    const svg = M.gridSvg(n);
    assert.match(svg, new RegExp(`viewBox="0 0 ${n} ${n}"`));
    assert.match(svg, /shape-rendering="crispEdges"/);
    for (const d of pathData(svg)) assert.match(d, RECTS, 'rects only');
    assert.ok(selfContained(svg));
  }
  assert.throws(() => M.parse(['..', '...']), /wide/);
  assert.throws(() => M.parse(['?.', '..']), /unknown pixel/);
});

test('pixel marks: run merging covers every pixel exactly once', () => {
  const g = M.parse(M.GRIDS[16]), seen = new Map();
  for (const [c, d] of Object.entries(M.runs(g))) for (const [, x, y, w, h] of d.matchAll(/M(\d+) (\d+)h(\d+)v(\d+)h-\d+z/g))
    for (let j = +y; j < +y + +h; j++) for (let i = +x; i < +x + +w; i++) { assert.ok(!seen.has(`${i},${j}`), 'no overlap'); seen.set(`${i},${j}`, c); }
  assert.equal(seen.size, g.px.length);
  for (const [x, y, c] of g.px) assert.equal(seen.get(`${x},${y}`), c);
  assert.match(M.spriteSymbol(), /^<symbol id="i-logo" viewBox="0 0 16 16" shape-rendering="crispEdges">/);
});

test('wordmark: every letter has a glyph, extrusion never fills a counter, output is rects only', () => {
  for (const ch of 'KAYBORO') { assert.equal(A.GLYPHS[ch].length, 9); for (const row of A.GLYPHS[ch]) assert.equal(row.length, 7); }
  const wp = A.wordPixels('KAYBORO');
  assert.equal(wp.w, 7 * 9 - 2 + 2); assert.equal(wp.h, 9 + 2 + 2);
  const [ink, side, bottom, top] = wp.layers;
  assert.equal(ink[0], A.PAL.ink); assert.equal(side[0], A.PAL.pink);
  // the O's counter (letter 6, inner column) never gets extrusion or face pixels (only the ink outline may touch it)
  const ox = 1 + 6 * 9 + 3;
  for (const [, set] of [side, bottom, top]) for (let y = 2; y <= 8; y++) assert.ok(!set.has(`${ox},${y}`), `O counter clean at ${ox},${y}`);
  assert.ok(top[1].size + bottom[1].size > 150, 'face pixels');
  const svg = A.wordmarkSvg(4);
  assert.match(svg, /shape-rendering="crispEdges"/);
  for (const d of pathData(svg)) assert.match(d, RECTS);
  assert.throws(() => A.wordPixels('K!'), /no glyph/);
});

test('vector art: mark, lockup, mascot and pose sheet are self-contained SVGs with unique ids', () => {
  const docs = { mark: A.markSvg(), lockup: A.lockupSvg(), stacked: A.lockupSvg({ stacked: true }), mascot: A.mascotSvg('wave'), coin: A.mascotSvg('coin'), sheet: A.poseSheetSvg() };
  for (const [name, svg] of Object.entries(docs)) {
    assert.ok(selfContained(svg), `${name} self-contained`);
    assert.match(svg, /^<svg xmlns="http:\/\/www\.w3\.org\/2000\/svg" viewBox="0 0 \d+ \d+" width="\d+" height="\d+">/);
    const ids = [...svg.matchAll(/\bid="([^"]+)"/g)].map((m) => m[1]);
    assert.equal(new Set(ids).size, ids.length, `${name}: duplicate ids ${ids.filter((v, i) => ids.indexOf(v) !== i)}`);
    for (const [, ref] of svg.matchAll(/url\(#([^)]+)\)/g)) assert.ok(ids.includes(ref), `${name}: url(#${ref}) defined`);
    for (const [, ref] of svg.matchAll(/clip-path="url\(#([^)]+)\)"/g)) assert.ok(ids.includes(ref));
  }
  assert.match(docs.mark, /viewBox="0 0 1024 1024"/);
  assert.equal(A.markSvg('a'), A.markSvg('a'), 'deterministic');
  const l = A.lockupParts({ stacked: true, u: 10 }), h = A.lockupParts({ u: 10 });
  assert.ok(l.H / l.W > h.H / h.W, 'stacked lockup is taller than the horizontal one');
  assert.equal(l.W, A.wordBox(A.wordPixels(), 10).w, 'stacked lockup is as wide as the wordmark');
});

test('ico: writes PNG entries in order with correct offsets and rejects bad input', () => {
  const entries = [256, 16, 48].map((size) => ({ size, png: fakePng(size) }));
  const buf = ico(entries), dir = readIco(buf);
  assert.deepEqual(dir.map((e) => e.size), [16, 48, 256]);
  assert.equal(buf.readUInt16LE(2), 1, 'type icon');
  assert.equal(buf[6 + 2 * 16], 0, '256 is stored as 0');
  let off = 6 + 16 * 3;
  for (const e of dir) {
    assert.equal(e.offset, off);
    const png = buf.subarray(e.offset, e.offset + e.length);
    assert.deepEqual(pngSize(png), { w: e.size, h: e.size });
    off += e.length;
  }
  assert.equal(off, buf.length);
  assert.throws(() => ico([]), /at least one/);
  assert.throws(() => ico([{ size: 16, png: fakePng(32) }]), /32x32/);
  assert.throws(() => ico([{ size: 16, png: fakePng(16) }, { size: 16, png: fakePng(16) }]), /duplicate/);
  assert.throws(() => ico([{ size: 512, png: fakePng(512) }]), /bad icon size/);
  assert.throws(() => pngSize(Buffer.from('nope')), /not a PNG/);
});

test('shells: pick is deterministic, rarity first, styles interleaved, and safe on an empty catalog', () => {
  const mk = (id, style, rarity, theme, translucent = false) => ({ id, style, rarity, theme, translucent, size: { w: 200, h: 150 }, hole: { x: 0.1, y: 0.1, w: 0.8, h: 0.8 }, holeRadius: 0 });
  const all = [mk('px-a', 'pixel', 'common', 'tv'), mk('px-b', 'pixel', 'legendary', 'pet'), mk('vx-c', 'vector', 'rare', 'tv'), mk('vx-d', 'vector', 'epic', 'tv', true), mk('px-e', 'pixel', 'epic', 'tv')];
  assert.deepEqual(S.pick([], 4), []);
  assert.deepEqual(S.pick(all, 0), []);
  const six = S.pick(all, 6);
  assert.equal(six.length, 5, 'asks for more than exist: gets all once');
  assert.equal(new Set(six.map((s) => s.id)).size, 5);
  assert.deepEqual(S.pick(all, 4).map((s) => s.id), S.pick(all, 4).map((s) => s.id));
  const four = S.pick(all, 4).map((s) => s.id);
  assert.equal(four[0], 'px-b', 'legendary first'); assert.equal(four[1], 'vx-d', 'then the other style');
  assert.deepEqual(S.pick(all, 2, { prefer: ['vx-c'] }).map((s) => s.id)[0], 'vx-c');
  assert.ok(!S.pick(all, 5, { exclude: ['px-b'] }).some((s) => s.id === 'px-b'));
  assert.ok(!S.pick(all, 5, { translucent: false }).some((s) => s.translucent));
  const f = S.fit(all[0], { x: 0, y: 0, w: 500, h: 500 });
  assert.equal(f.k, 2, 'pixel shells scale by whole numbers'); assert.deepEqual([f.x, f.y, f.w, f.h], [50, 100, 400, 300]);
  assert.ok(Math.abs(S.fit(all[2], { x: 0, y: 0, w: 500, h: 500 }).k - 2.5) < 1e-9, 'vectors scale freely');
  const h = S.hole(all[0], f); assert.deepEqual([h.x, h.y, h.w, h.h], [90, 130, 320, 240]);
  const p = S.place({ ...all[3], svg: '<svg xmlns="http://www.w3.org/2000/svg"/>' }, { x: 0, y: 0, w: 100, h: 100 }, { id: 'q' });
  assert.match(p.defs, /<mask id="q-m"/); assert.match(p.body, /mask="url\(#q-m\)"/); assert.match(p.body, /clip-path="url\(#q-c\)"/);
  for (let v = 0; v < 4; v++) assert.ok(S.mockGame(0, 0, 100, 60, v, `g${v}`).body.length > 100);
});

test('shells: every catalog frame loads with its SVG', () => {
  const all = S.loadShells();
  const listed = fs.readdirSync(path.join(ROOT, 'src', 'catalog')).filter((n) => /^frames-.*\.json$/.test(n))
    .flatMap((n) => JSON.parse(fs.readFileSync(path.join(ROOT, 'src', 'catalog', n), 'utf8')).frames || []);
  assert.equal(all.length, listed.length, 'no frame is skipped');
  for (const s of all) { assert.ok(s.svg.startsWith('<svg'), s.id); assert.ok(['pixel', 'vector'].includes(s.style), s.id); }
});

test('badges: every motif draws, labels follow the motif, locked adds the filter and padlock', () => {
  for (const motif of B.MOTIFS) {
    const svg = B.badgeSvg({ motif, value: 10 });
    assert.ok(selfContained(svg), motif);
    assert.match(svg, /viewBox="0 0 256 256"/);
    const ids = [...svg.matchAll(/\bid="([^"]+)"/g)].map((m) => m[1]);
    assert.equal(new Set(ids).size, ids.length, `${motif}: duplicate ids`);
    assert.ok(B.TINT[motif]);
  }
  assert.equal(B.valueLabel(10, 'level'), '10'); assert.equal(B.valueLabel(100, 'legend'), '100');
  assert.equal(B.valueLabel(36000, 'time'), '10H'); assert.equal(B.valueLabel(100, 'time'), '100H');
  assert.equal(B.valueLabel(500, 'coin'), '500'); assert.equal(B.valueLabel(1, 'coin'), null);
  assert.equal(B.valueLabel(1, 'shell'), null); assert.equal(B.valueLabel(3, 'collection'), null);
  assert.equal(B.valueLabel(null, 'level'), null); assert.equal(B.valueLabel('x', 'level'), null);
  const un = B.badgeSvg({ motif: 'level', value: 25 }), lk = B.badgeSvg({ motif: 'level', value: 25, locked: true });
  assert.match(lk, /filter="url\(#b-lock\)"/); assert.doesNotMatch(un, /filter="url/);
  assert.ok(lk.length > un.length, 'padlock added');
  assert.match(B.badgeSvg({ motif: 'nope' }), /<path/, 'unknown motif falls back');
  // the number is pixel art: rects only inside the crispEdges group
  const num = /<g shape-rendering="crispEdges">(.*?)<\/g>/s.exec(un);
  assert.ok(num); for (const d of pathData(num[1])) assert.match(d, RECTS);
});

test('achievement list: the fixture covers every motif and the real list validates', () => {
  assert.deepEqual([...new Set(FIXTURE.achievements.map((a) => a.motif))].sort(), [...B.MOTIFS].sort());
  const fx = readList('/nowhere/achievements.json', false);
  assert.equal(fx.length, FIXTURE.achievements.length);
  const real = path.join(ROOT, 'steam', 'achievements.json');
  if (fs.existsSync(real)) {
    const list = readList(real, false);
    assert.ok(list.length >= 1);
    for (const a of list) { assert.match(a.apiName, /^KB_[A-Z0-9_]+$/); assert.ok(B.MOTIFS.includes(a.motif), `${a.apiName}: motif ${a.motif}`); }
  }
  const tmp = path.join(require('node:os').tmpdir(), `kb-ach-${process.pid}.json`);
  fs.writeFileSync(tmp, JSON.stringify({ achievements: [{ apiName: 'bad name', motif: 'shell' }] }));
  assert.throws(() => readList(tmp, false), /UPPER_SNAKE/);
  fs.writeFileSync(tmp, JSON.stringify({ achievements: [{ apiName: 'KB_A', motif: 'shell' }, { apiName: 'KB_A', motif: 'play' }] }));
  assert.throws(() => readList(tmp, false), /duplicate/);
  fs.writeFileSync(tmp, JSON.stringify({ achievements: [] }));
  assert.throws(() => readList(tmp, false), /empty/);
  fs.unlinkSync(tmp);
});

test('generated files: icons, sprite and Steam assets match the generators when present', () => {
  const icoFile = path.join(ROOT, 'build', 'icon.ico');
  if (fs.existsSync(icoFile)) {
    const dir = readIco(fs.readFileSync(icoFile));
    assert.deepEqual(dir.map((e) => e.size), [16, 24, 32, 48, 64, 128, 256]);
  }
  for (const [rel, n] of [['build/icon.png', 1024], ['src/renderer/assets/icon.png', 256]]) {
    const f = path.join(ROOT, rel);
    if (fs.existsSync(f)) assert.deepEqual(pngSize(fs.readFileSync(f)), { w: n, h: n }, rel);
  }
  const html = fs.readFileSync(path.join(ROOT, 'src', 'renderer', 'index.html'), 'utf8');
  assert.ok(html.includes(M.spriteSymbol()), 'index.html carries the current 16 px mark');
  assert.ok(html.includes(`<symbol id="i-logo-24" viewBox="0 0 24 24" shape-rendering="crispEdges">${M.spritePaths(24)}</symbol>`), 'and the 24 px HUD mark');
  assert.match(html, /<use href="#i-logo-24"\/>/);
  const manifest = path.join(ROOT, 'steam', 'assets', 'MANIFEST.json');
  if (fs.existsSync(manifest)) {
    const m = JSON.parse(fs.readFileSync(manifest, 'utf8')), sizes = Object.fromEntries(m.files.map((f) => [f.file, f.size]));
    for (const [file, size] of [['header_capsule.png', '920x430'], ['small_capsule.png', '462x174'], ['main_capsule.png', '1232x706'], ['vertical_capsule.png', '748x896'],
      ['page_background.png', '1438x810'], ['library_capsule.png', '600x900'], ['library_hero.png', '3840x1240'], ['library_header.png', '920x430'], ['community_icon.jpg', '184x184'], ['shortcut_icon.png', '256x256']]) {
      assert.equal(sizes[file], size, file);
      const f = path.join(ROOT, 'steam', 'assets', file);
      assert.ok(fs.existsSync(f), `${file} exists`);
      if (file.endsWith('.png')) { const [w, h] = size.split('x').map(Number); assert.deepEqual(pngSize(fs.readFileSync(f)), { w, h }, file); }
    }
    const logo = fs.readFileSync(path.join(ROOT, 'steam', 'assets', 'library_logo.png')), ls = pngSize(logo);
    assert.ok(ls.w === 1280 || ls.h === 720, 'library logo is 1280 wide or 720 tall');
    assert.equal(logo[25], 6, 'library logo is RGBA (transparent background)');
    for (const f of ['shortcut_icon.ico', 'client_icon.ico']) assert.equal(readIco(fs.readFileSync(path.join(ROOT, 'steam', 'assets', f))).length, 7, f);
  }
});
