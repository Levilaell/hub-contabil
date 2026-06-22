import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

import { createDocumentRequest } from '@hub/db';
import { type SupabaseClient, createClient } from '@supabase/supabase-js';
import { expect, test } from '@playwright/test';

// Real acceptance flow (T23): request → public link → viewed. Setup runs in Node via
// Supabase clients (service to seed a company, owner to create the request + mint the
// token); the BROWSER visits the public /s/{token} page as an anonymous visitor and the
// page's view-logger transitions the request to 'viewed'. Worker-independent. Runs under
// the `public` project (no stored session) — matching a real end client. Cleans up.

const FIRM_A = '11111111-1111-4111-8111-111111111111';
const CNPJ = '77000000000077';
const TITLE = 'E2E: envie o contrato social';

// The anon/service keys live in packages/db/.env (not the web .env.local). Playwright
// runs with cwd = apps/web (the config dir), so the repo root is two levels up.
const dbEnv = readFileSync(resolve(process.cwd(), '../../packages/db/.env'), 'utf8');
const get = (k: string) => new RegExp(`^${k}=(.*)$`, 'm').exec(dbEnv)?.[1]?.trim() ?? '';
const SUPABASE_URL = get('SUPABASE_URL');
const ANON = get('SUPABASE_ANON_KEY');
const SERVICE = get('SUPABASE_SERVICE_ROLE_KEY');
const PASSWORD = process.env.SEED_PASSWORD || get('SEED_PASSWORD') || 'hub-dev-2026!';

test.describe('request → public link → viewed', () => {
  let service: SupabaseClient;
  let owner: SupabaseClient;
  let companyId = '';
  let requestId = '';
  let token = '';

  test.beforeAll(async () => {
    service = createClient(SUPABASE_URL, SERVICE, { auth: { persistSession: false } });
    const { data: co, error } = await service
      .from('companies')
      .upsert({ firm_id: FIRM_A, cnpj: CNPJ, legal_name: 'E2E Requests Co' }, { onConflict: 'firm_id,cnpj' })
      .select('id')
      .single();
    if (error) throw error;
    companyId = co.id as string;

    owner = createClient(SUPABASE_URL, ANON, { auth: { persistSession: false } });
    const { error: signIn } = await owner.auth.signInWithPassword({
      email: 'owner@demo.test',
      password: PASSWORD,
    });
    if (signIn) throw signIn;

    const created = await createDocumentRequest(owner, {
      companyId,
      kind: 'upload_request',
      title: TITLE,
      expiryDays: 7,
    });
    if (!created.ok) throw new Error('failed to create request');
    requestId = created.id;
    token = created.token;
  });

  test.afterAll(async () => {
    if (service && requestId) {
      await service.from('document_request_events').delete().eq('request_id', requestId);
      await service.from('document_requests').delete().eq('id', requestId);
    }
    if (service && companyId) await service.from('companies').delete().eq('id', companyId);
    // 'local' scope only — a global signOut would revoke the owner session that the
    // authenticated specs (storageState) rely on.
    if (owner) await owner.auth.signOut({ scope: 'local' });
  });

  test('opening the public link marks the request viewed', async ({ page }) => {
    const status = async () =>
      (
        await service.from('document_requests').select('status').eq('id', requestId).single()
      ).data?.status;

    expect(await status()).toBe('requested');

    await page.goto(`/s/${token}`);
    await expect(page.getByText(TITLE)).toBeVisible();

    // The page's view-logger fires on mount → status transitions to 'viewed'.
    await expect.poll(status, { timeout: 15_000 }).toBe('viewed');
  });
});
