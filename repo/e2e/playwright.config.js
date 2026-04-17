/** @type {import('@playwright/test').PlaywrightTestConfig} */
module.exports = {
  testDir: '.',
  testMatch: '*.spec.js',
  timeout: 60000,
  retries: 1,
  use: {
    // Hit the real nginx TLS proxy — same URL a real user would use
    baseURL: process.env.E2E_BASE_URL || 'https://localhost:3443',
    ignoreHTTPSErrors: true, // self-signed cert
    screenshot: 'only-on-failure',
    trace: 'retain-on-failure',
  },
  reporter: [['list'], ['json', { outputFile: '/tmp/e2e-results.json' }]],
};
