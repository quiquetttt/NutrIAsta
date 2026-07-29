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
  await page.getByRole('button', { name: 'Introducir alimento manualmente' }).click();
  await page.getByLabel('Nombre', { exact: true }).fill('Alimento OCR ficticio');
  await page.getByLabel('Energía (kcal)').fill('100');
  await page.getByRole('button', { name: 'Guardar alimento' }).click();
  await page.getByRole('button', { name: 'Fotografiar etiqueta nutricional' }).click();
  await page.getByRole('button', { name: 'Seleccionar de Fotos o Archivos' }).click();
  await page.getByLabel('Seleccionar fotografía de etiqueta').setInputFiles(await fictitiousLabel(page));
  await page.getByRole('button', { name: 'Usar esta fotografía' }).click();
  await expect(page.getByRole('button', { name: 'Revisar etiqueta nutricional' })).toBeVisible({ timeout: 60_000 });
  await page.getByRole('button', { name: 'Revisar etiqueta nutricional' }).click();
  await page.setViewportSize({ width: 390, height: 844 });
  await expect(page).toHaveScreenshot('08-ocr-revision-390.png', {
    animations: 'disabled',
    caret: 'hide',
    maxDiffPixelRatio: 0.01,
  });
  await page.getByRole('button', { name: 'Editar fotografía' }).click();
  await expect(page.getByLabel('Vista previa antes de recodificar')).toBeVisible();
  await expect(page.getByRole('button', { name: 'Usar esta fotografía' })).toBeVisible();
  await page.getByRole('button', { name: 'Usar esta fotografía' }).click();
  await expect(page.getByRole('button', { name: 'Revisar etiqueta nutricional' })).toBeVisible({ timeout: 60_000 });
  await page.getByRole('button', { name: 'Revisar etiqueta nutricional' }).click();
  await page.getByLabel('Nombre del alimento').fill('Alimento OCR ficticio');
  await page.getByLabel('Energía (kcal)').fill('400');
  await page.getByLabel('Energía (kJ)').fill('1680');
  await page.getByLabel('Grasas (g)').fill('12,5');
  await page.getByLabel('Carbohidratos (g)').fill('54');
  await page.getByLabel('Proteínas (g)').fill('16');
  for (const width of [320, 375, 390, 430]) {
    await page.setViewportSize({ width, height: 844 });
    const geometry = await page.evaluate(() => ({
      documentWidth: document.documentElement.scrollWidth,
      viewportWidth: document.documentElement.clientWidth,
      surfaceWidth: document.querySelector('.na-surface')?.scrollWidth ?? 0,
      surfaceClientWidth: document.querySelector('.na-surface')?.clientWidth ?? 0,
    }));
    expect(geometry.documentWidth).toBeLessThanOrEqual(geometry.viewportWidth);
    expect(geometry.surfaceWidth).toBeLessThanOrEqual(geometry.surfaceClientWidth);
  }
  await page.setViewportSize({ width: 320, height: 844 });
  await page.evaluate(() => { document.documentElement.style.fontSize = '32px'; });
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= document.documentElement.clientWidth)).toBe(true);
  expect(await page.locator('button:visible').evaluateAll((buttons) => buttons.every((button) => button.getBoundingClientRect().height >= 44))).toBe(true);
  await page.evaluate(() => { document.documentElement.style.fontSize = '16px'; });
  if (browserName === 'webkit') {
    await expect(page.getByText('Detectado con suficiente confianza', { exact: false }).first()).toBeVisible();
    expect(await foodCount(page)).toBe(before + 1);
    expect(external).toEqual([]);
    return;
  }
  await page.getByRole('button', { name: 'Guardar alimento' }).click();
  await expect(page.getByRole('dialog')).toContainText('Posible duplicado: “Alimento OCR ficticio”');
  await expect(page.getByRole('dialog')).toContainText('Los resultados OCR han sido revisados');
  await page.getByRole('button', { name: 'Confirmar y guardar alimento' }).click();
  await expect(page.getByText('Alimento revisado y fotografía guardados localmente.')).toBeVisible();
  expect(await foodCount(page)).toBe(before + 2);
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

test('rechaza fotografías excesivas o corruptas sin escrituras', async ({ page }) => {
  await openMvpWithProfile(page);
  await openMvpSection(page, 'Alimentos');
  const before = await foodCount(page);
  await page.getByRole('button', { name: 'Fotografiar etiqueta nutricional' }).click();

  await page.getByLabel('Seleccionar fotografía de etiqueta').setInputFiles({
    name: 'etiqueta-excesiva-ficticia.jpg',
    mimeType: 'image/jpeg',
    buffer: Buffer.alloc(20 * 1024 * 1024 + 1),
  });
  await page.getByRole('button', { name: 'Usar esta fotografía' }).click();
  await expect(page.getByText(/supera el límite de 20 MB/)).toBeVisible();

  await page.getByLabel('Seleccionar fotografía de etiqueta').setInputFiles({
    name: 'etiqueta-corrupta-ficticia.jpg',
    mimeType: 'image/jpeg',
    buffer: Buffer.from('contenido-ficticio-no-imagen'),
  });
  await page.getByRole('button', { name: 'Usar esta fotografía' }).click();
  await expect(page.getByText(/dañada|no puede leerla/)).toBeVisible();
  expect(await foodCount(page)).toBe(before);
});

test('permite corregir localmente una fotografía girada antes del OCR', async ({ page }) => {
  await openMvpWithProfile(page);
  await openMvpSection(page, 'Alimentos');
  const before = await foodCount(page);
  await page.getByRole('button', { name: 'Fotografiar etiqueta nutricional' }).click();
  await page.getByLabel('Seleccionar fotografía de etiqueta').setInputFiles(await fictitiousRotatedLabel(page));
  await page.getByRole('button', { name: 'Girar a la derecha' }).click();
  await page.getByRole('button', { name: 'Usar esta fotografía' }).click();
  await expect(page.getByRole('button', { name: 'Revisar etiqueta nutricional' })).toBeVisible({ timeout: 60_000 });
  expect(await foodCount(page)).toBe(before);
});

test('una preparación interrumpida al recargar no deja candidatos ni alimentos', async ({ page }) => {
  await openMvpWithProfile(page);
  await openMvpSection(page, 'Alimentos');
  const before = await foodCount(page);
  await page.getByRole('button', { name: 'Fotografiar etiqueta nutricional' }).click();
  await page.getByLabel('Seleccionar fotografía de etiqueta').setInputFiles(await fictitiousLabel(page));
  await page.getByRole('button', { name: 'Usar esta fotografía' }).click();
  await expect(page.getByText('Procesando etiqueta')).toBeVisible();
  await page.reload();
  await openMvpSection(page, 'Alimentos');
  expect(await foodCount(page)).toBe(before);
  await expect(page.getByRole('heading', { name: 'Fotografiar etiqueta nutricional' })).toHaveCount(0);
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

async function fictitiousRotatedLabel(page: Page) {
  const base64 = await page.evaluate(() => {
    const canvas = document.createElement('canvas');
    canvas.width = 1000; canvas.height = 1500;
    const context = canvas.getContext('2d')!;
    context.fillStyle = '#fff'; context.fillRect(0, 0, canvas.width, canvas.height);
    context.translate(0, canvas.height);
    context.rotate(-Math.PI / 2);
    context.fillStyle = '#111'; context.font = 'bold 60px Arial';
    context.fillText('INFORMACIÓN NUTRICIONAL', 80, 90);
    context.font = '40px Arial';
    [
      'Valores medios por 100 g',
      'Valor energético 1680 kJ',
      '400 kcal',
      'Grasas 12,5 g',
      'Hidratos de carbono 54,0 g',
      'Proteínas 16,0 g',
    ].forEach((line, index) => context.fillText(line, 80, 180 + index * 100));
    return canvas.toDataURL('image/jpeg', 0.92).split(',')[1]!;
  });
  return { name: 'etiqueta-girada-ficticia.jpg', mimeType: 'image/jpeg', buffer: Buffer.from(base64, 'base64') };
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
