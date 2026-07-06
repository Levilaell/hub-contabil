import type { SupabaseClient } from '@supabase/supabase-js';

import { loadFirm } from './firm';
import type { MutationResult } from './companies';

// Company partner (sócio) use cases (Fase 1.1 §1.1). Same pattern as contacts:
// validate → persist (RLS) → audit. firm_id is stamped from the caller's own firm.
// Deliberately a simple registry — only the name is required.

export interface CompanyPartner {
  id: string;
  companyId: string;
  name: string;
  cpfCnpj: string | null;
  qualification: string | null;
  ownershipPercent: number | null;
  joinedOn: string | null; // YYYY-MM-DD
}

export interface PartnerInput {
  companyId: string;
  name: string;
  cpfCnpj?: string | null;
  qualification?: string | null;
  ownershipPercent?: number | null;
  joinedOn?: string | null;
}

export type PartnerEdits = Omit<PartnerInput, 'companyId'>;

interface PartnerRow {
  id: string;
  company_id: string;
  name: string;
  cpf_cnpj: string | null;
  qualification: string | null;
  ownership_percent: number | string | null;
  joined_on: string | null;
}

function fail(message: string): { ok: false; message: string } {
  return { ok: false, message };
}

function cleanText(value: unknown): string | null {
  if (typeof value !== 'string') return null;
  const trimmed = value.trim();
  return trimmed.length ? trimmed : null;
}

function mapPartner(row: PartnerRow): CompanyPartner {
  const percent =
    typeof row.ownership_percent === 'string'
      ? Number(row.ownership_percent)
      : row.ownership_percent;
  return {
    id: row.id,
    companyId: row.company_id,
    name: row.name,
    cpfCnpj: row.cpf_cnpj,
    qualification: row.qualification,
    ownershipPercent: percent !== null && Number.isFinite(percent) ? percent : null,
    joinedOn: row.joined_on,
  };
}

function validatePartner(
  edits: PartnerEdits,
): { ok: true; columns: Record<string, unknown> } | { ok: false; message: string } {
  const name = cleanText(edits.name);
  if (!name) return fail('Informe o nome do sócio.');

  const percent = edits.ownershipPercent ?? null;
  if (percent !== null && (!Number.isFinite(percent) || percent < 0 || percent > 100)) {
    return fail('Participação deve estar entre 0 e 100%.');
  }

  const joinedOn = cleanText(edits.joinedOn);
  if (joinedOn && !/^\d{4}-\d{2}-\d{2}$/.test(joinedOn)) {
    return fail('Data inválida — use o formato AAAA-MM-DD.');
  }

  return {
    ok: true,
    columns: {
      name,
      cpf_cnpj: cleanText(edits.cpfCnpj),
      qualification: cleanText(edits.qualification),
      ownership_percent: percent,
      joined_on: joinedOn,
    },
  };
}

export async function listPartners(
  supabase: SupabaseClient,
  companyId: string,
): Promise<CompanyPartner[]> {
  const { data, error } = await supabase
    .from('company_partners')
    .select('id, company_id, name, cpf_cnpj, qualification, ownership_percent, joined_on')
    .eq('company_id', companyId)
    .order('name');
  if (error || !data) return [];
  return (data as PartnerRow[]).map(mapPartner);
}

export async function createPartner(
  supabase: SupabaseClient,
  input: PartnerInput,
): Promise<MutationResult> {
  const firm = await loadFirm(supabase);
  if (!firm) return fail('Não foi possível identificar o escritório.');

  const companyId = cleanText(input.companyId);
  if (!companyId) return fail('Empresa não informada.');

  const validated = validatePartner(input);
  if (!validated.ok) return validated;

  const { data, error } = await supabase
    .from('company_partners')
    .insert({ firm_id: firm.id, company_id: companyId, ...validated.columns })
    .select('id')
    .single();
  if (error || !data) {
    return fail('Não foi possível salvar o sócio — verifique suas permissões.');
  }

  await supabase.rpc('log_audit', {
    p_action: 'partner.created',
    p_entity: 'company_partner',
    p_entity_id: data.id,
    p_context: { companyId },
  });
  return { ok: true, id: data.id };
}

export async function updatePartner(
  supabase: SupabaseClient,
  id: string,
  edits: PartnerEdits,
): Promise<MutationResult> {
  const validated = validatePartner(edits);
  if (!validated.ok) return validated;

  const { data, error } = await supabase
    .from('company_partners')
    .update(validated.columns)
    .eq('id', id)
    .select('id');
  if (error || !data || data.length === 0) {
    return fail('Não foi possível salvar — verifique suas permissões.');
  }

  await supabase.rpc('log_audit', {
    p_action: 'partner.updated',
    p_entity: 'company_partner',
    p_entity_id: id,
    p_context: {},
  });
  return { ok: true, id };
}

export async function deletePartner(supabase: SupabaseClient, id: string): Promise<MutationResult> {
  const { data, error } = await supabase
    .from('company_partners')
    .delete()
    .eq('id', id)
    .select('id');
  if (error || !data || data.length === 0) {
    return fail('Não foi possível remover — verifique suas permissões.');
  }

  await supabase.rpc('log_audit', {
    p_action: 'partner.deleted',
    p_entity: 'company_partner',
    p_entity_id: id,
    p_context: {},
  });
  return { ok: true, id };
}
