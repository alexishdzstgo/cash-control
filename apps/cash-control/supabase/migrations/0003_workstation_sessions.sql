-- Phase 2B.1. Apply separately as postgres. 0001/0002 are immutable.
begin;

create table private.workstation_sessions (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references public.businesses(id),
  created_by_member_id uuid not null references public.business_members(id),
  token_hash text not null unique check (token_hash ~ '^[0-9a-f]{64}$'),
  created_at timestamptz not null default clock_timestamp(),
  expires_at timestamptz not null,
  last_seen_at timestamptz not null default clock_timestamp(),
  revoked_at timestamptz,
  check (expires_at > created_at and expires_at <= created_at + interval '24 hours')
);
create table private.workstation_member_activations (
  workstation_session_id uuid not null references private.workstation_sessions(id),
  member_id uuid not null references public.business_members(id),
  authenticated_at timestamptz not null default clock_timestamp(),
  primary key (workstation_session_id, member_id)
);
create table private.operator_sessions (
  id uuid primary key default gen_random_uuid(),
  workstation_session_id uuid not null references private.workstation_sessions(id),
  member_id uuid not null references public.business_members(id),
  token_hash text not null unique check (token_hash ~ '^[0-9a-f]{64}$'),
  created_at timestamptz not null default clock_timestamp(),
  expires_at timestamptz not null,
  revoked_at timestamptz,
  foreign key (workstation_session_id, member_id)
    references private.workstation_member_activations(workstation_session_id, member_id),
  check (expires_at > created_at and expires_at <= created_at + interval '12 hours')
);
-- Issuance revokes the previous operator under a workstation row lock.
create unique index operator_sessions_current_station_key
  on private.operator_sessions(workstation_session_id) where revoked_at is null;
create index operator_sessions_workstation_idx on private.operator_sessions(workstation_session_id);

alter table private.workstation_sessions enable row level security;
alter table private.workstation_member_activations enable row level security;
alter table private.operator_sessions enable row level security;
revoke all on private.workstation_sessions, private.workstation_member_activations,
  private.operator_sessions from public, anon, authenticated, service_role;

create function public.admin_create_workstation_session(
  p_business_id uuid, p_created_by_member_id uuid, p_token_hash text, p_expires_at timestamptz
) returns uuid
language plpgsql security definer set search_path = ''
as $$
declare
  v_id uuid;
  v_now timestamptz;
begin
  perform 1 from public.businesses b join public.business_members m on m.business_id = b.id
    where b.id = p_business_id and b.status = 'active'
      and m.id = p_created_by_member_id and m.status = 'active' for share of b, m;
  if not found then raise exception 'Active business membership required' using errcode = '22023'; end if;
  v_now := clock_timestamp();
  if p_expires_at is null or p_expires_at <= v_now or p_expires_at > v_now + interval '24 hours' then
    raise exception 'Invalid workstation expiration' using errcode = '22023';
  end if;
  insert into private.workstation_sessions (business_id, created_by_member_id, token_hash, created_at, expires_at, last_seen_at)
    values (p_business_id, p_created_by_member_id, p_token_hash, v_now, p_expires_at, v_now)
    returning id into v_id;
  -- Caller must have verified the creator's password through Supabase Auth.
  insert into private.workstation_member_activations (workstation_session_id, member_id)
    values (v_id, p_created_by_member_id);
  return v_id;
end;
$$;

create function public.admin_activate_workstation_member(p_workstation_token_hash text, p_member_id uuid)
returns void
language plpgsql security definer set search_path = ''
as $$
declare v_station private.workstation_sessions%rowtype;
begin
  select w.* into v_station from private.workstation_sessions w
    where w.token_hash = p_workstation_token_hash for update;
  if not found or v_station.revoked_at is not null or v_station.expires_at <= clock_timestamp() then
    raise exception 'Invalid workstation' using errcode = '22023';
  end if;
  perform 1 from public.business_members m join public.businesses b on b.id = m.business_id
    where m.id = p_member_id and m.business_id = v_station.business_id
      and m.status = 'active' and b.status = 'active' for share of b, m;
  if not found then raise exception 'Active business membership required' using errcode = '22023'; end if;
  -- Password has already been verified by the trusted backend. No PIN here.
  insert into private.workstation_member_activations (workstation_session_id, member_id)
    values (v_station.id, p_member_id) on conflict (workstation_session_id, member_id) do nothing;
end;
$$;

create function public.admin_issue_operator_session(
  p_workstation_token_hash text, p_member_id uuid, p_token_hash text, p_expires_at timestamptz
) returns uuid
language plpgsql security definer set search_path = ''
as $$
declare
  v_station private.workstation_sessions%rowtype;
  v_id uuid;
  v_now timestamptz;
begin
  select w.* into v_station from private.workstation_sessions w
    where w.token_hash = p_workstation_token_hash for update;
  v_now := clock_timestamp();
  if not found or v_station.revoked_at is not null or v_station.expires_at <= v_now then
    raise exception 'Invalid workstation' using errcode = '22023';
  end if;
  perform 1 from private.workstation_member_activations a
    join public.business_members m on m.id = a.member_id
    join public.businesses b on b.id = m.business_id
    where a.workstation_session_id = v_station.id and a.member_id = p_member_id
      and m.business_id = v_station.business_id and m.status = 'active' and b.status = 'active'
    for share of b, m;
  if not found then raise exception 'Activated membership required' using errcode = '22023'; end if;
  v_now := clock_timestamp();
  if p_expires_at is null or p_expires_at <= v_now
    or p_expires_at > v_now + interval '12 hours' or p_expires_at > v_station.expires_at then
    raise exception 'Invalid operator expiration' using errcode = '22023';
  end if;
  update private.operator_sessions o set revoked_at = v_now
    where o.workstation_session_id = v_station.id and o.revoked_at is null;
  insert into private.operator_sessions (workstation_session_id, member_id, token_hash, created_at, expires_at)
    values (v_station.id, p_member_id, p_token_hash, v_now, p_expires_at) returning id into v_id;
  return v_id;
end;
$$;

create function public.admin_resolve_workstation_session(p_token_hash text)
returns table (workstation_session_id uuid, business_id uuid, business_slug text, workstation_expires_at timestamptz)
language plpgsql security definer set search_path = ''
as $$
begin
  -- Observational last_seen_at only: never renew TTL or implement idle timeout.
  return query
    with valid as (
      update private.workstation_sessions w set last_seen_at = clock_timestamp()
      from public.businesses b
      where w.token_hash = p_token_hash and w.revoked_at is null
        and w.expires_at > clock_timestamp() and b.id = w.business_id and b.status = 'active'
      returning w.id, w.business_id, b.slug, w.expires_at
    ) select v.id, v.business_id, v.slug, v.expires_at from valid v;
end;
$$;

-- The server must check activation BEFORE invoking the PIN wrapper. This RPC
-- returns no PIN/notes/hash and avoids direct access to the private schema.
create function public.admin_resolve_workstation_member(p_workstation_token_hash text, p_member_id uuid)
returns table (business_id uuid, member_id uuid, user_id uuid, username text, role public.member_role, display_name text)
language sql security definer set search_path = ''
as $$
  select w.business_id, m.id, m.user_id, m.username, m.role, p.display_name
  from private.workstation_sessions w
  join private.workstation_member_activations a on a.workstation_session_id = w.id
  join public.business_members m on m.id = a.member_id and m.business_id = w.business_id
  join public.businesses b on b.id = w.business_id
  join public.profiles p on p.id = m.user_id
  where w.token_hash = p_workstation_token_hash and m.id = p_member_id
    and w.revoked_at is null and w.expires_at > clock_timestamp()
    and b.status = 'active' and m.status = 'active';
$$;

create function public.admin_resolve_operator_session(p_token_hash text)
returns table (
  operator_session_id uuid, workstation_session_id uuid, business_id uuid,
  member_id uuid, user_id uuid, username text, role public.member_role, display_name text,
  operator_expires_at timestamptz, workstation_expires_at timestamptz
)
language sql security definer set search_path = ''
as $$
  select o.id, w.id, w.business_id, m.id, m.user_id, m.username, m.role, p.display_name,
    o.expires_at, w.expires_at
  from private.operator_sessions o
  join private.workstation_sessions w on w.id = o.workstation_session_id
  join public.businesses b on b.id = w.business_id
  join public.business_members m on m.id = o.member_id and m.business_id = w.business_id
  join public.profiles p on p.id = m.user_id
  where o.token_hash = p_token_hash and o.revoked_at is null and o.expires_at > clock_timestamp()
    and w.revoked_at is null and w.expires_at > clock_timestamp()
    and b.status = 'active' and m.status = 'active';
$$;

create function public.admin_verify_member_pin(p_member_id uuid, p_pin text)
returns boolean
language sql security definer set search_path = ''
as $$
  select private.verify_member_pin(p_member_id, p_pin);
$$;

create function public.admin_revoke_operator_session(p_token_hash text)
returns void
language sql security definer set search_path = ''
as $$
  update private.operator_sessions o set revoked_at = clock_timestamp()
    where o.token_hash = p_token_hash and o.revoked_at is null;
$$;

create function public.admin_revoke_workstation_session(p_token_hash text)
returns void
language plpgsql security definer set search_path = ''
as $$
declare v_station_id uuid;
begin
  -- Same lock order as issue/activate; no operator may survive a concurrent close.
  select w.id into v_station_id from private.workstation_sessions w
    where w.token_hash = p_token_hash for update;
  if not found then return; end if;
  update private.workstation_sessions w set revoked_at = coalesce(w.revoked_at, clock_timestamp())
    where w.id = v_station_id;
  update private.operator_sessions o set revoked_at = clock_timestamp()
    where o.workstation_session_id = v_station_id and o.revoked_at is null;
end;
$$;

-- Explicit allowlist; no changes to permissions on 0001/0002 functions.
do $$
declare v_signature text;
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
    execute pg_catalog.format('revoke all on function %s from public, anon, authenticated, service_role', v_signature);
    execute pg_catalog.format('grant execute on function %s to service_role', v_signature);
  end loop;
end;
$$;
commit;
