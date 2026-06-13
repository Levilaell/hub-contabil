import { parseFirmConfig, validateFirmConfig } from '@hub/config';
import type { SupabaseClient } from '@supabase/supabase-js';

// The real config-save chain: validate (pt-BR on failure) → persist → audit.
// Kept as a plain function (not buried in a Server Action) so it can be tested
// directly against the cloud. The web Server Action is a thin wrapper.

export interface FirmConfigEdits {
  deadlineDefaultDays: number;
  aiThreshold: number;
}

export type SaveFirmConfigResult = { ok: true } | { ok: false; message: string };

export async function saveFirmConfig(
  supabase: SupabaseClient,
  edits: FirmConfigEdits,
): Promise<SaveFirmConfigResult> {
  // RLS scopes firms to the caller's own firm.
  const { data: firm, error: readError } = await supabase
    .from('firms')
    .select('id, config')
    .limit(1)
    .single();
  if (readError || !firm) {
    return { ok: false, message: 'Não foi possível carregar a configuração.' };
  }

  const current = parseFirmConfig(firm.config);
  const candidate = {
    ...current,
    deadlineTriggers: { ...current.deadlineTriggers, defaultDays: edits.deadlineDefaultDays },
    aiThreshold: edits.aiThreshold,
  };

  const validation = validateFirmConfig(candidate);
  if (!validation.success) {
    return { ok: false, message: validation.message };
  }

  // RLS silently filters a forbidden UPDATE to zero rows (no error), so confirm a
  // row was actually written — otherwise a staff user would get a false success.
  const { data: updated, error: updateError } = await supabase
    .from('firms')
    .update({ config: validation.data })
    .eq('id', firm.id)
    .select('id');
  if (updateError || !updated || updated.length === 0) {
    return { ok: false, message: 'Não foi possível salvar — verifique suas permissões.' };
  }

  // Human action → audit via the privileged RPC (stamps the real actor/firm).
  await supabase.rpc('log_audit', {
    p_action: 'firm.config.updated',
    p_entity: 'firm',
    p_entity_id: firm.id,
    p_context: { deadlineDefaultDays: edits.deadlineDefaultDays, aiThreshold: edits.aiThreshold },
  });

  return { ok: true };
}
