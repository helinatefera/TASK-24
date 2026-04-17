// @ts-check
const { test, expect } = require('@playwright/test');

const ts = Date.now();
const alumni = { username: `e2eAlum_${ts}`, email: `e2ea${ts}@test.com`, password: 'E2eAlum12!' };

test.describe('Browser E2E: Job Creation → List → Detail', () => {
  test.beforeAll(async ({ browser }) => {
    // Register the alumni user via the UI
    const page = await browser.newPage({ ignoreHTTPSErrors: true });
    await page.goto('/register');
    await page.fill('input[type="text"]', alumni.username);
    await page.locator('input[type="email"]').fill(alumni.email);
    await page.locator('input[type="password"]').fill(alumni.password);
    // Select alumni role if role selector exists
    const roleSelect = page.locator('select');
    if (await roleSelect.isVisible()) {
      await roleSelect.selectOption('alumni');
    }
    await page.locator('button', { hasText: /register|sign up|create account/i }).click();
    await expect(page).toHaveURL('/', { timeout: 10000 });
    await page.close();
  });

  test('create job via UI and verify it appears in job list', async ({ page }) => {
    // Login
    await page.goto('/login');
    const inputs = page.locator('input');
    await inputs.nth(0).fill(alumni.username);
    await inputs.nth(1).fill(alumni.password);
    await page.locator('button', { hasText: /sign in|log in/i }).click();
    await expect(page).toHaveURL('/', { timeout: 10000 });

    // Navigate to job creation
    await page.goto('/jobs/create');
    await expect(page.locator('h1, h2', { hasText: /create.*job/i })).toBeVisible({ timeout: 5000 });

    // Fill job form
    await page.locator('input[type="text"]').first().fill('E2E Browser Test Job');
    const textareas = page.locator('textarea');
    if (await textareas.count() > 0) {
      await textareas.first().fill('Created through real browser interaction');
    }

    // Select event type if dropdown exists
    const selects = page.locator('select');
    const selectCount = await selects.count();
    for (let i = 0; i < selectCount; i++) {
      const options = await selects.nth(i).locator('option').allTextContents();
      if (options.some(o => /event/i.test(o))) {
        await selects.nth(i).selectOption({ label: options.find(o => /event/i.test(o)) });
      }
      if (options.some(o => /hourly/i.test(o))) {
        await selects.nth(i).selectOption({ label: options.find(o => /hourly/i.test(o)) });
      }
    }

    // Fill rate fields
    const numberInputs = page.locator('input[type="number"]');
    const numCount = await numberInputs.count();
    if (numCount >= 1) await numberInputs.nth(0).fill('50');
    if (numCount >= 2) await numberInputs.nth(1).fill('100');

    // Submit
    await page.locator('button[type="submit"], button:has-text("Create")').first().click();

    // Should redirect to job detail or job list
    await page.waitForURL(/\/jobs\//, { timeout: 10000 });

    // Navigate to job list and verify the job appears
    await page.goto('/jobs');
    await expect(page.locator('text=E2E Browser Test Job')).toBeVisible({ timeout: 5000 });
  });

  test('job detail page loads with correct structure', async ({ page }) => {
    // Login
    await page.goto('/login');
    const inputs = page.locator('input');
    await inputs.nth(0).fill(alumni.username);
    await inputs.nth(1).fill(alumni.password);
    await page.locator('button', { hasText: /sign in|log in/i }).click();
    await expect(page).toHaveURL('/', { timeout: 10000 });

    // Go to jobs list and click the first job
    await page.goto('/jobs');
    await page.locator('a', { hasText: /E2E Browser Test Job/i }).first().click();

    // Job detail page should show tabs and key fields
    await expect(page.locator('text=Details')).toBeVisible({ timeout: 5000 });
    await expect(page.locator('text=Messages')).toBeVisible();
    await expect(page.locator('text=E2E Browser Test Job')).toBeVisible();
  });
});

test.describe('Browser E2E: Report flow', () => {
  test('report list shows "New Report" link to /reports/new', async ({ page }) => {
    // Login
    await page.goto('/login');
    const inputs = page.locator('input');
    await inputs.nth(0).fill(alumni.username);
    await inputs.nth(1).fill(alumni.password);
    await page.locator('button', { hasText: /sign in|log in/i }).click();
    await expect(page).toHaveURL('/', { timeout: 10000 });

    await page.goto('/reports');
    const newReportLink = page.locator('a', { hasText: /new report/i });
    await expect(newReportLink).toBeVisible({ timeout: 5000 });
    await expect(newReportLink).toHaveAttribute('href', '/reports/new');

    // Click it — should navigate to the create page, not 404
    await newReportLink.click();
    await expect(page.locator('text=Page not found')).not.toBeVisible({ timeout: 3000 });
  });
});
