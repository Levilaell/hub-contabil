import { describe, expect, it } from 'vitest';

import { formatCnpj, isValidCnpj, normalizeCnpj } from './cnpj';

// 11.222.333/0001-81 and 00.000.000/0001-91 are well-known structurally valid CNPJs.
const VALID = '11222333000181';
const VALID_MASKED = '11.222.333/0001-81';

describe('normalizeCnpj', () => {
  it('strips mask characters to the 14-digit form', () => {
    expect(normalizeCnpj(VALID_MASKED)).toBe(VALID);
  });
  it('leaves an already-normalized value untouched', () => {
    expect(normalizeCnpj(VALID)).toBe(VALID);
  });
});

describe('formatCnpj', () => {
  it('formats a 14-digit value with the standard mask', () => {
    expect(formatCnpj(VALID)).toBe(VALID_MASKED);
    expect(formatCnpj(VALID_MASKED)).toBe(VALID_MASKED);
  });
  it('returns the digits unchanged when not 14 long', () => {
    expect(formatCnpj('1122233300018')).toBe('1122233300018');
  });
});

describe('isValidCnpj', () => {
  it('accepts valid CNPJs, masked or raw', () => {
    expect(isValidCnpj(VALID)).toBe(true);
    expect(isValidCnpj(VALID_MASKED)).toBe(true);
    expect(isValidCnpj('00.000.000/0001-91')).toBe(true);
  });
  it('rejects a wrong check digit', () => {
    expect(isValidCnpj('11222333000180')).toBe(false);
  });
  it('rejects the wrong length', () => {
    expect(isValidCnpj('1122233300018')).toBe(false);
    expect(isValidCnpj('112223330001810')).toBe(false);
  });
  it('rejects repeated-digit placeholders', () => {
    expect(isValidCnpj('00000000000000')).toBe(false);
    expect(isValidCnpj('11111111111111')).toBe(false);
  });
  it('rejects non-numeric garbage', () => {
    expect(isValidCnpj('not-a-cnpj')).toBe(false);
    expect(isValidCnpj('')).toBe(false);
  });
});
