// Invisible screens (src/main/vdd): resolution choice per shell aspect, and the Kayboro driver contract in
// worker.js matching driver/include/kbvdd_ioctl.h (interface GUID and IOCTL function numbers).
const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const ROOT = path.join(__dirname, '..');
const vdd = require('../src/main/vdd');

test('sizeFor: about 1080 lines in the shell aspect, even sizes, within the driver limits', () => {
  assert.deepEqual(vdd.sizeFor(16 / 9, 'kayboro'), { w: 1920, h: 1080 });
  assert.deepEqual(vdd.sizeFor(4 / 3, 'kayboro'), { w: 1440, h: 1080 });
  assert.deepEqual(vdd.sizeFor(1, 'kayboro'), { w: 1080, h: 1080 });
  assert.deepEqual(vdd.sizeFor(21 / 9, 'kayboro'), { w: 3360, h: 1440 });
  assert.deepEqual(vdd.sizeFor(NaN, 'kayboro'), { w: 1920, h: 1080 }, 'unknown aspect falls back to 16:9');
  assert.deepEqual(vdd.sizeFor(9 / 16, 'kayboro'), { w: 1080, h: 1920 }, 'portrait keys off the width');
  for (const a of [0.5, 0.75, 1.25, 1.5, 1.6, 2.4, 3.5]) {
    const { w, h } = vdd.sizeFor(a, 'kayboro');
    assert.ok(w % 8 === 0 && w >= 640 && w <= 7680 && h >= 480 && h <= 4320, `${a}: ${w}x${h}`);
    assert.ok(Math.abs(w / h - a) / a < 0.02, `${a}: ${w}x${h} keeps the aspect`);
  }
});

test('sizeFor: the Parsec driver gets its closest preset, about 1080 lines', () => {
  assert.deepEqual(vdd.sizeFor(16 / 9, 'parsec'), { w: 1920, h: 1080 }, 'about 1080 lines, not 4K');
  assert.deepEqual(vdd.sizeFor(21 / 9, 'parsec'), { w: 2560, h: 1080 });
  assert.ok(vdd.sizeFor(4 / 3, 'parsec').w > 0);
});

test('worker.js speaks the protocol in driver/include/kbvdd_ioctl.h', () => {
  const h = fs.readFileSync(path.join(ROOT, 'driver', 'include', 'kbvdd_ioctl.h'), 'utf8');
  const w = fs.readFileSync(path.join(ROOT, 'src', 'main', 'vdd', 'worker.js'), 'utf8');
  const guid = /\{([0-9a-f-]{36})\}/i.exec(h)[1].toLowerCase();
  assert.match(w, new RegExp(`guid: '${guid}'`), 'interface GUID');
  for (const [name, op] of [['INFO', 'INFO'], ['ADD', 'ADD'], ['REMOVE', 'REMOVE'], ['PING', 'PING']]) {
    const fn = new RegExp(`IOCTL_KBVDD_${name} CTL_CODE\\(FILE_DEVICE_UNKNOWN, (0x[0-9a-f]+), METHOD_BUFFERED, FILE_ANY_ACCESS\\)`, 'i').exec(h)[1];
    assert.match(w, new RegExp(`${op}: ioctl\\(${fn}\\)`), `${name} uses function ${fn}`);
  }
  assert.match(h, /#define KBVDD_ALL 0xFFFFFFFFu/);
  assert.match(w, /ALL: 0xffffffff/);
  const add = /typedef struct _KBVDD_ADD_IN \{([\s\S]*?)\} KBVDD_ADD_IN;/.exec(h)[1];
  assert.deepEqual([...add.matchAll(/UINT32 (\w+);/g)].map((m) => m[1]), ['Width', 'Height', 'Refresh', 'Flags'], 'ADD input layout the worker writes');
});

test('status() reports no driver gracefully off Windows or without one', async () => {
  const s = await vdd.status();
  assert.equal(typeof s.available, 'boolean');
  assert.ok(Array.isArray(s.active));
  await vdd.dispose();
});
