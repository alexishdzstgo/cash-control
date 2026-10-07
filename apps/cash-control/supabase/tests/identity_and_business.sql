-- Run as postgres on a disposable local Supabase after migration 0001.
-- psql -v ON_ERROR_STOP=1 -f supabase/tests/identity_and_business.sql
begin;

do $$
declare
  alice uuid := gen_random_uuid();
  bob uuid := gen_random_uuid();
  outsider uuid := gen_random_uuid();
  business_a uuid := gen_random_uuid();
  business_b uuid := gen_random_uuid();
  member_a uuid := gen_random_uuid();
  hash text;
  i integer;
  column_name text;
  invalid_name text;
begin
  insert into auth.users (id) values (alice), (bob), (outsider);
  insert into public.profiles (id, first_name, last_name, display_name)
    values (alice, 'Alice', 'Test', 'Alice Test'), (bob, 'Bob', 'Test', 'Bob Test'), (outsider, 'Other', 'Test', 'Other Test');
  -- Each failed update rolls back within its exception block; the fixture stays valid.
  foreach column_name in array array['first_name', 'last_name', 'display_name'] loop
    foreach invalid_name in array array['', '   '] loop
      begin
        execute format('update public.profiles set %I = $1 where id = $2', column_name)
          using invalid_name, alice;
        raise exception 'blank profile % accepted', column_name;
      exception when check_violation then null;
      end;
    end loop;
    begin
      execute format('update public.profiles set %I = null where id = $1', column_name)
        using alice;
      raise exception 'null profile % accepted', column_name;
    exception when not_null_violation then null;
    end;
  end loop;
  insert into public.businesses (id, name, slug)
    values (business_a, 'A', 'test-' || business_a), (business_b, 'B', 'test-' || business_b);
  insert into public.business_members (id, business_id, user_id, username, role)
    values (member_a, business_a, alice, 'Alice', 'owner');
  insert into public.business_members (business_id, user_id, username, role)
    values (business_a, bob, 'Bob', 'employee'), (business_b, outsider, 'Alice', 'owner');
  begin
    insert into public.business_members (business_id, user_id, username, role)
      values (business_a, outsider, 'ALICE', 'employee');
    raise exception 'case-insensitive uniqueness failed';
  exception when unique_violation then null;
  end;
  begin
    perform private.hash_pin('abc');
    raise exception 'invalid PIN accepted';
  exception when invalid_parameter_value then null;
  end;
  hash := private.hash_pin('123456');
  if hash = '123456' or hash = private.hash_pin('123456') then
    raise exception 'PIN must be salted and hashed';
  end if;
  insert into private.member_pins (member_id, pin_hash) values (member_a, hash);
  for i in 1..5 loop
    if private.verify_member_pin(member_a, '0000') then raise exception 'wrong PIN accepted'; end if;
  end loop;
  if not exists (select 1 from private.member_pins where member_id = member_a and failed_attempts = 5 and locked_until > clock_timestamp()) then
    raise exception 'lock not established';
  end if;
  if private.verify_member_pin(member_a, '123456') then raise exception 'lock bypassed'; end if;
  update private.member_pins set locked_until = clock_timestamp() - interval '1 second' where member_id = member_a;
  if not private.verify_member_pin(member_a, '123456') then raise exception 'correct PIN rejected'; end if;
  if not exists (select 1 from private.member_pins where member_id = member_a and failed_attempts = 0 and locked_until is null) then
    raise exception 'attempts not reset';
  end if;
  if has_table_privilege('anon', 'public.profiles', 'SELECT')
    or has_table_privilege('authenticated', 'private.member_pins', 'SELECT')
    or has_table_privilege('authenticated', 'public.business_members', 'UPDATE')
    or has_function_privilege('authenticated', 'private.verify_member_pin(uuid,text)', 'EXECUTE') then
    raise exception 'excessive privileges';
  end if;
  if has_column_privilege('authenticated', 'public.business_members', 'internal_notes', 'SELECT') then
    raise exception 'administrative notes readable by authenticated';
  end if;
  foreach column_name in array array['id', 'business_id', 'user_id', 'username', 'role', 'status', 'created_at', 'updated_at', 'last_login_at'] loop
    if not has_column_privilege('authenticated', 'public.business_members', column_name, 'SELECT') then
      raise exception 'membership column % not readable', column_name;
    end if;
  end loop;
  if not has_column_privilege('service_role', 'public.business_members', 'internal_notes', 'SELECT')
    or not has_column_privilege('service_role', 'public.business_members', 'internal_notes', 'INSERT')
    or not has_column_privilege('service_role', 'public.business_members', 'internal_notes', 'UPDATE') then
    raise exception 'administrative notes unavailable to service_role';
  end if;
  perform set_config('request.jwt.claim.sub', alice::text, true);
  perform set_config('test.business_a', business_a::text, true);
  perform set_config('test.alice', alice::text, true);
end;
$$;

set local role authenticated;
do $$
begin
  if (select count(*) from public.businesses) <> 1 then raise exception 'business isolation failed'; end if;
  if (select count(*) from public.business_members) <> 2 then raise exception 'membership isolation failed'; end if;
  if (select count(*) from public.profiles) <> 2 then raise exception 'profile isolation failed'; end if;
  if not private.is_business_owner(current_setting('test.business_a')::uuid) then raise exception 'owner helper failed'; end if;
  begin
    perform internal_notes from public.business_members;
    raise exception 'administrative notes readable directly';
  exception when insufficient_privilege then null;
  end;
  begin
    insert into public.businesses (name, slug) values ('Forbidden', 'forbidden');
    raise exception 'browser write allowed';
  exception when insufficient_privilege then null;
  end;
  begin
    perform pin_hash from private.member_pins;
    raise exception 'secret readable';
  exception when insufficient_privilege then null;
  end;
end;
$$;
reset role;

update public.businesses set status = 'suspended' where id = current_setting('test.business_a')::uuid;
set local role authenticated;
do $$
begin
  if exists (select 1 from public.businesses) or exists (select 1 from public.business_members) then
    raise exception 'suspended business still visible';
  end if;
  if (select count(*) from public.profiles) <> 1 then raise exception 'own profile only expected'; end if;
end;
$$;
reset role;
update public.businesses set status = 'active' where id = current_setting('test.business_a')::uuid;
update public.business_members set status = 'suspended' where user_id = current_setting('test.alice')::uuid;
set local role authenticated;
do $$
begin
  if exists (select 1 from public.business_members) or (select count(*) from public.profiles) <> 1 then
    raise exception 'suspended member still sees colleagues';
  end if;
end;
$$;
reset role;
rollback;
