import { expect, test } from '@playwright/test';

test('persiste el registro ficticio tras recargar', async ({ page }) => {
  await page.goto('/');
  await expect(page.getByText('NutrIAsta')).toBeVisible();
  await expect(page.getByText('Versión 0.1.1 — prueba de actualización')).toBeVisible();
  const record = page.getByLabel('Texto del registro ficticio');
  await record.click();
  await record.press('Control+A');
  await record.pressSequentially('registro-prueba-001 persistente');
  await page.getByRole('button', { name: /Crear registro|Guardar cambios/ }).click();
  await expect(page.getByText(/guardado en el dataset activo/i)).toBeVisible();
  await page.reload();
  await expect(page.getByLabel('Texto del registro ficticio')).toHaveValue('registro-prueba-001 persistente');
});
