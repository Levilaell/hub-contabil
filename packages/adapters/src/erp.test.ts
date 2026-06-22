import { strFromU8, unzipSync } from 'fflate';
import { describe, expect, it } from 'vitest';

import { ManualExportErpAdapter } from './erp';

describe('ManualExportErpAdapter', () => {
  const adapter = new ManualExportErpAdapter();

  it('zips the manifests at the root and documents under arquivos/', async () => {
    const { zip } = await adapter.buildBatch({
      manifestJson: '{"count":1}',
      manifestCsv: 'export_name\nnota.xml',
      files: [{ name: 'nota.xml', bytes: new TextEncoder().encode('<NFe/>') }],
    });

    const unzipped = unzipSync(zip);
    expect(Object.keys(unzipped).sort()).toEqual([
      'arquivos/nota.xml',
      'manifest.csv',
      'manifest.json',
    ]);
    expect(strFromU8(unzipped['manifest.json']!)).toBe('{"count":1}');
    expect(strFromU8(unzipped['arquivos/nota.xml']!)).toBe('<NFe/>');
  });

  it('de-dups colliding document names inside the zip', async () => {
    const { zip } = await adapter.buildBatch({
      manifestJson: '{}',
      manifestCsv: '',
      files: [
        { name: 'dup.xml', bytes: new TextEncoder().encode('a') },
        { name: 'dup.xml', bytes: new TextEncoder().encode('b') },
      ],
    });
    const names = Object.keys(unzipSync(zip)).filter((n) => n.startsWith('arquivos/'));
    expect(names.sort()).toEqual(['arquivos/dup-2.xml', 'arquivos/dup.xml']);
  });
});
