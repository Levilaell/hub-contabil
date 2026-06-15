import ExcelJS from 'exceljs';
import Papa from 'papaparse';
import { describe, expect, it } from 'vitest';

import { parseSpreadsheet } from './parse';
import { buildTemplateCsv } from './template';

async function xlsxBuffer(rows: string[][]): Promise<ArrayBuffer> {
  const wb = new ExcelJS.Workbook();
  const ws = wb.addWorksheet('Empresas');
  rows.forEach((r) => ws.addRow(r));
  return (await wb.xlsx.writeBuffer()) as ArrayBuffer;
}
function csvBuffer(text: string): ArrayBuffer {
  return new TextEncoder().encode(text).buffer as ArrayBuffer;
}

describe('parseSpreadsheet', () => {
  it('parses XLSX with accented/aliased headers and skips blank rows', async () => {
    const buf = await xlsxBuffer([
      ['CNPJ', 'Razão Social', 'Município', 'UF'], // accented header + alias (Município → city)
      ['11.222.333/0001-81', 'Empresa Um', 'Santos', 'SP'],
      ['', '', '', ''], // blank row → skipped, not reported
      ['00.000.000/0001-91', 'Empresa Dois', '', ''],
    ]);
    const res = await parseSpreadsheet(buf, 'empresas.xlsx');
    expect(res.ok).toBe(true);
    if (!res.ok) return;
    expect(res.rows).toHaveLength(2);
    expect(res.rows[0]).toMatchObject({
      line: 2,
      values: { cnpj: '11.222.333/0001-81', legalName: 'Empresa Um', city: 'Santos', state: 'SP' },
    });
    // Blank row 3 skipped but line numbers stay accurate to the sheet.
    expect(res.rows[1]?.line).toBe(4);
    expect(res.rows[1]?.values).toMatchObject({
      cnpj: '00.000.000/0001-91',
      legalName: 'Empresa Dois',
    });
  });

  it('parses CSV with the same column contract', async () => {
    const csv = Papa.unparse([
      ['CNPJ', 'Razão Social'],
      ['11.222.333/0001-81', 'Empresa Um'],
    ]);
    const res = await parseSpreadsheet(csvBuffer(csv), 'empresas.csv');
    expect(res.ok).toBe(true);
    if (res.ok) {
      expect(res.rows[0]?.values).toMatchObject({
        cnpj: '11.222.333/0001-81',
        legalName: 'Empresa Um',
      });
    }
  });

  it('rejects an unsupported extension', async () => {
    const res = await parseSpreadsheet(csvBuffer('x'), 'empresas.pdf');
    expect(res.ok).toBe(false);
  });

  it('round-trips the downloadable template (parser↔template contract)', async () => {
    const res = await parseSpreadsheet(csvBuffer(buildTemplateCsv()), 'modelo.csv');
    expect(res.ok).toBe(true);
    if (!res.ok) return;
    expect(res.rows).toHaveLength(1); // the single example row
    expect(res.rows[0]?.values).toMatchObject({
      cnpj: '11.222.333/0001-81',
      legalName: 'Empresa Exemplo Ltda',
      tradeName: 'Exemplo',
      taxRegime: 'Simples Nacional',
      city: 'Santos',
      state: 'SP',
    });
  });
});
