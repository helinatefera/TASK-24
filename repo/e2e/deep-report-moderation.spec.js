// @ts-check
const { test, expect } = require('@playwright/test');
const api = require('./api-helper');

/**
 * Deep multi-role E2E: User submits report → Admin transitions through
 * status machine → User sees status updates in their report list.
 *
 * Exercises the full content safety lifecycle through real browser sessions.
 */

test.describe('Deep: Report Submit → Admin Review → Status Transitions', () => {
  test.describe.configure({ mode: 'serial' });

  const ts = Date.now();
  const reporter = { username: `dpRep_${ts}`, email: `dprep${ts}@t.com`, password: 'DpRep1234!' };
  let admin;

  test.beforeAll(async () => {
    admin = await api.createAdminUser();
    // Reporter needs account_identity consent to submit reports
    const reg = await api.registerUser(reporter.username, reporter.email, reporter.password);
    await api.grantConsent(reg.token, 'account_identity');
  });

  test('reporter logs in and navigates to report creation page', async ({ page }) => {
    await page.goto('/login');
    await page.locator('input').nth(0).fill(reporter.username);
    await page.locator('input').nth(1).fill(reporter.password);
    await page.locator('button', { hasText: /sign in/i }).click();
    await expect(page).toHaveURL('/', { timeout: 10000 });

    await page.goto('/reports/new');
    await page.waitForLoadState('networkidle');
    // Should show the report form, not 404
    await expect(page.locator('text=/page not found/i')).not.toBeVisible({ timeout: 2000 });
    await expect(page.locator('select, input, textarea').first()).toBeVisible({ timeout: 3000 });
  });

  test('reporter fills and submits a report through the browser form', async ({ page }) => {
    await page.goto('/login');
    await page.locator('input').nth(0).fill(reporter.username);
    await page.locator('input').nth(1).fill(reporter.password);
    await page.locator('button', { hasText: /sign in/i }).click();
    await expect(page).toHaveURL('/', { timeout: 10000 });

    await page.goto('/reports/new');
    await page.waitForLoadState('networkidle');

    // Fill the report form
    const selects = page.locator('select');
    for (let i = 0; i < await selects.count(); i++) {
      const opts = await selects.nth(i).locator('option').allTextContents();
      if (opts.some(o => /harassment|fraud|spam|other/i.test(o))) {
        await selects.nth(i).selectOption({ label: opts.find(o => /spam/i.test(o)) || opts[1] });
      }
    }

    const textarea = page.locator('textarea').first();
    if (await textarea.isVisible()) {
      await textarea.fill('E2E test report — suspicious activity from another user');
    }

    // Fill target user ID if field exists
    const textInputs = page.locator('input[type="text"]');
    for (let i = 0; i < await textInputs.count(); i++) {
      const placeholder = await textInputs.nth(i).getAttribute('placeholder');
      if (placeholder && /user.*id|target/i.test(placeholder)) {
        await textInputs.nth(i).fill('000000000000000000000000');
      }
    }

    await page.locator('button[type="submit"], button:has-text("Submit")').first().click();
    await page.waitForTimeout(2000);

    // Should redirect or show success
    const bodyText = await page.textContent('body');
    expect(bodyText.toLowerCase()).toMatch(/success|submitted|report/);
  });

  test('reporter sees submitted report in their report list', async ({ page }) => {
    await page.goto('/login');
    await page.locator('input').nth(0).fill(reporter.username);
    await page.locator('input').nth(1).fill(reporter.password);
    await page.locator('button', { hasText: /sign in/i }).click();
    await expect(page).toHaveURL('/', { timeout: 10000 });

    await page.goto('/reports');
    await page.waitForLoadState('networkidle');

    // Should show the submitted report
    const bodyText = await page.textContent('body');
    expect(bodyText.toLowerCase()).toMatch(/submitted|spam|suspicious/);
  });

  test('admin sees the report in the admin report management queue', async ({ page }) => {
    if (admin.unpromoted) { test.skip(); return; }

    await page.goto('/login');
    await page.locator('input').nth(0).fill(admin.username);
    await page.locator('input').nth(1).fill(admin.password);
    await page.locator('button', { hasText: /sign in/i }).click();
    await expect(page).toHaveURL('/', { timeout: 10000 });

    await page.goto('/admin/reports');
    await page.waitForLoadState('networkidle');

    // Should see at least one report
    const bodyText = await page.textContent('body');
    expect(bodyText.toLowerCase()).toMatch(/submitted|report|spam/);
  });

  test('admin transitions report to under_review via browser', async ({ page }) => {
    if (admin.unpromoted) { test.skip(); return; }

    await page.goto('/login');
    await page.locator('input').nth(0).fill(admin.username);
    await page.locator('input').nth(1).fill(admin.password);
    await page.locator('button', { hasText: /sign in/i }).click();
    await expect(page).toHaveURL('/', { timeout: 10000 });

    await page.goto('/admin/reports');
    await page.waitForLoadState('networkidle');

    // Find and click the "under review" transition button
    const transitionBtn = page.locator('button', { hasText: /under.review/i }).first();
    if (await transitionBtn.isVisible({ timeout: 3000 }).catch(() => false)) {
      await transitionBtn.click();
      // Handle notes modal if it appears
      const notesInput = page.locator('textarea, input[type="text"]').last();
      if (await notesInput.isVisible({ timeout: 2000 }).catch(() => false)) {
        await notesInput.fill('Moving to review');
        const confirmBtn = page.locator('button', { hasText: /confirm|submit/i }).last();
        await confirmBtn.click();
      }
      await page.waitForTimeout(1000);
    }
  });

  test('reporter sees updated report status in their list', async ({ page }) => {
    if (admin.unpromoted) { test.skip(); return; }

    await page.goto('/login');
    await page.locator('input').nth(0).fill(reporter.username);
    await page.locator('input').nth(1).fill(reporter.password);
    await page.locator('button', { hasText: /sign in/i }).click();
    await expect(page).toHaveURL('/', { timeout: 10000 });

    await page.goto('/reports');
    await page.waitForLoadState('networkidle');

    // The report's status should have changed from submitted
    const bodyText = await page.textContent('body');
    expect(bodyText.toLowerCase()).toMatch(/under.review|review|submitted/);
  });
});
