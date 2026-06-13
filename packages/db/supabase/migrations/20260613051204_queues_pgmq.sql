-- T5 · Message queues on pgmq: triage, export, notifications + one DLQ each.
-- Queues are infrastructure (no RLS); the worker operates them via the service
-- connection. Every job payload carries firm_id (enforced in the worker's base
-- payload schema). DLQ contents feed the exception queue in T9. Idempotent.

create extension if not exists pgmq;

do $$
declare
  q text;
  queues text[] := array[
    'triage', 'triage_dlq',
    'export', 'export_dlq',
    'notifications', 'notifications_dlq'
  ];
begin
  foreach q in array queues loop
    if not exists (select 1 from pgmq.list_queues() where queue_name = q) then
      perform pgmq.create(q);
    end if;
  end loop;
end
$$;
