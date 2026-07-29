import { expect, test } from '@playwright/test';
import { openMvpSection, openMvpWithProfile } from './mvp-fixture';

test('gestiona varias porciones, energía calculada y un duplicado EAN real', async ({ page }) => {
  await openMvpWithProfile(page);
  await openMvpSection(page, 'Alimentos');
  await page.getByRole('button', { name: 'Introducir alimento manualmente' }).click();
  await page.getByLabel('Nombre', { exact: true }).fill('Alimento E2E ficticio');
  await page.getByLabel('Marca (opcional)').fill('Marca E2E');
  await page.getByLabel('EAN-13 o EAN-8 (opcional)').fill('8412345678905');
  await page.getByRole('radio', { name: 'Calculada 4/4/9' }).click();
  await page.getByLabel('Proteínas (g)').fill('10');
  await page.getByLabel('Carbohidratos (g)').fill('20');
  await page.getByLabel('Grasas (g)').fill('5');

  await page.getByLabel('Nombre de porción').fill('Bol ficticio');
  await page.getByLabel('Cantidad de la porción (g)').fill('75');
  await page.getByRole('button', { name: 'Añadir porción' }).click();
  await page.getByLabel('Nombre de porción').fill('Cucharada ficticia');
  await page.getByLabel('Cantidad de la porción (g)').fill('15');
  await page.getByRole('button', { name: 'Añadir porción' }).click();
  await page.getByRole('button', { name: 'Guardar alimento' }).click();

  await expect(page.getByText('Alimento E2E ficticio', { exact: true })).toBeVisible();
  await expect(page.getByText(/165\.0 kcal/)).toBeVisible();
  await expect(page.getByText('Calculada 4/4/9', { exact: true })).toBeVisible();
  await expect(page.getByText(/Bol ficticio \(75 g\)/)).toBeVisible();
  await expect(page.getByText(/Cucharada ficticia \(15 g\)/)).toBeVisible();

  await page.getByRole('button', { name: 'Editar Alimento E2E ficticio' }).click();
  await expect(page.getByRole('button', { name: 'Editar porción Bol ficticio' })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Editar porción Cucharada ficticia' })).toBeVisible();
  await page.getByRole('button', { name: 'Guardar alimento' }).click();
  await page.reload();
  await openMvpSection(page, 'Alimentos');
  await expect(page.getByText(/Bol ficticio \(75 g\)/)).toBeVisible();
  await expect(page.getByText(/Cucharada ficticia \(15 g\)/)).toBeVisible();

  await page.getByRole('button', { name: 'Favorito', exact: true }).click();
  await expect(page.getByText('Favorito', { exact: true })).toBeVisible();
  await page.getByLabel('Buscar alimentos').fill('Marca E2E');
  await expect(page.getByText('Alimento E2E ficticio', { exact: true })).toBeVisible();
  await page.getByLabel('Buscar alimentos').fill('');

  await page.getByRole('button', { name: 'Introducir alimento manualmente' }).click();
  await page.getByLabel('Nombre', { exact: true }).fill('Segundo alimento E2E');
  await page.getByLabel('EAN-13 o EAN-8 (opcional)').fill('8412345678905');
  await page.getByLabel('Energía (kcal)').fill('100');
  await page.getByRole('button', { name: 'Guardar alimento' }).click();
  await expect(page.getByText(/Ya existe un alimento con ese código/)).toBeVisible();
  await expect(page.getByText('Segundo alimento E2E', { exact: true })).toHaveCount(0);
});
