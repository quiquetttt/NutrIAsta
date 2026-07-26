import { expect, test } from '@playwright/test';
import { openMvpWithProfile } from './mvp-fixture';

test('usa porciones, agrupa alimentos, edita y mueve elementos y conserva agua y entrenamiento', async ({ page }) => {
  await openMvpWithProfile(page);
  await page.getByRole('tab', { name: 'Alimentos' }).click();
  await createFood(page, 'Diario ficticio', 200, 'Bol ficticio', 75);
  await createFood(page, 'Segundo diario ficticio', 100);

  await page.getByRole('tab', { name: 'Hoy' }).click();
  await page.getByRole('radio', { name: 'Diario ficticio', exact: true }).click();
  await page.getByRole('radio', { name: 'Porción guardada' }).click();
  await expect(page.getByRole('radio', { name: /Bol ficticio · 75 g/ })).toBeVisible();
  await page.getByLabel('Cantidad', { exact: true }).fill('2');
  await page.getByLabel('Nota del elemento (opcional)').fill('Nota inicial ficticia');
  await page.getByRole('button', { name: 'Añadir alimento a la comida' }).click();
  await expect(page.getByText(/Subtotal conjunto: 300\.0 kcal/)).toBeVisible();

  await page.getByRole('radio', { name: 'Segundo diario ficticio', exact: true }).click();
  await page.getByRole('radio', { name: /Desayuno · 1 elementos/ }).click();
  await page.getByLabel('Cantidad', { exact: true }).fill('50');
  await page.getByRole('button', { name: 'Añadir alimento a la comida' }).click();
  await expect(page.getByText(/Subtotal conjunto: 350\.0 kcal/)).toBeVisible();
  await expect(page.getByText(/2 elemento\(s\)/)).toBeVisible();

  await page.getByRole('button', { name: 'Editar Diario ficticio' }).click();
  await page.getByLabel('Nueva cantidad de Diario ficticio').fill('1');
  await page.getByLabel('Nueva nota de Diario ficticio').fill('Nota editada ficticia');
  await page.getByRole('radio', { name: 'Cena' }).last().click();
  await page.getByRole('button', { name: 'Guardar edición de Diario ficticio' }).click();
  await expect(page.getByText('Nota: Nota editada ficticia')).toBeVisible();
  await expect(page.getByText(/Subtotal conjunto: 150\.0 kcal/)).toBeVisible();
  await expect(page.getByText(/Subtotal conjunto: 50\.0 kcal/)).toBeVisible();

  page.once('dialog', (dialog) => dialog.accept());
  await page.getByRole('button', { name: 'Eliminar Segundo diario ficticio' }).click();
  await expect(page.getByText('Segundo diario ficticio', { exact: true })).toHaveCount(1);
  await expect(page.getByText(/Subtotal conjunto: 150\.0 kcal/)).toBeVisible();
  await expect(page.getByRole('button', { name: 'Usar reciente: Diario ficticio' })).toBeVisible();
  await expect(page.getByRole('button', { name: /Copiar comida reciente/ })).toBeVisible();

  await page.getByRole('button', { name: '+250 ml' }).click();
  await page.getByLabel('Tipo de entrenamiento (opcional)').fill('Fuerza ficticia');
  await page.getByLabel('Nota de entrenamiento (opcional)').fill('Sin información real');
  await page.getByRole('button', { name: 'Guardar: sí he entrenado' }).click();
  await expect(page.getByText('Entrenamiento diario guardado.', { exact: true })).toBeVisible();

  await page.reload();
  await expect(page.getByText('Nota: Nota editada ficticia')).toBeVisible();
  await expect(page.getByText('250 ml', { exact: true })).toHaveCount(1);
  await expect(page.getByText(/250 ml · \d{2}:\d{2}/)).toBeVisible();
  await expect(page.getByText('Entrenamiento registrado', { exact: true })).toBeVisible();
  await expect(page.getByLabel('Tipo de entrenamiento (opcional)')).toHaveValue('Fuerza ficticia');
});

test('la interfaz no ofrece g para alimentos en ml ni ml para alimentos en g', async ({ page }) => {
  await openMvpWithProfile(page);
  await page.getByRole('tab', { name: 'Alimentos' }).click();
  await createFood(page, 'Sólido ficticio', 100);
  await page.getByRole('button', { name: 'Añadir alimento' }).click();
  await page.getByLabel('Nombre', { exact: true }).fill('Bebida ficticia');
  await page.getByRole('radio', { name: 'Por 100 ml' }).click();
  await page.getByLabel('Energía (kcal)').fill('40');
  await page.getByRole('button', { name: 'Guardar alimento' }).click();

  await page.getByRole('tab', { name: 'Hoy' }).click();
  await page.getByRole('radio', { name: 'Sólido ficticio', exact: true }).click();
  await expect(page.getByRole('radio', { name: 'Gramos' })).toBeVisible();
  await expect(page.getByRole('radio', { name: 'Mililitros' })).toHaveCount(0);
  await page.getByRole('radio', { name: 'Bebida ficticia', exact: true }).click();
  await expect(page.getByRole('radio', { name: 'Mililitros' })).toBeVisible();
  await expect(page.getByRole('radio', { name: 'Gramos' })).toHaveCount(0);
  await expect(page.getByText('No se realizan conversiones g↔ml.')).toBeVisible();
});

async function createFood(page: import('@playwright/test').Page, name: string, energy: number, portionName?: string, portionAmount?: number) {
  await page.getByRole('button', { name: 'Añadir alimento' }).click();
  await page.getByLabel('Nombre', { exact: true }).fill(name);
  await page.getByLabel('Energía (kcal)').fill(String(energy));
  if (portionName && portionAmount) {
    await page.getByLabel('Nombre de porción').fill(portionName);
    await page.getByLabel('Cantidad de la porción (g)').fill(String(portionAmount));
    await page.getByRole('button', { name: 'Añadir porción' }).click();
  }
  await page.getByRole('button', { name: 'Guardar alimento' }).click();
}
