import { type SupabaseClient, createClient } from '@supabase/supabase-js';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { createCompany, listCompanies, setCompanyArchived } from './companies';
import { createContact, listContacts } from './contacts';
import type { Database } from './database.types';

// Integration test for the company registry against the linked Supabase Cloud dev
// project. Proves tenant isolation BOTH ways (a deny-all policy would pass the
// negative case alone), duplicate-CNPJ rejection, and the audit path. Skipped
// when env is absent (e.g. plain CI).

const URL = process.env.SUPABASE_URL;
const ANON = process.env.SUPABASE_ANON_KEY;
const SERVICE = process.env.SUPABASE_SERVICE_ROLE_KEY;
const PASSWORD = process.env.SEED_PASSWORD ?? 'hub-dev-2026!';
const hasEnv = Boolean(URL && ANON && SERVICE);

const FIRM_A = '11111111-1111-4111-8111-111111111111'; // M Rocha (seeded)
const FIRM_B = '99999999-9999-4999-8999-999999999991'; // foreign firm, created here
const OWNER_EMAIL = 'owner@mrocha.test';

const A_CNPJ = '11222333000181'; // valid; created by the firm A user
const B_CNPJ = '00000000000191'; // valid; planted in firm B (service role)

describe.skipIf(!hasEnv)('company registry (cloud dev)', () => {
  let service: SupabaseClient<Database>;
  let owner: SupabaseClient<Database>;
  let companyAId = '';
  let contactAId = '';
  let companyBId = '';
  let contactBId = '';

  beforeAll(async () => {
    if (!URL || !ANON || !SERVICE) throw new Error('missing env');
    service = createClient<Database>(URL, SERVICE, { auth: { persistSession: false } });

    // Foreign firm B + a company the M Rocha user must never see (service role).
    await service.from('firms').upsert({ id: FIRM_B, name: 'Foreign Firm B' });
    const { data: companyB, error } = await service
      .from('companies')
      .insert({ firm_id: FIRM_B, cnpj: B_CNPJ, legal_name: 'Foreign Co B' })
      .select('id')
      .single();
    if (error) throw error;
    companyBId = companyB.id;

    const { data: contactB, error: contactError } = await service
      .from('contacts')
      .insert({ firm_id: FIRM_B, company_id: companyBId, name: 'Foreign Contact B' })
      .select('id')
      .single();
    if (contactError) throw contactError;
    contactBId = contactB.id;

    owner = createClient<Database>(URL, ANON, { auth: { persistSession: false } });
    const { error: signInError } = await owner.auth.signInWithPassword({
      email: OWNER_EMAIL,
      password: PASSWORD,
    });
    if (signInError) throw signInError;
  });

  afterAll(async () => {
    if (service) {
      // Drop firm B (cascades its company/contacts) and the firm A test rows.
      await service.from('firms').delete().eq('id', FIRM_B);
      if (companyAId) {
        await service.from('audit_events').delete().eq('entity_id', companyAId);
        await service.from('companies').delete().eq('id', companyAId); // cascades contacts
      }
      if (contactAId) await service.from('audit_events').delete().eq('entity_id', contactAId);
    }
    if (owner) await owner.auth.signOut();
  });

  it('creates a company, stamps the caller firm, and writes an audit event', async () => {
    const result = await createCompany(owner, {
      cnpj: A_CNPJ,
      legalName: 'Empresa Teste A',
      taxRegime: 'simples_nacional',
      state: 'sp',
    });
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    companyAId = result.id;

    const { data: row } = await owner
      .from('companies')
      .select('firm_id, state')
      .eq('id', companyAId)
      .single();
    expect(row?.firm_id).toBe(FIRM_A);
    expect(row?.state).toBe('SP'); // normalized to uppercase

    const { data: audit } = await owner
      .from('audit_events')
      .select('action, firm_id')
      .eq('entity_id', companyAId)
      .eq('action', 'company.created')
      .single();
    expect(audit?.firm_id).toBe(FIRM_A);
  });

  it('rejects a duplicate CNPJ in the same firm with a pt-BR message', async () => {
    const result = await createCompany(owner, { cnpj: A_CNPJ, legalName: 'Duplicada' });
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.message).toMatch(/já está cadastrado/i);
  });

  it('rejects an invalid CNPJ with a pt-BR message', async () => {
    const result = await createCompany(owner, { cnpj: '11222333000180', legalName: 'X' });
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.message).toMatch(/CNPJ inválido/i);
  });

  it('does not list or read a foreign firm company (negative RLS)', async () => {
    const all = await listCompanies(owner, { status: 'all' });
    expect(all.some((company) => company.id === companyBId)).toBe(false);

    const { data } = await owner.from('companies').select('id').eq('cnpj', B_CNPJ);
    expect(data).toEqual([]);
  });

  it('blocks inserting a company into a foreign firm (RLS with check)', async () => {
    const { error } = await owner
      .from('companies')
      .insert({ firm_id: FIRM_B, cnpj: '12345678000195', legal_name: 'Intruder' });
    expect(error).not.toBeNull();
  });

  it('cannot archive a foreign firm company (RLS filters the update)', async () => {
    const result = await setCompanyArchived(owner, companyBId, true);
    expect(result.ok).toBe(false);
  });

  it('creates and lists a contact, but hides foreign-firm contacts', async () => {
    const result = await createContact(owner, {
      companyId: companyAId,
      name: 'Maria Contato',
      email: 'maria@empresa.test',
      preferredChannel: 'email',
      isPrimary: true,
    });
    expect(result.ok).toBe(true);
    if (result.ok) contactAId = result.id;

    const contacts = await listContacts(owner, companyAId);
    expect(contacts.some((c) => c.id === contactAId)).toBe(true);

    // Firm B planted a real contact — A must not be able to read it (negative RLS).
    const { data: foreign } = await owner.from('contacts').select('id').eq('id', contactBId);
    expect(foreign).toEqual([]);
  });

  it('blocks attaching a contact to a foreign-firm company (composite FK)', async () => {
    // firm_id is stamped as A; the company belongs to B — the (firm_id, company_id)
    // FK has no matching (A, companyBId) row, so the insert is rejected.
    const result = await createContact(owner, { companyId: companyBId, name: 'Intruso' });
    expect(result.ok).toBe(false);
  });

  it('enqueues enrichment for an own company and rejects a foreign one', async () => {
    // Exercises the request_enrichment RPC end to end: SECURITY DEFINER must be able
    // to reach pgmq, and the firm-scoping clause must reject another firm's company.
    const own = await owner.rpc('request_enrichment', { p_company_id: companyAId });
    expect(own.error).toBeNull();

    const { data: row } = await owner
      .from('companies')
      .select('enrichment_data')
      .eq('id', companyAId)
      .single();
    const data = (
      typeof row?.enrichment_data === 'string'
        ? JSON.parse(row.enrichment_data)
        : row?.enrichment_data
    ) as { status?: string };
    expect(data?.status).toBe('pending');

    const { data: audit } = await owner
      .from('audit_events')
      .select('id')
      .eq('entity_id', companyAId)
      .eq('action', 'company.enrichment_requested');
    expect((audit ?? []).length).toBeGreaterThan(0);

    const foreign = await owner.rpc('request_enrichment', { p_company_id: companyBId });
    expect(foreign.error).not.toBeNull();
  });

  it('points an archived-CNPJ re-create toward restoring it', async () => {
    expect((await setCompanyArchived(owner, companyAId, true)).ok).toBe(true);
    const result = await createCompany(owner, { cnpj: A_CNPJ, legalName: 'Tentativa' });
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.message).toMatch(/arquivada/i);
    // Leave it active for a clean state (teardown deletes it regardless).
    await setCompanyArchived(owner, companyAId, false);
  });
});
