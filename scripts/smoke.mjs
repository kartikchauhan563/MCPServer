import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const tsxCli = path.join(root, 'node_modules', 'tsx', 'dist', 'cli.mjs');
const serverEntry = path.join(root, 'src', 'mcp', 'stdio.ts');

const child = spawn(process.execPath, [tsxCli, serverEntry], {
  cwd: root,
  stdio: ['pipe', 'pipe', 'pipe'],
});

let stderr = '';
let stdout = '';
child.stderr.on('data', (chunk) => {
  stderr += chunk.toString();
});
child.stdout.on('data', (chunk) => {
  stdout += chunk.toString();
});

await new Promise((r) => setTimeout(r, 800));

const init = {
  jsonrpc: '2.0',
  id: 1,
  method: 'initialize',
  params: {
    protocolVersion: '2025-11-25',
    capabilities: {},
    clientInfo: { name: 'smoke', version: '1.0.0' },
  },
};

child.stdin.write(`${JSON.stringify(init)}\n`);

await new Promise((r) => setTimeout(r, 1500));

console.error('--- stderr ---');
console.error(stderr.trim());
console.error('--- stdout ---');
console.error(stdout.trim() || '(empty)');

child.kill();
process.exit(stdout.includes('"result"') ? 0 : 1);
