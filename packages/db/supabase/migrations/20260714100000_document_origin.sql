-- T38 (documents redesign, spec approved 2026-07-14): link a document to the
-- inbound message that delivered it, so the UI can show its origin (channel,
-- sender, arrival date). Nullable — upload/request/manual-triage documents have
-- no inbound message. Idempotent.

alter table public.documents
  add column if not exists inbound_message_id uuid
    references public.inbound_messages (id) on delete set null;

create index if not exists documents_inbound_message_idx
  on public.documents (firm_id, inbound_message_id)
  where inbound_message_id is not null;
