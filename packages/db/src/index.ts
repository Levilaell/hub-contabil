// Public surface of @hub/db: data-access use cases and generated types. The
// migrations, seed and integration tests are not exported.

export { saveFirmConfig, type FirmConfigEdits, type SaveFirmConfigResult } from './firm-config';
export {
  listCompanies,
  getCompany,
  createCompany,
  updateCompany,
  setCompanyArchived,
  requestEnrichment,
  listExistingCnpjs,
  bulkCreateCompanies,
  type Company,
  type CompanyInput,
  type CompanyEdits,
  type CompanyStatus,
  type CompanyEnrichmentView,
  type MutationResult,
  type BulkCreateInput,
  type BulkCreateResult,
} from './companies';
export {
  listContacts,
  createContact,
  updateContact,
  deleteContact,
  type Contact,
  type ContactInput,
  type ContactEdits,
  type PreferredChannel,
} from './contacts';
export {
  listExceptions,
  countOpenExceptions,
  resolveException,
  type ExceptionItem,
  type ExceptionStatus,
  type ResolveResult,
} from './exceptions';
export {
  listTasks,
  countOpenTasks,
  createTask,
  updateTaskStatus,
  handoffTask,
  type Task,
  type TaskInput,
  type TaskMutationResult,
} from './tasks';
export {
  listNotifications,
  countUnreadNotifications,
  markNotificationRead,
  type NotificationItem,
} from './notifications';
export {
  listRecurringTasks,
  createRecurringTask,
  updateRecurringTask,
  setRecurringTaskActive,
  type RecurringTask,
  type RecurringTaskInput,
  type RecurringTargetKind,
  type RecurringMutationResult,
} from './recurring-tasks';
export {
  DOCUMENTS_BUCKET,
  buildStoragePath,
  buildInboxPath,
  listDocuments,
  countDocuments,
  findDocumentByHash,
  insertDocument,
  insertInboxDocument,
  deleteDocument,
  createDocumentSignedUrl,
  type DocumentItem,
  type DocumentInput,
  type InboxDocumentInput,
  type DocMutationResult,
} from './documents';
export {
  firmToday,
  listMonitoredDocuments,
  createMonitoredDocument,
  updateMonitoredDocument,
  deleteMonitoredDocument,
  type MonitoredDoc,
  type MonitoredInput,
  type MonitoredMutationResult,
} from './monitored-documents';
export {
  createDocumentRequest,
  listDocumentRequests,
  listAllRequests,
  listRequestEvents,
  countOpenRequests,
  cancelDocumentRequest,
  rotateRequestToken,
  getCompanyPrimaryEmail,
  getRequestByToken,
  getRequestOwner,
  logRequestView,
  recordRequestUpload,
  recordRequestDownload,
  type DocumentRequest,
  type RequestWithCompany,
  type RequestEvent,
  type PublicRequestView,
  type RequestOwner,
  type CreateRequestInput,
  type CreateRequestResult,
  type RequestActionResult,
} from './requests';
export {
  listMappingRules,
  createMappingRule,
  updateMappingRule,
  deleteMappingRule,
  resolveOrQueue,
  saveResolutionAsRule,
  type MappingRuleRecord,
  type MappingRuleInput,
  type RuleOrigin,
  type RuleMutationResult,
  type ResolveOutcome,
} from './mapping-rules';
export {
  applyCfopResolution,
  type CfopEntry,
  type CfopApplyResult,
} from './cfop';
export {
  listExportBatches,
  getExportBatch,
  listExportableDocuments,
  listExportedDocumentIds,
  createExportBatch,
  markExportDownloaded,
  type ExportBatch,
  type ExportBatchStatus,
  type ExportFilters,
  type CreateBatchResult,
} from './export-batches';
export {
  listClassificationsByDocuments,
  enqueueTriage,
  correctClassification,
  type Classification,
  type TriageActionResult,
} from './classifications';
export type { Database } from './database.types';
