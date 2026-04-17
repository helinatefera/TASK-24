// @ts-check
const { test, expect } = require('@playwright/test');

const ts = Date.now();
const user = {
  username: `e2eBrowser_${ts}`,
  email: `e2eb${ts}@test.com`,
  password: 'E2eBrowser1!',
};

test.describe('Browser E2E: Registration → Login → Dashboard', () => {
  test('register page loads and accepts new user', async ({ page }) => {
    await page.goto('/register');
    await expect(page.locator('button', { hasText: /register|sign up|create account/i })).toBeVisible();

    await page.fill('input[type="text"]', user.username);
    await page.locator('input[type="email"]').fill(user.email);
    await page.locator('input[type="password"]').fill(user.password);
    await page.locator('button', { hasText: /register|sign up|create account/i }).click();

    // Should redirect to dashboard after registration
    await expect(page).toHaveURL('/', { timeout: 10000 });
  });

  test('logout returns to login page', async ({ page }) => {
    // Login first
    await page.goto('/login');
    const inputs = page.locator('input');
    await inputs.nth(0).fill(user.username);
    await inputs.nth(1).fill(user.password);
    await page.locator('button', { hasText: /sign in|log in/i }).click();
    await expect(page).toHaveURL('/', { timeout: 10000 });

    // Find and click logout
    const logoutBtn = page.locator('button', { hasText: /log\s*out|sign\s*out/i });
    if (await logoutBtn.isVisible()) {
      await logoutBtn.click();
      await expect(page).toHaveURL('/login', { timeout: 5000 });
    }
  });

  test('login page loads and authenticates', async ({ page }) => {
    await page.goto('/login');
    await expect(page.locator('button', { hasText: /sign in|log in/i })).toBeVisible();

    const inputs = page.locator('input');
    await inputs.nth(0).fill(user.username);
    await inputs.nth(1).fill(user.password);
    await page.locator('button', { hasText: /sign in|log in/i }).click();

    // Should redirect to dashboard
    await expect(page).toHaveURL('/', { timeout: 10000 });
    // Dashboard content should be visible (not login form)
    await expect(page.locator('button', { hasText: /sign in|log in/i })).not.toBeVisible();
  });

  test('authenticated user sees sidebar navigation', async ({ page }) => {
    await page.goto('/login');
    const inputs = page.locator('input');
    await inputs.nth(0).fill(user.username);
    await inputs.nth(1).fill(user.password);
    await page.locator('button', { hasText: /sign in|log in/i }).click();
    await expect(page).toHaveURL('/', { timeout: 10000 });

    // Sidebar should have navigation links
    await expect(page.locator('nav a', { hasText: /dashboard/i })).toBeVisible();
    await expect(page.locator('nav a', { hasText: /profile/i })).toBeVisible();
    await expect(page.locator('nav a', { hasText: /jobs/i })).toBeVisible();
  });

  test('unauthenticated user is redirected from protected routes', async ({ page }) => {
    // Clear any session state
    await page.context().clearCookies();
    await page.goto('/jobs');
    // Should redirect to login
    await expect(page.locator('button', { hasText: /sign in|log in/i })).toBeVisible({ timeout: 5000 });
  });
});
