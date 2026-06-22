import type { SupabaseClient } from '@supabase/supabase-js';

// Classification reads (T20/T21). The worker WRITES classifications via postgres.js
// (service role); the web reads them here for the "classificado por IA" badge and
// the "corrigir" action (T21). RLS scopes reads to the caller's firm.

export interface Classification {
  documentId: string;
  suggestedType: string;
  extractedCnpj: string | null;
  confidence: number;
  model: string;
  decidedBy: 'ai' | 'human';
}

interface ClassificationRow {
  document_id: string;
  suggested_type: string;
  extracted_cnpj: string | null;
  confidence: number;
  model: string;
  decided_by: string;
}

function mapClassification(row: ClassificationRow): Classification {
  return {
    documentId: row.document_id,
    suggestedType: row.suggested_type,
    extractedCnpj: row.extracted_cnpj,
    confidence: typeof row.confidence === 'number' ? row.confidence : Number(row.confidence) || 0,
    model: row.model,
    decidedBy: row.decided_by === 'human' ? 'human' : 'ai',
  };
}

const SELECT = 'document_id, suggested_type, extracted_cnpj, confidence, model, decided_by';

/** Classifications for the given documents, keyed by documentId (T21 badge). */
export async function listClassificationsByDocuments(
  supabase: SupabaseClient,
  documentIds: string[],
): Promise<Map<string, Classification>> {
  if (documentIds.length === 0) return new Map();
  const { data, error } = await supabase
    .from('classifications')
    .select(SELECT)
    .in('document_id', documentIds);
  if (error || !data) return new Map();
  return new Map(
    (data as ClassificationRow[]).map((r) => [r.document_id, mapClassification(r)]),
  );
}

export type TriageActionResult = { ok: true } | { ok: false; message: string };

/** Enqueue an AI triage job for a document (enqueue_triage RPC). */
export async function enqueueTriage(
  supabase: SupabaseClient,
  documentId: string,
): Promise<TriageActionResult> {
  const { error } = await supabase.rpc('enqueue_triage', { p_document_id: documentId });
  if (error) return { ok: false, message: 'Não foi possível enviar para triagem.' };
  return { ok: true };
}

/** Human correction of the AI's type — updates the doc and stores a few-shot example. */
export async function correctClassification(
  supabase: SupabaseClient,
  documentId: string,
  docType: string,
): Promise<TriageActionResult> {
  const { error } = await supabase.rpc('correct_classification', {
    p_document_id: documentId,
    p_doc_type: docType,
  });
  if (error) return { ok: false, message: 'Não foi possível corrigir a classificação.' };
  return { ok: true };
}
