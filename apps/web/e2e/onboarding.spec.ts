import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

import { type SupabaseClient, createClient } from '@supabase/supabase-js';
import { expect, test } from '@playwright/test';

// T23 flow: spreadsheet onboarding → preview → confirm → companies listed. Drives the
// import wizard UI end to end (CSV with two valid CNPJs). No worker required for the
// import itself (confirmImport also enqueues enrichment as a side effect; teardown
// cleans the companies and any enrichment exceptions they spawn). Authed (chromium).

const FIRM_A = '11111111-1111-4111-8111-111111111111';
const CNPJS = ['11222333000181', '11444777000161'];
const CSV = [
  'CNPJ,Razão Social,Nome Fantasia',
  `${CNPJS[0]},Alpha Importada LTDA,Alpha`,
  `${CNPJS[1]},Beta Importada LTDA,Beta`,
  '',
].join('\n');

const dbEnv = readFileSync(resolve(process.cwd(), '../../packages/db/.env'), 'utf8');
const get = (k: string) => new RegExp(`^${k}=(.*)$`, 'm').exec(dbEnv)?.[1]?.trim() ?? '';
const SUPABASE_URL = get('SUPABASE_URL');
const SERVICE = get('SUPABASE_SERVICE_ROLE_KEY');

test.describe('spreadsheet onboarding', () => {
  let service: SupabaseClient;

  async function purge() {
    const { data: cos } = await service
      .from('companies')
      .select('id')
      .eq('firm_id', FIRM_A)
      .in('cnpj', CNPJS);
    const ids = (cos ?? []).map((c) => c.id as string);
    for (const id of ids) {
      // Drop enrichment exceptions these companies may have spawned, then the company.
      const { data: excs } = await service
        .from('exception_queue')
        .select('id, context')
        .eq('firm_id', FIRM_A)
        .eq('source', 'enrichment');
      for (const e of excs ?? []) {
        if ((e.context as { company_id?: string })?.company_id === id) {
          await service.from('exception_queue').delete().eq('id', e.id);
        }
      }
      await service.from('companies').delete().eq('id', id);
    }
  }

  test.beforeAll(async () => {
    service = createClient(SUPABASE_URL, SERVICE, { auth: { persistSession: false } });
    await purge();
  });
  test.afterAll(async () => {
    await purge();
  });

  test('import CSV → preview → confirm → companies listed', async ({ page }) => {
    await page.goto('/empresas/importar');

    await page.locator('input#file').setInputFiles({
      name: 'empresas.csv',
      mimeType: 'text/csv',
      buffer: Buffer.from(CSV, 'utf8'),
    });
    await page.getByRole('button', { name: /Analisar/ }).click();

    // Preview: both rows are valid ("2 prontas").
    await expect(page.getByText('prontas')).toBeVisible();
    await expect(page.getByText('2', { exact: true }).first()).toBeVisible();

    // Confirm import (button reads "Importar 2").
    await page.getByRole('button', { name: /^Importar/ }).click();

    // Result screen.
    await expect(page.getByText('empresas importadas')).toBeVisible();
    await expect(page.getByRole('link', { name: 'Ver empresas' })).toBeVisible();

    // The imported companies show in the registry (rows show the trade name + CNPJ).
    await page.goto('/empresas');
    await expect(page.getByText('11.222.333/0001-81')).toBeVisible();
  });
});
