import type { SupabaseClient } from '@supabase/supabase-js';

// Firm user directory (READ side). Uses the caller's RLS-scoped client, so it only
// ever returns users of the caller's own firm. Privileged mutations (create / change
// role / set departments / remove) need the service-role Admin API and live in the web
// layer — see apps/web/src/app/(app)/configuracoes/usuarios/actions.ts.

export type UserRole = 'owner' | 'manager' | 'staff';

export interface FirmUser {
  id: string;
  email: string;
  fullName: string | null;
  role: UserRole;
  departments: string[];
}

export function isUserRole(value: string): value is UserRole {
  return value === 'owner' || value === 'manager' || value === 'staff';
}

interface UserRow {
  id: string;
  email: string;
  full_name: string | null;
  role: string;
}

export async function listFirmUsers(supabase: SupabaseClient): Promise<FirmUser[]> {
  const { data, error } = await supabase
    .from('users')
    .select('id, email, full_name, role')
    .order('role', { ascending: true })
    .order('email', { ascending: true });
  if (error || !data) return [];
  const rows = data as UserRow[];

  const byUser = new Map<string, string[]>();
  const ids = rows.map((u) => u.id);
  if (ids.length > 0) {
    const { data: deps } = await supabase
      .from('user_departments')
      .select('user_id, department')
      .in('user_id', ids);
    for (const d of (deps as { user_id: string; department: string }[] | null) ?? []) {
      const arr = byUser.get(d.user_id) ?? [];
      arr.push(d.department);
      byUser.set(d.user_id, arr);
    }
  }

  return rows.map((u) => ({
    id: u.id,
    email: u.email,
    fullName: u.full_name,
    role: isUserRole(u.role) ? u.role : 'staff',
    departments: byUser.get(u.id) ?? [],
  }));
}
