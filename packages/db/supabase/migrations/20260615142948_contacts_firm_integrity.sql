-- T6 (integrity) · Guarantee at the DB level that a contact's company belongs to
-- the SAME firm (golden rule #1). The plain company_id FK only checked the company
-- exists, not that its firm matches the contact's firm_id — so a forged call could
-- stamp firm_id=A onto a contact pointing at firm B's company. A composite
-- (firm_id, company_id) FK closes that, and unlike an RLS/app check it also holds
-- on the service-role/worker path that bypasses RLS. Idempotent.

-- Composite FK target: companies needs a unique key on exactly (firm_id, id).
alter table public.companies drop constraint if exists companies_firm_id_id_key;
alter table public.companies add constraint companies_firm_id_id_key unique (firm_id, id);

-- Replace the single-column company FK with the firm-aware composite one.
alter table public.contacts drop constraint if exists contacts_company_id_fkey;
alter table public.contacts drop constraint if exists contacts_firm_company_fkey;
alter table public.contacts
  add constraint contacts_firm_company_fkey
  foreign key (firm_id, company_id)
  references public.companies (firm_id, id)
  on delete cascade;
