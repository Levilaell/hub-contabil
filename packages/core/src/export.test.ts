import { describe, expect, it } from 'vitest';

import {
  buildExportManifest,
  exportExclusionReason,
  manifestToCsv,
  type ExportDoc,
} from './export';

const CONVENTION = '{cnpj}_{period}_{type}_{seq}.{ext}';

function doc(over: Partial<ExportDoc> & Pick<ExportDoc, 'id' | 'fileName'>): ExportDoc {
  return {
    companyCnpj: '14200166000187',
    companyName: 'Fornecedor LTDA',
    period: '2026-06',
    department: 'fiscal',
    docType: 'nfe',
    hash: 'abc123',
    storagePath: `firm/f/company/c/2026-06/fiscal/${over.fileName}`,
    cfop: [],
    ...over,
  };
}

describe('exportExclusionReason', () => {
  it('excludes a document with a pending CFOP', () => {
    const d = doc({
      id: '1',
      fileName: 'a.xml',
      cfop: [{ nItem: 1, originCfop: '1102', entryCfop: null, status: 'pending' }],
    });
    expect(exportExclusionReason(d)).toBe('cfop_pending');
  });

  it('includes a document whose CFOPs are all matched', () => {
    const d = doc({
      id: '1',
      fileName: 'a.xml',
      cfop: [{ nItem: 1, originCfop: '1102', entryCfop: '1556', status: 'matched' }],
    });
    expect(exportExclusionReason(d)).toBeNull();
  });

  it('includes a non-NF-e document (no CFOP at all)', () => {
    expect(exportExclusionReason(doc({ id: '1', fileName: 'recibo.pdf', cfop: [] }))).toBeNull();
  });
});

describe('buildExportManifest', () => {
  it('separates included from excluded and reports the excluded with a reason', () => {
    const manifest = buildExportManifest(
      [
        doc({ id: 'ok', fileName: 'ok.xml', cfop: [{ nItem: 1, originCfop: '1102', entryCfop: '1556', status: 'matched' }] }),
        doc({ id: 'bad', fileName: 'bad.xml', cfop: [{ nItem: 1, originCfop: '5949', entryCfop: null, status: 'pending' }] }),
      ],
      CONVENTION,
    );
    expect(manifest.count).toBe(1);
    expect(manifest.excludedCount).toBe(1);
    expect(manifest.included[0]?.documentId).toBe('ok');
    expect(manifest.excluded[0]).toMatchObject({ documentId: 'bad', reason: 'cfop_pending' });
  });

  it('renames by the convention with a zero-padded sequence and keeps the extension', () => {
    const manifest = buildExportManifest([doc({ id: '1', fileName: 'nota.xml' })], CONVENTION);
    expect(manifest.included[0]?.exportName).toBe('14200166000187_2026-06_nfe_0001.xml');
  });

  it('is deterministic and assigns unique sequence names across many files', () => {
    const docs: ExportDoc[] = Array.from({ length: 5 }, (_, i) =>
      doc({ id: String(i), fileName: `nota-${i}.xml` }),
    );
    const a = buildExportManifest(docs, CONVENTION);
    const b = buildExportManifest([...docs].reverse(), CONVENTION);
    const names = a.included.map((e) => e.exportName);
    expect(new Set(names).size).toBe(5); // all unique
    expect(a).toEqual(b); // order-independent
  });

  it('collects distinct matched entry CFOPs per document', () => {
    const manifest = buildExportManifest(
      [
        doc({
          id: '1',
          fileName: 'multi.xml',
          cfop: [
            { nItem: 1, originCfop: '1102', entryCfop: '1556', status: 'matched' },
            { nItem: 2, originCfop: '1102', entryCfop: '1556', status: 'matched' },
            { nItem: 3, originCfop: '6102', entryCfop: '2556', status: 'matched' },
          ],
        }),
      ],
      CONVENTION,
    );
    expect(manifest.included[0]?.entryCfops).toEqual(['1556', '2556']);
  });

  it('falls back to placeholders for a null period', () => {
    const manifest = buildExportManifest(
      [doc({ id: '1', fileName: 'x.pdf', period: null, docType: 'boleto' })],
      CONVENTION,
    );
    expect(manifest.included[0]?.exportName).toBe('14200166000187_sem-periodo_boleto_0001.pdf');
  });
});

describe('manifestToCsv', () => {
  it('emits a header and one row per included file', () => {
    const manifest = buildExportManifest(
      [doc({ id: '1', fileName: 'nota.xml', cfop: [{ nItem: 1, originCfop: '1102', entryCfop: '1556', status: 'matched' }] })],
      CONVENTION,
    );
    const csv = manifestToCsv(manifest);
    const lines = csv.split('\n');
    expect(lines[0]).toBe('export_name,original_name,cnpj,period,doc_type,hash,entry_cfops');
    expect(lines[1]).toContain('14200166000187_2026-06_nfe_0001.xml');
    expect(lines[1]).toContain('1556');
  });
});
