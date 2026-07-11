// Public surface of @hub/db: data-access use cases and generated types. The
// migrations, seed and integration tests are not exported.

export {
  saveFirmConfig,
  saveAdvancedConfig,
  type FirmConfigEdits,
  type AdvancedConfigEdits,
  type SaveFirmConfigResult,
} from './firm-config';
export { listFirmUsers, isUserRole, type FirmUser, type UserRole } from './users';
export { listAuditEvents, type AuditEvent, type AuditFilter } from './audit-log';
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
  type CompanyDetails,
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
  listPartners,
  createPartner,
  updatePartner,
  deletePartner,
  type CompanyPartner,
  type PartnerInput,
  type PartnerEdits,
} from './partners';
export {
  listExceptions,
  countOpenExceptions,
  resolveException,
  applyTriageSuggestion,
  type ExceptionItem,
  type ExceptionStatus,
  type ResolveResult,
} from './exceptions';
export {
  listTasks,
  countOpenTasks,
  countUnassignedOpenTasks,
  createTask,
  updateTaskStatus,
  assignTask,
  handoffTask,
  generateRecurringTasksForCompany,
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
  listFirmDeadlines,
  createMonitoredDocument,
  updateMonitoredDocument,
  deleteMonitoredDocument,
  type MonitoredDoc,
  type FirmDeadline,
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
  markRequestSent,
  getCompanyPrimaryEmail,
  getSuggestedRecipientEmail,
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
export {
  listSupportTickets,
  countOpenSupportTickets,
  listSupportMessages,
  replySupportTicket,
  setSupportStatus,
  returnTicketToAi,
  type SupportTicket,
  type SupportMessage,
  type SupportStatus,
  type SupportHandler,
  type SupportActionResult,
} from './support';
export type { Database } from './database.types';
