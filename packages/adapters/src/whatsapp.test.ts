import { createHmac } from 'node:crypto';
import { describe, expect, it } from 'vitest';

import {
  MetaWhatsappAdapter,
  NoopWhatsappAdapter,
  parseWhatsappInbound,
  verifyWhatsappSignature,
} from './whatsapp';

function textWebhook(body: string, msgId = 'wamid.1') {
  return {
    entry: [
      {
        changes: [
          {
            value: {
              metadata: { phone_number_id: '555000' },
              contacts: [{ wa_id: '5513999990000', profile: { name: 'Maria' } }],
              messages: [{ id: msgId, from: '5513999990000', timestamp: '1700000000', type: 'text', text: { body } }],
            },
          },
        ],
      },
    ],
  };
}

describe('parseWhatsappInbound', () => {
  it('extracts a text message with sender name and phone number id', () => {
    const [msg] = parseWhatsappInbound(textWebhook('qual o valor do DAS?'));
    expect(msg).toMatchObject({
      externalId: 'wamid.1',
      from: '5513999990000',
      phoneNumberId: '555000',
      text: 'qual o valor do DAS?',
      media: null,
      contactName: 'Maria',
    });
  });

  it('extracts a document attachment and uses the caption as text', () => {
    const body = {
      entry: [
        {
          changes: [
            {
              value: {
                metadata: { phone_number_id: '555000' },
                messages: [
                  {
                    id: 'wamid.2',
                    from: '5513999990000',
                    type: 'document',
                    document: {
                      id: 'media-9',
                      mime_type: 'application/pdf',
                      filename: 'nota.pdf',
                      caption: 'segue a nota',
                    },
                  },
                ],
              },
            },
          ],
        },
      ],
    };
    const [msg] = parseWhatsappInbound(body);
    expect(msg?.media).toEqual({ id: 'media-9', mimeType: 'application/pdf', fileName: 'nota.pdf' });
    expect(msg?.text).toBe('segue a nota');
  });

  it('ignores status callbacks and malformed bodies', () => {
    expect(parseWhatsappInbound({ entry: [{ changes: [{ value: { statuses: [{}] } }] }] })).toEqual(
      [],
    );
    expect(parseWhatsappInbound(null)).toEqual([]);
    expect(parseWhatsappInbound({})).toEqual([]);
  });
});

describe('verifyWhatsappSignature', () => {
  const secret = 'app-secret';
  const body = JSON.stringify(textWebhook('oi'));

  it('accepts a correct signature', () => {
    const sig = 'sha256=' + createHmac('sha256', secret).update(body, 'utf8').digest('hex');
    expect(verifyWhatsappSignature(secret, body, sig)).toBe(true);
  });

  it('rejects a wrong/absent/malformed signature', () => {
    expect(verifyWhatsappSignature(secret, body, 'sha256=deadbeef')).toBe(false);
    expect(verifyWhatsappSignature(secret, body, null)).toBe(false);
    expect(verifyWhatsappSignature(secret, body, 'md5=abc')).toBe(false);
    const wrong = 'sha256=' + createHmac('sha256', 'other').update(body, 'utf8').digest('hex');
    expect(verifyWhatsappSignature(secret, body, wrong)).toBe(false);
  });
});

describe('webhook verification', () => {
  it('echoes the challenge when the verify token matches', () => {
    const a = new MetaWhatsappAdapter({
      accessToken: 't',
      phoneNumberId: 'p',
      appSecret: 's',
      verifyToken: 'vt',
    });
    expect(a.verifyWebhook({ mode: 'subscribe', token: 'vt', challenge: '123' })).toBe('123');
    expect(a.verifyWebhook({ mode: 'subscribe', token: 'nope', challenge: '123' })).toBeNull();
  });

  it('the no-op never validates a signature', () => {
    expect(new NoopWhatsappAdapter().verifySignature()).toBe(false);
  });
});

describe('sendText', () => {
  it('posts to the messages endpoint and returns the message id', async () => {
    const calls: { url: string; init?: unknown }[] = [];
    const fetchImpl = async (url: string, init?: unknown) => {
      calls.push({ url, init });
      return {
        ok: true,
        status: 200,
        text: () => Promise.resolve(JSON.stringify({ messages: [{ id: 'wamid.out' }] })),
        json: () => Promise.resolve({}),
        arrayBuffer: () => Promise.resolve(new ArrayBuffer(0)),
      };
    };
    const a = new MetaWhatsappAdapter({
      accessToken: 'tok',
      phoneNumberId: '555000',
      appSecret: 's',
      verifyToken: 'vt',
      fetchImpl,
    });
    const res = await a.sendText('5513999990000', 'olá');
    expect(res).toEqual({ ok: true, id: 'wamid.out' });
    expect(calls[0]?.url).toContain('/555000/messages');
  });
});
