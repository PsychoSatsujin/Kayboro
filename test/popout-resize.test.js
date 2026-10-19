'use strict';
// Pop-out edge drag geometry (src/main/popout.js resizeBounds; electron is not touched at load).
const test = require('node:test');
const assert = require('node:assert/strict');
const { resizeBounds } = require('../src/main/popout');

const b = { x: 100, y: 100, width: 400, height: 300 };

test('corner drag keeps the aspect and the opposite corner', () => {
  assert.deepEqual(resizeBounds(b, 'se', 80, 10), { x: 100, y: 100, width: 480, height: 360 });
  assert.deepEqual(resizeBounds(b, 'nw', -80, 0), { x: 20, y: 40, width: 480, height: 360 });
});

test('edge drag keeps the aspect and the opposite edge, centred the other way', () => {
  assert.deepEqual(resizeBounds(b, 'e', 40, 999), { x: 100, y: 85, width: 440, height: 330 });
  assert.deepEqual(resizeBounds(b, 'n', 0, 60), { x: 140, y: 160, width: 320, height: 240 });
});

test('never smaller than the minimum nor bigger than the work area', () => {
  const tiny = resizeBounds(b, 'se', -1000, -1000);
  assert.equal(tiny.height, 120);
  assert.equal(tiny.width, 160);
  const big = resizeBounds(b, 'se', 5000, 0, { x: 0, y: 0, width: 1920, height: 1080 });
  assert.ok(big.width <= 1920 && big.height <= 1080 && Math.abs(big.width / big.height - 4 / 3) < 0.01, JSON.stringify(big));
});
