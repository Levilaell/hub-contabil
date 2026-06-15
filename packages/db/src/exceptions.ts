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
