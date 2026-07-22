import { defineConfig, devices } from '@playwright/test';

const port = Number(process.env.NUTRIASTA_E2E_PORT);
if (!Number.isInteger(port) || port < 1024 || port > 65_535) {
  throw new Error('Ejecuta las E2E mediante npm run test:e2e para usar un servidor aislado.');
}
const baseURL = `http://127.0.0.1:${port}`;

export default defineConfig({
  testDir: './tests/e2e',
  fullyParallel: false,
  use: {
    baseURL,
    trace: 'on-first-retry',
  },
  webServer: {
    command: `node tests/serve-dist.mjs ${port}`,
    url: baseURL,
    reuseExistingServer: false,
    timeout: 30_000,
  },
  projects: [
    { name: 'chromium', use: { ...devices['Desktop Chrome'] } },
    { name: 'webkit', use: { ...devices['iPhone 15'] } },
  ],
});
