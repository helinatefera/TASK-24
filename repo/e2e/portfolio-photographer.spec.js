// @ts-check
const { test, expect } = require('@playwright/test');

/**
 * Multi-role E2E: Photographer portfolio + directory flow
 *
 * Photographer creates portfolio → alumni browses photographer directory →
 * views portfolio.
 */

const ts = Date.now();
const photog = { username: `e2ePort_${ts}`, email: `e2epo${ts}@test.com`, password: 'E2ePort123!' };
const alumni = { username: `e2eDir_${ts}`, email: `e2ed${ts}@test.com`, password: 'E2eDir1234!' };

async function register(page, u, role = 'alumni') {
  await page.goto('/register');
  await page.fill('input[type="text"]', u.username);
  await page.locator('input[type="email"]').fill(u.email);
  await page.locator('input[type="password"]').fill(u.password);
  const roleSelect = page.locator('select');
  if (await roleSelect.isVisible({ timeout: 1000 }).catch(() => false)) await roleSelect.selectOption(role);
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

test.describe('Multi-role: Portfolio & Photographer Directory', () => {
  test.describe.configure({ mode: 'serial' });

  test('photographer registers and creates a portfolio', async ({ page }) => {
    await register(page, photog, 'photographer');
    await page.goto('/portfolios');
    await expect(page.locator('h1, h2', { hasText: /portfolio/i })).toBeVisible({ timeout: 5000 });

    // Look for create/upload button
    const createBtn = page.locator('a, button', { hasText: /create|upload|new/i }).first();
    if (await createBtn.isVisible({ timeout: 2000 }).catch(() => false)) {
      await createBtn.click();
      await page.waitForLoadState('networkidle');
    }
  });

  test('photographer sees portfolio upload page', async ({ page }) => {
    await login(page, photog);
    await page.goto('/portfolio/upload');
    await page.waitForLoadState('networkidle');
    const text = await page.textContent('body');
    expect(text.toLowerCase()).toMatch(/portfolio|upload|create/);
  });

  test('alumni registers and browses photographer directory', async ({ page }) => {
    await register(page, alumni);
    await page.goto('/photographer-directory');
    await page.waitForLoadState('networkidle');
    const text = await page.textContent('body');
    expect(text.toLowerCase()).toMatch(/photographer|directory/);
  });

  test('alumni can view consent history page', async ({ page }) => {
    await login(page, alumni);
    await page.goto('/consent/history');
    await page.waitForLoadState('networkidle');
    const text = await page.textContent('body');
    expect(text.toLowerCase()).toMatch(/policy|history|consent/);
  });

  test('escrow ledger page loads for a job owner', async ({ page }) => {
    await login(page, alumni);
    // Create a quick job to test escrow page
    await page.goto('/jobs/create');
    await page.locator('input[type="text"]').first().fill(`Escrow Test ${ts}`);
    const textareas = page.locator('textarea');
    if (await textareas.count() > 0) await textareas.first().fill('Testing escrow page');
    const selects = page.locator('select');
    for (let i = 0; i < await selects.count(); i++) {
      const opts = await selects.nth(i).locator('option').allTextContents();
      if (opts.some(o => /event/i.test(o))) await selects.nth(i).selectOption({ label: opts.find(o => /event/i.test(o)) });
      if (opts.some(o => /hourly/i.test(o))) await selects.nth(i).selectOption({ label: opts.find(o => /hourly/i.test(o)) });
    }
    const numInputs = page.locator('input[type="number"]');
    if (await numInputs.count() >= 1) await numInputs.nth(0).fill('50');
    if (await numInputs.count() >= 2) await numInputs.nth(1).fill('100');
    await page.locator('button[type="submit"], button:has-text("Create")').first().click();
    await page.waitForURL(/\/jobs\//, { timeout: 10000 });

    // Navigate to escrow page for this job
    const url = page.url();
    const jobPath = url.match(/\/jobs\/[a-f0-9]+/)?.[0];
    if (jobPath) {
      await page.goto(jobPath + '/escrow');
      await page.waitForLoadState('networkidle');
      const text = await page.textContent('body');
      expect(text.toLowerCase()).toMatch(/escrow|ledger|balance/);
    }
  });
});
