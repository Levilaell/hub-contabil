import type { SupabaseClient } from '@supabase/supabase-js';
import postgres, { type Sql } from 'postgres';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import {
  createInboundHandler,
  ingestInboundQuestion,
  recordInboundException,
} from './inbound';

// Inbound routing consumer (entrada via WhatsApp/IMAP) against the linked Supabase
// Cloud dev project, with FAKE channel adapters (no external HTTP / no Storage). It
// exercises the seams between modules: a document is filed and pushed into the SAME
// AI triage queue uploads use; a text question opens a support ticket and enqueues
// the support assistant; an empty message falls to the exception queue (golden rule
// #6, nothing dropped). Runs in its OWN firm so it never touches the shared Demo
// fixture and a single `delete firms` cascades the cleanup. Skipped without DATABASE_URL.

const DATABASE_URL = process.env.DATABASE_URL;
const hasEnv = Boolean(DATABASE_URL);
const FIRM = '22222222-2222-4222-8222-222222222222';

// Fake WhatsApp adapter: only downloadMedia is reached by the document branch.
const fakeWhatsapp = {
  downloadMedia: () =>
    Promise.resolve({
      bytes: Buffer.from('%PDF-1.4 fake nota'),
      mimeType: 'application/pdf',
      fileName: 'nota.pdf',
    }),
  sendText: () => Promise.resolve({ ok: true as const }),
} as unknown as Parameters<typeof createInboundHandler>[2];

// Fake Storage: swallow the upload so the document insert + triage enqueue still run.
const fakeStorage = {
  storage: { from: () => ({ upload: () => Promise.resolve({ error: null }) }) },
} as unknown as SupabaseClient;

describe.skipIf(!hasEnv)('inbound routing consumer (cloud dev)', () => {
  let sql: Sql;

  /** Read messages for THIS firm off a queue, delete them, and return their payloads
   *  (both an assertion that the enqueue happened and the cleanup). */
  async function drainQueue(queue: string): Promise<Record<string, unknown>[]> {
    const rows = await sql<{ msg_id: number; message: unknown }[]>`
      select msg_id, message from pgmq.read(${queue}::text, 2, 100)
    `;
    const mine: Record<string, unknown>[] = [];
    for (const r of rows) {
      const m = (typeof r.message === 'string' ? JSON.parse(r.message) : r.message) as Record<
        string,
        unknown
      >;
      if (m?.firm_id === FIRM) {
        mine.push(m);
        await sql`select pgmq.delete(${queue}::text, ${r.msg_id}::bigint)`;
      }
    }
    return mine;
  }

  async function insertInbound(
    channel: string,
    kind: string,
    sender: string,
    raw: Record<string, unknown>,
    status = 'received',
    subject: string | null = null,
  ): Promise<string> {
    const externalId = `ext-${kind}-${sender}-${Math.abs(hashStr(JSON.stringify(raw)))}`;
    const [row] = await sql<{ id: string }[]>`
      insert into public.inbound_messages
        ${sql({ firm_id: FIRM, channel, external_id: externalId, sender, kind, status, subject, raw: sql.json(raw as Parameters<typeof sql.json>[0]) })}
      returning id
    `;
    if (!row) throw new Error('inbound insert returned no row');
    return row.id;
  }

  beforeAll(async () => {
    if (!DATABASE_URL) throw new Error('missing DATABASE_URL');
    sql = postgres(DATABASE_URL, { prepare: false });
    await sql`delete from public.firms where id = ${FIRM}`; // self-heal a prior interrupted run
    await sql`insert into public.firms ${sql({ id: FIRM, name: 'Inbound Test Firm', config: sql.json({}) })}`;
  });

  afterAll(async () => {
    if (sql) {
      await drainQueue('triage');
      await drainQueue('support');
      await sql`delete from public.firms where id = ${FIRM}`; // cascades docs/tickets/exceptions/audit
      await sql.end();
    }
  });

  it('files a document and pushes it into the SAME AI triage queue (inbound → triage)', async () => {
    const inboundId = await insertInbound('whatsapp', 'document', '5513999990000', {
      mediaId: 'MEDIA-1',
      fileName: 'nota.pdf',
    });
    await createInboundHandler(sql, fakeStorage, fakeWhatsapp)({
      firm_id: FIRM,
      inbound_id: inboundId,
    });

    const [doc] = await sql<{ id: string; source: string; company_id: string | null }[]>`
      select id, source, company_id from public.documents
      where firm_id = ${FIRM} and source = 'inbound'
    `;
    expect(doc?.source).toBe('inbound');
    expect(doc?.company_id).toBeNull(); // triage resolves the company from the doc's own CNPJ

    const [msg] = await sql<{ status: string }[]>`
      select status from public.inbound_messages where id = ${inboundId}
    `;
    expect(msg?.status).toBe('routed'); // guards against double-processing on retry
    // The triage enqueue is the adjacent fire-and-forget call; the durable document
    // row (source='inbound') is the worker-invariant proof the routing ran. We don't
    // assert on the shared 'triage' queue because a live worker may already have
    // drained it (that's its job) — see the runner test for the queue mechanism.
  });

  it('opens a support ticket for a text question and enqueues the assistant (inbound → support)', async () => {
    // A contact lets the sender resolve to a known company.
    const [company] = await sql<{ id: string }[]>`
      insert into public.companies
        ${sql({ firm_id: FIRM, cnpj: '11222333000181', legal_name: 'Cliente Vinculado LTDA' })}
      returning id
    `;
    await sql`
      insert into public.contacts
        ${sql({ firm_id: FIRM, company_id: company!.id, name: 'Contato', phone: '+55 (13) 99999-0000' })}
    `;

    const inboundId = await insertInbound(
      'whatsapp',
      'question',
      '5513999990000',
      { text: 'Bom dia, qual o status da minha empresa?', contactName: 'Cliente' },
      'received',
      null,
    );
    await createInboundHandler(sql, fakeStorage, fakeWhatsapp)({
      firm_id: FIRM,
      inbound_id: inboundId,
    });

    // Worker-invariant assertions only: a live worker may consume the 'support'
    // message and ADD an outbound reply / move the status, but it never removes the
    // ticket, the client's inbound message, the resolved company, or the audit — and
    // those four are exactly what proves ingestInboundQuestion routed correctly.
    const [ticket] = await sql<{ id: string; company_id: string | null }[]>`
      select id, company_id from public.support_tickets
      where firm_id = ${FIRM} and contact_identifier = '5513999990000'
    `;
    expect(ticket?.id).toBeTruthy();
    expect(ticket?.company_id).toBe(company!.id); // phone → contact → company

    const inMsgs = await sql<{ n: number }[]>`
      select count(*)::int as n from public.support_messages
      where firm_id = ${FIRM} and ticket_id = ${ticket!.id}
        and direction = 'inbound' and author = 'client'
    `;
    expect(inMsgs[0]?.n).toBe(1);

    const audit = await sql`
      select 1 from public.audit_events
      where firm_id = ${FIRM} and entity_id = ${ticket!.id} and action = 'support.received'
    `;
    expect(audit.length).toBe(1);
  });

  it('reopens a resolved ticket but keeps an escalated one escalated', async () => {
    // First message opens it.
    await ingestInboundQuestion(sql, {
      firmId: FIRM,
      channel: 'whatsapp',
      sender: '5599888887777',
      contactName: 'Outro',
      subject: null,
      text: 'Primeira pergunta',
    });
    await drainQueue('support');

    // A human escalates; a new client message must NOT yank it back to open.
    await sql`
      update public.support_tickets set status = 'escalated'
      where firm_id = ${FIRM} and contact_identifier = '5599888887777'
    `;
    await ingestInboundQuestion(sql, {
      firmId: FIRM,
      channel: 'whatsapp',
      sender: '5599888887777',
      contactName: 'Outro',
      subject: null,
      text: 'Segunda pergunta',
    });
    await drainQueue('support');

    const [ticket] = await sql<{ status: string }[]>`
      select status from public.support_tickets
      where firm_id = ${FIRM} and contact_identifier = '5599888887777'
    `;
    expect(ticket?.status).toBe('escalated');
  });

  it('routes an empty message to the exception queue — never dropped (golden rule #6)', async () => {
    const inboundId = await insertInbound('whatsapp', 'unknown', '5511000001111', {});
    await createInboundHandler(sql, fakeStorage, fakeWhatsapp)({
      firm_id: FIRM,
      inbound_id: inboundId,
    });

    const exceptions = await sql<{ source: string; context: Record<string, unknown> }[]>`
      select source, context from public.exception_queue where firm_id = ${FIRM} and source = 'inbound'
    `;
    expect(exceptions).toHaveLength(1);
    const ctx = (
      typeof exceptions[0]?.context === 'string'
        ? JSON.parse(exceptions[0].context as unknown as string)
        : exceptions[0]?.context
    ) as { reason?: string };
    expect(ctx.reason).toBe('inbound_unknown');

    const [msg] = await sql<{ status: string }[]>`
      select status from public.inbound_messages where id = ${inboundId}
    `;
    expect(msg?.status).toBe('routed');
  });

  it('does not re-process a message already routed (idempotent retry)', async () => {
    const inboundId = await insertInbound(
      'whatsapp',
      'question',
      '5512345678901',
      { text: 'já processada' },
      'routed', // pretend a previous attempt finished
    );
    await createInboundHandler(sql, fakeStorage, fakeWhatsapp)({
      firm_id: FIRM,
      inbound_id: inboundId,
    });

    const tickets = await sql`
      select 1 from public.support_tickets
      where firm_id = ${FIRM} and contact_identifier = '5512345678901'
    `;
    expect(tickets.length).toBe(0); // early-return on status!='received' → nothing created/enqueued
  });

  it('records an inbound exception directly (helper used by the IMAP path)', async () => {
    await recordInboundException(sql, {
      firmId: FIRM,
      channel: 'imap',
      sender: 'desconhecido@ex.test',
      externalId: 'imap-xyz',
    });
    const rows = await sql`
      select 1 from public.exception_queue
      where firm_id = ${FIRM} and source = 'inbound' and context->>'channel' = 'imap'
    `;
    expect(rows.length).toBe(1);
  });
});

/** Tiny stable hash for unique external ids in fixtures (no randomness). */
function hashStr(s: string): number {
  let h = 0;
  for (let i = 0; i < s.length; i += 1) h = (h * 31 + s.charCodeAt(i)) | 0;
  return h;
}
