import { expect, test } from '@playwright/test';

import { openMvpSection, openMvpWithProfile } from './mvp-fixture';

const MOBILE_WIDTHS = [320, 375, 390, 430] as const;
const DESTINATIONS = ['Hoy', 'Diario', 'Entrenar', 'Inventario', 'Perfil'] as const;
const SCROLL_SECTIONS = [
  'Hoy',
  'Diario',
  'Alimentos',
  'Recetas',
  'Entrenar',
  'Inventario',
  'Perfil y objetivos',
  'Historial de peso',
  'Ajustes y privacidad',
] as const;

test('declara y sirve el icono aprobado específico para la pantalla de inicio del iPhone', async ({ page, request }) => {
  await page.goto('/');
  await expect(page.locator('link[rel="apple-touch-icon"][sizes="180x180"]')).toHaveAttribute(
    'href',
    '/icons/apple-touch-icon-180.png',
  );
  const response = await request.get('/icons/apple-touch-icon-180.png');
  expect(response.ok()).toBe(true);
  expect(response.headers()['content-type']).toContain('image/png');
  const dimensions = await page.evaluate(() => new Promise<{ width: number; height: number }>((resolve, reject) => {
    const image = new Image();
    image.onload = () => resolve({ width: image.naturalWidth, height: image.naturalHeight });
    image.onerror = () => reject(new Error('No se pudo cargar el icono local de NutrIAsta.'));
    image.src = '/icons/apple-touch-icon-180.png';
  }));
  expect(dimensions).toEqual({ width: 180, height: 180 });
});

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

test('permite desplazar verticalmente todas las secciones cuando su contenido supera el viewport', async ({ page }) => {
  await openMvpWithProfile(page);
  for (const width of MOBILE_WIDTHS) {
    await page.setViewportSize({ width, height: 568 });
    for (const section of SCROLL_SECTIONS) {
      await openMvpSection(page, section);
      const surface = page.locator('.na-surface');
      const before = await surface.evaluate((element) => {
        element.scrollTop = 0;
        const sentinel = document.createElement('div');
        sentinel.dataset.scrollTestSentinel = 'true';
        sentinel.style.width = '1px';
        sentinel.style.height = '1200px';
        element.querySelector('.na-content')?.append(sentinel);
        return {
          overflowY: getComputedStyle(element).overflowY,
          maximumScroll: element.scrollHeight - element.clientHeight,
          scrollWidth: element.scrollWidth,
          clientWidth: element.clientWidth,
        };
      });
      expect(before.overflowY).toBe('auto');
      expect(before.maximumScroll).toBeGreaterThan(40);
      expect(before.scrollWidth, `${section} a ${width}px no debe desbordar horizontalmente`)
        .toBeLessThanOrEqual(before.clientWidth);
      await surface.evaluate((element) => { element.scrollTop = 500; });
      await expect.poll(() => surface.evaluate((element) => element.scrollTop)).toBeGreaterThan(0);
      await surface.evaluate((element) => {
        element.querySelector('[data-scroll-test-sentinel="true"]')?.remove();
        element.scrollTop = 0;
      });
    }
  }
});

test('mantiene navegación, texto ampliado, teclado y movimiento reducido', async ({ page }) => {
  await openMvpWithProfile(page);
  await page.setViewportSize({ width: 320, height: 844 });
  await page.evaluate(() => { document.documentElement.style.fontSize = '32px'; });
  await openMvpSection(page, 'Diario');
  await openMvpSection(page, 'Alimentos');
  await expect(page.getByRole('button', { name: 'Introducir alimento manualmente' })).toBeVisible();
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

test('mantiene desplazamiento vertical con texto al 200 %', async ({ page }) => {
  await openMvpWithProfile(page);
  await page.setViewportSize({ width: 320, height: 700 });
  await page.evaluate(() => { document.documentElement.style.fontSize = '32px'; });
  await openMvpSection(page, 'Perfil y objetivos');
  const surface = page.locator('.na-surface');
  const maximumScroll = await surface.evaluate((element) => element.scrollHeight - element.clientHeight);
  expect(maximumScroll).toBeGreaterThan(100);
  await surface.evaluate((element) => { element.scrollTop = 600; });
  await expect.poll(() => surface.evaluate((element) => element.scrollTop)).toBeGreaterThan(0);
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= document.documentElement.clientWidth)).toBe(true);
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
