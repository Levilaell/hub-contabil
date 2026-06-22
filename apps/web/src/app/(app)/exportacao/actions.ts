'use server';

import { parseFirmConfig } from '@hub/config';
import { buildExportManifest } from '@hub/core';
import {
  createDocumentSignedUrl,
  createExportBatch,
  getExportBatch,
  listExportableDocuments,
  listExportedDocumentIds,
  markExportDownloaded,
  type ExportFilters,
} from '@hub/db';
import { revalidatePath } from 'next/cache';

import { createClient } from '@/lib/supabase/server';

export interface ExportPreview {
  count: number;
  excludedCount: number;
  alreadyExportedCount: number;
  excludedSample: { fileName: string; companyCnpj: string }[];
}

function normalize(filters: ExportFilters): ExportFilters {
  return {
    companyIds: filters.companyIds?.filter(Boolean) ?? [],
    period: filters.period?.trim() || undefined,
    docTypes: filters.docTypes?.filter(Boolean) ?? [],
  };
}

// Dry run: how many documents would go in, how many are held back (pending CFOP),
// and how many were already exported before. Reuses the same core logic the worker
// runs, so the preview can never disagree with the build.
export async function previewExportAction(filters: ExportFilters): Promise<ExportPreview> {
  const supabase = await createClient();
  const { data: firm } = await supabase.from('firms').select('config').limit(1).single();
  const convention = parseFirmConfig(firm?.config).exportBatch.fileNameConvention;

  const docs = await listExportableDocuments(supabase, normalize(filters));
  const manifest = buildExportManifest(docs, convention);
  const alreadyExported = await listExportedDocumentIds(
    supabase,
    manifest.included.map((e) => e.documentId),
  );

  return {
    count: manifest.count,
    excludedCount: manifest.excludedCount,
    alreadyExportedCount: alreadyExported.length,
    excludedSample: manifest.excluded
      .slice(0, 5)
      .map((e) => ({ fileName: e.fileName, companyCnpj: e.companyCnpj })),
  };
}

export type BuildActionState = { ok: boolean; message: string } | null;

export async function buildExportAction(filters: ExportFilters): Promise<BuildActionState> {
  const supabase = await createClient();
  const result = await createExportBatch(supabase, normalize(filters));
  if (!result.ok) return { ok: false, message: result.message };
  revalidatePath('/exportacao');
  return { ok: true, message: '' };
}

export type DownloadResult = { ok: true; url: string } | { ok: false; message: string };

export async function downloadBatchAction(batchId: string): Promise<DownloadResult> {
  const supabase = await createClient();
  const batch = await getExportBatch(supabase, batchId);
  if (!batch || batch.status !== 'ready' || !batch.zipPath) {
    return { ok: false, message: 'Lote indisponível para download.' };
  }
  const url = await createDocumentSignedUrl(supabase, batch.zipPath, 300);
  if (!url) return { ok: false, message: 'Não foi possível gerar o link de download.' };
  await markExportDownloaded(supabase, batchId);
  revalidatePath('/exportacao');
  return { ok: true, url };
}
