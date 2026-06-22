import {
  resolveMappingRule,
  type MappingRule,
  type MappingRuleLevel,
  type RuleResolution,
} from '@hub/core';
import type { SupabaseClient } from '@supabase/supabase-js';

import { loadFirm } from './firm';

// Mapping-rules data access (T18). Resolution itself is the pure core engine; this
// layer loads the firm's rules (RLS-scoped), persists CRUD, and owns the pending
// path. firm_id is stamped on every write (golden rule #1). The no-match case queues
// a single pending in the exception queue via the queue_rules_exception RPC.

export type RuleOrigin = 'manual' | 'resolution';

export interface MappingRuleRecord extends MappingRule {
  id: string;
  origin: RuleOrigin;
  createdAt: string;
}

export interface MappingRuleInput {
  domain: string;
  level: MappingRuleLevel;
  key: Record<string, unknown>;
  value: Record<string, unknown>;
  origin?: RuleOrigin;
}

interface MappingRuleRow {
  id: string;
  domain: string;
  level: number;
  key: unknown;
  value: unknown;
  origin: string;
  created_at: string;
}

export type RuleMutationResult = { ok: true; id: string } | { ok: false; message: string };

export type ResolveOutcome =
  | { status: 'matched'; value: Record<string, unknown>; level: MappingRuleLevel; ruleId?: string }
  | { status: 'pending'; exceptionId: string };

const SELECT = 'id, domain, level, key, value, origin, created_at';

function fail(message: string): { ok: false; message: string } {
  return { ok: false, message };
}

function asObject(value: unknown): Record<string, unknown> {
  return value && typeof value === 'object' && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};
}

function mapRule(row: MappingRuleRow): MappingRuleRecord {
  return {
    id: row.id,
    domain: row.domain,
    level: row.level === 1 ? 1 : 2,
    key: asObject(row.key),
    value: asObject(row.value),
    origin: row.origin === 'resolution' ? 'resolution' : 'manual',
    createdAt: row.created_at,
  };
}

export async function listMappingRules(
  supabase: SupabaseClient,
  opts?: { domain?: string },
): Promise<MappingRuleRecord[]> {
  let query = supabase.from('mapping_rules').select(SELECT);
  if (opts?.domain) query = query.eq('domain', opts.domain);
  const { data, error } = await query
    .order('level', { ascending: true })
    .order('created_at', { ascending: false });
  if (error || !data) return [];
  return (data as MappingRuleRow[]).map(mapRule);
}

export async function createMappingRule(
  supabase: SupabaseClient,
  input: MappingRuleInput,
): Promise<RuleMutationResult> {
  const firm = await loadFirm(supabase);
  if (!firm) return fail('Não foi possível identificar o escritório.');
  if (!input.domain.trim()) return fail('Informe o domínio da regra.');
  if (input.level !== 1 && input.level !== 2) return fail('Nível inválido.');

  const { data, error } = await supabase
    .from('mapping_rules')
    .insert({
      firm_id: firm.id,
      domain: input.domain.trim(),
      level: input.level,
      key: input.key,
      value: input.value,
      origin: input.origin ?? 'manual',
    })
    .select('id')
    .single();
  if (error || !data) {
    if (error?.code === '23505') return fail('Já existe uma regra igual (mesmo nível e chave).');
    return fail('Não foi possível salvar a regra.');
  }

  await supabase.rpc('log_audit', {
    p_action: 'mapping_rule.created',
    p_entity: 'mapping_rule',
    p_entity_id: data.id,
    p_context: { domain: input.domain, level: input.level, origin: input.origin ?? 'manual' },
  });
  return { ok: true, id: data.id };
}

export async function updateMappingRule(
  supabase: SupabaseClient,
  id: string,
  edits: {
    level?: MappingRuleLevel;
    key?: Record<string, unknown>;
    value?: Record<string, unknown>;
  },
): Promise<RuleMutationResult> {
  const patch: Record<string, unknown> = {};
  if (edits.level !== undefined) patch.level = edits.level;
  if (edits.key !== undefined) patch.key = edits.key;
  if (edits.value !== undefined) patch.value = edits.value;
  if (Object.keys(patch).length === 0) return { ok: true, id };

  const { data, error } = await supabase
    .from('mapping_rules')
    .update(patch)
    .eq('id', id)
    .select('id');
  if (error || !data || data.length === 0) {
    if (error?.code === '23505') return fail('Já existe uma regra igual (mesmo nível e chave).');
    return fail('Não foi possível atualizar — verifique suas permissões.');
  }

  await supabase.rpc('log_audit', {
    p_action: 'mapping_rule.updated',
    p_entity: 'mapping_rule',
    p_entity_id: id,
    p_context: patch,
  });
  return { ok: true, id };
}

export async function deleteMappingRule(
  supabase: SupabaseClient,
  id: string,
): Promise<RuleMutationResult> {
  const { data, error } = await supabase.from('mapping_rules').delete().eq('id', id).select('id');
  if (error || !data || data.length === 0) {
    return fail('Não foi possível remover — verifique suas permissões.');
  }
  await supabase.rpc('log_audit', {
    p_action: 'mapping_rule.deleted',
    p_entity: 'mapping_rule',
    p_entity_id: id,
    p_context: {},
  });
  return { ok: true, id };
}

/**
 * Resolve `key` for `domain` against the firm's rules. On a hit, returns the value.
 * On a miss, queues ONE pending in the exception queue (source 'rules', collapsing
 * identical open pendings) and returns its id. `suggestion`/`context` enrich the
 * exception drawer for the human (golden rule #5). The caller decides what to do with
 * a matched value (e.g. write documents.metadata.entry_cfop in T19).
 */
export async function resolveOrQueue(
  supabase: SupabaseClient,
  args: {
    domain: string;
    key: Record<string, unknown>;
    suggestion?: Record<string, unknown>;
    context?: Record<string, unknown>;
  },
): Promise<ResolveOutcome> {
  const rules = await listMappingRules(supabase, { domain: args.domain });
  const resolution: RuleResolution = resolveMappingRule(rules, args.domain, args.key);
  if (resolution.status === 'matched') {
    return {
      status: 'matched',
      value: resolution.value,
      level: resolution.level,
      ruleId: resolution.ruleId,
    };
  }

  const { data, error } = await supabase.rpc('queue_rules_exception', {
    p_context: { domain: args.domain, key: args.key, ...(args.context ?? {}) },
    p_suggestion: args.suggestion ?? {},
  });
  if (error || !data) {
    // Surfacing the failure beats silently dropping the case (golden rule #6).
    throw new Error('Não foi possível registrar a pendência da regra.');
  }
  return { status: 'pending', exceptionId: data as string };
}

/**
 * Save a rule while resolving a pending, then mark that pending resolved. The new
 * rule auto-resolves the next identical case — the next resolveOrQueue for the same
 * key matches it instead of queueing again (T18 acceptance).
 */
export async function saveResolutionAsRule(
  supabase: SupabaseClient,
  args: { exceptionId: string; input: MappingRuleInput; note?: string },
): Promise<RuleMutationResult> {
  const created = await createMappingRule(supabase, { ...args.input, origin: 'resolution' });
  if (!created.ok) return created;

  const { error } = await supabase.rpc('resolve_exception', {
    p_id: args.exceptionId,
    p_status: 'resolved',
    p_note: args.note ?? 'Regra criada a partir da pendência.',
  });
  if (error) {
    return fail('Regra criada, mas não foi possível concluir a pendência — resolva-a manualmente.');
  }
  return created;
}
