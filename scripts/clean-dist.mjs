import { rm } from 'node:fs/promises';
import { basename, dirname, join, resolve } from 'node:path';

const workspace = resolve(process.cwd());
const target = resolve(join(workspace, 'dist'));

if (dirname(target) !== workspace || basename(target) !== 'dist') {
  throw new Error(`Se rechazó limpiar una ruta inesperada: ${target}`);
}

await rm(target, { recursive: true, force: true });
