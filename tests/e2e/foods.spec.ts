import { expect, test } from '@playwright/test';
import { openMvpSection, openMvpWithProfile } from './mvp-fixture';

test('gestiona varias porciones, energía calculada, favoritos y búsqueda', async ({ page }) => {
  await openMvpWithProfile(page);
  await openMvpSection(page, 'Alimentos');
  await page.getByRole('button', { name: 'Introducir alimento manualmente' }).click();
  await expect(page.getByText(/EAN|código de barras/i)).toHaveCount(0);
  await page.getByLabel('Nombre', { exact: true }).fill('Alimento E2E ficticio');
  await page.getByLabel('Marca (opcional)').fill('Marca E2E');
  await page.getByRole('radio', { name: 'Calculada 4/4/9' }).click();
  await page.getByLabel('Proteínas (g) · obligatorio').fill('10');
  await page.getByLabel('Hidratos de carbono (g) · obligatorio').fill('20');
  await page.getByLabel('Grasas (g) · opcional').fill('5');

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
});

test('guarda un alimento declarado sin kJ ni grasas y no inventa esos valores', async ({ page }) => {
  await openMvpWithProfile(page);
  await openMvpSection(page, 'Alimentos');
  await page.getByRole('button', { name: 'Introducir alimento manualmente' }).click();
  await page.getByLabel('Nombre', { exact: true }).fill('Alimento parcial ficticio');
  await page.getByLabel('Calorías (kcal) · obligatorio').fill('123');
  await page.getByLabel('Proteínas (g) · obligatorio').fill('7');
  await page.getByLabel('Hidratos de carbono (g) · obligatorio').fill('19');
  await page.getByRole('button', { name: 'Guardar alimento' }).click();
  await expect(page.getByText(/123\.0 kcal · P 7 · HC 19 · G No disponible/)).toBeVisible();
  expect(await page.evaluate(async () => {
    const request = indexedDB.open('nutriasta-main');
    const database = await new Promise<IDBDatabase>((resolve, reject) => {
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
    const rows = await new Promise<Array<{ name: string; energyKj: number | null; fatG: number | null }>>((resolve, reject) => {
      const query = database.transaction('foods').objectStore('foods').getAll();
      query.onsuccess = () => resolve(query.result);
      query.onerror = () => reject(query.error);
    });
    database.close();
    return rows.find(({ name }) => name === 'Alimento parcial ficticio');
  })).toMatchObject({ energyKj: null, fatG: null });
});
