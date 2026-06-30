import { createWhatsappAdapter } from '@hub/adapters';
import { decideInboundRouting } from '@hub/core';

import { createAdminClient } from '@/lib/supabase/admin';

// WhatsApp Cloud API webhook (entrada via WhatsApp). GET = Meta's verification
// handshake; POST = inbound messages. We verify the X-Hub-Signature-256 (the app
// secret is server-only), record each message via the service-role RPC
// record_inbound_message (idempotent, enqueues the 'inbound' job), and return 200
// fast — media download + routing happen in the worker, not here. No firm session:
// single-tenant, the firm is resolved from FIRM_ID or the single firms row. Status
// callbacks (delivered/read) parse to nothing and are acked.

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

async function resolveFirmId(): Promise<string | null> {
  if (process.env.FIRM_ID) return process.env.FIRM_ID;
  const supabase = createAdminClient();
  const { data } = await supabase
    .from('firms')
    .select('id')
    .order('created_at', { ascending: true })
    .limit(1)
    .maybeSingle();
  return (data as { id: string } | null)?.id ?? null;
}

export function GET(request: Request): Response {
  const url = new URL(request.url);
  const adapter = createWhatsappAdapter();
  const challenge = adapter.verifyWebhook({
    mode: url.searchParams.get('hub.mode') ?? undefined,
    token: url.searchParams.get('hub.verify_token') ?? undefined,
    challenge: url.searchParams.get('hub.challenge') ?? undefined,
  });
  if (challenge === null) return new Response('forbidden', { status: 403 });
  return new Response(challenge, { status: 200 });
}

export async function POST(request: Request): Promise<Response> {
  const raw = await request.text();
  const adapter = createWhatsappAdapter();

  // Reject anything we can't authenticate (the no-op adapter rejects everything,
  // so posts never pass until WhatsApp is actually configured).
  if (!adapter.verifySignature(raw, request.headers.get('x-hub-signature-256'))) {
    return new Response('invalid signature', { status: 401 });
  }

  let body: unknown;
  try {
    body = JSON.parse(raw);
  } catch {
    return new Response('ok', { status: 200 }); // malformed → ack, nothing to do
  }

  const messages = adapter.parseInbound(body);
  if (messages.length === 0) return new Response('ok', { status: 200 });

  const firmId = await resolveFirmId();
  if (!firmId) return new Response('ok', { status: 200 });

  const supabase = createAdminClient();
  for (const msg of messages) {
    const kind = decideInboundRouting({ hasAttachment: msg.media !== null, text: msg.text }).kind;
    await supabase.rpc('record_inbound_message', {
      p_firm_id: firmId,
      p_channel: 'whatsapp',
      p_external_id: msg.externalId,
      p_sender: msg.from,
      p_kind: kind,
      p_subject: null,
      p_raw: {
        mediaId: msg.media?.id ?? null,
        fileName: msg.media?.fileName ?? null,
        mimeType: msg.media?.mimeType ?? null,
        text: msg.text,
        contactName: msg.contactName,
      },
    });
  }
  return new Response('ok', { status: 200 });
}
