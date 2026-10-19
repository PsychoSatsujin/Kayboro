'use strict';
// Starter shell: Plain Handheld. A deliberately basic reference template: a portrait pocket console with
// a 4:3 screen opening near the top, a cross d-pad and two round buttons, all flat colours. Use it as is,
// or copy src/renderer/frames/plain-handheld.svg and repaint it (docs/MODDING.md, "Start from a plain shell").
//
// Layout, in frame units (= SVG viewBox units):
//   viewBox   600 x 820 (short enough that its centre, 300,410, is inside the opening: see Custom Frame in docs/MODDING.md)
//   body      0,0 600x820, corner radius 72 (opening radius 12 + border 60, so the top corners are concentric)
//   opening   60,60 480x360 (4:3), corner radius 12. frameSvg cuts it out of all the artwork.
//   lip       a dark ring 8 wide around the opening
//   d-pad     centre 170,620: two crossed 150x50 bars, corner radius 10
//   buttons   radius 34 at 390,640 and 470,600 (the pair is centred 170 from the right edge, like the d-pad from the left)
//
// Build: node tools/vectorart/build-starters.js plain-handheld   Preview: npx electron tools/shells/preview.cjs plain-handheld

const W = 600, H = 820;
const BORDER = 60, LIP = 8;
const hole = { x: BORDER, y: BORDER, w: 480, h: 360 }, radius = 12;
const PAD = { cx: 170, cy: 620, len: 150, thick: 50, r: 10 };
const BUTTONS = [{ cx: 390, cy: 640 }, { cx: 470, cy: 600 }], BTN_R = 34;
const COLOR = { body: '#d7d4cd', lip: '#3a3d44', pad: '#34373d', button: '#b25670' };

/** <rect> / <circle> markup; leave fill out to inherit it from the parent group. */
const rect = (x, y, w, h, r, fill) => `<rect x="${x}" y="${y}" width="${w}" height="${h}" rx="${r}"${fill ? ` fill="${fill}"` : ''}/>`;
const circle = (cx, cy, r, fill) => `<circle cx="${cx}" cy="${cy}" r="${r}"${fill ? ` fill="${fill}"` : ''}/>`;

function draw() {
  const defs = [
    '<!--',
    '  Plain Handheld: a plain Kayboro shell to use as is or to repaint.',
    `  viewBox: ${W} x ${H} frame units.`,
    `  Screen opening: x=${hole.x} y=${hole.y} w=${hole.w} h=${hole.h} (4:3), corner radius ${radius}.`,
    '  The clip path above is the whole canvas minus the opening (even-odd). All the artwork below is',
    '  clipped by it, so the opening stays fully transparent and the game shows through it.',
    '-->',
  ].join('\n');

  const { cx, cy, len, thick, r } = PAD;
  const body = [
    `<!-- body: ${W}x${H}, corner radius ${radius + BORDER} -->`,
    rect(0, 0, W, H, radius + BORDER, COLOR.body),
    `<!-- lip: the opening grown by ${LIP} on every side; the cut removes its middle, leaving a ring ${LIP} wide -->`,
    rect(hole.x - LIP, hole.y - LIP, hole.w + 2 * LIP, hole.h + 2 * LIP, radius + LIP, COLOR.lip),
    `<!-- d-pad: centre ${cx},${cy}, two crossed ${len}x${thick} bars -->`,
    `<g fill="${COLOR.pad}">`,
    `  ${rect(cx - len / 2, cy - thick / 2, len, thick, r)}`,
    `  ${rect(cx - thick / 2, cy - len / 2, thick, len, r)}`,
    '</g>',
    `<!-- buttons: radius ${BTN_R} -->`,
    `<g fill="${COLOR.button}">`,
    ...BUTTONS.map((b) => `  ${circle(b.cx, b.cy, BTN_R)}`),
    '</g>',
  ].join('\n');
  return { defs, body };
}

module.exports = {
  W, H, hole, radius, draw,
  meta: { name: 'Plain Handheld', theme: 'classic', translucent: false,
    desc: 'A plain pocket console with a d-pad and two buttons: ready to play, and a clean template for your own.',
    tags: ['starter', 'handheld', 'console', 'plain', 'template'] },
};
