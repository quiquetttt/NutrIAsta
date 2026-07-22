import { cp, mkdir, readdir, rm, writeFile } from 'node:fs/promises';
import { join } from 'node:path';

const dist = join(process.cwd(), 'dist');
const client = join(dist, 'client');
const server = join(dist, 'server');

await rm(client, { recursive: true, force: true });
await rm(server, { recursive: true, force: true });
await mkdir(client, { recursive: true });
await mkdir(server, { recursive: true });

for (const entry of await readdir(dist, { withFileTypes: true })) {
  if (entry.name === 'client' || entry.name === 'server') continue;
  await cp(join(dist, entry.name), join(client, entry.name), { recursive: true });
}

const worker = `const worker = {
  async fetch(request, env) {
    const url = new URL(request.url);
    let response = await env.ASSETS.fetch(request);

    if (response.status === 404 && request.method === 'GET' && request.headers.get('accept')?.includes('text/html')) {
      response = await env.ASSETS.fetch(new Request(new URL('/index.html', url), request));
    }

    if (url.pathname === '/sw.js' && response.ok) {
      const headers = new Headers(response.headers);
      headers.set('Cache-Control', 'no-cache, no-store, must-revalidate');
      headers.set('Pragma', 'no-cache');
      headers.set('Expires', '0');
      headers.set('Service-Worker-Allowed', '/');
      return new Response(response.body, { status: response.status, statusText: response.statusText, headers });
    }

    if (url.pathname === '/manifest.webmanifest' && response.ok) {
      const headers = new Headers(response.headers);
      headers.set('Content-Type', 'application/manifest+json; charset=utf-8');
      return new Response(response.body, { status: response.status, statusText: response.statusText, headers });
    }

    return response;
  },
};

export default worker;
`;

await writeFile(join(server, 'index.js'), worker, 'utf8');
process.stdout.write('Paquete estatico preparado para hosting HTTPS.\n');
