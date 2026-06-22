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
import { z } from 'zod';

import { createAdminClient } from '@/lib/supabase/admin';
import { createClient } from '@/lib/supabase/server';
import { rateLimit } from '@/lib/rate-limit';

// Server actions for the public request page. The visitor has no firm session;
// every decision is keyed on the token via SECURITY DEFINER RPCs. The service role
// appears ONLY here and ONLY to mint signed Storage URLs — the Storage path is always
// derived server-side from the token-resolved owner, never from client input.
// Hardened (T24): every input is Zod-validated and every action is rate-limited per IP
// (the only unauthenticated surface in the product).

type PrepareResult =
  | { ok: true; path: string; uploadToken: string }
  | { ok: false; message: string };
type FinalizeResult = { ok: boolean; message?: string };
type DownloadResult = { ok: true; url: string } | { ok: false; message: string };

const RATE_MSG = 'Muitas tentativas. Aguarde um instante e tente de novo.';
const MAX_UPLOAD_BYTES = 52_428_800; // 50 MiB — mirrors the documents bucket limit.

// A request access token is a base64url string (32 random bytes → ~43 chars).
const tokenSchema = z.string().trim().min(20).max(200);
const hashSchema = z.string().regex(/^[a-f0-9]{64}$/i); // sha256 hex
const fileNameSchema = z.string().trim().min(1).max(255);
const sizeSchema = z.number().int().positive().max(MAX_UPLOAD_BYTES);

async function clientMeta(): Promise<{ ip: string | null; ua: string | null }> {
  const h = await headers();
  const ip = (h.get('x-forwarded-for')?.split(',')[0] ?? h.get('x-real-ip') ?? '').trim() || null;
  return { ip, ua: h.get('user-agent') };
}

function allow(ip: string | null, action: string, limit: number): boolean {
  return rateLimit(`${ip ?? 'unknown'}:${action}`, limit, 60_000);
}

/** Record that a real browser opened the link. Triggered from a client effect (not
 *  server render) so link-preview/unfurl bots that GET the page don't mark it
 *  "viewed" before the client actually sees it. Idempotent; best-effort. */
export async function logViewAction(token: string): Promise<void> {
  const parsed = tokenSchema.safeParse(token);
  if (!parsed.success) return;
  const { ip, ua } = await clientMeta();
  if (!allow(ip, 'view', 60)) return; // silent — it's best-effort telemetry
  const supabase = await createClient();
  await logRequestView(supabase, parsed.data, ip, ua);
}

/** Mint a signed upload URL for the token-derived path (browser uploads direct). */
export async function prepareUploadAction(
  token: string,
  hash: string,
  fileName: string,
): Promise<PrepareResult> {
  const input = z
    .object({ token: tokenSchema, hash: hashSchema, fileName: fileNameSchema })
    .safeParse({ token, hash, fileName });
  if (!input.success) return { ok: false, message: 'Dados do envio inválidos.' };

  const { ip } = await clientMeta();
  if (!allow(ip, 'upload', 20)) return { ok: false, message: RATE_MSG };

  const supabase = await createClient();
  const owner = await getRequestOwner(supabase, input.data.token);
  if (!owner || owner.isExpired || owner.kind !== 'upload_request') {
    return { ok: false, message: 'Link inválido ou expirado.' };
  }
  const path = buildStoragePath(
    owner.firmId,
    owner.companyId,
    null,
    null,
    input.data.hash,
    input.data.fileName,
  );
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
  const input = z
    .object({ token: tokenSchema, hash: hashSchema, fileName: fileNameSchema, size: sizeSchema })
    .safeParse({ token, hash, fileName, size });
  if (!input.success) return { ok: false, message: 'Dados do envio inválidos.' };

  const { ip, ua } = await clientMeta();
  if (!allow(ip, 'upload', 20)) return { ok: false, message: RATE_MSG };

  const supabase = await createClient();
  const owner = await getRequestOwner(supabase, input.data.token);
  if (!owner || owner.isExpired || owner.kind !== 'upload_request') {
    return { ok: false, message: 'Link inválido ou expirado.' };
  }
  const path = buildStoragePath(
    owner.firmId,
    owner.companyId,
    null,
    null,
    input.data.hash,
    input.data.fileName,
  );
  const result = await recordRequestUpload(supabase, {
    token: input.data.token,
    storagePath: path,
    hash: input.data.hash,
    fileName: input.data.fileName,
    size: input.data.size,
    ip,
    userAgent: ua,
  });
  return result.ok ? { ok: true } : { ok: false, message: result.message };
}

/** Log the download and return a short-lived signed URL for the offered document. */
export async function downloadAction(token: string): Promise<DownloadResult> {
  const parsed = tokenSchema.safeParse(token);
  if (!parsed.success) return { ok: false, message: 'Link inválido.' };

  const { ip, ua } = await clientMeta();
  if (!allow(ip, 'download', 30)) return { ok: false, message: RATE_MSG };

  const supabase = await createClient();
  const path = await recordRequestDownload(supabase, parsed.data, ip, ua);
  if (!path) return { ok: false, message: 'Não foi possível baixar. O link pode ter expirado.' };
  const admin = createAdminClient();
  const { data, error } = await admin.storage
    .from(DOCUMENTS_BUCKET)
    .createSignedUrl(path, 300, { download: true });
  if (error || !data) return { ok: false, message: 'Não foi possível gerar o link de download.' };
  return { ok: true, url: data.signedUrl };
}
