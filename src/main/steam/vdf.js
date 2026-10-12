'use strict';
// Valve KeyValues: the text format (libraryfolders.vdf, *.acf, loginusers.vdf) and the binary one
// (appcache/stats/*.bin). Both return null-prototype objects and keep whatever parsed before a truncation.

const obj = () => Object.create(null);
const isObj = (v) => !!v && typeof v === 'object';

// Case-insensitive lookup along a key path: get(o, 'AppState', 'installdir').
function get(o, ...keys) {
  for (const k of keys) {
    if (!isObj(o)) return undefined;
    if (k in o) o = o[k];
    else {
      const lk = String(k).toLowerCase();
      const hit = Object.keys(o).find((x) => x.toLowerCase() === lk);
      o = hit === undefined ? undefined : o[hit];
    }
  }
  return o;
}

const ESC = { n: '\n', t: '\t', r: '\r', '\\': '\\', '"': '"' };

function parseText(src) {
  const s = String(src || '').replace(/^﻿/, '');
  let i = 0;

  function token() {
    for (;;) {
      while (i < s.length && /\s/.test(s[i])) i++;
      if (s[i] === '/' && s[i + 1] === '/') {
        while (i < s.length && s[i] !== '\n') i++;
      } else break;
    }
    if (i >= s.length) return null;
    const c = s[i];
    if (c === '{' || c === '}') return i++, { t: c };
    if (c === '"') {
      let v = '';
      for (i++; i < s.length && s[i] !== '"'; i++) {
        if (s[i] === '\\' && i + 1 < s.length) {
          const e = s[++i];
          v += e in ESC ? ESC[e] : '\\' + e;
        } else v += s[i];
      }
      i++;
      return { t: 's', v };
    }
    const st = i;
    while (i < s.length && !/[\s{}"]/.test(s[i])) i++;
    const v = s.slice(st, i);
    return { t: /^\[.*\]$/.test(v) ? 'cond' : 's', v }; // [$WIN32] style conditionals are ignored
  }

  const root = obj();
  const stack = [root];
  let key = null;
  for (let tk = token(); tk; tk = token()) {
    const top = stack[stack.length - 1];
    if (tk.t === 'cond') continue;
    if (tk.t === '{') {
      if (key === null) continue;
      const o = obj();
      top[key] = o;
      stack.push(o);
      key = null;
    } else if (tk.t === '}') {
      if (stack.length > 1) stack.pop();
      key = null;
    } else if (key === null) key = tk.v;
    else {
      top[key] = tk.v;
      key = null;
    }
  }
  return root;
}

// Binary type bytes.
const T = { NONE: 0, STRING: 1, INT32: 2, FLOAT32: 3, PTR: 4, WSTRING: 5, COLOR: 6, UINT64: 7, END: 8, INT64: 10, END_ALT: 11 };
const STOP = Symbol('truncated');
const big = (n) => (n <= BigInt(Number.MAX_SAFE_INTEGER) && n >= -BigInt(Number.MAX_SAFE_INTEGER) ? Number(n) : String(n));

function parseBinary(buf, offset = 0) {
  const b = Buffer.isBuffer(buf) ? buf : Buffer.from(buf || []);
  let i = offset;
  const need = (n) => {
    if (i + n > b.length) throw STOP;
  };
  const cstr = () => {
    const e = b.indexOf(0, i);
    if (e < 0) throw STOP;
    const v = b.toString('utf8', i, e);
    i = e + 1;
    return v;
  };
  const wstr = () => {
    let e = i;
    while (e + 1 < b.length && (b[e] || b[e + 1])) e += 2;
    if (e + 1 >= b.length) throw STOP;
    const v = b.toString('utf16le', i, e);
    i = e + 2;
    return v;
  };
  const num = (n, read) => {
    need(n);
    const v = read.call(b, i);
    i += n;
    return v;
  };

  function node(o, depth) {
    if (depth > 64) throw STOP;
    while (i < b.length) {
      const t = b[i++];
      if (t === T.END || t === T.END_ALT) return;
      const k = cstr();
      switch (t) {
        case T.NONE: {
          const c = obj();
          o[k] = c;
          node(c, depth + 1);
          break;
        }
        case T.STRING: o[k] = cstr(); break;
        case T.INT32: case T.PTR: case T.COLOR: o[k] = num(4, b.readInt32LE); break;
        case T.FLOAT32: o[k] = num(4, b.readFloatLE); break;
        case T.WSTRING: o[k] = wstr(); break;
        case T.UINT64: o[k] = big(num(8, b.readBigUInt64LE)); break;
        case T.INT64: o[k] = big(num(8, b.readBigInt64LE)); break;
        default: throw STOP; // unknown type: the rest can't be framed
      }
    }
  }

  const root = obj();
  try {
    node(root, 0);
  } catch (e) {
    if (e !== STOP) throw e;
  }
  return root;
}

module.exports = { parseText, parseBinary, get, isObj, TYPES: T };
