import { z } from 'zod';

// Audit trail (golden rule #7): every relevant action — human or robot — writes
// to audit_events. This builder is PURE (core does no IO): it validates the
// input and returns the snake_case row; the caller (web/worker) performs the
// insert with its own client, so RLS / firm_id filtering stays at the boundary.

export const auditEventInputSchema = z.object({
  firmId: z.string().uuid(),
  /** The acting user, or null for a robot/system action. */
  actorId: z.string().uuid().nullable().default(null),
  /** What happened, e.g. "company.created", "request.viewed". */
  action: z.string().min(1),
  /** The entity kind, e.g. "company", "task". */
  entity: z.string().min(1),
  entityId: z.string().uuid().nullable().default(null),
  context: z.record(z.string(), z.unknown()).default({}),
});

export type AuditEventInput = z.input<typeof auditEventInputSchema>;

/** JSON value — structurally matches Supabase's generated `Json` type. */
export type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[];

/** Row shape ready to insert into public.audit_events (snake_case, JSON context). */
export interface AuditEventRow {
  firm_id: string;
  actor_id: string | null;
  action: string;
  entity: string;
  entity_id: string | null;
  context: Json;
}

export function buildAuditEvent(input: AuditEventInput): AuditEventRow {
  const parsed = auditEventInputSchema.parse(input);
  return {
    firm_id: parsed.firmId,
    actor_id: parsed.actorId,
    action: parsed.action,
    entity: parsed.entity,
    entity_id: parsed.entityId,
    context: parsed.context as Json,
  };
}
