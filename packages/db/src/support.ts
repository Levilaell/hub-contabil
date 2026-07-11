import type { SupabaseClient } from '@supabase/supabase-js';

// Support (atendimento) read/act use cases. Reads are RLS-scoped (the firm sees its
// own tickets); replying, escalating and resolving go through SECURITY DEFINER RPCs
// that stamp the actor and audit. Tickets/messages are created by the worker
// (service role) when a client writes in — the web never inserts them directly.

export type SupportStatus = 'open' | 'pending' | 'escalated' | 'resolved';
export type SupportHandler = 'ai' | 'human';

export interface SupportTicket {
  id: string;
  companyId: string | null;
  channel: string;
  contactIdentifier: string;
  contactName: string | null;
  subject: string;
  status: SupportStatus;
  /** Firm-config department key picked via the reception menu (or by a human). */
  department: string | null;
  aiHandled: boolean;
  /** Who owns the conversation (T27): 'human' silences the assistant until hand-back. */
  handledBy: SupportHandler;
  lastMessageAt: string;
  lastInboundAt: string | null;
  createdAt: string;
}

export interface SupportMessage {
  id: string;
  direction: 'inbound' | 'outbound';
  author: 'client' | 'ai' | 'user';
  body: string;
  delivery: 'queued' | 'delivered' | 'failed';
  createdAt: string;
}

interface TicketRow {
  id: string;
  company_id: string | null;
  channel: string;
  contact_identifier: string;
  contact_name: string | null;
  subject: string;
  status: string;
  department: string | null;
  ai_handled: boolean;
  handled_by: string;
  last_message_at: string;
  last_inbound_at: string | null;
  created_at: string;
}

interface MessageRow {
  id: string;
  direction: string;
  author: string;
  body: string;
  delivery: string;
  created_at: string;
}

const TICKET_SELECT =
  'id, company_id, channel, contact_identifier, contact_name, subject, status, department, ai_handled, handled_by, last_message_at, last_inbound_at, created_at';

function asStatus(value: string): SupportStatus {
  return value === 'pending' || value === 'escalated' || value === 'resolved'
    ? value
    : 'open';
}

function mapTicket(row: TicketRow): SupportTicket {
  return {
    id: row.id,
    companyId: row.company_id,
    channel: row.channel,
    contactIdentifier: row.contact_identifier,
    contactName: row.contact_name,
    subject: row.subject,
    status: asStatus(row.status),
    department: row.department,
    aiHandled: row.ai_handled,
    handledBy: row.handled_by === 'human' ? 'human' : 'ai',
    lastMessageAt: row.last_message_at,
    lastInboundAt: row.last_inbound_at,
    createdAt: row.created_at,
  };
}

export async function listSupportTickets(
  supabase: SupabaseClient,
  opts?: { status?: SupportStatus | 'open_all' | 'all'; department?: string },
): Promise<SupportTicket[]> {
  let query = supabase.from('support_tickets').select(TICKET_SELECT);
  const status = opts?.status ?? 'open_all';
  if (status === 'open_all') query = query.in('status', ['open', 'escalated']);
  else if (status !== 'all') query = query.eq('status', status);
  if (opts?.department) query = query.eq('department', opts.department);
  const { data, error } = await query.order('last_message_at', { ascending: false });
  if (error || !data) return [];
  return (data as TicketRow[]).map(mapTicket);
}

/** Open + escalated tickets — the sidebar count badge (queues with attention). */
export async function countOpenSupportTickets(supabase: SupabaseClient): Promise<number> {
  const { count, error } = await supabase
    .from('support_tickets')
    .select('id', { count: 'exact', head: true })
    .in('status', ['open', 'escalated']);
  if (error) return 0;
  return count ?? 0;
}

export async function listSupportMessages(
  supabase: SupabaseClient,
  ticketId: string,
): Promise<SupportMessage[]> {
  const { data, error } = await supabase
    .from('support_messages')
    .select('id, direction, author, body, delivery, created_at')
    .eq('ticket_id', ticketId)
    .order('created_at', { ascending: true });
  if (error || !data) return [];
  return (data as MessageRow[]).map((r) => ({
    id: r.id,
    direction: r.direction === 'outbound' ? 'outbound' : 'inbound',
    author: r.author === 'ai' ? 'ai' : r.author === 'user' ? 'user' : 'client',
    body: r.body,
    delivery: r.delivery === 'queued' ? 'queued' : r.delivery === 'failed' ? 'failed' : 'delivered',
    createdAt: r.created_at,
  }));
}

export type SupportActionResult = { ok: true } | { ok: false; message: string };

export async function replySupportTicket(
  supabase: SupabaseClient,
  ticketId: string,
  body: string,
): Promise<SupportActionResult> {
  const text = body.trim();
  if (!text) return { ok: false, message: 'Escreva uma resposta antes de enviar.' };
  const { error } = await supabase.rpc('reply_support_ticket', { p_ticket_id: ticketId, p_body: text });
  if (error) return { ok: false, message: 'Não foi possível enviar — verifique e tente de novo.' };
  return { ok: true };
}

export async function setSupportStatus(
  supabase: SupabaseClient,
  ticketId: string,
  status: 'escalated' | 'resolved' | 'open',
  note?: string,
): Promise<SupportActionResult> {
  const { error } = await supabase.rpc('set_support_status', {
    p_ticket_id: ticketId,
    p_status: status,
    p_note: note ?? null,
  });
  if (error) return { ok: false, message: 'Não foi possível atualizar — verifique e tente de novo.' };
  return { ok: true };
}

/** Hand the conversation back to the assistant ("Devolver para IA", T27). */
export async function returnTicketToAi(
  supabase: SupabaseClient,
  ticketId: string,
): Promise<SupportActionResult> {
  const { error } = await supabase.rpc('return_ticket_to_ai', { p_ticket_id: ticketId });
  if (error) return { ok: false, message: 'Não foi possível devolver para a IA — tente de novo.' };
  return { ok: true };
}
