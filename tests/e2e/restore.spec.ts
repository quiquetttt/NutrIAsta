import { expect, test, type Page } from '@playwright/test';

async function waitForStoredRecord(page: Page, expectedText: string) {
  await page.waitForFunction(
    (text) =>
      new Promise<boolean>((resolve) => {
        const open = indexedDB.open('nutriasta');
        open.onerror = () => resolve(false);
        open.onsuccess = () => {
          const database = open.result;
          const transaction = database.transaction(['metadata', 'viabilityRecords'], 'readonly');
          const activeRequest = transaction.objectStore('metadata').get('activeDatasetId');
          activeRequest.onerror = () => resolve(false);
          activeRequest.onsuccess = () => {
            const activeDatasetId = activeRequest.result?.value;
            const recordRequest = transaction
              .objectStore('viabilityRecords')
              .get([activeDatasetId, 'registro-prueba-001']);
            recordRequest.onerror = () => resolve(false);
            recordRequest.onsuccess = () => resolve(recordRequest.result?.text === text);
          };
          transaction.oncomplete = () => database.close();
        };
      }),
    expectedText,
  );
}

test('prepara y cancela un candidato sin cambiar el registro activo', async ({ page }) => {
  await page.goto('/');
  const record = page.getByLabel('Texto del registro ficticio');
  const saveButton = page.getByRole('button', { name: /Crear registro|Guardar cambios/ });
  await record.click();
  await record.press('Control+A');
  await record.pressSequentially('contenido exportado');
  await saveButton.click();
  await waitForStoredRecord(page, 'contenido exportado');
  await expect(page.getByText(/guardado en el dataset activo/i)).toBeVisible();
  await page.getByLabel('Contraseña del backup').fill('prueba-segura-123');
  const downloadPromise = page.waitForEvent('download');
  await page.getByRole('button', { name: 'Exportar backup' }).click();
  const download = await downloadPromise;
  const path = await download.path();
  expect(path).toBeTruthy();

  await record.click();
  await record.press('Control+A');
  await record.pressSequentially('contenido posterior');
  await saveButton.click();
  await waitForStoredRecord(page, 'contenido posterior');
  await expect(page.getByText(/guardado en el dataset activo/i)).toBeVisible();
  await page.getByLabel('Seleccionar archivo de backup').setInputFiles(path!);
  await expect(page.getByText('Candidato verificado')).toBeVisible();
  await page.getByRole('button', { name: 'Cancelar y eliminar candidato' }).click();
  await expect(page.getByText(/candidato cancelado/i)).toBeVisible();
  await expect(record).toHaveValue('contenido posterior');
});
