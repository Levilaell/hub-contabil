'use server';

import { buildRequestEmail } from '@hub/core';
import {
  cancelDocumentRequest,
  getRequestByToken,
  getSuggestedRecipientEmail,
  listRequestEvents,
  rotateRequestToken,
  type RequestEvent,
} from '@hub/db';
import { createMessagingAdapter } from '@hub/adapters';
import { headers } from 'next/headers';
import { revalidatePath } from 'next/cache';

import { createClient } from '@/lib/supabase/server';

// Follow-up actions. Sending and copy-link both ROTATE the token (only the hash
// is stored, so a fresh link is regenerated and the previous one stops working).
// Rotation also marks the request sent (mirrors the core resend guard).

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
  if (!sent.ok) return { ok: false, message: 'Link gerado, mas o e-mail falhou. Copie o link.' };

  revalidatePath('/solicitacoes');
  return { ok: true };
}

export async function copyLinkAction(requestId: string): Promise<CopyResult> {
  const supabase = await createClient();
  const rotated = await rotateRequestToken(supabase, requestId);
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
