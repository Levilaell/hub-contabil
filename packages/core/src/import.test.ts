import { describe, expect, it } from 'vitest';

import {
  columnKeyForHeader,
  normalizeHeader,
  validateImportRows,
  type ImportRowInput,
} from './import';

const REGIMES = [
  { key: 'simples_nacional', label: 'Simples Nacional' },
  { key: 'lucro_presumido', label: 'Lucro Presumido' },
];

const VALID_A = '11222333000181';
const VALID_B = '00000000000191';

function row(line: number, values: ImportRowInput['values']): ImportRowInput {
  return { line, values };
}

describe('normalizeHeader / columnKeyForHeader', () => {
  it('maps accented and aliased headers to keys', () => {
    expect(normalizeHeader('  Razão Social ')).toBe('razao social');
    expect(columnKeyForHeader('Razão Social')).toBe('legalName');
    expect(columnKeyForHeader('CNPJ')).toBe('cnpj');
    expect(columnKeyForHeader('Município')).toBe('city');
    expect(columnKeyForHeader('coluna desconhecida')).toBeNull();
  });
});

describe('validateImportRows', () => {
  it('accepts a clean row and resolves the regime label to its key', () => {
    const [r] = validateImportRows(
      [
        row(2, {
          cnpj: '11.222.333/0001-81',
          legalName: 'Empresa A',
          taxRegime: 'Simples Nacional',
          state: 'sp',
        }),
      ],
      { existingCnpjs: [], regimes: REGIMES },
    );
    expect(r.status).toBe('valid');
    expect(r.cnpj).toBe(VALID_A);
    expect(r.taxRegime).toBe('simples_nacional');
    expect(r.state).toBe('SP');
  });

  it('flags invalid CNPJ, missing name, bad regime and bad UF with reasons', () => {
    const result = validateImportRows(
      [
        row(2, { cnpj: '11222333000180', legalName: 'X' }),
        row(3, { cnpj: VALID_A, legalName: '' }),
        row(4, { cnpj: VALID_B, legalName: 'Y', taxRegime: 'Lucro Inexistente' }),
        row(5, { cnpj: VALID_B, legalName: 'Z', state: 'São Paulo' }),
      ],
      { existingCnpjs: [], regimes: REGIMES },
    );
    expect(result.map((r) => r.status)).toEqual(['invalid', 'invalid', 'invalid', 'invalid']);
    expect(result[0]?.reason).toMatch(/CNPJ inválido/);
    expect(result[1]?.reason).toMatch(/Razão social/);
    expect(result[2]?.reason).toMatch(/Regime inválido/);
    expect(result[3]?.reason).toMatch(/UF/);
  });

  it('marks in-sheet repeats and already-registered CNPJs as duplicates', () => {
    const result = validateImportRows(
      [
        row(2, { cnpj: '11.222.333/0001-81', legalName: 'Primeira' }),
        row(3, { cnpj: '11222333000181', legalName: 'Repetida' }), // masked vs raw → same
        row(4, { cnpj: VALID_B, legalName: 'Já existe' }),
      ],
      { existingCnpjs: ['00.000.000/0001-91'], regimes: REGIMES },
    );
    expect(result[0]?.status).toBe('valid');
    expect(result[1]?.status).toBe('duplicate');
    expect(result[1]?.reason).toMatch(/repetido/);
    expect(result[2]?.status).toBe('duplicate');
    expect(result[2]?.reason).toMatch(/já cadastrado/i);
  });

  it('imports 95 of a 100-row sheet and lists the 5 errors (acceptance)', () => {
    // Mirror core's modulo-11 check-digit math to mint distinct valid CNPJs.
    const checkDigit = (base: string): number => {
      let sum = 0;
      let weight = 2;
      for (let i = base.length - 1; i >= 0; i -= 1) {
        sum += Number(base[i]) * weight;
        weight = weight === 9 ? 2 : weight + 1;
      }
      const mod = sum % 11;
      return mod < 2 ? 0 : 11 - mod;
    };
    const makeValidCnpj = (base12: string): string => {
      const d1 = checkDigit(base12);
      const d2 = checkDigit(base12 + d1);
      return `${base12}${d1}${d2}`;
    };

    const rows: ImportRowInput[] = [];
    for (let i = 0; i < 100; i += 1) {
      const line = i + 2;
      if (i < 5) {
        rows.push(row(line, { cnpj: '11222333000180', legalName: `Erro ${i}` })); // bad check digit
      } else {
        const base12 = `1122233300${String(i).padStart(2, '0')}`; // distinct per row
        rows.push(row(line, { cnpj: makeValidCnpj(base12), legalName: `Empresa ${i}` }));
      }
    }

    const result = validateImportRows(rows, { existingCnpjs: [], regimes: REGIMES });
    expect(result.filter((r) => r.status === 'invalid')).toHaveLength(5);
    expect(result.filter((r) => r.status === 'valid')).toHaveLength(95);
    expect(result.filter((r) => r.status === 'duplicate')).toHaveLength(0);
  });

  it('is idempotent on resolved rows (confirmImport re-validation round-trip)', () => {
    // confirmImport re-validates the preview's RESOLVED values (regime as key,
    // UF uppercased, CNPJ normalized). They must survive a second pass as valid —
    // otherwise rows silently vanish at confirm with no error shown.
    const first = validateImportRows(
      [
        row(2, {
          cnpj: '11.222.333/0001-81',
          legalName: 'Empresa A',
          taxRegime: 'Simples Nacional', // label on first pass
          state: 'sp',
          city: 'Santos',
        }),
        row(3, {
          cnpj: '00.000.000/0001-91',
          legalName: 'Empresa B',
          taxRegime: 'Lucro Presumido',
        }),
      ],
      { existingCnpjs: [], regimes: REGIMES },
    );
    expect(first.every((r) => r.status === 'valid')).toBe(true);

    const second = validateImportRows(
      first.map((r, i) => ({
        line: i + 2,
        values: {
          cnpj: r.cnpj,
          legalName: r.legalName,
          tradeName: r.tradeName ?? undefined,
          taxRegime: r.taxRegime ?? undefined, // now the KEY, not the label
          city: r.city ?? undefined,
          state: r.state ?? undefined,
        },
      })),
      { existingCnpjs: [], regimes: REGIMES },
    );
    expect(second.every((r) => r.status === 'valid')).toBe(true);
    first.forEach((r, i) => {
      expect(second[i]?.taxRegime).toBe(r.taxRegime);
      expect(second[i]?.state).toBe(r.state);
      expect(second[i]?.cnpj).toBe(r.cnpj);
    });
  });
});
