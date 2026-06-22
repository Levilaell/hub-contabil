import { type SupabaseClient, createClient } from '@supabase/supabase-js';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import type { Database } from './database.types';
import { createMonitoredDocument, firmToday, listMonitoredDocuments } from './monitored-documents';

// Integration test for monitored documents against Supabase Cloud dev. Proves the
// recompute-on-read statuses (past/near/future/absent), needs_update preservation,
// and cross-firm RLS. Skipped without env.

const URL = process.env.SUPABASE_URL;
const ANON = process.env.SUPABASE_ANON_KEY;
const SERVICE = process.env.SUPABASE_SERVICE_ROLE_KEY;
const PASSWORD = process.env.SEED_PASSWORD ?? 'hub-dev-2026!';
const hasEnv = Boolean(URL && ANON && SERVICE);

const FIRM_A = '11111111-1111-4111-8111-111111111111';
const FIRM_B = '99999999-9999-4999-8999-999999999994';
const CNPJ = '77000000000011';

function addDays(ymd: string, n: number): string {
  const d = new Date(`${ymd}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
}

describe.skipIf(!hasEnv)('monitored documents (cloud dev)', () => {
  let service: SupabaseClient<Database>;
  let owner: SupabaseClient<Database>;
  let companyId = '';
  const today = firmToday();

  beforeAll(async () => {
    if (!URL || !ANON || !SERVICE) throw new Error('missing env');
    service = createClient<Database>(URL, SERVICE, { auth: { persistSession: false } });
    const { data: company, error } = await service
      .from('companies')
      .upsert(
        { firm_id: FIRM_A, cnpj: CNPJ, legal_name: 'Prazos Co' },
        { onConflict: 'firm_id,cnpj' },
      )
      .select('id')
      .single();
    if (error) throw error;
    companyId = company.id;

    owner = createClient<Database>(URL, ANON, { auth: { persistSession: false } });
    const { error: e } = await owner.auth.signInWithPassword({
      email: 'owner@demo.test',
      password: PASSWORD,
    });
    if (e) throw e;
  });

  afterAll(async () => {
    if (service && companyId) {
      await service.from('monitored_documents').delete().eq('company_id', companyId);
      await service.from('audit_events').delete().eq('action', 'monitored_document.created');
      await service.from('companies').delete().eq('id', companyId);
    }
    if (owner) await owner.auth.signOut();
  });

  it('derives status on read for past / near / future / absent dates', async () => {
    await createMonitoredDocument(owner, {
      companyId,
      docKind: 'cnd_federal',
      dueDate: addDays(today, -1),
      triggerDays: 30,
    });
    await createMonitoredDocument(owner, {
      companyId,
      docKind: 'cnd_estadual',
      dueDate: addDays(today, 5),
      triggerDays: 30,
    });
    await createMonitoredDocument(owner, {
      companyId,
      docKind: 'cndt',
      dueDate: addDays(today, 400),
      triggerDays: 30,
    });
    await createMonitoredDocument(owner, {
      companyId,
      docKind: 'alvara',
      dueDate: null,
      triggerDays: 30,
    });

    const docs = await listMonitoredDocuments(owner, { companyId });
    const byKind = Object.fromEntries(docs.map((d) => [d.docKind, d.status]));
    expect(byKind.cnd_federal).toBe('overdue');
    expect(byKind.cnd_estadual).toBe('due_soon');
    expect(byKind.cndt).toBe('valid');
    expect(byKind.alvara).toBe('no_date');
  });

  it('preserves needs_update on read (not recomputed to overdue)', async () => {
    const { data } = await service
      .from('monitored_documents')
      .insert({
        firm_id: FIRM_A,
        company_id: companyId,
        doc_kind: 'fgts_crf',
        due_date: addDays(today, -10), // past — would be overdue if recomputed
        trigger_days: 30,
        status: 'needs_update',
      })
      .select('id')
      .single();

    const docs = await listMonitoredDocuments(owner, { companyId });
    expect(docs.find((d) => d.id === data!.id)?.status).toBe('needs_update');
  });

  it('does not list a foreign firm monitored document (RLS)', async () => {
    await service.from('firms').upsert({ id: FIRM_B, name: 'Foreign B' });
    const { data: foreignCo } = await service
      .from('companies')
      .upsert(
        { firm_id: FIRM_B, cnpj: '77000000000099', legal_name: 'Foreign Prazos' },
        { onConflict: 'firm_id,cnpj' },
      )
      .select('id')
      .single();
    const { data: foreignDoc } = await service
      .from('monitored_documents')
      .insert({
        firm_id: FIRM_B,
        company_id: foreignCo!.id,
        doc_kind: 'cnd_federal',
        trigger_days: 30,
      })
      .select('id')
      .single();

    const docs = await listMonitoredDocuments(owner);
    expect(docs.some((d) => d.id === foreignDoc!.id)).toBe(false);

    await service.from('firms').delete().eq('id', FIRM_B);
  });
});
