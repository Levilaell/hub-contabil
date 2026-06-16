-- T15 · Link a renewal task back to the monitored document that spawned it, so the
-- deadlines cron can stay idempotent: it only creates a "Renovar …" task when no
-- open task already references that monitored document. Idempotent.

alter table public.tasks
  drop constraint if exists tasks_monitored_document_id_fkey;
alter table public.tasks
  add column if not exists monitored_document_id uuid;
alter table public.tasks
  add constraint tasks_monitored_document_id_fkey
  foreign key (monitored_document_id) references public.monitored_documents(id) on delete set null;

create index if not exists tasks_monitored_document_idx
  on public.tasks (monitored_document_id)
  where monitored_document_id is not null;
