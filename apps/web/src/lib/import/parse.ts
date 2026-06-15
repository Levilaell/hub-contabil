import {
  columnKeyForHeader,
  type ImportColumnKey,
  type ImportRowInput,
  type RawImportRow,
} from '@hub/core';
import ExcelJS from 'exceljs';
import Papa from 'papaparse';

// Server-side spreadsheet parser for onboarding (T8). Turns a CSV/XLSX buffer into
// ImportRowInput[] (line + per-key values) using the shared IMPORT_COLUMNS contract
// for header mapping — so the template and the parser can never drift. Blank rows
// are dropped (spreadsheets always carry trailing empties), never reported.

export type ParseResult = { ok: true; rows: ImportRowInput[] } | { ok: false; message: string };

function cellToString(value: unknown): string {
  if (value === null || value === undefined) return '';
  if (typeof value === 'object') {
    const obj = value as Record<string, unknown>;
    if (typeof obj.text === 'string') return obj.text.trim();
    if (Array.isArray(obj.richText)) {
      return obj.richText
        .map((part) => String((part as { text?: string }).text ?? ''))
        .join('')
        .trim();
    }
    if ('result' in obj) return String(obj.result ?? '').trim();
    return '';
  }
  return String(value).trim();
}

// Build a matrix preserving 1-based line numbers (index 0 = line 1), so error
// reporting points at the real sheet row even with blank lines in between.
function csvToMatrix(buffer: ArrayBuffer): string[][] {
  const text = new TextDecoder('utf-8').decode(buffer);
  const parsed = Papa.parse<string[]>(text, { skipEmptyLines: false });
  return parsed.data.map((row) =>
    Array.isArray(row) ? row.map((c) => String(c ?? '').trim()) : [],
  );
}

async function xlsxToMatrix(buffer: ArrayBuffer): Promise<string[][]> {
  const workbook = new ExcelJS.Workbook();
  await workbook.xlsx.load(buffer);
  const sheet = workbook.worksheets[0];
  if (!sheet) return [];
  const matrix: string[][] = [];
  sheet.eachRow({ includeEmpty: true }, (row, rowNumber) => {
    const values = Array.isArray(row.values) ? row.values : [];
    // row.values is 1-indexed (index 0 is empty) — drop it for 0-based columns.
    matrix[rowNumber - 1] = values.slice(1).map(cellToString);
  });
  return matrix;
}

function matrixToRows(matrix: string[][]): ImportRowInput[] {
  const headerIndex = matrix.findIndex((row) => row.some((cell) => cell.trim().length > 0));
  if (headerIndex === -1) return [];

  // Map each column position to a known key (unknown columns are ignored).
  const columnKeys: (ImportColumnKey | null)[] = matrix[headerIndex]!.map((header) =>
    columnKeyForHeader(header ?? ''),
  );

  const rows: ImportRowInput[] = [];
  for (let i = headerIndex + 1; i < matrix.length; i += 1) {
    const cells = matrix[i] ?? [];
    const values: RawImportRow = {};
    let hasValue = false;
    columnKeys.forEach((key, col) => {
      if (!key) return;
      const cell = (cells[col] ?? '').trim();
      if (cell) {
        values[key] = cell;
        hasValue = true;
      }
    });
    if (hasValue) rows.push({ line: i + 1, values });
  }
  return rows;
}

export async function parseSpreadsheet(
  buffer: ArrayBuffer,
  filename: string,
): Promise<ParseResult> {
  const ext = filename.toLowerCase().split('.').pop();
  try {
    let matrix: string[][];
    if (ext === 'csv') matrix = csvToMatrix(buffer);
    else if (ext === 'xlsx') matrix = await xlsxToMatrix(buffer);
    else return { ok: false, message: 'Formato não suportado. Envie um arquivo .csv ou .xlsx.' };

    const rows = matrixToRows(matrix);
    if (rows.length === 0) {
      return { ok: false, message: 'A planilha não tem linhas de dados (confira o cabeçalho).' };
    }
    return { ok: true, rows };
  } catch {
    return {
      ok: false,
      message: 'Não foi possível ler o arquivo. Verifique se é um .csv ou .xlsx válido.',
    };
  }
}
