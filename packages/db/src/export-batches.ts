import { parseCfopMetadata, type ExportDoc } from '@hub/core';
import type { SupabaseClient } from '@supabase/supabase-js';

// Export-batch data access (T22). The web reads batches and previews which documents
// would go in (RLS-scoped); creating a batch goes through the create_export_batch RPC
// (which enqueues the worker build). The worker itself reads/writes via postgres.js,
// not this layer. firm_id is enforced by RLS on every read here.

export type ExportBatchStatus = 'building' | 'ready' | 'failed' | 'downloaded';

export interface ExportBatch {
  id: string;
  period: string | null;
  filters: Record<string, unknown>;
  manifest: Record<string, unknown>;
  zipPath: string | null;
  status: ExportBatchStatus;
  error: string | null;
  createdAt: string;
}

export interface ExportFilters {
  companyIds?: string[];
  period?: string;
  docTypes?: string[];
}

interface BatchRow {
  id: string;
  period: string | null;
  filters: unknown;
  manifest: unknown;
  zip_path: string | null;
  status: string;
  error: string | null;
  created_at: string;
}

function asObject(value: unknown): Record<string, unknown> {
  return value && typeof value === 'object' && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};
}

function asStatus(value: string): ExportBatchStatus {
  return value === 'ready' || value === 'failed' || value === 'downloaded' ? value : 'building';
}

function mapBatch(row: BatchRow): ExportBatch {
  return {
    id: row.id,
    period: row.period,
    filters: asObject(row.filters),
    manifest: asObject(row.manifest),
    zipPath: row.zip_path,
    status: asStatus(row.status),
    error: row.error,
    createdAt: row.created_at,
  };
}

const BATCH_SELECT = 'id, period, filters, manifest, zip_path, status, error, created_at';

export async function listExportBatches(supabase: SupabaseClient): Promise<ExportBatch[]> {
  const { data, error } = await supabase
    .from('export_batches')
    .select(BATCH_SELECT)
    .order('created_at', { ascending: false })
    .limit(50);
  if (error || !data) return [];
  return (data as BatchRow[]).map(mapBatch);
}

export async function getExportBatch(
  supabase: SupabaseClient,
  id: string,
): Promise<ExportBatch | null> {
  const { data, error } = await supabase
    .from('export_batches')
    .select(BATCH_SELECT)
    .eq('id', id)
    .maybeSingle();
  if (error || !data) return null;
  return mapBatch(data as BatchRow);
}

interface DocRow {
  id: string;
  company_id: string;
  period: string | null;
  department: string | null;
  doc_type: string;
  file_name: string;
  hash: string;
  storage_path: string;
  metadata: unknown;
}

/** Documents matching the filters, shaped for core buildExportManifest (preview + build). */
export async function listExportableDocuments(
  supabase: SupabaseClient,
  filters: ExportFilters,
): Promise<ExportDoc[]> {
  let query = supabase
    .from('documents')
    .select('id, company_id, period, department, doc_type, file_name, hash, storage_path, metadata');
  if (filters.companyIds?.length) query = query.in('company_id', filters.companyIds);
  if (filters.period) query = query.eq('period', filters.period);
  if (filters.docTypes?.length) query = query.in('doc_type', filters.docTypes);
  const { data: docs, error } = await query;
  if (error || !docs) return [];

  const companyIds = [...new Set((docs as DocRow[]).map((d) => d.company_id))];
  const { data: companies } = await supabase
    .from('companies')
    .select('id, cnpj, legal_name, trade_name')
    .in('id', companyIds);
  const byId = new Map(
    (companies ?? []).map((c) => [
      c.id as string,
      { cnpj: c.cnpj as string, name: (c.trade_name as string) || (c.legal_name as string) },
    ]),
  );

  return (docs as DocRow[]).map((d) => {
    const company = byId.get(d.company_id);
    return {
      id: d.id,
      companyCnpj: company?.cnpj ?? '',
      companyName: company?.name ?? '',
      period: d.period,
      department: d.department,
      docType: d.doc_type,
      fileName: d.file_name,
      hash: d.hash,
      storagePath: d.storage_path,
      cfop: parseCfopMetadata(d.metadata),
    };
  });
}

/** Of the given documents, which already went into a batch (re-export warning). */
export async function listExportedDocumentIds(
  supabase: SupabaseClient,
  documentIds: string[],
): Promise<string[]> {
  if (documentIds.length === 0) return [];
  const { data, error } = await supabase
    .from('export_batch_documents')
    .select('document_id')
    .in('document_id', documentIds);
  if (error || !data) return [];
  return [...new Set((data as { document_id: string }[]).map((r) => r.document_id))];
}

export type CreateBatchResult = { ok: true; id: string } | { ok: false; message: string };

/** Create a batch and enqueue its build (create_export_batch RPC). */
export async function createExportBatch(
  supabase: SupabaseClient,
  filters: ExportFilters,
): Promise<CreateBatchResult> {
  const { data, error } = await supabase.rpc('create_export_batch', {
    p_filters: {
      companyIds: filters.companyIds ?? [],
      period: filters.period ?? '',
      docTypes: filters.docTypes ?? [],
    },
  });
  if (error || !data) return { ok: false, message: 'Não foi possível iniciar a exportação.' };
  return { ok: true, id: data as string };
}

export async function markExportDownloaded(supabase: SupabaseClient, id: string): Promise<void> {
  await supabase.rpc('mark_export_downloaded', { p_id: id });
}
