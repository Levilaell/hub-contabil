import { parseFirmConfig } from '@hub/config';
import { deriveMonitoredStatus, type MonitoredStatus } from '@hub/core';
import type { SupabaseClient } from '@supabase/supabase-js';

import { loadFirm } from './firm';

// Monitored-document use cases (T14). status is recomputed on read from due_date so
// panels are never stale (the stored column is the cron's cache); a row already in
// 'needs_update' (set by the exception flow) is preserved, never recomputed.

export interface MonitoredDoc {
  id: string;
  companyId: string;
  docKind: string;
  dueDate: string | null;
  triggerDays: number;
  status: MonitoredStatus;
  documentId: string | null;
  createdAt: string;
}

interface MonitoredRow {
  id: string;
  company_id: string;
  doc_kind: string;
  due_date: string | null;
  trigger_days: number;
  status: string;
  document_id: string | null;
  created_at: string;
}

export interface MonitoredInput {
  companyId: string;
  docKind: string;
  dueDate: string | null;
  triggerDays: number;
  documentId?: string | null;
}

export type MonitoredMutationResult = { ok: true; id: string } | { ok: false; message: string };

const SELECT = 'id, company_id, doc_kind, due_date, trigger_days, status, document_id, created_at';

function fail(message: string): { ok: false; message: string } {
  return { ok: false, message };
}

/** Firm-local "today" (Brazil, v1) as YYYY-MM-DD. The only clock read — core stays pure. */
export function firmToday(): string {
  return new Date().toLocaleDateString('en-CA', { timeZone: 'America/Sao_Paulo' });
}

function mapMonitored(row: MonitoredRow, today: string): MonitoredDoc {
  // Recompute on read, EXCEPT needs_update (owned by the exception flow).
  const status: MonitoredStatus =
    row.status === 'needs_update'
      ? 'needs_update'
      : deriveMonitoredStatus(row.due_date, row.trigger_days, today);
  return {
    id: row.id,
    companyId: row.company_id,
    docKind: row.doc_kind,
    dueDate: row.due_date,
    triggerDays: row.trigger_days,
    status,
    documentId: row.document_id,
    createdAt: row.created_at,
  };
}

export async function listMonitoredDocuments(
  supabase: SupabaseClient,
  opts?: { companyId?: string },
): Promise<MonitoredDoc[]> {
  let query = supabase.from('monitored_documents').select(SELECT);
  if (opts?.companyId) query = query.eq('company_id', opts.companyId);
  const { data, error } = await query.order('due_date', { ascending: true, nullsFirst: false });
  if (error || !data) return [];
  const today = firmToday();
  return (data as MonitoredRow[]).map((r) => mapMonitored(r, today));
}

function validate(
  input: MonitoredInput,
  config: ReturnType<typeof parseFirmConfig>,
): { ok: true; dueDate: string | null; triggerDays: number } | { ok: false; message: string } {
  if (!config.monitoredKinds.some((k) => k.key === input.docKind)) {
    return fail('Tipo de certidão inválido.');
  }
  const dueDate = input.dueDate && /^\d{4}-\d{2}-\d{2}$/.test(input.dueDate) ? input.dueDate : null;
  if (input.dueDate && !dueDate) return fail('Data de vencimento inválida.');
  const triggerDays = Math.trunc(Number(input.triggerDays));
  if (!Number.isFinite(triggerDays) || triggerDays < 0 || triggerDays > 365) {
    return fail('O prazo de alerta deve ser entre 0 e 365 dias.');
  }
  return { ok: true, dueDate, triggerDays };
}

export async function createMonitoredDocument(
  supabase: SupabaseClient,
  input: MonitoredInput,
): Promise<MonitoredMutationResult> {
  const firm = await loadFirm(supabase);
  if (!firm) return fail('Não foi possível identificar o escritório.');
  const v = validate(input, parseFirmConfig(firm.config));
  if (!v.ok) return v;

  const status = deriveMonitoredStatus(v.dueDate, v.triggerDays, firmToday());
  const { data, error } = await supabase
    .from('monitored_documents')
    .insert({
      firm_id: firm.id,
      company_id: input.companyId,
      doc_kind: input.docKind,
      due_date: v.dueDate,
      trigger_days: v.triggerDays,
      status,
      document_id: input.documentId ?? null,
    })
    .select('id')
    .single();
  if (error || !data) return fail('Não foi possível salvar — verifique suas permissões.');

  await supabase.rpc('log_audit', {
    p_action: 'monitored_document.created',
    p_entity: 'monitored_document',
    p_entity_id: data.id,
    p_context: { companyId: input.companyId, docKind: input.docKind },
  });
  return { ok: true, id: data.id };
}

export async function updateMonitoredDocument(
  supabase: SupabaseClient,
  id: string,
  input: MonitoredInput,
): Promise<MonitoredMutationResult> {
  const firm = await loadFirm(supabase);
  if (!firm) return fail('Não foi possível identificar o escritório.');
  const v = validate(input, parseFirmConfig(firm.config));
  if (!v.ok) return v;

  // Editing is an explicit update of the dated data → recompute the date status
  // (clears any prior needs_update; the user is resolving it).
  const status = deriveMonitoredStatus(v.dueDate, v.triggerDays, firmToday());
  const { data, error } = await supabase
    .from('monitored_documents')
    .update({
      doc_kind: input.docKind,
      due_date: v.dueDate,
      trigger_days: v.triggerDays,
      status,
      document_id: input.documentId ?? null,
    })
    .eq('id', id)
    .select('id');
  if (error || !data || data.length === 0) {
    return fail('Não foi possível salvar — verifique suas permissões.');
  }

  await supabase.rpc('log_audit', {
    p_action: 'monitored_document.updated',
    p_entity: 'monitored_document',
    p_entity_id: id,
    p_context: { docKind: input.docKind },
  });
  return { ok: true, id };
}

export async function deleteMonitoredDocument(
  supabase: SupabaseClient,
  id: string,
): Promise<MonitoredMutationResult> {
  const { data, error } = await supabase
    .from('monitored_documents')
    .delete()
    .eq('id', id)
    .select('id');
  if (error || !data || data.length === 0) {
    return fail('Não foi possível remover — verifique suas permissões.');
  }
  await supabase.rpc('log_audit', {
    p_action: 'monitored_document.deleted',
    p_entity: 'monitored_document',
    p_entity_id: id,
    p_context: {},
  });
  return { ok: true, id };
}
