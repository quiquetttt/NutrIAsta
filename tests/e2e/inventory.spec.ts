import { expect, test } from '@playwright/test';
import { openMvpSection, openMvpWithProfile } from './mvp-fixture';

test('mantiene inventario, agotamiento, compra y movimientos en una operación trazable', async ({ page }) => {
  await openMvpWithProfile(page);
  await openMvpSection(page, 'Alimentos');
  await page.getByRole('button', { name: 'Introducir alimento manualmente' }).click();
  await page.getByLabel('Nombre', { exact: true }).fill('Inventario ficticio');
  await page.getByLabel('Energía (kcal)').fill('100');
  await page.getByRole('button', { name: 'Guardar alimento' }).click();

  await openMvpSection(page, 'Inventario');
  await page.getByLabel('Cantidad canónica (g)').fill('200');
  await page.getByRole('button', { name: 'Añadir al inventario' }).click();
  await expect(page.getByText('200 g', { exact: true })).toBeVisible();

  await openMvpSection(page, 'Diario');
  await page.getByLabel('Cantidad', { exact: true }).fill('200');
  await page.getByRole('button', { name: 'Añadir alimento a la comida' }).click();
  await expect(page.getByRole('heading', { name: 'Consumir Inventario ficticio' })).toBeVisible();
  await expect(page.getByText('⚠ Se va a acabar · el saldo final será 0 g')).toBeVisible();
  await page.getByLabel('Añadir a la lista de la compra').check();
  await page.getByRole('button', { name: 'Confirmar consumo' }).click();
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

test('cancelar la revisión de consumo no escribe nutrición, inventario, decisiones ni compra', async ({ page }) => {
  await openMvpWithProfile(page);
  await openMvpSection(page, 'Alimentos');
  await page.getByRole('button', { name: 'Introducir alimento manualmente' }).click();
  await page.getByLabel('Nombre', { exact: true }).fill('Cancelación ficticia');
  await page.getByLabel('Energía (kcal)').fill('100');
  await page.getByRole('button', { name: 'Guardar alimento' }).click();
  await openMvpSection(page, 'Diario');

  const before = await functionalCounts(page);
  await page.getByRole('button', { name: 'Añadir alimento a la comida' }).click();
  await expect(page.getByRole('heading', { name: 'Consumir Cancelación ficticia' })).toBeVisible();
  await page.getByRole('button', { name: 'Cancelar' }).click();

  expect(await functionalCounts(page)).toEqual(before);
  await expect(page.getByText(/Subtotal conjunto:/)).toHaveCount(0);
});

async function functionalCounts(page: import('@playwright/test').Page) {
  const tables = ['mealEntries', 'mealItems', 'inventoryMovements', 'inventoryConsumptionDecisions', 'shoppingLists', 'shoppingListItems'];
  return page.evaluate((names) => new Promise<Record<string, number>>((resolve, reject) => {
    const request = indexedDB.open('nutriasta-main');
    request.onerror = () => reject(request.error);
    request.onsuccess = () => {
      const database = request.result;
      const metadata = database.transaction('metadata', 'readonly').objectStore('metadata').get('activeMainDatasetId');
      metadata.onerror = () => reject(metadata.error);
      metadata.onsuccess = async () => {
        try {
          const datasetId = metadata.result?.value;
          const counts = await Promise.all(names.map((name) => new Promise<number>((done, fail) => {
            const count = database.transaction(name, 'readonly').objectStore(name).index('datasetId').count(IDBKeyRange.only(datasetId));
            count.onsuccess = () => done(count.result);
            count.onerror = () => fail(count.error);
          })));
          resolve(Object.fromEntries(names.map((name, index) => [name, counts[index] ?? 0])));
        } catch (error) {
          reject(error);
        }
      };
    };
  }), tables);
}
