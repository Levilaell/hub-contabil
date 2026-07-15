// AI triage decision logic (T20). Pure: given a classification's confidence, the
// firm's threshold, whether the company was resolved, and the routed department,
// decide whether to FILE the document automatically or send it to the exception
// queue. Golden rule #5: the AI never decides alone on ambiguous cases — low
// confidence, an unknown company, or an unroutable type all fall to a human with a
// pre-filled suggestion. The LLM call itself lives behind ClassificationAdapter;
// this module has no IO.

export type TriageDecision = 'file' | 'exception';
export type TriageReason =
  | 'ok'
  | 'low_confidence'
  | 'company_not_found'
  | 'no_route'
  | 'implausible_type';

/** Types that only exist as authorized fiscal XML — never plausible for a PDF/image.
 * `nfse` is deliberately absent: city halls issue NFS-e as PDF all the time. */
export const XML_NATIVE_TYPES = ['nfe', 'nfce', 'cte'] as const;

export interface Implausibility {
  rule: 'xml_native' | 'filename_term';
  /** filename_term only: the config term found in the file name. */
  term?: string;
  /** filename_term only: the doc types that term makes plausible. */
  expectedTypes?: string[];
}

export interface TriageInput {
  confidence: number;
  threshold: number;
  companyFound: boolean;
  /** Department resolved from the routing map, or null when the type has no route. */
  department: string | null;
  /** T36 deterministic guard result — null/undefined means the suggestion is plausible. */
  implausibility?: Implausibility | null;
}

export interface TriageOutcome {
  decision: TriageDecision;
  reason: TriageReason;
}

const stripAccents = (value: string): string => value.normalize('NFD').replace(/[̀-ͯ]/g, '');

/**
 * Deterministic plausibility guard (T36). Runs AFTER the AI classification and
 * BEFORE the filing decision; a hit means the suggestion is implausible no matter
 * how confident the model is, so the document must fall to a human with the
 * suggestion pre-filled (golden rule #5):
 *  - `xml_native`: an XML-native type suggested for a file that is not XML
 *    (the DANFE-as-PDF case — one human click beats auto-filing a boleto as nfe);
 *  - `filename_term`: the file name carries an unambiguous term of another type
 *    (config `fileNameTerms`, accent/case-insensitive) conflicting with the
 *    suggestion.
 * Callers must skip the guard for deterministically parsed documents (the NF-e
 * XML path is authoritative).
 */
export function detectImplausibleType(input: {
  docType: string;
  fileName: string;
  fileNameTerms: Record<string, string[]>;
}): Implausibility | null {
  const isXml = input.fileName.toLowerCase().endsWith('.xml');
  if (!isXml && (XML_NATIVE_TYPES as readonly string[]).includes(input.docType)) {
    return { rule: 'xml_native' };
  }
  const name = stripAccents(input.fileName.toLowerCase());
  for (const [term, expectedTypes] of Object.entries(input.fileNameTerms)) {
    const needle = stripAccents(term.toLowerCase().trim());
    if (!needle) continue;
    if (name.includes(needle) && !expectedTypes.includes(input.docType)) {
      return { rule: 'filename_term', term, expectedTypes };
    }
  }
  return null;
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
 * actionable signal for a human, then an implausible suggestion (which no
 * confidence can override — T36), then low confidence, then an unroutable type.
 * Only a confident, plausible, resolved, routable document is filed automatically.
 */
export function decideTriage(input: TriageInput): TriageOutcome {
  if (!input.companyFound) return { decision: 'exception', reason: 'company_not_found' };
  if (input.implausibility) return { decision: 'exception', reason: 'implausible_type' };
  if (input.confidence < input.threshold)
    return { decision: 'exception', reason: 'low_confidence' };
  if (!input.department) return { decision: 'exception', reason: 'no_route' };
  return { decision: 'file', reason: 'ok' };
}
