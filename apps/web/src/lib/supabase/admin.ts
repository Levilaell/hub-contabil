import { createClient } from '@supabase/supabase-js';

// Service-role Supabase client — BYPASSES RLS. Import ONLY from 'use server'
// actions on the public request page (/s/[token]), and use ONLY for Storage
// operations the visitor can't do themselves (mint a signed upload/download URL
// for a token-derived path). The key has no NEXT_PUBLIC_ prefix, so Next leaves
// it undefined in client bundles — it cannot ship to the browser even if this
// module is mis-imported. Every data mutation still goes through the token-keyed
// SECURITY DEFINER RPCs; this client never reads/writes domain tables directly.
export function createAdminClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } },
  );
}
