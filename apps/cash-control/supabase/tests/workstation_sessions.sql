-- Disposable local/test Supabase, as postgres, after 0001/0002/0003 only.
-- psql -v ON_ERROR_STOP=1 -f supabase/tests/workstation_sessions.sql
begin;
do $$
declare
  v_business uuid := gen_random_uuid();
  v_other_business uuid := gen_random_uuid();
  v_user uuid := gen_random_uuid();
  v_second_user uuid := gen_random_uuid();
  v_other_user uuid := gen_random_uuid();
  v_member uuid;
  v_second uuid;
  v_other uuid;
  v_station uuid;
  v_operator uuid;
  v_actor record;
  v_signature text;
  v_table text;
  v_i integer;
  v_station_hash text := repeat('a', 64);
  v_operator_hash text := repeat('b', 64);
begin
  foreach v_signature in array array[
    'public.admin_create_workstation_session(uuid,uuid,text,timestamptz)',
    'public.admin_activate_workstation_member(text,uuid)',
    'public.admin_issue_operator_session(text,uuid,text,timestamptz)',
    'public.admin_resolve_workstation_session(text)',
    'public.admin_resolve_workstation_member(text,uuid)',
    'public.admin_resolve_operator_session(text)',
    'public.admin_verify_member_pin(uuid,text)',
    'public.admin_revoke_operator_session(text)',
    'public.admin_revoke_workstation_session(text)'
  ] loop
    if has_function_privilege('anon', v_signature, 'EXECUTE')
      or has_function_privilege('authenticated', v_signature, 'EXECUTE')
      or not has_function_privilege('service_role', v_signature, 'EXECUTE') then
      raise exception 'wrong privileges: %', v_signature;
    end if;
  end loop;
  foreach v_table in array array['private.workstation_sessions', 'private.workstation_member_activations', 'private.operator_sessions'] loop
    if has_table_privilege('anon', v_table, 'SELECT,INSERT,UPDATE,DELETE')
      or has_table_privilege('authenticated', v_table, 'SELECT,INSERT,UPDATE,DELETE')
      or has_table_privilege('service_role', v_table, 'SELECT,INSERT,UPDATE,DELETE') then
      raise exception 'direct table access granted: %', v_table;
    end if;
    if not (select c.relrowsecurity from pg_catalog.pg_class c where c.oid = v_table::regclass) then
      raise exception 'RLS missing: %', v_table;
    end if;
  end loop;
  insert into auth.users (id) values (v_user), (v_second_user), (v_other_user);
  insert into public.businesses (id, name, slug) values
    (v_business, 'Station Test', 'station-' || v_business),
    (v_other_business, 'Other Test', 'station-' || v_other_business);
  v_member := public.admin_provision_member(v_business, v_user, 'Owner', 'Test', 'Owner Test', null, 'owner', 'owner', 'secret note', '123456');
  v_second := public.admin_provision_member(v_business, v_second_user, 'Second', 'Test', 'Second Test', null, 'second', 'employee', '', '2345');
  v_other := public.admin_provision_member(v_other_business, v_other_user, 'Other', 'Test', 'Other Test', null, 'other', 'owner', '', '3456');

  set local role anon;
  begin
    perform public.admin_create_workstation_session(v_business, v_member, v_station_hash, clock_timestamp() + interval '23 hours');
    raise exception 'anon created station';
  exception when insufficient_privilege then null; end;
  reset role;
  set local role authenticated;
  begin
    perform public.admin_resolve_operator_session(v_operator_hash);
    raise exception 'authenticated resolved operator';
  exception when insufficient_privilege then null; end;
  reset role;

  update public.businesses set status = 'suspended' where id = v_business;
  begin
    perform public.admin_create_workstation_session(v_business, v_member, v_station_hash, clock_timestamp() + interval '23 hours');
    raise exception 'suspended business accepted';
  exception when invalid_parameter_value then null; end;
  update public.businesses set status = 'active' where id = v_business;
  update public.business_members set status = 'suspended' where id = v_member;
  begin
    perform public.admin_create_workstation_session(v_business, v_member, v_station_hash, clock_timestamp() + interval '23 hours');
    raise exception 'suspended member accepted';
  exception when invalid_parameter_value then null; end;
  update public.business_members set status = 'active' where id = v_member;
  begin
    perform public.admin_create_workstation_session(v_business, v_other, v_station_hash, clock_timestamp() + interval '23 hours');
    raise exception 'foreign creator accepted';
  exception when invalid_parameter_value then null; end;
  begin
    perform public.admin_create_workstation_session(v_business, v_member, v_station_hash, clock_timestamp() + interval '25 hours');
    raise exception 'excessive workstation TTL accepted';
  exception when invalid_parameter_value then null; end;
  begin
    perform public.admin_create_workstation_session(v_business, v_member, v_station_hash, clock_timestamp() - interval '1 minute');
    raise exception 'past workstation expiration accepted';
  exception when invalid_parameter_value then null; end;

  set local role service_role;
  v_station := public.admin_create_workstation_session(v_business, v_member, v_station_hash, clock_timestamp() + interval '23 hours');
  reset role;
  if not exists (select 1 from private.workstation_member_activations a where a.workstation_session_id = v_station and a.member_id = v_member) then
    raise exception 'creator not activated';
  end if;
  begin
    perform public.admin_issue_operator_session(v_station_hash, v_second, v_operator_hash, clock_timestamp() + interval '11 hours');
    raise exception 'unactivated member accepted';
  exception when invalid_parameter_value then null; end;
  begin
    perform public.admin_activate_workstation_member(v_station_hash, v_other);
    raise exception 'cross-business activation accepted';
  exception when invalid_parameter_value then null; end;
  begin
    perform public.admin_issue_operator_session(v_station_hash, v_other, v_operator_hash, clock_timestamp() + interval '11 hours');
    raise exception 'cross-business operator accepted';
  exception when invalid_parameter_value then null; end;
  if exists (select 1 from public.admin_resolve_workstation_member(v_station_hash, v_second)) then raise exception 'unactivated member resolved'; end if;
  perform public.admin_activate_workstation_member(v_station_hash, v_second);
  perform public.admin_activate_workstation_member(v_station_hash, v_second);
  if (select count(*) from private.workstation_member_activations a where a.workstation_session_id = v_station and a.member_id = v_second) <> 1 then
    raise exception 'activation not idempotent';
  end if;
  begin
    perform public.admin_issue_operator_session(v_station_hash, v_second, v_operator_hash, clock_timestamp() + interval '13 hours');
    raise exception 'excessive operator TTL accepted';
  exception when invalid_parameter_value then null; end;
  set local role service_role;
  v_operator := public.admin_issue_operator_session(v_station_hash, v_second, v_operator_hash, clock_timestamp() + interval '11 hours');
  select * into v_actor from public.admin_resolve_operator_session(v_operator_hash);
  reset role;
  if v_actor.operator_session_id is distinct from v_operator
    or v_actor.workstation_session_id is distinct from v_station
    or v_actor.business_id is distinct from v_business
    or v_actor.member_id is distinct from v_second or v_actor.user_id is distinct from v_second_user then
    raise exception 'wrong actor resolved';
  end if;
  if to_jsonb(v_actor) ?| array['internal_notes','pin_hash','email','password','token_hash'] then raise exception 'resolver leaked secrets'; end if;
  select * into v_actor from public.admin_resolve_workstation_session(v_station_hash);
  if v_actor.workstation_session_id is distinct from v_station or to_jsonb(v_actor) ? 'token_hash' then raise exception 'wrong station projection'; end if;

  update public.business_members set status = 'suspended' where id = v_second;
  if exists (select 1 from public.admin_resolve_operator_session(v_operator_hash)) then raise exception 'suspended operator resolved'; end if;
  update public.business_members set status = 'active' where id = v_second;
  update public.businesses set status = 'suspended' where id = v_business;
  if exists (select 1 from public.admin_resolve_operator_session(v_operator_hash))
    or exists (select 1 from public.admin_resolve_workstation_session(v_station_hash)) then raise exception 'suspended business resolved'; end if;
  update public.businesses set status = 'active' where id = v_business;

  -- Replacing the operator revokes every previously issued token for this station.
  perform public.admin_issue_operator_session(v_station_hash, v_member, repeat('c',64), clock_timestamp() + interval '11 hours');
  if exists (select 1 from public.admin_resolve_operator_session(v_operator_hash)) then raise exception 'old operator survived switch'; end if;
  v_operator_hash := repeat('c',64);
  update private.operator_sessions set created_at = clock_timestamp() - interval '2 hours', expires_at = clock_timestamp() - interval '1 hour'
    where token_hash = v_operator_hash;
  if exists (select 1 from public.admin_resolve_operator_session(v_operator_hash)) then raise exception 'expired operator resolved'; end if;
  v_operator_hash := repeat('d',64);
  perform public.admin_issue_operator_session(v_station_hash, v_member, v_operator_hash, clock_timestamp() + interval '11 hours');
  perform public.admin_revoke_operator_session(v_operator_hash);
  perform public.admin_revoke_operator_session(v_operator_hash);
  if exists (select 1 from public.admin_resolve_operator_session(v_operator_hash)) then raise exception 'revoked operator resolved'; end if;
  if not exists (select 1 from public.admin_resolve_workstation_session(v_station_hash)) then raise exception 'lock closed workstation'; end if;

  -- Each false is a normal return; counters survive the RPC call.
  for v_i in 1..5 loop
    if public.admin_verify_member_pin(v_member, '0000') then raise exception 'wrong PIN accepted'; end if;
  end loop;
  if public.admin_verify_member_pin(v_member, '123456') then raise exception 'PIN lock bypassed'; end if;
  if not exists (select 1 from private.member_pins p where p.member_id = v_member and p.failed_attempts = 5 and p.locked_until > clock_timestamp()) then raise exception 'PIN attempts rolled back'; end if;

  update private.workstation_sessions set created_at = clock_timestamp() - interval '2 hours', expires_at = clock_timestamp() - interval '1 hour' where id = v_station;
  begin
    perform public.admin_activate_workstation_member(v_station_hash, v_second);
    raise exception 'expired workstation activated';
  exception when invalid_parameter_value then null; end;
  begin
    perform public.admin_issue_operator_session(v_station_hash, v_member, repeat('e',64), clock_timestamp() + interval '1 hour');
    raise exception 'expired workstation issued operator';
  exception when invalid_parameter_value then null; end;
  if exists (select 1 from public.admin_resolve_workstation_session(v_station_hash)) then raise exception 'expired workstation resolved'; end if;

  v_station_hash := repeat('f',64);
  v_station := public.admin_create_workstation_session(v_business, v_member, v_station_hash, clock_timestamp() + interval '1 hour');
  begin
    perform public.admin_issue_operator_session(v_station_hash, v_member, repeat('e',64), clock_timestamp() + interval '2 hours');
    raise exception 'operator outlived workstation';
  exception when invalid_parameter_value then null; end;
  v_operator_hash := repeat('e',64);
  perform public.admin_issue_operator_session(v_station_hash, v_member, v_operator_hash, clock_timestamp() + interval '30 minutes');
  perform public.admin_revoke_workstation_session(v_station_hash);
  perform public.admin_revoke_workstation_session(v_station_hash);
  if exists (select 1 from public.admin_resolve_operator_session(v_operator_hash))
    or exists (select 1 from public.admin_resolve_workstation_session(v_station_hash)) then raise exception 'close did not invalidate sessions'; end if;
  if exists (select 1 from private.operator_sessions o where o.workstation_session_id = v_station and o.revoked_at is null) then raise exception 'close left unrevoked operator rows'; end if;
  begin
    perform public.admin_activate_workstation_member(v_station_hash, v_second);
    raise exception 'revoked workstation activated';
  exception when invalid_parameter_value then null; end;
  begin
    perform public.admin_issue_operator_session(v_station_hash, v_member, repeat('1',64), clock_timestamp() + interval '10 minutes');
    raise exception 'revoked workstation issued operator';
  exception when invalid_parameter_value then null; end;
end;
$$;
rollback;
