import { z } from 'zod';

// Every job payload carries firm_id (golden rule #1) — enforced structurally:
// a payload without it fails validation and can never be processed. Per-queue
// schemas extend the base; their domain fields fill in with each feature task
// (triage T20, export T22, notifications T17).
export const basePayloadSchema = z.object({
  firm_id: z.string().uuid(),
});
export type BasePayload = z.infer<typeof basePayloadSchema>;

export const triagePayloadSchema = basePayloadSchema.extend({
  document_id: z.string().uuid(),
});
export type TriagePayload = z.infer<typeof triagePayloadSchema>;

export const exportPayloadSchema = basePayloadSchema.extend({
  batch_id: z.string().uuid(),
});
export type ExportPayload = z.infer<typeof exportPayloadSchema>;

export const notificationPayloadSchema = basePayloadSchema.extend({
  channel: z.string().min(1),
  to: z.string().min(1),
  template: z.string().min(1),
  data: z.record(z.string(), z.unknown()).default({}),
});

export const enrichmentPayloadSchema = basePayloadSchema.extend({
  company_id: z.string().uuid(),
});
export type EnrichmentPayload = z.infer<typeof enrichmentPayloadSchema>;

// Inbound channel pipeline (entrada via WhatsApp/IMAP): the webhook records the
// message and enqueues its id; the worker downloads media / routes it to triage,
// support, or the exception queue. IMAP runs end-to-end in its poll cron, so it
// does not use this queue.
export const inboundPayloadSchema = basePayloadSchema.extend({
  inbound_id: z.string().uuid(),
});
export type InboundPayload = z.infer<typeof inboundPayloadSchema>;

// Support (atendimento): 'inbound' = a new client message to handle with the AI;
// 'deliver' = send a queued outbound message (a human's reply) over the channel.
export const supportPayloadSchema = basePayloadSchema.extend({
  ticket_id: z.string().uuid(),
  message_id: z.string().uuid(),
  kind: z.enum(['inbound', 'deliver']),
});
export type SupportPayload = z.infer<typeof supportPayloadSchema>;

export const QUEUES = {
  triage: 'triage',
  export: 'export',
  notifications: 'notifications',
  enrichment: 'enrichment',
  inbound: 'inbound',
  support: 'support',
} as const;

export type QueueName = (typeof QUEUES)[keyof typeof QUEUES];
