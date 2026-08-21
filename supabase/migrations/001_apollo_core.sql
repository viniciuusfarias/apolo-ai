-- Apollo AI: persistent users, private tickets and automatic lottery data.
-- Apply this migration through the Supabase SQL Editor for the Apollo AI project.

create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  full_name text not null default '',
  email text not null default '',
  role text not null default 'user' check (role in ('user', 'admin')),
  last_seen_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.lottery_draws (
  id uuid primary key default gen_random_uuid(),
  game text not null,
  draw_date date not null,
  white_numbers integer[] not null,
  special_ball integer,
  multiplier text,
  jackpot text,
  next_draw_at timestamptz,
  draw_schedule jsonb not null default '[]'::jsonb,
  data_status text not null default 'available' check (data_status in ('available', 'unavailable')),
  synced_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  unique (game, draw_date)
);

create table if not exists public.lottery_sync_runs (
  id uuid primary key default gen_random_uuid(),
  game text not null,
  status text not null check (status in ('success', 'partial', 'failed')),
  records_synced integer not null default 0,
  started_at timestamptz not null default now(),
  completed_at timestamptz,
  error_message text
);

create table if not exists public.data_source_status (
  id uuid primary key default gen_random_uuid(),
  game text not null unique,
  status text not null check (status in ('connected', 'degraded', 'syncing', 'unavailable')),
  last_sync_at timestamptz,
  updated_at timestamptz not null default now()
);

create table if not exists public.saved_combinations (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  game text not null,
  numbers integer[] not null,
  special_ball integer,
  strategy text,
  score jsonb,
  created_at timestamptz not null default now()
);

create table if not exists public.onboarding_progress (
  user_id uuid primary key references auth.users(id) on delete cascade,
  completed boolean not null default false,
  completed_at timestamptz,
  updated_at timestamptz not null default now()
);

create table if not exists public.access_events (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete set null,
  event_type text not null,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index if not exists saved_combinations_user_id_created_at_idx
  on public.saved_combinations (user_id, created_at desc);
create index if not exists access_events_user_id_created_at_idx
  on public.access_events (user_id, created_at desc);

create or replace function public.set_updated_at()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer set search_path = public
as $$
begin
  insert into public.profiles (id, full_name, email)
  values (
    new.id,
    coalesce(new.raw_user_meta_data ->> 'full_name', ''),
    coalesce(new.email, '')
  )
  on conflict (id) do update set
    full_name = excluded.full_name,
    email = excluded.email,
    last_seen_at = now();
  return new;
end;
$$;

do $$
begin
  if not exists (
    select 1 from pg_trigger
    where tgname = 'on_apollo_auth_user_created' and tgrelid = 'auth.users'::regclass
  ) then
    execute 'create trigger on_apollo_auth_user_created after insert on auth.users for each row execute procedure public.handle_new_user()';
  end if;
end;
$$;

create or replace function public.is_admin()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.profiles
    where id = auth.uid() and role = 'admin'
  );
$$;

create or replace function public.protect_profile_role()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  if new.role is distinct from old.role then
    raise exception 'Role changes are restricted to administrators.';
  end if;
  return new;
end;
$$;

do $$
begin
  if not exists (select 1 from pg_trigger where tgname = 'profiles_updated_at' and tgrelid = 'public.profiles'::regclass) then
    execute 'create trigger profiles_updated_at before update on public.profiles for each row execute procedure public.set_updated_at()';
  end if;
  if not exists (select 1 from pg_trigger where tgname = 'profiles_protect_role' and tgrelid = 'public.profiles'::regclass) then
    execute 'create trigger profiles_protect_role before update on public.profiles for each row execute procedure public.protect_profile_role()';
  end if;
  if not exists (select 1 from pg_trigger where tgname = 'onboarding_progress_updated_at' and tgrelid = 'public.onboarding_progress'::regclass) then
    execute 'create trigger onboarding_progress_updated_at before update on public.onboarding_progress for each row execute procedure public.set_updated_at()';
  end if;
end;
$$;

alter table public.profiles enable row level security;
alter table public.lottery_draws enable row level security;
alter table public.lottery_sync_runs enable row level security;
alter table public.data_source_status enable row level security;
alter table public.saved_combinations enable row level security;
alter table public.onboarding_progress enable row level security;
alter table public.access_events enable row level security;

create policy "profiles: users read their own profile" on public.profiles
  for select using (auth.uid() = id or public.is_admin());
create policy "profiles: users update their own profile" on public.profiles
  for update using (auth.uid() = id or public.is_admin()) with check (auth.uid() = id or public.is_admin());

create policy "draws: authenticated users can read" on public.lottery_draws
  for select to authenticated using (true);
create policy "sync runs: admins can read" on public.lottery_sync_runs
  for select using (public.is_admin());
create policy "data status: authenticated users can read" on public.data_source_status
  for select to authenticated using (true);

create policy "saved combinations: users manage their own" on public.saved_combinations
  for all using (auth.uid() = user_id or public.is_admin())
  with check (auth.uid() = user_id or public.is_admin());
create policy "onboarding: users manage their own" on public.onboarding_progress
  for all using (auth.uid() = user_id or public.is_admin())
  with check (auth.uid() = user_id or public.is_admin());
create policy "access events: users can add their own" on public.access_events
  for insert with check (auth.uid() = user_id);
create policy "access events: admins can read" on public.access_events
  for select using (public.is_admin());

grant usage on schema public to authenticated;
grant select, update on public.profiles to authenticated;
grant select on public.lottery_draws, public.data_source_status to authenticated;
grant select on public.lottery_sync_runs to authenticated;
grant select, insert, update, delete on public.saved_combinations, public.onboarding_progress to authenticated;
grant select, insert on public.access_events to authenticated;

-- After you authenticate for the first time, promote only your own profile:
-- update public.profiles set role = 'admin' where email = 'YOUR_EMAIL';
