-- Phase 2C.1. Persisted shifts and participants; no financial state.
-- 0001-0005 are immutable and must already be applied.
begin;

create type public.shift_status as enum ('open', 'closed');
create type public.shift_participant_role as enum ('shift_responsible', 'operator');
create type public.shift_participant_status as enum ('active', 'left');

-- The redundant composite key lets the new tables enforce that every member
-- reference belongs to the same business as its shift.
alter table public.business_members
  add constraint business_members_id_business_key unique (id, business_id);

create sequence private.shift_folio_seq
  as bigint
  start with 1
  increment by 1
  no cycle;

create table private.shifts (
  id uuid primary key default extensions.gen_random_uuid(),
  business_id uuid not null references public.businesses(id),
  folio text not null
    check (folio ~ '^TUR-[0-9]{6,}$'),
  status public.shift_status not null default 'open',
  opened_at timestamptz not null default clock_timestamp(),
  closed_at timestamptz,
  opened_by_member_id uuid not null,
  responsible_member_id uuid not null,
  unique (id, business_id),
  unique (folio),
  constraint shifts_opened_by_member_business_fkey
    foreign key (opened_by_member_id, business_id)
    references public.business_members(id, business_id),
  constraint shifts_responsible_member_business_fkey
    foreign key (responsible_member_id, business_id)
    references public.business_members(id, business_id),
  check (
    (status = 'open' and closed_at is null)
    or (status = 'closed' and closed_at is not null)
  ),
  check (closed_at is null or closed_at >= opened_at)
);

create table private.shift_participants (
  id uuid primary key default extensions.gen_random_uuid(),
  shift_id uuid not null,
  business_id uuid not null,
  member_id uuid not null,
  role public.shift_participant_role not null default 'operator',
  status public.shift_participant_status not null default 'active',
  joined_at timestamptz not null default clock_timestamp(),
  left_at timestamptz,
  constraint shift_participants_shift_business_fkey
    foreign key (shift_id, business_id)
    references private.shifts(id, business_id),
  constraint shift_participants_member_business_fkey
    foreign key (member_id, business_id)
    references public.business_members(id, business_id),
  check (
    (status = 'active' and left_at is null)
    or (status = 'left' and left_at is not null)
  ),
  check (left_at is null or left_at >= joined_at)
);

-- One open shift per business is enforced by the database, including races.
create unique index shifts_open_business_key
  on private.shifts(business_id)
  where status = 'open';
create index shifts_business_idx on private.shifts(business_id);
create index shifts_opened_by_member_idx
  on private.shifts(opened_by_member_id);
create index shifts_responsible_member_idx
  on private.shifts(responsible_member_id);

-- The first column supports the shift participant listing; the business column
-- supports the composite foreign key and historical membership checks.
create index shift_participants_shift_idx
  on private.shift_participants(shift_id, business_id, status, joined_at);
create index shift_participants_member_idx
  on private.shift_participants(member_id, business_id);
create unique index shift_participants_active_member_key
  on private.shift_participants(shift_id, member_id)
  where status = 'active';
create unique index shift_participants_active_responsible_key
  on private.shift_participants(shift_id)
  where status = 'active' and role = 'shift_responsible';

alter table private.shifts enable row level security;
alter table private.shift_participants enable row level security;
revoke all on private.shifts, private.shift_participants
  from public, anon, authenticated, service_role;
revoke all on sequence private.shift_folio_seq
  from public, anon, authenticated, service_role;

-- Resolve and lock the operator row before a shift operation. The workstation
-- row is shared-locked first, matching closeWorkstation's lock order.
create function private.resolve_shift_operator(p_operator_token_hash text)
returns table (
  business_id uuid,
  member_id uuid,
  user_id uuid,
  system_role public.member_role
)
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_workstation_session_id uuid;
begin
  select o.workstation_session_id
    into v_workstation_session_id
    from private.operator_sessions o
   where o.token_hash = p_operator_token_hash;
  if not found then
    return;
  end if;

  perform 1
    from private.workstation_sessions w
   where w.id = v_workstation_session_id
     and w.revoked_at is null
     and w.expires_at > clock_timestamp()
   for share;
  if not found then
    return;
  end if;

  return query
    select w.business_id, m.id, m.user_id, m.role
      from private.operator_sessions o
      join private.workstation_sessions w on w.id = o.workstation_session_id
      join public.businesses b on b.id = w.business_id
      join public.business_members m
        on m.id = o.member_id and m.business_id = w.business_id
     where o.token_hash = p_operator_token_hash
       and p_operator_token_hash ~ '^[0-9a-f]{64}$'
       and o.revoked_at is null
       and o.expires_at > clock_timestamp()
       and w.revoked_at is null
       and w.expires_at > clock_timestamp()
       and b.status = 'active'
       and m.status = 'active'
     for share of o;
end;
$$;

-- Deferred checks allow a responsibility transfer to update both participant
-- rows and the shift projection before the transaction is validated.
create function private.assert_open_shift_responsible_for(p_shift_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_status public.shift_status;
  v_shift_responsible_member_id uuid;
  v_active_responsible_count bigint;
  v_participant_responsible_member_id uuid;
begin
  select s.status, s.responsible_member_id, count(p.id)
    into v_status, v_shift_responsible_member_id, v_active_responsible_count
    from private.shifts s
    left join private.shift_participants p
      on p.shift_id = s.id
     and p.status = 'active'
     and p.role = 'shift_responsible'
   where s.id = p_shift_id
   group by s.status, s.responsible_member_id;
  if not found or v_status <> 'open' then
    return;
  end if;

  select p.member_id
    into v_participant_responsible_member_id
    from private.shift_participants p
   where p.shift_id = p_shift_id
     and p.status = 'active'
     and p.role = 'shift_responsible'
   limit 1;

  if v_active_responsible_count <> 1
     or v_participant_responsible_member_id is distinct from v_shift_responsible_member_id then
    raise exception 'An open shift must have exactly one responsible participant.'
      using errcode = '23514';
  end if;
end;
$$;

create function private.assert_open_shift_responsible_shift_trigger()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if tg_op = 'DELETE' then
    perform private.assert_open_shift_responsible_for(old.id);
  else
    perform private.assert_open_shift_responsible_for(new.id);
    if tg_op = 'UPDATE' and old.id is distinct from new.id then
      perform private.assert_open_shift_responsible_for(old.id);
    end if;
  end if;
  return null;
end;
$$;

create function private.assert_open_shift_responsible_participant_trigger()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if tg_op = 'DELETE' then
    perform private.assert_open_shift_responsible_for(old.shift_id);
  else
    perform private.assert_open_shift_responsible_for(new.shift_id);
    if tg_op = 'UPDATE' and old.shift_id is distinct from new.shift_id then
      perform private.assert_open_shift_responsible_for(old.shift_id);
    end if;
  end if;
  return null;
end;
$$;

create constraint trigger shifts_responsible_invariant
after insert or update of status, closed_at, responsible_member_id
on private.shifts
deferrable initially deferred
for each row execute function private.assert_open_shift_responsible_shift_trigger();

create constraint trigger shift_participants_responsible_invariant
after insert or update of shift_id, business_id, role, status or delete
on private.shift_participants
deferrable initially deferred
for each row execute function private.assert_open_shift_responsible_participant_trigger();

create function public.admin_open_shift(p_operator_token_hash text)
returns table (
  shift_id uuid,
  folio text,
  status public.shift_status,
  opened_at timestamptz,
  responsible_member_id uuid
)
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_actor record;
  v_business_id uuid;
  v_shift_id uuid;
  v_folio text;
  v_now timestamptz;
begin
  select * into v_actor
    from private.resolve_shift_operator(p_operator_token_hash);
  if not found then
    raise exception 'Active operator session required.' using errcode = '22023';
  end if;

  select b.id into v_business_id
    from public.businesses b
   where b.id = v_actor.business_id and b.status = 'active'
   for update;
  if not found then
    raise exception 'Active business required.' using errcode = '22023';
  end if;

  if exists (
    select 1 from private.shifts s
     where s.business_id = v_business_id and s.status = 'open'
  ) then
    raise exception 'An open shift already exists for this business.' using errcode = '23505';
  end if;

  v_now := clock_timestamp();
  v_folio := pg_catalog.format(
    'TUR-%s',
    pg_catalog.to_char(nextval('private.shift_folio_seq'), 'FM000000')
  );
  insert into private.shifts (
    business_id, folio, status, opened_at, opened_by_member_id, responsible_member_id
  ) values (
    v_business_id, v_folio, 'open', v_now, v_actor.member_id, v_actor.member_id
  ) returning id into v_shift_id;

  insert into private.shift_participants (
    shift_id, business_id, member_id, role, status, joined_at
  ) values (
    v_shift_id, v_business_id, v_actor.member_id,
    'shift_responsible', 'active', v_now
  );

  return query
    select s.id, s.folio, s.status, s.opened_at, s.responsible_member_id
      from private.shifts s where s.id = v_shift_id;
end;
$$;

create function public.admin_add_shift_participant(
  p_operator_token_hash text,
  p_member_id uuid
)
returns table (
  shift_id uuid,
  member_id uuid,
  role public.shift_participant_role,
  status public.shift_participant_status,
  joined_at timestamptz,
  left_at timestamptz
)
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_actor record;
  v_shift private.shifts%rowtype;
  v_actor_role public.shift_participant_role;
  v_now timestamptz;
begin
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

  select p.role into v_actor_role
    from private.shift_participants p
   where p.shift_id = v_shift.id
     and p.member_id = v_actor.member_id
     and p.status = 'active'
   for update;
  if not found
     or (v_actor_role <> 'shift_responsible' and v_actor.system_role <> 'owner') then
    raise exception 'Active shift manager required.' using errcode = '42501';
  end if;

  perform 1
    from public.business_members m
    join public.businesses b on b.id = m.business_id
   where m.id = p_member_id
     and m.business_id = v_actor.business_id
     and m.status = 'active'
     and b.status = 'active'
   for share of b, m;
  if not found then
    raise exception 'Active member of this business required.' using errcode = '22023';
  end if;

  if exists (
    select 1 from private.shift_participants p
     where p.shift_id = v_shift.id
       and p.member_id = p_member_id
       and p.status = 'active'
  ) then
    raise exception 'Member already participates in this shift.' using errcode = '23505';
  end if;

  v_now := clock_timestamp();
  insert into private.shift_participants (
    shift_id, business_id, member_id, role, status, joined_at
  ) values (
    v_shift.id, v_shift.business_id, p_member_id, 'operator', 'active', v_now
  );

  return query
    select p.shift_id, p.member_id, p.role, p.status, p.joined_at, p.left_at
      from private.shift_participants p
     where p.shift_id = v_shift.id and p.member_id = p_member_id
       and p.status = 'active';
end;
$$;

create function public.admin_leave_shift(p_operator_token_hash text)
returns table (
  shift_id uuid,
  member_id uuid,
  role public.shift_participant_role,
  status public.shift_participant_status,
  joined_at timestamptz,
  left_at timestamptz
)
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_actor record;
  v_shift private.shifts%rowtype;
  v_participant private.shift_participants%rowtype;
  v_now timestamptz;
begin
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

  select p.* into v_participant
    from private.shift_participants p
   where p.shift_id = v_shift.id
     and p.member_id = v_actor.member_id
     and p.status = 'active'
   for update;
  if not found then
    raise exception 'Active shift participation required.' using errcode = '22023';
  end if;
  if v_participant.role = 'shift_responsible' then
    raise exception 'Transfer responsibility before leaving the shift.' using errcode = '42501';
  end if;

  v_now := clock_timestamp();
  update private.shift_participants p
     set status = 'left', left_at = v_now
   where p.id = v_participant.id;

  return query
    select p.shift_id, p.member_id, p.role, p.status, p.joined_at, p.left_at
      from private.shift_participants p where p.id = v_participant.id;
end;
$$;

create function public.admin_transfer_shift_responsibility(
  p_operator_token_hash text,
  p_new_responsible_member_id uuid
)
returns table (
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
begin
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
   where p.shift_id = v_shift.id
     and p.member_id = p_new_responsible_member_id
     and p.status = 'active'
   for update;
  if not found then
    raise exception 'New responsible must be an active participant.' using errcode = '22023';
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

  return query select v_shift.id, v_current.member_id, v_new.member_id;
end;
$$;

create function public.admin_resolve_open_shift(p_operator_token_hash text)
returns table (
  shift_id uuid,
  folio text,
  status public.shift_status,
  opened_at timestamptz,
  responsible_member_id uuid
)
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_actor record;
begin
  select * into v_actor
    from private.resolve_shift_operator(p_operator_token_hash);
  if not found then
    raise exception 'Active operator session required.' using errcode = '22023';
  end if;

  return query
    select s.id, s.folio, s.status, s.opened_at, s.responsible_member_id
      from private.shifts s
     where s.business_id = v_actor.business_id and s.status = 'open';
end;
$$;

create function public.admin_list_shift_participants(p_operator_token_hash text)
returns table (
  member_id uuid,
  username text,
  display_name text,
  role public.shift_participant_role,
  status public.shift_participant_status,
  joined_at timestamptz,
  left_at timestamptz
)
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_actor record;
  v_shift_id uuid;
begin
  select * into v_actor
    from private.resolve_shift_operator(p_operator_token_hash);
  if not found then
    raise exception 'Active operator session required.' using errcode = '22023';
  end if;

  select s.id into v_shift_id
    from private.shifts s
   where s.business_id = v_actor.business_id and s.status = 'open';
  if not found then
    return;
  end if;

  return query
    select p.member_id, m.username, pr.display_name, p.role, p.status,
           p.joined_at, p.left_at
      from private.shift_participants p
      join public.business_members m
        on m.id = p.member_id and m.business_id = p.business_id
      join public.profiles pr on pr.id = m.user_id
     where p.shift_id = v_shift_id
     order by p.joined_at, p.member_id;
end;
$$;

-- Private helpers and trigger functions are never callable by application roles.
do $$
declare
  v_signature text;
begin
  foreach v_signature in array array[
    'private.resolve_shift_operator(text)',
    'private.assert_open_shift_responsible_for(uuid)',
    'private.assert_open_shift_responsible_shift_trigger()',
    'private.assert_open_shift_responsible_participant_trigger()'
  ] loop
    execute pg_catalog.format(
      'revoke all on function %s from public, anon, authenticated, service_role',
      v_signature
    );
  end loop;
end;
$$;

-- Public names are retained for the trusted server-side RPC convention used by
-- 0002-0005; no browser role can execute them.
do $$
declare
  v_signature text;
begin
  foreach v_signature in array array[
    'public.admin_open_shift(text)',
    'public.admin_add_shift_participant(text,uuid)',
    'public.admin_leave_shift(text)',
    'public.admin_transfer_shift_responsibility(text,uuid)',
    'public.admin_resolve_open_shift(text)',
    'public.admin_list_shift_participants(text)'
  ] loop
    execute pg_catalog.format(
      'revoke all on function %s from public, anon, authenticated, service_role',
      v_signature
    );
    execute pg_catalog.format(
      'grant execute on function %s to service_role',
      v_signature
    );
  end loop;
end;
$$;

commit;
