'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const { viewPoint, viewUV, rectPoint } = require('../src/main/playCursor');

const content = { x: 100, y: 50, width: 1600, height: 900 };
const view = { x: 200, y: 100, w: 800, h: 450 };

test('viewPoint maps (u, v) in the picture to window DIP, honouring zoom', () => {
  assert.deepEqual(viewPoint(view, content, 1, 0, 0), { x: 300, y: 150 });
  assert.deepEqual(viewPoint(view, content, 1, 0.5, 0.5), { x: 700, y: 375 });
  assert.deepEqual(viewPoint(view, content, 1.25, 1, 1), { x: 1350, y: 738 }); // 100 + 1000 * 1.25, 50 + 550 * 1.25 rounded
});

test('viewPoint clamps to the picture and falls back to the window centre', () => {
  assert.deepEqual(viewPoint(view, content, 1, -2, 7), { x: 300, y: 600 });
  assert.deepEqual(viewPoint(view, content, 1, NaN, undefined), { x: 700, y: 375 });
  for (const bad of [null, undefined, { x: 0, y: 0, w: 0, h: 10 }, { x: 'a', y: 0, w: 1, h: 1 }]) {
    assert.deepEqual(viewPoint(bad, content, 1, 0.2, 0.2), { x: 900, y: 500 });
  }
});

test('viewUV inverts viewPoint and rejects points off the picture', () => {
  for (const zoom of [1, 1.5]) {
    const p = viewPoint(view, content, zoom, 0.25, 0.75);
    const uv = viewUV(view, content, zoom, p);
    assert.ok(Math.abs(uv.u - 0.25) < 0.01 && Math.abs(uv.v - 0.75) < 0.01, JSON.stringify(uv));
  }
  assert.equal(viewUV(view, content, 1, { x: 299, y: 200 }), null);
  assert.equal(viewUV(view, content, 1, { x: 500, y: 601 }), null);
  assert.equal(viewUV(null, content, 1, { x: 500, y: 300 }), null);
  assert.equal(viewUV(view, content, 1, null), null);
});

test('rectPoint lands inside the game client rect, even on an off-desktop screen', () => {
  const g = { x: 3955, y: 1920, width: 1440, height: 1080 };
  assert.deepEqual(rectPoint(g, 0, 0), { x: 3955, y: 1920 });
  assert.deepEqual(rectPoint(g, 0.5, 0.5), { x: 4675, y: 2460 });
  assert.deepEqual(rectPoint(g, 1, 1), { x: 3955 + 1439, y: 1920 + 1079 });
  assert.deepEqual(rectPoint(g, 3, -1), { x: 3955 + 1439, y: 1920 });
});

test('clearOf moves a new pop-out left of the sidebar only when they overlap', () => {
  const { clearOf } = require('../src/main/playCursor');
  const side = { x: 3092, y: 0, width: 348, height: 1392 };
  assert.deepEqual(clearOf({ x: 2900, y: 300, width: 640, height: 360 }, side), { x: 2440, y: 300, width: 640, height: 360 });
  assert.deepEqual(clearOf({ x: 300, y: 300, width: 640, height: 360 }, side), { x: 300, y: 300, width: 640, height: 360 });
  assert.deepEqual(clearOf({ x: 2452, y: 300, width: 640, height: 360 }, side), { x: 2452, y: 300, width: 640, height: 360 }); // touching is fine
  assert.deepEqual(clearOf({ x: 2900, y: 300, width: 640, height: 360 }, null), { x: 2900, y: 300, width: 640, height: 360 });
});
