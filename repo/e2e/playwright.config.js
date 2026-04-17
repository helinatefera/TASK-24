/** @type {import('@playwright/test').PlaywrightTestConfig} */
module.exports = {
  testDir: '.',
  // Default run: smoke test only. Full E2E opt-in via E2E_PATTERN env var.
  testMatch: process.env.E2E_PATTERN || 'smoke.spec.js',
  timeout: 30000,
  retries: 0,
  fullyParallel: false,
  use: {
    baseURL: process.env.E2E_BASE_URL || 'https://localhost:3443',
    ignoreHTTPSErrors: true,
    screenshot: 'only-on-failure',
    trace: 'retain-on-failure',
    actionTimeout: 10000,
    navigationTimeout: 15000,
  },
  reporter: [['list']],
};
