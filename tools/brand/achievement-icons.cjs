'use strict';
// Achievement icons for Steam from steam/achievements.json (Electron, no deps):
//
//   npx electron tools/brand/achievement-icons.cjs [--in=steam/achievements.json] [--out=steam/achievement-icons] [--fixture]
//
// For every { apiName, motif, value } writes <out>/<apiName>.jpg (unlocked) and <apiName>_locked.jpg, 256 x 256,
// in one badge style (tools/brand/badges.cjs): a dark plate with a rim in the motif's colour, a cel-shaded glyph
// per motif (shell, play, level, coin, collection, time, mod, preset, style, legend) and the number when the
// achievement has a value (level, coins, hours). Locked icons are desaturated and darkened with a padlock.
// Without steam/achievements.json (or with --fixture) a built-in fixture covering every motif is used, so the
// style can be reviewed before the real list exists. Also writes <out>/sheet.png: every icon, both states.

const fs = require('fs');
const path = require('path');
const { run } = require('./render.cjs');
const { badgeSvg, MOTIFS } = require('./badges.cjs');

const ROOT = path.resolve(__dirname, '..', '..');
const argv = process.argv.slice(process.argv.findIndex((a) => a.endsWith('achievement-icons.cjs')) + 1);
const flag = (k) => { const a = argv.find((x) => x.startsWith(`--${k}=`)); return a ? a.slice(k.length + 3) : null; };
const IN = path.resolve(flag('in') || path.join(ROOT, 'steam', 'achievements.json'));
const OUT = path.resolve(flag('out') || path.join(ROOT, 'steam', 'achievement-icons'));

/** One achievement per motif, in the steam/achievements.json shape (shared contract 3). */
const FIXTURE = {
  achievements: [
    { apiName: 'KB_FIRST_SHELL', name: 'Shell Game', desc: 'Put a game in a shell.', hidden: false, motif: 'shell' },
    { apiName: 'KB_FIRST_PLAY', name: 'Press Play', desc: 'Start play mode.', hidden: false, motif: 'play' },
    { apiName: 'KB_LEVEL_10', name: 'Getting Comfy', desc: 'Reach level 10.', hidden: false, motif: 'level', value: 10 },
    { apiName: 'KB_COINS_500', name: 'Piggy Bank', desc: 'Hold 500 coins at once.', hidden: false, motif: 'coin', value: 500 },
    { apiName: 'KB_COLLECTION_POCKET', name: 'Pocket Pals', desc: 'Own every Pocket Pals shell.', hidden: false, motif: 'collection' },
    { apiName: 'KB_HOURS_100', name: 'Marathon', desc: 'Spend 100 hours in a shell.', hidden: false, motif: 'time', value: 100 },
    { apiName: 'KB_FIRST_MOD', name: 'Tinkerer', desc: 'Install a mod.', hidden: false, motif: 'mod' },
    { apiName: 'KB_FIRST_PRESET', name: 'Set Dresser', desc: 'Save a scene preset.', hidden: false, motif: 'preset' },
    { apiName: 'KB_FIRST_FINISH', name: 'Fresh Coat', desc: 'Apply a finish.', hidden: false, motif: 'style' },
    { apiName: 'KB_LEVEL_100', name: 'Legend', desc: 'Reach level 100.', hidden: true, motif: 'legend', value: 100 },
  ],
};

/** Validate and normalise the list; throws on a bad entry so a typo never ships a blank icon silently. */
function readList(file, useFixture) {
  const src = useFixture || !fs.existsSync(file) ? FIXTURE : JSON.parse(fs.readFileSync(file, 'utf8'));
  const list = Array.isArray(src.achievements) ? src.achievements : [];
  if (!list.length) throw new Error(`${file}: "achievements" is empty`);
  const seen = new Set();
  return list.map((a, i) => {
    if (!/^[A-Z0-9_]{2,64}$/.test(String(a.apiName || ''))) throw new Error(`achievement ${i}: apiName must be UPPER_SNAKE (${a.apiName})`);
    if (seen.has(a.apiName)) throw new Error(`duplicate apiName ${a.apiName}`);
    seen.add(a.apiName);
    if (!MOTIFS.includes(a.motif)) console.warn(`  WARN ${a.apiName}: unknown motif "${a.motif}" (using the heart)`);
    return { apiName: a.apiName, motif: a.motif, value: a.value ?? null };
  });
}

// Contact sheet (page side).
async function sheetJob(items) {
  const imgs = await Promise.all(items.map(async (b) => { const i = new Image(); i.src = 'data:image/jpeg;base64,' + b; await i.decode(); return i; }));
  const cols = 8, cell = 136, rows = Math.ceil(imgs.length / cols);
  const c = Object.assign(document.createElement('canvas'), { width: cols * cell + 8, height: rows * cell + 8 }), g = c.getContext('2d');
  g.fillStyle = '#17141f'; g.fillRect(0, 0, c.width, c.height);
  imgs.forEach((i, k) => g.drawImage(i, 8 + (k % cols) * cell, 8 + Math.floor(k / cols) * cell, 128, 128));
  return c.toDataURL('image/png').split(',')[1];
}

if (require.main === module) run(async (r) => {
  const useFixture = argv.includes('--fixture'), list = readList(IN, useFixture);
  fs.mkdirSync(OUT, { recursive: true });
  console.log(`achievement icons -> ${OUT}  (${useFixture || !fs.existsSync(IN) ? 'built-in fixture' : path.relative(ROOT, IN)}, ${list.length} achievements)`);
  const sheet = [];
  for (const a of list) {
    for (const locked of [false, true]) {
      const buf = await r.raster(badgeSvg({ motif: a.motif, value: a.value, locked }), 256, 256, { type: 'jpeg', quality: 0.92 });
      fs.writeFileSync(path.join(OUT, `${a.apiName}${locked ? '_locked' : ''}.jpg`), buf);
      sheet.push(buf.toString('base64'));
    }
    console.log(`  ${a.apiName}.jpg + _locked  (${a.motif}${a.value != null ? ` ${a.value}` : ''})`);
  }
  const png = await r.page.executeJavaScript(`(${sheetJob})(${JSON.stringify(sheet)})`);
  fs.writeFileSync(path.join(OUT, 'sheet.png'), Buffer.from(png, 'base64'));
});

module.exports = { FIXTURE, readList };
