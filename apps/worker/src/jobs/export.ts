import { parseFirmConfig } from '@hub/config';
import { createErpAdapter, type ErpBatchFile } from '@hub/adapters';
import {
  buildExportManifest,
  manifestToCsv,
  parseCfopMetadata,
  type ExportDoc,
} from '@hub/core';
import type { SupabaseClient } from '@supabase/supabase-js';
import type { Sql } from 'postgres';

import type { ExportPayload } from '../queue/payloads.js';

// Export-batch consumer (T22): read the filtered documents, build the renamed .zip +
// manifest via the ErpAdapter, upload it, and record what went in. Files with a
// pending CFOP are excluded by core (never silently — they're listed in the manifest).
// The fiscal files themselves are read-only; the zip is derived output. A failure
// marks the batch failed AND rethrows → runner retries → DLQ → exception (golden #6).

const BUCKET = 'documents';

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
  cnpj: string;
  legal_name: string;
  trade_name: string | null;
}

interface BatchRow {
  filters: { companyIds?: string[]; period?: string; docTypes?: string[] } | null;
  status: string;
}

export function createExportHandler(sql: Sql, storage: SupabaseClient) {
  return async function handle(payload: ExportPayload): Promise<void> {
    const { firm_id, batch_id } = payload;

    // Golden rule #1: service role bypasses RLS, so every query filters firm_id.
    const [batch] = await sql<BatchRow[]>`
      select filters, status from public.export_batches
      where id = ${batch_id} and firm_id = ${firm_id}
    `;
    if (!batch) {
      console.warn(`[export] batch ${batch_id} not found in firm ${firm_id}; skipping`);
      return;
    }
    // Already built — don't rebuild (idempotent). A 'failed' batch may be retried.
    if (batch.status === 'ready' || batch.status === 'downloaded') return;

    try {
      const [firm] = await sql<{ config: unknown }[]>`
        select config from public.firms where id = ${firm_id}
      `;
      const convention = parseFirmConfig(firm?.config).exportBatch.fileNameConvention;

      const filters = batch.filters ?? {};
      const companyIds = filters.companyIds ?? [];
      const docTypes = filters.docTypes ?? [];
      const period = filters.period;

      const docRows = await sql<DocRow[]>`
        select d.id, d.company_id, d.period, d.department, d.doc_type, d.file_name, d.hash,
               d.storage_path, d.metadata, c.cnpj, c.legal_name, c.trade_name
        from public.documents d
        join public.companies c on c.firm_id = d.firm_id and c.id = d.company_id
        where d.firm_id = ${firm_id}
          ${companyIds.length ? sql`and d.company_id = any(${companyIds})` : sql``}
          ${period ? sql`and d.period = ${period}` : sql``}
          ${docTypes.length ? sql`and d.doc_type = any(${docTypes})` : sql``}
      `;

      const docs: ExportDoc[] = docRows.map((r) => ({
        id: r.id,
        companyCnpj: r.cnpj,
        companyName: r.trade_name || r.legal_name,
        period: r.period,
        department: r.department,
        docType: r.doc_type,
        fileName: r.file_name,
        hash: r.hash,
        storagePath: r.storage_path,
        cfop: parseCfopMetadata(r.metadata),
      }));

      const manifest = buildExportManifest(docs, convention);

      // Pull each included file from Storage (read-only).
      const files: ErpBatchFile[] = [];
      for (const entry of manifest.included) {
        const { data, error } = await storage.storage.from(BUCKET).download(entry.storagePath);
        if (error || !data) throw new Error(`download failed for ${entry.storagePath}`);
        files.push({ name: entry.exportName, bytes: new Uint8Array(await data.arrayBuffer()) });
      }

      const { zip } = await createErpAdapter().buildBatch({
        files,
        manifestJson: JSON.stringify(manifest, null, 2),
        manifestCsv: manifestToCsv(manifest),
      });

      const zipPath = `firm/${firm_id}/exports/${batch_id}.zip`;
      const uploaded = await storage.storage
        .from(BUCKET)
        .upload(zipPath, zip, { contentType: 'application/zip', upsert: true });
      if (uploaded.error) throw new Error(`zip upload failed: ${uploaded.error.message}`);

      const manifestJson = manifest as unknown as Parameters<typeof sql.json>[0];
      await sql`
        update public.export_batches
        set manifest = ${sql.json(manifestJson)}, zip_path = ${zipPath}, status = 'ready', error = null
        where id = ${batch_id} and firm_id = ${firm_id}
      `;

      // Record what went in (re-export warning + audit). Idempotent on retry.
      await sql`
        delete from public.export_batch_documents
        where batch_id = ${batch_id} and firm_id = ${firm_id}
      `;
      if (manifest.included.length > 0) {
        const rows = manifest.included.map((e) => ({
          firm_id,
          batch_id,
          document_id: e.documentId,
          export_name: e.exportName,
        }));
        await sql`
          insert into public.export_batch_documents ${sql(
            rows,
            'firm_id',
            'batch_id',
            'document_id',
            'export_name',
          )}
          on conflict (batch_id, document_id) do nothing
        `;
      }

      // Robot action → audit with a null actor (golden rule #7).
      await sql`
        insert into public.audit_events (firm_id, action, entity, entity_id, context)
        values (
          ${firm_id}, 'export_batch.built', 'export_batch', ${batch_id},
          ${sql.json({ count: manifest.count, excluded: manifest.excludedCount })}
        )
      `;
      console.log(
        `[export] batch ${batch_id}: ${manifest.count} file(s), ${manifest.excludedCount} excluded`,
      );
    } catch (error) {
      const message = error instanceof Error ? error.message : 'export build failed';
      await sql`
        update public.export_batches set status = 'failed', error = ${message}
        where id = ${batch_id} and firm_id = ${firm_id}
      `;
      throw error; // → runner retry/backoff → DLQ → exception queue (golden rule #6)
    }
  };
}
