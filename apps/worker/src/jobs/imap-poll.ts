import type { ImapInboundAdapter } from '@hub/adapters';
import { parseFirmConfig } from '@hub/config';
import { decideInboundRouting, normalizeInboundEmail } from '@hub/core';
import type { SupabaseClient } from '@supabase/supabase-js';
import type { Sql } from 'postgres';

import {
  ingestInboundDocument,
  ingestInboundQuestion,
  recordInboundException,
} from './inbound.js';

// IMAP poll (entrada por e-mail). Pull, not webhook: fetch unseen messages, record
// each idempotently in inbound_messages (unique uid), then route inline — an
// attachment → AI triage, a text-only e-mail → support ticket, nothing → exception
// (golden rule #6). After a message routes we mark it \Seen so the next poll skips
// it; inbound_messages is the durable idempotency guard if a poll is interrupted.
// Single-tenant: one configured mailbox belongs to the single firm.

export interface ImapPollResult {
  scanned: number;
  routed: number;
  skipped: number;
}

export async function runImapPoll(
  sql: Sql,
  storage: SupabaseClient,
  adapter: ImapInboundAdapter,
): Promise<ImapPollResult> {
  const result: ImapPollResult = { scanned: 0, routed: 0, skipped: 0 };

  const [firm] = await sql<{ id: string; config: unknown }[]>`
    select id, config from public.firms order by created_at asc limit 1
  `;
  if (!firm) return result;
  const config = parseFirmConfig(firm.config);
  const folder = config.inbound.imapFolder;

  const emails = await adapter.fetchUnseen({ folder, limit: 25 });
  result.scanned = emails.length;
  const processedUids: number[] = [];

  for (const email of emails) {
    const sender = normalizeInboundEmail(email.from);
    const externalId = String(email.uid);
    const route = decideInboundRouting({
      hasAttachment: email.attachments.length > 0,
      text: email.text,
    });

    // Idempotent capture — a re-poll of the same uid is a no-op.
    const [recorded] = await sql<{ id: string }[]>`
      insert into public.inbound_messages
        (firm_id, channel, external_id, sender, kind, subject, raw, status)
      values (${firm.id}, 'imap', ${externalId}, ${sender}, ${route.kind}, ${email.subject},
              ${sql.json({ subject: email.subject, attachments: email.attachments.length })}, 'received')
      on conflict (firm_id, channel, external_id) do nothing
      returning id
    `;
    if (!recorded) {
      result.skipped += 1;
      processedUids.push(email.uid);
      continue;
    }

    try {
      if (route.kind === 'document') {
        for (const att of email.attachments) {
          await ingestInboundDocument(sql, storage, {
            firmId: firm.id,
            fileName: att.fileName,
            bytes: att.bytes,
            contentType: att.mimeType,
            channel: 'imap',
          });
        }
      } else if (route.kind === 'question') {
        await ingestInboundQuestion(sql, {
          firmId: firm.id,
          channel: 'imap',
          sender,
          contactName: null,
          subject: email.subject,
          text: email.text,
        });
      } else {
        await recordInboundException(sql, {
          firmId: firm.id,
          channel: 'imap',
          sender,
          externalId,
        });
      }
      await sql`
        update public.inbound_messages set status = 'routed'
        where id = ${recorded.id} and firm_id = ${firm.id}
      `;
      result.routed += 1;
      processedUids.push(email.uid);
    } catch (error) {
      // Leave it unseen + status 'received' so the next poll retries (idempotent).
      console.error(`[imap] failed to route uid ${email.uid}:`, error);
    }
  }

  if (processedUids.length > 0) {
    await adapter.markSeen({ folder, uids: processedUids });
  }
  return result;
}
