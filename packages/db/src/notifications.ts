import type { SupabaseClient } from '@supabase/supabase-js';

// In-app notifications (T10). Read-only for the web (RLS-scoped to the caller /
// their departments); created by the handoff RPC, marked read via RPC.

export interface NotificationItem {
  id: string;
  kind: string;
  title: string;
  body: string | null;
  entity: string | null;
  entityId: string | null;
  readAt: string | null;
  createdAt: string;
}

interface NotificationRow {
  id: string;
  kind: string;
  title: string;
  body: string | null;
  entity: string | null;
  entity_id: string | null;
  read_at: string | null;
  created_at: string;
}

function mapNotification(row: NotificationRow): NotificationItem {
  return {
    id: row.id,
    kind: row.kind,
    title: row.title,
    body: row.body,
    entity: row.entity,
    entityId: row.entity_id,
    readAt: row.read_at,
    createdAt: row.created_at,
  };
}

export async function listNotifications(
  supabase: SupabaseClient,
  opts?: { limit?: number },
): Promise<NotificationItem[]> {
  const { data, error } = await supabase
    .from('notifications')
    .select('id, kind, title, body, entity, entity_id, read_at, created_at')
    .order('created_at', { ascending: false })
    .limit(opts?.limit ?? 20);
  if (error || !data) return [];
  return (data as NotificationRow[]).map(mapNotification);
}

export async function countUnreadNotifications(supabase: SupabaseClient): Promise<number> {
  const { count, error } = await supabase
    .from('notifications')
    .select('id', { count: 'exact', head: true })
    .is('read_at', null);
  if (error) return 0;
  return count ?? 0;
}

export async function markNotificationRead(supabase: SupabaseClient, id: string): Promise<void> {
  await supabase.rpc('mark_notification_read', { p_id: id });
}
