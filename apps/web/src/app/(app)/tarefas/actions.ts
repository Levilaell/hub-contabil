'use server';

import { createTask, handoffTask, updateTaskStatus } from '@hub/db';
import { type TaskStatus, isTaskStatus } from '@hub/core';
import { revalidatePath } from 'next/cache';

import { createClient } from '@/lib/supabase/server';

export type TaskActionState = { ok: boolean; message: string } | null;

function field(formData: FormData, key: string): string {
  const value = formData.get(key);
  return typeof value === 'string' ? value : '';
}

export async function createTaskAction(
  _prev: TaskActionState,
  formData: FormData,
): Promise<TaskActionState> {
  const supabase = await createClient();
  const result = await createTask(supabase, {
    companyId: field(formData, 'companyId'),
    department: field(formData, 'department'),
    title: field(formData, 'title'),
    period: field(formData, 'period'),
    assigneeId: field(formData, 'assigneeId'),
    handoffTo: field(formData, 'handoffTo'),
  });
  if (!result.ok) return { ok: false, message: result.message };
  revalidatePath('/tarefas');
  return { ok: true, message: '' };
}

export async function updateStatusAction(id: string, status: string): Promise<TaskActionState> {
  if (!isTaskStatus(status)) return { ok: false, message: 'Status inválido.' };
  const supabase = await createClient();
  const result = await updateTaskStatus(supabase, id, status as TaskStatus);
  if (!result.ok) return { ok: false, message: result.message };
  revalidatePath('/tarefas');
  return { ok: true, message: '' };
}

export async function handoffAction(id: string): Promise<TaskActionState> {
  const supabase = await createClient();
  const result = await handoffTask(supabase, id);
  if (!result.ok) return { ok: false, message: result.message };
  // 'layout' so the topbar notification badge refreshes (handoff writes one).
  revalidatePath('/tarefas', 'layout');
  return { ok: true, message: '' };
}
