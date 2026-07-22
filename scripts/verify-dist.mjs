import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

const dist = join(process.cwd(), 'dist');
const requiredFiles = [
  'index.html',
  'manifest.webmanifest',
  'sw.js',
  'icons/icon-192.png',
  'icons/icon-512.png',
  'icons/maskable-512.png',
];

for (const relativePath of requiredFiles) {
  if (!existsSync(join(dist, relativePath))) {
    throw new Error(`La compilación PWA no contiene ${relativePath}.`);
  }
}

const html = readFileSync(join(dist, 'index.html'), 'utf8');
const marker = 'data-testid="viability-content"';
const markerIndex = html.indexOf(marker);
const tagStart = html.lastIndexOf('<div', markerIndex);
const tagEnd = html.indexOf('>', markerIndex);
const contentTag = markerIndex >= 0 && tagStart >= 0 && tagEnd >= 0
  ? html.slice(tagStart, tagEnd + 1)
  : '';

if (!contentTag || !contentTag.includes('width:100%') || !contentTag.includes('max-width:720px')) {
  throw new Error('El contenido principal no tiene un ancho SSR válido.');
}
if (contentTag.includes('width:0px')) {
  throw new Error('El contenido principal se exportó con width:0px.');
}

const serviceWorker = readFileSync(join(dist, 'sw.js'), 'utf8');
if (!serviceWorker.includes('SKIP_WAITING')) {
  throw new Error('El service worker no admite la actualización controlada.');
}
const skipWaitingCalls = serviceWorker.match(/self\.skipWaiting\(\)/g) ?? [];
if (
  skipWaitingCalls.length !== 1 ||
  !/addEventListener\("message",.*SKIP_WAITING.*self\.skipWaiting\(\)/.test(serviceWorker)
) {
  throw new Error('skipWaiting debe ejecutarse únicamente al recibir la confirmación por mensaje.');
}
if (serviceWorker.includes('indexedDB.deleteDatabase')) {
  throw new Error('El service worker no puede eliminar IndexedDB.');
}

process.stdout.write('Compilación PWA verificada: SSR, manifiesto, iconos y service worker correctos.\n');
