import { buildExportManifest } from '@hub/core';
import { type SupabaseClient, createClient } from '@supabase/supabase-js';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import type { Database } from './database.types';
import {
  createExportBatch,
  getExportBatch,
  listExportableDocuments,
} from './export-batches';

// Integration test for the export preview/create path against Supabase Cloud dev
// (T22 acceptance, the part the web layer owns): listExportableDocuments shapes docs
// so core buildExportManifest INCLUDES resolved files and EXCLUDES pending-CFOP ones;
// create_export_batch starts a 'building' batch. The actual zip build is the worker.
// Skipped without env.

const URL = process.env.SUPABASE_URL;
const ANON = process.env.SUPABASE_ANON_KEY;
const SERVICE = process.env.SUPABASE_SERVICE_ROLE_KEY;
const PASSWORD = process.env.SEED_PASSWORD ?? 'hub-dev-2026!';
const hasEnv = Boolean(URL && ANON && SERVICE);

const FIRM_A = '11111111-1111-4111-8111-111111111111';
const CNPJ = '77000000000033';
const CONVENTION = '{cnpj}_{period}_{type}_{seq}.{ext}';

async function cleanup(service: SupabaseClient<Database>, companyId: string) {
  if (companyId) {
    await service.from('export_batches').delete().eq('firm_id', FIRM_A).eq('period', '2026-06');
    await service.from('companies').delete().eq('id', companyId); // cascades documents
  }
}

describe.skipIf(!hasEnv)('export batches (cloud dev)', () => {
  let service: SupabaseClient<Database>;
  let owner: SupabaseClient<Database>;
  let companyId = '';

  beforeAll(async () => {
    if (!URL || !ANON || !SERVICE) throw new Error('missing env');
    service = createClient<Database>(URL, SERVICE, { auth: { persistSession: false } });

    const { data: company, error } = await service
      .from('companies')
      .upsert({ firm_id: FIRM_A, cnpj: CNPJ, legal_name: 'Export Co' }, { onConflict: 'firm_id,cnpj' })
      .select('id')
      .single();
    if (error) throw error;
    companyId = company.id;

    const base = `firm/${FIRM_A}/company/${companyId}/2026-06/fiscal`;
    await service.from('documents').insert([
      {
        firm_id: FIRM_A,
        company_id: companyId,
        period: '2026-06',
        department: 'fiscal',
        doc_type: 'nfe',
        storage_path: `${base}/exp-matched.xml`,
        hash: 'exphashmatched0000001',
        file_name: 'matched.xml',
        metadata: {
          entry_cfop: [{ nItem: 1, originCfop: '1102', entryCfop: '1556', status: 'matched' }],
        },
      },
      {
        firm_id: FIRM_A,
        company_id: companyId,
        period: '2026-06',
        department: 'fiscal',
        doc_type: 'nfe',
        storage_path: `${base}/exp-pending.xml`,
        hash: 'exphashpending0000001',
        file_name: 'pending.xml',
        metadata: {
          entry_cfop: [{ nItem: 1, originCfop: '5949', entryCfop: null, status: 'pending' }],
        },
      },
    ]);

    owner = createClient<Database>(URL, ANON, { auth: { persistSession: false } });
    const { error: signIn } = await owner.auth.signInWithPassword({
      email: 'owner@demo.test',
      password: PASSWORD,
    });
    if (signIn) throw signIn;
  });

  afterAll(async () => {
    if (service) await cleanup(service, companyId);
    if (owner) await owner.auth.signOut();
  });

  it('includes resolved documents and excludes pending-CFOP ones in the manifest', async () => {
    const docs = await listExportableDocuments(owner, { companyIds: [companyId], period: '2026-06' });
    const manifest = buildExportManifest(docs, CONVENTION);

    expect(manifest.included.map((e) => e.originalName)).toContain('matched.xml');
    expect(manifest.excluded.map((e) => e.fileName)).toContain('pending.xml');
    expect(manifest.excluded[0]?.reason).toBe('cfop_pending');
  });

  it('creates a building batch via the RPC', async () => {
    const result = await createExportBatch(owner, { companyIds: [companyId], period: '2026-06' });
    expect(result.ok).toBe(true);
    if (!result.ok) return;

    const batch = await getExportBatch(owner, result.id);
    expect(batch?.status).toBe('building');
    expect(batch?.period).toBe('2026-06');
  });
});
