import { expect, test } from '@playwright/test';

test('no solicita recursos de terceros', async ({ page }) => {
  const externalRequests = new Set<string>();
  page.on('request', (request) => {
    const url = new URL(request.url());
    if (url.hostname !== '127.0.0.1') externalRequests.add(url.origin);
  });
  await page.goto('/');
  await page.waitForLoadState('networkidle');
  expect([...externalRequests]).toEqual([]);
});
