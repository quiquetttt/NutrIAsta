import { expect, test, type Locator, type Page } from '@playwright/test';

import { openMvpSection, openMvpWithProfile } from './mvp-fixture';

const IPHONE_VIEWPORT = { width: 390, height: 844 };

test.beforeEach(async ({ page }) => {
  await page.setViewportSize(IPHONE_VIEWPORT);
});

test('las acciones de agua caben en el iPhone y permiten editar y eliminar', async ({ page }) => {
  await openMvpWithProfile(page);
  await openMvpSection(page, 'Diario');
  await page.getByRole('button', { name: '+250 ml' }).click();

  const edit = page.getByRole('button', { name: /^Editar agua water-/ });
  const remove = page.getByRole('button', { name: /^Eliminar agua water-/ });
  await expectWithinViewport(page, edit);
  await expectWithinViewport(page, remove);
  await expect(page.getByText(/water-[0-9a-f-]+/)).toHaveCount(0);

  await edit.click();
  await page.getByLabel('Nueva cantidad en ml').fill('400');
  await page.getByRole('button', { name: 'Guardar cantidad' }).click();
  await expect(page.getByText(/400 ml · \d{2}:\d{2}/)).toBeVisible();

  await page.getByRole('button', { name: /^Eliminar agua water-/ }).click();
  await page.getByRole('button', { name: 'Eliminar agua', exact: true }).click();
  await expect(page.getByText(/400 ml · \d{2}:\d{2}/)).toHaveCount(0);
});

test('todas las acciones de recetas se adaptan al ancho del iPhone', async ({ page }) => {
  await openMvpWithProfile(page);
  await openMvpSection(page, 'Alimentos');
  await page.getByRole('button', { name: 'Añadir alimento' }).click();
  await page.getByLabel('Nombre', { exact: true }).fill('Ingrediente ficticio móvil');
  await page.getByLabel('Energía (kcal)').fill('100');
  await page.getByRole('button', { name: 'Guardar alimento' }).click();

  await openMvpSection(page, 'Recetas');
  await page.getByRole('button', { name: 'Crear receta' }).click();
  await page.getByLabel('Nombre de receta').fill('Receta ficticia de anchura móvil');
  await page.getByLabel('Cantidad del ingrediente (g o ml base)').fill('100');
  await page.getByRole('button', { name: 'Añadir ingrediente' }).click();
  await expectWithinViewport(page, page.getByRole('button', { name: 'Quitar ingrediente' }));
  await page.getByRole('button', { name: 'Guardar receta' }).click();

  const edit = page.getByRole('button', { name: 'Editar receta' });
  const favorite = page.getByRole('button', { name: 'Marcar favorita' });
  const archive = page.getByRole('button', { name: 'Archivar receta' });
  await expectWithinViewport(page, edit);
  await expectWithinViewport(page, favorite);
  await expectWithinViewport(page, archive);

  await favorite.click();
  await expectWithinViewport(page, page.getByRole('button', { name: 'Quitar favorita' }));
  await edit.click();
  await expect(page.getByLabel('Nombre de receta')).toHaveValue('Receta ficticia de anchura móvil');
  await page.getByRole('button', { name: 'Cancelar' }).click();

  await page.getByRole('button', { name: 'Archivar receta' }).click();
  await page.getByRole('heading', { name: 'Archivar receta' }).waitFor();
  await page.getByRole('button', { name: 'Archivar receta' }).last().click();
  await expect(page.getByText('Receta ficticia de anchura móvil', { exact: true })).toHaveCount(0);
});

async function expectWithinViewport(page: Page, locator: Locator) {
  await expect(locator).toBeVisible();
  const box = await locator.boundingBox();
  const viewport = page.viewportSize();
  expect(box).not.toBeNull();
  expect(viewport).not.toBeNull();
  expect(box!.x).toBeGreaterThanOrEqual(0);
  expect(box!.x + box!.width).toBeLessThanOrEqual(viewport!.width);
}
