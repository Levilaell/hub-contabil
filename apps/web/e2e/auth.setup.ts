import { test as setup } from '@playwright/test';

// Logs in as the seeded owner and saves the session for the authenticated specs.
// Password defaults to the dev seed value (override via SEED_PASSWORD).
const AUTH_FILE = 'e2e/.auth/owner.json';

setup('authenticate as owner', async ({ page }) => {
  await page.goto('/login');
  await page.locator('input#email').fill('owner@demo.test');
  await page.locator('input#password').fill(process.env.SEED_PASSWORD ?? 'hub-dev-2026!');
  await page.getByRole('button').click();
  await page.waitForURL('**/inicio', { timeout: 30_000 });
  await page.context().storageState({ path: AUTH_FILE });
});
