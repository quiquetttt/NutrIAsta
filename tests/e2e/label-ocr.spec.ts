import { expect, test, type Page } from '@playwright/test';

import { openMvpSection, openMvpWithProfile } from './mvp-fixture';

test('procesa y revisa una etiqueta ficticia sin tráfico externo', async ({ page, context, browserName }) => {
  const external: string[] = [];
  context.on('request', (request) => {
    const url = new URL(request.url());
    if (['http:', 'https:'].includes(url.protocol) && !['127.0.0.1', 'localhost'].includes(url.hostname)) external.push(request.url());
  });
  await openMvpWithProfile(page);
  await openMvpSection(page, 'Alimentos');
  const before = await foodCount(page);
  await page.getByRole('button', { name: 'Fotografiar etiqueta nutricional' }).click();
  await page.getByRole('button', { name: 'Seleccionar de Fotos o Archivos' }).click();
  await page.getByLabel('Seleccionar fotografía de etiqueta').setInputFiles(await fictitiousLabel(page));
  await page.getByRole('button', { name: 'Usar esta fotografía' }).click();
  await expect(page.getByRole('button', { name: 'Revisar etiqueta nutricional' })).toBeVisible({ timeout: 60_000 });
  await page.getByRole('button', { name: 'Revisar etiqueta nutricional' }).click();
  await page.getByLabel('Nombre del alimento').fill('Alimento OCR ficticio');
  await page.getByLabel('Energía (kcal)').fill('400');
  await page.getByLabel('Energía (kJ)').fill('1680');
  await page.getByLabel('Grasas (g)').fill('12,5');
  await page.getByLabel('Carbohidratos (g)').fill('54');
  await page.getByLabel('Proteínas (g)').fill('16');
  if (browserName === 'webkit') {
    await expect(page.getByText('Detectado con suficiente confianza', { exact: false }).first()).toBeVisible();
    expect(await foodCount(page)).toBe(before);
    expect(external).toEqual([]);
    return;
  }
  await page.getByRole('button', { name: 'Guardar alimento' }).click();
  await expect(page.getByRole('dialog')).toContainText('Los resultados OCR han sido revisados');
  await page.getByRole('button', { name: 'Confirmar y guardar alimento' }).click();
  await expect(page.getByText('Alimento OCR ficticio', { exact: true })).toBeVisible();
  expect(await foodCount(page)).toBe(before + 1);
  expect(external).toEqual([]);
});

test('cancelar el OCR produce cero escrituras funcionales', async ({ page }) => {
  await openMvpWithProfile(page);
  await openMvpSection(page, 'Alimentos');
  const before = await foodCount(page);
  await page.getByRole('button', { name: 'Fotografiar etiqueta nutricional' }).click();
  await page.getByLabel('Seleccionar fotografía de etiqueta').setInputFiles(await fictitiousLabel(page));
  await page.getByRole('button', { name: 'Usar esta fotografía' }).click();
  await page.getByRole('button', { name: 'Cancelar procesamiento' }).click();
  await expect(page.getByText('No se ha guardado ningún dato', { exact: false })).toBeVisible({ timeout: 15_000 });
  expect(await foodCount(page)).toBe(before);
});

async function fictitiousLabel(page: Page) {
  const base64 = await page.evaluate(() => {
    const canvas = document.createElement('canvas');
    canvas.width = 1500; canvas.height = 1000;
    const context = canvas.getContext('2d')!;
    context.fillStyle = '#fff'; context.fillRect(0, 0, canvas.width, canvas.height);
    context.fillStyle = '#111'; context.font = 'bold 60px Arial';
    context.fillText('INFORMACIÓN NUTRICIONAL', 80, 90);
    context.font = '40px Arial';
    [
      'Valores medios por 100 g',
      'Valor energético 1680 kJ',
      '400 kcal',
      'Grasas 12,5 g',
      'de las cuales saturadas 3,0 g',
      'Hidratos de carbono 54,0 g',
      'de los cuales azúcares 7,5 g',
      'Proteínas 16,0 g',
      'Sal 0,8 g',
    ].forEach((line, index) => context.fillText(line, 80, 180 + index * 86));
    return canvas.toDataURL('image/jpeg', 0.92).split(',')[1]!;
  });
  return { name: 'etiqueta-ficticia.jpg', mimeType: 'image/jpeg', buffer: Buffer.from(base64, 'base64') };
}

async function foodCount(page: Page) {
  return page.evaluate(async () => {
    const request = indexedDB.open('nutriasta-main');
    const database = await new Promise<IDBDatabase>((resolve, reject) => {
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
    const count = await new Promise<number>((resolve, reject) => {
      const query = database.transaction('foods').objectStore('foods').count();
      query.onsuccess = () => resolve(query.result);
      query.onerror = () => reject(query.error);
    });
    database.close();
    return count;
  });
}
