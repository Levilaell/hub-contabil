// Pure domain package: entities, use cases, state machines. No IO allowed here.
// Domain modules arrive with their feature tasks (task state machine in T10,
// mapping-rules resolution in T18, ...).

export const CORE_PACKAGE_NAME = '@hub/core';

export {
  buildAuditEvent,
  auditEventInputSchema,
  type AuditEventInput,
  type AuditEventRow,
} from './audit';
