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
  expect(await page.evaluate(() => getComputedStyle(document.activeElement!).outlineStyle)).not.toBe('none');
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

test('mantiene contraste de texto y controles táctiles visibles', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await openMvpWithProfile(page);
  await openMvpSection(page, 'Hoy');
  const pairs = [
    ['#0d1f2d', '#ffffff'],
    ['#64727c', '#ffffff'],
    ['#ffffff', '#071a2f'],
    ['#11784b', '#dcf8ea'],
    ['#8a5300', '#fff2d8'],
    ['#a63333', '#fde8e8'],
  ] as const;
  for (const [foreground, background] of pairs) expect(contrast(foreground, background)).toBeGreaterThanOrEqual(4.5);
  const undersized = await page.locator('button:visible').evaluateAll((buttons) => buttons
    .map((button) => ({ label: button.getAttribute('aria-label') ?? button.textContent, height: button.getBoundingClientRect().height }))
    .filter(({ height }) => height < 44));
  expect(undersized).toEqual([]);
});

function contrast(foreground: string, background: string) {
  const luminance = (hex: string) => {
    const channels = [1, 3, 5].map((start) => Number.parseInt(hex.slice(start, start + 2), 16) / 255)
      .map((value) => value <= 0.03928 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4);
    return 0.2126 * channels[0]! + 0.7152 * channels[1]! + 0.0722 * channels[2]!;
  };
  const light = Math.max(luminance(foreground), luminance(background));
  const dark = Math.min(luminance(foreground), luminance(background));
  return (light + 0.05) / (dark + 0.05);
}
