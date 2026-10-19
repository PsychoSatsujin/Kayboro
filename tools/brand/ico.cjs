'use strict';
// Tiny dependency-free .ico writer. Every entry is a PNG (allowed since Vista; Explorer, the taskbar,
// electron-builder and Steam all read them), so the file is just an ICONDIR, one ICONDIRENTRY per size
// and the PNG bytes back to back.
//
//   const { ico } = require('./ico.cjs');
//   fs.writeFileSync('icon.ico', ico([{ size: 16, png }, { size: 32, png }, ...]));   // png: Buffer

const SIG = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);

/** Width/height of a PNG from its IHDR; throws when the buffer is not a PNG. */
function pngSize(png) {
  if (!Buffer.isBuffer(png) || png.length < 24 || !png.subarray(0, 8).equals(SIG) || png.toString('ascii', 12, 16) !== 'IHDR') throw new Error('not a PNG');
  return { w: png.readUInt32BE(16), h: png.readUInt32BE(20) };
}

/** Build an .ico from square PNG entries, smallest first. Sizes must be 1..256 and unique. */
function ico(entries) {
  if (!entries.length) throw new Error('ico needs at least one entry');
  const list = [...entries].sort((a, b) => a.size - b.size), seen = new Set();
  for (const { size, png } of list) {
    const { w, h } = pngSize(png);
    if (!Number.isInteger(size) || size < 1 || size > 256) throw new Error(`bad icon size ${size}`);
    if (w !== size || h !== size) throw new Error(`entry ${size} is a ${w}x${h} PNG`);
    if (seen.has(size)) throw new Error(`duplicate icon size ${size}`);
    seen.add(size);
  }
  const head = Buffer.alloc(6 + 16 * list.length);
  head.writeUInt16LE(0, 0); head.writeUInt16LE(1, 2); head.writeUInt16LE(list.length, 4);
  let off = head.length;
  list.forEach(({ size, png }, i) => {
    const e = 6 + i * 16;
    head[e] = size === 256 ? 0 : size; head[e + 1] = size === 256 ? 0 : size; // 0 means 256
    head[e + 2] = 0; head[e + 3] = 0;
    head.writeUInt16LE(1, e + 4); head.writeUInt16LE(32, e + 6);
    head.writeUInt32LE(png.length, e + 8); head.writeUInt32LE(off, e + 12);
    off += png.length;
  });
  return Buffer.concat([head, ...list.map((e) => e.png)]);
}

/** Parse an .ico back into [{ size, offset, length }] (for tests and sanity checks). */
function readIco(buf) {
  if (buf.readUInt16LE(0) !== 0 || buf.readUInt16LE(2) !== 1) throw new Error('not an ICO');
  const n = buf.readUInt16LE(4), out = [];
  for (let i = 0; i < n; i++) {
    const e = 6 + i * 16, w = buf[e] || 256;
    out.push({ size: w, length: buf.readUInt32LE(e + 8), offset: buf.readUInt32LE(e + 12) });
  }
  return out;
}

module.exports = { ico, readIco, pngSize };
