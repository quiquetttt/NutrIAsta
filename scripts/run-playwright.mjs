import { spawn } from 'node:child_process';
import { mkdtemp, mkdir, readFile, rm, symlink } from 'node:fs/promises';
import { createServer } from 'node:net';
import { tmpdir } from 'node:os';
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

const playwrightArgs = process.argv.slice(2);
const selectedFiles = playwrightArgs.filter((argument) => !argument.startsWith('-'));
const needsHistoricalBuild = selectedFiles.length === 0
  || selectedFiles.some((argument) => argument.includes('service-worker-update'));
let updateFixtureRoot;
let updateEnvironment = {};
if (needsHistoricalBuild) {
  updateFixtureRoot = await mkdtemp(join(tmpdir(), 'nutriasta-update-e2e-'));
  const sourceRoot = join(updateFixtureRoot, 'mvp-1-approved');
  const archivePath = join(updateFixtureRoot, 'mvp-1-approved.tar');
  await mkdir(sourceRoot);
  try {
    await run('git', ['archive', '--format=tar', '--output', archivePath, 'mvp-1-approved-0.2.1'], process.cwd());
    await run('tar', ['-xf', archivePath, '-C', sourceRoot], process.cwd());
    await symlink(join(process.cwd(), 'node_modules'), join(sourceRoot, 'node_modules'), 'junction');
    await run(process.execPath, [
      join(sourceRoot, 'node_modules', 'expo', 'bin', 'cli'),
      'export',
      '--platform',
      'web',
      '--clear',
    ], sourceRoot);
    await run(process.execPath, [join(sourceRoot, 'scripts', 'generate-service-worker.mjs')], sourceRoot);
    await run(process.execPath, [join(sourceRoot, 'scripts', 'verify-dist.mjs')], sourceRoot);
    const oldPackage = JSON.parse(await readFile(join(sourceRoot, 'package.json'), 'utf8'));
    if (oldPackage.version !== '0.2.1') throw new Error(`La compilación histórica no es 0.2.1: ${oldPackage.version}`);
    updateEnvironment = {
      NUTRIASTA_UPDATE_OLD_DIST: join(sourceRoot, 'dist'),
      NUTRIASTA_UPDATE_CURRENT_DIST: join(process.cwd(), 'dist'),
    };
  } catch (error) {
    await rm(updateFixtureRoot, { recursive: true, force: true });
    throw error;
  }
}

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
const child = spawn(process.execPath, [cli, 'test', ...playwrightArgs], {
  cwd: process.cwd(),
  env: { ...process.env, ...updateEnvironment, NUTRIASTA_E2E_PORT: String(port) },
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

if (updateFixtureRoot) await rm(updateFixtureRoot, { recursive: true, force: true });
process.exitCode = exitCode;

async function run(command, args, cwd) {
  const child = spawn(command, args, {
    cwd,
    env: process.env,
    stdio: 'inherit',
    windowsHide: true,
  });
  const exitCode = await new Promise((resolve, reject) => {
    child.once('error', reject);
    child.once('exit', (code, signal) => {
      if (signal) reject(new Error(`${command} terminó por la señal ${signal}.`));
      else resolve(code ?? 1);
    });
  });
  if (exitCode !== 0) throw new Error(`${command} terminó con código ${exitCode}.`);
}
