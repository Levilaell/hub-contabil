import { type SupabaseClient, createClient } from '@supabase/supabase-js';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import type { Database } from './database.types';
import { countOpenExceptions, listExceptions, resolveException } from './exceptions';

// Integration test for the exception queue against Supabase Cloud dev. Proves the
// resolve RPC stamps the author, blocks double-resolve, and is firm-scoped both
// ways. Skipped without env.

const URL = process.env.SUPABASE_URL;
const ANON = process.env.SUPABASE_ANON_KEY;
const SERVICE = process.env.SUPABASE_SERVICE_ROLE_KEY;
const PASSWORD = process.env.SEED_PASSWORD ?? 'hub-dev-2026!';
const hasEnv = Boolean(URL && ANON && SERVICE);

const FIRM_A = '11111111-1111-4111-8111-111111111111';
const FIRM_B = '99999999-9999-4999-8999-999999999992';
const OWNER_EMAIL = 'owner@mrocha.test';
const MARKER = 't9-exc-test';

describe.skipIf(!hasEnv)('exception queue (cloud dev)', () => {
  let service: SupabaseClient<Database>;
  let owner: SupabaseClient<Database>;
  let ownerId = '';
  let excAId = '';
  let excBId = '';

  async function insertException(firmId: string): Promise<string> {
    const { data, error } = await service
      .from('exception_queue')
      .insert({ firm_id: firmId, source: 'enrichment', context: { marker: MARKER } })
      .select('id')
      .single();
    if (error) throw error;
    return data.id;
  }

  beforeAll(async () => {
    if (!URL || !ANON || !SERVICE) throw new Error('missing env');
    service = createClient<Database>(URL, SERVICE, { auth: { persistSession: false } });
    await service.from('firms').upsert({ id: FIRM_B, name: 'Foreign Firm B' });
    excAId = await insertException(FIRM_A);
    excBId = await insertException(FIRM_B);

    owner = createClient<Database>(URL, ANON, { auth: { persistSession: false } });
    const { data, error } = await owner.auth.signInWithPassword({
      email: OWNER_EMAIL,
      password: PASSWORD,
    });
    if (error) throw error;
    ownerId = data.user?.id ?? '';
  });

  afterAll(async () => {
    if (service) {
      await service.from('audit_events').delete().eq('entity_id', excAId);
      await service.from('exception_queue').delete().eq('context->>marker', MARKER);
      await service.from('firms').delete().eq('id', FIRM_B); // cascades firm B's exception
    }
    if (owner) await owner.auth.signOut();
  });

  it('lists the open exception and counts it', async () => {
    const open = await listExceptions(owner, { status: 'open' });
    expect(open.some((e) => e.id === excAId)).toBe(true);
    expect(await countOpenExceptions(owner)).toBeGreaterThan(0);
  });

  it('does not see a foreign firm exception (negative RLS)', async () => {
    const all = await listExceptions(owner, { status: 'all' });
    expect(all.some((e) => e.id === excBId)).toBe(false);
  });

  it('resolves, stamping the author and recording the note', async () => {
    const result = await resolveException(owner, excAId, 'resolved', 'corrigido');
    expect(result.ok).toBe(true);

    const { data } = await owner
      .from('exception_queue')
      .select('status, resolution')
      .eq('id', excAId)
      .single();
    expect(data?.status).toBe('resolved');
    const resolution = data?.resolution as { resolvedBy?: string; note?: string };
    expect(resolution.resolvedBy).toBe(ownerId);
    expect(resolution.note).toBe('corrigido');

    const { data: audit } = await owner
      .from('audit_events')
      .select('action')
      .eq('entity_id', excAId)
      .eq('action', 'exception.resolved');
    expect((audit ?? []).length).toBeGreaterThan(0);
  });

  it('rejects a double-resolve (already resolved)', async () => {
    const again = await resolveException(owner, excAId, 'ignored');
    expect(again.ok).toBe(false);
  });

  it('cannot resolve a foreign firm exception', async () => {
    const result = await resolveException(owner, excBId, 'resolved');
    expect(result.ok).toBe(false);
  });
});
