import type { MessagingAdapter } from '@hub/adapters';
import { parseFirmConfig } from '@hub/config';
import {
  buildRequestEmail,
  routeDepartment,
  suggestContactForDepartment,
  type RequestKind,
} from '@hub/core';
import { createHash, randomBytes } from 'node:crypto';
import type { Sql } from 'postgres';

// Request reminder sweep (T17, alerts cron). For each firm, finds requests still
// in 'sent' (link delivered, client hasn't opened) past the firm's reminder window
// and re-sends. Because only the token hash is stored, the working link can't be
// recovered — the reminder ROTATES the token (fresh link, old one void) and mails
// it. The request stays 'sent' (no state-machine transition); sent_at is bumped so
// the next reminder is another N days out (idempotent per window). A request with
// no resolvable contact e-mail goes to the exception queue, never silently skipped
// (golden rule #6). Runs as the service role across ALL firms; every query carries
// firm_id (golden rule #1). `now` is a parameter so the window is testable.

export interface ReminderResult {
  scanned: number;
  reminded: number;
  exceptions: number;
}

interface ReminderRow {
  id: string;
  company_id: string;
  kind: string;
  title: string;
  description: string;
  requested_doc_type: string | null;
  legal_name: string;
  trade_name: string | null;
  recipient: string | null;
}

interface ContactRow {
  email: string;
  is_primary: boolean;
  departments: string[] | null;
}

// Department-aware recipient (Fase 1.1 §1.3): the request's expected doc type
// routes to a department; the contact tagged for it beats a "Todos" contact.
// Falls back to the SQL primary-first pick when nothing routes.
async function resolveRecipient(
  sql: Sql,
  firmId: string,
  row: ReminderRow,
  routingMap: Record<string, string>,
): Promise<string | null> {
  const department = row.requested_doc_type
    ? routeDepartment(routingMap, row.requested_doc_type)
    : null;
  if (!department) return row.recipient;

  const contacts = await sql<ContactRow[]>`
    select email, is_primary, departments from public.contacts
    where firm_id = ${firmId} and company_id = ${row.company_id} and email is not null
  `;
  const pick = suggestContactForDepartment(
    contacts.map((c) => ({
      email: c.email,
      isPrimary: c.is_primary,
      departments: c.departments ?? [],
    })),
    department,
  );
  return pick?.email ?? row.recipient;
}

function newToken(): { token: string; hash: string } {
  const token = randomBytes(32).toString('base64url');
  return { token, hash: createHash('sha256').update(token).digest('hex') };
}

export async function runRequestReminderSweep(
  sql: Sql,
  now: Date,
  deps: { messaging: MessagingAdapter; baseUrl: string },
): Promise<ReminderResult> {
  const firms = await sql<{ id: string; name: string; config: unknown }[]>`
    select id, name, config from public.firms
  `;
  const result: ReminderResult = { scanned: 0, reminded: 0, exceptions: 0 };

  for (const firm of firms) {
    const config = parseFirmConfig(firm.config);
    const threshold = new Date(now.getTime() - config.requestReminderDays * 86_400_000);
    const expiresAt = new Date(now.getTime() + config.requestTokenExpiryDays * 86_400_000);

    const rows = await sql<ReminderRow[]>`
      select r.id, r.company_id, r.kind, r.title, r.description, r.requested_doc_type,
             c.legal_name, c.trade_name,
             (select ct.email from public.contacts ct
                where ct.company_id = r.company_id and ct.email is not null
                order by ct.is_primary desc limit 1) as recipient
      from public.document_requests r
      join public.companies c on c.id = r.company_id
      where r.firm_id = ${firm.id}
        and r.status = 'sent'
        and r.sent_at is not null
        and r.sent_at < ${threshold}
        and (r.last_reminded_at is null or r.last_reminded_at < ${threshold})
    `;
    result.scanned += rows.length;

    for (const row of rows) {
      const companyName = row.trade_name || row.legal_name;
      const recipient = await resolveRecipient(sql, firm.id, row, config.routingMap);

      // Stamp last_reminded_at in every branch so a given request is touched at most
      // once per window — reminder OR exception, never an hourly repeat.
      if (!recipient) {
        await sql`
          update public.document_requests set last_reminded_at = ${now}
          where id = ${row.id} and firm_id = ${firm.id}
        `;
        await sql`
          insert into public.exception_queue (firm_id, source, context, suggestion)
          values (${firm.id}, 'requests',
                  ${sql.json({ requestId: row.id, reason: 'no_contact_email', title: row.title, company: companyName })},
                  ${sql.json({ action: 'add_contact_email', companyId: row.company_id })})
        `;
        result.exceptions += 1;
        continue;
      }

      // Rotate (fresh working link); old hash discarded. last_reminded_at throttles
      // the next window; sent_at is kept (a web resend resets it). golden rule #1.
      const { token, hash } = newToken();
      await sql`
        update public.document_requests set
          token_hash = ${hash},
          expires_at = ${expiresAt},
          last_reminded_at = ${now}
        where id = ${row.id} and firm_id = ${firm.id}
      `;

      const email = buildRequestEmail({
        firmName: firm.name,
        companyName,
        title: row.title,
        description: row.description,
        link: `${deps.baseUrl}/s/${token}`,
        kind: row.kind as RequestKind,
        reminder: true,
      });
      const sent = await deps.messaging.sendEmail({ to: recipient, ...email });

      if (!sent.ok) {
        await sql`
          insert into public.exception_queue (firm_id, source, context, suggestion)
          values (${firm.id}, 'requests',
                  ${sql.json({ requestId: row.id, reason: 'reminder_email_failed', error: sent.error })},
                  ${sql.json({ action: 'retry_or_copy_link' })})
        `;
        result.exceptions += 1;
        continue;
      }

      await sql`
        insert into public.document_request_events (firm_id, request_id, event_type, context)
        values (${firm.id}, ${row.id}, 'reminded', ${sql.json({ to: recipient })})
      `;
      await sql`
        insert into public.audit_events (firm_id, action, entity, entity_id, context)
        values (${firm.id}, 'request.reminded', 'document_request', ${row.id}, ${sql.json({ to: recipient })})
      `;
      result.reminded += 1;
    }
  }

  return result;
}
