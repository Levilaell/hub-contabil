import { IMPORT_COLUMNS } from '@hub/core';
import Papa from 'papaparse';

// Downloadable onboarding template. Headers come from the SAME IMPORT_COLUMNS the
// parser maps against — one source of truth, so the file we hand out always parses.
export function buildTemplateCsv(): string {
  const headers = IMPORT_COLUMNS.map((column) => column.header);
  const example: Record<string, string> = {
    cnpj: '11.222.333/0001-81',
    legalName: 'Empresa Exemplo Ltda',
    tradeName: 'Exemplo',
    taxRegime: 'Simples Nacional',
    city: 'Santos',
    state: 'SP',
  };
  const exampleRow = IMPORT_COLUMNS.map((column) => example[column.key] ?? '');
  return Papa.unparse([headers, exampleRow]);
}
