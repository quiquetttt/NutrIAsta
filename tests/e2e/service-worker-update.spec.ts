import { expect, test } from '@playwright/test';
import { MAIN_DATABASE_VERSION } from '../../src/storage/main-schema';
import { readLegacyState, seedLegacyDatabase } from './legacy-fixture';

test('actualiza el service worker sin eliminar ni cambiar ninguna IndexedDB', async ({ page, request }) => {
  await seedLegacyDatabase(page, { text: 'dato conservado durante la actualización' });
  const before = await readLegacyState(page);
  await page.goto('/');
  await expect(page.getByLabel('Texto del registro ficticio')).toHaveText('dato conservado durante la actualización');

  const workerResponse = await request.get('/sw.js');
  expect(workerResponse.ok()).toBe(true);
  const workerSource = await workerResponse.text();
  expect(workerSource).toContain('SKIP_WAITING');
  expect(workerSource.match(/self\.skipWaiting\(\)/g)).toHaveLength(1);
  expect(workerSource).toMatch(/addEventListener\("message",.*SKIP_WAITING.*self\.skipWaiting\(\)/);
  expect(workerSource).not.toContain('indexedDB.deleteDatabase');
  expect(workerSource).not.toContain('deleteDatabase');

  const registration = await page.evaluate(async () => {
    const ready = await navigator.serviceWorker.ready;
    await ready.update();
    return { active: Boolean(ready.active), scope: ready.scope };
  });
  expect(registration.active).toBe(true);
  expect(registration.scope).toBe(new URL('/', page.url()).href);

  await page.reload();
  expect(await readLegacyState(page)).toEqual(before);
  const databases = await page.evaluate(() => indexedDB.databases());
  expect(databases.find(({ name }) => name === 'nutriasta')?.version).toBe(10);
  expect(databases.find(({ name }) => name === 'nutriasta-main')?.version).toBe(MAIN_DATABASE_VERSION * 10);
});
