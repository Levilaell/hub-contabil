// ImapInboundAdapter (golden rule #3): generic IMAP inbox monitoring as an inbound
// channel. Attachments → AI triage; text-only e-mails → support tickets. Used only
// by the worker's poll cron (pull, not webhook). `imapflow` and `mailparser` are
// loaded lazily via a runtime import so this package builds and the web app bundles
// without them — they're pulled in only when IMAP is actually configured. The
// factory returns the real adapter when IMAP_* env is set, else a no-op (empty
// fetch), so the worker runs without an inbox wired.

export interface InboundAttachment {
  fileName: string;
  mimeType: string;
  bytes: Buffer;
}

export interface InboundEmail {
  /** IMAP UID — the idempotency key (with the firm + channel) for inbound_messages. */
  uid: number;
  from: string;
  subject: string;
  text: string;
  attachments: InboundAttachment[];
}

export interface ImapInboundAdapter {
  /** Fetch unseen messages from the folder (does not mark them seen). */
  fetchUnseen(opts: { folder: string; limit?: number }): Promise<InboundEmail[]>;
  /** Mark messages processed (\Seen) so the next poll skips them. */
  markSeen(opts: { folder: string; uids: number[] }): Promise<void>;
}

export interface ImapAdapterOptions {
  host: string;
  port: number;
  secure: boolean;
  user: string;
  password: string;
}

// Minimal structural types for the lazily-loaded libs (kept local so the package
// compiles without them installed; `import('x' as string)` skips compile-time
// module resolution).
interface ImapFlowLike {
  connect(): Promise<void>;
  logout(): Promise<void>;
  getMailboxLock(folder: string): Promise<{ release(): void }>;
  fetch(
    query: unknown,
    opts: unknown,
  ): AsyncIterable<{ uid: number; source: Buffer }>;
  messageFlagsAdd(query: unknown, flags: string[], opts: unknown): Promise<unknown>;
}
interface ParsedMail {
  from?: { text?: string };
  subject?: string;
  text?: string;
  attachments?: { filename?: string; contentType?: string; content: Buffer }[];
}

export class ImapFlowInboundAdapter implements ImapInboundAdapter {
  constructor(private readonly opts: ImapAdapterOptions) {}

  private async open(): Promise<ImapFlowLike> {
    const mod = (await import('imapflow' as string)) as {
      ImapFlow: new (cfg: unknown) => ImapFlowLike;
    };
    const client = new mod.ImapFlow({
      host: this.opts.host,
      port: this.opts.port,
      secure: this.opts.secure,
      auth: { user: this.opts.user, pass: this.opts.password },
      logger: false,
    });
    await client.connect();
    return client;
  }

  async fetchUnseen(opts: { folder: string; limit?: number }): Promise<InboundEmail[]> {
    const { simpleParser } = (await import('mailparser' as string)) as {
      simpleParser: (source: Buffer) => Promise<ParsedMail>;
    };
    const client = await this.open();
    const limit = opts.limit ?? 25;
    const out: InboundEmail[] = [];
    const lock = await client.getMailboxLock(opts.folder);
    try {
      for await (const msg of client.fetch({ seen: false }, { uid: true, source: true })) {
        const parsed = await simpleParser(msg.source);
        out.push({
          uid: msg.uid,
          from: parsed.from?.text ?? '',
          subject: parsed.subject ?? '',
          text: parsed.text ?? '',
          attachments: (parsed.attachments ?? [])
            .filter((a) => a.content && a.content.length > 0)
            .map((a, i) => ({
              fileName: a.filename ?? `anexo-${msg.uid}-${i}`,
              mimeType: a.contentType ?? 'application/octet-stream',
              bytes: a.content,
            })),
        });
        if (out.length >= limit) break;
      }
    } finally {
      lock.release();
    }
    await client.logout();
    return out;
  }

  async markSeen(opts: { folder: string; uids: number[] }): Promise<void> {
    if (opts.uids.length === 0) return;
    const client = await this.open();
    const lock = await client.getMailboxLock(opts.folder);
    try {
      await client.messageFlagsAdd({ uid: opts.uids.join(',') }, ['\\Seen'], { uid: true });
    } finally {
      lock.release();
    }
    await client.logout();
  }
}

/** No inbox: returns nothing. Used until IMAP is configured. */
export class NoopImapInboundAdapter implements ImapInboundAdapter {
  fetchUnseen(): Promise<InboundEmail[]> {
    return Promise.resolve([]);
  }
  markSeen(): Promise<void> {
    return Promise.resolve();
  }
}

export interface ImapEnv {
  IMAP_HOST?: string;
  IMAP_PORT?: string;
  IMAP_USER?: string;
  IMAP_PASSWORD?: string;
  IMAP_SECURE?: string;
  [key: string]: string | undefined;
}

export function imapConfigured(env: ImapEnv = process.env): boolean {
  return Boolean(env.IMAP_HOST && env.IMAP_USER && env.IMAP_PASSWORD);
}

/** Real adapter when host + user + password are set, else the no-op. */
export function createImapInboundAdapter(env: ImapEnv = process.env): ImapInboundAdapter {
  if (imapConfigured(env)) {
    return new ImapFlowInboundAdapter({
      host: env.IMAP_HOST!,
      port: env.IMAP_PORT ? Number(env.IMAP_PORT) : 993,
      secure: env.IMAP_SECURE ? env.IMAP_SECURE === 'true' : true,
      user: env.IMAP_USER!,
      password: env.IMAP_PASSWORD!,
    });
  }
  return new NoopImapInboundAdapter();
}
