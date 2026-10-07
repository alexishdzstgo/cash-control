-- Phase 2A. Apply separately as postgres; 0001 is already deployed and immutable.
begin;

create function public.admin_provision_member(
  p_business_id uuid, p_user_id uuid,
  p_first_name text, p_last_name text, p_display_name text,
  p_avatar jsonb, p_username text, p_role public.member_role,
  p_internal_notes text, p_pin text
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  new_member_id uuid;
begin
  if not exists (select 1 from auth.users u where u.id = p_user_id) then
    raise exception 'Auth user does not exist' using errcode = '23503';
  end if;
  -- Lock against suspension/deletion while provisioning this business.
  perform 1 from public.businesses b
    where b.id = p_business_id and b.status = 'active' for share;
  if not found then
    raise exception 'Active business required' using errcode = '22023';
  end if;

  -- Deliberately no upsert: never overwrite another profile or membership.
  insert into public.profiles (id, first_name, last_name, display_name, avatar)
    values (p_user_id, p_first_name, p_last_name, p_display_name, p_avatar);
  insert into public.business_members (business_id, user_id, username, role, internal_notes)
    values (p_business_id, p_user_id, p_username, p_role, p_internal_notes)
    returning id into new_member_id;
  insert into private.member_pins (member_id, pin_hash)
    values (new_member_id, private.hash_pin(p_pin));
  return new_member_id;
end;
$$;

create function public.admin_set_member_pin(p_member_id uuid, p_pin text)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  -- UPDATE serializes with verify_member_pin's FOR UPDATE row lock.
  update private.member_pins
    set pin_hash = private.hash_pin(p_pin), failed_attempts = 0, locked_until = null
    where member_id = p_member_id;
  if not found then
    raise exception 'Provisioned member PIN not found' using errcode = '22023';
  end if;
end;
$$;

-- Exact case-insensitive preflight, with the same lower() semantics as 0001's
-- unique index. No PostgREST wildcard matching or browser username enumeration.
create function public.admin_find_member_by_username(p_business_id uuid, p_username text)
returns uuid
language sql stable
security definer
set search_path = ''
as $$
  select m.id from public.business_members m
    where m.business_id = p_business_id
      and pg_catalog.lower(m.username) = pg_catalog.lower(p_username);
$$;

revoke all on function public.admin_provision_member(uuid, uuid, text, text, text, jsonb, text, public.member_role, text, text) from public, anon, authenticated, service_role;
revoke all on function public.admin_set_member_pin(uuid, text) from public, anon, authenticated, service_role;
revoke all on function public.admin_find_member_by_username(uuid, text) from public, anon, authenticated, service_role;
grant execute on function public.admin_provision_member(uuid, uuid, text, text, text, jsonb, text, public.member_role, text, text) to service_role;
grant execute on function public.admin_set_member_pin(uuid, text) to service_role;
grant execute on function public.admin_find_member_by_username(uuid, text) to service_role;

commit;
