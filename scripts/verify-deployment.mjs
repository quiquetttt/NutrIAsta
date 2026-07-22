import { chromium } from '@playwright/test';

const rawUrl = process.argv[2];
if (!rawUrl) throw new Error('Uso: node scripts/verify-deployment.mjs https://sitio.example');

const deploymentUrl = new URL(rawUrl);
if (deploymentUrl.protocol !== 'https:') throw new Error('El despliegue no usa HTTPS.');

const browser = await chromium.launch();
const context = await browser.newContext({ serviceWorkers: 'allow' });
const page = await context.newPage();
const requestOrigins = new Set();

page.on('request', (request) => {
  const url = new URL(request.url());
  if (url.protocol === 'http:' || url.protocol === 'https:') requestOrigins.add(url.origin);
});

try {
  const response = await page.goto(deploymentUrl.href, { waitUntil: 'networkidle' });
  if (!response?.ok()) throw new Error(`La pagina inicial respondio con ${response?.status() ?? 'sin respuesta'}.`);

  const manifestLink = await page.locator('link[rel="manifest"]').getAttribute('href');
  if (!manifestLink) throw new Error('No existe enlace al manifiesto.');
  const manifestUrl = new URL(manifestLink, deploymentUrl);
  const manifestResponse = await context.request.get(manifestUrl.href);
  if (!manifestResponse.ok()) throw new Error(`El manifiesto respondio con ${manifestResponse.status()}.`);
  const manifest = await manifestResponse.json();
  if (manifest.name !== 'NutrIAsta' || manifest.display !== 'standalone') {
    throw new Error('El manifiesto no identifica una PWA instalable de NutrIAsta.');
  }

  for (const icon of manifest.icons ?? []) {
    const iconResponse = await context.request.get(new URL(icon.src, deploymentUrl).href);
    if (!iconResponse.ok()) throw new Error(`No se pudo descargar el icono ${icon.src}.`);
  }

  const swResponse = await context.request.get(new URL('/sw.js', deploymentUrl).href);
  if (!swResponse.ok()) throw new Error(`El service worker respondio con ${swResponse.status()}.`);
  const cacheControl = swResponse.headers()['cache-control'] ?? '';
  if (!cacheControl.includes('no-cache') || !cacheControl.includes('no-store')) {
    throw new Error(`sw.js tiene una politica de cache insegura: ${cacheControl || 'ausente'}.`);
  }
  const swSource = await swResponse.text();
  if (swSource.includes('skipWaiting:!0') || swSource.includes('skipWaiting:true')) {
    throw new Error('El service worker activa skipWaiting automaticamente.');
  }
  if (swSource.includes('indexedDB.deleteDatabase')) {
    throw new Error('El service worker contiene una eliminacion de IndexedDB.');
  }

  await page.evaluate(async () => {
    await navigator.serviceWorker.ready;
  });
  await page.reload({ waitUntil: 'networkidle' });
  await page.waitForFunction(() => Boolean(navigator.serviceWorker.controller));

  const unexpectedOrigins = [...requestOrigins].filter((origin) => origin !== deploymentUrl.origin);
  if (unexpectedOrigins.length) {
    throw new Error(`Se detectaron solicitudes a terceros: ${unexpectedOrigins.join(', ')}`);
  }

  await context.setOffline(true);
  await page.reload({ waitUntil: 'domcontentloaded' });
  await page.getByText('NutrIAsta', { exact: true }).first().waitFor();

  process.stdout.write(JSON.stringify({
    url: deploymentUrl.href,
    https: true,
    manifest: true,
    icons: manifest.icons?.length ?? 0,
    serviceWorker: true,
    swCacheControl: cacheControl,
    offline: true,
    requestOrigins: [...requestOrigins],
  }, null, 2));
  process.stdout.write('\n');
} finally {
  await context.close();
  await browser.close();
}
