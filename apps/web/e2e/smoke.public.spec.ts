import { expect, test } from '@playwright/test';

// Harness smoke (no auth, no data): the login page renders. Validates that the dev
// server is up and the browser drives it. Tagged .public so it runs without auth.
test('login page renders', async ({ page }) => {
  await page.goto('/login');
  await expect(page.locator('input#email')).toBeVisible();
  await expect(page.locator('input#password')).toBeVisible();
});
