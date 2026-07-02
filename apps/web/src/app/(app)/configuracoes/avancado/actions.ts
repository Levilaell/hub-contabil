'use server';

import { saveAdvancedConfig } from '@hub/db';
import { revalidatePath } from 'next/cache';

import { createClient } from '@/lib/supabase/server';

export type AdvancedActionState = { ok: boolean; message: string } | null;

// Thin wrapper over the tested saveAdvancedConfig chain (validate → persist → audit).
// RLS enforces the owner/manager restriction on the firms UPDATE — a staff user gets a
// zero-row write and the pt-BR "verifique suas permissões" message.
export async function updateAdvancedConfigAction(payload: {
  departments: { key: string; label: string }[];
  taxonomy: string[];
  routingMap: Record<string, string>;
}): Promise<AdvancedActionState> {
  const supabase = await createClient();
  const result = await saveAdvancedConfig(supabase, payload);
  if (!result.ok) return { ok: false, message: result.message };
  revalidatePath('/configuracoes/avancado');
  revalidatePath('/configuracoes');
  return { ok: true, message: '' };
}
