import { chromium } from '@playwright/test';
import { readFile, mkdir } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const currentDir = path.dirname(fileURLToPath(import.meta.url));
const prototypeUrl = pathToFileURL(path.join(currentDir, 'index.html'));
const outputDir = path.resolve(currentDir, '..', 'mockups');

const captures = [
  { name: '01-hoy-390.png', width: 390, height: 844, query: 'view=today' },
  { name: '02-calendario-390.png', width: 390, height: 844, query: 'view=training' },
  { name: '03-inventario-aviso-390.png', width: 390, height: 844, query: 'view=inventory&modal=depletion' },
  { name: '04-peso-390.png', width: 390, height: 844, query: 'view=profile&panel=weight' },
  { name: '05-restauracion-390.png', width: 390, height: 844, query: 'view=profile&panel=backup&restore=activated&focus=restore' },
  { name: '06-hoy-320.png', width: 320, height: 700, query: 'view=today' },
  { name: '07-escritorio-1280.png', width: 1280, height: 800, query: 'view=today' },
];

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

function urlFor(query) {
  const value = new URL(prototypeUrl.href);
  value.search = query;
  return value.href;
}

function luminance(hex) {
  const parts = hex.match(/[a-f\d]{2}/gi).map((part) => Number.parseInt(part, 16) / 255);
  const linear = parts.map((value) => value <= 0.04045 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4);
  return 0.2126 * linear[0] + 0.7152 * linear[1] + 0.0722 * linear[2];
}

function contrast(foreground, background) {
  const first = luminance(foreground);
  const second = luminance(background);
  return (Math.max(first, second) + 0.05) / (Math.min(first, second) + 0.05);
}

const contrastPairs = [
  ['#ffffff', '#071a2f', 'texto blanco sobre azul de marca'],
  ['#11784b', '#ffffff', 'verde oscuro sobre blanco'],
  ['#0d1f2d', '#f4f7f5', 'texto principal sobre fondo'],
  ['#8a5300', '#fff2d8', 'advertencia sobre fondo ámbar'],
  ['#a63333', '#fde8e8', 'error sobre fondo rojo suave'],
  ['#64727c', '#ffffff', 'texto secundario sobre blanco'],
];

for (const [foreground, background, label] of contrastPairs) {
  assert(contrast(foreground, background) >= 4.5, `Contraste insuficiente: ${label}.`);
}

const cssSource = await readFile(path.join(currentDir, 'styles.css'), 'utf8');
assert(cssSource.includes('env(safe-area-inset-top'), 'Falta el área segura superior.');
assert(cssSource.includes('env(safe-area-inset-bottom'), 'Falta el área segura inferior.');
assert(cssSource.includes('@media (prefers-reduced-motion: reduce)'), 'Falta soporte de movimiento reducido.');

await mkdir(outputDir, { recursive: true });

const browser = await chromium.launch({ headless: true });
const externalRequests = [];

function observeRequests(page) {
  page.on('request', (request) => {
  const requestUrl = request.url();
  if (requestUrl.startsWith('http://') || requestUrl.startsWith('https://')) {
    externalRequests.push(requestUrl);
  }
  });
}

async function inspectLayout(page, label) {
  const result = await page.evaluate(() => {
    const visibleButtons = [...document.querySelectorAll('button')]
      .filter((button) => {
        const style = getComputedStyle(button);
        const rect = button.getBoundingClientRect();
        return style.display !== 'none' && style.visibility !== 'hidden' && rect.width > 0 && rect.height > 0;
      })
      .map((button) => {
        const rect = button.getBoundingClientRect();
        return {
          text: button.textContent.trim().replace(/\s+/g, ' ').slice(0, 80),
          left: rect.left,
          right: rect.right,
        };
      });

    return {
      innerWidth,
      scrollWidth: document.documentElement.scrollWidth,
      overflowButtons: visibleButtons.filter((button) => button.left < -0.5 || button.right > innerWidth + 0.5),
    };
  });

  assert(result.scrollWidth <= result.innerWidth, `${label}: existe desplazamiento horizontal.`);
  assert(result.overflowButtons.length === 0, `${label}: botones fuera del viewport: ${JSON.stringify(result.overflowButtons)}`);
}

for (const capture of captures) {
  const page = await browser.newPage();
  observeRequests(page);
  await page.emulateMedia({ colorScheme: 'light', reducedMotion: 'reduce' });
  await page.setViewportSize({ width: capture.width, height: capture.height });
  await page.goto(urlFor(capture.query), { waitUntil: 'load' });
  await page.evaluate(async () => {
    if (document.fonts?.ready) await document.fonts.ready;
    await new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve)));
    window.scrollTo(0, 0);
  });
  await inspectLayout(page, capture.name);
  await page.screenshot({
    path: path.join(outputDir, capture.name),
    fullPage: false,
    animations: 'disabled',
  });
  await page.close();
}

const page = await browser.newPage();
observeRequests(page);
await page.emulateMedia({ colorScheme: 'light', reducedMotion: 'reduce' });
await page.setViewportSize({ width: 320, height: 700 });
await page.goto(urlFor('view=today'), { waitUntil: 'load' });
const navigationNames = ['Hoy', 'Diario', 'Entrenar', 'Inventario', 'Perfil'];
for (const name of navigationNames) {
  const navigationButton = page.locator('.bottom-nav button', { hasText: name });
  assert(await navigationButton.count() === 1, `Navegación 320: no existe una única pestaña ${name}.`);
  await navigationButton.click();
  const activeView = await page.locator('.app-view.is-active').getAttribute('data-view');
  assert(Boolean(activeView), `Navegación 320: ${name} no activa ninguna pantalla.`);
  await inspectLayout(page, `navegación 320: ${name}`);
}

const labelsFit = await page.evaluate(() => [...document.querySelectorAll('.bottom-nav button strong')].every((label) => {
  return label.scrollWidth <= label.clientWidth + 1 && label.textContent.trim().length > 0;
}));
assert(labelsFit, 'Navegación 320: algún nombre de pestaña queda truncado.');

await page.goto(urlFor('view=today&text=200'), { waitUntil: 'load' });
await inspectLayout(page, 'texto al 200 % en 320 px');
const allScaledTabsVisible = await page.evaluate(() => {
  const labels = [...document.querySelectorAll('.bottom-nav button strong')];
  return labels.length === 5 && labels.every((label) => {
    const style = getComputedStyle(label);
    const rect = label.getBoundingClientRect();
    return style.display !== 'none' && rect.width > 0 && rect.height > 0;
  });
});
assert(allScaledTabsVisible, 'Texto al 200 %: no son visibles las cinco pestañas.');

for (const name of navigationNames) {
  const navigationButton = page.locator('.bottom-nav button', { hasText: name });
  assert(await navigationButton.count() === 1, `Texto al 200 %: no existe una única pestaña ${name}.`);
  await navigationButton.click();
  await inspectLayout(page, `texto al 200 % en 320 px: ${name}`);
}

const reducedMotionDuration = await page.locator('.app-view.is-active').evaluate((element) => {
  return getComputedStyle(element).animationDuration;
});
assert(['0s', '0.00001s', '0.01ms', '1e-05s'].includes(reducedMotionDuration), `Movimiento reducido no aplicado: ${reducedMotionDuration}.`);

assert(externalRequests.length === 0, `Se detectaron solicitudes externas: ${externalRequests.join(', ')}`);

await browser.close();
console.log(`Capturas generadas y comprobaciones superadas: ${captures.length}.`);
