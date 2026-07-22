import { expect, test } from '@playwright/test';
import { readLegacyState, seedLegacyDatabase } from './legacy-fixture';

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
