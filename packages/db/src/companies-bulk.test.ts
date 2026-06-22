import { type SupabaseClient, createClient } from '@supabase/supabase-js';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { bulkCreateCompanies, listExistingCnpjs } from './companies';
import type { Database } from './database.types';

// Integration test for bulk onboarding against the linked Supabase Cloud dev
// project. Proves PER-ROW isolation: a pre-existing CNPJ is skipped while the
// rest are created in the same call (golden rule #6). Skipped without env.

const URL = process.env.SUPABASE_URL;
const ANON = process.env.SUPABASE_ANON_KEY;
const SERVICE = process.env.SUPABASE_SERVICE_ROLE_KEY;
const PASSWORD = process.env.SEED_PASSWORD ?? 'hub-dev-2026!';
const hasEnv = Boolean(URL && ANON && SERVICE);

const FIRM_A = '11111111-1111-4111-8111-111111111111';
const OWNER_EMAIL = 'owner@demo.test';

function checkDigit(base: string): number {
  let sum = 0;
  let weight = 2;
  for (let i = base.length - 1; i >= 0; i -= 1) {
    sum += Number(base[i]) * weight;
    weight = weight === 9 ? 2 : weight + 1;
  }
  const mod = sum % 11;
  return mod < 2 ? 0 : 11 - mod;
}
function makeValidCnpj(base12: string): string {
  const d1 = checkDigit(base12);
  return `${base12}${d1}${checkDigit(base12 + d1)}`;
}

const EXISTING = makeValidCnpj('112223330030');
const NEW_A = makeValidCnpj('112223330031');
const NEW_B = makeValidCnpj('112223330032');

describe.skipIf(!hasEnv)('bulkCreateCompanies (cloud dev)', () => {
  let service: SupabaseClient<Database>;
  let owner: SupabaseClient<Database>;

  beforeAll(async () => {
    if (!URL || !ANON || !SERVICE) throw new Error('missing env');
    service = createClient<Database>(URL, SERVICE, { auth: { persistSession: false } });
    // Pre-register EXISTING so the bulk call must skip exactly that row.
    await service
      .from('companies')
      .upsert(
        { firm_id: FIRM_A, cnpj: EXISTING, legal_name: 'Pré-existente' },
        { onConflict: 'firm_id,cnpj', ignoreDuplicates: true },
      );
    owner = createClient<Database>(URL, ANON, { auth: { persistSession: false } });
    const { error } = await owner.auth.signInWithPassword({
      email: OWNER_EMAIL,
      password: PASSWORD,
    });
    if (error) throw error;
  });

  afterAll(async () => {
    if (service) {
      for (const cnpj of [EXISTING, NEW_A, NEW_B]) {
        await service.from('companies').delete().eq('firm_id', FIRM_A).eq('cnpj', cnpj);
      }
      await service.from('audit_events').delete().eq('action', 'companies.imported');
    }
    if (owner) await owner.auth.signOut();
  });

  it('creates new rows, skips the existing one, and audits the import', async () => {
    const result = await bulkCreateCompanies(owner, [
      {
        cnpj: EXISTING,
        legalName: 'Duplicada',
        tradeName: null,
        taxRegime: null,
        city: null,
        state: null,
      },
      {
        cnpj: NEW_A,
        legalName: 'Nova A',
        tradeName: null,
        taxRegime: 'simples_nacional',
        city: null,
        state: 'SP',
      },
      {
        cnpj: NEW_B,
        legalName: 'Nova B',
        tradeName: null,
        taxRegime: null,
        city: null,
        state: null,
      },
    ]);

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.created.map((c) => c.cnpj).sort()).toEqual([NEW_A, NEW_B].sort());
    expect(result.duplicateCnpjs).toEqual([EXISTING]);

    const existing = await listExistingCnpjs(owner);
    expect(existing).toContain(NEW_A);
    expect(existing).toContain(NEW_B);

    const { data: audit } = await owner
      .from('audit_events')
      .select('context')
      .eq('action', 'companies.imported')
      .order('created_at', { ascending: false })
      .limit(1)
      .single();
    expect((audit?.context as { created?: number })?.created).toBe(2);
  });
});
