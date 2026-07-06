import { parseFirmConfig } from '@hub/config';
import type { SupabaseClient } from '@supabase/supabase-js';

import { loadFirm } from './firm';
import type { MutationResult } from './companies';

// Contact use cases (T6). Same pattern as companies: validate → persist (RLS) →
// audit. firm_id is stamped from the caller's own firm.
// Fase 1.1 §1.3: each contact carries the firm-config department keys it serves;
// an EMPTY list means "Todos" (serves any department).

export type PreferredChannel = 'email' | 'phone' | 'whatsapp';
const CHANNELS: PreferredChannel[] = ['email', 'phone', 'whatsapp'];

export interface Contact {
  id: string;
  companyId: string;
  name: string;
  email: string | null;
  phone: string | null;
  preferredChannel: PreferredChannel;
  isPrimary: boolean;
  /** Firm-config department keys; empty = all departments ("Todos"). */
  departments: string[];
}

export interface ContactInput {
  companyId: string;
  name: string;
  email?: string | null;
  phone?: string | null;
  preferredChannel?: PreferredChannel;
  isPrimary?: boolean;
  departments?: string[];
}

export type ContactEdits = Omit<ContactInput, 'companyId'>;

interface ContactRow {
  id: string;
  company_id: string;
  name: string;
  email: string | null;
  phone: string | null;
  preferred_channel: string;
  is_primary: boolean;
  departments: string[] | null;
}

function fail(message: string): { ok: false; message: string } {
  return { ok: false, message };
}

function cleanText(value: unknown): string | null {
  if (typeof value !== 'string') return null;
  const trimmed = value.trim();
  return trimmed.length ? trimmed : null;
}

function mapContact(row: ContactRow): Contact {
  return {
    id: row.id,
    companyId: row.company_id,
    name: row.name,
    email: row.email,
    phone: row.phone,
    preferredChannel: CHANNELS.includes(row.preferred_channel as PreferredChannel)
      ? (row.preferred_channel as PreferredChannel)
      : 'email',
    isPrimary: row.is_primary,
    departments: Array.isArray(row.departments) ? row.departments : [],
  };
}

function validateContact(
  edits: ContactEdits,
  departmentKeys: string[],
): { ok: true; columns: Record<string, unknown> } | { ok: false; message: string } {
  const name = cleanText(edits.name);
  if (!name) return fail('Informe o nome do contato.');

  const email = cleanText(edits.email);
  if (email && !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) {
    return fail('E-mail inválido.');
  }

  const channel = edits.preferredChannel ?? 'email';
  if (!CHANNELS.includes(channel)) return fail('Canal de contato inválido.');

  const departments = Array.isArray(edits.departments) ? edits.departments : [];
  if (departments.some((d) => !departmentKeys.includes(d))) {
    return fail('Departamento inválido.');
  }

  return {
    ok: true,
    columns: {
      name,
      email,
      phone: cleanText(edits.phone),
      preferred_channel: channel,
      is_primary: Boolean(edits.isPrimary),
      departments,
    },
  };
}

export async function listContacts(
  supabase: SupabaseClient,
  companyId: string,
): Promise<Contact[]> {
  const { data, error } = await supabase
    .from('contacts')
    .select('id, company_id, name, email, phone, preferred_channel, is_primary, departments')
    .eq('company_id', companyId)
    .order('is_primary', { ascending: false })
    .order('name');
  if (error || !data) return [];
  return (data as ContactRow[]).map(mapContact);
}

export async function createContact(
  supabase: SupabaseClient,
  input: ContactInput,
): Promise<MutationResult> {
  const firm = await loadFirm(supabase);
  if (!firm) return fail('Não foi possível identificar o escritório.');

  const companyId = cleanText(input.companyId);
  if (!companyId) return fail('Empresa não informada.');

  const departmentKeys = parseFirmConfig(firm.config).departments.map((d) => d.key);
  const validated = validateContact(input, departmentKeys);
  if (!validated.ok) return validated;

  const { data, error } = await supabase
    .from('contacts')
    .insert({ firm_id: firm.id, company_id: companyId, ...validated.columns })
    .select('id')
    .single();
  if (error || !data) {
    return fail('Não foi possível salvar o contato — verifique suas permissões.');
  }

  await supabase.rpc('log_audit', {
    p_action: 'contact.created',
    p_entity: 'contact',
    p_entity_id: data.id,
    p_context: { companyId },
  });
  return { ok: true, id: data.id };
}

export async function updateContact(
  supabase: SupabaseClient,
  id: string,
  edits: ContactEdits,
): Promise<MutationResult> {
  const firm = await loadFirm(supabase);
  if (!firm) return fail('Não foi possível identificar o escritório.');

  const departmentKeys = parseFirmConfig(firm.config).departments.map((d) => d.key);
  const validated = validateContact(edits, departmentKeys);
  if (!validated.ok) return validated;

  const { data, error } = await supabase
    .from('contacts')
    .update(validated.columns)
    .eq('id', id)
    .select('id');
  if (error || !data || data.length === 0) {
    return fail('Não foi possível salvar — verifique suas permissões.');
  }

  await supabase.rpc('log_audit', {
    p_action: 'contact.updated',
    p_entity: 'contact',
    p_entity_id: id,
    p_context: {},
  });
  return { ok: true, id };
}

export async function deleteContact(supabase: SupabaseClient, id: string): Promise<MutationResult> {
  const { data, error } = await supabase.from('contacts').delete().eq('id', id).select('id');
  if (error || !data || data.length === 0) {
    return fail('Não foi possível remover — verifique suas permissões.');
  }

  await supabase.rpc('log_audit', {
    p_action: 'contact.deleted',
    p_entity: 'contact',
    p_entity_id: id,
    p_context: {},
  });
  return { ok: true, id };
}
