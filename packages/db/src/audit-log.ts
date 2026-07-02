import type { SupabaseClient } from '@supabase/supabase-js';

// Audit trail (READ side). RLS scopes audit_events to the caller's own firm; writes
// are server-only (log_audit RPC / service role). Actor is resolved to a display name
// here (null actor = a robot/system action).

export interface AuditEvent {
  id: string;
  action: string;
  entity: string;
  entityId: string | null;
  actorName: string | null; // null → system/robot
  context: Record<string, unknown>;
  createdAt: string;
}

export interface AuditFilter {
  limit?: number;
  entity?: string;
}

interface Row {
  id: string;
  action: string;
  entity: string;
  entity_id: string | null;
  actor_id: string | null;
  context: unknown;
  created_at: string;
}

function asObject(value: unknown): Record<string, unknown> {
  if (typeof value === 'string') {
    try {
      return JSON.parse(value) as Record<string, unknown>;
    } catch {
      return {};
    }
  }
  return value && typeof value === 'object' ? (value as Record<string, unknown>) : {};
}

export async function listAuditEvents(
  supabase: SupabaseClient,
  filter: AuditFilter = {},
): Promise<AuditEvent[]> {
  let query = supabase
    .from('audit_events')
    .select('id, action, entity, entity_id, actor_id, context, created_at')
    .order('created_at', { ascending: false })
    .limit(filter.limit ?? 100);
  if (filter.entity) query = query.eq('entity', filter.entity);

  const { data, error } = await query;
  if (error || !data) return [];
  const rows = data as Row[];

  // Resolve actor ids → display names in one lookup (RLS keeps it firm-scoped).
  const actorIds = [...new Set(rows.map((r) => r.actor_id).filter((v): v is string => !!v))];
  const nameById = new Map<string, string>();
  if (actorIds.length > 0) {
    const { data: users } = await supabase
      .from('users')
      .select('id, full_name, email')
      .in('id', actorIds);
    for (const u of (users as { id: string; full_name: string | null; email: string }[] | null) ??
      []) {
      nameById.set(u.id, u.full_name || u.email);
    }
  }

  return rows.map((r) => ({
    id: r.id,
    action: r.action,
    entity: r.entity,
    entityId: r.entity_id,
    actorName: r.actor_id ? (nameById.get(r.actor_id) ?? null) : null,
    context: asObject(r.context),
    createdAt: r.created_at,
  }));
}
