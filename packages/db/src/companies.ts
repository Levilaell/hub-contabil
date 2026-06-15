import { parseFirmConfig } from '@hub/config';
import { isValidCnpj, normalizeCnpj } from '@hub/core';
import type { SupabaseClient } from '@supabase/supabase-js';

import { loadFirm } from './firm';

// Company registry use cases (T6). Mirrors saveFirmConfig: validate (pt-BR on
// failure) → persist via the caller's RLS-scoped client → audit via log_audit.
// firm_id is stamped from the caller's own firm, never trusted from input.

export type CompanyStatus = 'active' | 'archived';

/** Parsed view of companies.enrichment_data (written by the worker / RPC, T7). */
export interface CompanyEnrichmentView {
  status: 'pending' | 'done';
  source: string | null;
  fetchedAt: string | null;
  legalName: string | null;
  tradeName: string | null;
  cnaePrimaryCode: string | null;
  cnaePrimaryDescription: string | null;
  registrationStatus: string | null;
  addressLine: string | null;
}

export interface Company {
  id: string;
  cnpj: string;
  legalName: string;
  tradeName: string | null;
  taxRegime: string | null;
  city: string | null;
  state: string | null;
  status: CompanyStatus;
  enrichment: CompanyEnrichmentView | null;
  createdAt: string;
}

export interface CompanyInput {
  cnpj: string;
  legalName: string;
  tradeName?: string | null;
  taxRegime?: string | null;
  city?: string | null;
  state?: string | null;
}

/** Editable fields (cnpj is the identity — read-only after creation). */
export type CompanyEdits = Omit<CompanyInput, 'cnpj'>;

export type MutationResult = { ok: true; id: string } | { ok: false; message: string };

interface CompanyRow {
  id: string;
  cnpj: string;
  legal_name: string;
  trade_name: string | null;
  tax_regime: string | null;
  city: string | null;
  state: string | null;
  status: string;
  created_at: string;
  enrichment_data?: unknown; // only selected by getCompany
}

function fail(message: string): { ok: false; message: string } {
  return { ok: false, message };
}

function readString(obj: Record<string, unknown>, key: string): string | null {
  const value = obj[key];
  if (typeof value === 'number') return String(value);
  return typeof value === 'string' && value.trim() ? value : null;
}

// Parse the untrusted enrichment_data JSONB into a typed view. Shape written by
// the worker: { status, source, fetched_at, data: CompanyEnrichment }.
function parseEnrichment(raw: unknown): CompanyEnrichmentView | null {
  let parsed: unknown = raw;
  if (typeof raw === 'string') {
    try {
      parsed = JSON.parse(raw);
    } catch {
      return null;
    }
  }
  if (!parsed || typeof parsed !== 'object') return null;
  const root = parsed as Record<string, unknown>;
  if (root.status !== 'pending' && root.status !== 'done') return null;

  const data =
    typeof root.data === 'object' && root.data ? (root.data as Record<string, unknown>) : {};
  const address =
    typeof data.address === 'object' && data.address
      ? (data.address as Record<string, unknown>)
      : {};
  const addressLine = [
    readString(address, 'street'),
    readString(address, 'number'),
    readString(address, 'district'),
    readString(address, 'city'),
    readString(address, 'state'),
  ]
    .filter(Boolean)
    .join(', ');

  return {
    status: root.status,
    source: readString(root, 'source'),
    fetchedAt: readString(root, 'fetched_at'),
    legalName: readString(data, 'legalName'),
    tradeName: readString(data, 'tradeName'),
    cnaePrimaryCode: readString(data, 'cnaePrimaryCode'),
    cnaePrimaryDescription: readString(data, 'cnaePrimaryDescription'),
    registrationStatus: readString(data, 'registrationStatus'),
    addressLine: addressLine.length ? addressLine : null,
  };
}

function cleanText(value: unknown): string | null {
  if (typeof value !== 'string') return null;
  const trimmed = value.trim();
  return trimmed.length ? trimmed : null;
}

// UF: null when blank, uppercased when valid, error sentinel when malformed.
function normalizeState(value: unknown): { ok: true; value: string | null } | { ok: false } {
  const text = cleanText(value);
  if (!text) return { ok: true, value: null };
  const upper = text.toUpperCase();
  return /^[A-Z]{2}$/.test(upper) ? { ok: true, value: upper } : { ok: false };
}

function mapCompany(row: CompanyRow): Company {
  return {
    id: row.id,
    cnpj: row.cnpj,
    legalName: row.legal_name,
    tradeName: row.trade_name,
    taxRegime: row.tax_regime,
    city: row.city,
    state: row.state,
    status: row.status === 'archived' ? 'archived' : 'active',
    enrichment: parseEnrichment(row.enrichment_data),
    createdAt: row.created_at,
  };
}

// Shared field validation for create/edit. Returns the persistable (snake_case)
// columns or a pt-BR error. cnpj is validated separately (create only).
function validateEditable(
  edits: CompanyEdits,
  config: ReturnType<typeof parseFirmConfig>,
): { ok: true; columns: Record<string, string | null> } | { ok: false; message: string } {
  const legalName = cleanText(edits.legalName);
  if (!legalName) return fail('Informe a razão social.');

  const taxRegime = cleanText(edits.taxRegime);
  if (taxRegime && !config.taxRegimes.some((r) => r.key === taxRegime)) {
    return fail('Regime fiscal inválido.');
  }

  const state = normalizeState(edits.state);
  if (!state.ok) return fail('UF deve ter 2 letras (ex.: SP).');

  return {
    ok: true,
    columns: {
      legal_name: legalName,
      trade_name: cleanText(edits.tradeName),
      tax_regime: taxRegime,
      city: cleanText(edits.city),
      state: state.value,
    },
  };
}

export async function listCompanies(
  supabase: SupabaseClient,
  opts?: { status?: CompanyStatus | 'all'; search?: string },
): Promise<Company[]> {
  let query = supabase
    .from('companies')
    .select('id, cnpj, legal_name, trade_name, tax_regime, city, state, status, created_at');

  const status = opts?.status ?? 'active';
  if (status !== 'all') query = query.eq('status', status);

  const search = cleanText(opts?.search);
  if (search) {
    // Strip characters that would break the PostgREST `or` filter grammar.
    const term = search.replace(/[,()%*]/g, ' ').trim();
    if (term) query = query.or(`legal_name.ilike.%${term}%,trade_name.ilike.%${term}%`);
  }

  const { data, error } = await query.order('legal_name');
  if (error || !data) return [];
  return (data as CompanyRow[]).map(mapCompany);
}

export async function getCompany(supabase: SupabaseClient, id: string): Promise<Company | null> {
  const { data, error } = await supabase
    .from('companies')
    .select(
      'id, cnpj, legal_name, trade_name, tax_regime, city, state, status, created_at, enrichment_data',
    )
    .eq('id', id)
    .maybeSingle();
  if (error || !data) return null;
  return mapCompany(data as CompanyRow);
}

/**
 * Enqueue a CNPJ-enrichment job for a company via the request_enrichment RPC
 * (validates firm ownership server-side, marks pending, sends to the worker
 * queue). Best-effort: callers treat failure as non-fatal so creation never breaks.
 */
export async function requestEnrichment(
  supabase: SupabaseClient,
  companyId: string,
): Promise<MutationResult> {
  const { error } = await supabase.rpc('request_enrichment', { p_company_id: companyId });
  if (error) return fail('Não foi possível solicitar o enriquecimento.');
  return { ok: true, id: companyId };
}

export async function createCompany(
  supabase: SupabaseClient,
  input: CompanyInput,
): Promise<MutationResult> {
  const firm = await loadFirm(supabase);
  if (!firm) return fail('Não foi possível identificar o escritório.');

  const cnpj = normalizeCnpj(input.cnpj ?? '');
  if (!isValidCnpj(cnpj)) return fail('CNPJ inválido — verifique os dígitos.');

  const validated = validateEditable(input, parseFirmConfig(firm.config));
  if (!validated.ok) return validated;

  const { data, error } = await supabase
    .from('companies')
    .insert({ firm_id: firm.id, cnpj, ...validated.columns })
    .select('id')
    .single();

  if (error || !data) {
    if (error?.code === '23505') {
      // unique (firm_id, cnpj). Distinguish an archived match so the user restores
      // instead of being stuck (advisor flag #3).
      const { data: existing } = await supabase
        .from('companies')
        .select('status')
        .eq('cnpj', cnpj)
        .maybeSingle();
      return fail(
        existing?.status === 'archived'
          ? 'Este CNPJ já pertence a uma empresa arquivada. Restaure-a em vez de criar outra.'
          : 'Este CNPJ já está cadastrado.',
      );
    }
    return fail('Não foi possível salvar a empresa — verifique suas permissões.');
  }

  await supabase.rpc('log_audit', {
    p_action: 'company.created',
    p_entity: 'company',
    p_entity_id: data.id,
    p_context: { cnpj, legalName: validated.columns.legal_name },
  });
  return { ok: true, id: data.id };
}

export async function updateCompany(
  supabase: SupabaseClient,
  id: string,
  edits: CompanyEdits,
): Promise<MutationResult> {
  const firm = await loadFirm(supabase);
  if (!firm) return fail('Não foi possível identificar o escritório.');

  const validated = validateEditable(edits, parseFirmConfig(firm.config));
  if (!validated.ok) return validated;

  // RLS silently filters a forbidden UPDATE to zero rows — confirm a row changed.
  const { data, error } = await supabase
    .from('companies')
    .update(validated.columns)
    .eq('id', id)
    .select('id');
  if (error || !data || data.length === 0) {
    return fail('Não foi possível salvar — verifique suas permissões.');
  }

  await supabase.rpc('log_audit', {
    p_action: 'company.updated',
    p_entity: 'company',
    p_entity_id: id,
    p_context: { legalName: validated.columns.legal_name },
  });
  return { ok: true, id };
}

export async function setCompanyArchived(
  supabase: SupabaseClient,
  id: string,
  archived: boolean,
): Promise<MutationResult> {
  const { data, error } = await supabase
    .from('companies')
    .update({ status: archived ? 'archived' : 'active' })
    .eq('id', id)
    .select('id');
  if (error || !data || data.length === 0) {
    return fail('Não foi possível atualizar — verifique suas permissões.');
  }

  await supabase.rpc('log_audit', {
    p_action: archived ? 'company.archived' : 'company.restored',
    p_entity: 'company',
    p_entity_id: id,
    p_context: {},
  });
  return { ok: true, id };
}

/** All CNPJs registered in the caller's firm (active + archived) — for the
 *  spreadsheet-import preview to flag already-registered rows. */
export async function listExistingCnpjs(supabase: SupabaseClient): Promise<string[]> {
  const { data, error } = await supabase.from('companies').select('cnpj');
  if (error || !data) return [];
  return (data as { cnpj: string }[]).map((r) => normalizeCnpj(r.cnpj));
}

export interface BulkCreateInput {
  cnpj: string;
  legalName: string;
  tradeName: string | null;
  taxRegime: string | null;
  city: string | null;
  state: string | null;
}

export type BulkCreateResult =
  | { ok: true; created: { id: string; cnpj: string }[]; duplicateCnpjs: string[] }
  | { ok: false; message: string };

/**
 * Bulk-insert validated company rows with PER-ROW isolation (golden rule #6 — one
 * bad row never aborts the batch): a single INSERT ... ON CONFLICT DO NOTHING via
 * upsert(ignoreDuplicates) inserts the non-conflicting rows and skips duplicates,
 * which we reconcile from the returned ids. Enrichment is enqueued by the caller.
 */
export async function bulkCreateCompanies(
  supabase: SupabaseClient,
  rows: BulkCreateInput[],
): Promise<BulkCreateResult> {
  if (rows.length === 0) return { ok: true, created: [], duplicateCnpjs: [] };

  const firm = await loadFirm(supabase);
  if (!firm) return { ok: false, message: 'Não foi possível identificar o escritório.' };

  const payload = rows.map((r) => ({
    firm_id: firm.id,
    cnpj: normalizeCnpj(r.cnpj),
    legal_name: r.legalName,
    trade_name: r.tradeName,
    tax_regime: r.taxRegime,
    city: r.city,
    state: r.state,
  }));

  const { data, error } = await supabase
    .from('companies')
    .upsert(payload, { onConflict: 'firm_id,cnpj', ignoreDuplicates: true })
    .select('id, cnpj');
  if (error) return { ok: false, message: 'Não foi possível importar as empresas.' };

  const created = (data ?? []) as { id: string; cnpj: string }[];
  const createdCnpjs = new Set(created.map((c) => c.cnpj));
  const duplicateCnpjs = payload.filter((p) => !createdCnpjs.has(p.cnpj)).map((p) => p.cnpj);

  if (created.length > 0) {
    await supabase.rpc('log_audit', {
      p_action: 'companies.imported',
      p_entity: 'company',
      p_entity_id: null,
      p_context: { created: created.length, source: 'spreadsheet' },
    });
  }
  return { ok: true, created, duplicateCnpjs };
}
