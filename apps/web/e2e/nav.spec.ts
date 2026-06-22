import { expect, test } from '@playwright/test';

// Authenticated shell + key screens load (uses the saved owner session). Read-only:
// proves auth (no redirect to /login), the app shell, and the main screens render
// against Cloud dev.
test('authenticated shell and core screens load', async ({ page }) => {
  await page.goto('/inicio');
  await expect(page).toHaveURL(/\/inicio/); // authed → not bounced to /login

  await page.goto('/empresas');
  // 'Nova empresa' appears in the header and (when empty) the empty-state CTA.
  await expect(page.getByRole('link', { name: 'Nova empresa' }).first()).toBeVisible();

  await page.goto('/documentos');
  await expect(page.getByRole('link', { name: 'Exportar lote' })).toBeVisible();

  await page.goto('/excecoes');
  await expect(page.getByText('Filtros')).toBeVisible();
});
