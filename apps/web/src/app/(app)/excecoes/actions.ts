'use server';

import { resolveException } from '@hub/db';
import { revalidatePath } from 'next/cache';

import { createClient } from '@/lib/supabase/server';

export type ResolveActionState = { ok: boolean; message: string } | null;

export async function resolveExceptionAction(
  id: string,
  status: 'resolved' | 'ignored',
  note: string,
): Promise<ResolveActionState> {
  const supabase = await createClient();
  const result = await resolveException(supabase, id, status, note || undefined);
  if (!result.ok) return { ok: false, message: result.message };
  // 'layout' scope so the sidebar open-count badge refreshes too, not just the list.
  revalidatePath('/excecoes', 'layout');
  return { ok: true, message: '' };
}
