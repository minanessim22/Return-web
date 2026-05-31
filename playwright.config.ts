import { defineConfig, devices } from '@playwright/test';

/**
 * Playwright E2E testing configuration.
 */
export default defineConfig({
  testDir: './tests/e2e',
  timeout: 60000, // 60 seconds per test to prevent database-related E2E timeouts
  fullyParallel: false, // Run sequentially to avoid DB lock/race conditions
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: 1, // Single worker to avoid database constraint issues
  reporter: 'html',
  use: {
    baseURL: 'http://localhost:3000',
    trace: 'on-first-retry',
    screenshot: 'only-on-failure',
  },
  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
    },
  ],
  webServer: {
    command: 'npm run dev',
    url: 'http://localhost:3000',
    reuseExistingServer: !process.env.CI,
    stdout: 'ignore',
    stderr: 'pipe',
    timeout: 120 * 1000,
  },
});
