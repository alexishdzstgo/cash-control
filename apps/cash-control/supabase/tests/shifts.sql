-- Disposable local/test Supabase, as postgres, after 0001-0006.
-- psql -v ON_ERROR_STOP=1 -f supabase/tests/shifts.sql
begin;

do $$
declare
  v_business uuid := gen_random_uuid();
  v_other_business uuid := gen_random_uuid();
  v_owner_user uuid := gen_random_uuid();
  v_employee_user uuid := gen_random_uuid();
  v_left_user uuid := gen_random_uuid();
  v_other_user uuid := gen_random_uuid();
  v_owner uuid;
  v_employee uuid;
  v_left uuid;
  v_other uuid;
  v_station uuid;
  v_other_station uuid;
  v_shift uuid;
  v_open record;
  v_participant record;
  v_i integer;
  v_signature text;
  v_table text;
  v_operator_hash text := repeat('a', 64);
  v_employee_operator_hash text := repeat('b', 64);
  v_left_operator_hash text := repeat('c', 64);
  v_other_operator_hash text := repeat('d', 64);
begin
  foreach v_signature in array array[
    'public.shift_status',
    'public.shift_participant_role',
    'public.shift_participant_status'
  ] loop
    if to_regtype(v_signature) is null then
      raise exception 'missing shift type: %', v_signature;
    end if;
  end loop;
  foreach v_signature in array array[
    'private.shifts',
    'private.shift_participants',
    'private.shift_folio_seq',
    'private.shifts_open_business_key',
    'private.shift_participants_active_member_key',
    'private.shift_participants_active_responsible_key'
  ] loop
    if to_regclass(v_signature) is null then
      raise exception 'missing shift object: %', v_signature;
    end if;
  end loop;
  foreach v_signature in array array[
    'public.admin_open_shift(text)',
    'public.admin_add_shift_participant(text,uuid)',
    'public.admin_leave_shift(text)',
    'public.admin_transfer_shift_responsibility(text,uuid)',
    'public.admin_resolve_open_shift(text)',
    'public.admin_list_shift_participants(text)'
  ] loop
    if not has_function_privilege('service_role', v_signature, 'EXECUTE')
      or has_function_privilege('anon', v_signature, 'EXECUTE')
      or has_function_privilege('authenticated', v_signature, 'EXECUTE') then
      raise exception 'wrong shift RPC privileges: %', v_signature;
    end if;
  end loop;
  if to_regprocedure('public.admin_close_shift(text)') is not null then
    raise exception 'financial shift close RPC must not exist yet';
  end if;
  foreach v_table in array array['private.shifts', 'private.shift_participants'] loop
    if has_table_privilege('anon', v_table, 'SELECT,INSERT,UPDATE,DELETE')
      or has_table_privilege('authenticated', v_table, 'SELECT,INSERT,UPDATE,DELETE')
      or has_table_privilege('service_role', v_table, 'SELECT,INSERT,UPDATE,DELETE') then
      raise exception 'direct shift table access granted: %', v_table;
    end if;
    if not (select c.relrowsecurity from pg_catalog.pg_class c where c.oid = v_table::regclass) then
      raise exception 'RLS missing: %', v_table;
    end if;
  end loop;
  if has_sequence_privilege('service_role', 'private.shift_folio_seq', 'USAGE') then
    raise exception 'folio sequence is directly accessible';
  end if;
  if not exists (
    select 1 from pg_catalog.pg_index i
     where i.indexrelid = 'private.shifts_open_business_key'::regclass
       and pg_catalog.pg_get_expr(i.indpred, i.indrelid) = '(status = ''open''::public.shift_status)'
  ) then
    raise exception 'open-shift partial unique index is missing';
  end if;

  if not exists (
    select 1 from pg_catalog.pg_constraint
     where conname = 'shift_participants_shift_business_fkey'
       and conrelid = 'private.shift_participants'::regclass
  ) or not exists (
    select 1 from pg_catalog.pg_constraint
     where conname = 'shift_participants_member_business_fkey'
       and conrelid = 'private.shift_participants'::regclass
  ) then
    raise exception 'business integrity composite foreign keys are missing';
  end if;

  insert into auth.users (id)
    values (v_owner_user), (v_employee_user), (v_left_user), (v_other_user);
  insert into public.businesses (id, name, slug) values
    (v_business, 'Shift Test', 'shift-' || v_business),
    (v_other_business, 'Other Shift Test', 'other-shift-' || v_other_business);
  v_owner := public.admin_provision_member(
    v_business, v_owner_user, 'Owner', 'Shift', 'Owner Shift', null,
    'owner', 'owner', '', '123456'
  );
  v_employee := public.admin_provision_member(
    v_business, v_employee_user, 'Employee', 'Shift', 'Employee Shift', null,
    'employee', 'employee', '', '2345'
  );
  v_left := public.admin_provision_member(
    v_business, v_left_user, 'Left', 'Shift', 'Left Shift', null,
    'left', 'employee', '', '3456'
  );
  v_other := public.admin_provision_member(
    v_other_business, v_other_user, 'Other', 'Business', 'Other Business', null,
    'other', 'owner', '', '4567'
  );

  v_station := public.admin_create_workstation_session(
    v_business, v_owner, repeat('1', 64), clock_timestamp() + interval '23 hours'
  );
  perform public.admin_activate_workstation_member(repeat('1', 64), v_employee);
  perform public.admin_activate_workstation_member(repeat('1', 64), v_left);
  perform public.admin_issue_operator_session(
    repeat('1', 64), v_owner, v_operator_hash, clock_timestamp() + interval '11 hours'
  );

  set local role anon;
  begin
    perform public.admin_open_shift(v_operator_hash);
    raise exception 'anon opened a shift';
  exception when insufficient_privilege then null; end;
  reset role;
  set local role authenticated;
  begin
    perform public.admin_resolve_open_shift(v_operator_hash);
    raise exception 'authenticated resolved a shift';
  exception when insufficient_privilege then null; end;
  reset role;

  set local role service_role;
  select * into v_open from public.admin_open_shift(v_operator_hash);
  reset role;
  v_shift := v_open.shift_id;
  if v_open.folio is distinct from 'TUR-000001'
    or v_open.status is distinct from 'open'::public.shift_status
    or v_open.responsible_member_id is distinct from v_owner then
    raise exception 'wrong initial shift projection';
  end if;
  if (select count(*) from private.shifts where business_id = v_business and status = 'open') <> 1
    or (select count(*) from private.shift_participants where shift_id = v_shift and status = 'active') <> 1
    or not exists (
      select 1 from private.shift_participants
       where shift_id = v_shift and member_id = v_owner
         and role = 'shift_responsible' and status = 'active'
    ) then
    raise exception 'opening did not create exactly one responsible participant';
  end if;

  -- The partial unique index is the database race guard for two open attempts.
  begin
    insert into private.shifts (
      business_id, folio, status, opened_at, opened_by_member_id, responsible_member_id
    ) values (
      v_business, 'TUR-999999', 'open', clock_timestamp(), v_owner, v_owner
    );
    raise exception 'second open shift bypassed unique constraint';
  exception when unique_violation then null; end;

  begin
    perform public.admin_open_shift(v_operator_hash);
    raise exception 'second open shift accepted';
  exception when unique_violation then null; end;

  perform public.admin_add_shift_participant(v_operator_hash, v_employee);
  begin
    perform public.admin_add_shift_participant(v_operator_hash, v_employee);
    raise exception 'duplicate active participant accepted';
  exception when unique_violation then null; end;
  begin
    perform public.admin_add_shift_participant(v_operator_hash, v_other);
    raise exception 'foreign-business participant accepted';
  exception when invalid_parameter_value then null; end;

  select * into v_participant
    from public.admin_list_shift_participants(v_operator_hash)
   where member_id = v_employee;
  if v_participant.username is distinct from 'employee'
    or v_participant.display_name is distinct from 'Employee Shift'
    or v_participant.role is distinct from 'operator'::public.shift_participant_role
    or v_participant.status is distinct from 'active'::public.shift_participant_status
    or to_jsonb(v_participant) ?| array['user_id', 'internal_notes', 'pin_hash', 'token_hash'] then
    raise exception 'participant projection is incorrect or leaked data';
  end if;

  perform public.admin_issue_operator_session(
    repeat('1', 64), v_employee, v_employee_operator_hash, clock_timestamp() + interval '11 hours'
  );
  perform public.admin_leave_shift(v_employee_operator_hash);
  if not exists (
    select 1 from private.shift_participants
     where shift_id = v_shift and member_id = v_employee
       and status = 'left' and left_at is not null
  ) then
    raise exception 'leave did not preserve participant history';
  end if;
  v_operator_hash := repeat('e', 64);
  perform public.admin_issue_operator_session(
    repeat('1', 64), v_owner, v_operator_hash, clock_timestamp() + interval '11 hours'
  );
  perform public.admin_add_shift_participant(v_operator_hash, v_employee);
  if (select count(*) from private.shift_participants where shift_id = v_shift and member_id = v_employee) <> 2 then
    raise exception 'historical rejoin was not allowed';
  end if;

  begin
    perform public.admin_leave_shift(v_operator_hash);
    raise exception 'responsible participant left without transfer';
  exception when insufficient_privilege then null; end;

  select * into v_open
    from public.admin_transfer_shift_responsibility(v_operator_hash, v_employee);
  if v_open.previous_responsible_member_id is distinct from v_owner
    or v_open.responsible_member_id is distinct from v_employee
    or (select responsible_member_id from private.shifts where id = v_shift) is distinct from v_employee
    or not exists (
      select 1 from private.shift_participants
       where shift_id = v_shift and member_id = v_owner and role = 'operator' and status = 'active'
    )
    or not exists (
      select 1 from private.shift_participants
       where shift_id = v_shift and member_id = v_employee
         and role = 'shift_responsible' and status = 'active'
    ) then
    raise exception 'responsibility transfer projection is incorrect';
  end if;

  -- The new responsible must be an active participant; a left participant is rejected.
  v_employee_operator_hash := repeat('f', 64);
  perform public.admin_issue_operator_session(
    repeat('1', 64), v_employee, v_employee_operator_hash, clock_timestamp() + interval '11 hours'
  );
  perform public.admin_add_shift_participant(v_employee_operator_hash, v_left);
  perform public.admin_issue_operator_session(
    repeat('1', 64), v_left, v_left_operator_hash, clock_timestamp() + interval '11 hours'
  );
  perform public.admin_leave_shift(v_left_operator_hash);
  v_employee_operator_hash := repeat('g', 64);
  perform public.admin_issue_operator_session(
    repeat('1', 64), v_employee, v_employee_operator_hash, clock_timestamp() + interval '11 hours'
  );
  begin
    perform public.admin_transfer_shift_responsibility(v_employee_operator_hash, v_left);
    raise exception 'responsibility transferred to left participant';
  exception when invalid_parameter_value then null; end;
  begin
    perform public.admin_leave_shift(v_employee_operator_hash);
    raise exception 'current responsible left without transfer';
  exception when insufficient_privilege then null; end;

  -- A different business has no shift visibility through the token-bound RPCs.
  v_other_station := public.admin_create_workstation_session(
    v_other_business, v_other, repeat('2', 64), clock_timestamp() + interval '23 hours'
  );
  perform public.admin_issue_operator_session(
    repeat('2', 64), v_other, v_other_operator_hash, clock_timestamp() + interval '11 hours'
  );
  if exists (select 1 from public.admin_resolve_open_shift(v_other_operator_hash))
    or exists (select 1 from public.admin_list_shift_participants(v_other_operator_hash)) then
    raise exception 'business isolation failed';
  end if;
end;
$$;
rollback;
