import { type SupabaseClient, createClient } from '@supabase/supabase-js';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import type { Database } from './database.types';
import { buildStoragePath, findDocumentByHash, insertDocument, listDocuments } from './documents';

// Integration test for the documents metadata layer against Supabase Cloud dev.
// Proves dedup (unique hash), the storage_path-matches-owner CHECK, and cross-firm
// RLS. Storage objects themselves are spiked separately. Skipped without env.

const URL = process.env.SUPABASE_URL;
const ANON = process.env.SUPABASE_ANON_KEY;
const SERVICE = process.env.SUPABASE_SERVICE_ROLE_KEY;
const PASSWORD = process.env.SEED_PASSWORD ?? 'hub-dev-2026!';
const hasEnv = Boolean(URL && ANON && SERVICE);

const FIRM_A = '11111111-1111-4111-8111-111111111111';
const FIRM_B = '99999999-9999-4999-8999-999999999993';
const CNPJ = '88000000000011';
const HASH = 'a'.repeat(64);

describe.skipIf(!hasEnv)('documents (cloud dev)', () => {
  let service: SupabaseClient<Database>;
  let owner: SupabaseClient<Database>;
  let companyId = '';

  beforeAll(async () => {
    if (!URL || !ANON || !SERVICE) throw new Error('missing env');
    service = createClient<Database>(URL, SERVICE, { auth: { persistSession: false } });
    const { data: company, error } = await service
      .from('companies')
      .upsert(
        { firm_id: FIRM_A, cnpj: CNPJ, legal_name: 'Docs Co' },
        { onConflict: 'firm_id,cnpj' },
      )
      .select('id')
      .single();
    if (error) throw error;
    companyId = company.id;

    owner = createClient<Database>(URL, ANON, { auth: { persistSession: false } });
    const { error: signInError } = await owner.auth.signInWithPassword({
      email: 'owner@demo.test',
      password: PASSWORD,
    });
    if (signInError) throw signInError;
  });

  afterAll(async () => {
    if (service && companyId) {
      await service.from('documents').delete().eq('company_id', companyId);
      await service.from('audit_events').delete().eq('action', 'document.created');
      await service.from('companies').delete().eq('id', companyId);
    }
    if (owner) await owner.auth.signOut();
  });

  it('inserts a document and flags a duplicate hash', async () => {
    const path = buildStoragePath(FIRM_A, companyId, '2099-02', 'fiscal', HASH, 'nota.pdf');
    const created = await insertDocument(owner, {
      companyId,
      period: '2099-02',
      department: 'fiscal',
      docType: 'nfe',
      storagePath: path,
      hash: HASH,
      fileName: 'nota.pdf',
      sizeBytes: 1234,
    });
    expect(created.ok).toBe(true);

    const dup = await insertDocument(owner, {
      companyId,
      period: '2099-02',
      department: 'fiscal',
      docType: 'nfe',
      storagePath: path,
      hash: HASH,
      fileName: 'nota-copia.pdf',
      sizeBytes: 1234,
    });
    expect(dup.ok).toBe(false); // same hash in the same company

    const found = await findDocumentByHash(owner, companyId, HASH);
    expect(found?.fileName).toBe('nota.pdf');

    const list = await listDocuments(owner, { companyId });
    expect(list.some((d) => d.hash === HASH)).toBe(true);
  });

  it('rejects a storage_path that does not match the owning firm/company (CHECK)', async () => {
    // Path built for a DIFFERENT firm — the CHECK must reject it even though the
    // row's firm_id is stamped to firm A.
    const badPath = buildStoragePath(
      FIRM_B,
      companyId,
      '2099-02',
      'fiscal',
      'b'.repeat(64),
      'x.pdf',
    );
    const result = await insertDocument(owner, {
      companyId,
      period: '2099-02',
      department: 'fiscal',
      docType: 'other',
      storagePath: badPath,
      hash: 'b'.repeat(64),
      fileName: 'x.pdf',
      sizeBytes: 1,
    });
    expect(result.ok).toBe(false);
  });

  it('does not list a foreign firm document (RLS)', async () => {
    await service.from('firms').upsert({ id: FIRM_B, name: 'Foreign B' });
    const { data: foreignCo } = await service
      .from('companies')
      .upsert(
        { firm_id: FIRM_B, cnpj: '88000000000099', legal_name: 'Foreign Docs' },
        { onConflict: 'firm_id,cnpj' },
      )
      .select('id')
      .single();
    const foreignPath = buildStoragePath(
      FIRM_B,
      foreignCo!.id,
      '2099-02',
      'fiscal',
      'c'.repeat(64),
      'f.pdf',
    );
    await service.from('documents').insert({
      firm_id: FIRM_B,
      company_id: foreignCo!.id,
      doc_type: 'other',
      storage_path: foreignPath,
      hash: 'c'.repeat(64),
      file_name: 'f.pdf',
    });

    const all = await listDocuments(owner);
    expect(all.some((d) => d.hash === 'c'.repeat(64))).toBe(false);

    await service.from('firms').delete().eq('id', FIRM_B); // cascades foreign co + docs
  });
});
