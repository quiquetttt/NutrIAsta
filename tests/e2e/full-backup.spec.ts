import { expect, test } from '@playwright/test';
import { openMvpWithProfile } from './mvp-fixture';

test('exporta y restaura el MVP completo mediante candidato, rollback y confirmación', async ({ page }) => {
  await openMvpWithProfile(page);
  await page.getByRole('tab', { name: 'Perfil y objetivos' }).click();
  await page.getByLabel('Contraseña del backup completo').fill('clave-ficticia-segura');
  const downloadPromise = page.waitForEvent('download');
  await page.getByRole('button', { name: 'Exportar backup completo' }).click();
  const download = await downloadPromise; const path = await download.path();
  expect(path).toBeTruthy();
  const uploadPath = `${path}.nutriasta.zip`;
  await download.saveAs(uploadPath);
  await expect(page.getByText(/Backup completo generado/)).toBeVisible();

  await page.getByLabel('Alias').fill('Perfil ficticio modificado');
  await page.getByRole('button', { name: 'Guardar cambios del perfil' }).click();
  await page.getByLabel('Archivo de backup completo').setInputFiles(uploadPath);
  await expect(page.getByText('Candidato temporal verificado')).toBeVisible();
  await page.reload();
  await expect(page.getByText('Candidato temporal verificado')).toBeVisible();
  await page.getByRole('tab', { name: 'Perfil y objetivos' }).click();
  await expect(page.getByLabel('Alias')).toHaveValue('Perfil ficticio modificado');
  await page.getByRole('button', { name: 'Activar restauración completa' }).click();
  await expect(page.getByLabel('Alias')).toHaveValue('Persona ficticia');
  await page.getByRole('button', { name: 'Volver a datos anteriores' }).click();
  await expect(page.getByLabel('Alias')).toHaveValue('Perfil ficticio modificado');
  await page.getByRole('button', { name: 'Reactivar candidato completo' }).click();
  await expect(page.getByLabel('Alias')).toHaveValue('Persona ficticia');
  await page.getByRole('button', { name: 'Confirmar restauración completa' }).click();
  await page.reload();
  await page.getByRole('tab', { name: 'Perfil y objetivos' }).click();
  await expect(page.getByLabel('Alias')).toHaveValue('Persona ficticia');
  await expect(page.getByText('Versión 0.2.0 — MVP 1 local')).toBeVisible();
});
