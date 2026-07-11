import { describe, expect, it } from 'vitest';

import {
  brazilPhoneKey,
  brazilPhoneMatches,
  formatBrazilPhone,
  classifyInboundKind,
  decideInboundRouting,
  isInboundChannel,
  normalizeInboundEmail,
  normalizeInboundPhone,
} from './inbound';

describe('classifyInboundKind', () => {
  it('treats any attachment as a document, even with a caption', () => {
    expect(classifyInboundKind({ hasAttachment: true, text: '' })).toBe('document');
    expect(classifyInboundKind({ hasAttachment: true, text: 'segue a nota' })).toBe('document');
  });

  it('treats text without an attachment as a question', () => {
    expect(classifyInboundKind({ hasAttachment: false, text: 'qual o valor do DAS?' })).toBe(
      'question',
    );
  });

  it('treats an empty message as unknown', () => {
    expect(classifyInboundKind({ hasAttachment: false, text: '   ' })).toBe('unknown');
  });
});

describe('decideInboundRouting', () => {
  it('sends documents to triage', () => {
    expect(decideInboundRouting({ hasAttachment: true, text: '' })).toEqual({
      target: 'triage',
      kind: 'document',
      reason: 'has_attachment',
    });
  });

  it('sends questions to support', () => {
    expect(decideInboundRouting({ hasAttachment: false, text: 'tenho uma dúvida' })).toEqual({
      target: 'support',
      kind: 'question',
      reason: 'has_text',
    });
  });

  it('sends empty messages to the exception queue (never dropped)', () => {
    expect(decideInboundRouting({ hasAttachment: false, text: '' })).toEqual({
      target: 'exception',
      kind: 'unknown',
      reason: 'empty',
    });
  });
});

describe('normalizeInboundPhone', () => {
  it('keeps digits only, preserving the country code', () => {
    expect(normalizeInboundPhone('+55 (13) 99999-0000')).toBe('5513999990000');
    expect(normalizeInboundPhone('5513999990000')).toBe('5513999990000');
  });
});

describe('brazilPhoneKey', () => {
  it('reduces every common way of writing the same mobile to one key', () => {
    const expected = { ddd: '13', last8: '99990000' };
    expect(brazilPhoneKey('5513999990000')).toEqual(expected); // wa_id, ninth digit
    expect(brazilPhoneKey('551399990000')).toEqual(expected); // wa_id, pre-ninth-digit account
    expect(brazilPhoneKey('+55 (13) 99999-0000')).toEqual(expected);
    expect(brazilPhoneKey('(13) 99999-0000')).toEqual(expected); // no country code
    expect(brazilPhoneKey('13 9999-0000')).toEqual(expected); // no country code, no ninth digit
    expect(brazilPhoneKey('013 99999-0000')).toEqual(expected); // carrier trunk zero
    expect(brazilPhoneKey('0055 13 99999.0000')).toEqual(expected); // international prefix, dots
  });

  it('keeps the DDD null when the number was saved without one', () => {
    expect(brazilPhoneKey('99999-0000')).toEqual({ ddd: null, last8: '99990000' });
    expect(brazilPhoneKey('9999-0000')).toEqual({ ddd: null, last8: '99990000' });
  });

  it('does not mistake DDD 55 for the country code', () => {
    expect(brazilPhoneKey('55 99999-0000')).toEqual({ ddd: '55', last8: '99990000' });
    expect(brazilPhoneKey('+55 55 99999-0000')).toEqual({ ddd: '55', last8: '99990000' });
  });

  it('rejects what cannot be read as a Brazilian number', () => {
    expect(brazilPhoneKey('1234567')).toBeNull(); // too short
    expect(brazilPhoneKey('4930901820000')).toBeNull(); // German number: 11+ digits left
    expect(brazilPhoneKey('0999990000')).toBeNull(); // "DDD" 09 is impossible
    expect(brazilPhoneKey('')).toBeNull();
  });
});

describe('brazilPhoneMatches', () => {
  it('matches the wa_id against a contact saved without the country code', () => {
    expect(brazilPhoneMatches('5513999990000', '(13) 99999-0000')).toBe(true);
  });

  it('matches across the ninth digit in either direction', () => {
    expect(brazilPhoneMatches('551399990000', '+55 (13) 99999-0000')).toBe(true);
    expect(brazilPhoneMatches('5513999990000', '13 9999-0000')).toBe(true);
  });

  it('matches a contact saved without DDD by the line alone', () => {
    expect(brazilPhoneMatches('5513999990000', '99999-0000')).toBe(true);
  });

  it('does not match a different DDD or a different line', () => {
    expect(brazilPhoneMatches('5513999990000', '(11) 99999-0000')).toBe(false);
    expect(brazilPhoneMatches('5513999990000', '(13) 99999-0001')).toBe(false);
  });

  it('falls back to exact digit equality for non-Brazilian numbers', () => {
    expect(brazilPhoneMatches('4930901820000', '+49 30 901820000')).toBe(true);
    expect(brazilPhoneMatches('4930901820000', '4930901820001')).toBe(false);
    expect(brazilPhoneMatches('', '')).toBe(false);
  });
});

describe('formatBrazilPhone (T34)', () => {
  it('formats mobile and landline numbers, with and without country code', () => {
    expect(formatBrazilPhone('5513999990000')).toBe('+55 (13) 99999-0000');
    expect(formatBrazilPhone('13999990000')).toBe('(13) 99999-0000');
    expect(formatBrazilPhone('1332320000')).toBe('(13) 3232-0000');
    expect(formatBrazilPhone('999990000')).toBe('99999-0000');
    expect(formatBrazilPhone('32320000')).toBe('3232-0000');
  });

  it('falls back to the raw string when digits are unusable', () => {
    expect(formatBrazilPhone('sem numero')).toBe('sem numero');
    expect(formatBrazilPhone('4930901820000')).toBe('4930901820000'); // non-BR length
  });
});

describe('normalizeInboundEmail', () => {
  it('extracts the address from a display-name header and lowercases it', () => {
    expect(normalizeInboundEmail('Maria Rocha <Maria@Example.COM>')).toBe('maria@example.com');
    expect(normalizeInboundEmail('  PLAIN@X.com ')).toBe('plain@x.com');
  });
});

describe('isInboundChannel', () => {
  it('recognizes the supported channels', () => {
    expect(isInboundChannel('whatsapp')).toBe(true);
    expect(isInboundChannel('imap')).toBe(true);
    expect(isInboundChannel('telegram')).toBe(false);
  });
});
