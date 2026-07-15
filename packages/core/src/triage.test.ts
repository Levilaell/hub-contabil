import { describe, expect, it } from 'vitest';

import { decideTriage, detectImplausibleType, routeDepartment } from './triage';

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

  it('sends an implausible suggestion to the exception queue regardless of confidence', () => {
    expect(
      decideTriage({ ...base, confidence: 1, implausibility: { rule: 'xml_native' } }),
    ).toEqual({ decision: 'exception', reason: 'implausible_type' });
  });

  it('prefers company_not_found over implausible_type (company is the most actionable fix)', () => {
    expect(
      decideTriage({ ...base, companyFound: false, implausibility: { rule: 'xml_native' } }).reason,
    ).toBe('company_not_found');
  });

  it('prefers implausible_type over low_confidence', () => {
    expect(
      decideTriage({ ...base, confidence: 0.1, implausibility: { rule: 'xml_native' } }).reason,
    ).toBe('implausible_type');
  });
});

describe('detectImplausibleType', () => {
  const terms = {
    boleto: ['boleto'],
    fatura: ['boleto', 'card_statement'],
    extrato: ['bank_statement', 'card_statement'],
    holerite: ['payslip'],
    comprovante: ['payment_receipt'],
  };

  it('flags an XML-native type suggested for a PDF (the DANFE case)', () => {
    expect(
      detectImplausibleType({ docType: 'nfe', fileName: 'danfe-123.pdf', fileNameTerms: terms }),
    ).toEqual({ rule: 'xml_native' });
  });

  it.each(['nfe', 'nfce', 'cte'])('covers every XML-native type (%s)', (docType) => {
    expect(
      detectImplausibleType({ docType, fileName: 'scan.jpg', fileNameTerms: terms })?.rule,
    ).toBe('xml_native');
  });

  it('accepts an XML-native type for an actual XML file', () => {
    expect(
      detectImplausibleType({ docType: 'nfe', fileName: 'nota.XML', fileNameTerms: terms }),
    ).toBeNull();
  });

  it('exempts nfse from the XML-native rule (city halls issue PDFs)', () => {
    expect(
      detectImplausibleType({
        docType: 'nfse',
        fileName: 'nfse-prefeitura.pdf',
        fileNameTerms: terms,
      }),
    ).toBeNull();
  });

  it('flags a filename term conflicting with the suggestion (boleto classified as nfe... via term)', () => {
    expect(
      detectImplausibleType({
        docType: 'nfse',
        fileName: 'FATURA_claro123.pdf',
        fileNameTerms: terms,
      }),
    ).toEqual({
      rule: 'filename_term',
      term: 'fatura',
      expectedTypes: ['boleto', 'card_statement'],
    });
  });

  it('accepts a filename term matching the suggestion', () => {
    expect(
      detectImplausibleType({
        docType: 'boleto',
        fileName: 'boleto-julho.pdf',
        fileNameTerms: terms,
      }),
    ).toBeNull();
  });

  it('matches terms accent- and case-insensitively', () => {
    expect(
      detectImplausibleType({
        docType: 'other',
        fileName: 'EXTRATO-conta.pdf',
        fileNameTerms: { ...terms, extrato: ['bank_statement'] },
      })?.term,
    ).toBe('extrato');
  });

  it('returns null when nothing matches', () => {
    expect(
      detectImplausibleType({ docType: 'das', fileName: 'das-2026-07.pdf', fileNameTerms: terms }),
    ).toBeNull();
  });

  it('ignores empty terms (defensive against sloppy config)', () => {
    expect(
      detectImplausibleType({
        docType: 'das',
        fileName: 'a.pdf',
        fileNameTerms: { '': ['boleto'] },
      }),
    ).toBeNull();
  });
});
