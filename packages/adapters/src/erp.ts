import { strToU8, zipSync } from 'fflate';

// ErpAdapter (PLANEJAMENTO §8, golden rule #3). v1 ships `manual-export`: it bundles
// the renamed documents + a JSON and CSV manifest into one .zip a human imports into
// the ERP (AlterData). No network — a real connector (API/RPA) would be another
// implementation behind this same interface. The caller (T22 worker) has already
// resolved which files go in and their target names (core buildExportManifest).

export interface ErpBatchFile {
  /** Target name inside the zip — already renamed by the firm's convention. */
  name: string;
  bytes: Uint8Array;
}

export interface ErpBatchInput {
  files: ErpBatchFile[];
  manifestJson: string;
  manifestCsv: string;
}

export interface ErpBatchResult {
  zip: Uint8Array;
}

export interface ErpAdapter {
  buildBatch(input: ErpBatchInput): Promise<ErpBatchResult>;
}

// Keep zip entry names unique (the manifest already de-dups, but never trust input).
function uniqueName(name: string, taken: Set<string>): string {
  if (!taken.has(name)) return name;
  const dot = name.lastIndexOf('.');
  const base = dot > 0 ? name.slice(0, dot) : name;
  const ext = dot > 0 ? name.slice(dot) : '';
  let n = 2;
  while (taken.has(`${base}-${n}${ext}`)) n += 1;
  return `${base}-${n}${ext}`;
}

export class ManualExportErpAdapter implements ErpAdapter {
  buildBatch(input: ErpBatchInput): Promise<ErpBatchResult> {
    const taken = new Set<string>(['manifest.json', 'manifest.csv']);
    const entries: Record<string, Uint8Array> = {
      'manifest.json': strToU8(input.manifestJson),
      'manifest.csv': strToU8(input.manifestCsv),
    };
    for (const file of input.files) {
      const name = uniqueName(file.name, taken);
      taken.add(name);
      entries[`arquivos/${name}`] = file.bytes;
    }
    return Promise.resolve({ zip: zipSync(entries, { level: 6 }) });
  }
}

export function createErpAdapter(): ErpAdapter {
  return new ManualExportErpAdapter();
}
