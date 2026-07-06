'use server';

import { type MappingRuleLevel } from '@hub/core';
import { applyTriageSuggestion, resolveException, saveResolutionAsRule } from '@hub/db';
import { revalidatePath } from 'next/cache';

import { createClient } from '@/lib/supabase/server';

export type ResolveActionState = { ok: boolean; message: string } | null;

export async function resolveExceptionAction(
  id: string,
  status: 'resolved' | 'ignored',
  note: string,
): Promise<ResolveActionState> {
  const supabase = await createClient();
  const result = await resolveException(supabase, id, status, note || undefined);
  if (!result.ok) return { ok: false, message: result.message };
  // 'layout' scope so the sidebar open-count badge refreshes too, not just the list.
  revalidatePath('/excecoes', 'layout');
  return { ok: true, message: '' };
}

// Resolve a 'triage' pending by APPLYING the reviewed suggestion to the document
// (Fase 1.1 §3): type/company/department + few-shot example + resolve, one RPC.
export async function applyTriageSuggestionAction(
  exceptionId: string,
  payload: { docType: string; companyId: string | null; department: string | null; note: string },
): Promise<ResolveActionState> {
  if (!payload.docType) return { ok: false, message: 'Escolha o tipo do documento.' };
  const supabase = await createClient();
  const result = await applyTriageSuggestion(supabase, {
    exceptionId,
    docType: payload.docType,
    companyId: payload.companyId,
    department: payload.department,
    note: payload.note || undefined,
  });
  if (!result.ok) return { ok: false, message: result.message };
  revalidatePath('/excecoes', 'layout');
  revalidatePath('/documentos');
  return { ok: true, message: '' };
}

export interface SaveRulePayload {
  domain: string;
  level: number;
  key: Record<string, unknown>;
  value: Record<string, unknown>;
}

// Resolve a 'rules' pending by saving it as a mapping rule (T18). The new rule
// auto-resolves the next identical case via the engine; this also marks the
// pending resolved in one round trip.
export async function saveRuleFromExceptionAction(
  exceptionId: string,
  payload: SaveRulePayload,
): Promise<ResolveActionState> {
  if (payload.level !== 1 && payload.level !== 2) {
    return { ok: false, message: 'Precedência inválida.' };
  }
  if (!payload.domain || Object.keys(payload.key).length === 0) {
    return { ok: false, message: 'Dados da regra incompletos.' };
  }
  const supabase = await createClient();
  const result = await saveResolutionAsRule(supabase, {
    exceptionId,
    input: {
      domain: payload.domain,
      level: payload.level as MappingRuleLevel,
      key: payload.key,
      value: payload.value,
    },
  });
  if (!result.ok) return { ok: false, message: result.message };
  revalidatePath('/excecoes', 'layout');
  return { ok: true, message: '' };
}
