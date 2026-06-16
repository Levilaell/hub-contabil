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
  listDocuments,
  findDocumentByHash,
  insertDocument,
  deleteDocument,
  createDocumentSignedUrl,
  type DocumentItem,
  type DocumentInput,
  type DocMutationResult,
} from './documents';
export type { Database } from './database.types';
