import { expect, test } from '@playwright/test';
import { openMvpWithProfile } from './mvp-fixture';

test('crea una receta, la planifica y conserva su snapshot al consumirla', async ({ page }) => {
  await openMvpWithProfile(page);
  await page.getByRole('tab', { name: 'Alimentos' }).click();
  await page.getByRole('button', { name: 'Añadir alimento' }).click();
  await page.getByLabel('Nombre', { exact: true }).fill('Ingrediente ficticio');
  await page.getByLabel('Energía (kcal)').fill('300');
  await page.getByLabel('Proteínas (g)').fill('12');
  await page.getByLabel('Carbohidratos (g)').fill('40');
  await page.getByLabel('Grasas (g)').fill('8');
  await page.getByRole('button', { name: 'Guardar alimento' }).click();

  await page.getByRole('tab', { name: 'Recetas' }).click();
  await page.getByRole('button', { name: 'Crear receta' }).click();
  await page.getByLabel('Nombre de receta').fill('Receta ficticia');
  await page.getByLabel('Número de porciones').fill('2');
  await page.getByLabel('Cantidad del ingrediente (g o ml base)').fill('100');
  await page.getByRole('button', { name: 'Añadir ingrediente' }).click();
  await page.getByRole('button', { name: 'Guardar receta' }).click();
  await expect(page.getByText('Receta guardada localmente.')).toBeVisible();
  await expect(page.getByText(/por porción: 150.0 kcal/)).toBeVisible();

  await page.getByRole('tab', { name: 'Hoy' }).click();
  await page.getByLabel('Fecha del diario').fill('2099-08-01');
  await page.getByRole('button', { name: 'Planificar receta' }).click();
  await expect(page.getByText('Receta añadida a la planificación.')).toBeVisible();
  await expect(page.getByText('Planificado', { exact: true })).toBeVisible();
  await expect(page.getByText(/Planificado aparte: 150.0 kcal/)).toBeVisible();
  await page.getByRole('button', { name: 'Marcar como consumido' }).click();
  await expect(page.getByText('Consumido', { exact: true })).toBeVisible();
  await expect(page.getByText(/150.0 \/ 0.0 kcal/)).toBeVisible();
  await page.reload();
  await page.getByLabel('Fecha del diario').fill('2099-08-01');
  await expect(page.getByText('Receta ficticia', { exact: true })).toBeVisible();
  await expect(page.getByText('Consumido', { exact: true })).toBeVisible();
});
