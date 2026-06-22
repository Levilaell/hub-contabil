// AI triage decision logic (T20). Pure: given a classification's confidence, the
// firm's threshold, whether the company was resolved, and the routed department,
// decide whether to FILE the document automatically or send it to the exception
// queue. Golden rule #5: the AI never decides alone on ambiguous cases — low
// confidence, an unknown company, or an unroutable type all fall to a human with a
// pre-filled suggestion. The LLM call itself lives behind ClassificationAdapter;
// this module has no IO.

export type TriageDecision = 'file' | 'exception';
export type TriageReason = 'ok' | 'low_confidence' | 'company_not_found' | 'no_route';

export interface TriageInput {
  confidence: number;
  threshold: number;
  companyFound: boolean;
  /** Department resolved from the routing map, or null when the type has no route. */
  department: string | null;
}

export interface TriageOutcome {
  decision: TriageDecision;
  reason: TriageReason;
}

/** Map a document type to its department via the firm's routing map (config). */
export function routeDepartment(
  routingMap: Record<string, string>,
  docType: string,
): string | null {
  const dept = routingMap[docType];
  return typeof dept === 'string' && dept.length > 0 ? dept : null;
}

/**
 * Decide the triage outcome. Order matters: an unknown company is the most
 * actionable signal for a human, then low confidence, then an unroutable type.
 * Only a confident, resolved, routable document is filed automatically.
 */
export function decideTriage(input: TriageInput): TriageOutcome {
  if (!input.companyFound) return { decision: 'exception', reason: 'company_not_found' };
  if (input.confidence < input.threshold) return { decision: 'exception', reason: 'low_confidence' };
  if (!input.department) return { decision: 'exception', reason: 'no_route' };
  return { decision: 'file', reason: 'ok' };
}
