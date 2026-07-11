'use server';

import {
  listSupportMessages,
  replySupportTicket,
  returnTicketToAi,
  setSupportStatus,
  setTicketDepartment,
  type SupportMessage,
} from '@hub/db';
import { revalidatePath } from 'next/cache';

import { createClient } from '@/lib/supabase/server';

export type SupportActionState = { ok: boolean; message: string } | null;

export async function loadSupportMessagesAction(ticketId: string): Promise<SupportMessage[]> {
  const supabase = await createClient();
  return listSupportMessages(supabase, ticketId);
}

export async function replySupportAction(
  ticketId: string,
  body: string,
): Promise<SupportActionState> {
  const supabase = await createClient();
  const res = await replySupportTicket(supabase, ticketId, body);
  if (!res.ok) return { ok: false, message: res.message };
  // 'layout' scope so the sidebar count badge refreshes too, not just the list.
  revalidatePath('/atendimento', 'layout');
  return { ok: true, message: '' };
}

export async function setSupportStatusAction(
  ticketId: string,
  status: 'escalated' | 'resolved' | 'open',
): Promise<SupportActionState> {
  const supabase = await createClient();
  const res = await setSupportStatus(supabase, ticketId, status);
  if (!res.ok) return { ok: false, message: res.message };
  revalidatePath('/atendimento', 'layout');
  return { ok: true, message: '' };
}

export async function returnToAiAction(ticketId: string): Promise<SupportActionState> {
  const supabase = await createClient();
  const res = await returnTicketToAi(supabase, ticketId);
  if (!res.ok) return { ok: false, message: res.message };
  revalidatePath('/atendimento', 'layout');
  return { ok: true, message: '' };
}

export async function setDepartmentAction(
  ticketId: string,
  department: string,
): Promise<SupportActionState> {
  const supabase = await createClient();
  const res = await setTicketDepartment(supabase, ticketId, department);
  if (!res.ok) return { ok: false, message: res.message };
  revalidatePath('/atendimento', 'layout');
  return { ok: true, message: '' };
}
