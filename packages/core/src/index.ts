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

export { normalizeCnpj, formatCnpj, isValidCnpj } from './cnpj';

export {
  IMPORT_COLUMNS,
  normalizeHeader,
  columnKeyForHeader,
  validateImportRows,
  type ImportColumn,
  type ImportColumnKey,
  type RawImportRow,
  type ImportRowInput,
  type ImportRowStatus,
  type AnnotatedImportRow,
  type ValidateImportOptions,
} from './import';

export {
  TASK_STATUSES,
  isTaskStatus,
  allowedTaskTransitions,
  canTransitionTask,
  canHandoffTask,
  HANDOFFABLE_STATUSES,
  type TaskStatus,
} from './task';
