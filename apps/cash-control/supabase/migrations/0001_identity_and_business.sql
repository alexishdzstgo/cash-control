-- Phase 1 only. Apply as the migration owner (postgres), never from the browser.
begin;

create schema if not exists extensions;
create extension if not exists pgcrypto with schema extensions;
-- Supabase normally installs pgcrypto in extensions; support an existing install.
do $$
begin
  if exists (
    select 1 from pg_catalog.pg_extension e
    join pg_catalog.pg_namespace n on n.oid = e.extnamespace
    where e.extname = 'pgcrypto' and n.nspname <> 'extensions'
  ) then
    alter extension pgcrypto set schema extensions;
  end if;
end;
$$;

-- Keep private OUT of Data API exposed schemas (see persistence-plan.md).
create schema if not exists private;
revoke all on schema private from public, anon, authenticated;
grant usage on schema private to authenticated, service_role;
alter default privileges in schema private revoke execute on functions from public;
alter default privileges in schema private revoke all on tables from public, anon, authenticated;

create type public.business_status as enum ('active', 'suspended');
create type public.member_role as enum ('owner', 'employee');
create type public.member_status as enum ('active', 'suspended');

create table public.businesses (
  id uuid primary key default gen_random_uuid(),
  name text not null check (btrim(name) <> ''),
  slug text not null unique check (btrim(slug) <> ''),
  status public.business_status not null default 'active',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  first_name text not null,
  last_name text not null,
  display_name text not null,
  avatar jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.business_members (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references public.businesses(id),
  user_id uuid not null references public.profiles(id),
  username text not null check (username = btrim(username) and username <> ''),
  role public.member_role not null,
  status public.member_status not null default 'active',
  internal_notes text not null default '',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  last_login_at timestamptz,
  unique (business_id, user_id)
);
create unique index business_members_username_ci_key
  on public.business_members (business_id, lower(username));
create index business_members_user_id_idx
  on public.business_members (user_id, business_id);

create table private.member_pins (
  member_id uuid primary key references public.business_members(id) on delete cascade,
  pin_hash text not null,
  failed_attempts integer not null default 0 check (failed_attempts >= 0),
  locked_until timestamptz,
  updated_at timestamptz not null default now()
);

create function private.set_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at := clock_timestamp();
  return new;
end;
$$;
create trigger businesses_updated_at before update on public.businesses
  for each row execute function private.set_updated_at();
create trigger profiles_updated_at before update on public.profiles
  for each row execute function private.set_updated_at();
create trigger business_members_updated_at before update on public.business_members
  for each row execute function private.set_updated_at();
create trigger member_pins_updated_at before update on private.member_pins
  for each row execute function private.set_updated_at();

create function private.hash_pin(pin text)
returns text
language plpgsql
set search_path = ''
as $$
begin
  if pin is null or pin !~ '^[0-9]{4,6}$' then
    raise exception 'El PIN debe tener entre 4 y 6 dígitos.' using errcode = '22023';
  end if;
  return extensions.crypt(pin, extensions.gen_salt('bf', 12));
end;
$$;

-- Backend-only primitive, not a Data API RPC. Phase 2 must authorize the actor
-- and business before invoking it. Return false (do not raise) for failed PINs:
-- rolling back the surrounding transaction would roll back the rate limit too.
create function private.verify_member_pin(member_id uuid, pin text)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
declare
  secret private.member_pins%rowtype;
  checked_at timestamptz;
  attempts integer;
begin
  -- Serialize attempts for this member, including concurrent wrong/correct PINs.
  select p.* into secret from private.member_pins p
  where p.member_id = $1 for update;
  if not found then return false; end if;
  checked_at := clock_timestamp();
  if secret.locked_until is not null and secret.locked_until > checked_at then
    return false;
  end if;
  if not exists (
    select 1 from public.business_members m
    join public.businesses b on b.id = m.business_id
    where m.id = $1 and m.status = 'active' and b.status = 'active'
  ) then return false; end if;

  -- An expired lock starts a fresh attempt window.
  attempts := case when secret.locked_until is not null then 0 else secret.failed_attempts end;
  if pin is not null and pin ~ '^[0-9]{4,6}$'
     and extensions.crypt(pin, secret.pin_hash) = secret.pin_hash then
    update private.member_pins p set failed_attempts = 0, locked_until = null
      where p.member_id = $1;
    return true;
  end if;

  attempts := attempts + 1;
  update private.member_pins p
    set failed_attempts = attempts,
        locked_until = case when attempts >= 5 then checked_at + interval '5 minutes' else null end
    where p.member_id = $1;
  return false;
end;
$$;

-- Definer functions bypass their owner's RLS, avoiding membership recursion.
-- The migration owner must remain trusted and own the referenced tables.
create function private.is_business_member(business_id uuid)
returns boolean
language sql stable security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.business_members m
    join public.businesses b on b.id = m.business_id
    where m.business_id = $1 and m.user_id = (select auth.uid())
      and m.status = 'active' and b.status = 'active'
  );
$$;

create function private.is_business_owner(business_id uuid)
returns boolean
language sql stable security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.business_members m
    join public.businesses b on b.id = m.business_id
    where m.business_id = $1 and m.user_id = (select auth.uid())
      and m.status = 'active' and m.role = 'owner' and b.status = 'active'
  );
$$;

create function private.can_read_profile(profile_id uuid)
returns boolean
language sql stable security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.business_members viewer
    join public.businesses b on b.id = viewer.business_id
    join public.business_members target on target.business_id = viewer.business_id
    where viewer.user_id = (select auth.uid()) and viewer.status = 'active'
      and b.status = 'active' and target.user_id = $1
  );
$$;

alter table public.businesses enable row level security;
alter table public.profiles enable row level security;
alter table public.business_members enable row level security;
-- Defense in depth: no frontend grants and no policies for secrets.
alter table private.member_pins enable row level security;

revoke all on public.businesses, public.profiles, public.business_members from public, anon, authenticated;
grant select on public.businesses, public.profiles, public.business_members to authenticated;
grant select, insert, update, delete on public.businesses, public.profiles, public.business_members to service_role;
revoke all on private.member_pins from public, anon, authenticated, service_role;

-- Supabase can preconfigure default function grants: explicitly revoke all roles.
revoke all on function private.set_updated_at() from public, anon, authenticated, service_role;
revoke all on function private.hash_pin(text) from public, anon, authenticated, service_role;
revoke all on function private.verify_member_pin(uuid, text) from public, anon, authenticated, service_role;
revoke all on function private.is_business_member(uuid) from public, anon, authenticated, service_role;
revoke all on function private.is_business_owner(uuid) from public, anon, authenticated, service_role;
revoke all on function private.can_read_profile(uuid) from public, anon, authenticated, service_role;
grant execute on function private.is_business_member(uuid), private.is_business_owner(uuid), private.can_read_profile(uuid) to authenticated;
grant usage on schema extensions to service_role;
grant execute on function private.hash_pin(text), private.verify_member_pin(uuid, text) to service_role;

create policy businesses_select_member on public.businesses for select to authenticated
  using (private.is_business_member(id));
create policy business_members_select_member on public.business_members for select to authenticated
  using (private.is_business_member(business_id));
create policy profiles_select_self_or_colleague on public.profiles for select to authenticated
  using (id = (select auth.uid()) or private.can_read_profile(id));

commit;
