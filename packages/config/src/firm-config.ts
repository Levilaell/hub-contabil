import { z } from 'zod';

// Per-firm configuration persisted in firms.config (JSONB). Business values live
// here, never in code (golden rule #8). Every field has a default so a freshly
// seeded firm (config = '{}') parses into a complete, valid config.

const vocabularyEntrySchema = z.object({ key: z.string().min(1), label: z.string().min(1) });

export const DEFAULT_DEPARTMENTS = [
  { key: 'fiscal', label: 'Fiscal' },
  { key: 'contabil', label: 'Contábil' },
  { key: 'dp', label: 'Departamento Pessoal' },
  { key: 'compliance', label: 'Societário / Compliance' },
] as const;

// Tax regimes (config vocabulary, golden rule #8). companies.tax_regime stores the
// key; the label is for display. National fixed set, but firms may relabel.
export const DEFAULT_TAX_REGIMES = [
  { key: 'simples_nacional', label: 'Simples Nacional' },
  { key: 'lucro_presumido', label: 'Lucro Presumido' },
  { key: 'lucro_real', label: 'Lucro Real' },
  { key: 'mei', label: 'MEI' },
  { key: 'imune_isenta', label: 'Imune / Isenta' },
] as const;

// Monitored-document kinds for the deadline engine (T14). Config vocabulary
// ({key,label}); firms can relabel/extend. trigger days per kind live in
// deadlineTriggers.byKind (keyed by these keys).
export const DEFAULT_MONITORED_KINDS = [
  { key: 'cnd_federal', label: 'CND Federal (RFB/PGFN)' },
  { key: 'cnd_estadual', label: 'CND Estadual' },
  { key: 'cnd_municipal', label: 'CND Municipal' },
  { key: 'cndt', label: 'CNDT (Trabalhista)' },
  { key: 'fgts_crf', label: 'CRF / FGTS' },
  { key: 'alvara', label: 'Alvará / Licença' },
  { key: 'certificado_a1', label: 'Certificado Digital A1' },
] as const;

// Closed document taxonomy (PLANEJAMENTO §6) — validate with the partner before AI triage (T20).
export const DEFAULT_TAXONOMY = [
  'nfe',
  'nfce',
  'nfse',
  'cte',
  'das',
  'darf',
  'gare_gnre',
  'iss_slip',
  'fgts_inss_slip',
  'boleto',
  'bank_statement',
  'card_statement',
  'payslip',
  'certificate',
  'license',
  'articles_of_incorporation',
  'power_of_attorney',
  'payment_receipt',
  'spreadsheet',
  'other',
] as const;

// Document type → department (PLANEJAMENTO §6). Unmapped/low-confidence → exception queue.
export const DEFAULT_ROUTING_MAP: Record<string, string> = {
  nfe: 'fiscal',
  nfce: 'fiscal',
  nfse: 'fiscal',
  cte: 'fiscal',
  das: 'fiscal',
  darf: 'fiscal',
  gare_gnre: 'fiscal',
  iss_slip: 'fiscal',
  fgts_inss_slip: 'dp',
  payslip: 'dp',
  bank_statement: 'contabil',
  card_statement: 'contabil',
  certificate: 'compliance',
  license: 'compliance',
  articles_of_incorporation: 'compliance',
  power_of_attorney: 'compliance',
};

// Allowed statuses per domain — mirrors the state machines (PLANEJAMENTO §5). Minimal; no UI in v1.
export const DEFAULT_STATUS_VOCABULARIES: Record<string, string[]> = {
  task: ['pending', 'in_progress', 'done', 'canceled'],
  document_request: [
    'requested',
    'sent',
    'viewed',
    'received',
    'downloaded',
    'expired',
    'cancelled',
  ],
  monitored_document: ['no_date', 'valid', 'due_soon', 'overdue', 'needs_update'],
  exception: ['open', 'resolved', 'ignored'],
};

export const firmConfigSchema = z
  .object({
    departments: z
      .array(vocabularyEntrySchema)
      .min(1)
      .default([...DEFAULT_DEPARTMENTS]),
    taxRegimes: z
      .array(vocabularyEntrySchema)
      .min(1)
      .default([...DEFAULT_TAX_REGIMES]),
    monitoredKinds: z
      .array(vocabularyEntrySchema)
      .min(1)
      .default([...DEFAULT_MONITORED_KINDS]),
    deadlineTriggers: z
      .object({
        // Days before a due date when a deadline turns "due_soon".
        defaultDays: z
          .number({ message: 'O prazo de alerta deve ser um número.' })
          .int({ message: 'O prazo de alerta deve ser um número inteiro de dias.' })
          .min(1, { message: 'O prazo de alerta deve ser de pelo menos 1 dia.' })
          .max(365, { message: 'O prazo de alerta deve ser no máximo 365 dias.' })
          .default(30),
        byKind: z.record(z.string(), z.number().int().min(1).max(365)).default({}),
        // Auto-create a "Renovar …" task when a monitored doc goes overdue (T15).
        autoRenewalTask: z.boolean().default(true),
        // Department the renewal task lands in (falls back to the first department
        // if this key isn't in `departments`).
        renewalDepartment: z.string().default('compliance'),
      })
      .default({}),
    aiThreshold: z
      .number({ message: 'O limite de confiança deve ser um número.' })
      .min(0, { message: 'O limite de confiança deve estar entre 0 e 1.' })
      .max(1, { message: 'O limite de confiança deve estar entre 0 e 1.' })
      .default(0.85),
    // Days a document-request access link stays valid (T16). Business value in
    // config (golden rule #8); the link's expires_at is stamped from this.
    requestTokenExpiryDays: z
      .number({ message: 'A validade do link deve ser um número.' })
      .int({ message: 'A validade do link deve ser um número inteiro de dias.' })
      .min(1, { message: 'A validade do link deve ser de pelo menos 1 dia.' })
      .max(90, { message: 'A validade do link deve ser no máximo 90 dias.' })
      .default(7),
    // Days a request may sit in 'sent' (link delivered, client hasn't opened)
    // before the reminder cron re-sends it (T17). Business value in config (#8).
    requestReminderDays: z
      .number({ message: 'O lembrete deve ser um número.' })
      .int({ message: 'O lembrete deve ser um número inteiro de dias.' })
      .min(1, { message: 'O lembrete deve ser de pelo menos 1 dia.' })
      .max(60, { message: 'O lembrete deve ser no máximo 60 dias.' })
      .default(3),
    taxonomy: z
      .array(z.string().min(1))
      .min(1)
      .default([...DEFAULT_TAXONOMY]),
    routingMap: z.record(z.string(), z.string()).default(DEFAULT_ROUTING_MAP),
    statusVocabularies: z
      .record(z.string(), z.array(z.string()))
      .default(DEFAULT_STATUS_VOCABULARIES),
  })
  .default({});

export type FirmConfig = z.infer<typeof firmConfigSchema>;

/** Parse a raw firms.config value, filling defaults for anything missing. */
export function parseFirmConfig(raw: unknown): FirmConfig {
  return firmConfigSchema.parse(raw ?? {});
}

export type FirmConfigValidation =
  | { success: true; data: FirmConfig }
  | { success: false; message: string };

/** Validate a candidate config, returning the first error as a pt-BR message. */
export function validateFirmConfig(raw: unknown): FirmConfigValidation {
  const result = firmConfigSchema.safeParse(raw);
  if (result.success) {
    return { success: true, data: result.data };
  }
  return { success: false, message: result.error.issues[0]?.message ?? 'Configuração inválida.' };
}
