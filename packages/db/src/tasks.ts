import { canTransitionTask, type TaskStatus } from '@hub/core';
import type { SupabaseClient } from '@supabase/supabase-js';

import { loadFirm } from './firm';

// Task use cases (T10). Transitions are validated against the core state machine
// (single source of truth). Handoff is a cross-department write, so it goes
// through the handoff_task RPC, not a direct insert.

export interface Task {
  id: string;
  companyId: string;
  period: string | null;
  department: string;
  title: string;
  status: TaskStatus;
  assigneeId: string | null;
  handoffTo: string | null;
  sourceTaskId: string | null;
  createdAt: string;
}

interface TaskRow {
  id: string;
  company_id: string;
  period: string | null;
  department: string;
  title: string;
  status: string;
  assignee_id: string | null;
  handoff_to: string | null;
  source_task_id: string | null;
  created_at: string;
}

export interface TaskInput {
  companyId: string;
  department: string;
  title: string;
  period?: string | null;
  assigneeId?: string | null;
  handoffTo?: string | null;
}

export type TaskMutationResult = { ok: true; id: string } | { ok: false; message: string };

const SELECT =
  'id, company_id, period, department, title, status, assignee_id, handoff_to, source_task_id, created_at';

function fail(message: string): { ok: false; message: string } {
  return { ok: false, message };
}

function clean(value: unknown): string | null {
  if (typeof value !== 'string') return null;
  const trimmed = value.trim();
  return trimmed.length ? trimmed : null;
}

function mapTask(row: TaskRow): Task {
  return {
    id: row.id,
    companyId: row.company_id,
    period: row.period,
    department: row.department,
    title: row.title,
    status: (row.status as TaskStatus) ?? 'pending',
    assigneeId: row.assignee_id,
    handoffTo: row.handoff_to,
    sourceTaskId: row.source_task_id,
    createdAt: row.created_at,
  };
}

export async function listTasks(
  supabase: SupabaseClient,
  opts?: {
    status?: TaskStatus;
    department?: string;
    companyId?: string;
    assigneeId?: string;
    /** Competência filter (YYYY-MM). */
    period?: string;
    /** With `period`: also include tasks without a competência (ad-hoc). */
    includeNoPeriod?: boolean;
  },
): Promise<Task[]> {
  let query = supabase.from('tasks').select(SELECT);
  if (opts?.status) query = query.eq('status', opts.status);
  if (opts?.department) query = query.eq('department', opts.department);
  if (opts?.companyId) query = query.eq('company_id', opts.companyId);
  if (opts?.assigneeId) query = query.eq('assignee_id', opts.assigneeId);
  if (opts?.period && /^\d{4}-\d{2}$/.test(opts.period)) {
    query = opts.includeNoPeriod
      ? query.or(`period.eq.${opts.period},period.is.null`)
      : query.eq('period', opts.period);
  }
  const { data, error } = await query.order('created_at', { ascending: false });
  if (error || !data) return [];
  return (data as TaskRow[]).map(mapTask);
}

/**
 * Generate the current-month recurring tasks for a just-registered company via
 * the generate_recurring_tasks_for_company RPC (Fase 1.1 §2). Best-effort:
 * callers treat failure as non-fatal so registration never breaks.
 */
export async function generateRecurringTasksForCompany(
  supabase: SupabaseClient,
  companyId: string,
): Promise<{ ok: boolean; created: number }> {
  const { data, error } = await supabase.rpc('generate_recurring_tasks_for_company', {
    p_company_id: companyId,
  });
  if (error) return { ok: false, created: 0 };
  return { ok: true, created: typeof data === 'number' ? data : 0 };
}

/** Count of tasks the caller can see that are still open (dashboard, T13). */
export async function countOpenTasks(supabase: SupabaseClient): Promise<number> {
  const { count, error } = await supabase
    .from('tasks')
    .select('id', { count: 'exact', head: true })
    .in('status', ['pending', 'in_progress']);
  if (error) return 0;
  return count ?? 0;
}

export async function createTask(
  supabase: SupabaseClient,
  input: TaskInput,
): Promise<TaskMutationResult> {
  const firm = await loadFirm(supabase);
  if (!firm) return fail('Não foi possível identificar o escritório.');

  const title = clean(input.title);
  const department = clean(input.department);
  const companyId = clean(input.companyId);
  if (!title) return fail('Informe o título da tarefa.');
  if (!department) return fail('Informe o departamento.');
  if (!companyId) return fail('Empresa não informada.');

  const { data, error } = await supabase
    .from('tasks')
    .insert({
      firm_id: firm.id,
      company_id: companyId,
      department,
      title,
      period: clean(input.period),
      assignee_id: clean(input.assigneeId),
      handoff_to: clean(input.handoffTo),
    })
    .select('id')
    .single();
  if (error || !data) {
    return fail('Não foi possível criar a tarefa — verifique suas permissões e o departamento.');
  }

  await supabase.rpc('log_audit', {
    p_action: 'task.created',
    p_entity: 'task',
    p_entity_id: data.id,
    p_context: { department, companyId },
  });
  return { ok: true, id: data.id };
}

export async function updateTaskStatus(
  supabase: SupabaseClient,
  id: string,
  toStatus: TaskStatus,
): Promise<TaskMutationResult> {
  const { data: current, error: readError } = await supabase
    .from('tasks')
    .select('status, handoff_to')
    .eq('id', id)
    .maybeSingle();
  if (readError || !current) return fail('Tarefa não encontrada.');

  // Single source of transition truth — same function the UI uses to gate buttons.
  if (!canTransitionTask(current.status as TaskStatus, toStatus)) {
    return fail('Transição de status inválida.');
  }

  // A task with a handoff target must be completed via handoff (which creates the
  // next department's task), not a plain "done" — make the spec a real invariant,
  // not just a UI convention.
  if (toStatus === 'done' && current.handoff_to) {
    return fail('Esta tarefa tem repasse — conclua repassando ao próximo departamento.');
  }

  const { data, error } = await supabase
    .from('tasks')
    .update({ status: toStatus })
    .eq('id', id)
    .select('id');
  if (error || !data || data.length === 0) {
    return fail('Não foi possível atualizar — verifique suas permissões.');
  }

  await supabase.rpc('log_audit', {
    p_action: 'task.status_changed',
    p_entity: 'task',
    p_entity_id: id,
    p_context: { from: current.status, to: toStatus },
  });
  return { ok: true, id };
}

/** Complete a task and create the next department's linked task (handoff_task RPC). */
export async function handoffTask(
  supabase: SupabaseClient,
  id: string,
): Promise<TaskMutationResult> {
  const { data, error } = await supabase.rpc('handoff_task', { p_task_id: id });
  if (error || !data) return fail('Não foi possível repassar a tarefa.');
  return { ok: true, id: data as string };
}
