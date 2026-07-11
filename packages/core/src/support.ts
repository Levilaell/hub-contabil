// Support ticket state machine + AI-response decision (atendimento). Pure — the
// single source of truth for valid transitions and for when the AI may answer; the
// web UI and the worker both call these so they never disagree. A ticket models a
// client conversation that arrives by WhatsApp. The AI answers trivial questions
// with the firm's own context and escalates the rest — it NEVER decides alone
// (golden rule #5): auto-reply off, out of scope, or low confidence all fall to a
// human. The LLM call lives behind SupportAssistantAdapter; this module has no IO.

export const SUPPORT_STATUSES = ['open', 'pending', 'escalated', 'resolved'] as const;
export type SupportStatus = (typeof SUPPORT_STATUSES)[number];

// open: new/unhandled (a human or the AI must act).
// pending: we replied, awaiting the client.
// escalated: the AI couldn't handle it — a human must take over.
// resolved: closed; a new client message reopens it.
const TRANSITIONS: Record<SupportStatus, SupportStatus[]> = {
  open: ['pending', 'escalated', 'resolved'],
  pending: ['open', 'escalated', 'resolved'],
  escalated: ['pending', 'resolved'],
  resolved: ['open'],
};

export function isSupportStatus(value: string): value is SupportStatus {
  return (SUPPORT_STATUSES as readonly string[]).includes(value);
}

export function allowedSupportTransitions(from: SupportStatus): SupportStatus[] {
  return TRANSITIONS[from] ?? [];
}

export function canTransitionSupport(from: SupportStatus, to: SupportStatus): boolean {
  return TRANSITIONS[from]?.includes(to) ?? false;
}

/**
 * Where a ticket lands when the client sends a new message. An escalated ticket
 * stays escalated (a human is already on the hook); anything else becomes `open`
 * so it resurfaces for handling — including reopening a resolved conversation.
 */
export function statusAfterInbound(status: SupportStatus): SupportStatus {
  return status === 'escalated' ? 'escalated' : 'open';
}

// Who currently owns the conversation (T27). 'ai' = the assistant may engage;
// 'human' = a person took over — via escalation or a human reply — and every
// automated message (assistant AND reception menu) stays silent until an explicit
// hand-back ("Devolver para IA"). Resolving resets it to 'ai' so a fresh
// conversation weeks later is AI-first again.
export const SUPPORT_HANDLERS = ['ai', 'human'] as const;
export type SupportHandler = (typeof SUPPORT_HANDLERS)[number];

export function isSupportHandler(value: string): value is SupportHandler {
  return (SUPPORT_HANDLERS as readonly string[]).includes(value);
}

/**
 * May the assistant (and the reception menu) engage on a new client message?
 * Silent whenever a human owns the ticket — explicitly (`handledBy` 'human') or
 * implicitly (status 'escalated', which by definition awaits a human). The worker
 * MUST check this before any LLM call; the hand-back RPC flips `handledBy` back
 * to 'ai' (and escalated → pending) to re-enable the assistant.
 */
export function assistantMayEngage(input: {
  status: SupportStatus;
  handledBy: SupportHandler;
}): boolean {
  return input.handledBy === 'ai' && input.status !== 'escalated';
}

// Statuses that still need someone's attention (the /atendimento default view and
// the sidebar count badge use this).
export const OPEN_SUPPORT_STATUSES: SupportStatus[] = ['open', 'escalated'];

export function isOpenSupport(status: SupportStatus): boolean {
  return OPEN_SUPPORT_STATUSES.includes(status);
}

export type SupportAction = 'ai_reply' | 'escalate';
export type SupportReason = 'ok' | 'auto_reply_disabled' | 'out_of_scope' | 'low_confidence';

export interface SupportDecisionInput {
  /** Firm config: is AI auto-reply switched on at all? */
  autoReplyEnabled: boolean;
  /** Did the assistant judge the question to be within the firm's declared scope? */
  inScope: boolean;
  confidence: number;
  threshold: number;
}

export interface SupportDecision {
  action: SupportAction;
  reason: SupportReason;
}

/**
 * Decide whether the AI may answer or the ticket must escalate to a human. Order
 * matters and all roads but one lead to a human: disabled → out of scope → low
 * confidence → (only then) reply. The AI never answers an ambiguous case alone.
 */
export function decideSupportResponse(input: SupportDecisionInput): SupportDecision {
  if (!input.autoReplyEnabled) return { action: 'escalate', reason: 'auto_reply_disabled' };
  if (!input.inScope) return { action: 'escalate', reason: 'out_of_scope' };
  if (input.confidence < input.threshold) return { action: 'escalate', reason: 'low_confidence' };
  return { action: 'ai_reply', reason: 'ok' };
}

// WhatsApp's free "service" window: a reply within 24h of the client's last
// message costs nothing; outside it a paid template is required. Pure ms math
// (timestamps in, never Date.now()), so the worker/UI can flag the paid case.
export const SERVICE_WINDOW_MS = 24 * 60 * 60 * 1000;

export function isWithin24hWindow(lastInboundAtIso: string, nowIso: string): boolean {
  const last = new Date(lastInboundAtIso).getTime();
  const now = new Date(nowIso).getTime();
  if (!Number.isFinite(last) || !Number.isFinite(now)) return false;
  return now - last <= SERVICE_WINDOW_MS && now >= last;
}
