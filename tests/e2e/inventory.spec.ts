import { expect, test } from '@playwright/test';
import { openMvpSection, openMvpWithProfile } from './mvp-fixture';

test('mantiene inventario, agotamiento, compra y movimientos en una operación trazable', async ({ page }) => {
  await openMvpWithProfile(page);
  await openMvpSection(page, 'Alimentos');
  await page.getByRole('button', { name: 'Añadir alimento' }).click();
  await page.getByLabel('Nombre', { exact: true }).fill('Inventario ficticio');
  await page.getByLabel('Energía (kcal)').fill('100');
  await page.getByRole('button', { name: 'Guardar alimento' }).click();

  await openMvpSection(page, 'Inventario');
  await page.getByLabel('Cantidad canónica (g)').fill('200');
  await page.getByRole('button', { name: 'Añadir al inventario' }).click();
  await expect(page.getByText('200 g', { exact: true })).toBeVisible();

  await openMvpSection(page, 'Hoy');
  await page.getByLabel('Cantidad', { exact: true }).fill('200');
  page.once('dialog', (dialog) => dialog.accept());
  await page.getByRole('button', { name: 'Añadir alimento a la comida' }).click();
  await expect(page.getByText(/Subtotal conjunto: 200\.0 kcal/)).toBeVisible();

  await openMvpSection(page, 'Inventario');
  await expect(page.getByText('0 g', { exact: true })).toBeVisible();
  await page.getByRole('tab', { name: 'Lista de la compra' }).click();
  await expect(page.getByText('Inventario ficticio', { exact: true })).toBeVisible();
  await page.getByRole('tab', { name: 'Movimientos' }).click();
  await expect(page.getByText(/Inventario ficticio · -200 g/)).toBeVisible();

  const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
  expect(overflow).toBeLessThanOrEqual(1);
});
