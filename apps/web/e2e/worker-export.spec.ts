import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

import { buildStoragePath } from '@hub/db';
import { type SupabaseClient, createClient } from '@supabase/supabase-js';
import { expect, test } from '@playwright/test';

// T23 worker flow: XML → CFOP resolved → exported batch. A doc with a MATCHED
// metadata.entry_cfop is included; a PENDING-CFOP doc is excluded. The batch is built
// by the RUNNING worker via the real `export` pgmq queue (no LLM). Setup in Node; the
// BROWSER builds the batch on /exportacao. Requires the worker running. Cleans up.

const FIRM_A = '11111111-1111-4111-8111-111111111111';
const CNPJ = '77000000000088';
const PERIOD = '2026-06';
const COMPANY = 'E2E Export Co';

const dbEnv = readFileSync(resolve(process.cwd(), '../../packages/db/.env'), 'utf8');
const get = (k: string) => new RegExp(`^${k}=(.*)$`, 'm').exec(dbEnv)?.[1]?.trim() ?? '';
const SUPABASE_URL = get('SUPABASE_URL');
const SERVICE = get('SUPABASE_SERVICE_ROLE_KEY');

test.describe('XML → CFOP rule → exported batch', () => {
  let service: SupabaseClient;
  let companyId = '';
  const matchedHash = 'e2eexpmatched00000001';
  const pendingHash = 'e2eexppending00000001';
  let matchedPath = '';

  test.beforeAll(async () => {
    service = createClient(SUPABASE_URL, SERVICE, { auth: { persistSession: false } });
    const { data: co, error } = await service
      .from('companies')
      .upsert({ firm_id: FIRM_A, cnpj: CNPJ, legal_name: COMPANY }, { onConflict: 'firm_id,cnpj' })
      .select('id')
      .single();
    if (error) throw error;
    companyId = co.id as string;

    matchedPath = buildStoragePath(FIRM_A, companyId, PERIOD, 'fiscal', matchedHash, 'matched.xml');
    await service.storage
      .from('documents')
      .upload(matchedPath, new TextEncoder().encode('<NFe/>'), {
        contentType: 'application/xml',
        upsert: true,
      });

    await service.from('documents').insert([
      {
        firm_id: FIRM_A,
        company_id: companyId,
        period: PERIOD,
        department: 'fiscal',
        doc_type: 'nfe',
        storage_path: matchedPath,
        hash: matchedHash,
        file_name: 'matched.xml',
        metadata: { entry_cfop: [{ nItem: 1, originCfop: '1102', entryCfop: '1556', status: 'matched' }] },
      },
      {
        firm_id: FIRM_A,
        company_id: companyId,
        period: PERIOD,
        department: 'fiscal',
        doc_type: 'nfe',
        storage_path: buildStoragePath(FIRM_A, companyId, PERIOD, 'fiscal', pendingHash, 'pending.xml'),
        hash: pendingHash,
        file_name: 'pending.xml',
        metadata: { entry_cfop: [{ nItem: 1, originCfop: '5949', entryCfop: null, status: 'pending' }] },
      },
    ]);
  });

  test.afterAll(async () => {
    if (service && companyId) {
      const { data: batches } = await service
        .from('export_batches')
        .select('id, zip_path')
        .eq('firm_id', FIRM_A)
        .eq('period', PERIOD);
      for (const b of batches ?? []) {
        if (b.zip_path) await service.storage.from('documents').remove([b.zip_path as string]);
        await service.from('export_batches').delete().eq('id', b.id); // cascades batch_documents
      }
      await service.storage.from('documents').remove([matchedPath]);
      await service.from('companies').delete().eq('id', companyId); // cascades documents
    }
  });

  test('worker builds a batch: matched file included, pending-CFOP excluded', async ({ page }) => {
    await page.goto('/exportacao');
    await page.getByText(COMPANY).click(); // selects the company checkbox (label)
    await page.getByPlaceholder('2026-06').fill(PERIOD);
    await page.getByRole('button', { name: 'Gerar lote' }).click();

    // The running worker consumes the export queue and builds the zip.
    const batch = async () =>
      (
        await service
          .from('export_batches')
          .select('status, zip_path, manifest')
          .eq('firm_id', FIRM_A)
          .eq('period', PERIOD)
          .order('created_at', { ascending: false })
          .limit(1)
      ).data?.[0];

    await expect.poll(async () => (await batch())?.status, { timeout: 45_000, intervals: [1000] }).toBe(
      'ready',
    );

    const m = (await batch())?.manifest as {
      count: number;
      excludedCount: number;
      included: { originalName: string }[];
      excluded: { fileName: string }[];
      zip_path?: string;
    };
    expect(m.count).toBe(1);
    expect(m.included.map((e) => e.originalName)).toContain('matched.xml');
    expect(m.excludedCount).toBe(1);
    expect(m.excluded.map((e) => e.fileName)).toContain('pending.xml');
    expect((await batch())?.zip_path).toBeTruthy();
  });
});
