import { expect, test } from '@playwright/test';
import { readLegacyState, seedLegacyDatabase } from './legacy-fixture';
import { openMvpSection, openMvpWithProfile } from './mvp-fixture';

test('copia y conserva una fotografía ficticia sin modificar el origen', async ({ browserName, page }) => {
  test.skip(
    browserName === 'webkit' && process.platform === 'win32',
    'Playwright WebKit para Windows no serializa Blob en IndexedDB; la copia de fotografías requiere validación física en Safari/iPhone.',
  );
  await seedLegacyDatabase(page, { withPhoto: true });
  const before = await readLegacyState(page);
  await page.goto('/');
  await expect(page.getByLabel('Miniatura de la fotografía de prueba')).toBeVisible();
  await page.getByRole('button', { name: 'Preparar copia desde 0.1.1' }).click();
  await expect(page.getByText('Candidato preparado y verificado')).toBeVisible();
  await page.getByRole('button', { name: 'Activar base paralela' }).click();
  await expect(page.getByText('nutriasta-main', { exact: true }).first()).toBeVisible();
  await page.reload();
  await expect(page.getByLabel('Miniatura de la fotografía de prueba')).toBeVisible();
  expect(await readLegacyState(page)).toEqual(before);
});

test('muestra, sustituye y elimina una fotografía local sin borrar el alimento', async ({ browserName, page }) => {
  test.skip(
    browserName === 'webkit' && process.platform === 'win32',
    'Playwright WebKit para Windows no serializa Blob de imágenes en IndexedDB; este flujo se valida físicamente en Safari/iPhone.',
  );
  await openMvpWithProfile(page);
  await openMvpSection(page, 'Alimentos');
  await page.getByRole('button', { name: 'Introducir alimento manualmente' }).click();
  await page.getByLabel('Nombre', { exact: true }).fill('Etiqueta ficticia E2E');
  await page.getByLabel('Calorías (kcal) · obligatorio').fill('100');
  await page.getByLabel('Fotografía local de etiqueta').setInputFiles({
    name: 'etiqueta-ficticia-1.png',
    mimeType: 'image/png',
    buffer: Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=', 'base64'),
  });
  await expect(page.getByText('Fotografía recodificada localmente.')).toBeVisible();
  await page.getByRole('button', { name: 'Guardar alimento' }).click();
  await expect(page.getByLabel('Fotografía de Etiqueta ficticia E2E')).toBeVisible();
  const firstChecksum = await storedFoodPhotoChecksum(page);
  expect(await storedFoodPhotoMetadata(page)).toMatchObject({ mimeType: 'image/jpeg', width: 1, height: 1 });
  expect((await storedFoodPhotoMetadata(page))!.size).toBeLessThanOrEqual(4 * 1024 * 1024);

  await page.reload();
  await openMvpSection(page, 'Alimentos');
  await expect(page.getByLabel('Fotografía de Etiqueta ficticia E2E')).toBeVisible();
  await page.getByRole('button', { name: 'Editar Etiqueta ficticia E2E' }).click();
  await expect(page.getByLabel('Vista previa de la etiqueta')).toBeVisible();
  await page.getByLabel('Fotografía local de etiqueta').setInputFiles({
    name: 'etiqueta-ficticia-2.png',
    mimeType: 'image/png',
    buffer: Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAusB9Wl0cVQAAAAASUVORK5CYII=', 'base64'),
  });
  await expect(page.getByText('Fotografía recodificada localmente.')).toBeVisible();
  await page.getByRole('button', { name: 'Guardar alimento' }).click();
  await expect.poll(() => storedFoodPhotoChecksum(page)).not.toBe(firstChecksum);

  await page.getByRole('button', { name: 'Editar Etiqueta ficticia E2E' }).click();
  await page.getByRole('button', { name: 'Eliminar fotografía' }).click();
  await page.getByRole('heading', { name: 'Eliminar fotografía' }).waitFor();
  await page.getByRole('button', { name: 'Eliminar fotografía' }).last().click();
  await page.getByRole('button', { name: 'Guardar alimento' }).click();
  await expect(page.getByLabel('Fotografía de Etiqueta ficticia E2E')).toHaveCount(0);
  await expect(page.getByText('Etiqueta ficticia E2E', { exact: true })).toBeVisible();
  expect(await storedFoodPhotoChecksum(page)).toBeNull();
});

async function storedFoodPhotoChecksum(page: import('@playwright/test').Page) {
  return page.evaluate(() => new Promise<string | null>((resolve, reject) => {
    const request = indexedDB.open('nutriasta-main');
    request.onerror = () => reject(request.error);
    request.onsuccess = () => {
      const database = request.result;
      const rows = database.transaction('foodPhotos', 'readonly').objectStore('foodPhotos').getAll();
      rows.onerror = () => reject(rows.error);
      rows.onsuccess = () => resolve(rows.result[0]?.checksum ?? null);
    };
  }));
}

async function storedFoodPhotoMetadata(page: import('@playwright/test').Page) {
  return page.evaluate(() => new Promise<{ mimeType: string; width: number; height: number; size: number } | null>((resolve, reject) => {
    const request = indexedDB.open('nutriasta-main');
    request.onerror = () => reject(request.error);
    request.onsuccess = () => {
      const rows = request.result.transaction('foodPhotos', 'readonly').objectStore('foodPhotos').getAll();
      rows.onerror = () => reject(rows.error);
      rows.onsuccess = () => {
        const photo = rows.result[0];
        resolve(photo ? { mimeType: photo.mimeType, width: photo.width, height: photo.height, size: photo.size } : null);
      };
    };
  }));
}
