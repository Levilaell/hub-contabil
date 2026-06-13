-- T3 · Make the audit trail server-write-only. The earlier INSERT policy only
-- checked firm_id, which let any authenticated user forge an entry with someone
-- else's actor_id — an accountable trail (golden rule #7) must not be spoofable.
-- Audit writes now go exclusively through the service role (worker crons and web
-- Server Actions), which stamps the real actor. Authenticated users keep SELECT.

drop policy if exists audit_events_insert on public.audit_events;
revoke insert on public.audit_events from authenticated;
