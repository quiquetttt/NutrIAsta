import { createHash } from 'node:crypto';
import { createReadStream, existsSync, readFileSync, statSync } from 'node:fs';
import { createServer } from 'node:http';
import { extname, join, normalize, resolve } from 'node:path';

const port = Number(process.argv[2]);
const oldRoot = resolve(process.argv[3] ?? '');
const currentRoot = resolve(process.argv[4] ?? '');
if (!Number.isInteger(port) || port < 1024 || port > 65_535) throw new Error('Puerto de actualización no válido.');
for (const root of [oldRoot, currentRoot]) {
  if (!existsSync(join(root, 'index.html')) || !existsSync(join(root, 'sw.js'))) {
    throw new Error(`La compilación de actualización no está completa: ${root}`);
  }
}

const buildIds = {
  old: buildId(oldRoot),
  current: buildId(currentRoot),
};
if (buildIds.old === buildIds.current) throw new Error('La prueba de actualización necesita dos builds diferentes.');
let active = 'old';

const mimeTypes = {
  '.css': 'text/css; charset=utf-8',
  '.html': 'text/html; charset=utf-8',
  '.ico': 'image/x-icon',
  '.js': 'text/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.png': 'image/png',
  '.svg': 'image/svg+xml',
  '.webmanifest': 'application/manifest+json; charset=utf-8',
};

createServer((request, response) => {
  const requested = decodeURIComponent((request.url ?? '/').split('?')[0]);
  if (requested === '/__e2e__/build') {
    response.setHeader('Cache-Control', 'no-store');
    response.setHeader('Content-Type', 'application/json');
    response.end(JSON.stringify({ active, ...buildIds }));
    return;
  }
  if (requested === '/__e2e__/activate-candidate' && request.method === 'POST') {
    active = 'current';
    response.setHeader('Cache-Control', 'no-store');
    response.setHeader('Content-Type', 'application/json');
    response.end(JSON.stringify({ active, ...buildIds }));
    return;
  }
  const root = active === 'old' ? oldRoot : currentRoot;
  const safePath = normalize(requested).replace(/^(\.\.[/\\])+/, '');
  let filePath = join(root, safePath === '/' ? 'index.html' : safePath);
  if (!filePath.startsWith(root) || !existsSync(filePath) || statSync(filePath).isDirectory()) {
    filePath = join(root, 'index.html');
  }
  response.setHeader('Content-Type', mimeTypes[extname(filePath)] ?? 'application/octet-stream');
  response.setHeader('Cache-Control', filePath.endsWith('sw.js') ? 'no-cache, no-store, must-revalidate' : 'public, max-age=0');
  response.setHeader('X-NutrIAsta-Build', active === 'old' ? buildIds.old : buildIds.current);
  createReadStream(filePath).pipe(response);
}).listen({ port, host: '127.0.0.1', exclusive: true }, () => {
  process.stdout.write(`UPDATE_SERVER_READY http://127.0.0.1:${port} ${buildIds.old} ${buildIds.current}\n`);
});

function buildId(root) {
  return createHash('sha256').update(readFileSync(join(root, 'index.html'))).digest('hex').slice(0, 16);
}
