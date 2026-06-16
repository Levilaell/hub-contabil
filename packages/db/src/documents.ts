import type { SupabaseClient } from '@supabase/supabase-js';

import { loadFirm } from './firm';

// Document repository use cases (T12). Files live in the private 'documents'
// Storage bucket; this table holds their metadata. Upload happens client-side
// (storage RLS is the boundary); the row insert + audit go here.

export const DOCUMENTS_BUCKET = 'documents';

export interface DocumentItem {
  id: string;
  companyId: string;
  period: string | null;
  department: string | null;
  docType: string;
  storagePath: string;
  source: string;
  hash: string;
  fileName: string;
  sizeBytes: number | null;
  createdAt: string;
}

interface DocumentRow {
  id: string;
  company_id: string;
  period: string | null;
  department: string | null;
  doc_type: string;
  storage_path: string;
  source: string;
  hash: string;
  file_name: string;
  size_bytes: number | null;
  created_at: string;
}

export interface DocumentInput {
  companyId: string;
  period: string | null;
  department: string | null;
  docType: string;
  storagePath: string;
  hash: string;
  fileName: string;
  sizeBytes: number | null;
}

export type DocMutationResult = { ok: true; id: string } | { ok: false; message: string };

const SELECT =
  'id, company_id, period, department, doc_type, storage_path, source, hash, file_name, size_bytes, created_at';

function fail(message: string): { ok: false; message: string } {
  return { ok: false, message };
}

function safeSegment(value: string | null, fallback: string): string {
  const cleaned = (value ?? '').trim().replace(/[^a-zA-Z0-9._-]/g, '_');
  return cleaned.length ? cleaned : fallback;
}

function safeFileName(name: string): string {
  const cleaned = name
    .trim()
    .replace(/[^a-zA-Z0-9._-]/g, '_')
    .slice(0, 120);
  return cleaned.length ? cleaned : 'arquivo';
}

/**
 * Canonical Storage path: firm/{firm}/company/{company}/{period}/{department}/{hash}-{file}.
 * The firm/company prefix is enforced by both the storage RLS and the row CHECK.
 */
export function buildStoragePath(
  firmId: string,
  companyId: string,
  period: string | null,
  department: string | null,
  hash: string,
  fileName: string,
): string {
  return `firm/${firmId}/company/${companyId}/${safeSegment(period, '_')}/${safeSegment(
    department,
    '_',
  )}/${hash.slice(0, 12)}-${safeFileName(fileName)}`;
}

function mapDocument(row: DocumentRow): DocumentItem {
  return {
    id: row.id,
    companyId: row.company_id,
    period: row.period,
    department: row.department,
    docType: row.doc_type,
    storagePath: row.storage_path,
    source: row.source,
    hash: row.hash,
    fileName: row.file_name,
    sizeBytes: row.size_bytes,
    createdAt: row.created_at,
  };
}

export async function listDocuments(
  supabase: SupabaseClient,
  opts?: {
    companyId?: string;
    period?: string;
    department?: string;
    docType?: string;
    search?: string;
  },
): Promise<DocumentItem[]> {
  let query = supabase.from('documents').select(SELECT);
  if (opts?.companyId) query = query.eq('company_id', opts.companyId);
  if (opts?.period) query = query.eq('period', opts.period);
  if (opts?.department) query = query.eq('department', opts.department);
  if (opts?.docType) query = query.eq('doc_type', opts.docType);
  const search = opts?.search?.trim();
  if (search) {
    const term = search.replace(/[,()%*]/g, ' ').trim();
    if (term) query = query.ilike('file_name', `%${term}%`);
  }
  const { data, error } = await query.order('created_at', { ascending: false });
  if (error || !data) return [];
  return (data as DocumentRow[]).map(mapDocument);
}

/** Count of documents in the firm (dashboard, T13). */
export async function countDocuments(supabase: SupabaseClient): Promise<number> {
  const { count, error } = await supabase
    .from('documents')
    .select('id', { count: 'exact', head: true });
  if (error) return 0;
  return count ?? 0;
}

/** Existing document with this content hash in the company (for client-side dedup). */
export async function findDocumentByHash(
  supabase: SupabaseClient,
  companyId: string,
  hash: string,
): Promise<DocumentItem | null> {
  const { data, error } = await supabase
    .from('documents')
    .select(SELECT)
    .eq('company_id', companyId)
    .eq('hash', hash)
    .maybeSingle();
  if (error || !data) return null;
  return mapDocument(data as DocumentRow);
}

/** Insert the metadata row after the file is uploaded. Stamps firm_id; the CHECK
 *  guarantees storage_path belongs to this firm/company. Dedup → friendly pt-BR. */
export async function insertDocument(
  supabase: SupabaseClient,
  input: DocumentInput,
): Promise<DocMutationResult> {
  const firm = await loadFirm(supabase);
  if (!firm) return fail('Não foi possível identificar o escritório.');

  const { data, error } = await supabase
    .from('documents')
    .insert({
      firm_id: firm.id,
      company_id: input.companyId,
      period: input.period,
      department: input.department,
      doc_type: input.docType,
      storage_path: input.storagePath,
      hash: input.hash,
      file_name: input.fileName,
      size_bytes: input.sizeBytes,
      source: 'upload',
    })
    .select('id')
    .single();
  if (error || !data) {
    if (error?.code === '23505') return fail('Documento duplicado (mesmo conteúdo já existe).');
    return fail('Não foi possível registrar o documento.');
  }

  await supabase.rpc('log_audit', {
    p_action: 'document.created',
    p_entity: 'document',
    p_entity_id: data.id,
    p_context: { companyId: input.companyId, fileName: input.fileName },
  });
  return { ok: true, id: data.id };
}

export async function deleteDocument(
  supabase: SupabaseClient,
  id: string,
): Promise<DocMutationResult> {
  const { data: doc } = await supabase
    .from('documents')
    .select('storage_path')
    .eq('id', id)
    .maybeSingle();
  if (!doc) return fail('Documento não encontrado.');

  const { data, error } = await supabase.from('documents').delete().eq('id', id).select('id');
  if (error || !data || data.length === 0) {
    return fail('Não foi possível remover — verifique suas permissões.');
  }
  // Best-effort object removal (the row is the source of truth in the UI).
  await supabase.storage.from(DOCUMENTS_BUCKET).remove([doc.storage_path as string]);

  await supabase.rpc('log_audit', {
    p_action: 'document.deleted',
    p_entity: 'document',
    p_entity_id: id,
    p_context: {},
  });
  return { ok: true, id };
}

/** Short-lived signed URL for preview/download. */
export async function createDocumentSignedUrl(
  supabase: SupabaseClient,
  storagePath: string,
  expiresInSeconds = 300,
): Promise<string | null> {
  const { data, error } = await supabase.storage
    .from(DOCUMENTS_BUCKET)
    .createSignedUrl(storagePath, expiresInSeconds);
  if (error || !data) return null;
  return data.signedUrl;
}
