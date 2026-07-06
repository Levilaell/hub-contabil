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

export {
  deriveMonitoredStatus,
  monitoredToDeadlineSignal,
  type MonitoredStatus,
  type MonitoredDateStatus,
  type DeadlineSignal,
} from './monitored';

export {
  REQUEST_STATUSES,
  isRequestStatus,
  allowedRequestTransitions,
  canTransitionRequest,
  isOpenRequest,
  OPEN_REQUEST_STATUSES,
  REQUEST_KINDS,
  isRequestKind,
  fulfilledStatusFor,
  RESENDABLE_STATUSES,
  canResendRequest,
  statusAfterResend,
  type RequestStatus,
  type RequestKind,
} from './request';

export { buildRequestEmail, type RequestEmailInput, type BuiltEmail } from './request-email';

export {
  resolveMappingRule,
  isMappingRuleLevel,
  MAPPING_RULE_LEVELS,
  type MappingRule,
  type MappingRuleLevel,
  type RuleMatch,
  type RuleResolution,
} from './mapping-rules';

export { parseNfe, CFOP_DOMAIN, type ParsedNfe, type NfeItem } from './nfe';

export { suggestContactForDepartment, type RoutableContact } from './contact-routing';

export {
  routeDepartment,
  decideTriage,
  type TriageDecision,
  type TriageReason,
  type TriageInput,
  type TriageOutcome,
} from './triage';

export {
  buildExportManifest,
  exportExclusionReason,
  parseCfopMetadata,
  manifestToCsv,
  type ExportDoc,
  type ExportManifest,
  type ManifestEntry,
  type ExcludedEntry,
  type ExclusionReason,
  type CfopEntrySummary,
} from './export';

export {
  INBOUND_CHANNELS,
  isInboundChannel,
  classifyInboundKind,
  decideInboundRouting,
  normalizeInboundPhone,
  normalizeInboundEmail,
  type InboundChannel,
  type InboundKind,
  type InboundTarget,
  type InboundReason,
  type InboundClassifyInput,
  type InboundRouteOutcome,
} from './inbound';

export {
  SUPPORT_STATUSES,
  isSupportStatus,
  allowedSupportTransitions,
  canTransitionSupport,
  statusAfterInbound,
  OPEN_SUPPORT_STATUSES,
  isOpenSupport,
  decideSupportResponse,
  isWithin24hWindow,
  SERVICE_WINDOW_MS,
  type SupportStatus,
  type SupportAction,
  type SupportReason,
  type SupportDecisionInput,
  type SupportDecision,
} from './support';
