import { expect, test } from '@playwright/test';
import { join } from 'node:path';

test('procesa y conserva una fotografía ficticia', async ({ browserName, page }) => {
  test.skip(
    browserName === 'webkit' && process.platform === 'win32',
    'Playwright WebKit para Windows no serializa Blob en IndexedDB; esta capacidad se valida en Safari sobre el iPhone real.',
  );
  await page.goto('/');
  await expect(page.getByRole('button', { name: 'Elegir de Fotos' })).toBeEnabled();
  await page.getByLabel('Seleccionar fotografía de prueba').setInputFiles(
    join(process.cwd(), 'public', 'icons', 'icon-192.png'),
  );
  await expect(page.getByText(/Fotografía procesada y guardada localmente/i)).toBeVisible();
  await expect(page.getByLabel('Miniatura de la fotografía de prueba')).toBeVisible();
  await page.reload();
  await expect(page.getByLabel('Miniatura de la fotografía de prueba')).toBeVisible();
});
