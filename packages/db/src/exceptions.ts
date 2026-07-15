import type { SupabaseClient } from '@supabase/supabase-js';

// Exception queue read/resolve use cases (T9). Reads are RLS-scoped; resolution
// goes through the resolve_exception RPC (stamps the resolver + audits). Rows are
// created by the worker/automations (service role), never the web.

export type ExceptionStatus = 'open' | 'resolved' | 'ignored';

export interface ExceptionItem {
  id: string;
  source: string;
  status: ExceptionStatus;
  context: Record<string, unknown>;
  suggestion: Record<string, unknown>;
  resolution: Record<string, unknown>;
  createdAt: string;
}

interface ExceptionRow {
  id: string;
  source: string;
  status: string;
  context: unknown;
  suggestion: unknown;
  resolution: unknown;
  created_at: string;
}

// jsonb columns normally arrive parsed; tolerate a string (older rows) defensively.
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

function mapException(row: ExceptionRow): ExceptionItem {
  return {
    id: row.id,
    source: row.source,
    status: row.status === 'resolved' ? 'resolved' : row.status === 'ignored' ? 'ignored' : 'open',
    context: asObject(row.context),
    suggestion: asObject(row.suggestion),
    resolution: asObject(row.resolution),
    createdAt: row.created_at,
  };
}

export async function listExceptions(
  supabase: SupabaseClient,
  opts?: { status?: ExceptionStatus | 'all'; source?: string },
): Promise<ExceptionItem[]> {
  let query = supabase
    .from('exception_queue')
    .select('id, source, status, context, suggestion, resolution, created_at');

  const status = opts?.status ?? 'open';
  if (status !== 'all') query = query.eq('status', status);
  if (opts?.source) query = query.eq('source', opts.source);

  const { data, error } = await query.order('created_at', { ascending: false });
  if (error || !data) return [];
  return (data as ExceptionRow[]).map(mapException);
}

/**
 * Open 'triage' exceptions keyed by the document they refer to
 * (context.documentId). Powers in-place resolution from the documents
 * "Pendentes de arquivamento" section (T37): the inbox shows, per pending
 * document, the same resolution form as /excecoes — one pending item, two
 * places to resolve it.
 */
export async function listOpenTriageExceptionsByDocument(
  supabase: SupabaseClient,
  documentIds: string[],
): Promise<Record<string, ExceptionItem>> {
  if (documentIds.length === 0) return {};
  const { data, error } = await supabase
    .from('exception_queue')
    .select('id, source, status, context, suggestion, resolution, created_at')
    .eq('source', 'triage')
    .eq('status', 'open')
    .in('context->>documentId', documentIds)
    .order('created_at', { ascending: false });
  if (error || !data) return {};
  const byDocument: Record<string, ExceptionItem> = {};
  for (const row of data as ExceptionRow[]) {
    const item = mapException(row);
    const docId = item.context.documentId;
    // Newest first — keep the first (latest) exception per document.
    if (typeof docId === 'string' && !(docId in byDocument)) byDocument[docId] = item;
  }
  return byDocument;
}

export async function countOpenExceptions(supabase: SupabaseClient): Promise<number> {
  const { count, error } = await supabase
    .from('exception_queue')
    .select('id', { count: 'exact', head: true })
    .eq('status', 'open');
  if (error) return 0;
  return count ?? 0;
}

export type ResolveResult = { ok: true } | { ok: false; message: string };

export async function resolveException(
  supabase: SupabaseClient,
  id: string,
  status: 'resolved' | 'ignored',
  note?: string,
): Promise<ResolveResult> {
  const { error } = await supabase.rpc('resolve_exception', {
    p_id: id,
    p_status: status,
    p_note: note ?? null,
  });
  if (error)
    return { ok: false, message: 'Não foi possível atualizar — verifique e tente de novo.' };
  return { ok: true };
}

/**
 * Resolve a TRIAGE exception by applying the (reviewed) suggestion to the
 * document (Fase 1.1 §3): sets type/company/department, flips the classification
 * to human-decided, stores a few-shot example, and closes the exception —
 * all in one RPC (apply_triage_suggestion).
 */
export async function applyTriageSuggestion(
  supabase: SupabaseClient,
  input: {
    exceptionId: string;
    docType: string;
    companyId?: string | null;
    department?: string | null;
    note?: string | null;
  },
): Promise<ResolveResult> {
  const { error } = await supabase.rpc('apply_triage_suggestion', {
    p_exception_id: input.exceptionId,
    p_doc_type: input.docType,
    p_company_id: input.companyId ?? null,
    p_department: input.department ?? null,
    p_note: input.note ?? null,
  });
  if (error) return { ok: false, message: 'Não foi possível aplicar — verifique e tente de novo.' };
  return { ok: true };
}
