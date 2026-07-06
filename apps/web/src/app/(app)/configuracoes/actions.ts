'use server';

import { saveFirmConfig } from '@hub/db';
import { revalidatePath } from 'next/cache';

import { createClient } from '@/lib/supabase/server';

export type ConfigActionState = { ok: boolean; message: string } | null;

// Thin wrapper: parse the form, delegate to the tested saveFirmConfig chain
// (validate → persist → audit), revalidate. The real logic lives in @hub/db.
// FAQ textarea format: one entry per line, "Pergunta | Resposta". Lines without
// the separator are ignored (empty answer would fail config validation anyway).
function parseFaq(raw: string): { q: string; a: string }[] {
  return raw
    .split('\n')
    .map((line) => {
      const idx = line.indexOf('|');
      if (idx < 0) return null;
      const q = line.slice(0, idx).trim();
      const a = line.slice(idx + 1).trim();
      return q && a ? { q, a } : null;
    })
    .filter((e): e is { q: string; a: string } => e !== null);
}

// Reception menu textarea format: one option per line, "Rótulo | departamento".
// Unknown department keys are dropped server-side in saveFirmConfig.
function parseReceptionOptions(raw: string): { label: string; department: string }[] {
  return raw
    .split('\n')
    .map((line) => {
      const idx = line.indexOf('|');
      if (idx < 0) return null;
      const label = line.slice(0, idx).trim();
      const department = line.slice(idx + 1).trim();
      return label && department ? { label, department } : null;
    })
    .filter((e): e is { label: string; department: string } => e !== null);
}

export async function updateFirmConfigAction(
  _prev: ConfigActionState,
  formData: FormData,
): Promise<ConfigActionState> {
  const deadlineDefaultDays = Number(formData.get('deadlineDefaultDays'));
  const aiThreshold = Number(formData.get('aiThreshold'));
  // An unchecked checkbox submits nothing → false.
  const supportAutoReply = formData.get('supportAutoReply') === 'on';
  const supportAiThreshold = Number(formData.get('supportAiThreshold'));
  const faqRaw = formData.get('supportFaq');
  const receptionOptionsRaw = formData.get('receptionOptions');
  const receptionGreeting = formData.get('receptionGreeting');

  const supabase = await createClient();
  const result = await saveFirmConfig(supabase, {
    deadlineDefaultDays,
    aiThreshold,
    supportAutoReply,
    supportAiThreshold,
    supportFaq: typeof faqRaw === 'string' ? parseFaq(faqRaw) : undefined,
    receptionEnabled: formData.get('receptionEnabled') === 'on',
    receptionGreeting: typeof receptionGreeting === 'string' ? receptionGreeting : undefined,
    receptionOptions:
      typeof receptionOptionsRaw === 'string'
        ? parseReceptionOptions(receptionOptionsRaw)
        : undefined,
  });

  if (result.ok) {
    revalidatePath('/configuracoes');
    return { ok: true, message: '' };
  }
  return { ok: false, message: result.message };
}
