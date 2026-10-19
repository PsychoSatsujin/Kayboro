'use strict';
// Starter shell: Plain Bezel. A deliberately basic reference template: one graphite rounded rectangle
// with a subtle top-to-bottom gradient and a thin dark lip around a 16:9 screen opening. Use it as is,
// or copy src/renderer/frames/plain-bezel.svg and repaint it (docs/MODDING.md, "Start from a plain shell").
//
// Layout, in frame units (= SVG viewBox units):
//   viewBox   1056 x 636
//   body      0,0 1056x636, corner radius 60 (opening radius 12 + border 48, so the corners are concentric)
//   opening   48,48 960x540 (16:9), corner radius 12. frameSvg cuts it out of all the artwork.
//   lip       a dark ring 8 wide around the opening
//
// Build: node tools/vectorart/build-starters.js plain-bezel   Preview: npx electron tools/shells/preview.cjs plain-bezel

const W = 1056, H = 636;
const BORDER = 48, LIP = 8;
const hole = { x: BORDER, y: BORDER, w: 960, h: 540 }, radius = 12;
const COLOR = { top: '#4a4d55', bottom: '#383b42', lip: '#1d1f24' };

const rect = (x, y, w, h, r, fill) => `<rect x="${x}" y="${y}" width="${w}" height="${h}" rx="${r}" fill="${fill}"/>`;

function draw() {
  const defs = [
    '<!--',
    '  Plain Bezel: a plain Kayboro shell to use as is or to repaint.',
    `  viewBox: ${W} x ${H} frame units.`,
    `  Screen opening: x=${hole.x} y=${hole.y} w=${hole.w} h=${hole.h} (16:9), corner radius ${radius}.`,
    '  The clip path above is the whole canvas minus the opening (even-odd). All the artwork below is',
    '  clipped by it, so the opening stays fully transparent and the game shows through it.',
    '-->',
    '<!-- body colour: one subtle top-to-bottom gradient -->',
    `<linearGradient id="pb-body" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="${COLOR.top}"/><stop offset="1" stop-color="${COLOR.bottom}"/></linearGradient>`,
  ].join('\n');

  const body = [
    `<!-- body: ${W}x${H}, corner radius ${radius + BORDER} -->`,
    rect(0, 0, W, H, radius + BORDER, 'url(#pb-body)'),
    `<!-- lip: the opening grown by ${LIP} on every side; the cut removes its middle, leaving a ring ${LIP} wide -->`,
    rect(hole.x - LIP, hole.y - LIP, hole.w + 2 * LIP, hole.h + 2 * LIP, radius + LIP, COLOR.lip),
  ].join('\n');
  return { defs, body };
}

module.exports = {
  W, H, hole, radius, draw,
  meta: { name: 'Plain Bezel', theme: 'minimal', translucent: false,
    desc: 'A plain graphite bezel with a thin lip: the simplest shell, and a clean template for your own.',
    tags: ['starter', 'bezel', 'minimal', 'plain', 'template'] },
};
