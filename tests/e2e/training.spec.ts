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
  await expect(page.getByText('Canceladas: 0')).toBeVisible();
  await expect(page.getByRole('gridcell', { name: new RegExp(`${localToday}: Completada; tipos: Pecho, Tríceps`) })).toBeVisible();

  await page.getByRole('button', { name: 'Ejercicios y series de Pecho y tríceps ficticio' }).click();
  await page.getByLabel('Nombre del ejercicio').fill('Press ficticio');
  await page.getByRole('button', { name: 'Pecho', exact: true }).last().click();
  await page.getByLabel('Nota del catálogo').fill('Nota de catálogo ficticia');
  await page.getByRole('button', { name: 'Crear ejercicio del catálogo' }).click();
  await page.getByLabel('Nota para este ejercicio en la sesión').fill('Instantánea ficticia');
  await page.getByRole('button', { name: 'Añadir ejercicio a la sesión' }).click();
  await page.getByLabel('Repeticiones planificadas').fill('10');
  await page.getByLabel('Carga planificada (kg)').fill('20');
  await page.getByRole('button', { name: 'Añadir serie a Press ficticio' }).click();
  await page.getByRole('button', { name: 'Editar serie 1 de Press ficticio' }).click();
  await page.getByLabel('Repeticiones realizadas').fill('9');
  await page.getByLabel('Carga realizada (kg)').fill('22.5');
  await page.getByLabel('Serie realizada').check();
  await page.getByRole('button', { name: 'Guardar cambios de serie' }).click();
  await expect(page.getByText(/Plan: 10 rep \/ 20 kg · Real: 9 rep \/ 22.5 kg/)).toBeVisible();
  await page.getByRole('button', { name: 'Cerrar ejercicios y series' }).click();

  await page.getByRole('button', { name: 'Copiar sesión' }).click();
  await page.getByLabel('Nueva fecha de la copia (AAAA-MM-DD)').fill(tomorrow);
  await page.getByRole('button', { name: 'Crear copia independiente' }).click();
  await expect(page.getByText('Sesión copiada como planificada.')).toBeVisible();
  await expect(page.getByText('Pecho y tríceps ficticio', { exact: true })).toHaveCount(3);

  await page.getByLabel('Nuevo tipo personalizado').fill('Movilidad ficticia');
  await page.getByRole('button', { name: 'Añadir tipo' }).click();
  await expect(page.getByText('Tipo personalizado añadido.')).toBeVisible();
  await page.getByRole('button', { name: 'Renombrar tipo Movilidad ficticia' }).click();
  await page.getByLabel('Renombrar tipo personalizado').fill('Movilidad renombrada');
  await page.getByRole('button', { name: 'Guardar nombre del tipo' }).click();
  await page.getByRole('button', { name: 'Archivar tipo Movilidad renombrada' }).click();
  await expect(page.getByText('Tipo archivado.')).toBeVisible();
  await page.getByRole('button', { name: 'Añadir sesión' }).click();
  await expect(page.getByRole('button', { name: 'Movilidad renombrada' })).toHaveCount(1);

  await page.getByLabel('Buscar por título, nota o tipo').fill('tríceps');
  await expect(page.getByText('2 resultado(s). Los nombres son instantáneas históricas.')).toBeVisible();
  await page.getByLabel('Desde (AAAA-MM-DD)').fill(tomorrow);
  await expect(page.getByText('1 resultado(s). Los nombres son instantáneas históricas.')).toBeVisible();

  expect(await page.evaluate(() => document.documentElement.scrollWidth <= document.documentElement.clientWidth)).toBe(true);
});
