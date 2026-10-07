-- Phase 2B.2-A.1. Read-only projection of members activated on one workstation.
-- 0001, 0002, 0003, and 0004 are immutable and must already be applied.
begin;

create function public.admin_list_workstation_members(p_workstation_token_hash text)
returns table (
  member_id uuid,
  username text,
  display_name text,
  role public.member_role
)
language sql security definer set search_path = ''
as $$
  select m.id, m.username, p.display_name, m.role
  from private.workstation_sessions w
  join private.workstation_member_activations a
    on a.workstation_session_id = w.id
  join public.business_members m
    on m.id = a.member_id and m.business_id = w.business_id
  join public.businesses b on b.id = w.business_id
  join public.profiles p on p.id = m.user_id
  where w.token_hash = p_workstation_token_hash
    and w.revoked_at is null
    and w.expires_at > clock_timestamp()
    and b.status = 'active'
    and m.status = 'active'
  order by p.display_name, m.username, m.id;
$$;

do $$
declare
  v_signature text := 'public.admin_list_workstation_members(text)';
begin
  execute pg_catalog.format(
    'revoke all on function %s from public, anon, authenticated, service_role',
    v_signature
  );
  execute pg_catalog.format(
    'grant execute on function %s to service_role',
    v_signature
  );
end;
$$;

commit;
