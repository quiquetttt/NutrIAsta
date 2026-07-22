import { expect, test } from '@playwright/test';
import { openMvpWithProfile } from './mvp-fixture';

test('registra consumo, agua y entrenamiento y persiste al recargar', async ({ page }) => {
  await openMvpWithProfile(page);
  await page.getByRole('tab', { name: 'Alimentos' }).click();
  await page.getByRole('button', { name: 'Añadir alimento' }).click();
  await page.getByLabel('Nombre', { exact: true }).fill('Diario ficticio');
  await page.getByLabel('Energía (kcal)').fill('200');
  await page.getByLabel('Proteínas (g)').fill('10');
  await page.getByLabel('Carbohidratos (g)').fill('20');
  await page.getByLabel('Grasas (g)').fill('5');
  await page.getByRole('button', { name: 'Guardar alimento' }).click();
  await page.getByRole('tab', { name: 'Hoy' }).click();
  await page.getByRole('button', { name: 'Añadir como consumido' }).click();
  await expect(page.getByText('Diario ficticio', { exact: true })).toHaveCount(2);
  await page.getByRole('button', { name: '+250 ml' }).click();
  await page.getByLabel('Tipo de entrenamiento (opcional)').fill('Fuerza ficticia');
  await expect(page.getByLabel('Tipo de entrenamiento (opcional)')).toHaveValue('Fuerza ficticia');
  await page.getByRole('button', { name: 'Guardar: sí he entrenado' }).click();
  await expect(page.getByText('Entrenamiento diario guardado.', { exact: true })).toBeVisible();
  const trainingRows = await page.evaluate(() => new Promise<Array<{ trained: boolean }>>((resolve, reject) => {
    const request = indexedDB.open('nutriasta-main');
    request.onerror = () => reject(request.error);
    request.onsuccess = () => {
      const database = request.result;
      const rows = database.transaction('trainingDayFlags', 'readonly').objectStore('trainingDayFlags').getAll();
      rows.onerror = () => reject(rows.error);
      rows.onsuccess = () => resolve(rows.result);
    };
  }));
  expect(trainingRows).toMatchObject([{ trained: true }]);
  await page.reload();
  await expect(page.getByText('Diario ficticio', { exact: true })).toHaveCount(2);
  await expect(page.getByText('250 ml', { exact: true })).toHaveCount(2);
  await expect(page.getByText('Entrenamiento registrado', { exact: true })).toBeVisible();
  await expect(page.getByLabel('Tipo de entrenamiento (opcional)')).toHaveValue('Fuerza ficticia');
});
