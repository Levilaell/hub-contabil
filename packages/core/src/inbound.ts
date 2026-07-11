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

export interface BrazilPhoneKey {
  /** Area code (DDD), or null when the number was saved without one. */
  ddd: string | null;
  /** Last 8 subscriber digits — stable across every prefix variation. */
  last8: string;
}

/**
 * Canonical comparison key for a Brazilian phone number, tolerant to how people
 * actually type them: formatting (+, parens, dashes, dots, spaces), the international
 * dialing prefix (00), the country code (55), the carrier trunk zero before the DDD,
 * and the mobile ninth digit — WhatsApp wa_ids of accounts created before the
 * ninth-digit rollout still omit it. `last8` survives all of those because every
 * variation is a PREFIX; the DDD is kept separately so numbers that only share the
 * line don't match across area codes. Returns null when the digits can't be read as
 * a Brazilian number (too short/long after stripping, or an impossible DDD) —
 * callers should then fall back to exact digit equality.
 */
export function brazilPhoneKey(raw: string): BrazilPhoneKey | null {
  let digits = raw.replace(/\D/g, '');
  if (digits.startsWith('00')) digits = digits.slice(2);
  // Country code only when enough digits remain for DDD + line; an 11-digit
  // number starting with 55 is a DDD-55 (RS) mobile, not a country code.
  if (digits.length >= 12 && digits.startsWith('55')) digits = digits.slice(2);
  if ((digits.length === 11 || digits.length === 12) && digits.startsWith('0')) {
    digits = digits.slice(1);
  }
  if (digits.length < 8 || digits.length > 11) return null;
  const ddd = digits.length >= 10 ? digits.slice(0, 2) : null;
  if (ddd && !/^[1-9][1-9]$/.test(ddd)) return null; // no Brazilian DDD contains 0
  return { ddd, last8: digits.slice(-8) };
}

/**
 * pt-BR display form for a stored/inbound phone (T34): "+55 (13) 99999-0000".
 * Falls back to the raw string when the digits don't look like a phone. Pure
 * presentation — storage stays digits-only (normalizeInboundPhone).
 */
export function formatBrazilPhone(raw: string): string {
  let d = raw.replace(/\D/g, '');
  if (!d) return raw;
  let cc = '';
  if (d.length >= 12 && d.startsWith('55')) {
    cc = '+55 ';
    d = d.slice(2);
  }
  if (d.length === 11) return `${cc}(${d.slice(0, 2)}) ${d.slice(2, 7)}-${d.slice(7)}`;
  if (d.length === 10) return `${cc}(${d.slice(0, 2)}) ${d.slice(2, 6)}-${d.slice(6)}`;
  if (d.length === 9) return `${cc}${d.slice(0, 5)}-${d.slice(5)}`;
  if (d.length === 8) return `${cc}${d.slice(0, 4)}-${d.slice(4)}`;
  return raw;
}

/**
 * Whether two phone numbers refer to the same Brazilian line. A missing DDD on
 * either side matches any DDD (a contact saved as "99999-0000" still resolves);
 * when neither side parses as Brazilian, falls back to exact digit equality.
 */
export function brazilPhoneMatches(a: string, b: string): boolean {
  const keyA = brazilPhoneKey(a);
  const keyB = brazilPhoneKey(b);
  if (!keyA || !keyB) {
    const digitsA = normalizeInboundPhone(a);
    return digitsA.length > 0 && digitsA === normalizeInboundPhone(b);
  }
  if (keyA.last8 !== keyB.last8) return false;
  return !keyA.ddd || !keyB.ddd || keyA.ddd === keyB.ddd;
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
