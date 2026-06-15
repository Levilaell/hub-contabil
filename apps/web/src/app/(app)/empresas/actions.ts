'use server';

import {
  createCompany,
  updateCompany,
  setCompanyArchived,
  requestEnrichment,
  createContact,
  updateContact,
  deleteContact,
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
  });
  if (!result.ok) return { ok: false, message: result.message };
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
