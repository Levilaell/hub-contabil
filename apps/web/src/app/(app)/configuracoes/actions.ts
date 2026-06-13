'use server';

import { saveFirmConfig } from '@hub/db';
import { revalidatePath } from 'next/cache';

import { createClient } from '@/lib/supabase/server';

export type ConfigActionState = { ok: boolean; message: string } | null;

// Thin wrapper: parse the form, delegate to the tested saveFirmConfig chain
// (validate → persist → audit), revalidate. The real logic lives in @hub/db.
export async function updateFirmConfigAction(
  _prev: ConfigActionState,
  formData: FormData,
): Promise<ConfigActionState> {
  const deadlineDefaultDays = Number(formData.get('deadlineDefaultDays'));
  const aiThreshold = Number(formData.get('aiThreshold'));

  const supabase = await createClient();
  const result = await saveFirmConfig(supabase, { deadlineDefaultDays, aiThreshold });

  if (result.ok) {
    revalidatePath('/configuracoes');
    return { ok: true, message: '' };
  }
  return { ok: false, message: result.message };
}
