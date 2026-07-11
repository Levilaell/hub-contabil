'use server';

import { buildRequestEmail, isRequestKind } from '@hub/core';
import {
  cancelDocumentRequest,
  createDocumentRequest,
  getRequestByToken,
  getSuggestedRecipientEmail,
  listContacts,
  listDocuments,
  listRequestEvents,
  markRequestSent,
  rotateRequestToken,
  type RequestEvent,
} from '@hub/db';
import { createMessagingAdapter, isMessagingConfigured } from '@hub/adapters';
import { headers } from 'next/headers';
import { revalidatePath } from 'next/cache';

import { createClient } from '@/lib/supabase/server';

// Follow-up actions. Sending and copy-link both ROTATE the token (only the hash
// is stored, so a fresh link is regenerated and the previous one stops working).
// Send integrity (T26): a request is marked sent ONLY after the provider accepts
// the e-mail — never before, and never by merely copying a link.

type SendResult = { ok: true } | { ok: false; message: string };
type CopyResult = { ok: true; token: string } | { ok: false; message: string };

async function baseUrl(): Promise<string> {
  const h = await headers();
  const host = h.get('x-forwarded-host') ?? h.get('host') ?? 'localhost:3000';
  const proto = h.get('x-forwarded-proto') ?? (host.startsWith('localhost') ? 'http' : 'https');
  return `${proto}://${host}`;
}

export async function sendRequestEmailAction(
  requestId: string,
  companyId: string,
  toOverride?: string,
): Promise<SendResult> {
  // Without a configured provider nothing would leave the system — refuse up
  // front instead of letting the no-op adapter fake a delivery.
  if (!isMessagingConfigured()) {
    return {
      ok: false,
      message: 'Envio de e-mail não configurado neste ambiente. Use "Gerar e copiar novo link".',
    };
  }

  const supabase = await createClient();
  // Fase 1.1 §1.3 — recipient suggested by the request's department; override wins.
  const to =
    (toOverride?.trim() || (await getSuggestedRecipientEmail(supabase, requestId, companyId))) ??
    '';
  if (!to) return { ok: false, message: 'Sem e-mail de destino.' };

  const rotated = await rotateRequestToken(supabase, requestId);
  if (!rotated.ok) return { ok: false, message: rotated.message };

  // Reuse the public resolver to get firm/company/title for the template.
  const view = await getRequestByToken(supabase, rotated.token);
  if (!view) return { ok: false, message: 'Não foi possível montar o e-mail.' };

  const link = `${await baseUrl()}/s/${rotated.token}`;
  const email = buildRequestEmail({
    firmName: view.firmName,
    companyName: view.companyName,
    title: view.title,
    description: view.description,
    link,
    kind: view.kind,
  });

  const sent = await createMessagingAdapter().sendEmail({ to, ...email });
  if (!sent.ok) {
    return {
      ok: false,
      message: 'O e-mail falhou — a solicitação continua como não enviada. Tente de novo.',
    };
  }

  const marked = await markRequestSent(supabase, requestId, to);
  revalidatePath('/solicitacoes');
  if (!marked.ok) {
    console.error(`request ${requestId}: e-mail accepted by provider but mark_request_sent failed`);
    return {
      ok: false,
      message: 'E-mail enviado, mas o status não foi atualizado. Recarregue e confira o histórico.',
    };
  }
  return { ok: true };
}

export async function copyLinkAction(requestId: string): Promise<CopyResult> {
  const supabase = await createClient();
  const rotated = await rotateRequestToken(supabase, requestId, { recordCopy: true });
  if (!rotated.ok) return { ok: false, message: rotated.message };
  revalidatePath('/solicitacoes');
  return { ok: true, token: rotated.token };
}

export async function cancelRequestAction(requestId: string): Promise<void> {
  const supabase = await createClient();
  await cancelDocumentRequest(supabase, requestId);
  revalidatePath('/solicitacoes');
}

export async function loadRequestEventsAction(requestId: string): Promise<RequestEvent[]> {
  const supabase = await createClient();
  return listRequestEvents(supabase, requestId);
}

// ---- T31: contact picker + create from the global page --------------------

export interface SendContext {
  contacts: { name: string; email: string }[];
  suggestedEmail: string | null;
}

/** The company's e-mail contacts + the department-routed suggestion, so the
 *  send drawer offers a picker instead of a blind free-text field. */
export async function loadSendContextAction(
  requestId: string,
  companyId: string,
): Promise<SendContext> {
  const supabase = await createClient();
  const [contacts, suggestedEmail] = await Promise.all([
    listContacts(supabase, companyId),
    getSuggestedRecipientEmail(supabase, requestId, companyId),
  ]);
  return {
    contacts: contacts
      .filter((c) => Boolean(c.email))
      .map((c) => ({ name: c.name, email: c.email as string })),
    suggestedEmail,
  };
}

/** The company's documents, for the "disponibilizar documento" select when
 *  creating from the global page (company picked at runtime). */
export async function loadCompanyDocsAction(
  companyId: string,
): Promise<{ id: string; fileName: string }[]> {
  const supabase = await createClient();
  const docs = await listDocuments(supabase, { companyId });
  return docs.map((d) => ({ id: d.id, fileName: d.fileName }));
}

export type CreateResult = { ok: true; token: string } | { ok: false; message: string };

export async function createRequestGlobalAction(
  _prev: CreateResult | null,
  formData: FormData,
): Promise<CreateResult> {
  const supabase = await createClient();
  const field = (key: string) => {
    const v = formData.get(key);
    return typeof v === 'string' ? v.trim() : '';
  };

  const companyId = field('companyId');
  if (!companyId) return { ok: false, message: 'Escolha a empresa.' };
  const kind = field('kind');
  if (!isRequestKind(kind)) return { ok: false, message: 'Tipo inválido.' };

  // expiryDays omitted → createDocumentRequest falls back to the firm config default.
  const expiry = Number(field('expiryDays'));
  const result = await createDocumentRequest(supabase, {
    companyId,
    kind,
    title: field('title'),
    description: field('description') || undefined,
    documentId: field('documentId') || null,
    requestedDocType: field('requestedDocType') || null,
    ...(Number.isFinite(expiry) && expiry > 0 ? { expiryDays: expiry } : {}),
  });
  if (!result.ok) return { ok: false, message: result.message };

  revalidatePath('/solicitacoes');
  return { ok: true, token: result.token };
}
