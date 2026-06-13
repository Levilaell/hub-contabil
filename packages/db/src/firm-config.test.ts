import { type SupabaseClient, createClient } from '@supabase/supabase-js';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import type { Database } from './database.types';
import { saveFirmConfig } from './firm-config';

// Integration test for the real save chain (validate → persist → audit) against
// the cloud dev project. Skipped when env is absent (e.g. plain CI).

const URL = process.env.SUPABASE_URL;
const ANON = process.env.SUPABASE_ANON_KEY;
const SERVICE = process.env.SUPABASE_SERVICE_ROLE_KEY;
const PASSWORD = process.env.SEED_PASSWORD ?? 'hub-dev-2026!';
const hasEnv = Boolean(URL && ANON && SERVICE);
const FIRM_A = '11111111-1111-4111-8111-111111111111';

type StoredConfig = { deadlineTriggers?: { defaultDays?: number }; aiThreshold?: number };

async function signedInClient(
  url: string,
  anon: string,
  email: string,
): Promise<SupabaseClient<Database>> {
  const client = createClient<Database>(url, anon, { auth: { persistSession: false } });
  const { error } = await client.auth.signInWithPassword({ email, password: PASSWORD });
  if (error) throw error;
  return client;
}

describe.skipIf(!hasEnv)('saveFirmConfig (cloud dev)', () => {
  let service: SupabaseClient<Database>;
  let owner: SupabaseClient<Database>;
  let staff: SupabaseClient<Database>;
  let ownerId = '';

  beforeAll(async () => {
    if (!URL || !ANON || !SERVICE) throw new Error('missing env');
    service = createClient<Database>(URL, SERVICE, { auth: { persistSession: false } });
    owner = await signedInClient(URL, ANON, 'owner@mrocha.test');
    staff = await signedInClient(URL, ANON, 'staff@mrocha.test');
    const { data } = await owner.auth.getUser();
    ownerId = data.user?.id ?? '';
  });

  afterAll(async () => {
    // Reset config and remove the audit rows this test wrote (service role).
    if (service) {
      await service.from('firms').update({ config: {} }).eq('id', FIRM_A);
      await service.from('audit_events').delete().eq('action', 'firm.config.updated');
    }
    if (owner) await owner.auth.signOut();
    if (staff) await staff.auth.signOut();
  });

  it('owner saves a valid trigger and it is reflected in the DB', async () => {
    const result = await saveFirmConfig(owner, { deadlineDefaultDays: 45, aiThreshold: 0.9 });
    expect(result.ok).toBe(true);
    const { data } = await owner.from('firms').select('config').eq('id', FIRM_A).single();
    const config = (data?.config ?? {}) as StoredConfig;
    expect(config.deadlineTriggers?.defaultDays).toBe(45);
    expect(config.aiThreshold).toBe(0.9);
  });

  it('records an audit event for the change, stamped with the real actor', async () => {
    const { data } = await owner
      .from('audit_events')
      .select('action, actor_id, firm_id')
      .eq('action', 'firm.config.updated')
      .order('created_at', { ascending: false })
      .limit(1)
      .single();
    expect(data?.firm_id).toBe(FIRM_A);
    expect(data?.actor_id).toBe(ownerId);
  });

  it('rejects an invalid trigger with a pt-BR message and does not write', async () => {
    const result = await saveFirmConfig(owner, { deadlineDefaultDays: 0, aiThreshold: 0.9 });
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.message).toMatch(/pelo menos 1 dia/);
    }
    const { data } = await owner.from('firms').select('config').eq('id', FIRM_A).single();
    expect(((data?.config ?? {}) as StoredConfig).deadlineTriggers?.defaultDays).toBe(45);
  });

  it('blocks a staff user from saving (RLS role policy)', async () => {
    const result = await saveFirmConfig(staff, { deadlineDefaultDays: 60, aiThreshold: 0.7 });
    expect(result.ok).toBe(false);
  });
});
