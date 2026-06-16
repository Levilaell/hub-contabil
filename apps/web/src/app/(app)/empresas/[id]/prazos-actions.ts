'use server';

import { createMonitoredDocument, deleteMonitoredDocument, updateMonitoredDocument } from '@hub/db';
import { revalidatePath } from 'next/cache';

import { createClient } from '@/lib/supabase/server';

export type PrazoActionState = { ok: boolean; message: string } | null;

function parse(companyId: string, formData: FormData) {
  const field = (key: string) => {
    const v = formData.get(key);
    return typeof v === 'string' ? v : '';
  };
  return {
    companyId,
    docKind: field('docKind'),
    dueDate: field('dueDate') || null,
    triggerDays: Number(field('triggerDays')),
    documentId: field('documentId') || null,
  };
}

export async function createPrazoAction(
  companyId: string,
  _prev: PrazoActionState,
  formData: FormData,
): Promise<PrazoActionState> {
  const supabase = await createClient();
  const result = await createMonitoredDocument(supabase, parse(companyId, formData));
  if (!result.ok) return { ok: false, message: result.message };
  revalidatePath(`/empresas/${companyId}`);
  return { ok: true, message: '' };
}

export async function updatePrazoAction(
  id: string,
  companyId: string,
  _prev: PrazoActionState,
  formData: FormData,
): Promise<PrazoActionState> {
  const supabase = await createClient();
  const result = await updateMonitoredDocument(supabase, id, parse(companyId, formData));
  if (!result.ok) return { ok: false, message: result.message };
  revalidatePath(`/empresas/${companyId}`);
  return { ok: true, message: '' };
}

export async function deletePrazoAction(id: string, companyId: string): Promise<void> {
  const supabase = await createClient();
  await deleteMonitoredDocument(supabase, id);
  revalidatePath(`/empresas/${companyId}`);
}
