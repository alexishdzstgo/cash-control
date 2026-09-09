-- Run as postgres, after 0001 + 0002, on disposable local/test Supabase only.
-- psql -v ON_ERROR_STOP=1 -f supabase/tests/auth_provisioning.sql
begin;
do $$
declare
  v_business_id uuid := gen_random_uuid();
  owner_id uuid := gen_random_uuid();
  duplicate_id uuid := gen_random_uuid();
  invalid_id uuid := gen_random_uuid();
  v_member_id uuid;
  old_hash text;
  signature text;
  i integer;
begin
  foreach signature in array array[
    'public.admin_provision_member(uuid,uuid,text,text,text,jsonb,text,public.member_role,text,text)',
    'public.admin_set_member_pin(uuid,text)',
    'public.admin_find_member_by_username(uuid,text)'
  ] loop
    if has_function_privilege('authenticated', signature, 'EXECUTE')
      or has_function_privilege('anon', signature, 'EXECUTE')
      or not has_function_privilege('service_role', signature, 'EXECUTE') then
      raise exception 'wrong function privileges: %', signature;
    end if;
  end loop;
  insert into auth.users (id) values (owner_id), (duplicate_id), (invalid_id);
  insert into public.businesses (id, name, slug)
    values (v_business_id, 'Provisioning Test', 'provisioning-' || v_business_id);

  -- Exercise actual backend role execution, not just its privilege metadata.
  set local role service_role;
  v_member_id := public.admin_provision_member(v_business_id, owner_id,
    'Owner', 'Test', 'Owner Test', null, 'Owner.Test', 'owner', 'Owner-only note', '123456');
  reset role;
  if not exists (select 1 from public.profiles p where p.id = owner_id and p.display_name = 'Owner Test')
    or not exists (select 1 from public.business_members m where m.id = v_member_id and m.user_id = owner_id and m.business_id = v_business_id and m.internal_notes = 'Owner-only note')
    or not exists (select 1 from private.member_pins p where p.member_id = v_member_id and p.pin_hash <> '123456') then
    raise exception 'incomplete provisioning or plaintext PIN';
  end if;
  if public.admin_find_member_by_username(v_business_id, 'OWNER.TEST') is distinct from v_member_id then
    raise exception 'username lookup differs from unique index';
  end if;
  if not private.verify_member_pin(v_member_id, '123456') then raise exception 'correct PIN rejected'; end if;
  if private.verify_member_pin(v_member_id, '0000') then raise exception 'wrong PIN accepted'; end if;

  begin
    perform public.admin_provision_member(v_business_id, duplicate_id,
      'Duplicate', 'Test', 'Duplicate Test', null, 'OWNER.TEST', 'employee', '', '1234');
    raise exception 'case-insensitive duplicate accepted';
  exception when unique_violation then null;
  end;
  begin
    -- Error occurs AFTER profile/member inserts; all must roll back.
    perform public.admin_provision_member(v_business_id, invalid_id,
      'Invalid', 'Test', 'Invalid Test', null, 'invalid', 'employee', '', 'abc');
    raise exception 'invalid PIN accepted';
  exception when invalid_parameter_value then null;
  end;
  if exists (select 1 from public.profiles p where p.id in (duplicate_id, invalid_id))
    or exists (select 1 from public.business_members m where m.user_id in (duplicate_id, invalid_id)) then
    raise exception 'partial provisioning persisted';
  end if;
  if (select count(*) from private.member_pins p join public.business_members m on m.id = p.member_id where m.business_id = v_business_id) <> 1 then
    raise exception 'unexpected PIN rows';
  end if;
  begin
    perform public.admin_provision_member(v_business_id, gen_random_uuid(),
      'Missing', 'Test', 'Missing Test', null, 'missing', 'owner', '', '1234');
    raise exception 'missing Auth user accepted';
  exception when foreign_key_violation then null;
  end;
  begin
    perform public.admin_provision_member(gen_random_uuid(), invalid_id,
      'Missing', 'Test', 'Missing Test', null, 'missing', 'owner', '', '1234');
    raise exception 'missing business accepted';
  exception when invalid_parameter_value then null;
  end;

  for i in 1..4 loop perform private.verify_member_pin(v_member_id, '0000'); end loop;
  select p.pin_hash into old_hash from private.member_pins p where p.member_id = v_member_id;
  if not exists (select 1 from private.member_pins p where p.member_id = v_member_id and p.failed_attempts = 5 and p.locked_until > clock_timestamp()) then
    raise exception 'fixture not locked';
  end if;
  set local role service_role;
  perform public.admin_set_member_pin(v_member_id, '654321');
  reset role;
  if not exists (select 1 from private.member_pins p where p.member_id = v_member_id
    and p.pin_hash <> old_hash and p.pin_hash <> '654321' and p.failed_attempts = 0 and p.locked_until is null) then
    raise exception 'rotation did not reset hash/lock';
  end if;
  if private.verify_member_pin(v_member_id, '123456') then raise exception 'old PIN accepted'; end if;
  if not private.verify_member_pin(v_member_id, '654321') then raise exception 'new PIN rejected'; end if;
  begin
    perform public.admin_set_member_pin(v_member_id, 'abc');
    raise exception 'invalid rotation accepted';
  exception when invalid_parameter_value then null;
  end;
  if not private.verify_member_pin(v_member_id, '654321') then raise exception 'failed rotation changed PIN'; end if;

  set local role authenticated;
  begin
    perform public.admin_set_member_pin(v_member_id, '1111');
    raise exception 'authenticated rotated PIN';
  exception when insufficient_privilege then null;
  end;
  begin
    perform public.admin_provision_member(v_business_id, invalid_id,
      'Denied', 'Test', 'Denied Test', null, 'denied', 'employee', '', '1234');
    raise exception 'authenticated provisioned member';
  exception when insufficient_privilege then null;
  end;
  reset role;
  set local role anon;
  begin
    perform public.admin_provision_member(v_business_id, invalid_id,
      'Denied', 'Test', 'Denied Test', null, 'denied', 'employee', '', '1234');
    raise exception 'anon provisioned member';
  exception when insufficient_privilege then null;
  end;
  reset role;
end;
$$;
rollback;
