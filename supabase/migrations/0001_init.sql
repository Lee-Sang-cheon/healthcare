-- Form Coach — initial schema
-- Run this once in the Supabase Studio SQL editor (or via `supabase db push`).
-- All tables are protected by Row Level Security so each user can only see their own data.

------------------------------------------------------------
-- Extensions
------------------------------------------------------------
create extension if not exists "pgcrypto";

------------------------------------------------------------
-- profiles: per-user data that extends auth.users
------------------------------------------------------------
create table if not exists public.profiles (
  id          uuid primary key references auth.users (id) on delete cascade,
  email       text,
  height_cm   numeric(5,2),
  weight_kg   numeric(5,2),
  calibration jsonb,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

create or replace function public.touch_updated_at() returns trigger
language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end $$;

drop trigger if exists profiles_touch_updated_at on public.profiles;
create trigger profiles_touch_updated_at
  before update on public.profiles
  for each row execute function public.touch_updated_at();

-- Auto-create profile row whenever a new auth user is created.
create or replace function public.handle_new_auth_user() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  insert into public.profiles (id, email) values (new.id, new.email)
  on conflict (id) do nothing;
  return new;
end $$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_auth_user();

------------------------------------------------------------
-- sessions: one row per workout session
------------------------------------------------------------
create table if not exists public.sessions (
  id              uuid primary key default gen_random_uuid(),
  user_id         uuid not null references auth.users (id) on delete cascade,
  exercise_type   text not null,
  started_at      timestamptz not null default now(),
  ended_at        timestamptz,
  total_reps      integer not null default 0,
  avg_form_score  numeric(5,2)
);
create index if not exists sessions_user_started_idx
  on public.sessions (user_id, started_at desc);

------------------------------------------------------------
-- sets: one row per set within a session
------------------------------------------------------------
create table if not exists public.sets (
  id               uuid primary key default gen_random_uuid(),
  session_id       uuid not null references public.sessions (id) on delete cascade,
  set_number       integer not null,
  reps             integer not null default 0,
  avg_form_score   numeric(5,2),
  issues_detected  text[] not null default '{}',
  created_at       timestamptz not null default now(),
  unique (session_id, set_number)
);
create index if not exists sets_session_idx on public.sets (session_id);

------------------------------------------------------------
-- reps: one row per individual rep
-- keypoint_snapshot intentionally nullable — we only store it for problem reps.
------------------------------------------------------------
create table if not exists public.reps (
  id                 uuid primary key default gen_random_uuid(),
  set_id             uuid not null references public.sets (id) on delete cascade,
  rep_number         integer not null,
  form_score         numeric(5,2),
  issues             text[] not null default '{}',
  duration_ms        integer,
  keypoint_snapshot  jsonb,
  created_at         timestamptz not null default now(),
  unique (set_id, rep_number)
);
create index if not exists reps_set_idx on public.reps (set_id);

------------------------------------------------------------
-- session_muscle_load: aggregated activation estimates per muscle group
------------------------------------------------------------
create table if not exists public.session_muscle_load (
  id                      uuid primary key default gen_random_uuid(),
  session_id              uuid not null references public.sessions (id) on delete cascade,
  muscle_group            text not null,
  total_activation_score  numeric(7,2) not null default 0,
  peak_activation         numeric(5,2) not null default 0,
  unique (session_id, muscle_group)
);

------------------------------------------------------------
-- Row Level Security
------------------------------------------------------------
alter table public.profiles            enable row level security;
alter table public.sessions            enable row level security;
alter table public.sets                enable row level security;
alter table public.reps                enable row level security;
alter table public.session_muscle_load enable row level security;

-- profiles: each user owns their own row.
drop policy if exists "profiles self select" on public.profiles;
create policy "profiles self select" on public.profiles
  for select using (auth.uid() = id);
drop policy if exists "profiles self upsert" on public.profiles;
create policy "profiles self upsert" on public.profiles
  for update using (auth.uid() = id) with check (auth.uid() = id);

-- sessions: scoped by user_id.
drop policy if exists "sessions self all" on public.sessions;
create policy "sessions self all" on public.sessions
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- sets / reps / muscle_load: scoped via session ownership.
drop policy if exists "sets via session" on public.sets;
create policy "sets via session" on public.sets
  for all using (
    exists (select 1 from public.sessions s where s.id = sets.session_id and s.user_id = auth.uid())
  ) with check (
    exists (select 1 from public.sessions s where s.id = sets.session_id and s.user_id = auth.uid())
  );

drop policy if exists "reps via session" on public.reps;
create policy "reps via session" on public.reps
  for all using (
    exists (
      select 1
      from public.sets st
      join public.sessions s on s.id = st.session_id
      where st.id = reps.set_id and s.user_id = auth.uid()
    )
  ) with check (
    exists (
      select 1
      from public.sets st
      join public.sessions s on s.id = st.session_id
      where st.id = reps.set_id and s.user_id = auth.uid()
    )
  );

drop policy if exists "muscle_load via session" on public.session_muscle_load;
create policy "muscle_load via session" on public.session_muscle_load
  for all using (
    exists (select 1 from public.sessions s where s.id = session_muscle_load.session_id and s.user_id = auth.uid())
  ) with check (
    exists (select 1 from public.sessions s where s.id = session_muscle_load.session_id and s.user_id = auth.uid())
  );
