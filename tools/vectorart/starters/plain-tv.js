'use strict';
// Starter shell: Plain TV. A deliberately basic reference template: a rounded box TV with a 4:3 screen
// opening and two flat knobs on the right, all flat colours. Use it as is, or copy
// src/renderer/frames/plain-tv.svg and repaint it (docs/MODDING.md, "Start from a plain shell").
//
// Layout, in frame units (= SVG viewBox units):
//   viewBox   884 x 600
//   body      0,0 884x600, corner radius 84 (opening radius 24 + border 60, so the corners are concentric)
//   opening   60,60 640x480 (4:3), corner radius 24. frameSvg cuts it out of all the artwork.
//   lip       a dark ring 8 wide around the opening
//   knobs     radius 40 at 796,240 and 796,360 (48 from the lip and 48 from the right edge), each with an 8x28 pointer
//
// Build: node tools/vectorart/build-starters.js plain-tv   Preview: npx electron tools/shells/preview.cjs plain-tv

const W = 884, H = 600;
const BORDER = 60, LIP = 8;
const hole = { x: BORDER, y: BORDER, w: 640, h: 480 }, radius = 24;
const KNOB_X = 796, KNOBS_Y = [240, 360], KNOB_R = 40;
const COLOR = { body: '#e3dccf', lip: '#2e3036', knob: '#3a3d44', pointer: '#e3dccf' };

/** <rect> / <circle> markup; leave fill out to inherit it from the parent group. */
const rect = (x, y, w, h, r, fill) => `<rect x="${x}" y="${y}" width="${w}" height="${h}" rx="${r}"${fill ? ` fill="${fill}"` : ''}/>`;
const circle = (cx, cy, r, fill) => `<circle cx="${cx}" cy="${cy}" r="${r}"${fill ? ` fill="${fill}"` : ''}/>`;

function draw() {
  const defs = [
    '<!--',
    '  Plain TV: a plain Kayboro shell to use as is or to repaint.',
    `  viewBox: ${W} x ${H} frame units.`,
    `  Screen opening: x=${hole.x} y=${hole.y} w=${hole.w} h=${hole.h} (4:3), corner radius ${radius}.`,
    '  The clip path above is the whole canvas minus the opening (even-odd). All the artwork below is',
    '  clipped by it, so the opening stays fully transparent and the game shows through it.',
    '-->',
  ].join('\n');

  const body = [
    `<!-- body: ${W}x${H}, corner radius ${radius + BORDER} -->`,
    rect(0, 0, W, H, radius + BORDER, COLOR.body),
    `<!-- lip: the opening grown by ${LIP} on every side; the cut removes its middle, leaving a ring ${LIP} wide -->`,
    rect(hole.x - LIP, hole.y - LIP, hole.w + 2 * LIP, hole.h + 2 * LIP, radius + LIP, COLOR.lip),
    `<!-- knobs: radius ${KNOB_R}, centred on x=${KNOB_X} -->`,
    `<g fill="${COLOR.knob}">`,
    ...KNOBS_Y.map((y) => `  ${circle(KNOB_X, y, KNOB_R)}`),
    '</g>',
    '<!-- knob pointers -->',
    `<g fill="${COLOR.pointer}">`,
    ...KNOBS_Y.map((y) => `  ${rect(KNOB_X - 4, y - 34, 8, 28, 4)}`),
    '</g>',
  ].join('\n');
  return { defs, body };
}

module.exports = {
  W, H, hole, radius, draw,
  meta: { name: 'Plain TV', theme: 'retro-home', translucent: false,
    desc: 'A plain box TV with two knobs: ready to play, and a clean template for your own.',
    tags: ['starter', 'tv', 'retro', 'plain', 'template'] },
};
