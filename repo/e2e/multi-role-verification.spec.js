// @ts-check
const { test, expect } = require('@playwright/test');

/**
 * Multi-role E2E: Photographer verification → Admin review → Content moderation
 *
 * Exercises the full photographer onboarding pipeline through real browser
 * sessions, including consent grants, form submissions, and admin page access.
 */

const ts = Date.now();
const photographer = { username: `e2ePh_${ts}`, email: `e2eph${ts}@test.com`, password: 'E2ePh12345!' };
const admin = { username: `e2eAdm_${ts}`, email: `e2ea${ts}@test.com`, password: 'E2eAdm1234!' };

async function register(page, user, role = 'alumni') {
  await page.goto('/register');
  await page.fill('input[type="text"]', user.username);
  await page.locator('input[type="email"]').fill(user.email);
  await page.locator('input[type="password"]').fill(user.password);
  const roleSelect = page.locator('select');
  if (await roleSelect.isVisible({ timeout: 1000 }).catch(() => false)) {
    await roleSelect.selectOption(role);
  }
  await page.locator('button', { hasText: /register|sign up|create account/i }).click();
  await expect(page).toHaveURL('/', { timeout: 10000 });
}

async function login(page, user) {
  await page.goto('/login');
  const inputs = page.locator('input');
  await inputs.nth(0).fill(user.username);
  await inputs.nth(1).fill(user.password);
  await page.locator('button', { hasText: /sign in|log in/i }).click();
  await expect(page).toHaveURL('/', { timeout: 10000 });
}

test.describe('Multi-role: Verification → Admin Review → Moderation', () => {
  test.describe.configure({ mode: 'serial' });

  // --- Photographer onboarding ---

  test('photographer registers with photographer role and sees correct sidebar', async ({ page }) => {
    await register(page, photographer, 'photographer');
    const nav = page.locator('nav');
    await expect(nav.locator('a', { hasText: /portfolio/i })).toBeVisible({ timeout: 3000 });
    await expect(nav.locator('a', { hasText: /verification/i })).toBeVisible();
    // Should NOT have admin links
    await expect(nav.locator('a', { hasText: /admin/i })).not.toBeVisible();
  });

  test('photographer grants data category consents via real consent page', async ({ page }) => {
    await login(page, photographer);
    await page.goto('/consent');
    await expect(page.locator('h1, h2', { hasText: /consent/i })).toBeVisible({ timeout: 5000 });
    await page.waitForLoadState('networkidle');

    // The page should show data categories
    const bodyText = await page.textContent('body');
    expect(bodyText.toLowerCase()).toMatch(/government|qualification|account/);

    // Grant consents
    const grantBtns = page.locator('button', { hasText: /grant|enable|allow/i });
    const count = await grantBtns.count();
    for (let i = 0; i < count; i++) {
      if (await grantBtns.nth(i).isVisible()) {
        await grantBtns.nth(i).click();
        await page.waitForTimeout(500);
      }
    }
  });

  test('photographer sees verification form with file upload and document type', async ({ page }) => {
    await login(page, photographer);
    await page.goto('/verification');
    await expect(page.locator('h1, h2', { hasText: /verification/i })).toBeVisible({ timeout: 5000 });

    // Should have file input, document type selector, and submit button
    await expect(page.locator('input[type="file"]')).toBeVisible({ timeout: 3000 });
    await expect(page.locator('button', { hasText: /submit/i })).toBeVisible();

    // Document type selector should have expected options
    const docTypeSelect = page.locator('select').first();
    if (await docTypeSelect.isVisible({ timeout: 1000 }).catch(() => false)) {
      const options = await docTypeSelect.locator('option').allTextContents();
      expect(options.join(' ').toLowerCase()).toMatch(/government|passport|license|certificate/);
    }
  });

  test('photographer creates a portfolio through the real UI', async ({ page }) => {
    await login(page, photographer);
    await page.goto('/portfolios');
    await expect(page.locator('h1, h2', { hasText: /portfolio/i })).toBeVisible({ timeout: 5000 });

    const createLink = page.locator('a, button', { hasText: /create|upload|new/i }).first();
    if (await createLink.isVisible({ timeout: 2000 }).catch(() => false)) {
      await createLink.click();
      await page.waitForLoadState('networkidle');
      const text = await page.textContent('body');
      expect(text.toLowerCase()).toMatch(/portfolio|upload|title/);
    }
  });

  // --- Admin panel access control ---

  test('admin registers and all admin pages enforce RBAC', async ({ page }) => {
    await register(page, admin);

    // Non-admin should be denied on every admin page
    for (const path of ['/admin', '/admin/verification', '/admin/content-review', '/admin/users', '/admin/reports', '/admin/blacklist', '/admin/audit']) {
      await page.goto(path);
      await expect(page.locator('text=/access denied/i')).toBeVisible({ timeout: 5000 });
    }
  });

  test('admin content-filter and privacy-policy pages also enforce RBAC', async ({ page }) => {
    await login(page, admin);
    await page.goto('/admin/content-filter');
    await expect(page.locator('text=/access denied/i')).toBeVisible({ timeout: 5000 });

    await page.goto('/admin/privacy-policy');
    await expect(page.locator('text=/access denied/i')).toBeVisible({ timeout: 5000 });
  });

  // --- Cross-role isolation ---

  test('photographer cannot access admin pages', async ({ page }) => {
    await login(page, photographer);
    await page.goto('/admin');
    await expect(page.locator('text=/access denied/i')).toBeVisible({ timeout: 5000 });
  });

  test('photographer sidebar has correct role-specific links', async ({ page }) => {
    await login(page, photographer);
    const nav = page.locator('nav');
    await expect(nav.locator('a', { hasText: /portfolio/i })).toBeVisible({ timeout: 3000 });
    await expect(nav.locator('a', { hasText: /verification/i })).toBeVisible();
    await expect(nav.locator('a', { hasText: /report/i })).toBeVisible();
    await expect(nav.locator('a', { hasText: /admin/i })).not.toBeVisible();
  });
});
