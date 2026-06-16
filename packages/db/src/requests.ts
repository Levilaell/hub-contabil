import { parseFirmConfig } from '@hub/config';
import type { RequestKind, RequestStatus } from '@hub/core';
import type { SupabaseClient } from '@supabase/supabase-js';

import { loadFirm } from './firm';

// Document-request use cases (T16). Firm-side reads are RLS-scoped; every state
// change goes through an RPC. The public page (no firm JWT) only ever reaches the
// token-keyed SECURITY DEFINER RPCs — the raw token is generated here, but only
// its sha256 hash is stored, so the DB never holds a replayable link.

export interface DocumentRequest {
  id: string;
  companyId: string;
  kind: RequestKind;
  title: string;
  description: string;
  documentId: string | null;
  requestedDocType: string | null;
  status: RequestStatus;
  expiresAt: string;
  sentAt: string | null;
  createdAt: string;
}

/** A request joined with its company's display name (global follow-up screen). */
export interface RequestWithCompany extends DocumentRequest {
  companyName: string;
}

interface DocumentRequestRow {
  id: string;
  company_id: string;
  kind: string;
  title: string;
  description: string;
  document_id: string | null;
  requested_doc_type: string | null;
  status: string;
  expires_at: string;
  sent_at: string | null;
  created_at: string;
}

export interface RequestEvent {
  id: string;
  eventType: 'viewed' | 'received' | 'downloaded' | 'sent' | 'reminded';
  ip: string | null;
  userAgent: string | null;
  occurredAt: string;
}

/** Public render shape behind a token (from get_request_by_token). */
export interface PublicRequestView {
  firmName: string;
  companyName: string;
  kind: RequestKind;
  title: string;
  description: string;
  status: RequestStatus;
  isExpired: boolean;
  expiresAt: string;
  documentFileName: string | null;
  requestedDocType: string | null;
}

export interface CreateRequestInput {
  companyId: string;
  kind: RequestKind;
  title: string;
  description?: string;
  documentId?: string | null; // document_offer: the doc to share
  requestedDocType?: string | null; // upload_request: hint of what's wanted
  expiryDays?: number; // overrides the firm config default
}

export type CreateRequestResult =
  | { ok: true; id: string; token: string }
  | { ok: false; message: string };
export type RequestActionResult = { ok: true } | { ok: false; message: string };

const SELECT =
  'id, company_id, kind, title, description, document_id, requested_doc_type, status, expires_at, sent_at, created_at';

function fail(message: string): { ok: false; message: string } {
  return { ok: false, message };
}

function mapRequest(row: DocumentRequestRow): DocumentRequest {
  return {
    id: row.id,
    companyId: row.company_id,
    kind: row.kind as RequestKind,
    title: row.title,
    description: row.description,
    documentId: row.document_id,
    requestedDocType: row.requested_doc_type,
    status: row.status as RequestStatus,
    expiresAt: row.expires_at,
    sentAt: row.sent_at,
    createdAt: row.created_at,
  };
}

function base64url(bytes: Uint8Array): string {
  let bin = '';
  for (const b of bytes) bin += String.fromCharCode(b);
  return btoa(bin).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

/** Opaque bearer token for the link; only its sha256 hash is persisted. Uses the
 *  Web Crypto API (global in Node 20 and browsers) so this module carries no
 *  node-only import — @hub/db stays safe to import from client components. */
async function newToken(): Promise<{ token: string; hash: string }> {
  const raw = new Uint8Array(32);
  crypto.getRandomValues(raw);
  const token = base64url(raw);
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(token));
  const hash = Array.from(new Uint8Array(digest))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
  return { token, hash };
}

export async function createDocumentRequest(
  supabase: SupabaseClient,
  input: CreateRequestInput,
): Promise<CreateRequestResult> {
  const firm = await loadFirm(supabase);
  if (!firm) return fail('Não foi possível identificar o escritório.');

  const config = parseFirmConfig(firm.config);
  const days = input.expiryDays ?? config.requestTokenExpiryDays;
  if (!Number.isInteger(days) || days < 1 || days > 90) {
    return fail('A validade do link deve ser entre 1 e 90 dias.');
  }
  if (input.kind === 'document_offer' && !input.documentId) {
    return fail('Selecione o documento que ficará disponível.');
  }

  const { token, hash } = await newToken();
  const expiresAt = new Date(Date.now() + days * 86_400_000).toISOString();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { data, error } = await supabase
    .from('document_requests')
    .insert({
      firm_id: firm.id,
      company_id: input.companyId,
      kind: input.kind,
      title: input.title,
      description: input.description ?? '',
      document_id: input.kind === 'document_offer' ? (input.documentId ?? null) : null,
      requested_doc_type: input.kind === 'upload_request' ? (input.requestedDocType ?? null) : null,
      token_hash: hash,
      expires_at: expiresAt,
      created_by: user?.id ?? null,
    })
    .select('id')
    .single();
  if (error || !data) return fail('Não foi possível criar a solicitação.');

  await supabase.rpc('log_audit', {
    p_action: 'request.created',
    p_entity: 'document_request',
    p_entity_id: data.id,
    p_context: { companyId: input.companyId, kind: input.kind },
  });
  return { ok: true, id: data.id, token };
}

export async function listDocumentRequests(
  supabase: SupabaseClient,
  opts?: { companyId?: string },
): Promise<DocumentRequest[]> {
  let query = supabase.from('document_requests').select(SELECT);
  if (opts?.companyId) query = query.eq('company_id', opts.companyId);
  const { data, error } = await query.order('created_at', { ascending: false });
  if (error || !data) return [];
  return (data as DocumentRequestRow[]).map(mapRequest);
}

/** All requests across the firm's companies, with each company's display name,
 *  for the global follow-up screen. Two queries (robust vs composite-FK embeds). */
export async function listAllRequests(supabase: SupabaseClient): Promise<RequestWithCompany[]> {
  const { data, error } = await supabase
    .from('document_requests')
    .select(SELECT)
    .order('created_at', { ascending: false });
  if (error || !data) return [];
  const rows = (data as DocumentRequestRow[]).map(mapRequest);

  const companyIds = [...new Set(rows.map((r) => r.companyId))];
  const names = new Map<string, string>();
  if (companyIds.length) {
    const { data: companies } = await supabase
      .from('companies')
      .select('id, trade_name, legal_name')
      .in('id', companyIds);
    for (const c of companies ?? []) {
      names.set(c.id as string, ((c.trade_name as string) || (c.legal_name as string)) ?? '');
    }
  }
  return rows.map((r) => ({ ...r, companyName: names.get(r.companyId) ?? '' }));
}

/** Resolve a company's e-mail recipient: the primary contact, else the first with
 *  an e-mail. Null when none — the caller decides (ask the user, or skip). */
export async function getCompanyPrimaryEmail(
  supabase: SupabaseClient,
  companyId: string,
): Promise<string | null> {
  const { data } = await supabase
    .from('contacts')
    .select('email, is_primary')
    .eq('company_id', companyId)
    .not('email', 'is', null)
    .order('is_primary', { ascending: false });
  const first = (data ?? [])[0];
  return (first?.email as string | null) ?? null;
}

/** Rotate the access token (resend / new copy-link). Returns the fresh raw token
 *  to build the link; the previous link stops working. Marks the request sent. */
export async function rotateRequestToken(
  supabase: SupabaseClient,
  id: string,
  expiryDays?: number,
): Promise<{ ok: true; token: string } | { ok: false; message: string }> {
  const { data, error } = await supabase.rpc('rotate_request_token', {
    p_id: id,
    p_expiry_days: expiryDays ?? null,
  });
  if (error || !data) return fail('Não foi possível gerar um novo link.');
  return { ok: true, token: data as string };
}

export async function listRequestEvents(
  supabase: SupabaseClient,
  requestId: string,
): Promise<RequestEvent[]> {
  const { data, error } = await supabase
    .from('document_request_events')
    .select('id, event_type, ip, user_agent, occurred_at')
    .eq('request_id', requestId)
    .order('occurred_at', { ascending: false });
  if (error || !data) return [];
  return data.map((row) => ({
    id: row.id as string,
    eventType: row.event_type as RequestEvent['eventType'],
    ip: (row.ip as string | null) ?? null,
    userAgent: (row.user_agent as string | null) ?? null,
    occurredAt: row.occurred_at as string,
  }));
}

/** Count of requests still awaiting client action (dashboard, T13/T16). */
export async function countOpenRequests(supabase: SupabaseClient): Promise<number> {
  const { count, error } = await supabase
    .from('document_requests')
    .select('id', { count: 'exact', head: true })
    .in('status', ['requested', 'sent', 'viewed']);
  if (error) return 0;
  return count ?? 0;
}

export async function cancelDocumentRequest(
  supabase: SupabaseClient,
  id: string,
): Promise<RequestActionResult> {
  const { error } = await supabase.rpc('cancel_document_request', { p_id: id });
  if (error) return fail('Não foi possível cancelar — verifique e tente de novo.');
  return { ok: true };
}

// ---- Public path (token-keyed RPCs; safe to call with the anon client) ---------

export async function getRequestByToken(
  supabase: SupabaseClient,
  token: string,
): Promise<PublicRequestView | null> {
  const { data, error } = await supabase.rpc('get_request_by_token', { p_token: token });
  if (error || !data || (Array.isArray(data) && data.length === 0)) return null;
  const row = (Array.isArray(data) ? data[0] : data) as {
    firm_name: string;
    company_name: string;
    kind: string;
    title: string;
    description: string;
    status: string;
    is_expired: boolean;
    expires_at: string;
    document_file_name: string | null;
    requested_doc_type: string | null;
  };
  return {
    firmName: row.firm_name,
    companyName: row.company_name,
    kind: row.kind as RequestKind,
    title: row.title,
    description: row.description,
    status: row.status as RequestStatus,
    isExpired: row.is_expired,
    expiresAt: row.expires_at,
    documentFileName: row.document_file_name,
    requestedDocType: row.requested_doc_type,
  };
}

export interface RequestOwner {
  firmId: string;
  companyId: string;
  kind: RequestKind;
  isExpired: boolean;
}

/** Owner ids behind a token, for server-side Storage-path building (never trust client ids). */
export async function getRequestOwner(
  supabase: SupabaseClient,
  token: string,
): Promise<RequestOwner | null> {
  const { data, error } = await supabase.rpc('get_request_owner', { p_token: token });
  if (error || !data || (Array.isArray(data) && data.length === 0)) return null;
  const row = (Array.isArray(data) ? data[0] : data) as {
    firm_id: string;
    company_id: string;
    kind: string;
    is_expired: boolean;
  };
  return {
    firmId: row.firm_id,
    companyId: row.company_id,
    kind: row.kind as RequestKind,
    isExpired: row.is_expired,
  };
}

export async function logRequestView(
  supabase: SupabaseClient,
  token: string,
  ip?: string | null,
  userAgent?: string | null,
): Promise<void> {
  await supabase.rpc('log_request_view', {
    p_token: token,
    p_ip: ip ?? null,
    p_user_agent: userAgent ?? null,
  });
}

export async function recordRequestUpload(
  supabase: SupabaseClient,
  input: {
    token: string;
    storagePath: string;
    hash: string;
    fileName: string;
    size: number | null;
    ip?: string | null;
    userAgent?: string | null;
  },
): Promise<RequestActionResult> {
  const { error } = await supabase.rpc('record_request_upload', {
    p_token: input.token,
    p_storage_path: input.storagePath,
    p_hash: input.hash,
    p_file_name: input.fileName,
    p_size: input.size,
    p_ip: input.ip ?? null,
    p_user_agent: input.userAgent ?? null,
  });
  if (error) return fail('Não foi possível enviar o documento. O link pode ter expirado.');
  return { ok: true };
}

/** Logs the download and returns the document's storage path (caller mints a signed URL). */
export async function recordRequestDownload(
  supabase: SupabaseClient,
  token: string,
  ip?: string | null,
  userAgent?: string | null,
): Promise<string | null> {
  const { data, error } = await supabase.rpc('record_request_download', {
    p_token: token,
    p_ip: ip ?? null,
    p_user_agent: userAgent ?? null,
  });
  if (error || !data) return null;
  return data as string;
}
