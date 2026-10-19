'use strict';
// Starts Kayboro from source in the tester sandbox on any OS (what START_SANDBOX.bat does on Windows):
//
//   node tools/local/start-sandbox.cjs [electron args]
//
// Sets KAYBORO_SANDBOX=1 (separate userData, Tester tools in Profile, Kayboro's own Steam achievements
// off; see src/main/sandbox.js) and clears KAYBORO_TEST, then runs `electron .` with the same stdio.
const path = require('path');
const { spawn } = require('child_process');

const ROOT = path.resolve(__dirname, '..', '..');
const env = { ...process.env, KAYBORO_SANDBOX: '1' };
delete env.KAYBORO_TEST;
const dir = env.KAYBORO_SANDBOX_DIR || path.join(ROOT, '.sandbox', 'userData');
console.log(`[sandbox] starting Kayboro with the sandbox profile in ${dir}`);

const electron = require(path.join(ROOT, 'node_modules', 'electron')); // the binary's path when required from Node
const child = spawn(electron, [ROOT, ...process.argv.slice(2)], { stdio: 'inherit', env, cwd: ROOT });
child.on('error', (err) => { console.error(`[sandbox] could not start Electron: ${err.message}`); process.exit(1); });
child.on('exit', (code, signal) => process.exit(signal ? 1 : (code ?? 1)));
