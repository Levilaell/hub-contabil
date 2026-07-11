-- T34 · Link a company-less support ticket to a company, from /atendimento.
-- Until now the only path was registering the contact on the company page and
-- waiting for the client's NEXT message to re-point the ticket. This RPC does
-- both halves at once: registers the sender as a contact of the chosen company
-- (unless an equivalent one already exists there) and re-points the ticket
-- immediately, so the assistant starts using the right company context on the
-- very next reply. Firm-scoped SECURITY DEFINER, audited. Idempotent.

create or replace function public.link_ticket_company(
  p_ticket_id uuid,
  p_company_id uuid,
  p_contact_name text default null
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_firm uuid := public.current_firm_id();
  v_ticket record;
  v_digits text;
begin
  if v_firm is null then
    raise exception 'no firm in session';
  end if;

  select id, channel, contact_identifier, contact_name into v_ticket
  from public.support_tickets
  where id = p_ticket_id and firm_id = v_firm;
  if not found then
    raise exception 'ticket not found in firm';
  end if;

  perform 1 from public.companies where id = p_company_id and firm_id = v_firm;
  if not found then
    raise exception 'company not found in firm';
  end if;

  if v_ticket.channel = 'whatsapp' then
    -- Contacts store digits-only phones (T34 canonical form).
    v_digits := regexp_replace(v_ticket.contact_identifier, '\D', '', 'g');
    if not exists (
      select 1 from public.contacts c
      where c.firm_id = v_firm and c.company_id = p_company_id and c.phone is not null
        and regexp_replace(c.phone, '\D', '', 'g') = v_digits
    ) then
      insert into public.contacts (firm_id, company_id, name, phone, preferred_channel)
      values (v_firm, p_company_id,
              coalesce(nullif(btrim(p_contact_name), ''), v_ticket.contact_name, v_ticket.contact_identifier),
              v_digits, 'whatsapp');
    end if;
  else
    if not exists (
      select 1 from public.contacts c
      where c.firm_id = v_firm and c.company_id = p_company_id
        and lower(c.email) = lower(v_ticket.contact_identifier)
    ) then
      insert into public.contacts (firm_id, company_id, name, email, preferred_channel)
      values (v_firm, p_company_id,
              coalesce(nullif(btrim(p_contact_name), ''), v_ticket.contact_name, v_ticket.contact_identifier),
              lower(v_ticket.contact_identifier), 'email');
    end if;
  end if;

  update public.support_tickets
  set company_id = p_company_id
  where id = p_ticket_id and firm_id = v_firm;

  insert into public.audit_events (firm_id, actor_id, action, entity, entity_id, context)
  values (v_firm, auth.uid(), 'support.company_linked', 'support_ticket', p_ticket_id,
          jsonb_build_object('companyId', p_company_id));
end;
$$;
revoke execute on function public.link_ticket_company(uuid, uuid, text) from public, anon;
grant execute on function public.link_ticket_company(uuid, uuid, text) to authenticated;
