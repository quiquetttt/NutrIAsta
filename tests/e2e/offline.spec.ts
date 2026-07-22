import { expect, test } from '@playwright/test';

test('abre la interfaz con la caché del service worker', async ({ browserName, context, page }) => {
  test.skip(
    browserName === 'webkit' && process.platform === 'win32',
    'Playwright WebKit para Windows devuelve un error interno al navegar offline; la validación Safari se hace en el iPhone real.',
  );
  await page.goto('/');
  await page.evaluate(() => navigator.serviceWorker.ready);
  await page.reload();
  await page.waitForFunction(() => navigator.serviceWorker?.controller !== null);
  await page.close();
  await context.setOffline(true);
  const offlinePage = await context.newPage();
  await offlinePage.goto('/', { waitUntil: 'domcontentloaded' });
  await expect(offlinePage.locator('body')).toContainText('NutrIAsta');
  await expect(offlinePage.getByLabel('Texto del registro ficticio')).toBeEnabled();
  await expect(offlinePage.locator('body')).toContainText('Offline');
});
