// Password input is hidden; only a salted verifier is uploaded as a Worker secret.
import { spawnSync, spawn } from 'node:child_process';
import readline from 'node:readline';
import { passwordHash } from '../worker/auth.mjs';
if (!process.stdin.isTTY) throw new Error('Run this command in a terminal.');
spawnSync('stty', ['-echo'], { stdio: 'inherit' });
console.log('Enter the admin password (input hidden):');
const reader = readline.createInterface({ input: process.stdin });
try {
  const password = await new Promise(resolve => reader.once('line', resolve));
  reader.close();
  if (password.length < 12 || password.length > 256) throw new Error('Use 12 to 256 characters.');
  const hash = await passwordHash(password);
  const child = spawn(process.execPath, ['node_modules/wrangler/bin/wrangler.js', 'secret', 'put', 'ADMIN_PASSWORD_HASH'], { stdio: ['pipe', 'inherit', 'inherit'] });
  child.stdin.end(hash);
  const code = await new Promise(resolve => child.once('exit', resolve));
  if (code !== 0) process.exitCode = code || 1;
} finally {
  spawnSync('stty', ['echo'], { stdio: 'inherit' });
}
