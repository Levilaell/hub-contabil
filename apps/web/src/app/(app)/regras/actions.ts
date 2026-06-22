'use server';

import { CFOP_DOMAIN, normalizeCnpj } from '@hub/core';
import { createMappingRule, deleteMappingRule, updateMappingRule } from '@hub/db';
import ExcelJS from 'exceljs';
import { revalidatePath } from 'next/cache';
import Papa from 'papaparse';

import { createClient } from '@/lib/supabase/server';

export type RuleActionState = { ok: boolean; message: string } | null;

export interface RuleFormInput {
  originCfop: string;
  supplierCnpj: string;
  entryCfop: string;
}

function cfop4(value: string): string | null {
  const digits = value.replace(/\D/g, '');
  return digits.length === 4 ? digits : null;
}

// '' → null (general rule), 14 digits → the CNPJ, anything else → invalid.
function supplierOf(value: string): string | null | 'invalid' {
  const trimmed = value.trim();
  if (!trimmed) return null;
  const digits = normalizeCnpj(trimmed);
  return digits.length === 14 ? digits : 'invalid';
}

// Build the CFOP rule fields, or a pt-BR error. Level follows scope: a supplier-
// specific rule is level 1 (it wins), a general one is level 2.
function buildRule(
  input: RuleFormInput,
): { ok: true; level: 1 | 2; key: Record<string, unknown>; value: Record<string, unknown> } | {
  ok: false;
  message: string;
} {
  const origin = cfop4(input.originCfop);
  const entry = cfop4(input.entryCfop);
  const supplier = supplierOf(input.supplierCnpj);
  if (!origin) return { ok: false, message: 'Informe um CFOP de origem de 4 dígitos.' };
  if (!entry) return { ok: false, message: 'Informe o CFOP de entrada de 4 dígitos.' };
  if (supplier === 'invalid') {
    return { ok: false, message: 'CNPJ inválido — use 14 dígitos ou deixe em branco.' };
  }
  return {
    ok: true,
    level: supplier ? 1 : 2,
    key: { originCfop: origin, supplierCnpj: supplier ?? null },
    value: { entryCfop: entry },
  };
}

export async function createRuleAction(input: RuleFormInput): Promise<RuleActionState> {
  const built = buildRule(input);
  if (!built.ok) return { ok: false, message: built.message };
  const supabase = await createClient();
  const result = await createMappingRule(supabase, {
    domain: CFOP_DOMAIN,
    level: built.level,
    key: built.key,
    value: built.value,
  });
  if (!result.ok) return { ok: false, message: result.message };
  revalidatePath('/regras');
  return { ok: true, message: '' };
}

export async function updateRuleAction(id: string, input: RuleFormInput): Promise<RuleActionState> {
  const built = buildRule(input);
  if (!built.ok) return { ok: false, message: built.message };
  const supabase = await createClient();
  const result = await updateMappingRule(supabase, id, {
    level: built.level,
    key: built.key,
    value: built.value,
  });
  if (!result.ok) return { ok: false, message: result.message };
  revalidatePath('/regras');
  return { ok: true, message: '' };
}

export async function deleteRuleAction(id: string): Promise<RuleActionState> {
  const supabase = await createClient();
  const result = await deleteMappingRule(supabase, id);
  if (!result.ok) return { ok: false, message: result.message };
  revalidatePath('/regras');
  return { ok: true, message: '' };
}

// --- Spreadsheet import -----------------------------------------------------

function normHeader(value: string): string {
  return value
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]/g, '');
}

async function fileToMatrix(file: File): Promise<string[][]> {
  const ext = file.name.toLowerCase().split('.').pop();
  const buffer = await file.arrayBuffer();
  if (ext === 'csv') {
    const text = new TextDecoder('utf-8').decode(buffer);
    const parsed = Papa.parse<string[]>(text, { skipEmptyLines: false });
    return parsed.data.map((row) =>
      Array.isArray(row) ? row.map((cell) => String(cell ?? '').trim()) : [],
    );
  }
  if (ext === 'xlsx') {
    const workbook = new ExcelJS.Workbook();
    await workbook.xlsx.load(buffer);
    const sheet = workbook.worksheets[0];
    if (!sheet) return [];
    const matrix: string[][] = [];
    sheet.eachRow({ includeEmpty: true }, (row, rowNumber) => {
      const values = Array.isArray(row.values) ? row.values : [];
      matrix[rowNumber - 1] = values.slice(1).map((cell) => String(cell ?? '').trim());
    });
    return matrix;
  }
  return [];
}

function detectColumns(header: string[]): { origin: number; supplier: number; entry: number } {
  let origin = -1;
  let supplier = -1;
  let entry = -1;
  header.forEach((raw, i) => {
    const h = normHeader(raw);
    if (origin === -1 && (h.includes('origem') || h.includes('origin'))) origin = i;
    else if (entry === -1 && (h.includes('entrada') || h.includes('entry'))) entry = i;
    else if (
      supplier === -1 &&
      (h.includes('cnpj') || h.includes('fornecedor') || h.includes('supplier'))
    )
      supplier = i;
  });
  return { origin, supplier, entry };
}

export type ImportResult =
  | { ok: true; created: number; skipped: number }
  | { ok: false; message: string };

export async function importRulesAction(formData: FormData): Promise<ImportResult> {
  const file = formData.get('file');
  if (!(file instanceof File) || file.size === 0) {
    return { ok: false, message: 'Escolha um arquivo .csv ou .xlsx.' };
  }
  const matrix = await fileToMatrix(file);
  const headerIndex = matrix.findIndex((row) => row.some((cell) => cell.trim().length > 0));
  if (headerIndex === -1) return { ok: false, message: 'A planilha está vazia.' };

  const cols = detectColumns(matrix[headerIndex]!);
  if (cols.origin === -1 || cols.entry === -1) {
    return {
      ok: false,
      message: 'O cabeçalho precisa de colunas de CFOP de origem e de CFOP de entrada.',
    };
  }

  const supabase = await createClient();
  let created = 0;
  let skipped = 0;
  for (let i = headerIndex + 1; i < matrix.length; i += 1) {
    const cells = matrix[i] ?? [];
    if (cells.join('').trim().length === 0) continue; // trailing blank row
    const built = buildRule({
      originCfop: cells[cols.origin] ?? '',
      entryCfop: cells[cols.entry] ?? '',
      supplierCnpj: cols.supplier >= 0 ? (cells[cols.supplier] ?? '') : '',
    });
    if (!built.ok) {
      skipped += 1;
      continue;
    }
    const result = await createMappingRule(supabase, {
      domain: CFOP_DOMAIN,
      level: built.level,
      key: built.key,
      value: built.value,
    });
    if (result.ok) created += 1;
    else skipped += 1;
  }
  revalidatePath('/regras');
  return { ok: true, created, skipped };
}
