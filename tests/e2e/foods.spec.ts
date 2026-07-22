import { expect, test } from '@playwright/test';
import { openMvpWithProfile } from './mvp-fixture';

test('crea, busca, marca favorito y bloquea un EAN duplicado sin red', async ({ page }) => {
  await openMvpWithProfile(page);
  await page.getByRole('tab', { name: 'Alimentos' }).click();
  await page.getByRole('button', { name: 'Añadir alimento' }).click();
  await page.getByLabel('Nombre', { exact: true }).fill('Alimento E2E ficticio');
  await page.getByLabel('Marca (opcional)').fill('Marca E2E');
  await page.getByLabel('EAN-13 o EAN-8 (opcional)').fill('8412345678905');
  await page.getByLabel('Energía (kcal)').fill('200');
  await page.getByLabel('Proteínas (g)').fill('10');
  await page.getByLabel('Carbohidratos (g)').fill('20');
  await page.getByLabel('Grasas (g)').fill('5');
  await page.getByRole('button', { name: 'Guardar alimento' }).click();
  await expect(page.getByText('Alimento E2E ficticio', { exact: true })).toBeVisible();
  await page.getByRole('button', { name: 'Favorito', exact: true }).click();
  await expect(page.getByText('Favorito', { exact: true })).toBeVisible();
  await page.getByLabel('Buscar alimentos').fill('Marca E2E');
  await expect(page.getByText('Alimento E2E ficticio', { exact: true })).toBeVisible();
});
