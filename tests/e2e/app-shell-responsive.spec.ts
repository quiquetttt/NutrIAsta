import { expect, test } from '@playwright/test';

import { openMvpSection, openMvpWithProfile } from './mvp-fixture';

const MOBILE_WIDTHS = [320, 375, 390, 430] as const;
const DESTINATIONS = ['Hoy', 'Diario', 'Entrenar', 'Inventario', 'Perfil'] as const;

test('la navegación aprobada cabe en todos los anchos de iPhone sin desbordamiento', async ({ page }) => {
  await openMvpWithProfile(page);
  for (const width of MOBILE_WIDTHS) {
    await page.setViewportSize({ width, height: 844 });
    for (const label of DESTINATIONS) {
      await expect(page.locator('.na-bottom-nav .na-nav-item').filter({ hasText: new RegExp(`^${label}$`) })).toBeVisible();
    }
    const geometry = await page.evaluate(() => ({
      scrollWidth: document.documentElement.scrollWidth,
      clientWidth: document.documentElement.clientWidth,
      contentWidth: document.querySelector('[data-testid="mvp-content"]')?.getBoundingClientRect().width ?? 0,
      bottom: document.querySelector('.na-bottom-nav')?.getBoundingClientRect(),
    }));
    expect(geometry.scrollWidth).toBeLessThanOrEqual(geometry.clientWidth);
    expect(geometry.contentWidth).toBeGreaterThan(0);
    expect(geometry.bottom?.left).toBeGreaterThanOrEqual(0);
    expect(geometry.bottom?.right).toBeLessThanOrEqual(width);
  }
});

test('mantiene navegación, texto ampliado, teclado y movimiento reducido', async ({ page }) => {
  await openMvpWithProfile(page);
  await page.setViewportSize({ width: 320, height: 844 });
  await page.evaluate(() => { document.documentElement.style.fontSize = '32px'; });
  await openMvpSection(page, 'Diario');
  await openMvpSection(page, 'Alimentos');
  await expect(page.getByRole('button', { name: 'Añadir alimento' })).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= document.documentElement.clientWidth)).toBe(true);

  await page.emulateMedia({ reducedMotion: 'reduce' });
  const reducedDuration = await page.evaluate(() => {
    const spinner = document.createElement('span');
    spinner.className = 'na-spinner';
    document.body.append(spinner);
    const duration = getComputedStyle(spinner).animationDuration;
    spinner.remove();
    return duration;
  });
  expect(['0.01ms', '0.00001s', '1e-05s']).toContain(reducedDuration);
  await page.keyboard.press('Tab');
  expect(await page.evaluate(() => document.activeElement?.tagName)).toBe('BUTTON');
});

test('usa barra lateral en escritorio y conserva todos los accesos', async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 900 });
  await openMvpWithProfile(page);
  for (const width of [1280, 1440]) {
    await page.setViewportSize({ width, height: 900 });
    await expect(page.locator('.na-rail')).toBeVisible();
    await expect(page.locator('.na-bottom-nav')).toBeHidden();
    for (const label of DESTINATIONS) {
      await expect(page.locator('.na-rail .na-nav-item').filter({ hasText: new RegExp(`^${label}$`) })).toBeVisible();
    }
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= document.documentElement.clientWidth)).toBe(true);
  }
});
