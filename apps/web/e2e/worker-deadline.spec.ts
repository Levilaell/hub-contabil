import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

import { type SupabaseClient, createClient } from '@supabase/supabase-js';
import { expect, test } from '@playwright/test';

// T23 worker flow: deadline → overdue → task. Triggers the deadline sweep — the exact
// job the `deadlines-daily` cron runs on schedule — via the worker ops script (run in a
// subprocess so `postgres` stays out of the Playwright bundle), deterministically (no
// waiting on 06:00). Verifies the auto-created "Renovar …" task in the UI and asserts
// idempotency: running the sweep twice still yields exactly one task. No LLM.

const WORKER_DIR = resolve(process.cwd(), '../../apps/worker');
function runSweep() {
  execFileSync('node', ['--env-file=.env', '--import', 'tsx', 'ops-deadline-sweep.mjs'], {
    cwd: WORKER_DIR,
    stdio: 'pipe',
  });
}

function addDaysToday(n: number): string {
  const d = new Date();
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
}

const FIRM_A = '11111111-1111-4111-8111-111111111111';
const CNPJ = '77000000000099';
const COMPANY = 'E2E Deadline Co';
const TITLE = 'Renovar CND Federal (RFB/PGFN) — E2E Deadline Co';

const dbEnv = readFileSync(resolve(process.cwd(), '../../packages/db/.env'), 'utf8');
const get = (src: string, k: string) => new RegExp(`^${k}=(.*)$`, 'm').exec(src)?.[1]?.trim() ?? '';
const SUPABASE_URL = get(dbEnv, 'SUPABASE_URL');
const SERVICE = get(dbEnv, 'SUPABASE_SERVICE_ROLE_KEY');

test.describe('deadline → overdue → task', () => {
  let service: SupabaseClient;
  let companyId = '';
  let monitoredId = '';

  test.beforeAll(async () => {
    service = createClient(SUPABASE_URL, SERVICE, { auth: { persistSession: false } });

    const { data: co, error } = await service
      .from('companies')
      .upsert({ firm_id: FIRM_A, cnpj: CNPJ, legal_name: COMPANY }, { onConflict: 'firm_id,cnpj' })
      .select('id')
      .single();
    if (error) throw error;
    companyId = co.id as string;

    // Stale cache: due_date in the past but stored status 'valid' → the sweep recomputes
    // to overdue (a real transition) and creates the renewal task.
    const { data: md } = await service
      .from('monitored_documents')
      .insert({
        firm_id: FIRM_A,
        company_id: companyId,
        doc_kind: 'cnd_federal',
        due_date: addDaysToday(-10),
        trigger_days: 30,
        status: 'valid',
      })
      .select('id')
      .single();
    monitoredId = md!.id as string;
  });

  test.afterAll(async () => {
    if (service && monitoredId) {
      await service.from('tasks').delete().eq('monitored_document_id', monitoredId);
      await service.from('monitored_documents').delete().eq('id', monitoredId);
    }
    if (service && companyId) await service.from('companies').delete().eq('id', companyId);
  });

  test('overdue sweep creates the renewal task (once) and it shows in the UI', async ({ page }) => {
    runSweep(); // overdue transition → creates the "Renovar …" task
    runSweep(); // idempotent: no transition the second time → no duplicate

    const { count } = await service
      .from('tasks')
      .select('id', { count: 'exact', head: true })
      .eq('monitored_document_id', monitoredId);
    expect(count).toBe(1);

    await page.goto('/tarefas?view=all');
    await expect(page.getByText(TITLE)).toBeVisible();
  });
});
