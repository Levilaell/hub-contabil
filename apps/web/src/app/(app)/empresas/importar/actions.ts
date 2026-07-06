'use server';

import { parseFirmConfig } from '@hub/config';
import { type AnnotatedImportRow, type RawImportRow, validateImportRows } from '@hub/core';
import {
  bulkCreateCompanies,
  listExistingCnpjs,
  requestEnrichment,
  generateRecurringTasksForCompany,
  type BulkCreateInput,
} from '@hub/db';
import { revalidatePath } from 'next/cache';

import { parseSpreadsheet } from '@/lib/import/parse';
import { createClient } from '@/lib/supabase/server';

// Server actions for the onboarding wizard (T8). Validation runs server-side at
// BOTH steps — the preview is advisory; confirm re-validates against fresh DB
// state and never trusts the client's "valid" set.

export type PreviewResult =
  | {
      ok: true;
      rows: AnnotatedImportRow[];
      counts: { valid: number; invalid: number; duplicate: number };
    }
  | { ok: false; message: string };

async function loadRegimes(supabase: Awaited<ReturnType<typeof createClient>>) {
  const { data: firm } = await supabase.from('firms').select('config').limit(1).single();
  return parseFirmConfig(firm?.config).taxRegimes.map((r) => ({ key: r.key, label: r.label }));
}

export async function previewImport(formData: FormData): Promise<PreviewResult> {
  const file = formData.get('file');
  if (!(file instanceof File) || file.size === 0) {
    return { ok: false, message: 'Escolha um arquivo primeiro.' };
  }

  const parsed = await parseSpreadsheet(await file.arrayBuffer(), file.name);
  if (!parsed.ok) return { ok: false, message: parsed.message };

  const supabase = await createClient();
  const [regimes, existingCnpjs] = await Promise.all([
    loadRegimes(supabase),
    listExistingCnpjs(supabase),
  ]);

  const rows = validateImportRows(parsed.rows, { existingCnpjs, regimes });
  return {
    ok: true,
    rows,
    counts: {
      valid: rows.filter((r) => r.status === 'valid').length,
      invalid: rows.filter((r) => r.status === 'invalid').length,
      duplicate: rows.filter((r) => r.status === 'duplicate').length,
    },
  };
}

export interface ConfirmRow {
  cnpj: string;
  legalName: string;
  tradeName: string | null;
  taxRegime: string | null;
  city: string | null;
  state: string | null;
}

export type ConfirmResult =
  | { ok: true; created: number; skipped: number }
  | { ok: false; message: string };

export async function confirmImport(rows: ConfirmRow[]): Promise<ConfirmResult> {
  if (rows.length === 0) return { ok: true, created: 0, skipped: 0 };

  const supabase = await createClient();
  const [regimes, existingCnpjs] = await Promise.all([
    loadRegimes(supabase),
    listExistingCnpjs(supabase),
  ]);

  // Re-validate against fresh DB state — defends against tampering and races.
  const annotated = validateImportRows(
    rows.map((values, i) => ({
      line: i + 1,
      values: {
        cnpj: values.cnpj,
        legalName: values.legalName,
        tradeName: values.tradeName ?? undefined,
        taxRegime: values.taxRegime ?? undefined,
        city: values.city ?? undefined,
        state: values.state ?? undefined,
      } satisfies RawImportRow,
    })),
    { existingCnpjs, regimes },
  );

  const valid: BulkCreateInput[] = annotated
    .filter((r) => r.status === 'valid')
    .map((r) => ({
      cnpj: r.cnpj,
      legalName: r.legalName,
      tradeName: r.tradeName,
      taxRegime: r.taxRegime,
      city: r.city,
      state: r.state,
    }));

  const result = await bulkCreateCompanies(supabase, valid);
  if (!result.ok) return { ok: false, message: result.message };

  // Best-effort enrichment enqueue + current-month recurring tasks (Fase 1.1 §2) —
  // a failure must not undo an import that already wrote rows (both helpers
  // return a result, never throw).
  for (const company of result.created) {
    await requestEnrichment(supabase, company.id);
    await generateRecurringTasksForCompany(supabase, company.id);
  }

  revalidatePath('/empresas');
  return { ok: true, created: result.created.length, skipped: rows.length - result.created.length };
}
