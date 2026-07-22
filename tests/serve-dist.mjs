import { createHash } from 'node:crypto';
import { createReadStream, existsSync, readFileSync, statSync } from 'node:fs';
import { createServer } from 'node:http';
import { extname, join, normalize } from 'node:path';

const root = join(process.cwd(), 'dist');
const port = Number(process.argv[2]);
const indexPath = join(root, 'index.html');
const serviceWorkerPath = join(root, 'sw.js');

if (!Number.isInteger(port) || port < 1024 || port > 65_535) {
  throw new Error('El servidor E2E necesita un puerto local válido.');
}
if (!existsSync(indexPath) || !existsSync(serviceWorkerPath)) {
  throw new Error('Falta una compilación dist completa. Ejecuta npm run build:web.');
}

const buildId = createHash('sha256').update(readFileSync(indexPath)).digest('hex').slice(0, 16);
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
  if (requested === '/__e2e__/blank') {
    response.statusCode = 200;
    response.setHeader('Content-Type', 'text/html; charset=utf-8');
    response.setHeader('Cache-Control', 'no-store');
    response.end('<!doctype html><html><body>Preparación E2E</body></html>');
    return;
  }
  const safePath = normalize(requested).replace(/^(\.\.[/\\])+/, '');
  let filePath = join(root, safePath === '/' ? 'index.html' : safePath);
  if (!filePath.startsWith(root) || !existsSync(filePath) || statSync(filePath).isDirectory()) {
    filePath = join(root, 'index.html');
  }
  response.setHeader('Content-Type', mimeTypes[extname(filePath)] ?? 'application/octet-stream');
  response.setHeader('Cache-Control', filePath.endsWith('sw.js') ? 'no-cache' : 'public, max-age=0');
  response.setHeader('X-NutrIAsta-Build', buildId);
  createReadStream(filePath).pipe(response);
}).listen({ port, host: '127.0.0.1', exclusive: true }, () => {
  process.stdout.write(`Serving dist ${buildId} on http://127.0.0.1:${port}\n`);
});
