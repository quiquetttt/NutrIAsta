import { spawn, type ChildProcess } from 'node:child_process';
import { createServer } from 'node:net';
import { join } from 'node:path';

import { expect, test, type BrowserContext, type Page } from '@playwright/test';

import { MAIN_DATABASE_VERSION } from '../../src/storage/main-schema';
import { readLegacyState, seedLegacyDatabase } from './legacy-fixture';
import { openMvpSection } from './mvp-fixture';

test.describe.serial('actualización real 0.2.1 → 0.3.0 bajo el mismo origen', () => {
  let context: BrowserContext;
  let page: Page;
  let server: ChildProcess;
  let origin: string;
  let externalRequests: string[];

  test.beforeAll(async ({ browser }) => {
    const oldDist = process.env.NUTRIASTA_UPDATE_OLD_DIST;
    const currentDist = process.env.NUTRIASTA_UPDATE_CURRENT_DIST;
    expect(oldDist, 'Falta la compilación histórica preparada por npm run test:e2e.').toBeTruthy();
    expect(currentDist, 'Falta la compilación candidata preparada por npm run test:e2e.').toBeTruthy();

    const port = await reservePort();
    origin = `http://127.0.0.1:${port}`;
    server = startUpdateServer(port, oldDist!, currentDist!);
    await waitForServer(server);
    context = await browser.newContext({ baseURL: origin, serviceWorkers: 'allow' });
    externalRequests = [];
    context.on('request', (request) => {
      if (new URL(request.url()).origin !== origin) externalRequests.push(request.url());
    });
    page = await context.newPage();
  });

  test.afterAll(async () => {
    await context?.close();
    if (server) await stopServer(server);
  });

  test('avisa, espera una fotografía pendiente y conserva las dos IndexedDB', async () => {
    const buildStatus = await context.request.get(`${origin}/__e2e__/build`);
    expect(buildStatus.ok()).toBe(true);
    const builds = await buildStatus.json() as { active: string; old: string; current: string };
    expect(builds).toMatchObject({ active: 'old' });
    expect(builds.old).not.toBe(builds.current);

    await createProfileInHistoricalBuild(page);
    await expect(page.getByText(/Versión 0\.2\.1/).first()).toBeVisible();
    const legacyBefore = await readLegacyState(page);
    expect(await mainState(page)).toMatchObject({ version: 50, alias: 'Perfil actualización ficticio' });
    expect(await page.evaluate(() => Boolean(navigator.serviceWorker.controller))).toBe(true);

    const switched = await context.request.post(`${origin}/__e2e__/activate-candidate`);
    expect(await switched.json()).toMatchObject({ active: 'current', old: builds.old, current: builds.current });
    await page.evaluate(async () => {
      const registration = await navigator.serviceWorker.ready;
      await registration.update();
    });
    await expect(page.getByText('Nueva versión disponible')).toBeVisible();
    await expect(page.getByText(/Versión 0\.2\.1/).first()).toBeVisible();
    await page.waitForTimeout(300);
    await expect(page.getByText(/Versión 0\.2\.1/).first()).toBeVisible();

    await page.getByRole('tab', { name: 'Alimentos', exact: true }).click();
    await page.getByRole('button', { name: 'Añadir alimento' }).click();
    await page.getByLabel('Nombre', { exact: true }).fill('Fotografía actualización ficticia');
    await page.getByLabel('Energía (kcal)').fill('100');
    await holdImageDecoding(page);
    await page.getByLabel('Fotografía local de etiqueta').setInputFiles({
      name: 'actualizacion-ficticia.png',
      mimeType: 'image/png',
      buffer: Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=', 'base64'),
    });
    await page.getByRole('button', { name: 'Actualizar ahora' }).click();
    await page.waitForTimeout(300);
    await expect(page.getByText(/Versión 0\.2\.1/).first()).toBeVisible();

    await page.evaluate(() => (window as unknown as { __releasePhotoProcessing: () => void }).__releasePhotoProcessing());
    await expect(page.getByRole('banner').getByText(/Versión 0\.3\.0/)).toBeVisible();
    await openMvpSection(page, 'Perfil y objetivos');
    await expect(page.getByLabel('Alias')).toHaveValue('Perfil actualización ficticio');
    expect(await mainState(page)).toMatchObject({ version: MAIN_DATABASE_VERSION * 10, alias: 'Perfil actualización ficticio' });
    expect(await readLegacyState(page)).toEqual(legacyBefore);

    const workerSource = await (await context.request.get(`${origin}/sw.js`)).text();
    expect(workerSource).toContain('SKIP_WAITING');
    expect(workerSource.match(/self\.skipWaiting\(\)/g)).toHaveLength(1);
    expect(workerSource).toMatch(/addEventListener\("message",.*SKIP_WAITING.*self\.skipWaiting\(\)/);
    expect(workerSource).not.toContain('deleteDatabase');
    expect(externalRequests).toEqual([]);
  });

  test('reabre el build actualizado offline con esquema 6 y datos conservados', async ({ browserName }) => {
    test.skip(
      browserName === 'webkit' && process.platform === 'win32',
      'Playwright WebKit para Windows devuelve un error interno al navegar offline; la reapertura se valida en Chromium y físicamente en Safari/iPhone.',
    );
    await context.setOffline(true);
    const offlinePage = await context.newPage();
    try {
      await offlinePage.goto('/', { waitUntil: 'domcontentloaded' });
      await expect(offlinePage.getByRole('banner').getByText(/Versión 0\.3\.0/)).toBeVisible();
      await expect(offlinePage.getByText('Offline', { exact: true }).first()).toBeVisible();
      expect(await mainState(offlinePage)).toMatchObject({
        version: MAIN_DATABASE_VERSION * 10,
        alias: 'Perfil actualización ficticio',
      });
      expect(externalRequests).toEqual([]);
    } finally {
      await offlinePage.close();
      await context.setOffline(false);
    }
  });
});

async function createProfileInHistoricalBuild(page: import('@playwright/test').Page) {
  await seedLegacyDatabase(page, { text: 'dato conservado durante la actualización' });
  await page.goto('/');
  await page.getByRole('button', { name: 'Preparar copia desde 0.1.1' }).click();
  await page.getByRole('button', { name: 'Activar base paralela' }).click();
  await page.getByRole('button', { name: 'Confirmar migración' }).click();
  await page.getByText('Migración confirmada. La base 0.1.1 se conserva intacta.').waitFor();
  await page.reload();
  await page.getByLabel('Alias').fill('Perfil actualización ficticio');
  await page.getByLabel('Aceptar almacenamiento local').setChecked(true);
  await page.getByRole('button', { name: 'Crear perfil local' }).click();
  await page.getByText('Perfil local guardado.').waitFor();
  await page.reload();
}

async function holdImageDecoding(page: import('@playwright/test').Page) {
  await page.evaluate(() => {
    const original = HTMLImageElement.prototype.decode;
    let release: () => void = () => {};
    const gate = new Promise<void>((resolve) => { release = resolve; });
    (window as unknown as { __releasePhotoProcessing: () => void }).__releasePhotoProcessing = release;
    HTMLImageElement.prototype.decode = function decodeAfterRelease() {
      return gate.then(() => original.call(this));
    };
  });
}

async function mainState(page: import('@playwright/test').Page) {
  return page.evaluate(() => new Promise<{ version: number | null; alias: string | null }>((resolve, reject) => {
    const request = indexedDB.open('nutriasta-main');
    request.onerror = () => reject(request.error);
    request.onsuccess = () => {
      const database = request.result;
      if (!database.objectStoreNames.contains('profiles')) {
        resolve({ version: database.version, alias: null });
        return;
      }
      const profiles = database.transaction('profiles', 'readonly').objectStore('profiles').getAll();
      profiles.onerror = () => reject(profiles.error);
      profiles.onsuccess = () => resolve({ version: database.version, alias: profiles.result[0]?.alias ?? null });
    };
  }));
}

async function reservePort() {
  const probe = createServer();
  await new Promise<void>((resolve, reject) => {
    probe.once('error', reject);
    probe.listen({ host: '127.0.0.1', port: 0, exclusive: true }, resolve);
  });
  const address = probe.address();
  if (!address || typeof address === 'string') throw new Error('No se pudo reservar el origen de actualización.');
  await new Promise<void>((resolve, reject) => probe.close((error) => error ? reject(error) : resolve()));
  return address.port;
}

function startUpdateServer(port: number, oldDist: string, currentDist: string) {
  return spawn(process.execPath, [
    join(process.cwd(), 'tests', 'serve-update-builds.mjs'),
    String(port),
    oldDist,
    currentDist,
  ], {
    cwd: process.cwd(),
    env: process.env,
    stdio: ['ignore', 'pipe', 'pipe'],
    windowsHide: true,
  });
}

async function waitForServer(server: ChildProcess) {
  await new Promise<void>((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error('El servidor de actualización no inició a tiempo.')), 10_000);
    server.once('error', reject);
    server.once('exit', (code) => reject(new Error(`El servidor de actualización terminó antes de tiempo (${code}).`)));
    server.stdout?.on('data', (chunk) => {
      if (!String(chunk).includes('UPDATE_SERVER_READY')) return;
      clearTimeout(timer);
      resolve();
    });
    server.stderr?.on('data', (chunk) => {
      const text = String(chunk);
      if (text.trim()) process.stderr.write(text);
    });
  });
}

async function stopServer(server: ChildProcess) {
  if (server.exitCode !== null) return;
  server.kill();
  await new Promise<void>((resolve) => server.once('exit', () => resolve()));
}
