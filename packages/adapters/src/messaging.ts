// MessagingAdapter (PLANEJAMENTO §8, golden rule #3). v1 shipped a no-op; T17 adds
// the real `resend-email` implementation. Deadline alerts (T15) and document-request
// delivery (T17) send through this interface. The factory picks Resend when a key is
// configured, else falls back to the no-op — so the rest of the app is identical
// whether or not e-mail is wired.

export interface EmailMessage {
  to: string;
  subject: string;
  /** Plain-text body. */
  body: string;
  /** Optional HTML body (used by the real adapter; ignored by the no-op). */
  html?: string;
}

export type SendResult = { ok: true; id?: string } | { ok: false; error: string };

export interface MessagingAdapter {
  sendEmail(message: EmailMessage): Promise<SendResult>;
}

/** No-op: logs and reports success without sending. Used until RESEND is configured. */
export class NoopMessagingAdapter implements MessagingAdapter {
  sendEmail(message: EmailMessage): Promise<SendResult> {
    console.log(`[messaging:noop] would e-mail ${message.to}: ${message.subject}`);
    return Promise.resolve({ ok: true });
  }
}

// Minimal structural shape of fetch we use — lets tests inject a fake without
// pulling in DOM types (same approach as the CNPJ adapter).
type FetchResponse = { ok: boolean; status: number; text: () => Promise<string> };
type FetchInit = { method: string; headers: Record<string, string>; body: string };
type FetchLike = (url: string, init: FetchInit) => Promise<FetchResponse>;

export interface ResendAdapterOptions {
  apiKey: string;
  /** Verified sender, e.g. "Escritório Demo <no-reply@demo.example>". */
  from: string;
  fetchImpl?: FetchLike;
}

/** Sends through Resend's REST API (no SDK dependency). */
export class ResendMessagingAdapter implements MessagingAdapter {
  constructor(private readonly opts: ResendAdapterOptions) {}

  async sendEmail(message: EmailMessage): Promise<SendResult> {
    const doFetch = this.opts.fetchImpl ?? (fetch as unknown as FetchLike);
    try {
      const res = await doFetch('https://api.resend.com/emails', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${this.opts.apiKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          from: this.opts.from,
          to: message.to,
          subject: message.subject,
          text: message.body,
          ...(message.html ? { html: message.html } : {}),
        }),
      });
      const raw = await res.text();
      if (!res.ok) return { ok: false, error: `resend http ${res.status}: ${raw.slice(0, 200)}` };
      let id: string | undefined;
      try {
        id = (JSON.parse(raw) as { id?: string }).id;
      } catch {
        // body wasn't JSON; the send still succeeded (2xx).
      }
      return { ok: true, id };
    } catch (e) {
      return { ok: false, error: e instanceof Error ? e.message : 'resend request failed' };
    }
  }
}

export interface MessagingEnv {
  RESEND_API_KEY?: string;
  RESEND_FROM?: string;
  // Index signature so process.env (NodeJS.ProcessEnv) is assignable as the default.
  [key: string]: string | undefined;
}

/** Resend when a key + sender are configured, else the no-op. Used by web and worker. */
export function createMessagingAdapter(env: MessagingEnv = process.env): MessagingAdapter {
  if (env.RESEND_API_KEY && env.RESEND_FROM) {
    return new ResendMessagingAdapter({ apiKey: env.RESEND_API_KEY, from: env.RESEND_FROM });
  }
  return new NoopMessagingAdapter();
}
