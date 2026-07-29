import { createServer } from 'node:http';
import { readFile, stat } from 'node:fs/promises';
import { extname, join, normalize } from 'node:path';
import { chromium, webkit } from '@playwright/test';

const root = normalize(new URL('.', import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, '$1'));
const requests = [];
const server = createServer(async (request, response) => {
  const path = request.url === '/' ? '/index.html' : request.url.split('?')[0];
  const target = normalize(join(root, path));
  if (!target.startsWith(root)) {
    response.writeHead(403).end();
    return;
  }
  try {
    const info = await stat(target);
    if (!info.isFile()) throw new Error('not-file');
    const types = {
      '.html': 'text/html; charset=utf-8',
      '.js': 'text/javascript; charset=utf-8',
      '.wasm': 'application/wasm',
      '.gz': 'application/gzip',
    };
    requests.push(path);
    response.setHeader('Content-Type', types[extname(target)] ?? 'application/octet-stream');
    response.setHeader('Cache-Control', 'no-store');
    response.end(await readFile(target));
  } catch {
    response.writeHead(404).end();
  }
});

await new Promise((resolve) => server.listen(4399, '127.0.0.1', resolve));
const results = {};
try {
  for (const [name, browserType] of [['chromium', chromium], ['webkit', webkit]]) {
    const browser = await browserType.launch();
    const page = await browser.newPage();
    const external = [];
    page.on('request', (request) => {
      const url = new URL(request.url());
      if (url.hostname !== '127.0.0.1') external.push(request.url());
    });
    await page.goto('http://127.0.0.1:4399/');
    await page.getByRole('button', { name: 'Ejecutar prueba' }).click();
    await page.waitForFunction(() => window.__ocrProofResult, null, { timeout: 120_000 });
    const variants = await page.evaluate(() => window.__runOcrVariants());
    const cancellation = await page.evaluate(() => window.__testOcrCancellation());
    results[name] = {
      result: await page.evaluate(() => window.__ocrProofResult),
      variants,
      cancellation,
      external,
    };
    await browser.close();
  }
} finally {
  server.close();
}

process.stdout.write(`${JSON.stringify({ results, localRequests: [...new Set(requests)] }, null, 2)}\n`);
if (Object.values(results).some(({ result, external }) => result.error || external.length)) process.exitCode = 1;
