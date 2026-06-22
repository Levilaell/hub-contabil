import { CFOP_DOMAIN, type NfeItem } from '@hub/core';
import type { SupabaseClient } from '@supabase/supabase-js';

import { resolveOrQueue } from './mapping-rules';

// CFOP resolution over NF-e items (T19). Glue between the deterministic NF-e parser
// (core) and the generic mapping-rules engine: each item's (origin CFOP + issuer
// CNPJ) resolves to an entry CFOP, written to documents.metadata.entry_cfop via the
// privileged RPC. The fiscal XML is never modified (golden rule #4).

export interface CfopEntry {
  nItem: number;
  originCfop: string;
  supplierCnpj: string | null;
  entryCfop: string | null;
  status: 'matched' | 'pending';
}

export interface CfopApplyResult {
  applied: number;
  pending: number;
  entries: CfopEntry[];
}

function asEntryCfop(value: unknown): string | null {
  if (typeof value === 'string') return value;
  if (typeof value === 'number') return String(value);
  return null;
}

/**
 * Resolve every NF-e item's CFOP against the firm's rules and write the results to
 * documents.metadata.entry_cfop. Matched items carry the entry CFOP; unmatched items
 * queue a pending (source 'rules') carrying the XML-derived key + a blank entryCfop
 * suggestion for the human, and the next identical case auto-resolves once a rule is
 * saved. Returns the per-item breakdown and matched/pending counts.
 */
export async function applyCfopResolution(
  supabase: SupabaseClient,
  args: { documentId: string; issuerCnpj: string | null; items: NfeItem[] },
): Promise<CfopApplyResult> {
  const supplierCnpj = args.issuerCnpj ?? null;
  const entries: CfopEntry[] = [];

  for (const item of args.items) {
    const outcome = await resolveOrQueue(supabase, {
      domain: CFOP_DOMAIN,
      key: { originCfop: item.cfop, supplierCnpj },
      suggestion: { entryCfop: '' },
      context: { documentId: args.documentId, nItem: item.nItem },
    });
    entries.push({
      nItem: item.nItem,
      originCfop: item.cfop,
      supplierCnpj,
      entryCfop: outcome.status === 'matched' ? asEntryCfop(outcome.value.entryCfop) : null,
      status: outcome.status,
    });
  }

  const { error } = await supabase.rpc('apply_cfop_metadata', {
    p_document_id: args.documentId,
    p_entries: entries,
  });
  if (error) throw new Error('Não foi possível gravar o CFOP de entrada no documento.');

  return {
    applied: entries.filter((e) => e.status === 'matched').length,
    pending: entries.filter((e) => e.status === 'pending').length,
    entries,
  };
}
