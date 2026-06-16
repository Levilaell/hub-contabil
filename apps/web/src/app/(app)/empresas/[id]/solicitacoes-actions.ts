'use server';

import { cancelDocumentRequest, createDocumentRequest } from '@hub/db';
import { isRequestKind } from '@hub/core';
import { revalidatePath } from 'next/cache';

import { createClient } from '@/lib/supabase/server';

// Firm-side request actions. Create returns the raw token ONCE so the UI can show
// the link — only its hash is stored, so it can't be revealed again later.

export type CreateRequestState =
  | { ok: true; token: string }
  | { ok: false; message: string }
  | null;

function field(formData: FormData, key: string): string {
  const v = formData.get(key);
  return typeof v === 'string' ? v.trim() : '';
}

export async function createRequestAction(
  companyId: string,
  _prev: CreateRequestState,
  formData: FormData,
): Promise<CreateRequestState> {
  const kind = field(formData, 'kind');
  if (!isRequestKind(kind)) return { ok: false, message: 'Tipo de solicitação inválido.' };
  const title = field(formData, 'title');
  if (!title) return { ok: false, message: 'Informe um título para a solicitação.' };

  const expiryRaw = field(formData, 'expiryDays');
  const expiryDays = expiryRaw ? Number(expiryRaw) : undefined;

  const supabase = await createClient();
  const result = await createDocumentRequest(supabase, {
    companyId,
    kind,
    title,
    description: field(formData, 'description') || undefined,
    documentId: kind === 'document_offer' ? field(formData, 'documentId') || null : null,
    requestedDocType:
      kind === 'upload_request' ? field(formData, 'requestedDocType') || null : null,
    expiryDays,
  });
  if (!result.ok) return { ok: false, message: result.message };
  revalidatePath(`/empresas/${companyId}`);
  return { ok: true, token: result.token };
}

export async function cancelRequestAction(id: string, companyId: string): Promise<void> {
  const supabase = await createClient();
  await cancelDocumentRequest(supabase, id);
  revalidatePath(`/empresas/${companyId}`);
}
