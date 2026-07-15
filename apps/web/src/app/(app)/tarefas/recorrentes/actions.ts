'use server';

import {
  createRecurringTask,
  deactivateRecurringTask,
  setRecurringTaskActive,
  updateRecurringTask,
  type RecurringTargetKind,
} from '@hub/db';
import { revalidatePath } from 'next/cache';

import { createClient } from '@/lib/supabase/server';

export type RecurringActionState = { ok: boolean; message: string } | null;

function parse(formData: FormData) {
  const field = (key: string) => {
    const v = formData.get(key);
    return typeof v === 'string' ? v : '';
  };
  return {
    title: field('title'),
    department: field('department'),
    generationDay: Number(field('generationDay')),
    targetKind: field('targetKind') as RecurringTargetKind,
    companyIds: formData.getAll('companyIds').filter((v): v is string => typeof v === 'string'),
    regimes: formData.getAll('regimes').filter((v): v is string => typeof v === 'string'),
    handoffTo: field('handoffTo'),
    defaultAssigneeId: field('defaultAssigneeId'),
  };
}

export async function createRecurringAction(
  _prev: RecurringActionState,
  formData: FormData,
): Promise<RecurringActionState> {
  const supabase = await createClient();
  const result = await createRecurringTask(supabase, parse(formData));
  if (!result.ok) return { ok: false, message: result.message };
  revalidatePath('/tarefas/recorrentes');
  return { ok: true, message: '' };
}

export async function updateRecurringAction(
  id: string,
  _prev: RecurringActionState,
  formData: FormData,
): Promise<RecurringActionState> {
  const supabase = await createClient();
  const result = await updateRecurringTask(supabase, id, parse(formData));
  if (!result.ok) return { ok: false, message: result.message };
  revalidatePath('/tarefas/recorrentes');
  return { ok: true, message: '' };
}

export async function toggleRecurringActiveAction(id: string, active: boolean): Promise<void> {
  const supabase = await createClient();
  await setRecurringTaskActive(supabase, id, active);
  revalidatePath('/tarefas/recorrentes');
}

export type DeactivateActionState =
  | { ok: true; cancelled: number }
  | { ok: false; message: string };

// Deactivate + optionally cancel the template's open instances (T39, decision #2).
export async function deactivateRecurringAction(
  id: string,
  cancelOpen: boolean,
): Promise<DeactivateActionState> {
  const supabase = await createClient();
  const result = await deactivateRecurringTask(supabase, id, cancelOpen);
  if (!result.ok) return { ok: false, message: result.message };
  revalidatePath('/tarefas/recorrentes');
  revalidatePath('/tarefas');
  return { ok: true, cancelled: result.cancelled };
}
