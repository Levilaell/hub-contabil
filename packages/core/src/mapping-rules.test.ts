import { describe, expect, it } from 'vitest';

import {
  isMappingRuleLevel,
  resolveMappingRule,
  type MappingRule,
} from './mapping-rules';

// The CFOP case (T19) is the first domain: a specific rule (origin CFOP + supplier
// CNPJ) overrides a general one (origin CFOP, any supplier). These tests pin the
// precedence chain and the pending fallback, independent of any CFOP specifics.

const SPECIFIC: MappingRule = {
  id: 'r-specific',
  domain: 'cfop',
  level: 1,
  key: { originCfop: '1102', supplierCnpj: '12345678000199' },
  value: { entryCfop: '1556' },
};
const GENERAL: MappingRule = {
  id: 'r-general',
  domain: 'cfop',
  level: 2,
  key: { originCfop: '1102', supplierCnpj: null },
  value: { entryCfop: '1102' },
};

describe('resolveMappingRule', () => {
  it('returns pending when there are no rules', () => {
    expect(resolveMappingRule([], 'cfop', { originCfop: '1102' })).toEqual({ status: 'pending' });
  });

  it('prefers a level-1 (specific) rule over a level-2 (general) one', () => {
    const res = resolveMappingRule([GENERAL, SPECIFIC], 'cfop', {
      originCfop: '1102',
      supplierCnpj: '12345678000199',
    });
    expect(res).toMatchObject({ status: 'matched', value: { entryCfop: '1556' }, level: 1 });
  });

  it('falls back to the level-2 (general) rule for a different supplier', () => {
    const res = resolveMappingRule([SPECIFIC, GENERAL], 'cfop', {
      originCfop: '1102',
      supplierCnpj: '99999999000100',
    });
    expect(res).toMatchObject({ status: 'matched', value: { entryCfop: '1102' }, level: 2 });
  });

  it('is pending when no rule constrains the origin CFOP at all', () => {
    const res = resolveMappingRule([SPECIFIC, GENERAL], 'cfop', { originCfop: '5102' });
    expect(res).toEqual({ status: 'pending' });
  });

  it('ignores rules from another domain', () => {
    const other: MappingRule = {
      domain: 'account',
      level: 1,
      key: { originCfop: '1102' },
      value: { entryCfop: 'X' },
    };
    expect(resolveMappingRule([other], 'cfop', { originCfop: '1102' })).toEqual({
      status: 'pending',
    });
  });

  it('a general rule (null supplier) matches regardless of the query supplier', () => {
    const a = resolveMappingRule([GENERAL], 'cfop', { originCfop: '1102', supplierCnpj: 'A' });
    const b = resolveMappingRule([GENERAL], 'cfop', { originCfop: '1102' });
    expect(a).toMatchObject({ status: 'matched', level: 2 });
    expect(b).toMatchObject({ status: 'matched', level: 2 });
  });

  it('is order-independent: same inputs, same result whatever the array order', () => {
    const query = { originCfop: '1102', supplierCnpj: '12345678000199' };
    const forward = resolveMappingRule([SPECIFIC, GENERAL], 'cfop', query);
    const reverse = resolveMappingRule([GENERAL, SPECIFIC], 'cfop', query);
    expect(forward).toEqual(reverse);
  });

  it('trims string keys before comparing', () => {
    const res = resolveMappingRule([SPECIFIC], 'cfop', {
      originCfop: ' 1102 ',
      supplierCnpj: '12345678000199',
    });
    expect(res).toMatchObject({ status: 'matched', level: 1 });
  });
});

describe('isMappingRuleLevel', () => {
  it('accepts only 1 and 2', () => {
    expect(isMappingRuleLevel(1)).toBe(true);
    expect(isMappingRuleLevel(2)).toBe(true);
    expect(isMappingRuleLevel(3)).toBe(false);
    expect(isMappingRuleLevel('1')).toBe(false);
  });
});
