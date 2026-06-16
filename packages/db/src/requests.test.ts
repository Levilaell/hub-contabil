import { type SupabaseClient, createClient } from '@supabase/supabase-js';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { buildStoragePath } from './documents';
import type { Database } from './database.types';
import {
  cancelDocumentRequest,
  createDocumentRequest,
  getRequestByToken,
  getRequestOwner,
  listDocumentRequests,
  logRequestView,
  recordRequestDownload,
  recordRequestUpload,
} from './requests';

// Integration test for document requests against Supabase Cloud dev. Proves the
// token-keyed public RPCs (resolve / view+event / upload as source=request /
// offer download), lazy expiry, and cross-firm RLS. The "public" client is anon
// (no session) — it must reach exactly the RPCs and nothing else. Skipped without env.

const URL = process.env.SUPABASE_URL;
const ANON = process.env.SUPABASE_ANON_KEY;
const SERVICE = process.env.SUPABASE_SERVICE_ROLE_KEY;
const PASSWORD = process.env.SEED_PASSWORD ?? 'hub-dev-2026!';
const hasEnv = Boolean(URL && ANON && SERVICE);

const FIRM_A = '11111111-1111-4111-8111-111111111111';
const FIRM_B = '99999999-9999-4999-8999-999999999995';
const CNPJ = '77000000000016';

describe.skipIf(!hasEnv)('document requests (cloud dev)', () => {
  let service: SupabaseClient<Database>;
  let owner: SupabaseClient<Database>;
  let anon: SupabaseClient<Database>;
  let companyId = '';

  beforeAll(async () => {
    if (!URL || !ANON || !SERVICE) throw new Error('missing env');
    service = createClient<Database>(URL, SERVICE, { auth: { persistSession: false } });
    const { data: company, error } = await service
      .from('companies')
      .upsert(
        { firm_id: FIRM_A, cnpj: CNPJ, legal_name: 'Requests Co' },
        { onConflict: 'firm_id,cnpj' },
      )
      .select('id')
      .single();
    if (error) throw error;
    companyId = company.id;

    owner = createClient<Database>(URL, ANON, { auth: { persistSession: false } });
    const { error: e } = await owner.auth.signInWithPassword({
      email: 'owner@mrocha.test',
      password: PASSWORD,
    });
    if (e) throw e;

    anon = createClient<Database>(URL, ANON, { auth: { persistSession: false } });
  });

  afterAll(async () => {
    if (service && companyId) {
      const objPath = buildStoragePath(FIRM_A, companyId, null, null, 'd'.repeat(64), 'real.txt');
      await service.storage.from('documents').remove([objPath]);
      await service.from('document_request_events').delete().eq('firm_id', FIRM_A);
      await service.from('document_requests').delete().eq('company_id', companyId);
      await service.from('documents').delete().eq('company_id', companyId);
      await service
        .from('audit_events')
        .delete()
        .in('action', ['request.created', 'request.cancelled']);
      await service
        .from('audit_events')
        .delete()
        .eq('action', 'document.created')
        .eq('context->>source', 'request');
      await service.from('companies').delete().eq('id', companyId);
    }
    if (owner) await owner.auth.signOut();
  });

  it('resolves a valid token for the anon public client, and nothing for a bad one', async () => {
    const created = await createDocumentRequest(owner, {
      companyId,
      kind: 'upload_request',
      title: 'Envie o contrato social',
      expiryDays: 7,
    });
    expect(created.ok).toBe(true);
    if (!created.ok) return;

    const view = await getRequestByToken(anon, created.token);
    expect(view).not.toBeNull();
    expect(view?.kind).toBe('upload_request');
    expect(view?.title).toBe('Envie o contrato social');
    expect(view?.isExpired).toBe(false);

    expect(await getRequestByToken(anon, 'definitely-not-a-real-token')).toBeNull();
  });

  it('logs the first view as a transition + event, and is idempotent', async () => {
    const created = await createDocumentRequest(owner, {
      companyId,
      kind: 'upload_request',
      title: 'Documento de teste',
      expiryDays: 7,
    });
    if (!created.ok) return;

    await logRequestView(anon, created.token, '203.0.113.7', 'vitest-agent');
    await logRequestView(anon, created.token, '203.0.113.7', 'vitest-agent'); // re-open: no-op

    const { data: req } = await service
      .from('document_requests')
      .select('status')
      .eq('id', created.id)
      .single();
    expect(req?.status).toBe('viewed');

    const { count } = await service
      .from('document_request_events')
      .select('id', { count: 'exact', head: true })
      .eq('request_id', created.id)
      .eq('event_type', 'viewed');
    expect(count).toBe(1);
  });

  it('files an upload as a document with source=request and marks the request received', async () => {
    const created = await createDocumentRequest(owner, {
      companyId,
      kind: 'upload_request',
      title: 'Suba o balanço',
      expiryDays: 7,
    });
    if (!created.ok) return;

    const hash = 'a'.repeat(64);
    const path = buildStoragePath(FIRM_A, companyId, null, null, hash, 'balanco.pdf');
    const result = await recordRequestUpload(anon, {
      token: created.token,
      storagePath: path,
      hash,
      fileName: 'balanco.pdf',
      size: 1234,
    });
    expect(result.ok).toBe(true);

    const { data: doc } = await service
      .from('documents')
      .select('source, file_name')
      .eq('company_id', companyId)
      .eq('hash', hash)
      .single();
    expect(doc?.source).toBe('request');

    const { data: req } = await service
      .from('document_requests')
      .select('status')
      .eq('id', created.id)
      .single();
    expect(req?.status).toBe('received');

    // Golden rule #7: the public upload is audited like any document.created.
    const { count: audited } = await service
      .from('audit_events')
      .select('id', { count: 'exact', head: true })
      .eq('action', 'document.created')
      .eq('context->>source', 'request')
      .eq('context->>fileName', 'balanco.pdf');
    expect(audited).toBeGreaterThan(0);
  });

  it('round-trips a real file: service mints a signed URL, anon uploads, RPC files it', async () => {
    const created = await createDocumentRequest(owner, {
      companyId,
      kind: 'upload_request',
      title: 'Arquivo real',
      expiryDays: 7,
    });
    if (!created.ok) return;

    // The owner lookup the upload action depends on must work for the anon client.
    const ownerView = await getRequestOwner(anon, created.token);
    expect(ownerView?.kind).toBe('upload_request');

    const hash = 'd'.repeat(64);
    const path = buildStoragePath(FIRM_A, companyId, null, null, hash, 'real.txt');
    // Service role mints the signed upload URL (path is server-decided).
    const { data: signed, error: signErr } = await service.storage
      .from('documents')
      .createSignedUploadUrl(path, { upsert: true });
    expect(signErr).toBeNull();
    // The anon (public) client uploads the bytes via the signed URL.
    const { error: upErr } = await anon.storage
      .from('documents')
      .uploadToSignedUrl(path, signed!.token, Buffer.from('hello world'));
    expect(upErr).toBeNull();

    const rec = await recordRequestUpload(anon, {
      token: created.token,
      storagePath: path,
      hash,
      fileName: 'real.txt',
      size: 11,
    });
    expect(rec.ok).toBe(true);

    // The object really landed in Storage.
    const { data: dl, error: dlErr } = await service.storage.from('documents').download(path);
    expect(dlErr).toBeNull();
    expect(dl).toBeTruthy();
  });

  it('lets an offer be downloaded: returns the path, logs it, moves to downloaded', async () => {
    const hash = 'b'.repeat(64);
    const path = buildStoragePath(FIRM_A, companyId, null, null, hash, 'modelo.pdf');
    const { data: doc } = await service
      .from('documents')
      .insert({
        firm_id: FIRM_A,
        company_id: companyId,
        doc_type: 'other',
        storage_path: path,
        source: 'upload',
        hash,
        file_name: 'modelo.pdf',
      })
      .select('id')
      .single();

    const created = await createDocumentRequest(owner, {
      companyId,
      kind: 'document_offer',
      title: 'Baixe o modelo',
      documentId: doc!.id,
      expiryDays: 7,
    });
    if (!created.ok) return;

    const returnedPath = await recordRequestDownload(anon, created.token, '203.0.113.8', 'vitest');
    expect(returnedPath).toBe(path);

    const { data: req } = await service
      .from('document_requests')
      .select('status')
      .eq('id', created.id)
      .single();
    expect(req?.status).toBe('downloaded');
  });

  it('treats an expired token as expired and refuses the upload', async () => {
    const created = await createDocumentRequest(owner, {
      companyId,
      kind: 'upload_request',
      title: 'Link velho',
      expiryDays: 7,
    });
    if (!created.ok) return;

    await service
      .from('document_requests')
      .update({ expires_at: new Date(Date.now() - 86_400_000).toISOString() })
      .eq('id', created.id);

    const view = await getRequestByToken(anon, created.token);
    expect(view?.isExpired).toBe(true);

    const hash = 'c'.repeat(64);
    const path = buildStoragePath(FIRM_A, companyId, null, null, hash, 'tarde.pdf');
    const result = await recordRequestUpload(anon, {
      token: created.token,
      storagePath: path,
      hash,
      fileName: 'tarde.pdf',
      size: 1,
    });
    expect(result.ok).toBe(false);
  });

  it('cancels an open request (firm action)', async () => {
    const created = await createDocumentRequest(owner, {
      companyId,
      kind: 'upload_request',
      title: 'Para cancelar',
      expiryDays: 7,
    });
    if (!created.ok) return;

    const cancelled = await cancelDocumentRequest(owner, created.id);
    expect(cancelled.ok).toBe(true);

    const { data: req } = await service
      .from('document_requests')
      .select('status')
      .eq('id', created.id)
      .single();
    expect(req?.status).toBe('cancelled');
  });

  it('does not list a foreign firm request (RLS)', async () => {
    await service.from('firms').upsert({ id: FIRM_B, name: 'Foreign B' });
    const { data: foreignCo } = await service
      .from('companies')
      .upsert(
        { firm_id: FIRM_B, cnpj: '77000000000099', legal_name: 'Foreign Req' },
        { onConflict: 'firm_id,cnpj' },
      )
      .select('id')
      .single();
    const { data: foreignReq } = await service
      .from('document_requests')
      .insert({
        firm_id: FIRM_B,
        company_id: foreignCo!.id,
        kind: 'upload_request',
        title: 'Estrangeira',
        token_hash: 'deadbeef'.repeat(8),
        expires_at: new Date(Date.now() + 86_400_000).toISOString(),
      })
      .select('id')
      .single();

    const mine = await listDocumentRequests(owner);
    expect(mine.some((r) => r.id === foreignReq!.id)).toBe(false);

    await service.from('document_requests').delete().eq('id', foreignReq!.id);
    await service.from('firms').delete().eq('id', FIRM_B);
  });
});
