import { buildAuditEvent } from '@hub/core';
import { type SupabaseClient, createClient } from '@supabase/supabase-js';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import type { Database } from './database.types';

// Integration test against the linked Supabase Cloud dev project. Proves tenant
// isolation BOTH ways (a deny-all policy would pass the negative case alone) and
// that the audit insert path works. Skipped when env is absent (e.g. plain CI).

const URL = process.env.SUPABASE_URL;
const ANON = process.env.SUPABASE_ANON_KEY;
const SERVICE = process.env.SUPABASE_SERVICE_ROLE_KEY;
const PASSWORD = process.env.SEED_PASSWORD ?? 'hub-dev-2026!';
const hasEnv = Boolean(URL && ANON && SERVICE);

const FIRM_A = '11111111-1111-4111-8111-111111111111'; // Demo (seeded)
const FIRM_B = '99999999-9999-4999-8999-999999999990'; // foreign firm, created here
const OWNER_EMAIL = 'owner@demo.test';
const TEST_ACTION = 'rls.test.performed';

describe.skipIf(!hasEnv)('RLS tenant isolation (cloud dev)', () => {
  let service: SupabaseClient<Database>;
  let session: SupabaseClient<Database>;
  let ownerId = '';

  beforeAll(async () => {
    if (!URL || !ANON || !SERVICE) throw new Error('missing env');
    // Service role (bypasses RLS) sets up a foreign firm the Demo user must not see.
    service = createClient<Database>(URL, SERVICE, { auth: { persistSession: false } });
    const { error: setupError } = await service
      .from('firms')
      .upsert({ id: FIRM_B, name: 'Foreign Firm B' });
    if (setupError) throw setupError;

    // Anon key + a real user session — the path RLS actually guards.
    session = createClient<Database>(URL, ANON, { auth: { persistSession: false } });
    const { data, error } = await session.auth.signInWithPassword({
      email: OWNER_EMAIL,
      password: PASSWORD,
    });
    if (error) throw error;
    ownerId = data.user?.id ?? '';
  });

  afterAll(async () => {
    // Teardown: drop firm B (cascades its rows) and any audit rows this test wrote.
    if (service) {
      await service.from('audit_events').delete().eq('action', TEST_ACTION);
      await service.from('firms').delete().eq('id', FIRM_B);
    }
    if (session) await session.auth.signOut();
  });

  it('carries firm_id in the JWT app_metadata', async () => {
    const { data } = await session.auth.getSession();
    expect(data.session?.user.app_metadata.firm_id).toBe(FIRM_A);
  });

  it('sees its own firm (positive)', async () => {
    const { data, error } = await session.from('firms').select('id, name');
    expect(error).toBeNull();
    expect(data?.length ?? 0).toBeGreaterThan(0);
    expect((data ?? []).every((firm) => firm.id === FIRM_A)).toBe(true);
  });

  it('cannot see a foreign firm (negative)', async () => {
    const { data, error } = await session.from('firms').select('id').eq('id', FIRM_B);
    expect(error).toBeNull();
    expect(data).toEqual([]);
  });

  it('sees only its own firm users', async () => {
    const { data, error } = await session.from('users').select('id, firm_id');
    expect(error).toBeNull();
    expect(data?.length ?? 0).toBeGreaterThan(0);
    expect((data ?? []).every((user) => user.firm_id === FIRM_A)).toBe(true);
  });

  it('records an audit event (service role) that the firm user can read back', async () => {
    const row = buildAuditEvent({
      firmId: FIRM_A,
      actorId: ownerId,
      action: TEST_ACTION,
      entity: 'firm',
      entityId: FIRM_A,
      context: { source: 'rls.test' },
    });
    // Audit writes go through the service role (server-side), never the client.
    const { data: inserted, error: writeError } = await service
      .from('audit_events')
      .insert(row)
      .select('id')
      .single();
    expect(writeError).toBeNull();
    if (!inserted) throw new Error('audit insert returned no row');

    // The firm's user can read its own audit trail (RLS select).
    const { data, error } = await session
      .from('audit_events')
      .select('action, firm_id')
      .eq('id', inserted.id)
      .single();
    expect(error).toBeNull();
    expect(data?.action).toBe(TEST_ACTION);
    expect(data?.firm_id).toBe(FIRM_A);
  });

  it('blocks an authenticated user from writing the audit trail (server-write-only)', async () => {
    const { error } = await session
      .from('audit_events')
      .insert(buildAuditEvent({ firmId: FIRM_A, action: 'forged', entity: 'firm' }));
    expect(error).not.toBeNull();
  });
});
