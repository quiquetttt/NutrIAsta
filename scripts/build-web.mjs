import { spawn } from 'node:child_process';
import { join } from 'node:path';

async function runNode(args) {
  const child = spawn(process.execPath, args, {
    cwd: process.cwd(),
    env: process.env,
    stdio: 'inherit',
    windowsHide: true,
  });
  const exitCode = await new Promise((resolve, reject) => {
    child.once('error', reject);
    child.once('exit', (code, signal) => {
      if (signal) reject(new Error(`La compilación terminó por la señal ${signal}.`));
      else resolve(code ?? 1);
    });
  });
  if (exitCode !== 0) process.exit(exitCode);
}

await runNode([join('scripts', 'clean-dist.mjs')]);
await runNode([join('node_modules', 'expo', 'bin', 'cli'), 'export', '--platform', 'web']);
await runNode([join('scripts', 'generate-service-worker.mjs')]);
await runNode([join('scripts', 'verify-dist.mjs')]);
