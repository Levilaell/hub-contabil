import { describe, expect, it } from 'vitest';

import { NoopMessagingAdapter, ResendMessagingAdapter, createMessagingAdapter } from './messaging';

describe('NoopMessagingAdapter', () => {
  it('reports success without sending', async () => {
    const adapter = new NoopMessagingAdapter();
    const result = await adapter.sendEmail({ to: 'x@y.test', subject: 'Oi', body: 'corpo' });
    expect(result.ok).toBe(true);
  });
});

describe('ResendMessagingAdapter', () => {
  it('POSTs to the Resend API with auth + from/to/subject and returns the id', async () => {
    let captured: {
      url: string;
      init: { method: string; headers: Record<string, string>; body: string };
    } | null = null;
    const adapter = new ResendMessagingAdapter({
      apiKey: 'rk_test',
      from: 'Demo <no-reply@demo.test>',
      fetchImpl: async (url, init) => {
        captured = { url, init };
        return { ok: true, status: 200, text: async () => JSON.stringify({ id: 'email_123' }) };
      },
    });

    const result = await adapter.sendEmail({
      to: 'cliente@empresa.test',
      subject: 'Documento solicitado',
      body: 'Abra o link',
      html: '<a href="x">link</a>',
    });

    expect(result).toEqual({ ok: true, id: 'email_123' });
    expect(captured!.url).toBe('https://api.resend.com/emails');
    expect(captured!.init.headers.Authorization).toBe('Bearer rk_test');
    const sent = JSON.parse(captured!.init.body);
    expect(sent.to).toBe('cliente@empresa.test');
    expect(sent.text).toBe('Abra o link');
    expect(sent.html).toBe('<a href="x">link</a>');
  });

  it('reports a non-2xx response as a failure', async () => {
    const adapter = new ResendMessagingAdapter({
      apiKey: 'rk_test',
      from: 'x@y.test',
      fetchImpl: async () => ({ ok: false, status: 422, text: async () => 'bad' }),
    });
    const result = await adapter.sendEmail({ to: 'a@b.test', subject: 's', body: 'b' });
    expect(result.ok).toBe(false);
  });
});

describe('createMessagingAdapter', () => {
  it('returns Resend when key + sender are set, else the no-op', () => {
    expect(createMessagingAdapter({ RESEND_API_KEY: 'k', RESEND_FROM: 'a@b.test' })).toBeInstanceOf(
      ResendMessagingAdapter,
    );
    expect(createMessagingAdapter({})).toBeInstanceOf(NoopMessagingAdapter);
    expect(createMessagingAdapter({ RESEND_API_KEY: 'k' })).toBeInstanceOf(NoopMessagingAdapter);
  });
});
