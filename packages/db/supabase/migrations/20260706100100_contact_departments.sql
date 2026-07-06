-- Fase 1.1 §1.3 · Contact-by-department: each contact is tagged with the firm
-- departments it serves. Values come from the firm config `departments` vocabulary
-- (validated in @hub/db, like companies.tax_regime — golden rule #8: business
-- vocabulary in config, not schema). Empty array = "Todos" (serves any department).
-- The suggestion rule ("most specific wins") is a pure function in @hub/core —
-- deterministic automation, not AI. Idempotent.

alter table public.contacts
  add column if not exists departments text[] not null default '{}'::text[];

comment on column public.contacts.departments is
  'Firm-config department keys this contact serves; empty = all departments ("Todos").';
