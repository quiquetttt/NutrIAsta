import { expect, test, type Page } from '@playwright/test';

import { openMvpSection, openMvpWithProfile } from './mvp-fixture';

const TODAY = '2026-07-26';
const TOMORROW = '2026-07-27';

test.beforeEach(async ({ page }) => {
  await page.addInitScript(({ now }) => {
    const NativeDate = Date;
    class FixedDate extends NativeDate {
      constructor(value?: string | number) {
        super(value ?? now);
      }
      static now() { return new NativeDate(now).getTime(); }
    }
    Object.setPrototypeOf(FixedDate, NativeDate);
    window.Date = FixedDate as DateConstructor;
  }, { now: '2026-07-26T10:00:00.000Z' });
});

test('mantiene los estados visuales aprobados en móvil y escritorio', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await openMvpWithProfile(page);
  await openMvpSection(page, 'Hoy');
  await stableScreenshot(page, '01-hoy-390.png');

  await openMvpSection(page, 'Entrenar');
  await addSession(page, TODAY, 'Pecho ficticio visual', 'Pecho', true);
  await addSession(page, TOMORROW, 'Cardio ficticio visual', 'Cardio', false);
  await page.getByRole('button', { name: 'Volver a hoy' }).click();
  await page.locator('.na-calendar').evaluate((element) => element.parentElement?.scrollIntoView({ block: 'start' }));
  await stableScreenshot(page, '02-calendario-390.png');

  await openMvpSection(page, 'Alimentos');
  await page.getByRole('button', { name: 'Añadir alimento' }).click();
  await page.getByLabel('Nombre', { exact: true }).fill('Carne ficticia visual');
  await page.getByLabel('Energía (kcal)').fill('120');
  await page.getByRole('button', { name: 'Guardar alimento' }).click();
  await openMvpSection(page, 'Inventario');
  await page.getByLabel('Cantidad canónica (g)').fill('200');
  await page.getByRole('button', { name: 'Añadir al inventario' }).click();
  await openMvpSection(page, 'Diario');
  await page.getByLabel('Cantidad', { exact: true }).fill('200');
  await page.getByRole('button', { name: 'Añadir alimento a la comida' }).click();
  await stableScreenshot(page, '03-inventario-aviso-390.png');
  await page.getByRole('button', { name: 'Cancelar' }).click();

  await openMvpSection(page, 'Historial de peso');
  await addWeight(page, '2026-07-25', '08:00', '70.4');
  await addWeight(page, TODAY, '08:00', '70.1');
  await page.locator('.na-weight-chart').scrollIntoViewIfNeeded();
  await stableScreenshot(page, '04-peso-390.png');

  await openMvpSection(page, 'Ajustes y privacidad');
  await page.getByLabel('Contraseña del backup completo').fill('clave-ficticia-segura');
  const downloadPromise = page.waitForEvent('download');
  await page.getByRole('button', { name: 'Exportar backup completo' }).click();
  const download = await downloadPromise;
  const path = await download.path();
  expect(path).toBeTruthy();
  const uploadPath = `${path}.nutriasta.zip`;
  await download.saveAs(uploadPath);
  await expect(page.getByRole('button', { name: 'Seleccionar backup completo para restaurar' })).toBeEnabled();
  await page.getByLabel('Archivo de backup completo').setInputFiles(uploadPath);
  await expect(page.getByText('Candidato temporal verificado', { exact: false })).toBeVisible();
  await page.getByText('Paso 2 de 3 · Candidato temporal verificado').scrollIntoViewIfNeeded();
  await stableScreenshot(page, '05-restauracion-390.png');
  await page.getByRole('button', { name: 'Cancelar candidato completo' }).click();

  await page.setViewportSize({ width: 320, height: 844 });
  await openMvpSection(page, 'Hoy');
  await stableScreenshot(page, '06-hoy-320.png', true);

  await page.setViewportSize({ width: 1280, height: 900 });
  await stableScreenshot(page, '07-escritorio-1280.png', true);
});

async function addSession(page: Page, date: string, title: string, type: string, completed: boolean) {
  await page.getByRole('gridcell', { name: new RegExp(`^${date}:`) }).click();
  await page.getByLabel('Título opcional').fill(title);
  await page.getByRole('button', { name: type, exact: true }).first().click();
  await page.getByRole('button', { name: 'Guardar sesión' }).click();
  if (completed) await page.getByRole('button', { name: 'Marcar completada' }).click();
}

async function addWeight(page: Page, date: string, time: string, value: string) {
  await page.getByLabel('Fecha del peso').fill(date);
  await page.getByLabel('Hora del peso').fill(time);
  await page.getByLabel('Peso registrado (kg)').fill(value);
  await page.getByRole('button', { name: 'Añadir peso' }).click();
}

async function stableScreenshot(page: Page, name: string, resetScrollTop = false) {
  await page.locator('.na-surface').evaluate((element, resetTop) => {
    element.scrollLeft = 0;
    if (resetTop) element.scrollTop = 0;
  }, resetScrollTop);
  await expect(page).toHaveScreenshot(name, {
    animations: 'disabled',
    caret: 'hide',
    maxDiffPixelRatio: 0.01,
  });
}
