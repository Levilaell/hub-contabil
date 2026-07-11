'use server';

import { BrasilApiEnrichmentAdapter, type CompanyEnrichment } from '@hub/adapters';
import { isValidCnpj, normalizeCnpj } from '@hub/core';
import {
  createCompany,
  updateCompany,
  setCompanyArchived,
  requestEnrichment,
  createContact,
  updateContact,
  deleteContact,
  createPartner,
  updatePartner,
  deletePartner,
  generateRecurringTasksForCompany,
  type CompanyDetails,
  type PreferredChannel,
} from '@hub/db';
import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';

import { createClient } from '@/lib/supabase/server';

// Thin wrappers over the tested @hub/db use cases (validate → persist → audit),
// adding revalidation/redirect. Real logic stays in @hub/db.

export type ActionState = { ok: boolean; message: string } | null;

function field(formData: FormData, key: string): string {
  const value = formData.get(key);
  return typeof value === 'string' ? value : '';
}

// Interactive CNPJ lookup (Fase 1.1 §1.2): one adapter instance per server
// process so the politeness throttle is shared across users of this instance.
const lookupAdapter = new BrasilApiEnrichmentAdapter();

export type CnpjLookupResult =
  | { ok: true; data: CompanyEnrichment }
  | { ok: false; message: string };

export async function lookupCnpjAction(cnpj: string): Promise<CnpjLookupResult> {
  const digits = normalizeCnpj(cnpj);
  if (!isValidCnpj(digits)) {
    return { ok: false, message: 'CNPJ inválido — verifique os dígitos.' };
  }
  // Only signed-in users may trigger outbound lookups.
  const supabase = await createClient();
  const { data } = await supabase.auth.getUser();
  if (!data.user) return { ok: false, message: 'Sessão expirada — entre novamente.' };

  const outcome = await lookupAdapter.enrich(digits);
  if (!outcome.ok) {
    return { ok: false, message: 'Não foi possível buscar os dados agora — preencha manualmente.' };
  }
  return { ok: true, data: outcome.data };
}

function detailFields(formData: FormData): Partial<CompanyDetails> {
  const capitalRaw = field(formData, 'shareCapital').replace(/\./g, '').replace(',', '.').trim();
  const shareCapital = capitalRaw === '' ? null : Number(capitalRaw);
  return {
    legalNature: field(formData, 'legalNature'),
    companySize: field(formData, 'companySize'),
    stateRegistration: field(formData, 'stateRegistration'),
    municipalRegistration: field(formData, 'municipalRegistration'),
    nire: field(formData, 'nire'),
    nireIssuedOn: field(formData, 'nireIssuedOn'),
    activitiesStartedOn: field(formData, 'activitiesStartedOn'),
    serviceStartedOn: field(formData, 'serviceStartedOn'),
    addressStreet: field(formData, 'addressStreet'),
    addressNumber: field(formData, 'addressNumber'),
    addressComplement: field(formData, 'addressComplement'),
    addressDistrict: field(formData, 'addressDistrict'),
    addressZip: field(formData, 'addressZip'),
    shareCapital: shareCapital !== null && Number.isFinite(shareCapital) ? shareCapital : null,
    cnaeCode: field(formData, 'cnaeCode'),
    cnaeDescription: field(formData, 'cnaeDescription'),
  };
}

// Partners handed over by the CNPJ lookup (hidden JSON field). Malformed input
// degrades to an empty list — partners are never required to save.
function partnersFromForm(formData: FormData): { name: string; qualification: string | null }[] {
  try {
    const parsed: unknown = JSON.parse(field(formData, 'partnersJson') || '[]');
    if (!Array.isArray(parsed)) return [];
    return parsed.flatMap((entry) => {
      const row = (entry ?? {}) as Record<string, unknown>;
      if (typeof row.name !== 'string' || !row.name.trim()) return [];
      return [
        {
          name: row.name.trim(),
          qualification: typeof row.qualification === 'string' ? row.qualification : null,
        },
      ];
    });
  } catch {
    return [];
  }
}

export async function createCompanyAction(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const supabase = await createClient();
  const result = await createCompany(supabase, {
    cnpj: field(formData, 'cnpj'),
    legalName: field(formData, 'legalName'),
    tradeName: field(formData, 'tradeName'),
    taxRegime: field(formData, 'taxRegime'),
    city: field(formData, 'city'),
    state: field(formData, 'state'),
    ...detailFields(formData),
  });
  if (!result.ok) return { ok: false, message: result.message };

  // Partners from the CNPJ lookup — best-effort, never undoes creation. Marked
  // 'qsa' so the panel can tell auto-imported partners from hand-entered ones (T32).
  for (const partner of partnersFromForm(formData)) {
    await createPartner(supabase, { companyId: result.id, source: 'qsa', ...partner });
  }
  // Fase 1.1 §2: the company's current-month recurring tasks exist right away.
  await generateRecurringTasksForCompany(supabase, result.id);
  // Auto-enrich (T7): best-effort enqueue — a failure here must NOT undo creation.
  await requestEnrichment(supabase, result.id);
  revalidatePath('/empresas');
  redirect(`/empresas/${result.id}`);
}

export async function enrichCompanyAction(companyId: string): Promise<void> {
  const supabase = await createClient();
  await requestEnrichment(supabase, companyId);
  revalidatePath(`/empresas/${companyId}`);
}

export async function updateCompanyAction(
  companyId: string,
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const supabase = await createClient();
  const result = await updateCompany(supabase, companyId, {
    legalName: field(formData, 'legalName'),
    tradeName: field(formData, 'tradeName'),
    taxRegime: field(formData, 'taxRegime'),
    city: field(formData, 'city'),
    state: field(formData, 'state'),
    ...detailFields(formData),
  });
  if (!result.ok) return { ok: false, message: result.message };
  revalidatePath('/empresas');
  revalidatePath(`/empresas/${companyId}`);
  redirect(`/empresas/${companyId}`);
}

export async function toggleArchivedAction(companyId: string, archived: boolean): Promise<void> {
  const supabase = await createClient();
  await setCompanyArchived(supabase, companyId, archived);
  revalidatePath('/empresas');
  revalidatePath(`/empresas/${companyId}`);
}

function departmentsFromForm(formData: FormData): string[] {
  return formData.getAll('departments').filter((v): v is string => typeof v === 'string');
}

export async function createContactAction(
  companyId: string,
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const supabase = await createClient();
  const result = await createContact(supabase, {
    companyId,
    name: field(formData, 'name'),
    email: field(formData, 'email'),
    phone: field(formData, 'phone'),
    preferredChannel: field(formData, 'preferredChannel') as PreferredChannel,
    isPrimary: formData.get('isPrimary') === 'on',
    departments: departmentsFromForm(formData),
  });
  if (!result.ok) return { ok: false, message: result.message };
  revalidatePath(`/empresas/${companyId}`);
  return { ok: true, message: '' };
}

export async function updateContactAction(
  contactId: string,
  companyId: string,
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const supabase = await createClient();
  const result = await updateContact(supabase, contactId, {
    name: field(formData, 'name'),
    email: field(formData, 'email'),
    phone: field(formData, 'phone'),
    preferredChannel: field(formData, 'preferredChannel') as PreferredChannel,
    isPrimary: formData.get('isPrimary') === 'on',
    departments: departmentsFromForm(formData),
  });
  if (!result.ok) return { ok: false, message: result.message };
  revalidatePath(`/empresas/${companyId}`);
  return { ok: true, message: '' };
}

export async function deleteContactAction(contactId: string, companyId: string): Promise<void> {
  const supabase = await createClient();
  await deleteContact(supabase, contactId);
  revalidatePath(`/empresas/${companyId}`);
}

export async function createPartnerAction(
  companyId: string,
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const percentRaw = field(formData, 'ownershipPercent').replace(',', '.').trim();
  const supabase = await createClient();
  const result = await createPartner(supabase, {
    companyId,
    name: field(formData, 'name'),
    cpfCnpj: field(formData, 'cpfCnpj'),
    qualification: field(formData, 'qualification'),
    ownershipPercent: percentRaw === '' ? null : Number(percentRaw),
    joinedOn: field(formData, 'joinedOn'),
  });
  if (!result.ok) return { ok: false, message: result.message };
  revalidatePath(`/empresas/${companyId}`);
  return { ok: true, message: '' };
}

export async function updatePartnerAction(
  partnerId: string,
  companyId: string,
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const percentRaw = field(formData, 'ownershipPercent').replace(',', '.').trim();
  const supabase = await createClient();
  const result = await updatePartner(supabase, partnerId, {
    name: field(formData, 'name'),
    cpfCnpj: field(formData, 'cpfCnpj'),
    qualification: field(formData, 'qualification'),
    ownershipPercent: percentRaw === '' ? null : Number(percentRaw),
    joinedOn: field(formData, 'joinedOn'),
  });
  if (!result.ok) return { ok: false, message: result.message };
  revalidatePath(`/empresas/${companyId}`);
  return { ok: true, message: '' };
}

export async function deletePartnerAction(partnerId: string, companyId: string): Promise<void> {
  const supabase = await createClient();
  await deletePartner(supabase, partnerId);
  revalidatePath(`/empresas/${companyId}`);
}
