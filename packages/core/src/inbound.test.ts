import { describe, expect, it } from 'vitest';

import {
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
