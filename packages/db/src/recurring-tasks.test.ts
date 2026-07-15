import { type SupabaseClient, createClient } from '@supabase/supabase-js';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import type { Database } from './database.types';
import {
  createRecurringTask,
  deactivateRecurringTask,
  listRecurringTasks,
  setRecurringTaskActive,
} from './recurring-tasks';

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

  // T39 (decision #2): the deactivate RPC cancels the template's OPEN instances
  // only, audits per task, blocks staff, and returns the cancelled count.
  it('deactivate RPC cancels open instances but not finished ones', async () => {
    const created = await createRecurringTask(manager, {
      title: 'Rotina T39',
      department: 'fiscal',
      generationDay: 5,
      targetKind: 'all',
    });
    expect(created.ok).toBe(true);
    if (!created.ok) return;
    const templateId = created.id;
    const taskIds: string[] = [];

    try {
      const { data: firm } = await service.from('firms').select('id').limit(1).single();
      const { data: company } = await service.from('companies').select('id').limit(1).single();
      expect(firm && company).toBeTruthy();
      const base = {
        firm_id: firm!.id,
        company_id: company!.id,
        department: 'fiscal',
        recurring_task_id: templateId,
        period: '2026-07',
      };
      const { data: inserted } = await service
        .from('tasks')
        .insert([
          { ...base, title: 'Aberta T39', status: 'pending' },
          { ...base, title: 'Concluída T39', status: 'done', period: '2026-06' },
        ])
        .select('id');
      expect(inserted?.length).toBe(2);
      taskIds.push(...(inserted ?? []).map((t) => t.id as string));

      // Staff cannot manage templates — the RPC role gate must hold.
      const blocked = await deactivateRecurringTask(staff, templateId, true);
      expect(blocked.ok).toBe(false);

      const res = await deactivateRecurringTask(manager, templateId, true);
      expect(res).toEqual({ ok: true, cancelled: 1 });

      const { data: after } = await service
        .from('tasks')
        .select('title, status')
        .in('id', taskIds)
        .order('title');
      expect(after).toEqual([
        { title: 'Aberta T39', status: 'canceled' },
        { title: 'Concluída T39', status: 'done' },
      ]);

      const { data: template } = await service
        .from('recurring_tasks')
        .select('active')
        .eq('id', templateId)
        .single();
      expect(template?.active).toBe(false);

      const { data: audits } = await service
        .from('audit_events')
        .select('action, entity_id')
        .in('entity_id', [templateId, ...taskIds]);
      expect(audits?.some((a) => a.action === 'recurring_task.deactivated')).toBe(true);
      expect(
        audits?.filter((a) => a.action === 'task.status_changed' && a.entity_id === taskIds[0])
          .length,
      ).toBe(1);
    } finally {
      if (taskIds.length) {
        await service.from('audit_events').delete().in('entity_id', taskIds);
        await service.from('tasks').delete().in('id', taskIds);
      }
      await service.from('audit_events').delete().eq('entity_id', templateId);
      await service.from('recurring_tasks').delete().eq('id', templateId);
    }
  });
});
