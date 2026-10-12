'use strict';
// Named scenes persisted as one JSON object at <userData>/scenes.json.
const fs = require('fs');
const path = require('path');
const { app } = require('electron');

const file = () => path.join(app.getPath('userData'), 'scenes.json');
const validName = (n) => typeof n === 'string' && n.trim().length > 0 && n.length <= 120;

function read() {
  try {
    const d = JSON.parse(fs.readFileSync(file(), 'utf8'));
    // Null-prototype copy so names like "__proto__" are plain keys.
    return d && typeof d === 'object' && !Array.isArray(d) ? Object.assign(Object.create(null), d) : Object.create(null);
  } catch {
    return Object.create(null);
  }
}

function write(data) {
  try {
    const f = file();
    fs.mkdirSync(path.dirname(f), { recursive: true });
    fs.writeFileSync(f + '.tmp', JSON.stringify(data, null, 2));
    fs.renameSync(f + '.tmp', f); // atomic replace
    return true;
  } catch (err) {
    console.error('[store] write failed:', err);
    return false;
  }
}

module.exports = {
  list: () => Object.keys(read()).sort((a, b) => a.localeCompare(b)),
  load: (name) => (validName(name) && read()[name]) || null,
  save(name, obj) {
    if (!validName(name) || !obj || typeof obj !== 'object') return false;
    const d = read();
    d[name.trim()] = obj;
    return write(d);
  },
  remove(name) {
    const d = read();
    if (!validName(name) || !(name in d)) return false;
    delete d[name];
    return write(d);
  },
};
