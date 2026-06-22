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

export const QUEUES = {
  triage: 'triage',
  export: 'export',
  notifications: 'notifications',
  enrichment: 'enrichment',
} as const;

export type QueueName = (typeof QUEUES)[keyof typeof QUEUES];
