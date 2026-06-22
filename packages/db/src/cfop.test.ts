import { type SupabaseClient, createClient } from '@supabase/supabase-js';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { applyCfopResolution } from './cfop';
import type { Database } from './database.types';
import { createMappingRule } from './mapping-rules';

// Integration test for CFOP resolution against Supabase Cloud dev (T19 acceptance):
// an NF-e item WITH a matching rule fills documents.metadata.entry_cfop; WITHOUT one
// it queues a 'rules' pending carrying the XML-derived key. Uses throwaway CFOP codes
// and cleans up. Skipped without env.

const URL = process.env.SUPABASE_URL;
const ANON = process.env.SUPABASE_ANON_KEY;
const SERVICE = process.env.SUPABASE_SERVICE_ROLE_KEY;
const PASSWORD = process.env.SEED_PASSWORD ?? 'hub-dev-2026!';
const hasEnv = Boolean(URL && ANON && SERVICE);

const FIRM_A = '11111111-1111-4111-8111-111111111111';
const CNPJ = '77000000000022';
const SUPPLIER = '14200166000187';
const MAPPED_CFOP = '9101'; // has a rule
const UNMAPPED_CFOP = '9102'; // no rule → pending
const TEST_CFOPS = [MAPPED_CFOP, UNMAPPED_CFOP];

interface MetaEntry {
  nItem: number;
  originCfop: string;
  entryCfop: string | null;
  status: string;
}

async function cleanup(service: SupabaseClient<Database>, companyId: string) {
  if (companyId) await service.from('companies').delete().eq('id', companyId); // cascades documents
  const { data: rules } = await service.from('mapping_rules').select('id, key').eq('domain', 'cfop');
  const ruleIds = (rules ?? [])
    .filter((r) => TEST_CFOPS.includes(String((r.key as { originCfop?: string }).originCfop)))
    .map((r) => r.id);
  if (ruleIds.length) await service.from('mapping_rules').delete().in('id', ruleIds);

  const { data: excs } = await service
    .from('exception_queue')
    .select('id, context')
    .eq('source', 'rules');
  const excIds = (excs ?? [])
    .filter((e) => {
      const key = (e.context as { key?: { originCfop?: string } }).key;
      return key ? TEST_CFOPS.includes(String(key.originCfop)) : false;
    })
    .map((e) => e.id);
  if (excIds.length) await service.from('exception_queue').delete().in('id', excIds);
}

describe.skipIf(!hasEnv)('CFOP resolution (cloud dev)', () => {
  let service: SupabaseClient<Database>;
  let owner: SupabaseClient<Database>;
  let companyId = '';
  let documentId = '';

  beforeAll(async () => {
    if (!URL || !ANON || !SERVICE) throw new Error('missing env');
    service = createClient<Database>(URL, SERVICE, { auth: { persistSession: false } });

    const { data: company, error } = await service
      .from('companies')
      .upsert({ firm_id: FIRM_A, cnpj: CNPJ, legal_name: 'CFOP Co' }, { onConflict: 'firm_id,cnpj' })
      .select('id')
      .single();
    if (error) throw error;
    companyId = company.id;
    await cleanup(service, ''); // clear stale rules/exceptions, keep the company

    const path = `firm/${FIRM_A}/company/${companyId}/2026-06/fiscal/cfoptest-nfe.xml`;
    const { data: doc, error: docError } = await service
      .from('documents')
      .insert({
        firm_id: FIRM_A,
        company_id: companyId,
        period: '2026-06',
        department: 'fiscal',
        doc_type: 'nfe',
        storage_path: path,
        hash: 'cfoptesthash000000000001',
        file_name: 'cfoptest-nfe.xml',
      })
      .select('id')
      .single();
    if (docError) throw docError;
    documentId = doc.id;

    owner = createClient<Database>(URL, ANON, { auth: { persistSession: false } });
    const { error: signIn } = await owner.auth.signInWithPassword({
      email: 'owner@demo.test',
      password: PASSWORD,
    });
    if (signIn) throw signIn;

    await createMappingRule(owner, {
      domain: 'cfop',
      level: 1,
      key: { originCfop: MAPPED_CFOP, supplierCnpj: SUPPLIER },
      value: { entryCfop: '9501' },
    });
  });

  afterAll(async () => {
    if (service) await cleanup(service, companyId);
    if (owner) await owner.auth.signOut();
  });

  it('fills metadata for a mapped CFOP and queues a pending for an unmapped one', async () => {
    const result = await applyCfopResolution(owner, {
      documentId,
      issuerCnpj: SUPPLIER,
      items: [
        { nItem: 1, cfop: MAPPED_CFOP },
        { nItem: 2, cfop: UNMAPPED_CFOP },
      ],
    });
    expect(result.applied).toBe(1);
    expect(result.pending).toBe(1);

    // The derived entry CFOP is written to documents.metadata (file untouched).
    const { data: doc } = await owner
      .from('documents')
      .select('metadata')
      .eq('id', documentId)
      .single();
    const entries = (doc?.metadata as { entry_cfop?: MetaEntry[] }).entry_cfop ?? [];
    const mapped = entries.find((e) => e.originCfop === MAPPED_CFOP);
    const pending = entries.find((e) => e.originCfop === UNMAPPED_CFOP);
    expect(mapped).toMatchObject({ entryCfop: '9501', status: 'matched' });
    expect(pending).toMatchObject({ entryCfop: null, status: 'pending' });

    // The unmapped CFOP raised a 'rules' pending carrying the XML-derived key.
    const { data: excs } = await owner
      .from('exception_queue')
      .select('context, source, status')
      .eq('source', 'rules')
      .eq('status', 'open');
    const raised = (excs ?? []).find(
      (e) => (e.context as { key?: { originCfop?: string } }).key?.originCfop === UNMAPPED_CFOP,
    );
    expect(raised).toBeTruthy();
  });
});
