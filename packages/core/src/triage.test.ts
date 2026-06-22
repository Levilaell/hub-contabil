import { describe, expect, it } from 'vitest';

import { decideTriage, routeDepartment } from './triage';

describe('routeDepartment', () => {
  const map = { nfe: 'fiscal', bank_statement: 'contabil' };

  it('maps a known type to its department', () => {
    expect(routeDepartment(map, 'nfe')).toBe('fiscal');
  });

  it('returns null for an unmapped type', () => {
    expect(routeDepartment(map, 'other')).toBeNull();
  });
});

describe('decideTriage', () => {
  const base = { confidence: 0.95, threshold: 0.85, companyFound: true, department: 'fiscal' };

  it('files a confident, resolved, routable document', () => {
    expect(decideTriage(base)).toEqual({ decision: 'file', reason: 'ok' });
  });

  it('sends low-confidence to the exception queue', () => {
    expect(decideTriage({ ...base, confidence: 0.5 })).toEqual({
      decision: 'exception',
      reason: 'low_confidence',
    });
  });

  it('sends an unknown company to the exception queue (before checking confidence)', () => {
    expect(decideTriage({ ...base, companyFound: false, confidence: 0.1 })).toEqual({
      decision: 'exception',
      reason: 'company_not_found',
    });
  });

  it('sends an unroutable type to the exception queue', () => {
    expect(decideTriage({ ...base, department: null })).toEqual({
      decision: 'exception',
      reason: 'no_route',
    });
  });

  it('treats confidence exactly at the threshold as confident enough', () => {
    expect(decideTriage({ ...base, confidence: 0.85 }).decision).toBe('file');
  });
});
