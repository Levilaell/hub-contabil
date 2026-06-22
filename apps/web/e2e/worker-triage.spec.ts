import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

import { buildInboxPath, enqueueTriage } from '@hub/db';
import { type SupabaseClient, createClient } from '@supabase/supabase-js';
import { expect, test } from '@playwright/test';

// T23 worker flow: upload (inbox) → triage → exception → resolution. Exercises the
// RUNNING worker via the real `triage` pgmq queue. Uses an NF-e XML whose issuer CNPJ
// matches NO company → deterministic 'company_not_found' exception, NO LLM cost. Setup
// in Node (service seeds the inbox doc + file; owner enqueues); the BROWSER resolves the
// exception on /excecoes. Requires `pnpm --filter @hub/worker dev` running. Cleans up.

const FIRM_A = '11111111-1111-4111-8111-111111111111';
const UNKNOWN_CNPJ = '99999999000191'; // intentionally unregistered
const HASH = 'e2etriagehash000000000001';

const dbEnv = readFileSync(resolve(process.cwd(), '../../packages/db/.env'), 'utf8');
const get = (k: string) => new RegExp(`^${k}=(.*)$`, 'm').exec(dbEnv)?.[1]?.trim() ?? '';
const SUPABASE_URL = get('SUPABASE_URL');
const ANON = get('SUPABASE_ANON_KEY');
const SERVICE = get('SUPABASE_SERVICE_ROLE_KEY');
const PASSWORD = process.env.SEED_PASSWORD || get('SEED_PASSWORD') || 'hub-dev-2026!';

const XML = `<?xml version="1.0"?><nfeProc xmlns="http://www.portalfiscal.inf.br/nfe"><NFe><infNFe Id="NFe35200199999999000191550010000000031000000017"><emit><CNPJ>${UNKNOWN_CNPJ}</CNPJ></emit><det nItem="1"><prod><CFOP>5102</CFOP></prod></det></infNFe></NFe></nfeProc>`;

test.describe('upload → triage → exception → resolution', () => {
  let service: SupabaseClient;
  let owner: SupabaseClient;
  let docId = '';
  const path = buildInboxPath(FIRM_A, HASH, 'e2e-triage.xml');

  test.beforeAll(async () => {
    service = createClient(SUPABASE_URL, SERVICE, { auth: { persistSession: false } });
    owner = createClient(SUPABASE_URL, ANON, { auth: { persistSession: false } });
    const { error: signIn } = await owner.auth.signInWithPassword({
      email: 'owner@demo.test',
      password: PASSWORD,
    });
    if (signIn) throw signIn;

    // Hygiene: clear stale open triage exceptions so the one we create is unambiguous.
    const { data: stale } = await service
      .from('exception_queue')
      .select('id')
      .eq('firm_id', FIRM_A)
      .eq('source', 'triage')
      .eq('status', 'open');
    for (const r of stale ?? []) await service.from('exception_queue').delete().eq('id', r.id);

    await service.storage
      .from('documents')
      .upload(path, new TextEncoder().encode(XML), { contentType: 'application/xml', upsert: true });
    const { data: doc, error } = await service
      .from('documents')
      .insert({
        firm_id: FIRM_A,
        company_id: null,
        doc_type: 'other',
        storage_path: path,
        source: 'triage',
        hash: HASH,
        file_name: 'e2e-triage.xml',
      })
      .select('id')
      .single();
    if (error) throw error;
    docId = doc.id as string;

    const enq = await enqueueTriage(owner, docId);
    if (!enq.ok) throw new Error('enqueue failed');
  });

  test.afterAll(async () => {
    if (service) {
      await service.from('exception_queue').delete().eq('firm_id', FIRM_A).eq('source', 'triage');
      await service.from('documents').delete().eq('id', docId); // cascades classifications
      await service.storage.from('documents').remove([path]);
    }
    if (owner) await owner.auth.signOut({ scope: 'local' });
  });

  test('worker raises a triage exception; user resolves it in the UI', async ({ page }) => {
    // The running worker consumes the triage queue and raises the exception.
    const exceptionRow = async () =>
      (
        await service
          .from('exception_queue')
          .select('id, status, context')
          .eq('firm_id', FIRM_A)
          .eq('source', 'triage')
          .eq('status', 'open')
      ).data ?? [];

    await expect
      .poll(async () => (await exceptionRow()).length, { timeout: 45_000, intervals: [1000] })
      .toBe(1);
    const exc = (await exceptionRow())[0];
    expect((exc?.context as { reason?: string })?.reason).toBe('company_not_found');

    // Resolve it through the UI. The list row is a <button> (not the filter <option>
    // that also reads "Triagem (IA)").
    await page.goto('/excecoes');
    await page.getByRole('button').filter({ hasText: 'Triagem (IA)' }).first().click();
    await page.getByRole('button', { name: 'Resolver' }).click();

    await expect
      .poll(
        async () =>
          (
            await service.from('exception_queue').select('status').eq('id', exc!.id).single()
          ).data?.status,
        { timeout: 15_000 },
      )
      .toBe('resolved');
  });
});
