'use server';

import type { NfeItem } from '@hub/core';
import { applyCfopResolution } from '@hub/db';
import { revalidatePath } from 'next/cache';

import { createClient } from '@/lib/supabase/server';

export interface CfopActionResult {
  applied: number;
  pending: number;
}

// Resolve a freshly uploaded NF-e's CFOPs against the firm's rules and write the
// result to documents.metadata.entry_cfop (T19). The XML is parsed client-side (the
// core parser is pure); this only receives the extracted issuer + items. Best-effort:
// returns null on failure so a CFOP hiccup never breaks the upload itself.
export async function applyCfopAction(
  documentId: string,
  issuerCnpj: string | null,
  items: NfeItem[],
): Promise<CfopActionResult | null> {
  if (!documentId || items.length === 0) return null;
  const supabase = await createClient();
  try {
    const result = await applyCfopResolution(supabase, { documentId, issuerCnpj, items });
    // Unmatched CFOPs become 'rules' pendings — refresh the exception badge.
    if (result.pending > 0) revalidatePath('/excecoes', 'layout');
    return { applied: result.applied, pending: result.pending };
  } catch {
    return null;
  }
}
