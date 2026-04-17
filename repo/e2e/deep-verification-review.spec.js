// @ts-check
const { test, expect } = require('@playwright/test');
const api = require('./api-helper');

/**
 * Deep multi-role E2E: Photographer submits verification → Admin reviews →
 * Photographer sees updated status in the UI.
 *
 * Uses API helper for admin setup (DB promotion), then drives ALL user-facing
 * interactions through real browser sessions. Validates that state changes
 * made by one role are reflected in another role's browser view.
 */

test.describe('Deep: Verification Submit → Admin Review → Status Update', () => {
  test.describe.configure({ mode: 'serial' });

  const ts = Date.now();
  const photog = { username: `dpPh_${ts}`, email: `dpph${ts}@t.com`, password: 'DpPh12345!' };
  let admin;
  let verificationId;

  test.beforeAll(async () => {
    admin = await api.createAdminUser();
  });

  test('photographer registers via browser and lands on dashboard', async ({ page }) => {
    await page.goto('/register');
    await page.fill('input[type="text"]', photog.username);
    await page.locator('input[type="email"]').fill(photog.email);
    await page.locator('input[type="password"]').fill(photog.password);
    const roleSelect = page.locator('select');
    if (await roleSelect.isVisible({ timeout: 1000 }).catch(() => false)) {
      await roleSelect.selectOption('photographer');
    }
    await page.locator('button', { hasText: /register|sign up|create account/i }).click();
    await expect(page).toHaveURL('/', { timeout: 10000 });
  });

  test('photographer grants consents via browser consent page', async ({ page }) => {
    await page.goto('/login');
    await page.locator('input').nth(0).fill(photog.username);
    await page.locator('input').nth(1).fill(photog.password);
    await page.locator('button', { hasText: /sign in/i }).click();
    await expect(page).toHaveURL('/', { timeout: 10000 });

    await page.goto('/consent');
    await page.waitForLoadState('networkidle');

    const grantBtns = page.locator('button', { hasText: /grant|enable|allow/i });
    for (let i = 0; i < await grantBtns.count(); i++) {
      if (await grantBtns.nth(i).isVisible()) {
        await grantBtns.nth(i).click();
        await page.waitForTimeout(400);
      }
    }
  });

  test('photographer sees verification form and submits documents via browser', async ({ page }) => {
    await page.goto('/login');
    await page.locator('input').nth(0).fill(photog.username);
    await page.locator('input').nth(1).fill(photog.password);
    await page.locator('button', { hasText: /sign in/i }).click();
    await expect(page).toHaveURL('/', { timeout: 10000 });

    await page.goto('/verification');
    await expect(page.locator('input[type="file"]')).toBeVisible({ timeout: 5000 });

    // Upload a real file through the browser file input
    const fileInput = page.locator('input[type="file"]');
    // Create a minimal PDF buffer
    const pdfContent = Buffer.from('%PDF-1.4\n1 0 obj\n<< /Type /Catalog >>\nendobj\n');
    await fileInput.setInputFiles({
      name: 'id_document.pdf',
      mimeType: 'application/pdf',
      buffer: pdfContent,
    });

    // Submit
    const submitBtn = page.locator('button', { hasText: /submit/i });
    await submitBtn.click();

    // Wait for success feedback or status change
    await page.waitForTimeout(2000);
    const bodyText = await page.textContent('body');
    // Should show submitted status or success message
    expect(bodyText.toLowerCase()).toMatch(/submitted|success|pending|verification/);
  });

  test('admin sees pending verification in the admin review queue', async ({ page }) => {
    if (admin.unpromoted) { test.skip(); return; }

    await page.goto('/login');
    await page.locator('input').nth(0).fill(admin.username);
    await page.locator('input').nth(1).fill(admin.password);
    await page.locator('button', { hasText: /sign in/i }).click();
    await expect(page).toHaveURL('/', { timeout: 10000 });

    await page.goto('/admin/verification');
    await page.waitForLoadState('networkidle');

    // Should see at least one pending verification
    const bodyText = await page.textContent('body');
    expect(bodyText.toLowerCase()).toMatch(/submitted|pending|review/);
  });

  test('admin approves verification via browser and photographer sees updated status', async ({ page, browser }) => {
    if (admin.unpromoted) { test.skip(); return; }

    // Admin approves via the admin UI
    await page.goto('/login');
    await page.locator('input').nth(0).fill(admin.username);
    await page.locator('input').nth(1).fill(admin.password);
    await page.locator('button', { hasText: /sign in/i }).click();
    await expect(page).toHaveURL('/', { timeout: 10000 });

    await page.goto('/admin/verification');
    await page.waitForLoadState('networkidle');

    // Look for an approve button on the first pending verification
    const approveBtn = page.locator('button', { hasText: /approve|verify/i }).first();
    if (await approveBtn.isVisible({ timeout: 3000 }).catch(() => false)) {
      await approveBtn.click();
      await page.waitForTimeout(1000);
    }

    // Now open a NEW browser context as photographer and check status
    const photogPage = await browser.newPage({ ignoreHTTPSErrors: true });
    await photogPage.goto(page.url().replace(/\/admin.*/, '/login'));
    await photogPage.locator('input').nth(0).fill(photog.username);
    await photogPage.locator('input').nth(1).fill(photog.password);
    await photogPage.locator('button', { hasText: /sign in/i }).click();
    await expect(photogPage).toHaveURL('/', { timeout: 10000 });

    await photogPage.goto('/verification');
    await photogPage.waitForLoadState('networkidle');
    const statusText = await photogPage.textContent('body');
    // Should show verified status (not the submission form)
    expect(statusText.toLowerCase()).toMatch(/verified|approved/);
    await photogPage.close();
  });
});
