import { createHash } from 'node:crypto';

import type { WhatsappAdapter } from '@hub/adapters';
import { normalizeInboundPhone } from '@hub/core';
import type { SupabaseClient } from '@supabase/supabase-js';
import type { Sql } from 'postgres';

import type { InboundPayload } from '../queue/payloads.js';

// Inbound routing (entrada via WhatsApp/IMAP). A message that carried a document is
// stored and pushed into the SAME AI triage uploads use; a text question opens or
// reopens a support ticket and is handed to the support assistant; an empty message
// becomes a human-visible exception (golden rule #6). The decision of WHERE it goes
// is made by @hub/core (decideInboundRouting) at the edge; this module performs the
// side effects. Service role → every query carries firm_id (#1). These helpers are
// shared by the 'inbound' queue handler (WhatsApp, media fetched here) and the IMAP
// poll cron (bytes already in hand).

const BUCKET = 'documents';

type Json = (value: unknown) => ReturnType<Sql['json']>;
const makeJson =
  (sql: Sql): Json =>
  (value) =>
    sql.json(value as Parameters<typeof sql.json>[0]);

function safeFileName(name: string): string {
  const cleaned = name
    .trim()
    .replace(/[^a-zA-Z0-9._-]/g, '_')
    .slice(0, 120);
  return cleaned.length ? cleaned : 'arquivo';
}

/** Resolve which company a sender belongs to (phone/e-mail → contact → company). */
async function resolveSenderCompany(
  sql: Sql,
  firmId: string,
  channel: string,
  sender: string,
): Promise<string | null> {
  if (!sender) return null;
  if (channel === 'whatsapp') {
    const digits = normalizeInboundPhone(sender);
    const [row] = await sql<{ company_id: string }[]>`
      select company_id from public.contacts
      where firm_id = ${firmId}
        and company_id is not null
        and regexp_replace(coalesce(phone, ''), '\\D', '', 'g') = ${digits}
      limit 1
    `;
    return row?.company_id ?? null;
  }
  const [row] = await sql<{ company_id: string }[]>`
    select company_id from public.contacts
    where firm_id = ${firmId} and company_id is not null and lower(email) = ${sender.toLowerCase()}
    limit 1
  `;
  return row?.company_id ?? null;
}

/** Open or reopen the sender's ticket (shared by question + document paths).
 *  Mirrors core statusAfterInbound in SQL: an escalated ticket stays escalated;
 *  anything else resurfaces as 'open'. */
async function upsertTicket(
  sql: Sql,
  args: {
    firmId: string;
    channel: string;
    sender: string;
    contactName: string | null;
    subject: string;
    companyId: string | null;
  },
): Promise<string> {
  const [ticket] = await sql<{ id: string }[]>`
    insert into public.support_tickets
      (firm_id, company_id, channel, contact_identifier, contact_name, subject, status, last_message_at, last_inbound_at)
    values (${args.firmId}, ${args.companyId}, ${args.channel}, ${args.sender}, ${args.contactName},
            ${args.subject}, 'open', now(), now())
    on conflict (firm_id, channel, contact_identifier) do update set
      status = case when public.support_tickets.status = 'escalated' then 'escalated' else 'open' end,
      company_id = coalesce(public.support_tickets.company_id, excluded.company_id),
      contact_name = coalesce(excluded.contact_name, public.support_tickets.contact_name),
      last_message_at = now(),
      last_inbound_at = now()
    returning id
  `;
  if (!ticket) throw new Error('support ticket upsert returned no row');
  return ticket.id;
}

/** Store an inbound attachment and enqueue AI triage (company resolved by triage
 *  from the document's own CNPJ — same path as an inbox upload, T21). When the
 *  sender is known, the document is ALSO noted in their support conversation
 *  (Fase 1.1 §4 — before this, an attachment was invisible in /atendimento). */
export async function ingestInboundDocument(
  sql: Sql,
  storage: SupabaseClient,
  args: {
    firmId: string;
    fileName: string;
    bytes: Buffer;
    contentType: string;
    channel: string;
    sender?: string;
    contactName?: string | null;
    caption?: string | null;
  },
): Promise<void> {
  const json = makeJson(sql);
  const hash = createHash('sha256').update(args.bytes).digest('hex');
  const fileName = safeFileName(args.fileName);
  const storagePath = `firm/${args.firmId}/inbox/${hash.slice(0, 12)}-${fileName}`;

  const { error: upErr } = await storage.storage
    .from(BUCKET)
    .upload(storagePath, args.bytes, { contentType: args.contentType, upsert: true });
  if (upErr) throw new Error(`inbound upload failed: ${upErr.message}`);

  const [doc] = await sql<{ id: string }[]>`
    insert into public.documents
      (firm_id, company_id, doc_type, storage_path, source, hash, file_name, size_bytes)
    values (${args.firmId}, null, 'other', ${storagePath}, 'inbound', ${hash}, ${fileName}, ${args.bytes.length})
    returning id
  `;
  if (!doc) throw new Error('inbound document insert returned no row');

  await sql`
    insert into public.audit_events (firm_id, action, entity, entity_id, context)
    values (${args.firmId}, 'document.created', 'document', ${doc.id},
            ${json({ source: 'inbound', channel: args.channel, fileName })})
  `;
  await sql`select pgmq.send('triage', ${json({ firm_id: args.firmId, document_id: doc.id })}::jsonb)`;

  // Note the document in the sender's conversation so it is visible in
  // /atendimento. Record only — the support assistant is NOT enqueued (there is
  // no question to answer; triage handles the file).
  if (args.sender) {
    const companyId = await resolveSenderCompany(sql, args.firmId, args.channel, args.sender);
    const caption = (args.caption ?? '').trim();
    const body = caption
      ? `📎 Documento recebido: ${fileName}\n${caption}`
      : `📎 Documento recebido: ${fileName} — enviado para a triagem automática.`;
    const ticketId = await upsertTicket(sql, {
      firmId: args.firmId,
      channel: args.channel,
      sender: args.sender,
      contactName: args.contactName ?? null,
      subject: `Documento: ${fileName}`.slice(0, 200),
      companyId,
    });
    const [msg] = await sql<{ id: string }[]>`
      insert into public.support_messages
        (firm_id, ticket_id, direction, author, body, delivery, delivered_at)
      values (${args.firmId}, ${ticketId}, 'inbound', 'client', ${body}, 'delivered', now())
      returning id
    `;
    await sql`
      insert into public.audit_events (firm_id, action, entity, entity_id, context)
      values (${args.firmId}, 'support.received', 'support_ticket', ${ticketId},
              ${json({ channel: args.channel, messageId: msg?.id ?? null, documentId: doc.id, kind: 'document' })})
    `;
  }
}

/** Open or reopen a support ticket for the sender, record the inbound message, and
 *  enqueue the support assistant. Mirrors core statusAfterInbound in SQL: an
 *  escalated ticket stays escalated; anything else resurfaces as 'open'. */
export async function ingestInboundQuestion(
  sql: Sql,
  args: {
    firmId: string;
    channel: string;
    sender: string;
    contactName: string | null;
    subject: string | null;
    text: string;
  },
): Promise<void> {
  const json = makeJson(sql);
  const companyId = await resolveSenderCompany(sql, args.firmId, args.channel, args.sender);
  const subject = (args.subject ?? '').slice(0, 200) || args.text.slice(0, 80);

  const ticketId = await upsertTicket(sql, {
    firmId: args.firmId,
    channel: args.channel,
    sender: args.sender,
    contactName: args.contactName,
    subject,
    companyId,
  });

  const [msg] = await sql<{ id: string }[]>`
    insert into public.support_messages
      (firm_id, ticket_id, direction, author, body, delivery, delivered_at)
    values (${args.firmId}, ${ticketId}, 'inbound', 'client', ${args.text}, 'delivered', now())
    returning id
  `;
  if (!msg) throw new Error('support message insert returned no row');

  await sql`
    insert into public.audit_events (firm_id, action, entity, entity_id, context)
    values (${args.firmId}, 'support.received', 'support_ticket', ${ticketId},
            ${json({ channel: args.channel, messageId: msg.id })})
  `;
  await sql`select pgmq.send('support', ${json({
    firm_id: args.firmId,
    ticket_id: ticketId,
    message_id: msg.id,
    kind: 'inbound',
  })}::jsonb)`;
}

/** An undecidable inbound (no attachment, no text) — never dropped (golden rule #6). */
export async function recordInboundException(
  sql: Sql,
  args: { firmId: string; channel: string; sender: string; externalId: string },
): Promise<void> {
  const json = makeJson(sql);
  await sql`
    insert into public.exception_queue (firm_id, source, context, suggestion)
    values (${args.firmId}, 'inbound',
            ${json({
              reason: 'inbound_unknown',
              channel: args.channel,
              sender: args.sender,
              externalId: args.externalId,
            })}, '{}'::jsonb)
  `;
}

interface InboundRow {
  id: string;
  channel: string;
  external_id: string;
  sender: string;
  subject: string | null;
  kind: string;
  status: string;
  contact_name: string | null;
  raw: Record<string, unknown>;
}

function asObject(value: unknown): Record<string, unknown> {
  if (typeof value === 'string') {
    try {
      return JSON.parse(value) as Record<string, unknown>;
    } catch {
      return {};
    }
  }
  return value && typeof value === 'object' ? (value as Record<string, unknown>) : {};
}

function str(value: unknown): string | null {
  return typeof value === 'string' && value.length > 0 ? value : null;
}

/**
 * 'inbound' queue handler — WhatsApp only (IMAP routes inline in its cron). Loads
 * the recorded message, fetches media when it's a document, and routes it. The
 * inbound_messages.status guard makes a retry idempotent.
 */
export function createInboundHandler(sql: Sql, storage: SupabaseClient, whatsapp: WhatsappAdapter) {
  return async function handle(payload: InboundPayload): Promise<void> {
    const { firm_id, inbound_id } = payload;
    const [row] = await sql<InboundRow[]>`
      select id, channel, external_id, sender, subject, kind, status, raw
      from public.inbound_messages
      where id = ${inbound_id} and firm_id = ${firm_id}
    `;
    if (!row) {
      console.warn(`[inbound] message ${inbound_id} not found in firm ${firm_id}; skipping`);
      return;
    }
    if (row.status !== 'received') {
      // Already routed by a previous attempt — don't double-process.
      return;
    }

    const raw = asObject(row.raw);

    if (row.channel === 'whatsapp' && row.kind === 'document') {
      const mediaId = str(raw.mediaId);
      if (!mediaId) throw new Error(`inbound ${inbound_id}: document without mediaId`);
      const media = await whatsapp.downloadMedia(mediaId);
      await ingestInboundDocument(sql, storage, {
        firmId: firm_id,
        fileName: str(raw.fileName) ?? media.fileName,
        bytes: media.bytes,
        contentType: media.mimeType,
        channel: row.channel,
        sender: row.sender,
        contactName: str(raw.contactName),
        caption: str(raw.text),
      });
    } else if (row.kind === 'question') {
      await ingestInboundQuestion(sql, {
        firmId: firm_id,
        channel: row.channel,
        sender: row.sender,
        contactName: str(raw.contactName),
        subject: row.subject,
        text: str(raw.text) ?? '',
      });
    } else {
      await recordInboundException(sql, {
        firmId: firm_id,
        channel: row.channel,
        sender: row.sender,
        externalId: row.external_id,
      });
    }

    await sql`
      update public.inbound_messages set status = 'routed'
      where id = ${inbound_id} and firm_id = ${firm_id}
    `;
    console.log(`[inbound] routed ${inbound_id} (${row.channel}/${row.kind})`);
  };
}
