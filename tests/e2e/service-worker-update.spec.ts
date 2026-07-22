import { expect, test, type Page } from '@playwright/test';

async function readActiveRecord(page: Page) {
  return page.evaluate(
    () =>
      new Promise<{ activeDatasetId: string; text: string | null }>((resolve, reject) => {
        const open = indexedDB.open('nutriasta');
        open.onerror = () => reject(open.error);
        open.onsuccess = () => {
          const database = open.result;
          const transaction = database.transaction(['metadata', 'viabilityRecords'], 'readonly');
          const activeRequest = transaction.objectStore('metadata').get('activeDatasetId');
          activeRequest.onerror = () => reject(activeRequest.error);
          activeRequest.onsuccess = () => {
            const activeDatasetId = activeRequest.result.value as string;
            const recordRequest = transaction
              .objectStore('viabilityRecords')
              .get([activeDatasetId, 'registro-prueba-001']);
            recordRequest.onerror = () => reject(recordRequest.error);
            recordRequest.onsuccess = () => resolve({
              activeDatasetId,
              text: (recordRequest.result?.text as string | undefined) ?? null,
            });
          };
          transaction.oncomplete = () => database.close();
        };
      }),
  );
}

test('actualiza el service worker sin eliminar ni cambiar IndexedDB', async ({ page, request }) => {
  await page.goto('/');
  const record = page.getByLabel('Texto del registro ficticio');
  await record.click();
  await record.press('Control+A');
  await record.pressSequentially('dato conservado durante la actualización');
  await page.getByRole('button', { name: /Crear registro|Guardar cambios/ }).click();
  await expect(page.getByText(/guardado en el dataset activo/i)).toBeVisible();
  const before = await readActiveRecord(page);

  const workerResponse = await request.get('/sw.js');
  expect(workerResponse.ok()).toBe(true);
  const workerSource = await workerResponse.text();
  expect(workerSource).toContain('SKIP_WAITING');
  expect(workerSource.match(/self\.skipWaiting\(\)/g)).toHaveLength(1);
  expect(workerSource).toMatch(/addEventListener\("message",.*SKIP_WAITING.*self\.skipWaiting\(\)/);
  expect(workerSource).not.toContain('indexedDB.deleteDatabase');

  const registration = await page.evaluate(async () => {
    const ready = await navigator.serviceWorker.ready;
    await ready.update();
    return { active: Boolean(ready.active), scope: ready.scope };
  });
  expect(registration.active).toBe(true);
  expect(registration.scope).toBe(new URL('/', page.url()).href);

  await page.reload();
  const after = await readActiveRecord(page);
  expect(after).toEqual(before);
  await expect(record).toHaveValue('dato conservado durante la actualización');
});
