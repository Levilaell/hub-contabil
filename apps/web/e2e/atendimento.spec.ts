import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

import { type SupabaseClient, createClient } from '@supabase/supabase-js';
import { expect, test } from '@playwright/test';

// Atendimento (support) UI flow. A ticket that arrived by WhatsApp is shown on the
// support screen; the contractor opens it, reads the client's message, and answers.
// The reply is persisted synchronously by the reply_support_ticket RPC (queued for the
// worker to deliver), so this spec is deterministic and needs no running worker — the
// inbound→support ROUTING is covered by the worker integration tests (inbound.test /
// support.test). Seeds the ticket via the service role (same approach as worker-triage).

const FIRM_A = '11111111-1111-4111-8111-111111111111';
const PHONE = '5513922223333';
const CONTACT_NAME = 'Cliente Atendimento E2E';
const QUESTION = 'Olá! A guia deste mês já foi enviada?';

const dbEnv = readFileSync(resolve(process.cwd(), '../../packages/db/.env'), 'utf8');
const get = (k: string) => new RegExp(`^${k}=(.*)$`, 'm').exec(dbEnv)?.[1]?.trim() ?? '';
const SUPABASE_URL = get('SUPABASE_URL');
const SERVICE = get('SUPABASE_SERVICE_ROLE_KEY');

test.describe('atendimento: render ticket and reply', () => {
  let service: SupabaseClient;
  let ticketId = '';

  async function cleanup() {
    await service.from('support_tickets').delete().eq('firm_id', FIRM_A).eq('contact_identifier', PHONE); // cascades messages
    if (ticketId) await service.from('audit_events').delete().eq('firm_id', FIRM_A).eq('entity_id', ticketId);
  }

  test.beforeAll(async () => {
    service = createClient(SUPABASE_URL, SERVICE, { auth: { persistSession: false } });
    await cleanup(); // hygiene against a prior run (unique firm+channel+contact)

    const { data: ticket, error } = await service
      .from('support_tickets')
      .insert({
        firm_id: FIRM_A,
        channel: 'whatsapp',
        contact_identifier: PHONE,
        contact_name: CONTACT_NAME,
        subject: QUESTION.slice(0, 80),
        status: 'escalated', // a human must answer → shows in the default open view
        last_inbound_at: new Date().toISOString(),
      })
      .select('id')
      .single();
    if (error) throw error;
    ticketId = ticket.id as string;

    const { error: msgErr } = await service.from('support_messages').insert({
      firm_id: FIRM_A,
      ticket_id: ticketId,
      direction: 'inbound',
      author: 'client',
      body: QUESTION,
      delivery: 'delivered',
    });
    if (msgErr) throw msgErr;
  });

  test.afterAll(async () => {
    if (service) await cleanup();
  });

  test('shows the ticket, opens the conversation, and posts a reply', async ({ page }) => {
    await page.goto('/atendimento');

    // The ticket is visible in the default view (open + escalated).
    await expect(page.getByText(CONTACT_NAME)).toBeVisible();

    // Open it and read the client's message in the drawer.
    await page.getByText(CONTACT_NAME).click();
    await expect(page.getByText(QUESTION)).toBeVisible();

    // Answer through the UI. reply_support_ticket queues the outbound message.
    await page.getByPlaceholder('Escreva sua resposta ao cliente…').fill('Sim, já enviamos a guia!');
    await page.getByRole('button', { name: 'Responder' }).click();

    // The human reply is persisted as an outbound 'user' message (delivery queued for
    // the worker) — created synchronously by the RPC, so the assertion is worker-free.
    await expect
      .poll(
        async () =>
          (
            await service
              .from('support_messages')
              .select('id, body')
              .eq('firm_id', FIRM_A)
              .eq('ticket_id', ticketId)
              .eq('author', 'user')
          ).data?.length ?? 0,
        { timeout: 15_000, intervals: [500] },
      )
      .toBeGreaterThanOrEqual(1);
  });
});
