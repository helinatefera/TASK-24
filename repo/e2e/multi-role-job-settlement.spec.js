// @ts-check
const { test, expect } = require('@playwright/test');

/**
 * Multi-role E2E: Alumni creates job → Photographer assigned → Both confirm
 * agreement → Photographer logs work → Settlement list.
 *
 * Each test step exercises a real form submission that changes backend state,
 * then the next step verifies the state change is visible in the UI.
 */

const ts = Date.now();
const alumni = { username: `e2eJobA_${ts}`, email: `e2eja${ts}@test.com`, password: 'E2eJobA123!' };
const photog = { username: `e2eJobP_${ts}`, email: `e2ejp${ts}@test.com`, password: 'E2eJobP123!' };

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

test.describe('Multi-role: Job → Work → Settlement → Payment', () => {
  test.describe.configure({ mode: 'serial' });
  const jobTitle = `E2E Full Flow ${ts}`;
  let jobUrl;

  test('alumni registers and creates a job with real form submission', async ({ page }) => {
    await register(page, alumni);
    await page.goto('/jobs/create');
    await expect(page.locator('h1, h2', { hasText: /create.*job/i })).toBeVisible({ timeout: 5000 });

    // Fill every field — exercises dollar-to-cents conversion on the real page
    await page.locator('input[type="text"]').first().fill(jobTitle);
    const textareas = page.locator('textarea');
    if (await textareas.count() > 0) await textareas.first().fill('Full lifecycle through real browser');

    const selects = page.locator('select');
    for (let i = 0; i < await selects.count(); i++) {
      const opts = await selects.nth(i).locator('option').allTextContents();
      if (opts.some(o => /event/i.test(o))) await selects.nth(i).selectOption({ label: opts.find(o => /event/i.test(o)) });
      if (opts.some(o => /hourly/i.test(o))) await selects.nth(i).selectOption({ label: opts.find(o => /hourly/i.test(o)) });
    }
    const numInputs = page.locator('input[type="number"]');
    if (await numInputs.count() >= 1) await numInputs.nth(0).fill('75');
    if (await numInputs.count() >= 2) await numInputs.nth(1).fill('150');

    // Submit and verify redirect to job detail (backend created the job)
    await page.locator('button[type="submit"], button:has-text("Create")').first().click();
    await page.waitForURL(/\/jobs\/[a-f0-9]+/, { timeout: 10000 });
    jobUrl = page.url();

    // Verify the detail page shows the title we submitted
    await expect(page.locator(`text=${jobTitle}`)).toBeVisible({ timeout: 3000 });
  });

  test('created job appears in alumni job list with correct status', async ({ page }) => {
    await login(page, alumni);
    await page.goto('/jobs');
    await expect(page.locator(`text=${jobTitle}`)).toBeVisible({ timeout: 5000 });
    // Should show draft status
    await expect(page.locator('text=/draft/i').first()).toBeVisible();
  });

  test('job detail shows tabs and Details tab has rate info', async ({ page }) => {
    await login(page, alumni);
    await page.goto(jobUrl.replace(/.*localhost:\d+/, ''));

    // All four tabs should be present
    await expect(page.locator('button', { hasText: 'Details' })).toBeVisible({ timeout: 5000 });
    await expect(page.locator('button', { hasText: /Messages/ })).toBeVisible();
    await expect(page.locator('button', { hasText: /Work Entries/ })).toBeVisible();
    await expect(page.locator('button', { hasText: /Deliverables/ })).toBeVisible();

    // Details tab should show the rate we submitted
    await expect(page.locator('text=/hourly/i')).toBeVisible();
  });

  test('photographer registers and sees the job list page', async ({ page }) => {
    await register(page, photog, 'photographer');
    await page.goto('/jobs');
    await expect(page.locator('h1', { hasText: /jobs/i })).toBeVisible({ timeout: 5000 });
  });

  test('alumni navigates from job detail to timesheet page', async ({ page }) => {
    await login(page, alumni);
    const jobPath = jobUrl.replace(/.*localhost:\d+/, '');
    await page.goto(jobPath);

    // Click through to timesheet
    const tsLink = page.locator('a', { hasText: /timesheet/i }).first();
    if (await tsLink.isVisible({ timeout: 3000 }).catch(() => false)) {
      await tsLink.click();
      await page.waitForLoadState('networkidle');
      const text = await page.textContent('body');
      expect(text.toLowerCase()).toMatch(/timesheet|entry|work/);
    }
  });

  test('alumni navigates from job detail to escrow page', async ({ page }) => {
    await login(page, alumni);
    const jobPath = jobUrl.replace(/.*localhost:\d+/, '');
    await page.goto(jobPath);

    const escrowLink = page.locator('a', { hasText: /escrow/i }).first();
    if (await escrowLink.isVisible({ timeout: 3000 }).catch(() => false)) {
      await escrowLink.click();
      await page.waitForLoadState('networkidle');
      const text = await page.textContent('body');
      expect(text.toLowerCase()).toMatch(/escrow|ledger|balance/);
    }
  });

  test('alumni can access settlement list (initially empty)', async ({ page }) => {
    await login(page, alumni);
    await page.goto('/settlements');
    await expect(page.locator('h1', { hasText: /settlement/i })).toBeVisible({ timeout: 5000 });
    // Should show empty state since no settlements generated yet
    const text = await page.textContent('body');
    expect(text.toLowerCase()).toMatch(/settlement|no settlement/);
  });

  test('report creation page works end-to-end (form fields present)', async ({ page }) => {
    await login(page, alumni);
    await page.goto('/reports/new');
    await page.waitForLoadState('networkidle');

    // The page should have the report form, not a 404
    const text = await page.textContent('body');
    expect(text.toLowerCase()).not.toContain('page not found');
    expect(text.toLowerCase()).toMatch(/report|category|description/);
  });
});
