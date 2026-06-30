import type { SupportAssistantAdapter, WhatsappAdapter } from '@hub/adapters';
import { parseFirmConfig } from '@hub/config';
import { decideSupportResponse, isWithin24hWindow } from '@hub/core';
import type { Sql } from 'postgres';

import type { SupportPayload } from '../queue/payloads.js';

// Support job (atendimento). Two kinds of work:
//  - 'inbound': a new client message → draft an answer with the firm's own context,
//    then let core decide (decideSupportResponse) whether to send it or escalate to
//    a human. The AI never decides alone (#5): auto-reply off, out of scope, or low
//    confidence all escalate. On escalation we send a short pt-BR acknowledgement IF
//    we're still inside WhatsApp's free 24h window (no paid template).
//  - 'deliver': push a queued outbound message (a human's reply from /atendimento)
//    over the channel and flip its delivery status.
// Service role → every query carries firm_id (#1).

type Json = (value: unknown) => ReturnType<Sql['json']>;

interface TicketRow {
  id: string;
  company_id: string | null;
  channel: string;
  contact_identifier: string;
  status: string;
  last_inbound_at: string | null;
}

/** A compact pt-BR snapshot the assistant may use — only facts the hub owns. */
async function buildCompanyContext(
  sql: Sql,
  firmId: string,
  companyId: string | null,
): Promise<string> {
  if (!companyId) {
    return 'Este contato ainda não está vinculado a uma empresa cadastrada. Não afirme dados específicos.';
  }
  const [company] = await sql<{ legal_name: string; tax_regime: string | null; status: string }[]>`
    select legal_name, tax_regime, status from public.companies
    where id = ${companyId} and firm_id = ${firmId}
  `;
  if (!company) return 'Empresa não encontrada.';

  const [pending] = await sql<{ n: number }[]>`
    select count(*)::int as n from public.document_requests
    where firm_id = ${firmId} and company_id = ${companyId}
      and status in ('requested', 'sent', 'viewed')
  `;
  const [deadline] = await sql<{ doc_kind: string; due_date: string | null }[]>`
    select doc_kind, due_date from public.monitored_documents
    where firm_id = ${firmId} and company_id = ${companyId}
      and status in ('due_soon', 'overdue')
    order by due_date asc nulls last
    limit 1
  `;

  const parts = [
    `Empresa: ${company.legal_name}`,
    company.tax_regime ? `Regime: ${company.tax_regime}` : null,
    `Documentos pendentes solicitados: ${pending?.n ?? 0}`,
    deadline ? `Prazo mais próximo a vencer: ${deadline.doc_kind} em ${deadline.due_date ?? 's/ data'}` : null,
  ].filter(Boolean);
  return parts.join('. ') + '.';
}

export function createSupportHandler(
  sql: Sql,
  whatsapp: WhatsappAdapter,
  assistant: SupportAssistantAdapter,
) {
  const json: Json = (value) => sql.json(value as Parameters<typeof sql.json>[0]);

  async function loadTicket(firmId: string, ticketId: string): Promise<TicketRow | null> {
    const [row] = await sql<TicketRow[]>`
      select id, company_id, channel, contact_identifier, status, last_inbound_at
      from public.support_tickets where id = ${ticketId} and firm_id = ${firmId}
    `;
    return row ?? null;
  }

  async function send(channel: string, to: string, body: string) {
    if (channel === 'whatsapp') return whatsapp.sendText(to, body);
    return { ok: false as const, error: `channel ${channel} not deliverable` };
  }

  return async function handle(payload: SupportPayload): Promise<void> {
    const { firm_id, ticket_id, message_id, kind } = payload;
    const ticket = await loadTicket(firm_id, ticket_id);
    if (!ticket) {
      console.warn(`[support] ticket ${ticket_id} not found in firm ${firm_id}; skipping`);
      return;
    }

    // --- deliver a queued human reply ---
    if (kind === 'deliver') {
      const [msg] = await sql<{ id: string; body: string; delivery: string }[]>`
        select id, body, delivery from public.support_messages
        where id = ${message_id} and firm_id = ${firm_id}
      `;
      if (!msg || msg.delivery !== 'queued') return; // already delivered / gone
      const res = await send(ticket.channel, ticket.contact_identifier, msg.body);
      await sql`
        update public.support_messages
        set delivery = ${res.ok ? 'delivered' : 'failed'}, delivered_at = now(),
            external_id = ${res.ok ? (res.id ?? null) : null}
        where id = ${message_id} and firm_id = ${firm_id}
      `;
      if (!res.ok) {
        await sql`
          insert into public.exception_queue (firm_id, source, context, suggestion)
          values (${firm_id}, 'notifications',
                  ${json({ reason: 'support_delivery_failed', ticketId: ticket_id, error: res.error })},
                  '{}'::jsonb)
        `;
      }
      console.log(`[support] delivered ${message_id} → ${res.ok ? 'ok' : 'failed'}`);
      return;
    }

    // --- handle a new client message with the AI ---
    const [firm] = await sql<{ config: unknown }[]>`
      select config from public.firms where id = ${firm_id}
    `;
    const config = parseFirmConfig(firm?.config);
    const [last] = await sql<{ body: string }[]>`
      select body from public.support_messages where id = ${message_id} and firm_id = ${firm_id}
    `;
    const question = last?.body ?? '';
    const context = await buildCompanyContext(sql, firm_id, ticket.company_id);

    const answer = await assistant.answer({
      question,
      context,
      faq: [],
      model: config.aiModel,
    });
    const decision = decideSupportResponse({
      autoReplyEnabled: config.support.autoReply,
      inScope: answer.inScope,
      confidence: answer.confidence,
      threshold: config.support.aiThreshold,
    });

    if (decision.action === 'ai_reply') {
      const res = await send(ticket.channel, ticket.contact_identifier, answer.reply);
      await sql`
        insert into public.support_messages
          (firm_id, ticket_id, direction, author, body, external_id, delivery, delivered_at)
        values (${firm_id}, ${ticket_id}, 'outbound', 'ai', ${answer.reply},
                ${res.ok ? (res.id ?? null) : null}, ${res.ok ? 'delivered' : 'failed'}, now())
      `;
      await sql`
        update public.support_tickets set status = 'pending', ai_handled = true, last_message_at = now()
        where id = ${ticket_id} and firm_id = ${firm_id}
      `;
      await sql`
        insert into public.audit_events (firm_id, action, entity, entity_id, context)
        values (${firm_id}, 'support.ai_replied', 'support_ticket', ${ticket_id},
                ${json({ confidence: answer.confidence })})
      `;
      console.log(`[support] AI replied ${ticket_id} (conf ${answer.confidence})`);
      return;
    }

    // escalate: a human must take over. Acknowledge the client only inside the free
    // 24h service window (outside it a paid template would be required — skip).
    const within = ticket.last_inbound_at
      ? isWithin24hWindow(ticket.last_inbound_at, new Date().toISOString())
      : false;
    if (within && config.support.escalationMessage) {
      const res = await send(ticket.channel, ticket.contact_identifier, config.support.escalationMessage);
      await sql`
        insert into public.support_messages
          (firm_id, ticket_id, direction, author, body, external_id, delivery, delivered_at)
        values (${firm_id}, ${ticket_id}, 'outbound', 'ai', ${config.support.escalationMessage},
                ${res.ok ? (res.id ?? null) : null}, ${res.ok ? 'delivered' : 'failed'}, now())
      `;
    }
    await sql`
      update public.support_tickets set status = 'escalated', last_message_at = now()
      where id = ${ticket_id} and firm_id = ${firm_id}
    `;
    await sql`
      insert into public.audit_events (firm_id, action, entity, entity_id, context)
      values (${firm_id}, 'support.escalated', 'support_ticket', ${ticket_id},
              ${json({ reason: decision.reason })})
    `;
    console.log(`[support] escalated ${ticket_id} (${decision.reason})`);
  };
}
