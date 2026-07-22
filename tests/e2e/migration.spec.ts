import { expect, test } from '@playwright/test';
import { readLegacyState, seedLegacyDatabase } from './legacy-fixture';

test('activa, revierte, reactiva y confirma la copia manteniendo intacta la base 0.1.1', async ({ page }) => {
  await seedLegacyDatabase(page, { text: 'origen ficticio inmutable' });
  const before = await readLegacyState(page);
  await page.goto('/');

  await page.getByRole('button', { name: 'Preparar copia desde 0.1.1' }).click();
  await expect(page.getByText('Candidato preparado y verificado')).toBeVisible();
  await expect(page.getByText('nutriasta 0.1.1', { exact: true }).first()).toBeVisible();
  expect(await readLegacyState(page)).toEqual(before);

  await page.getByRole('button', { name: 'Activar base paralela' }).click();
  await expect(page.getByText('nutriasta-main', { exact: true }).first()).toBeVisible();
  await expect(page.getByLabel('Texto del registro ficticio')).toHaveText('origen ficticio inmutable');
  expect(await readLegacyState(page)).toEqual(before);

  await page.getByRole('button', { name: 'Volver a 0.1.1' }).click();
  await expect(page.getByText('nutriasta 0.1.1', { exact: true }).first()).toBeVisible();
  await page.getByRole('button', { name: 'Reactivar base paralela' }).click();
  await expect(page.getByText('nutriasta-main', { exact: true }).first()).toBeVisible();
  await page.getByRole('button', { name: 'Confirmar migración' }).click();
  await expect(page.getByText(/Migración confirmada/i)).toBeVisible();
  await page.reload();
  await expect(page.getByText('nutriasta-main', { exact: true }).first()).toBeVisible();
  expect(await readLegacyState(page)).toEqual(before);
});
