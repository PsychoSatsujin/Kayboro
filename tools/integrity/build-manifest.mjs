// Writes <root>/integrity.json: the sha256 of every shipped file under src/ (the manifest itself
// excluded). Run it as the last step before packaging: npm run integrity [-- --root DIR]
// At startup Kayboro compares its files against it (src/main/economy/integrity.js); without the
// manifest (a dev checkout) the check is skipped.
import { createRequire } from 'node:module';
import fs from 'node:fs';
import path from 'node:path';

const require = createRequire(import.meta.url);
const { buildManifest, MANIFEST, SRC } = require('../../src/main/economy/integrity.js');

const args = process.argv.slice(2);
const i = args.indexOf('--root');
const root = path.resolve(i >= 0 ? args[i + 1] : SRC);

const manifest = await buildManifest(root);
fs.writeFileSync(path.join(root, MANIFEST), JSON.stringify(manifest, null, 1) + '\n');
console.log(`integrity: ${Object.keys(manifest.files).length} files -> ${path.join(root, MANIFEST)}`);
