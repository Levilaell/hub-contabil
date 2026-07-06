-- Fase 1.1 §4 (resposta do Paulo) · Reception menu: a new WhatsApp conversation is
-- greeted with a numbered department menu (like the firm's previous chatbot); the
-- client's pick tags the ticket with a department, enabling per-department queues
-- in /atendimento. The menu itself is config (firm-config support.reception) and
-- pure logic in @hub/core — this migration only adds the tag column. Values come
-- from the firm-config `departments` vocabulary (golden rule #8). Idempotent.

alter table public.support_tickets
  add column if not exists department text;

comment on column public.support_tickets.department is
  'Firm-config department key chosen via the reception menu (or by a human); null = not routed yet.';
