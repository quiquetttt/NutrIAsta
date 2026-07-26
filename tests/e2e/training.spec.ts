import { expect, test } from '@playwright/test';

import { openMvpSection, openMvpWithProfile } from './mvp-fixture';

const localToday = new Intl.DateTimeFormat('sv-SE', { timeZone: 'Europe/Madrid' }).format(new Date());
const tomorrow = new Intl.DateTimeFormat('sv-SE', { timeZone: 'Europe/Madrid' })
  .format(new Date(Date.now() + 86_400_000));

test('planifica, completa, copia y resume sesiones sin reinterpretar semanas anteriores', async ({ page }) => {
  await openMvpWithProfile(page);
  await openMvpSection(page, 'Entrenar');
  await expect(page.getByText('Objetivo: 0 de 4')).toBeVisible();

  const goalFive = page.locator('.na-choice').filter({ hasText: /^5$/ });
  await goalFive.click();
  await expect(goalFive).toHaveAttribute('aria-pressed', 'true');
  await page.getByRole('button', { name: 'Esta semana', exact: true }).click();
  const effective = await page.getByText(/Fecha efectiva exacta:/).textContent();
  expect(effective).toMatch(/\d{4}-\d{2}-\d{2}/);
  page.once('dialog', (dialog) => dialog.accept());
  await page.getByRole('button', { name: 'Guardar objetivo semanal' }).click();
  await expect(page.getByText('Objetivo semanal guardado.')).toBeVisible();
  await expect(page.getByText('Objetivo: 0 de 5')).toBeVisible();

  await page.getByRole('gridcell', { name: new RegExp(`^${localToday}:`) }).click();
  await page.getByLabel('Título opcional').fill('Pecho y tríceps ficticio');
  await page.getByRole('button', { name: 'Pecho', exact: true }).click();
  await page.getByRole('button', { name: 'Tríceps', exact: true }).click();
  await page.getByLabel('Notas de la sesión').fill('Anotación ficticia de entrenamiento');
  await page.getByRole('button', { name: 'Guardar sesión' }).click();
  await expect(page.getByText('Sesión guardada.')).toBeVisible();
  await expect(page.getByText('Pecho y tríceps ficticio', { exact: true }).first()).toBeVisible();
  await expect(page.getByText('Planificada', { exact: true }).first()).toBeVisible();

  await page.getByRole('button', { name: 'Marcar completada' }).click();
  await expect(page.getByText('Sesión completada.')).toBeVisible();
  await expect(page.getByText('Objetivo: 1 de 5')).toBeVisible();

  page.once('dialog', (dialog) => dialog.accept(tomorrow));
  await page.getByRole('button', { name: 'Copiar sesión' }).click();
  await expect(page.getByText('Sesión copiada como planificada.')).toBeVisible();
  await expect(page.getByText('Pecho y tríceps ficticio', { exact: true })).toHaveCount(3);

  await page.getByLabel('Nuevo tipo personalizado').fill('Movilidad ficticia');
  await page.getByRole('button', { name: 'Añadir tipo' }).click();
  await expect(page.getByText('Tipo personalizado añadido.')).toBeVisible();
  await page.getByRole('button', { name: 'Añadir sesión' }).click();
  await expect(page.getByRole('button', { name: 'Movilidad ficticia' })).toBeVisible();

  expect(await page.evaluate(() => document.documentElement.scrollWidth <= document.documentElement.clientWidth)).toBe(true);
});
