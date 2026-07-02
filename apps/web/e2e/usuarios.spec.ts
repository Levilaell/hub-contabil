import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

import { type SupabaseClient, createClient } from '@supabase/supabase-js';
import { expect, test } from '@playwright/test';

// User management (Configurações → Usuários). The owner creates a staff user through
// the UI; the Admin-API server action provisions the auth user + profile + department,
// shows a temp password, and the new user appears in the list. Cleans up the auth user
// (cascades profile + departments) via the service role.

const dbEnv = readFileSync(resolve(process.cwd(), '../../packages/db/.env'), 'utf8');
const get = (k: string) => new RegExp(`^${k}=(.*)$`, 'm').exec(dbEnv)?.[1]?.trim() ?? '';
const SUPABASE_URL = get('SUPABASE_URL');
const SERVICE = get('SUPABASE_SERVICE_ROLE_KEY');

const EMAIL = `zz-teste-${Date.now()}@demo.test`;

test.describe('gestão de usuários', () => {
  let service: SupabaseClient;

  async function removeByEmail(email: string) {
    const { data } = await service.auth.admin.listUsers({ page: 1, perPage: 200 });
    const u = data.users.find((x) => x.email === email);
    if (u) await service.auth.admin.deleteUser(u.id); // cascades public.users + user_departments
  }

  test.beforeAll(async () => {
    service = createClient(SUPABASE_URL, SERVICE, { auth: { persistSession: false } });
    await removeByEmail(EMAIL);
  });

  test.afterAll(async () => {
    if (service) await removeByEmail(EMAIL);
  });

  test('owner creates a staff user through the UI', async ({ page }) => {
    await page.goto('/usuarios');

    await page.locator('input[name="fullName"]').fill('ZZ Colaborador Teste');
    await page.locator('input[name="email"]').fill(EMAIL);
    await page.locator('select[name="role"]').selectOption('staff');
    await page.locator('input[type="checkbox"][name="departments"]').first().check();

    await page.getByRole('button', { name: 'Criar usuário' }).click();

    // Temp password shown once + the new user listed.
    await expect(page.getByText('Usuário criado ✅')).toBeVisible();
    await expect(page.getByText(EMAIL)).toBeVisible();

    // And it really exists in auth with the firm stamped.
    await expect
      .poll(async () => {
        const { data } = await service.auth.admin.listUsers({ page: 1, perPage: 200 });
        return data.users.find((u) => u.email === EMAIL)?.app_metadata?.role ?? null;
      })
      .toBe('staff');
  });
});
