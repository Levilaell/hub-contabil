import { createHmac, timingSafeEqual } from 'node:crypto';

// WhatsappAdapter (golden rule #3). The ONE accepted WhatsApp path is Meta's
// official Cloud API — unofficial libraries (Evolution/Z-API) are forbidden
// (permanent number ban, ToS violation; see docs/ADAPTERS.md §3). This single
// adapter serves three features (entrada de documentos, atendimento, envio de
// relatórios): inbound webhook parsing + media download, and outbound text. The
// worker/web never import a WhatsApp SDK directly. The factory returns the real
// adapter when a token is configured, else a no-op that logs (so the app runs
// without WhatsApp wired). Webhook parsing/verification are pure and need no
// credentials — they work in the no-op too.

export interface WhatsappInboundMessage {
  /** Provider message id — the idempotency key for inbound_messages. */
  externalId: string;
  /** Sender wa_id (digits, country code included). */
  from: string;
  /** The business phone number id that received it (maps to the firm). */
  phoneNumberId: string;
  /** Unix seconds as sent by Meta. */
  timestamp: string;
  /** Text body or media caption (empty string when none). */
  text: string;
  /** Set when the message carries a media attachment. */
  media: { id: string; mimeType: string; fileName: string } | null;
  /** Sender display name, when present in the contacts block. */
  contactName: string | null;
}

export interface WhatsappMedia {
  bytes: Buffer;
  mimeType: string;
  fileName: string;
}

export interface WhatsappAdapter {
  /** GET webhook verification: echo hub.challenge when the verify token matches. */
  verifyWebhook(params: { mode?: string; token?: string; challenge?: string }): string | null;
  /** Validate the X-Hub-Signature-256 header against the raw request body. */
  verifySignature(rawBody: string, signatureHeader: string | null): boolean;
  /** Extract inbound messages from a webhook POST body (status updates → []). */
  parseInbound(body: unknown): WhatsappInboundMessage[];
  /** Download a media attachment by id (two-step: lookup URL, then bytes). */
  downloadMedia(mediaId: string): Promise<WhatsappMedia>;
  /** Send a free-form text reply (only valid inside the 24h service window). */
  sendText(to: string, body: string): Promise<SendTextResult>;
}

export type SendTextResult = { ok: true; id?: string } | { ok: false; error: string };

const GRAPH = 'https://graph.facebook.com/v21.0';

function extFor(mimeType: string): string {
  const map: Record<string, string> = {
    'application/pdf': 'pdf',
    'image/jpeg': 'jpg',
    'image/png': 'png',
    'image/webp': 'webp',
    'image/gif': 'gif',
    'application/xml': 'xml',
    'text/xml': 'xml',
  };
  return map[mimeType] ?? 'bin';
}

// --- pure webhook parsing (shared by real + no-op) ------------------------------

interface RawMessage {
  id?: string;
  from?: string;
  timestamp?: string;
  type?: string;
  text?: { body?: string };
  image?: { id?: string; mime_type?: string; caption?: string };
  document?: { id?: string; mime_type?: string; filename?: string; caption?: string };
  video?: { id?: string; mime_type?: string; caption?: string };
  audio?: { id?: string; mime_type?: string };
}

function mediaOf(
  msg: RawMessage,
): { media: WhatsappInboundMessage['media']; caption: string } {
  if (msg.document?.id) {
    const mime = msg.document.mime_type ?? 'application/octet-stream';
    return {
      media: {
        id: msg.document.id,
        mimeType: mime,
        fileName: msg.document.filename ?? `documento-${msg.document.id}.${extFor(mime)}`,
      },
      caption: msg.document.caption ?? '',
    };
  }
  if (msg.image?.id) {
    const mime = msg.image.mime_type ?? 'image/jpeg';
    return {
      media: { id: msg.image.id, mimeType: mime, fileName: `foto-${msg.image.id}.${extFor(mime)}` },
      caption: msg.image.caption ?? '',
    };
  }
  if (msg.video?.id) {
    const mime = msg.video.mime_type ?? 'video/mp4';
    return {
      media: { id: msg.video.id, mimeType: mime, fileName: `video-${msg.video.id}.${extFor(mime)}` },
      caption: msg.video.caption ?? '',
    };
  }
  return { media: null, caption: '' };
}

/** Pure: pull inbound messages out of a Cloud API webhook body. Status callbacks
 *  (delivered/read) and non-message changes yield no messages. */
export function parseWhatsappInbound(body: unknown): WhatsappInboundMessage[] {
  const out: WhatsappInboundMessage[] = [];
  const root = body as { entry?: unknown[] } | null;
  if (!root || !Array.isArray(root.entry)) return out;
  for (const entry of root.entry) {
    const changes = (entry as { changes?: unknown[] }).changes;
    if (!Array.isArray(changes)) continue;
    for (const change of changes) {
      const value = (change as { value?: Record<string, unknown> }).value;
      if (!value) continue;
      const phoneNumberId =
        ((value.metadata as { phone_number_id?: string } | undefined)?.phone_number_id) ?? '';
      const contacts = (value.contacts as { wa_id?: string; profile?: { name?: string } }[]) ?? [];
      const nameByWaId = new Map<string, string>();
      for (const c of contacts) if (c.wa_id) nameByWaId.set(c.wa_id, c.profile?.name ?? '');
      const messages = (value.messages as RawMessage[]) ?? [];
      for (const msg of messages) {
        if (!msg.id || !msg.from) continue;
        const { media, caption } = mediaOf(msg);
        const text = msg.text?.body ?? caption ?? '';
        out.push({
          externalId: msg.id,
          from: msg.from,
          phoneNumberId,
          timestamp: msg.timestamp ?? '',
          text,
          media,
          contactName: nameByWaId.get(msg.from) || null,
        });
      }
    }
  }
  return out;
}

// --- fetch shape (inject in tests; no DOM types) --------------------------------

type FetchResponse = {
  ok: boolean;
  status: number;
  text(): Promise<string>;
  json(): Promise<unknown>;
  arrayBuffer(): Promise<ArrayBuffer>;
};
type FetchInit = { method?: string; headers?: Record<string, string>; body?: string };
type FetchLike = (url: string, init?: FetchInit) => Promise<FetchResponse>;

export interface WhatsappAdapterOptions {
  /** Permanent/system user access token for the firm's WABA. */
  accessToken: string;
  /** Business phone number id (sender). */
  phoneNumberId: string;
  /** App secret for X-Hub-Signature-256 verification. */
  appSecret: string;
  /** Token configured in the Meta webhook setup (GET verification). */
  verifyToken: string;
  fetchImpl?: FetchLike;
}

export class MetaWhatsappAdapter implements WhatsappAdapter {
  constructor(private readonly opts: WhatsappAdapterOptions) {}

  verifyWebhook(params: { mode?: string; token?: string; challenge?: string }): string | null {
    if (params.mode === 'subscribe' && params.token === this.opts.verifyToken) {
      return params.challenge ?? '';
    }
    return null;
  }

  verifySignature(rawBody: string, signatureHeader: string | null): boolean {
    return verifyWhatsappSignature(this.opts.appSecret, rawBody, signatureHeader);
  }

  parseInbound(body: unknown): WhatsappInboundMessage[] {
    return parseWhatsappInbound(body);
  }

  async downloadMedia(mediaId: string): Promise<WhatsappMedia> {
    const doFetch = this.opts.fetchImpl ?? (fetch as unknown as FetchLike);
    const auth = { Authorization: `Bearer ${this.opts.accessToken}` };
    const lookup = await doFetch(`${GRAPH}/${mediaId}`, { headers: auth });
    if (!lookup.ok) throw new Error(`whatsapp media lookup http ${lookup.status}`);
    const meta = (await lookup.json()) as { url?: string; mime_type?: string };
    if (!meta.url) throw new Error('whatsapp media lookup returned no url');
    const bin = await doFetch(meta.url, { headers: auth });
    if (!bin.ok) throw new Error(`whatsapp media download http ${bin.status}`);
    const mimeType = meta.mime_type ?? 'application/octet-stream';
    return {
      bytes: Buffer.from(await bin.arrayBuffer()),
      mimeType,
      fileName: `whatsapp-${mediaId}.${extFor(mimeType)}`,
    };
  }

  async sendText(to: string, body: string): Promise<SendTextResult> {
    const doFetch = this.opts.fetchImpl ?? (fetch as unknown as FetchLike);
    try {
      const res = await doFetch(`${GRAPH}/${this.opts.phoneNumberId}/messages`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${this.opts.accessToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          messaging_product: 'whatsapp',
          recipient_type: 'individual',
          to,
          type: 'text',
          text: { preview_url: false, body },
        }),
      });
      const raw = await res.text();
      if (!res.ok) return { ok: false, error: `whatsapp http ${res.status}: ${raw.slice(0, 200)}` };
      let id: string | undefined;
      try {
        id = (JSON.parse(raw) as { messages?: { id?: string }[] }).messages?.[0]?.id;
      } catch {
        // 2xx without parseable JSON — the send still succeeded.
      }
      return { ok: true, id };
    } catch (e) {
      return { ok: false, error: e instanceof Error ? e.message : 'whatsapp request failed' };
    }
  }
}

/** HMAC-SHA256 of the raw body keyed by the app secret, compared in constant time
 *  against the `sha256=...` header. Exported so the webhook route can reuse it. */
export function verifyWhatsappSignature(
  appSecret: string,
  rawBody: string,
  signatureHeader: string | null,
): boolean {
  if (!signatureHeader || !signatureHeader.startsWith('sha256=')) return false;
  const expected = createHmac('sha256', appSecret).update(rawBody, 'utf8').digest('hex');
  const got = signatureHeader.slice('sha256='.length);
  const a = Buffer.from(expected, 'hex');
  const b = Buffer.from(got, 'hex');
  if (a.length !== b.length || a.length === 0) return false;
  return timingSafeEqual(a, b);
}

/** Logs instead of calling Meta; parsing/verification still work. Used until a
 *  WhatsApp token is configured. Media download is unavailable (throws). */
export class NoopWhatsappAdapter implements WhatsappAdapter {
  constructor(private readonly verifyToken = '') {}
  verifyWebhook(params: { mode?: string; token?: string; challenge?: string }): string | null {
    if (this.verifyToken && params.mode === 'subscribe' && params.token === this.verifyToken) {
      return params.challenge ?? '';
    }
    return null;
  }
  // Without an app secret we can't validate — reject so unverified posts never pass.
  verifySignature(): boolean {
    return false;
  }
  parseInbound(body: unknown): WhatsappInboundMessage[] {
    return parseWhatsappInbound(body);
  }
  downloadMedia(): Promise<WhatsappMedia> {
    return Promise.reject(new Error('whatsapp not configured: cannot download media'));
  }
  sendText(to: string, body: string): Promise<SendTextResult> {
    console.log(`[whatsapp:noop] would send to ${to}: ${body.slice(0, 80)}`);
    return Promise.resolve({ ok: true });
  }
}

export interface WhatsappEnv {
  WHATSAPP_ACCESS_TOKEN?: string;
  WHATSAPP_PHONE_NUMBER_ID?: string;
  WHATSAPP_APP_SECRET?: string;
  WHATSAPP_VERIFY_TOKEN?: string;
  [key: string]: string | undefined;
}

/** Real adapter when token + phone id + app secret are set, else the no-op. */
export function createWhatsappAdapter(env: WhatsappEnv = process.env): WhatsappAdapter {
  if (env.WHATSAPP_ACCESS_TOKEN && env.WHATSAPP_PHONE_NUMBER_ID && env.WHATSAPP_APP_SECRET) {
    return new MetaWhatsappAdapter({
      accessToken: env.WHATSAPP_ACCESS_TOKEN,
      phoneNumberId: env.WHATSAPP_PHONE_NUMBER_ID,
      appSecret: env.WHATSAPP_APP_SECRET,
      verifyToken: env.WHATSAPP_VERIFY_TOKEN ?? '',
    });
  }
  return new NoopWhatsappAdapter(env.WHATSAPP_VERIFY_TOKEN ?? '');
}
