import { expect, test } from '@playwright/test';

// WhatsApp webhook security (entrada via WhatsApp), public — no auth, no worker. The
// route authenticates Meta with the app secret (POST) and a verify token (GET); with
// no WhatsApp credentials wired in dev the no-op adapter rejects everything, which is
// exactly the safe default we assert here. Proves an unsigned/forged post can never
// reach record_inbound_message.

test.describe('whatsapp webhook security', () => {
  test('rejects a POST without a valid X-Hub-Signature-256 (401)', async ({ request }) => {
    const res = await request.post('/api/webhooks/whatsapp', {
      headers: { 'content-type': 'application/json' },
      data: { entry: [{ changes: [{ value: { messages: [{ id: 'x', from: '55', text: { body: 'oi' } }] } }] }] },
    });
    expect(res.status()).toBe(401);
  });

  test('rejects the GET verification handshake with a wrong verify token (403)', async ({ request }) => {
    const res = await request.get(
      '/api/webhooks/whatsapp?hub.mode=subscribe&hub.verify_token=definitely-wrong&hub.challenge=12345',
    );
    expect(res.status()).toBe(403);
  });
});
