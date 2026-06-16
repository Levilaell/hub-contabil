-- T16 · Owner lookup for public uploads. The public upload server action must
-- build the Storage path (firm/{firm}/company/{company}/…) server-side from the
-- token — never from client-supplied ids. This token-keyed RPC returns just the
-- owner ids (plus kind/expiry so the action can reject early). Anon-callable but
-- only ever yields the firm/company tied to a valid token the caller already holds.
create or replace function public.get_request_owner(p_token text)
returns table (
  firm_id uuid,
  company_id uuid,
  kind text,
  is_expired boolean
)
language sql
stable
security definer
set search_path = ''
as $$
  select r.firm_id, r.company_id, r.kind, (r.expires_at < now())
  from public.document_requests r
  where r.token_hash = public.hash_request_token(p_token);
$$;
revoke execute on function public.get_request_owner(text) from public;
grant execute on function public.get_request_owner(text) to anon, authenticated;
