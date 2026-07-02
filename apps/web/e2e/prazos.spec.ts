import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

import { type SupabaseClient, createClient } from '@supabase/supabase-js';
import { expect, test } from '@playwright/test';

// Global deadlines screen (Prazos). Seeds a company + an overdue monitored document via
// the service role; the screen (default "attention" view) must list it as Vencido with
// the status recomputed from the past due date. Cleans up.

const FIRM = '11111111-1111-4111-8111-111111111111';
const dbEnv = readFileSync(resolve(process.cwd(), '../../packages/db/.env'), 'utf8');
const get = (k: string) => new RegExp(`^${k}=(.*)$`, 'm').exec(dbEnv)?.[1]?.trim() ?? '';
const SUPABASE_URL = get('SUPABASE_URL');
const SERVICE = get('SUPABASE_SERVICE_ROLE_KEY');

const stamp = Date.now();
const COMPANY = `ZZ Prazos E2E ${stamp}`;
const CNPJ = ('998' + stamp).slice(0, 14);

test.describe('prazos (global)', () => {
  let service: SupabaseClient;
  let companyId = '';

  test.beforeAll(async () => {
    service = createClient(SUPABASE_URL, SERVICE, { auth: { persistSession: false } });
    const { data: company, error } = await service
      .from('companies')
      .insert({ firm_id: FIRM, cnpj: CNPJ, legal_name: COMPANY })
      .select('id')
      .single();
    if (error) throw error;
    companyId = (company as { id: string }).id;

    const yesterday = new Date(stamp - 86_400_000).toISOString().slice(0, 10);
    const { error: mdErr } = await service.from('monitored_documents').insert({
      firm_id: FIRM,
      company_id: companyId,
      doc_kind: 'cnd',
      due_date: yesterday,
      trigger_days: 30,
      status: 'valid', // deliberately stale — the screen recomputes to overdue
    });
    if (mdErr) throw mdErr;
  });

  test.afterAll(async () => {
    if (service && companyId) {
      await service.from('monitored_documents').delete().eq('company_id', companyId);
      await service.from('companies').delete().eq('id', companyId);
    }
  });

  test('lists an overdue deadline across companies as Vencido', async ({ page }) => {
    await page.goto('/prazos');
    await expect(page.getByText(COMPANY)).toBeVisible();
    await expect(page.getByText('Vencido').first()).toBeVisible();
  });
});
