import type { SupportAssistantAdapter, SupportAssistantResult, WhatsappAdapter } from '@hub/adapters';
import postgres, { type Sql } from 'postgres';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { createSupportHandler } from './support';

// Support assistant consumer (atendimento) against the linked Supabase Cloud dev
// project, with FAKE channel + AI adapters. It exercises the seams: a human reply is
// delivered over WhatsApp (or fails → exception, golden rule #6); a new client
// message is answered by the AI ONLY when auto-reply is on, in-scope and confident —
// everything else escalates to a human (golden rule #5, the AI never decides alone).
// Runs in its OWN firm so it can freely flip the firm's support config without
// touching the shared Demo fixture; a single `delete firms` cascades the cleanup.

const DATABASE_URL = process.env.DATABASE_URL;
const hasEnv = Boolean(DATABASE_URL);
const FIRM = '33333333-3333-4333-8333-333333333333';

function fakeWhatsapp(result: { ok: true; id?: string } | { ok: false; error: string }) {
  return { sendText: () => Promise.resolve(result) } as unknown as WhatsappAdapter;
}
function fakeAssistant(result: SupportAssistantResult): SupportAssistantAdapter {
  return { answer: () => Promise.resolve(result) };
}

describe.skipIf(!hasEnv)('support assistant consumer (cloud dev)', () => {
  let sql: Sql;
  let seq = 0;

  async function setSupportConfig(cfg: {
    autoReply: boolean;
    aiThreshold?: number;
  }): Promise<void> {
    await sql`update public.firms set config = ${sql.json({ support: cfg })} where id = ${FIRM}`;
  }

  /** A ticket + (optionally) its triggering inbound message. Each call uses a fresh
   *  contact id so the unique (firm, channel, contact) never collides across tests. */
  async function newTicket(
    status: string,
    opts: { lastInboundAt?: string | null } = {},
  ): Promise<string> {
    seq += 1;
    const [row] = await sql<{ id: string }[]>`
      insert into public.support_tickets
        ${sql({
          firm_id: FIRM,
          channel: 'whatsapp',
          contact_identifier: `551199990${String(seq).padStart(4, '0')}`,
          status,
          last_inbound_at: opts.lastInboundAt ?? null,
        })}
      returning id
    `;
    if (!row) throw new Error('ticket insert returned no row');
    return row.id;
  }

  async function addMessage(
    ticketId: string,
    fields: { direction: string; author: string; body: string; delivery: string },
  ): Promise<string> {
    const [row] = await sql<{ id: string }[]>`
      insert into public.support_messages
        ${sql({ firm_id: FIRM, ticket_id: ticketId, ...fields })}
      returning id
    `;
    if (!row) throw new Error('message insert returned no row');
    return row.id;
  }

  beforeAll(async () => {
    if (!DATABASE_URL) throw new Error('missing DATABASE_URL');
    sql = postgres(DATABASE_URL, { prepare: false });
    await sql`delete from public.firms where id = ${FIRM}`; // self-heal a prior interrupted run
    await sql`insert into public.firms ${sql({ id: FIRM, name: 'Support Test Firm', config: sql.json({}) })}`;
  });

  afterAll(async () => {
    if (sql) {
      await sql`delete from public.firms where id = ${FIRM}`; // cascades tickets/messages/exceptions/audit
      await sql.end();
    }
  });

  it('delivers a queued human reply over WhatsApp and marks it delivered', async () => {
    // Inside the free 24h service window (client wrote just now).
    const ticketId = await newTicket('pending', { lastInboundAt: new Date().toISOString() });
    const messageId = await addMessage(ticketId, {
      direction: 'outbound',
      author: 'user',
      body: 'Olá, segue a resposta do contador.',
      delivery: 'queued',
    });

    await createSupportHandler(sql, fakeWhatsapp({ ok: true, id: 'wamid.OUT1' }), fakeAssistant({
      reply: '',
      confidence: 0,
      inScope: false,
    }))({ firm_id: FIRM, ticket_id: ticketId, message_id: messageId, kind: 'deliver' });

    const [msg] = await sql<{ delivery: string; external_id: string | null }[]>`
      select delivery, external_id from public.support_messages where id = ${messageId}
    `;
    expect(msg?.delivery).toBe('delivered');
    expect(msg?.external_id).toBe('wamid.OUT1');
  });

  it('fails a WhatsApp reply outside the 24h window without calling Meta', async () => {
    // last_inbound_at null = no recent client message → Meta would reject the
    // free-form text; the handler fails it up front with a clear reason.
    const ticketId = await newTicket('pending');
    const messageId = await addMessage(ticketId, {
      direction: 'outbound',
      author: 'user',
      body: 'Resposta fora da janela.',
      delivery: 'queued',
    });

    await createSupportHandler(sql, fakeWhatsapp({ ok: true, id: 'wamid.NEVER' }), fakeAssistant({
      reply: '',
      confidence: 0,
      inScope: false,
    }))({ firm_id: FIRM, ticket_id: ticketId, message_id: messageId, kind: 'deliver' });

    const [msg] = await sql<{ delivery: string; external_id: string | null }[]>`
      select delivery, external_id from public.support_messages where id = ${messageId}
    `;
    expect(msg?.delivery).toBe('failed');
    expect(msg?.external_id).toBeNull();
  });

  it('records an exception when delivery fails — never dropped (golden rule #6)', async () => {
    const ticketId = await newTicket('pending', { lastInboundAt: new Date().toISOString() });
    const messageId = await addMessage(ticketId, {
      direction: 'outbound',
      author: 'user',
      body: 'Resposta que vai falhar.',
      delivery: 'queued',
    });

    await createSupportHandler(sql, fakeWhatsapp({ ok: false, error: 'whatsapp http 500' }), fakeAssistant({
      reply: '',
      confidence: 0,
      inScope: false,
    }))({ firm_id: FIRM, ticket_id: ticketId, message_id: messageId, kind: 'deliver' });

    const [msg] = await sql<{ delivery: string }[]>`
      select delivery from public.support_messages where id = ${messageId}
    `;
    expect(msg?.delivery).toBe('failed');

    const exceptions = await sql<{ context: Record<string, unknown> }[]>`
      select context from public.exception_queue where firm_id = ${FIRM}
    `;
    const reasons = exceptions.map((e) => {
      const ctx = (typeof e.context === 'string' ? JSON.parse(e.context as unknown as string) : e.context) as {
        reason?: string;
      };
      return ctx.reason;
    });
    expect(reasons).toContain('support_delivery_failed');
  });

  it('escalates to a human when auto-reply is OFF (AI never decides alone)', async () => {
    await setSupportConfig({ autoReply: false });
    const ticketId = await newTicket('open', { lastInboundAt: new Date().toISOString() });
    const messageId = await addMessage(ticketId, {
      direction: 'inbound',
      author: 'client',
      body: 'Posso abater essa despesa no imposto?',
      delivery: 'delivered',
    });

    await createSupportHandler(sql, fakeWhatsapp({ ok: true }), fakeAssistant({
      reply: 'resposta qualquer',
      confidence: 0.99,
      inScope: true,
    }))({ firm_id: FIRM, ticket_id: ticketId, message_id: messageId, kind: 'inbound' });

    const [ticket] = await sql<{ status: string; ai_handled: boolean }[]>`
      select status, ai_handled from public.support_tickets where id = ${ticketId}
    `;
    expect(ticket?.status).toBe('escalated');
    expect(ticket?.ai_handled).toBe(false);

    const audit = await sql`
      select 1 from public.audit_events
      where firm_id = ${FIRM} and entity_id = ${ticketId} and action = 'support.escalated'
    `;
    expect(audit.length).toBe(1);
  });

  it('does NOT repeat the escalation ack on an already-escalated conversation', async () => {
    await setSupportConfig({ autoReply: false });
    const ticketId = await newTicket('escalated', { lastInboundAt: new Date().toISOString() });
    const messageId = await addMessage(ticketId, {
      direction: 'inbound',
      author: 'client',
      body: 'Alguém aí?',
      delivery: 'delivered',
    });

    await createSupportHandler(sql, fakeWhatsapp({ ok: true }), fakeAssistant({
      reply: '',
      confidence: 0,
      inScope: false,
    }))({ firm_id: FIRM, ticket_id: ticketId, message_id: messageId, kind: 'inbound' });

    const outbound = await sql<{ n: number }[]>`
      select count(*)::int as n from public.support_messages
      where firm_id = ${FIRM} and ticket_id = ${ticketId} and direction = 'outbound'
    `;
    expect(outbound[0]?.n).toBe(0); // no second "Recebemos sua mensagem…"
  });

  it('lets the AI answer when auto-reply is ON, in-scope and confident', async () => {
    await setSupportConfig({ autoReply: true, aiThreshold: 0.5 });
    const ticketId = await newTicket('open', { lastInboundAt: new Date().toISOString() });
    const messageId = await addMessage(ticketId, {
      direction: 'inbound',
      author: 'client',
      body: 'Vocês já enviaram a guia desse mês?',
      delivery: 'delivered',
    });

    await createSupportHandler(sql, fakeWhatsapp({ ok: true, id: 'wamid.AI1' }), fakeAssistant({
      reply: 'Sim! A guia já foi enviada e está em dia.',
      confidence: 0.92,
      inScope: true,
    }))({ firm_id: FIRM, ticket_id: ticketId, message_id: messageId, kind: 'inbound' });

    const [ticket] = await sql<{ status: string; ai_handled: boolean }[]>`
      select status, ai_handled from public.support_tickets where id = ${ticketId}
    `;
    expect(ticket?.status).toBe('pending'); // we replied, awaiting the client
    expect(ticket?.ai_handled).toBe(true);

    const [aiMsg] = await sql<{ author: string; direction: string; delivery: string }[]>`
      select author, direction, delivery from public.support_messages
      where ticket_id = ${ticketId} and author = 'ai'
    `;
    expect(aiMsg).toMatchObject({ author: 'ai', direction: 'outbound', delivery: 'delivered' });

    const audit = await sql`
      select 1 from public.audit_events
      where firm_id = ${FIRM} and entity_id = ${ticketId} and action = 'support.ai_replied'
    `;
    expect(audit.length).toBe(1);
  });

  it('escalates instead of answering when confidence is below the threshold', async () => {
    await setSupportConfig({ autoReply: true, aiThreshold: 0.8 });
    const ticketId = await newTicket('open', { lastInboundAt: new Date().toISOString() });
    const messageId = await addMessage(ticketId, {
      direction: 'inbound',
      author: 'client',
      body: 'Pergunta difícil e ambígua.',
      delivery: 'delivered',
    });

    await createSupportHandler(sql, fakeWhatsapp({ ok: true }), fakeAssistant({
      reply: 'talvez...',
      confidence: 0.3, // below 0.8
      inScope: true,
    }))({ firm_id: FIRM, ticket_id: ticketId, message_id: messageId, kind: 'inbound' });

    const [ticket] = await sql<{ status: string }[]>`
      select status from public.support_tickets where id = ${ticketId}
    `;
    expect(ticket?.status).toBe('escalated');
  });
});
