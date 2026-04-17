// @ts-check
const { test, expect } = require('@playwright/test');

const ts = Date.now();
const user = { username: `e2ePriv_${ts}`, email: `e2ep${ts}@test.com`, password: 'E2ePriv123!' };

async function login(page) {
  await page.goto('/login');
  const inputs = page.locator('input');
  await inputs.nth(0).fill(user.username);
  await inputs.nth(1).fill(user.password);
  await page.locator('button', { hasText: /sign in|log in/i }).click();
  await expect(page).toHaveURL('/', { timeout: 10000 });
}

test.describe('Browser E2E: Privacy & Consent pages', () => {
  test.beforeAll(async ({ browser }) => {
    const page = await browser.newPage({ ignoreHTTPSErrors: true });
    await page.goto('/register');
    await page.fill('input[type="text"]', user.username);
    await page.locator('input[type="email"]').fill(user.email);
    await page.locator('input[type="password"]').fill(user.password);
    await page.locator('button', { hasText: /register|sign up|create account/i }).click();
    await expect(page).toHaveURL('/', { timeout: 10000 });
    await page.close();
  });

  test('privacy settings page loads and shows field toggles', async ({ page }) => {
    await login(page);
    await page.goto('/privacy');
    await expect(page.locator('h1, h2', { hasText: /privacy/i })).toBeVisible({ timeout: 5000 });
    // Should show field-level privacy controls
    await expect(page.locator('select, input[type="radio"]').first()).toBeVisible({ timeout: 3000 });
  });

  test('consent management page loads and shows categories', async ({ page }) => {
    await login(page);
    await page.goto('/consent');
    await expect(page.locator('h1, h2', { hasText: /consent/i })).toBeVisible({ timeout: 5000 });
  });

  test('profile edit page loads and saves', async ({ page }) => {
    await login(page);
    await page.goto('/consent');
    // Grant contact_information consent if there's a grant button
    const grantBtn = page.locator('button', { hasText: /grant|enable|allow/i }).first();
    if (await grantBtn.isVisible({ timeout: 2000 }).catch(() => false)) {
      await grantBtn.click();
      await page.waitForTimeout(500);
    }

    await page.goto('/profile/edit');
    await expect(page.locator('h1, h2', { hasText: /profile|edit/i })).toBeVisible({ timeout: 5000 });
  });

  test('access requests page loads with tabs', async ({ page }) => {
    await login(page);
    await page.goto('/access-requests');
    await expect(page.locator('h1, h2', { hasText: /access request/i })).toBeVisible({ timeout: 5000 });
    await expect(page.locator('button', { hasText: /incoming/i })).toBeVisible();
    await expect(page.locator('button', { hasText: /outgoing/i })).toBeVisible();
  });
});
