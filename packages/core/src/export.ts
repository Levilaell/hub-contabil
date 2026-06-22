// Export-batch manifest logic (T22). Pure: decides which documents enter an ERP
// export batch, renames them by a configurable convention, and builds the manifest
// (list + hashes + applied CFOPs). A document whose CFOP is still pending is
// EXCLUDED with a reason — you can't hand the ERP an unmapped entry CFOP. No IO:
// the zipping and storage live in the ErpAdapter (@hub/adapters) and the worker.

export interface CfopEntrySummary {
  nItem: number;
  originCfop: string;
  entryCfop: string | null;
  status: 'matched' | 'pending';
}

export interface ExportDoc {
  id: string;
  companyCnpj: string;
  companyName: string;
  period: string | null;
  department: string | null;
  docType: string;
  fileName: string;
  hash: string;
  storagePath: string;
  /** entry_cfop entries from documents.metadata (T19); empty for non-NF-e docs. */
  cfop: CfopEntrySummary[];
}

export type ExclusionReason = 'cfop_pending';

export interface ManifestEntry {
  documentId: string;
  originalName: string;
  exportName: string;
  storagePath: string;
  companyCnpj: string;
  period: string | null;
  docType: string;
  hash: string;
  /** Resolved (matched) entry CFOPs, de-duplicated. */
  entryCfops: string[];
}

export interface ExcludedEntry {
  documentId: string;
  fileName: string;
  companyCnpj: string;
  reason: ExclusionReason;
}

export interface ExportManifest {
  convention: string;
  count: number;
  excludedCount: number;
  included: ManifestEntry[];
  excluded: ExcludedEntry[];
}

const SAFE = /[^A-Za-z0-9._-]+/g;

function sanitize(value: string, fallback: string): string {
  const cleaned = value.replace(SAFE, '_').replace(/^_+|_+$/g, '');
  return cleaned.length ? cleaned : fallback;
}

function extensionOf(fileName: string): string {
  const dot = fileName.lastIndexOf('.');
  return dot > 0 ? fileName.slice(dot + 1).toLowerCase() : '';
}

/** Read documents.metadata.entry_cfop (written in T19) into CFOP summaries. */
export function parseCfopMetadata(metadata: unknown): CfopEntrySummary[] {
  const entries = (metadata as { entry_cfop?: unknown } | null)?.entry_cfop;
  if (!Array.isArray(entries)) return [];
  return entries.map((raw) => {
    const e = (raw && typeof raw === 'object' ? raw : {}) as Record<string, unknown>;
    return {
      nItem: typeof e.nItem === 'number' ? e.nItem : 0,
      originCfop: String(e.originCfop ?? ''),
      entryCfop: e.entryCfop == null ? null : String(e.entryCfop),
      status: e.status === 'matched' ? 'matched' : 'pending',
    };
  });
}

/** A document is held back when any of its CFOP items is still pending (T19). */
export function exportExclusionReason(doc: ExportDoc): ExclusionReason | null {
  if (doc.cfop.some((entry) => entry.status === 'pending')) return 'cfop_pending';
  return null;
}

function renderName(
  convention: string,
  doc: ExportDoc,
  seq: number,
): string {
  const ext = extensionOf(doc.fileName);
  const tokens: Record<string, string> = {
    cnpj: sanitize(doc.companyCnpj, 'sem-cnpj'),
    period: sanitize(doc.period ?? 'sem-periodo', 'sem-periodo'),
    type: sanitize(doc.docType, 'doc'),
    seq: String(seq).padStart(4, '0'),
    ext: ext || 'dat',
    original: sanitize(doc.fileName.replace(/\.[^.]+$/, ''), 'arquivo'),
  };
  let name = convention.replace(/\{(\w+)\}/g, (_, token: string) => tokens[token] ?? '');
  name = sanitize(name, `arquivo_${tokens.seq}`);
  // Guarantee the extension survives even if the convention omitted {ext}/{original}.
  if (ext && !name.toLowerCase().endsWith(`.${ext}`)) name = `${name}.${ext}`;
  return name;
}

/**
 * Build the export manifest for a set of documents under a naming convention.
 * Deterministic: documents are ordered by (cnpj, period, fileName) before the
 * sequence numbers are assigned, so the same input always yields the same names.
 * Excluded documents (pending CFOP) are reported, never silently dropped.
 */
export function buildExportManifest(docs: ExportDoc[], convention: string): ExportManifest {
  const ordered = [...docs].sort(
    (a, b) =>
      a.companyCnpj.localeCompare(b.companyCnpj) ||
      (a.period ?? '').localeCompare(b.period ?? '') ||
      a.fileName.localeCompare(b.fileName),
  );

  const included: ManifestEntry[] = [];
  const excluded: ExcludedEntry[] = [];
  const usedNames = new Set<string>();
  let seq = 0;

  for (const doc of ordered) {
    const reason = exportExclusionReason(doc);
    if (reason) {
      excluded.push({
        documentId: doc.id,
        fileName: doc.fileName,
        companyCnpj: doc.companyCnpj,
        reason,
      });
      continue;
    }

    seq += 1;
    let exportName = renderName(convention, doc, seq);
    // Defensive de-dup: even with {seq}, sanitized names could collide.
    if (usedNames.has(exportName)) {
      const dot = exportName.lastIndexOf('.');
      const base = dot > 0 ? exportName.slice(0, dot) : exportName;
      const tail = dot > 0 ? exportName.slice(dot) : '';
      let n = 2;
      while (usedNames.has(`${base}-${n}${tail}`)) n += 1;
      exportName = `${base}-${n}${tail}`;
    }
    usedNames.add(exportName);

    const entryCfops = [
      ...new Set(
        doc.cfop
          .filter((e) => e.status === 'matched' && e.entryCfop)
          .map((e) => e.entryCfop as string),
      ),
    ];

    included.push({
      documentId: doc.id,
      originalName: doc.fileName,
      exportName,
      storagePath: doc.storagePath,
      companyCnpj: doc.companyCnpj,
      period: doc.period,
      docType: doc.docType,
      hash: doc.hash,
      entryCfops,
    });
  }

  return {
    convention,
    count: included.length,
    excludedCount: excluded.length,
    included,
    excluded,
  };
}

function csvCell(value: string): string {
  return /[",\n]/.test(value) ? `"${value.replace(/"/g, '""')}"` : value;
}

/** Flat CSV of the included files — one row per file, for the ERP operator. */
export function manifestToCsv(manifest: ExportManifest): string {
  const header = ['export_name', 'original_name', 'cnpj', 'period', 'doc_type', 'hash', 'entry_cfops'];
  const rows = manifest.included.map((entry) =>
    [
      entry.exportName,
      entry.originalName,
      entry.companyCnpj,
      entry.period ?? '',
      entry.docType,
      entry.hash,
      entry.entryCfops.join(';'),
    ]
      .map(csvCell)
      .join(','),
  );
  return [header.join(','), ...rows].join('\n');
}
