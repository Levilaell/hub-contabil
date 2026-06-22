import { type SupabaseClient, createClient } from '@supabase/supabase-js';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import type { Database } from './database.types';
import { createRecurringTask, listRecurringTasks, setRecurringTaskActive } from './recurring-tasks';

// Integration test for recurring-task templates against Supabase Cloud dev.
// Proves manager-only management (RLS) + validation. Skipped without env.

const URL = process.env.SUPABASE_URL;
const ANON = process.env.SUPABASE_ANON_KEY;
const SERVICE = process.env.SUPABASE_SERVICE_ROLE_KEY;
const PASSWORD = process.env.SEED_PASSWORD ?? 'hub-dev-2026!';
const hasEnv = Boolean(URL && ANON && SERVICE);

async function signIn(url: string, anon: string, email: string): Promise<SupabaseClient<Database>> {
  const client = createClient<Database>(url, anon, { auth: { persistSession: false } });
  const { error } = await client.auth.signInWithPassword({ email, password: PASSWORD });
  if (error) throw error;
  return client;
}

describe.skipIf(!hasEnv)('recurring tasks (cloud dev)', () => {
  let service: SupabaseClient<Database>;
  let manager: SupabaseClient<Database>;
  let staff: SupabaseClient<Database>;
  let createdId = '';

  beforeAll(async () => {
    if (!URL || !ANON || !SERVICE) throw new Error('missing env');
    service = createClient<Database>(URL, SERVICE, { auth: { persistSession: false } });
    manager = await signIn(URL, ANON, 'manager@demo.test');
    staff = await signIn(URL, ANON, 'staff@demo.test');
  });

  afterAll(async () => {
    if (service && createdId) {
      await service.from('audit_events').delete().eq('entity_id', createdId);
      await service.from('recurring_tasks').delete().eq('id', createdId);
    }
    if (manager) await manager.auth.signOut();
    if (staff) await staff.auth.signOut();
  });

  it('lets a manager create a template but blocks staff (RLS)', async () => {
    const created = await createRecurringTask(manager, {
      title: 'Rotina mensal',
      department: 'fiscal',
      generationDay: 5,
      targetKind: 'all',
    });
    expect(created.ok).toBe(true);
    if (created.ok) createdId = created.id;

    const blocked = await createRecurringTask(staff, {
      title: 'Tentativa staff',
      department: 'fiscal',
      generationDay: 5,
      targetKind: 'all',
    });
    expect(blocked.ok).toBe(false);

    const list = await listRecurringTasks(manager);
    expect(list.some((t) => t.id === createdId)).toBe(true);

    // Staff can READ templates (firm-scoped select), just not manage them — so the
    // recorrentes screen isn't empty for them.
    const staffList = await listRecurringTasks(staff);
    expect(staffList.some((t) => t.id === createdId)).toBe(true);
  });

  it('validates that a selection target needs at least one company', async () => {
    const result = await createRecurringTask(manager, {
      title: 'Seleção vazia',
      department: 'fiscal',
      generationDay: 5,
      targetKind: 'selection',
      companyIds: [],
    });
    expect(result.ok).toBe(false);
  });

  it('toggles a template active flag', async () => {
    expect((await setRecurringTaskActive(manager, createdId, false)).ok).toBe(true);
    const list = await listRecurringTasks(manager);
    expect(list.find((t) => t.id === createdId)?.active).toBe(false);
  });
});
