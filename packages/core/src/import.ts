import { isValidCnpj, normalizeCnpj } from './cnpj';

// Spreadsheet onboarding (T8). IMPORT_COLUMNS is the SINGLE source of truth for
// the column contract — the downloadable template writes these headers, the
// parser maps incoming headers to these keys, and the validator below consumes
// them. Template and parser cannot drift because they share this definition.

export type ImportColumnKey = 'cnpj' | 'legalName' | 'tradeName' | 'taxRegime' | 'city' | 'state';

export interface ImportColumn {
  key: ImportColumnKey;
  /** Canonical pt-BR header written to the template. */
  header: string;
  /** Accepted header variants (matched after normalization). */
  aliases: string[];
  required: boolean;
}

export const IMPORT_COLUMNS: ImportColumn[] = [
  { key: 'cnpj', header: 'CNPJ', aliases: ['cnpj'], required: true },
  {
    key: 'legalName',
    header: 'Razão Social',
    aliases: ['razao social', 'legal name', 'nome'],
    required: true,
  },
  {
    key: 'tradeName',
    header: 'Nome Fantasia',
    aliases: ['fantasia', 'trade name'],
    required: false,
  },
  { key: 'taxRegime', header: 'Regime', aliases: ['regime fiscal', 'tax regime'], required: false },
  { key: 'city', header: 'Cidade', aliases: ['municipio', 'city'], required: false },
  { key: 'state', header: 'UF', aliases: ['estado', 'state'], required: false },
];

/** Lowercase, trim, strip accents — for header and vocabulary matching. */
export function normalizeHeader(value: string): string {
  return value.trim().toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');
}

/** Resolve a raw spreadsheet header to a column key, or null if unrecognized. */
export function columnKeyForHeader(header: string): ImportColumnKey | null {
  const normalized = normalizeHeader(header);
  for (const column of IMPORT_COLUMNS) {
    if (
      normalizeHeader(column.header) === normalized ||
      column.aliases.some((alias) => normalizeHeader(alias) === normalized)
    ) {
      return column.key;
    }
  }
  return null;
}

export type RawImportRow = Partial<Record<ImportColumnKey, string>>;

/** A parsed data row plus its 1-based line number in the sheet (for reporting). */
export interface ImportRowInput {
  line: number;
  values: RawImportRow;
}

export type ImportRowStatus = 'valid' | 'invalid' | 'duplicate';

export interface AnnotatedImportRow {
  line: number;
  status: ImportRowStatus;
  /** pt-BR reason when not valid; null when valid. */
  reason: string | null;
  cnpj: string; // normalized (14 digits)
  legalName: string;
  tradeName: string | null;
  taxRegime: string | null; // resolved config key
  city: string | null;
  state: string | null; // UF, uppercase
}

export interface ValidateImportOptions {
  /** CNPJs already registered in the firm (any format — normalized internally). */
  existingCnpjs: Iterable<string>;
  /** Allowed tax regimes; a cell matches by key or (normalized) label. */
  regimes: { key: string; label: string }[];
}

/**
 * Validate parsed rows for bulk onboarding. Pure: no IO. Each row comes back
 * annotated valid / invalid / duplicate with a pt-BR reason. Duplicates cover
 * both repeats within the sheet and CNPJs already registered. Blank rows must be
 * dropped by the parser before this — they are not reported as errors.
 */
export function validateImportRows(
  rows: ImportRowInput[],
  options: ValidateImportOptions,
): AnnotatedImportRow[] {
  const existing = new Set<string>();
  for (const value of options.existingCnpjs) existing.add(normalizeCnpj(value));

  const regimeByNormalized = new Map<string, string>();
  for (const regime of options.regimes) {
    regimeByNormalized.set(normalizeHeader(regime.key), regime.key);
    regimeByNormalized.set(normalizeHeader(regime.label), regime.key);
  }

  const seen = new Set<string>();
  return rows.map(({ line, values }) => {
    const cnpj = normalizeCnpj(values.cnpj ?? '');
    const legalName = (values.legalName ?? '').trim();
    const base = {
      line,
      cnpj,
      legalName,
      tradeName: (values.tradeName ?? '').trim() || null,
      taxRegime: null as string | null,
      city: (values.city ?? '').trim() || null,
      state: null as string | null,
    };
    const invalid = (reason: string): AnnotatedImportRow => ({
      ...base,
      status: 'invalid',
      reason,
    });

    if (!cnpj) return invalid('CNPJ ausente.');
    if (!isValidCnpj(cnpj)) return invalid('CNPJ inválido — verifique os dígitos.');
    if (!legalName) return invalid('Razão social ausente.');

    const rawRegime = (values.taxRegime ?? '').trim();
    let taxRegime: string | null = null;
    if (rawRegime) {
      taxRegime = regimeByNormalized.get(normalizeHeader(rawRegime)) ?? null;
      if (!taxRegime) return invalid(`Regime inválido: "${rawRegime}".`);
    }

    const rawState = (values.state ?? '').trim();
    let state: string | null = null;
    if (rawState) {
      const upper = rawState.toUpperCase();
      if (!/^[A-Z]{2}$/.test(upper)) return invalid('UF deve ter 2 letras (ex.: SP).');
      state = upper;
    }

    const resolved = { ...base, taxRegime, state };
    if (seen.has(cnpj)) {
      return { ...resolved, status: 'duplicate', reason: 'CNPJ repetido na planilha.' };
    }
    seen.add(cnpj);
    if (existing.has(cnpj)) {
      return { ...resolved, status: 'duplicate', reason: 'CNPJ já cadastrado.' };
    }
    return { ...resolved, status: 'valid', reason: null };
  });
}
