import type { SupabaseClient } from '@supabase/supabase-js';

import { loadFirm } from './firm';

// Recurring task templates (T11). Managed by owner/manager (RLS-enforced); the
// worker's recurrences-monthly cron reads active templates and generates tasks.

export type RecurringTargetKind = 'all' | 'selection' | 'by_regime';

export interface RecurringTask {
  id: string;
  title: string;
  department: string;
  generationDay: number;
  targetKind: RecurringTargetKind;
  targetValue: Record<string, unknown>;
  handoffTo: string | null;
  /** Optional owner stamped on every generated task (T28). */
  defaultAssigneeId: string | null;
  active: boolean;
}

interface RecurringRow {
  id: string;
  title: string;
  department: string;
  generation_day: number;
  target_kind: string;
  target_value: unknown;
  handoff_to: string | null;
  default_assignee_id: string | null;
  active: boolean;
}

export interface RecurringTaskInput {
  title: string;
  department: string;
  generationDay: number;
  targetKind: RecurringTargetKind;
  companyIds?: string[];
  regimes?: string[];
  handoffTo?: string | null;
  defaultAssigneeId?: string | null;
}

export type RecurringMutationResult = { ok: true; id: string } | { ok: false; message: string };

const SELECT =
  'id, title, department, generation_day, target_kind, target_value, handoff_to, default_assignee_id, active';

function fail(message: string): { ok: false; message: string } {
  return { ok: false, message };
}

function clean(value: unknown): string | null {
  if (typeof value !== 'string') return null;
  const trimmed = value.trim();
  return trimmed.length ? trimmed : null;
}

function asObject(value: unknown): Record<string, unknown> {
  let parsed = value;
  if (typeof parsed === 'string') {
    try {
      parsed = JSON.parse(parsed);
    } catch {
      return {};
    }
  }
  return parsed && typeof parsed === 'object' ? (parsed as Record<string, unknown>) : {};
}

function mapRecurring(row: RecurringRow): RecurringTask {
  const kind: RecurringTargetKind =
    row.target_kind === 'selection' || row.target_kind === 'by_regime' ? row.target_kind : 'all';
  return {
    id: row.id,
    title: row.title,
    department: row.department,
    generationDay: row.generation_day,
    targetKind: kind,
    targetValue: asObject(row.target_value),
    handoffTo: row.handoff_to,
    defaultAssigneeId: row.default_assignee_id,
    active: row.active,
  };
}

// Validate + build the persistable columns shared by create/update.
function buildColumns(
  input: RecurringTaskInput,
): { ok: true; columns: Record<string, unknown> } | { ok: false; message: string } {
  const title = clean(input.title);
  if (!title) return fail('Informe o título.');
  const department = clean(input.department);
  if (!department) return fail('Informe o departamento.');

  const day = Math.trunc(Number(input.generationDay));
  if (!Number.isFinite(day) || day < 1 || day > 28) {
    return fail('O dia de geração deve ser entre 1 e 28.');
  }

  let targetValue: Record<string, unknown> = {};
  if (input.targetKind === 'selection') {
    const ids = (input.companyIds ?? []).filter((v) => typeof v === 'string' && v.length > 0);
    if (ids.length === 0) return fail('Selecione ao menos uma empresa.');
    targetValue = { companyIds: ids };
  } else if (input.targetKind === 'by_regime') {
    const regimes = (input.regimes ?? []).filter((v) => typeof v === 'string' && v.length > 0);
    if (regimes.length === 0) return fail('Selecione ao menos um regime.');
    targetValue = { regimes };
  } else if (input.targetKind !== 'all') {
    return fail('Alvo inválido.');
  }

  return {
    ok: true,
    columns: {
      title,
      department,
      generation_day: day,
      target_kind: input.targetKind,
      target_value: targetValue,
      handoff_to: clean(input.handoffTo),
      default_assignee_id: clean(input.defaultAssigneeId),
    },
  };
}

export async function listRecurringTasks(supabase: SupabaseClient): Promise<RecurringTask[]> {
  const { data, error } = await supabase
    .from('recurring_tasks')
    .select(SELECT)
    .order('created_at', { ascending: false });
  if (error || !data) return [];
  return (data as RecurringRow[]).map(mapRecurring);
}

export async function createRecurringTask(
  supabase: SupabaseClient,
  input: RecurringTaskInput,
): Promise<RecurringMutationResult> {
  const firm = await loadFirm(supabase);
  if (!firm) return fail('Não foi possível identificar o escritório.');

  const built = buildColumns(input);
  if (!built.ok) return built;

  const { data, error } = await supabase
    .from('recurring_tasks')
    .insert({ firm_id: firm.id, ...built.columns })
    .select('id')
    .single();
  if (error || !data) {
    return fail(
      'Não foi possível salvar — apenas titulares e gestores podem gerenciar recorrências.',
    );
  }

  await supabase.rpc('log_audit', {
    p_action: 'recurring_task.created',
    p_entity: 'recurring_task',
    p_entity_id: data.id,
    p_context: { title: built.columns.title, targetKind: input.targetKind },
  });
  return { ok: true, id: data.id };
}

export async function updateRecurringTask(
  supabase: SupabaseClient,
  id: string,
  input: RecurringTaskInput,
): Promise<RecurringMutationResult> {
  const built = buildColumns(input);
  if (!built.ok) return built;

  const { data, error } = await supabase
    .from('recurring_tasks')
    .update(built.columns)
    .eq('id', id)
    .select('id');
  if (error || !data || data.length === 0) {
    return fail('Não foi possível salvar — verifique suas permissões.');
  }

  await supabase.rpc('log_audit', {
    p_action: 'recurring_task.updated',
    p_entity: 'recurring_task',
    p_entity_id: id,
    p_context: { title: built.columns.title },
  });
  return { ok: true, id };
}

export type DeactivateResult = { ok: true; cancelled: number } | { ok: false; message: string };

/**
 * Deactivate a template via the deactivate_recurring_task RPC (T39, decision #2):
 * atomically flips `active` and — when `cancelOpen` — cancels the template's
 * still-open instances (audited per task). Returns how many were cancelled.
 */
export async function deactivateRecurringTask(
  supabase: SupabaseClient,
  id: string,
  cancelOpen: boolean,
): Promise<DeactivateResult> {
  const { data, error } = await supabase.rpc('deactivate_recurring_task', {
    p_template_id: id,
    p_cancel_open: cancelOpen,
  });
  if (error)
    return { ok: false, message: 'Não foi possível desativar — verifique suas permissões.' };
  return { ok: true, cancelled: typeof data === 'number' ? data : 0 };
}

export async function setRecurringTaskActive(
  supabase: SupabaseClient,
  id: string,
  active: boolean,
): Promise<RecurringMutationResult> {
  const { data, error } = await supabase
    .from('recurring_tasks')
    .update({ active })
    .eq('id', id)
    .select('id');
  if (error || !data || data.length === 0) {
    return fail('Não foi possível atualizar — verifique suas permissões.');
  }

  await supabase.rpc('log_audit', {
    p_action: active ? 'recurring_task.activated' : 'recurring_task.deactivated',
    p_entity: 'recurring_task',
    p_entity_id: id,
    p_context: {},
  });
  return { ok: true, id };
}
