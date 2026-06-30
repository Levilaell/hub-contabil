// Inbound channel routing (entrada via WhatsApp/e-mail). Pure: given a normalized
// inbound message (channel-agnostic), decide where it goes — AI triage (it carries
// a document), the support queue (it's a text question), or the exception queue
// (we can't tell). The channel adapters (WhatsApp Cloud, IMAP) normalize their raw
// payloads into this shape; this module has no IO. Golden rule #5/#6: nothing is
// dropped — an undecidable message becomes a human-visible exception. The same
// decision runs for both channels so they never diverge.

export const INBOUND_CHANNELS = ['whatsapp', 'imap'] as const;
export type InboundChannel = (typeof INBOUND_CHANNELS)[number];

export type InboundKind = 'document' | 'question' | 'unknown';
export type InboundTarget = 'triage' | 'support' | 'exception';
export type InboundReason = 'has_attachment' | 'has_text' | 'empty';

export function isInboundChannel(value: string): value is InboundChannel {
  return (INBOUND_CHANNELS as readonly string[]).includes(value);
}

export interface InboundClassifyInput {
  /** The message carried at least one file (a document/photo of a note). */
  hasAttachment: boolean;
  /** The message's text body / caption. */
  text: string;
}

/**
 * What kind of inbound this is. An attachment wins — a photo of a note with a
 * caption is still a document for triage; the caption is only context. Text with
 * no attachment is a question for support. Nothing at all is unknown.
 */
export function classifyInboundKind(input: InboundClassifyInput): InboundKind {
  if (input.hasAttachment) return 'document';
  if (input.text.trim().length > 0) return 'question';
  return 'unknown';
}

export interface InboundRouteOutcome {
  target: InboundTarget;
  kind: InboundKind;
  reason: InboundReason;
}

/**
 * Route a classified inbound. A document goes to AI triage (which resolves the
 * company from the document's own CNPJ, regardless of who sent it); a question
 * opens/continues a support ticket; an empty/unrecognized message falls to a human
 * in the exception queue rather than being silently discarded.
 */
export function decideInboundRouting(input: InboundClassifyInput): InboundRouteOutcome {
  const kind = classifyInboundKind(input);
  if (kind === 'document') return { target: 'triage', kind, reason: 'has_attachment' };
  if (kind === 'question') return { target: 'support', kind, reason: 'has_text' };
  return { target: 'exception', kind, reason: 'empty' };
}

/** Phone identifier from a WhatsApp wa_id / number: digits only (keeps country code). */
export function normalizeInboundPhone(raw: string): string {
  return raw.replace(/\D/g, '');
}

/**
 * E-mail identifier from a possibly display-name-wrapped From header
 * ("Fulano <f@x.com>" → "f@x.com"), lowercased and trimmed.
 */
export function normalizeInboundEmail(raw: string): string {
  const angle = raw.match(/<([^>]+)>/);
  const addr = (angle ? angle[1] : raw) ?? raw;
  return addr.trim().toLowerCase();
}
