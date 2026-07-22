import { expect, test } from '@playwright/test';

test('sirve una exportación estática completa con ancho inicial válido', async ({ request }) => {
  const response = await request.get('/');
  expect(response.ok()).toBe(true);
  expect(response.headers()['x-nutriasta-build']).toMatch(/^[a-f0-9]{16}$/);
  const html = await response.text();
  const markerIndex = html.indexOf('data-testid="viability-content"');
  const tagStart = html.lastIndexOf('<div', markerIndex);
  const tagEnd = html.indexOf('>', markerIndex);
  const contentTag = html.slice(tagStart, tagEnd + 1);

  expect(markerIndex).toBeGreaterThan(0);
  expect(contentTag).toContain('width:100%');
  expect(contentTag).toContain('max-width:720px');
  expect(contentTag).not.toContain('width:0px');
  expect(html).toContain('manifest.webmanifest');
  expect(html).toContain('NutrIAsta');
});
