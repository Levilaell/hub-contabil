import type { SupabaseClient } from '@supabase/supabase-js';

// Shared helper for the human (web) write path: resolve the caller's own firm.
// RLS scopes `firms` to a single visible row, so `.single()` returns that firm —
// giving us the firm_id to stamp on inserts and the config for validation.

export interface CurrentFirm {
  id: string;
  config: unknown;
}

export async function loadFirm(supabase: SupabaseClient): Promise<CurrentFirm | null> {
  const { data, error } = await supabase.from('firms').select('id, config').limit(1).single();
  if (error || !data) return null;
  return { id: data.id, config: data.config };
}
