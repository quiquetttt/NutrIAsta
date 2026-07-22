import { spawn } from 'node:child_process';
import { createServer } from 'node:net';
import { join } from 'node:path';

const build = spawn(process.execPath, [join('scripts', 'build-web.mjs')], {
  cwd: process.cwd(),
  env: process.env,
  stdio: 'inherit',
  windowsHide: true,
});
const buildExitCode = await new Promise((resolve, reject) => {
  build.once('error', reject);
  build.once('exit', (code, signal) => {
    if (signal) reject(new Error(`La compilación E2E terminó por la señal ${signal}.`));
    else resolve(code ?? 1);
  });
});
if (buildExitCode !== 0) process.exit(buildExitCode);

const probe = createServer();
await new Promise((resolve, reject) => {
  probe.once('error', reject);
  probe.listen({ port: 0, host: '127.0.0.1', exclusive: true }, resolve);
});
const address = probe.address();
if (!address || typeof address === 'string') throw new Error('No se pudo reservar un puerto E2E local.');
const port = address.port;
await new Promise((resolve, reject) => {
  probe.close((error) => (error ? reject(error) : resolve()));
});

const cli = join(process.cwd(), 'node_modules', '@playwright', 'test', 'cli.js');
const child = spawn(process.execPath, [cli, 'test', ...process.argv.slice(2)], {
  cwd: process.cwd(),
  env: { ...process.env, NUTRIASTA_E2E_PORT: String(port) },
  stdio: 'inherit',
  windowsHide: true,
});

const exitCode = await new Promise((resolve, reject) => {
  child.once('error', reject);
  child.once('exit', (code, signal) => {
    if (signal) reject(new Error(`Playwright terminó por la señal ${signal}.`));
    else resolve(code ?? 1);
  });
});

process.exitCode = exitCode;
