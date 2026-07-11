import { parseFirmConfig, validateFirmConfig } from '@hub/config';
import type { SupabaseClient } from '@supabase/supabase-js';

// The real config-save chain: validate (pt-BR on failure) → persist → audit.
// Kept as a plain function (not buried in a Server Action) so it can be tested
// directly against the cloud. The web Server Action is a thin wrapper.

export interface FirmConfigEdits {
  deadlineDefaultDays: number;
  aiThreshold: number;
  // Atendimento (support). Optional so existing callers (the deadline/AI form) keep
  // working unchanged; when present they patch the support block.
  supportAutoReply?: boolean;
  supportAiThreshold?: number;
  supportAiModel?: string;
  supportFaq?: { q: string; a: string }[];
  receptionEnabled?: boolean;
  receptionGreeting?: string;
  receptionOptions?: { label: string; department: string }[];
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
  // Reception options only reference known departments (same stance as routingMap).
  const departmentKeys = new Set(current.departments.map((d) => d.key));
  const receptionOptions = edits.receptionOptions?.filter((o) => departmentKeys.has(o.department));
  const candidate = {
    ...current,
    deadlineTriggers: { ...current.deadlineTriggers, defaultDays: edits.deadlineDefaultDays },
    aiThreshold: edits.aiThreshold,
    support: {
      ...current.support,
      ...(edits.supportAutoReply !== undefined ? { autoReply: edits.supportAutoReply } : {}),
      ...(edits.supportAiThreshold !== undefined ? { aiThreshold: edits.supportAiThreshold } : {}),
      ...(edits.supportAiModel !== undefined && edits.supportAiModel.trim()
        ? { aiModel: edits.supportAiModel.trim() }
        : {}),
      ...(edits.supportFaq !== undefined ? { faq: edits.supportFaq } : {}),
      reception: {
        ...current.support.reception,
        ...(edits.receptionEnabled !== undefined ? { enabled: edits.receptionEnabled } : {}),
        ...(edits.receptionGreeting !== undefined && edits.receptionGreeting.trim()
          ? { greeting: edits.receptionGreeting.trim() }
          : {}),
        ...(receptionOptions !== undefined ? { options: receptionOptions } : {}),
      },
    },
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

// Advanced vocabularies: departments, document taxonomy, and the type→department
// routing map. Same chain (validate → persist → audit). The routing map is cleaned to
// only reference known types/departments so it can never drift out of the vocabularies.
export interface AdvancedConfigEdits {
  departments: { key: string; label: string }[];
  taxonomy: string[];
  routingMap: Record<string, string>;
}

export async function saveAdvancedConfig(
  supabase: SupabaseClient,
  edits: AdvancedConfigEdits,
): Promise<SaveFirmConfigResult> {
  const { data: firm, error: readError } = await supabase
    .from('firms')
    .select('id, config')
    .limit(1)
    .single();
  if (readError || !firm) {
    return { ok: false, message: 'Não foi possível carregar a configuração.' };
  }

  const current = parseFirmConfig(firm.config);
  const departments = edits.departments
    .map((d) => ({ key: d.key.trim(), label: d.label.trim() }))
    .filter((d) => d.key && d.label);
  const taxonomy = [...new Set(edits.taxonomy.map((t) => t.trim()).filter(Boolean))];

  const deptKeys = new Set(departments.map((d) => d.key));
  const routingMap: Record<string, string> = {};
  for (const [type, dept] of Object.entries(edits.routingMap)) {
    if (taxonomy.includes(type) && deptKeys.has(dept)) routingMap[type] = dept;
  }

  const candidate = { ...current, departments, taxonomy, routingMap };
  const validation = validateFirmConfig(candidate);
  if (!validation.success) {
    return { ok: false, message: validation.message };
  }

  const { data: updated, error: updateError } = await supabase
    .from('firms')
    .update({ config: validation.data })
    .eq('id', firm.id)
    .select('id');
  if (updateError || !updated || updated.length === 0) {
    return { ok: false, message: 'Não foi possível salvar — verifique suas permissões.' };
  }

  await supabase.rpc('log_audit', {
    p_action: 'firm.config.updated',
    p_entity: 'firm',
    p_entity_id: firm.id,
    p_context: {
      departments: departments.length,
      taxonomy: taxonomy.length,
      routes: Object.keys(routingMap).length,
    },
  });

  return { ok: true };
}
