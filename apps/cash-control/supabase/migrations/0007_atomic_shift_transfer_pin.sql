-- Phase 2C.2. Validate the receiver PIN and transfer responsibility atomically.
-- 0001-0006 are immutable and must already be applied.
begin;

create function public.admin_transfer_shift_responsibility_with_pin(
  p_operator_token_hash text,
  p_new_responsible_member_id uuid,
  p_receiver_pin text
)
returns table (
  pin_verified boolean,
  shift_id uuid,
  previous_responsible_member_id uuid,
  responsible_member_id uuid
)
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_actor record;
  v_shift private.shifts%rowtype;
  v_current private.shift_participants%rowtype;
  v_new private.shift_participants%rowtype;
  v_pin_verified boolean;
begin
  if p_receiver_pin is null or p_receiver_pin !~ '^[0-9]{4,6}$' then
    raise exception 'Valid receiver PIN required.' using errcode = '22023';
  end if;

  select * into v_actor
    from private.resolve_shift_operator(p_operator_token_hash);
  if not found then
    raise exception 'Active operator session required.' using errcode = '22023';
  end if;

  select s.* into v_shift
    from private.shifts s
   where s.business_id = v_actor.business_id and s.status = 'open'
   for update;
  if not found then
    raise exception 'Open shift required.' using errcode = '22023';
  end if;

  select p.* into v_current
    from private.shift_participants p
   where p.shift_id = v_shift.id
     and p.status = 'active'
     and p.role = 'shift_responsible'
   for update;
  if not found or v_current.member_id <> v_actor.member_id then
    raise exception 'Current shift responsible required.' using errcode = '42501';
  end if;

  if p_new_responsible_member_id = v_current.member_id then
    raise exception 'A different active participant is required.' using errcode = '22023';
  end if;

  select p.* into v_new
    from private.shift_participants p
    join public.business_members m
      on m.id = p.member_id and m.business_id = v_shift.business_id
   where p.shift_id = v_shift.id
     and p.business_id = v_shift.business_id
     and p.member_id = p_new_responsible_member_id
     and p.status = 'active'
     and m.status = 'active'
   for update of p;
  if not found then
    raise exception 'New responsible must be an active participant.' using errcode = '22023';
  end if;

  -- A false result must be returned, not raised, so failed PIN attempts commit.
  v_pin_verified := private.verify_member_pin(
    v_new.member_id,
    p_receiver_pin
  );
  if not v_pin_verified then
    return query
      select false, null::uuid, null::uuid, null::uuid;
    return;
  end if;

  update private.shift_participants p
     set role = 'operator'
   where p.id = v_current.id;
  update private.shift_participants p
     set role = 'shift_responsible'
   where p.id = v_new.id;
  update private.shifts s
     set responsible_member_id = v_new.member_id
   where s.id = v_shift.id;

  return query
    select true, v_shift.id, v_current.member_id, v_new.member_id;
end;
$$;

do $$
declare
  v_signature text :=
    'public.admin_transfer_shift_responsibility_with_pin(text,uuid,text)';
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

do $$
declare
  v_signature text :=
    'public.admin_transfer_shift_responsibility_with_pin(text,uuid,text)';
begin
  if not exists (
    select 1
      from pg_catalog.pg_proc p
     where p.oid = pg_catalog.to_regprocedure(v_signature)
       and p.prosecdef
       and exists (
         select 1
           from pg_catalog.unnest(coalesce(p.proconfig, array[]::text[])) as config(setting)
          where config.setting = 'search_path=""'
       )
       and not exists (
         select 1
           from pg_catalog.aclexplode(
             coalesce(p.proacl, pg_catalog.acldefault('f', p.proowner))
           ) as acl
          where acl.grantee = 0
            and acl.privilege_type = 'EXECUTE'
       )
  ) then
    raise exception 'function security definition is invalid: %', v_signature;
  end if;

  if not has_function_privilege('service_role', v_signature, 'EXECUTE')
     or has_function_privilege('anon', v_signature, 'EXECUTE')
     or has_function_privilege('authenticated', v_signature, 'EXECUTE')
     or exists (
       select 1
         from pg_catalog.pg_proc p
         cross join lateral pg_catalog.aclexplode(
           coalesce(p.proacl, pg_catalog.acldefault('f', p.proowner))
         ) as acl
        where p.oid = pg_catalog.to_regprocedure(v_signature)
          and acl.grantee = 0
          and acl.privilege_type = 'EXECUTE'
     ) then
    raise exception 'wrong shift RPC privileges: %', v_signature;
  end if;
end;
$$;

commit;
