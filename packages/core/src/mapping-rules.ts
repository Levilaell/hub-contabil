// Mapping-rules resolution engine (T18, PLANEJAMENTO §M9). A generic precedence
// resolver: per domain (e.g. 'cfop'), a structured `key` maps to a `value`. Rules
// carry a precedence level — 1 (specific) beats 2 (general) — and a partial key: a
// rule matches a query when every field it constrains equals the query's. No match
// is NOT a rule, it is the exception queue ("level 3"): the caller queues a pending
// (golden rule #5 — ambiguity never auto-decides). Pure: no IO, no Date/random.

export type MappingRuleLevel = 1 | 2;

/** A stored mapping rule. `key`/`value` are domain-shaped JSON (CFOP lands in T19). */
export interface MappingRule {
  id?: string;
  domain: string;
  level: MappingRuleLevel;
  key: Record<string, unknown>;
  value: Record<string, unknown>;
}

export type RuleMatch = {
  status: 'matched';
  value: Record<string, unknown>;
  level: MappingRuleLevel;
  ruleId?: string;
};
export type RuleResolution = RuleMatch | { status: 'pending' };

export const MAPPING_RULE_LEVELS: readonly MappingRuleLevel[] = [1, 2] as const;

export function isMappingRuleLevel(value: unknown): value is MappingRuleLevel {
  return value === 1 || value === 2;
}

// A field constrains the match only when the rule sets it to a non-empty value.
// null/undefined/'' means "any" — that is how a level-2 (general) rule omits the
// supplier and matches every supplier.
function constrains(value: unknown): boolean {
  return value !== null && value !== undefined && value !== '';
}

function normalize(value: unknown): string {
  return typeof value === 'string' ? value.trim() : String(value);
}

/** Does every field the rule constrains equal the query's value? */
function keyMatches(
  ruleKey: Record<string, unknown>,
  queryKey: Record<string, unknown>,
): boolean {
  for (const [field, ruleValue] of Object.entries(ruleKey)) {
    if (!constrains(ruleValue)) continue;
    if (!constrains(queryKey[field])) return false;
    if (normalize(ruleValue) !== normalize(queryKey[field])) return false;
  }
  return true;
}

/** How many fields a rule actually constrains — its specificity within a level. */
function specificity(rule: MappingRule): number {
  return Object.values(rule.key).filter(constrains).length;
}

// Deterministic last-resort tiebreak so the result never depends on input order.
function tiebreak(rule: MappingRule): string {
  return rule.id ?? JSON.stringify(rule.key);
}

/**
 * Resolve a query key against a firm's rules for one domain. Precedence:
 *   level 1 (specific) → level 2 (general) → no match = pending.
 * Within a level the more specific rule (more constrained fields) wins; remaining
 * ties break deterministically, so identical inputs always yield identical output.
 */
export function resolveMappingRule(
  rules: MappingRule[],
  domain: string,
  queryKey: Record<string, unknown>,
): RuleResolution {
  const best = rules
    .filter((rule) => rule.domain === domain && keyMatches(rule.key, queryKey))
    .sort(
      (a, b) =>
        a.level - b.level ||
        specificity(b) - specificity(a) ||
        tiebreak(a).localeCompare(tiebreak(b)),
    )[0];

  if (!best) return { status: 'pending' };
  return { status: 'matched', value: best.value, level: best.level, ruleId: best.id };
}
