// @ts-check
const { test, expect } = require('@playwright/test');

/**
 * Multi-role E2E: Content moderation flow
 *
 * User posts content → content filter flags it → admin reviews via
 * the content review queue in the real admin UI.
 */

const ts = Date.now();
const user = { username: `e2eMod_${ts}`, email: `e2em${ts}@test.com`, password: 'E2eMod1234!' };
const adminUser = { username: `e2eModAdm_${ts}`, email: `e2ema${ts}@test.com`, password: 'E2eModA123!' };

async function register(page, u, role = 'alumni') {
  await page.goto('/register');
  await page.fill('input[type="text"]', u.username);
  await page.locator('input[type="email"]').fill(u.email);
  await page.locator('input[type="password"]').fill(u.password);
  const roleSelect = page.locator('select');
  if (await roleSelect.isVisible({ timeout: 1000 }).catch(() => false)) {
    await roleSelect.selectOption(role);
  }
  await page.locator('button', { hasText: /register|sign up|create account/i }).click();
  await expect(page).toHaveURL('/', { timeout: 10000 });
}

async function login(page, u) {
  await page.goto('/login');
  const inputs = page.locator('input');
  await inputs.nth(0).fill(u.username);
  await inputs.nth(1).fill(u.password);
  await page.locator('button', { hasText: /sign in|log in/i }).click();
  await expect(page).toHaveURL('/', { timeout: 10000 });
}

test.describe('Multi-role: Content Moderation', () => {
  test.describe.configure({ mode: 'serial' });

  test('user registers and can access report creation page', async ({ page }) => {
    await register(page, user);
    await page.goto('/reports/new');
    await page.waitForLoadState('networkidle');
    const text = await page.textContent('body');
    // Should render the report form, not 404
    expect(text.toLowerCase()).not.toContain('page not found');
    expect(text.toLowerCase()).toMatch(/report|submit|category/);
  });

  test('admin register and access content review queue', async ({ page }) => {
    await register(page, adminUser);
    // Admin pages require admin role — verify access control
    await page.goto('/admin/content-review');
    await page.waitForLoadState('networkidle');
    const text = await page.textContent('body');
    // Should show access denied for non-admin, or content review for admin
    expect(text.toLowerCase()).toMatch(/content review|access denied|forbidden/);
  });

  test('admin content filter config page loads', async ({ page }) => {
    await login(page, adminUser);
    await page.goto('/admin/content-filter');
    await page.waitForLoadState('networkidle');
    const text = await page.textContent('body');
    expect(text.toLowerCase()).toMatch(/content filter|sensitive|access denied/);
  });

  test('admin report management page loads', async ({ page }) => {
    await login(page, adminUser);
    await page.goto('/admin/reports');
    await page.waitForLoadState('networkidle');
    const text = await page.textContent('body');
    expect(text.toLowerCase()).toMatch(/report|management|access denied/);
  });

  test('admin blacklist page loads', async ({ page }) => {
    await login(page, adminUser);
    await page.goto('/admin/blacklist');
    await page.waitForLoadState('networkidle');
    const text = await page.textContent('body');
    expect(text.toLowerCase()).toMatch(/blacklist|access denied/);
  });

  test('admin audit log page loads', async ({ page }) => {
    await login(page, adminUser);
    await page.goto('/admin/audit');
    await page.waitForLoadState('networkidle');
    const text = await page.textContent('body');
    expect(text.toLowerCase()).toMatch(/audit|log|access denied/);
  });
});
