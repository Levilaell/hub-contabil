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
export type { Database } from './database.types';
