// @ts-check
const { test, expect } = require('@playwright/test');

/**
 * Smoke test — minimal browser E2E to confirm the frontend and backend are
 * live and reachable through nginx. Broader E2E specs (auth/job/settlement/
 * moderation/verification flows) are opt-in via E2E_PATTERN=*.spec.js in CI.
 */

test.describe('Smoke: frontend serves and backend is reachable', () => {
  test('login page loads via nginx TLS proxy', async ({ page }) => {
    const response = await page.goto('/login');
    expect(response?.ok()).toBe(true);
    await expect(page.locator('button', { hasText: /sign in|log in/i })).toBeVisible({ timeout: 10000 });
  });

  test('register page loads with form fields', async ({ page }) => {
    await page.goto('/register');
    await page.waitForSelector('input', { timeout: 10000 });
    const inputs = await page.locator('input').count();
    expect(inputs).toBeGreaterThanOrEqual(3);
    await expect(page.locator('button', { hasText: /register|sign up|create account/i })).toBeVisible();
  });

  test('unauthenticated /jobs redirects to login', async ({ page }) => {
    await page.context().clearCookies();
    await page.goto('/jobs');
    await expect(page.locator('button', { hasText: /sign in|log in/i })).toBeVisible({ timeout: 5000 });
  });

  test('backend health endpoint responds ok', async ({ request }) => {
    const res = await request.get('/api/health');
    expect(res.status()).toBe(200);
    const body = await res.json();
    expect(body.status).toBe('ok');
  });
});
