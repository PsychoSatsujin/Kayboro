'use strict';
// Append-only, hash-chained JSONL ledger of every coin/XP change: <dir>/ledger.jsonl.
// Each line is {t, type, delta:{coins, xp}, ref, prev, hash} with hash = sha256(prev + body).
// The chain makes local edits evident (it is not a security boundary: there is no secret key).
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const GENESIS = '0'.repeat(64);
const int = (n) => (Number.isFinite(n) ? Math.trunc(n) : 0);

const hashOf = (e) => crypto.createHash('sha256')
  .update(JSON.stringify([e.prev, e.t, e.type, e.delta.coins, e.delta.xp, e.ref === undefined ? null : e.ref]))
  .digest('hex');

function makeEntry(prev, t, type, delta, ref) {
  const e = { t: int(t), type: String(type), delta: { coins: int(delta && delta.coins), xp: int(delta && delta.xp) }, ref: ref === undefined ? null : ref, prev };
  e.hash = hashOf(e);
  return e;
}

const validShape = (e) => e && typeof e === 'object' && Number.isInteger(e.t) && typeof e.type === 'string' &&
  e.delta && Number.isInteger(e.delta.coins) && Number.isInteger(e.delta.xp) && typeof e.prev === 'string' && typeof e.hash === 'string';

class Ledger {
  constructor(dir, { now = Date.now } = {}) {
    this.file = path.join(dir, 'ledger.jsonl');
    this.now = now;
    this.entries = [];
    this.head = GENESIS;
    this.tampered = false;
  }

  // Reads and verifies the chain. On a broken link the valid prefix is kept, the bad tail is moved
  // to ledger.jsonl.tampered-<t> and the file is rewritten, so the chain stays verifiable afterwards.
  load() {
    let text = '';
    try { text = fs.readFileSync(this.file, 'utf8'); } catch {}
    const lines = text.split('\n');
    if (lines[lines.length - 1] === '') lines.pop();
    this.entries = [];
    this.head = GENESIS;
    this.tampered = false;
    let bad = -1;
    for (let i = 0; i < lines.length; i++) {
      let e = null;
      try { e = JSON.parse(lines[i]); } catch {}
      if (!validShape(e) || e.prev !== this.head || hashOf(e) !== e.hash) { bad = i; break; }
      this.entries.push(e);
      this.head = e.hash;
    }
    // A broken final line with no "\n" after it is an interrupted write, not tampering: drop it quietly.
    const torn = bad === lines.length - 1 && !text.endsWith('\n');
    if (bad >= 0 && !torn) {
      this.tampered = true;
      try { fs.writeFileSync(`${this.file}.tampered-${this.now()}`, text); } catch {}
    }
    if (bad >= 0 || (text && !text.endsWith('\n'))) this._rewrite();
    return this.entries;
  }

  append(type, delta, ref) {
    const e = makeEntry(this.head, this.now(), type, delta, ref);
    fs.mkdirSync(path.dirname(this.file), { recursive: true });
    fs.appendFileSync(this.file, JSON.stringify(e) + '\n');
    this.entries.push(e);
    this.head = e.hash;
    return e;
  }

  _rewrite() {
    try {
      fs.mkdirSync(path.dirname(this.file), { recursive: true });
      fs.writeFileSync(this.file + '.tmp', this.entries.map((e) => JSON.stringify(e) + '\n').join(''));
      fs.renameSync(this.file + '.tmp', this.file);
    } catch (err) {
      console.error('[shell] ledger rewrite failed:', err);
    }
  }
}

// Plain totals of a list of entries.
const totals = (entries) => entries.reduce((s, e) => ({ coins: s.coins + e.delta.coins, xp: s.xp + e.delta.xp }), { coins: 0, xp: 0 });

module.exports = { Ledger, totals, hashOf, GENESIS };
