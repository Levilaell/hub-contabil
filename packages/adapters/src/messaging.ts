// MessagingAdapter (PLANEJAMENTO §8, golden rule #3). v1 ships a no-op that logs;
// the real `resend-email` implementation lands in T17. Deadline alerts (T15) and
// document-request delivery (T17) send through this interface.

export interface EmailMessage {
  to: string;
  subject: string;
  /** Plain-text body (HTML/templates can come with the real adapter). */
  body: string;
}

export type SendResult = { ok: true; id?: string } | { ok: false; error: string };

export interface MessagingAdapter {
  sendEmail(message: EmailMessage): Promise<SendResult>;
}

/** No-op: logs and reports success without sending. Until resend-email (T17). */
export class NoopMessagingAdapter implements MessagingAdapter {
  sendEmail(message: EmailMessage): Promise<SendResult> {
    console.log(`[messaging:noop] would e-mail ${message.to}: ${message.subject}`);
    return Promise.resolve({ ok: true });
  }
}
