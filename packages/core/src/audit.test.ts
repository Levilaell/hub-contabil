import { describe, expect, it } from 'vitest';

import { buildAuditEvent } from './audit';

const FIRM = '11111111-1111-4111-8111-111111111111';
const USER = '22222222-2222-4222-8222-222222222222';
const ENTITY = '33333333-3333-4333-8333-333333333333';

describe('buildAuditEvent', () => {
  it('maps camelCase input to the snake_case row', () => {
    const row = buildAuditEvent({
      firmId: FIRM,
      actorId: USER,
      action: 'company.created',
      entity: 'company',
      entityId: ENTITY,
      context: { cnpj: '12345678000199' },
    });
    expect(row).toEqual({
      firm_id: FIRM,
      actor_id: USER,
      action: 'company.created',
      entity: 'company',
      entity_id: ENTITY,
      context: { cnpj: '12345678000199' },
    });
  });

  it('defaults actor to null (robot/system) and context to {}', () => {
    const row = buildAuditEvent({
      firmId: FIRM,
      action: 'deadline.recomputed',
      entity: 'deadline',
    });
    expect(row.actor_id).toBeNull();
    expect(row.entity_id).toBeNull();
    expect(row.context).toEqual({});
  });

  it('rejects an empty action', () => {
    expect(() => buildAuditEvent({ firmId: FIRM, action: '', entity: 'company' })).toThrow();
  });

  it('rejects a non-uuid firmId', () => {
    expect(() =>
      buildAuditEvent({ firmId: 'not-a-uuid', action: 'x', entity: 'company' }),
    ).toThrow();
  });
});
