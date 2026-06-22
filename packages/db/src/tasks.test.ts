import { type SupabaseClient, createClient } from '@supabase/supabase-js';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import type { Database } from './database.types';
import { countUnreadNotifications, listNotifications } from './notifications';
import { createTask, handoffTask, listTasks, updateTaskStatus } from './tasks';

// Integration test for tasks + handoff against Supabase Cloud dev. Proves: the
// core transition guard rejects at the db layer; handoff (SECURITY DEFINER)
// creates the next-department task + notification even though the staff caller
// isn't in that department; and department-scoped RLS holds BOTH ways. Skipped
// without env. Seeded staff is in 'fiscal'; handoff targets 'contabil'.

const URL = process.env.SUPABASE_URL;
const ANON = process.env.SUPABASE_ANON_KEY;
const SERVICE = process.env.SUPABASE_SERVICE_ROLE_KEY;
const PASSWORD = process.env.SEED_PASSWORD ?? 'hub-dev-2026!';
const hasEnv = Boolean(URL && ANON && SERVICE);

const FIRM_A = '11111111-1111-4111-8111-111111111111';
// Distinct from other test files — vitest runs them in parallel on the shared cloud DB.
const CNPJ = '99887766000155';

async function signIn(url: string, anon: string, email: string): Promise<SupabaseClient<Database>> {
  const client = createClient<Database>(url, anon, { auth: { persistSession: false } });
  const { error } = await client.auth.signInWithPassword({ email, password: PASSWORD });
  if (error) throw error;
  return client;
}

describe.skipIf(!hasEnv)('tasks + handoff (cloud dev)', () => {
  let service: SupabaseClient<Database>;
  let staff: SupabaseClient<Database>; // department: fiscal
  let manager: SupabaseClient<Database>; // sees all
  let companyId = '';
  let handoffTaskId = '';
  let newTaskId = '';

  beforeAll(async () => {
    if (!URL || !ANON || !SERVICE) throw new Error('missing env');
    service = createClient<Database>(URL, SERVICE, { auth: { persistSession: false } });
    const { data: company, error } = await service
      .from('companies')
      .upsert(
        { firm_id: FIRM_A, cnpj: CNPJ, legal_name: 'Empresa Tarefas' },
        { onConflict: 'firm_id,cnpj' },
      )
      .select('id')
      .single();
    if (error) throw error;
    companyId = company.id;

    staff = await signIn(URL, ANON, 'staff@demo.test');
    manager = await signIn(URL, ANON, 'manager@demo.test');
  });

  afterAll(async () => {
    if (service) {
      // Children first (source_task_id FK is set null on delete, but tidy anyway).
      await service.from('notifications').delete().eq('entity_id', newTaskId);
      await service.from('audit_events').delete().in('entity_id', [handoffTaskId, newTaskId]);
      await service.from('tasks').delete().eq('company_id', companyId);
      await service.from('companies').delete().eq('id', companyId);
    }
    if (staff) await staff.auth.signOut();
    if (manager) await manager.auth.signOut();
  });

  it('rejects an invalid transition at the db layer (pending → done)', async () => {
    const created = await createTask(staff, {
      companyId,
      department: 'fiscal',
      title: 'Apurar impostos',
    });
    expect(created.ok).toBe(true);
    if (!created.ok) return;

    const invalid = await updateTaskStatus(staff, created.id, 'done');
    expect(invalid.ok).toBe(false); // pending → done must pass through in_progress

    const valid = await updateTaskStatus(staff, created.id, 'in_progress');
    expect(valid.ok).toBe(true);
  });

  it('refuses a plain done on a task that has a handoff target', async () => {
    const created = await createTask(staff, {
      companyId,
      department: 'fiscal',
      title: 'Tarefa com repasse',
      handoffTo: 'contabil',
    });
    expect(created.ok).toBe(true);
    if (!created.ok) return;
    expect((await updateTaskStatus(staff, created.id, 'in_progress')).ok).toBe(true);
    // Plain done is refused — completion must go through handoff.
    expect((await updateTaskStatus(staff, created.id, 'done')).ok).toBe(false);
  });

  it('hands off to another department, creating the linked task + notification', async () => {
    const created = await createTask(staff, {
      companyId,
      department: 'fiscal',
      title: 'Fechar competência',
      handoffTo: 'contabil',
    });
    expect(created.ok).toBe(true);
    if (!created.ok) return;
    handoffTaskId = created.id;

    // Staff (fiscal) triggers the handoff into contabil — only possible via the
    // SECURITY DEFINER RPC, since staff can't insert into contabil directly.
    const result = await handoffTask(staff, handoffTaskId);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    newTaskId = result.id;

    // Manager (sees all) confirms the linked task landed in contabil, pending,
    // with no further handoff target (no chain) and the source link set.
    const { data: linked } = await manager
      .from('tasks')
      .select('department, status, handoff_to, source_task_id')
      .eq('id', newTaskId)
      .single();
    expect(linked?.department).toBe('contabil');
    expect(linked?.status).toBe('pending');
    expect(linked?.handoff_to).toBeNull();
    expect(linked?.source_task_id).toBe(handoffTaskId);

    // The notification for contabil exists.
    const notes = await listNotifications(manager);
    expect(notes.some((n) => n.entityId === newTaskId && n.kind === 'handoff')).toBe(true);
  });

  it('hides the contabil task from fiscal staff but shows it to the manager (dept RLS)', async () => {
    const staffTasks = await listTasks(staff);
    expect(staffTasks.some((t) => t.id === newTaskId)).toBe(false); // contabil — not staff's dept
    expect(staffTasks.some((t) => t.department !== 'fiscal')).toBe(false); // staff only sees fiscal

    const managerTasks = await listTasks(manager);
    expect(managerTasks.some((t) => t.id === newTaskId)).toBe(true);

    // Direct read by staff is also blocked (RLS, not just the list filter).
    const { data: direct } = await staff.from('tasks').select('id').eq('id', newTaskId);
    expect(direct).toEqual([]);
  });

  it('surfaces the handoff notification to contabil-side visibility (manager unread > 0)', async () => {
    expect(await countUnreadNotifications(manager)).toBeGreaterThan(0);
  });
});
