import { expect, test } from '@playwright/test';
import { openMvpWithProfile } from './mvp-fixture';

const TABLES = ['legacyViabilityRecords', 'legacyViabilityPhotos', 'profiles', 'nutritionTargetPeriods', 'foods', 'foodPortions', 'foodPhotos', 'diaryDays', 'mealEntries', 'mealItems', 'waterEntries', 'trainingDayFlags', 'recipes', 'recipeItems'];
const BACKUP_PREPARATION_TIMEOUT = 15_000;

test('restaura las 14 tablas pobladas mediante cancelación, activación, rollback, reactivación y confirmación', async ({ browserName, page }) => {
  test.skip(
    browserName === 'webkit' && process.platform === 'win32',
    'Playwright WebKit para Windows no serializa Blob en IndexedDB; el backup con fotografías se valida físicamente en Safari/iPhone.',
  );
  await openMvpWithProfile(page, { withPhoto: true });
  await populateAllMvpTables(page);
  expect(await populatedTableCounts(page)).toEqual(Object.fromEntries(TABLES.map((table) => [table, 1])));

  await page.getByLabel('Contraseña del backup completo').fill('clave-ficticia-segura');
  const downloadPromise = page.waitForEvent('download');
  await page.getByRole('button', { name: 'Exportar backup completo' }).click();
  const download = await downloadPromise;
  const path = await download.path();
  expect(path).toBeTruthy();
  const uploadPath = `${path}.nutriasta.zip`;
  await download.saveAs(uploadPath);
  await expect(page.getByText(/Backup completo generado/)).toBeVisible();

  await page.getByRole('tab', { name: 'Perfil y objetivos' }).click();
  await page.getByLabel('Alias').fill('Perfil ficticio modificado');
  await page.getByRole('button', { name: 'Guardar cambios del perfil' }).click();
  await expect(page.getByText('Perfil actualizado.')).toBeVisible();
  await page.getByLabel('Archivo de backup completo').setInputFiles(uploadPath);
  await expect(page.getByText('Candidato temporal verificado')).toBeVisible({ timeout: BACKUP_PREPARATION_TIMEOUT });
  await expect(page.getByLabel('Alias')).toHaveValue('Perfil ficticio modificado');
  await page.getByRole('button', { name: 'Cancelar candidato completo' }).click();
  await expect(page.getByText('Candidato descartado. Los datos activos no han cambiado.')).toBeVisible();
  await expect(page.getByLabel('Alias')).toHaveValue('Perfil ficticio modificado');

  await page.getByLabel('Archivo de backup completo').setInputFiles(uploadPath);
  await expect(page.getByText('Candidato temporal verificado')).toBeVisible({ timeout: BACKUP_PREPARATION_TIMEOUT });
  await page.reload();
  await expect(page.getByText('Candidato temporal verificado')).toBeVisible();
  await page.getByRole('tab', { name: 'Perfil y objetivos' }).click();
  await expect(page.getByLabel('Alias')).toHaveValue('Perfil ficticio modificado');
  await page.getByRole('button', { name: 'Activar restauración completa' }).click();
  await expect(page.getByLabel('Alias')).toHaveValue('Persona ficticia');
  expect(Object.values(await populatedTableCounts(page)).every((count) => count > 0)).toBe(true);
  await page.getByRole('button', { name: 'Volver a datos anteriores' }).click();
  await expect(page.getByLabel('Alias')).toHaveValue('Perfil ficticio modificado');
  await page.getByRole('button', { name: 'Reactivar candidato completo' }).click();
  await expect(page.getByLabel('Alias')).toHaveValue('Persona ficticia');
  expect(Object.values(await populatedTableCounts(page)).every((count) => count > 0)).toBe(true);
  await page.getByRole('button', { name: 'Confirmar restauración completa' }).click();
  await page.reload();
  await page.getByRole('tab', { name: 'Perfil y objetivos' }).click();
  await expect(page.getByLabel('Alias')).toHaveValue('Persona ficticia');
  await expect(page.getByText('Versión 0.2.1 — MVP 1 local')).toBeVisible();
  expect(Object.values(await populatedTableCounts(page)).every((count) => count > 0)).toBe(true);
});

async function populateAllMvpTables(page: import('@playwright/test').Page) {
  await page.getByRole('tab', { name: 'Perfil y objetivos' }).click();
  await page.getByLabel('Calorías (kcal/día)').fill('2200');
  await page.getByRole('button', { name: 'Guardar nuevo periodo' }).click();

  await page.getByRole('tab', { name: 'Alimentos' }).click();
  await page.getByRole('button', { name: 'Añadir alimento' }).click();
  await page.getByLabel('Nombre', { exact: true }).fill('Alimento backup ficticio');
  await page.getByLabel('Energía (kcal)').fill('120');
  await page.getByLabel('Nombre de porción').fill('Porción backup ficticia');
  await page.getByLabel('Cantidad de la porción (g)').fill('80');
  await page.getByRole('button', { name: 'Añadir porción' }).click();
  await page.getByLabel('Fotografía local de etiqueta').setInputFiles({
    name: 'foto-backup-ficticia.png',
    mimeType: 'image/png',
    buffer: Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=', 'base64'),
  });
  await expect(page.getByText('Fotografía recodificada localmente.')).toBeVisible();
  await page.getByRole('button', { name: 'Guardar alimento' }).click();

  await page.getByRole('tab', { name: 'Recetas' }).click();
  await page.getByRole('button', { name: 'Crear receta' }).click();
  await page.getByLabel('Nombre de receta').fill('Receta backup ficticia');
  await page.getByLabel('Número de porciones').fill('2');
  await page.getByLabel('Cantidad del ingrediente (g o ml base)').fill('80');
  await page.getByRole('button', { name: 'Añadir ingrediente' }).click();
  await page.getByRole('button', { name: 'Guardar receta' }).click();

  await page.getByRole('tab', { name: 'Hoy' }).click();
  await page.getByRole('radio', { name: 'Porción guardada' }).click();
  await page.getByRole('button', { name: 'Añadir alimento a la comida' }).click();
  await page.getByRole('button', { name: '+250 ml' }).click();
  await page.getByRole('button', { name: 'Guardar: sí he entrenado' }).click();
  await expect(page.getByText('Entrenamiento diario guardado.')).toBeVisible();
}

async function populatedTableCounts(page: import('@playwright/test').Page) {
  return page.evaluate((tables) => new Promise<Record<string, number>>((resolve, reject) => {
    const request = indexedDB.open('nutriasta-main');
    request.onerror = () => reject(request.error);
    request.onsuccess = () => {
      const database = request.result;
      const metadata = database.transaction('metadata', 'readonly').objectStore('metadata').get('activeMainDatasetId');
      metadata.onerror = () => reject(metadata.error);
      metadata.onsuccess = async () => {
        try {
          const datasetId = metadata.result?.value;
          const counts = await Promise.all(tables.map((table) => new Promise<number>((done, fail) => {
            const count = database.transaction(table, 'readonly').objectStore(table).index('datasetId').count(IDBKeyRange.only(datasetId));
            count.onsuccess = () => done(count.result);
            count.onerror = () => fail(count.error);
          })));
          resolve(Object.fromEntries(tables.map((table, index) => [table, counts[index] ?? 0])));
        } catch (error) {
          reject(error);
        }
      };
    };
  }), TABLES);
}
