// node:sqlite and plain files dressed up as Cloudflare's D1 and KV, so ../src/index.mjs runs unchanged on Node.
import fs from 'node:fs';
import path from 'node:path';

// ---- D1 shim over node:sqlite (D1 binds ?1, ?2 ...; node:sqlite takes named $p1, $p2 ...) ----
export function d1(db) {
  return {
    prepare(sql) {
      const used = [...new Set([...sql.matchAll(/\?(\d+)/g)].map((m) => Number(m[1])))];
      const st = db.prepare(sql.replace(/\?(\d+)/g, '$$p$1'));
      let args = [];
      const stmt = {
        bind(...a) {
          const o = {};
          for (const n of used) o[`p${n}`] = a[n - 1] === undefined ? null : a[n - 1];
          args = used.length ? [o] : [];
          return stmt;
        },
        async first() { const r = st.get(...args); return r ? { ...r } : null; },
        async all() { return { results: st.all(...args).map((r) => ({ ...r })) }; },
        async run() { const r = st.run(...args); return { meta: { changes: Number(r.changes) } }; },
      };
      return stmt;
    },
  };
}

// ---- KV as files: the key, made filename-safe ----
export function fileKv(dir) {
  const file = (k) => path.join(dir, encodeURIComponent(k));
  return {
    async get(k) { try { return fs.readFileSync(file(k), 'utf8'); } catch { return null; } },
    async put(k, v) { fs.writeFileSync(file(k) + '.tmp', String(v)); fs.renameSync(file(k) + '.tmp', file(k)); },
  };
}
