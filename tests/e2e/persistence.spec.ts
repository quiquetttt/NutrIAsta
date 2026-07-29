import { expect, test } from '@playwright/test';
import { readLegacyState, seedLegacyDatabase } from './legacy-fixture';

test('abre y recarga la base 0.1.1 exclusivamente en modo de lectura', async ({ page }) => {
  await seedLegacyDatabase(page, { text: 'registro-prueba-001 persistente' });
  const before = await readLegacyState(page);
  await page.goto('/');
  await expect(page.getByText('NutrIAsta', { exact: true })).toBeVisible();
  await expect(page.getByText('Versión 0.3.1 — prueba de actualización')).toBeVisible();
  await expect(page.getByLabel('Texto del registro ficticio')).toHaveText('registro-prueba-001 persistente');
  await expect(page.getByText(/edición está deshabilitada/i)).toBeVisible();
  await page.reload();
  await expect(page.getByLabel('Texto del registro ficticio')).toHaveText('registro-prueba-001 persistente');
  expect(await readLegacyState(page)).toEqual(before);
});
