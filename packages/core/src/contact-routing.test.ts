import { describe, expect, it } from 'vitest';

import { suggestContactForDepartment } from './contact-routing';

function contact(name: string, departments: string[], isPrimary = false) {
  return { name, departments, isPrimary };
}

describe('suggestContactForDepartment', () => {
  it('prefers the contact tagged with the specific department over "Todos"', () => {
    const todos = contact('Geral', [], true);
    const fiscal = contact('Fiscal', ['fiscal']);
    expect(suggestContactForDepartment([todos, fiscal], 'fiscal')).toBe(fiscal);
  });

  it('falls back to a "Todos" contact when no one serves the department', () => {
    const todos = contact('Geral', []);
    const dp = contact('DP', ['dp']);
    expect(suggestContactForDepartment([dp, todos], 'fiscal')).toBe(todos);
  });

  it('prefers the primary contact within the same tier', () => {
    const a = contact('A', ['fiscal']);
    const b = contact('B', ['fiscal'], true);
    expect(suggestContactForDepartment([a, b], 'fiscal')).toBe(b);
  });

  it('keeps input order as the final tiebreak', () => {
    const a = contact('A', ['fiscal']);
    const b = contact('B', ['fiscal']);
    expect(suggestContactForDepartment([a, b], 'fiscal')).toBe(a);
  });

  it('uses the "Todos" tier when no department is given', () => {
    const fiscal = contact('Fiscal', ['fiscal'], true);
    const todos = contact('Geral', []);
    expect(suggestContactForDepartment([fiscal, todos], null)).toBe(todos);
  });

  it('falls back to primary-first over everyone as a last resort', () => {
    const fiscal = contact('Fiscal', ['fiscal']);
    const dp = contact('DP', ['dp'], true);
    expect(suggestContactForDepartment([fiscal, dp], 'contabil')).toBe(dp);
  });

  it('returns null for an empty list', () => {
    expect(suggestContactForDepartment([], 'fiscal')).toBeNull();
  });

  it('a contact serving multiple departments counts as specific for each', () => {
    const multi = contact('Multi', ['fiscal', 'dp']);
    const todos = contact('Geral', [], true);
    expect(suggestContactForDepartment([todos, multi], 'dp')).toBe(multi);
  });
});
