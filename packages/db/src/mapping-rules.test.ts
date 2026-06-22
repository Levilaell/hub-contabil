import { type SupabaseClient, createClient } from '@supabase/supabase-js';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import type { Database } from './database.types';
import {
  createMappingRule,
  listMappingRules,
  resolveOrQueue,
  saveResolutionAsRule,
} from './mapping-rules';

// Integration test for the mapping-rules engine against Supabase Cloud dev. Proves
// the T18 acceptance: precedence chain end-to-end, a resolved pending becomes a rule
// that auto-resolves the next identical case, pending dedup, and cross-firm RLS.
// Skipped without env. Uses a throwaway domain so it never touches real CFOP rules.

const URL = process.env.SUPABASE_URL;
const ANON = process.env.SUPABASE_ANON_KEY;
const SERVICE = process.env.SUPABASE_SERVICE_ROLE_KEY;
const PASSWORD = process.env.SEED_PASSWORD ?? 'hub-dev-2026!';
const hasEnv = Boolean(URL && ANON && SERVICE);

const FIRM_B = '99999999-9999-4999-8999-999999999994';
const DOMAIN = 'cfop_test';
const SUPPLIER = '12345678000199';

async function cleanup(service: SupabaseClient<Database>) {
  await service.from('mapping_rules').delete().eq('domain', DOMAIN);
  // Filter the test domain in JS to avoid a json-path column in a typed query.
  const { data: rows } = await service
    .from('exception_queue')
    .select('id, context')
    .eq('source', 'rules');
  const ids = (rows ?? [])
    .filter((r) => (r.context as { domain?: string } | null)?.domain === DOMAIN)
    .map((r) => r.id);
  if (ids.length) await service.from('exception_queue').delete().in('id', ids);
}

describe.skipIf(!hasEnv)('mapping-rules engine (cloud dev)', () => {
  let service: SupabaseClient<Database>;
  let owner: SupabaseClient<Database>;

  beforeAll(async () => {
    if (!URL || !ANON || !SERVICE) throw new Error('missing env');
    service = createClient<Database>(URL, SERVICE, { auth: { persistSession: false } });
    await cleanup(service);

    owner = createClient<Database>(URL, ANON, { auth: { persistSession: false } });
    const { error } = await owner.auth.signInWithPassword({
      email: 'owner@demo.test',
      password: PASSWORD,
    });
    if (error) throw error;
  });

  afterAll(async () => {
    if (service) await cleanup(service);
    if (owner) await owner.auth.signOut();
  });

  it('queues a pending when no rule matches, collapsing identical misses', async () => {
    const key = { originCfop: '1102', supplierCnpj: SUPPLIER };
    const first = await resolveOrQueue(owner, { domain: DOMAIN, key, suggestion: { entryCfop: '1556' } });
    const second = await resolveOrQueue(owner, { domain: DOMAIN, key });

    expect(first.status).toBe('pending');
    expect(second.status).toBe('pending');
    // Same domain + key → one pending, not two.
    if (first.status === 'pending' && second.status === 'pending') {
      expect(second.exceptionId).toBe(first.exceptionId);
    }

    const { data } = await owner
      .from('exception_queue')
      .select('source, status')
      .eq('id', first.status === 'pending' ? first.exceptionId : '');
    expect(data?.[0]).toMatchObject({ source: 'rules', status: 'open' });
  });

  it('resolving the pending into a rule auto-resolves the next identical case', async () => {
    const key = { originCfop: '2202', supplierCnpj: SUPPLIER };
    const pending = await resolveOrQueue(owner, { domain: DOMAIN, key });
    expect(pending.status).toBe('pending');
    if (pending.status !== 'pending') return;

    const saved = await saveResolutionAsRule(owner, {
      exceptionId: pending.exceptionId,
      input: { domain: DOMAIN, level: 1, key, value: { entryCfop: '2556' } },
    });
    expect(saved.ok).toBe(true);

    // The pending is now resolved…
    const { data: exc } = await owner
      .from('exception_queue')
      .select('status')
      .eq('id', pending.exceptionId);
    expect(exc?.[0]?.status).toBe('resolved');

    // …and the next identical case resolves to the saved value (no new pending).
    const next = await resolveOrQueue(owner, { domain: DOMAIN, key });
    expect(next).toMatchObject({ status: 'matched', value: { entryCfop: '2556' }, level: 1 });
  });

  it('applies level-1 over level-2 precedence through the data layer', async () => {
    const origin = '3303';
    await createMappingRule(owner, {
      domain: DOMAIN,
      level: 2,
      key: { originCfop: origin, supplierCnpj: null },
      value: { entryCfop: '3000' },
    });
    await createMappingRule(owner, {
      domain: DOMAIN,
      level: 1,
      key: { originCfop: origin, supplierCnpj: SUPPLIER },
      value: { entryCfop: '3556' },
    });

    const specific = await resolveOrQueue(owner, {
      domain: DOMAIN,
      key: { originCfop: origin, supplierCnpj: SUPPLIER },
    });
    const general = await resolveOrQueue(owner, {
      domain: DOMAIN,
      key: { originCfop: origin, supplierCnpj: '99999999000100' },
    });

    expect(specific).toMatchObject({ status: 'matched', value: { entryCfop: '3556' }, level: 1 });
    expect(general).toMatchObject({ status: 'matched', value: { entryCfop: '3000' }, level: 2 });
  });

  it('does not list a foreign firm rule (RLS)', async () => {
    await service.from('firms').upsert({ id: FIRM_B, name: 'Foreign B' });
    const { data: foreign } = await service
      .from('mapping_rules')
      .insert({
        firm_id: FIRM_B,
        domain: DOMAIN,
        level: 1,
        key: { originCfop: '4404' },
        value: { entryCfop: '4000' },
      })
      .select('id')
      .single();

    const rules = await listMappingRules(owner, { domain: DOMAIN });
    expect(rules.some((r) => r.id === foreign!.id)).toBe(false);

    await service.from('mapping_rules').delete().eq('firm_id', FIRM_B);
    await service.from('firms').delete().eq('id', FIRM_B);
  });
});
