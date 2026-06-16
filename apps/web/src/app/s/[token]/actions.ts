'use server';

import {
  DOCUMENTS_BUCKET,
  buildStoragePath,
  getRequestOwner,
  logRequestView,
  recordRequestDownload,
  recordRequestUpload,
} from '@hub/db';
import { headers } from 'next/headers';

import { createAdminClient } from '@/lib/supabase/admin';
import { createClient } from '@/lib/supabase/server';

// Server actions for the public request page. The visitor has no firm session;
// every decision is keyed on the token via SECURITY DEFINER RPCs. The service
// role appears ONLY here and ONLY to mint signed Storage URLs — the Storage
// path is always derived server-side from the token-resolved owner, never from
// client input.

type PrepareResult =
  | { ok: true; path: string; uploadToken: string }
  | { ok: false; message: string };
type FinalizeResult = { ok: boolean; message?: string };
type DownloadResult = { ok: true; url: string } | { ok: false; message: string };

async function clientMeta(): Promise<{ ip: string | null; ua: string | null }> {
  const h = await headers();
  const ip = (h.get('x-forwarded-for')?.split(',')[0] ?? h.get('x-real-ip') ?? '').trim() || null;
  return { ip, ua: h.get('user-agent') };
}

/** Record that a real browser opened the link. Triggered from a client effect (not
 *  server render) so link-preview/unfurl bots that GET the page don't mark it
 *  "viewed" before the client actually sees it. Idempotent; best-effort. */
export async function logViewAction(token: string): Promise<void> {
  const supabase = await createClient();
  const { ip, ua } = await clientMeta();
  await logRequestView(supabase, token, ip, ua);
}

/** Mint a signed upload URL for the token-derived path (browser uploads direct). */
export async function prepareUploadAction(
  token: string,
  hash: string,
  fileName: string,
): Promise<PrepareResult> {
  const supabase = await createClient();
  const owner = await getRequestOwner(supabase, token);
  if (!owner || owner.isExpired || owner.kind !== 'upload_request') {
    return { ok: false, message: 'Link inválido ou expirado.' };
  }
  const path = buildStoragePath(owner.firmId, owner.companyId, null, null, hash, fileName);
  const admin = createAdminClient();
  const { data, error } = await admin.storage
    .from(DOCUMENTS_BUCKET)
    .createSignedUploadUrl(path, { upsert: true });
  if (error || !data) return { ok: false, message: 'Não foi possível preparar o envio.' };
  return { ok: true, path: data.path, uploadToken: data.token };
}

/** After the bytes are in Storage, file the document + advance the request. The
 *  path is re-derived server-side (not trusted from the browser). */
export async function finalizeUploadAction(
  token: string,
  hash: string,
  fileName: string,
  size: number,
): Promise<FinalizeResult> {
  const supabase = await createClient();
  const owner = await getRequestOwner(supabase, token);
  if (!owner || owner.isExpired || owner.kind !== 'upload_request') {
    return { ok: false, message: 'Link inválido ou expirado.' };
  }
  const path = buildStoragePath(owner.firmId, owner.companyId, null, null, hash, fileName);
  const { ip, ua } = await clientMeta();
  const result = await recordRequestUpload(supabase, {
    token,
    storagePath: path,
    hash,
    fileName,
    size,
    ip,
    userAgent: ua,
  });
  return result.ok ? { ok: true } : { ok: false, message: result.message };
}

/** Log the download and return a short-lived signed URL for the offered document. */
export async function downloadAction(token: string): Promise<DownloadResult> {
  const supabase = await createClient();
  const { ip, ua } = await clientMeta();
  const path = await recordRequestDownload(supabase, token, ip, ua);
  if (!path) return { ok: false, message: 'Não foi possível baixar. O link pode ter expirado.' };
  const admin = createAdminClient();
  const { data, error } = await admin.storage
    .from(DOCUMENTS_BUCKET)
    .createSignedUrl(path, 300, { download: true });
  if (error || !data) return { ok: false, message: 'Não foi possível gerar o link de download.' };
  return { ok: true, url: data.signedUrl };
}
