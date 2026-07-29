import { expect, test } from '@playwright/test';

import { openMvpSection, openMvpWithProfile } from './mvp-fixture';

const localToday = new Intl.DateTimeFormat('sv-SE', { timeZone: 'Europe/Madrid' }).format(new Date());
const tomorrow = new Intl.DateTimeFormat('sv-SE', { timeZone: 'Europe/Madrid' })
  .format(new Date(Date.now() + 86_400_000));

test('planifica, completa, copia y resume sesiones sin reinterpretar semanas anteriores', async ({ page }) => {
  await openMvpWithProfile(page);
  await openMvpSection(page, 'Entrenar');
  await expect(page.getByText('Objetivo: 0 de 4')).toBeVisible();
  await expect(page.getByRole('button', { name: 'Volver a hoy' })).toBeVisible();

  const goalFive = page.locator('.na-choice').filter({ hasText: /^5$/ });
  await goalFive.click();
  await expect(goalFive).toHaveAttribute('aria-pressed', 'true');
  await page.getByRole('button', { name: 'Esta semana', exact: true }).click();
  const effective = await page.getByText(/Fecha efectiva exacta:/).textContent();
  expect(effective).toMatch(/\d{4}-\d{2}-\d{2}/);
  await page.getByRole('button', { name: 'Guardar objetivo semanal' }).click();
  await expect(page.getByRole('heading', { name: 'Revisar objetivo semanal' })).toBeVisible();
  await page.getByRole('button', { name: 'Guardar objetivo', exact: true }).click();
  await expect(page.getByText('Objetivo semanal guardado.')).toBeVisible();
  await expect(page.getByText('Objetivo: 0 de 5')).toBeVisible();

  await page.getByRole('gridcell', { name: new RegExp(`^${localToday}:`) }).click();
  await page.getByLabel('Título opcional').fill('Pecho y tríceps ficticio');
  await page.getByRole('button', { name: 'Pecho', exact: true }).first().click();
  await page.getByRole('button', { name: 'Tríceps', exact: true }).first().click();
  await page.getByLabel('Notas de la sesión').fill('Anotación ficticia de entrenamiento');
  await page.getByRole('button', { name: 'Guardar sesión' }).click();
  await expect(page.getByText('Sesión guardada.')).toBeVisible();
  await expect(page.getByText('Pecho y tríceps ficticio', { exact: true }).first()).toBeVisible();
  await expect(page.getByText('Planificada', { exact: true }).first()).toBeVisible();

  await page.getByRole('button', { name: 'Marcar completada' }).click();
  await expect(page.getByText('Sesión completada.')).toBeVisible();
  await expect(page.getByText('Objetivo: 1 de 5')).toBeVisible();
  await expect(page.getByText('Realizadas: 1')).toBeVisible();
  await expect(page.getByText('Planificadas: 0')).toBeVisible();
  await expect(page.getByText(/Canceladas:/)).toHaveCount(0);
  await expect(page.getByRole('gridcell', { name: new RegExp(`${localToday}: Completada; tipos: Pecho, Tríceps`) })).toBeVisible();
  await expect(page.getByRole('button', { name: /Ejercicios y series/ })).toHaveCount(0);
  await expect(page.getByText('Ejercicios reutilizables')).toHaveCount(0);

  await page.getByRole('button', { name: 'Copiar sesión' }).click();
  await page.getByLabel('Nueva fecha de la copia (AAAA-MM-DD)').fill(tomorrow);
  await page.getByRole('button', { name: 'Crear copia independiente' }).click();
  await expect(page.getByText('Sesión copiada como planificada.')).toBeVisible();
  await expect(page.getByRole('gridcell', { name: new RegExp(`${tomorrow}: Planificada; tipos: Pecho, Tríceps`) })).toBeVisible();

  await page.getByLabel('Nuevo tipo personalizado').fill('Movilidad ficticia');
  await page.getByRole('button', { name: 'Añadir tipo' }).click();
  await expect(page.getByText('Tipo personalizado añadido.')).toBeVisible();
  await page.getByRole('button', { name: 'Renombrar tipo Movilidad ficticia' }).click();
  await page.getByLabel('Renombrar tipo personalizado').fill('Movilidad renombrada');
  await page.getByRole('button', { name: 'Guardar nombre del tipo' }).click();
  await page.getByRole('button', { name: 'Archivar tipo Movilidad renombrada' }).click();
  await expect(page.getByText('Tipo archivado.')).toBeVisible();
  await page.getByText('Mostrar tipos personalizados archivados').click();
  await page.getByRole('button', { name: 'Eliminar tipo Movilidad renombrada' }).click();
  await expect(page.getByRole('heading', { name: 'Eliminar tipo de entrenamiento' })).toBeVisible();
  await page.getByRole('button', { name: 'Eliminar tipo personalizado' }).click();
  await expect(page.getByText('Tipo personalizado eliminado.')).toBeVisible();
  await expect(page.getByText('Movilidad renombrada', { exact: true })).toHaveCount(0);

  await expect(page.getByLabel('Buscar por título, nota o tipo')).toHaveCount(0);
  await page.getByRole('button', { name: 'Historial de sesiones' }).click();
  await page.getByLabel('Buscar por título, nota o tipo').fill('tríceps');
  await expect(page.getByText('2 resultado(s). Los nombres son instantáneas históricas.')).toBeVisible();
  await page.getByLabel('Desde (AAAA-MM-DD)').fill(tomorrow);
  await expect(page.getByText('1 resultado(s). Los nombres son instantáneas históricas.')).toBeVisible();

  expect(await page.evaluate(() => document.documentElement.scrollWidth <= document.documentElement.clientWidth)).toBe(true);
});
