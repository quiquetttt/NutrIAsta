import { expect, test } from '@playwright/test';

import { readLegacyState } from './legacy-fixture';
import { openMvpSection, openMvpWithProfile } from './mvp-fixture';

test('explica la estimación y no la copia a un objetivo sin confirmación explícita', async ({ page }) => {
  await openMvpWithProfile(page);
  await openMvpSection(page, 'Perfil y objetivos');
  await expect(page.getByText('Fórmula de Mifflin–St Jeor')).toBeVisible();
  await expect(page.getByText(/10 × peso .* 6,25 × altura .* − 5 × edad/)).toBeVisible();
  await expect(page.getByText(/Entradas usadas: 70 kg · 175 cm · 22 años · PAL/)).toBeVisible();
  await expect(page.getByText(/Fecha del cálculo:/)).toBeVisible();
  await expect(page.getByText('Ejemplos ilustrativos separados de tus objetivos')).toBeVisible();

  await page.getByLabel('Calorías (kcal/día)').fill('2100');
  await page.getByLabel('Proteínas (g/día)').fill('120');
  await page.getByLabel('Carbohidratos (g/día)').fill('250');
  await page.getByLabel('Grasas (g/día)').fill('70');
  await page.getByRole('button', { name: 'Guardar nuevo periodo' }).click();
  await expect(page.getByText(/Objetivo manual vigente: 2100 kcal\/día/)).toBeVisible();
  await expect(page.getByText(/Diferencia frente al mantenimiento orientativo:/)).toBeVisible();
  await openMvpSection(page, 'Hoy');
  await expect(page.getByText(/0 \/ 2[.\s]?100 kcal/)).toBeVisible();
  await page.reload();
  await openMvpSection(page, 'Hoy');
  await expect(page.getByText(/0 \/ 2[.\s]?100 kcal/)).toBeVisible();
  await openMvpSection(page, 'Perfil y objetivos');

  await page.getByLabel('Calorías (kcal/día)').fill('1111');
  await page.getByRole('button', { name: 'Usar mantenimiento estimado como borrador' }).click();
  await page.getByRole('button', { name: 'Cancelar' }).click();
  await expect(page.getByLabel('Calorías (kcal/día)')).toHaveValue('1111');
  await page.getByRole('button', { name: 'Usar mantenimiento estimado como borrador' }).click();
  await page.getByRole('button', { name: 'Copiar al formulario' }).click();
  await expect(page.getByLabel('Calorías (kcal/día)')).not.toHaveValue('1111');
  await expect(page.getByText('Periodos guardados: 1. Los anteriores no se sobrescriben.')).toBeVisible();
});

test('registra desde Hoy los accesos rápidos de agua configurados y conserva el total', async ({ page }) => {
  await openMvpWithProfile(page);
  await openMvpSection(page, 'Ajustes y privacidad');
  await page.getByLabel('Accesos rápidos de agua').fill('300, 600');
  await page.getByRole('button', { name: 'Guardar accesos rápidos de agua' }).click();
  await openMvpSection(page, 'Hoy');
  await expect(page.getByRole('button', { name: '+300 ml' })).toBeVisible();
  await expect(page.getByRole('button', { name: '+600 ml' })).toBeVisible();
  await expect(page.getByRole('button', { name: '+250 ml' })).toHaveCount(0);
  await page.getByRole('button', { name: '+300 ml' }).click();
  await expect(page.getByText('300 ml de agua añadidos.')).toBeVisible();
  await expect(page.getByText('300 ml', { exact: true })).toBeVisible();
  await page.reload();
  await openMvpSection(page, 'Hoy');
  await expect(page.getByText('300 ml', { exact: true })).toBeVisible();
});

test('configura el objetivo y registra desde Hoy los pasos del día', async ({ page }) => {
  await openMvpWithProfile(page);
  await openMvpSection(page, 'Hoy');
  await expect(page.getByText(/0 \/ 10[.\s]?000/)).toBeVisible();
  await openMvpSection(page, 'Ajustes y privacidad');
  await page.getByLabel('Objetivo diario de pasos').fill('12000');
  await page.getByRole('button', { name: 'Guardar objetivo diario de pasos' }).click();
  await expect(page.getByText('Objetivo diario de pasos actualizado.')).toBeVisible();
  await openMvpSection(page, 'Hoy');
  await expect(page.getByText(/0 \/ 12[.\s]?000/)).toBeVisible();
  await page.getByRole('button', { name: 'Añadir pasos de hoy' }).click();
  await page.getByLabel('Número de pasos de hoy').fill('8765');
  await page.getByRole('button', { name: 'Guardar pasos de hoy' }).click();
  await expect(page.getByText(/8[.\s]?765 pasos guardados para hoy\./)).toBeVisible();
  await expect(page.getByText(/8[.\s]?765 \/ 12[.\s]?000/)).toBeVisible();
  await expect(page.getByRole('button', { name: 'Cambiar pasos de hoy' })).toBeVisible();
  await page.reload();
  await openMvpSection(page, 'Hoy');
  await expect(page.getByText(/8[.\s]?765 \/ 12[.\s]?000/)).toBeVisible();
});

test('configura agua y cancela o confirma el borrado sin tocar la base histórica', async ({ page }) => {
  await openMvpWithProfile(page);
  const legacyBefore = await readLegacyState(page);
  await openMvpSection(page, 'Ajustes y privacidad');
  await expect(page.getByText('Último backup completo: ninguno.')).toBeVisible();
  await page.getByLabel('Accesos rápidos de agua').fill('300, 600');
  await page.getByRole('button', { name: 'Guardar accesos rápidos de agua' }).click();
  await expect(page.getByText('Accesos rápidos de agua actualizados.')).toBeVisible();
  await page.reload();
  await openMvpSection(page, 'Diario');
  await expect(page.getByRole('button', { name: '+300 ml' })).toBeVisible();
  await expect(page.getByRole('button', { name: '+600 ml' })).toBeVisible();
  await expect(page.getByRole('button', { name: '+250 ml' })).toHaveCount(0);

  await openMvpSection(page, 'Ajustes y privacidad');
  await page.getByLabel('Confirmación para eliminar todos mis datos').fill('ELIMINAR');
  await page.getByRole('button', { name: 'Eliminar todos mis datos' }).click();
  await page.getByRole('button', { name: 'Cancelar' }).click();
  await expect(page.getByText('Eliminación cancelada. No se ha modificado ningún dato.')).toBeVisible();
  await openMvpSection(page, 'Perfil y objetivos');
  await expect(page.getByLabel('Alias')).toHaveValue('Persona ficticia');

  await openMvpSection(page, 'Ajustes y privacidad');
  await page.getByLabel('Confirmación para eliminar todos mis datos').fill('ELIMINAR');
  await page.getByRole('button', { name: 'Eliminar todos mis datos' }).click();
  await page.getByRole('button', { name: 'Eliminar filas del dataset activo' }).click();
  await expect(page.getByRole('button', { name: 'Crear perfil local' })).toBeVisible();
  expect(await readLegacyState(page)).toEqual(legacyBefore);
  expect(await activeMvpRows(page)).toBe(0);
});

async function activeMvpRows(page: import('@playwright/test').Page) {
  return page.evaluate(() => new Promise<number>((resolve, reject) => {
    const request = indexedDB.open('nutriasta-main');
    request.onerror = () => reject(request.error);
    request.onsuccess = () => {
      const database = request.result;
      const metadata = database.transaction('metadata', 'readonly').objectStore('metadata').get('activeMainDatasetId');
      metadata.onerror = () => reject(metadata.error);
      metadata.onsuccess = async () => {
        const datasetId = metadata.result?.value;
        const tables = ['legacyViabilityRecords', 'legacyViabilityPhotos', 'profiles', 'nutritionTargetPeriods', 'foods', 'foodPortions', 'foodPhotos', 'diaryDays', 'mealEntries', 'mealItems', 'waterEntries', 'trainingDayFlags', 'recipes', 'recipeItems', 'trainingSettings', 'trainingTypes', 'trainingSessions', 'exerciseCatalog', 'trainingSessionExercises', 'trainingSets', 'weightEntries', 'inventoryItems', 'inventoryMovements', 'inventoryConsumptionDecisions', 'shoppingLists', 'shoppingListItems'];
        try {
          const counts = await Promise.all(tables.map((table) => new Promise<number>((done, fail) => {
            const index = database.transaction(table, 'readonly').objectStore(table).index('datasetId');
            const count = index.count(IDBKeyRange.only(datasetId));
            count.onsuccess = () => done(count.result);
            count.onerror = () => fail(count.error);
          })));
          resolve(counts.reduce((sum, count) => sum + count, 0));
        } catch (error) {
          reject(error);
        }
      };
    };
  }));
}
