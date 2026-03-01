-- ============================================================
-- FluSec Web Platform — Supabase Database Schema
-- Run this in your Supabase project's SQL Editor
-- ============================================================

-- 1. Profiles (extends auth.users)
create table if not exists public.profiles (
  id          uuid primary key references auth.users(id) on delete cascade,
  full_name   text not null,
  avatar_url  text,
  role        text not null default 'member',
  created_at  timestamptz default now()
);

-- 2. Teams
create table if not exists public.teams (
  id           uuid primary key default gen_random_uuid(),
  name         text not null,
  description  text,
  invite_code  text unique not null,
  leader_id    uuid not null references public.profiles(id),
  created_at   timestamptz default now()
);

-- 3. Team Members
create table if not exists public.team_members (
  id         uuid primary key default gen_random_uuid(),
  team_id    uuid not null references public.teams(id) on delete cascade,
  user_id    uuid not null references public.profiles(id) on delete cascade,
  role       text not null default 'member',
  joined_at  timestamptz default now(),
  unique(team_id, user_id)
);

-- 4. Projects
create table if not exists public.projects (
  id          uuid primary key default gen_random_uuid(),
  team_id     uuid not null references public.teams(id) on delete cascade,
  name        text not null,
  description text,
  created_at  timestamptz default now()
);

-- 5. Scan Sessions
create table if not exists public.scan_sessions (
  id             uuid primary key default gen_random_uuid(),
  team_id        uuid not null references public.teams(id) on delete cascade,
  project_id     uuid references public.projects(id),
  uploaded_by    uuid not null references public.profiles(id),
  scanned_file   text not null,
  storage_path   text not null,
  total_count    int not null default 0,
  critical_count int not null default 0,
  high_count     int not null default 0,
  medium_count   int not null default 0,
  low_count      int not null default 0,
  scanned_at     timestamptz default now()
);

-- 6. Findings
create table if not exists public.findings (
  id             uuid primary key default gen_random_uuid(),
  session_id     uuid not null references public.scan_sessions(id) on delete cascade,
  team_id        uuid not null references public.teams(id),
  uploaded_by    uuid not null references public.profiles(id),
  module         text not null,
  rule_id        text,
  title          text not null,
  description    text,
  severity       text not null,
  file_path      text,
  line_number    int,
  code_snippet   text,
  owasp_category text,
  status         text default 'open',
  created_at     timestamptz default now()
);

-- 7. Fix Tasks (Phase 2 — schema ready now)
create table if not exists public.fix_tasks (
  id          uuid primary key default gen_random_uuid(),
  finding_id  uuid not null references public.findings(id) on delete cascade,
  team_id     uuid not null references public.teams(id),
  assigned_to uuid not null references public.profiles(id),
  assigned_by uuid not null references public.profiles(id),
  title       text not null,
  priority    text default 'medium',
  due_date    date,
  status      text default 'open',
  notes       text,
  created_at  timestamptz default now()
);

-- ============================================================
-- Row Level Security
-- ============================================================

alter table public.profiles      enable row level security;
alter table public.teams         enable row level security;
alter table public.team_members  enable row level security;
alter table public.projects      enable row level security;
alter table public.scan_sessions enable row level security;
alter table public.findings      enable row level security;
alter table public.fix_tasks     enable row level security;

-- profiles: users can read/write their own
create policy "Own profile" on public.profiles
  for all using (auth.uid() = id);

-- teams: team members can read; leader writes
create policy "Team members can read teams" on public.teams
  for select using (
    exists (select 1 from public.team_members where team_id = teams.id and user_id = auth.uid())
  );

-- team_members: visible to members of same team
create policy "Team members visible to team" on public.team_members
  for select using (
    exists (select 1 from public.team_members tm where tm.team_id = team_members.team_id and tm.user_id = auth.uid())
  );

-- findings: visible to team members
create policy "Findings visible to team members" on public.findings
  for select using (
    exists (select 1 from public.team_members where team_id = findings.team_id and user_id = auth.uid())
  );

-- ============================================================
-- Supabase Storage: create 'findings' bucket
-- ============================================================
-- Run this in Supabase Dashboard → Storage → New bucket:
-- Name: findings | Private: true

-- ============================================================
-- Auto-create profile on signup (Supabase trigger)
-- ============================================================

create or replace function public.handle_new_user()
returns trigger as $$
begin
  insert into public.profiles (id, full_name)
  values (new.id, coalesce(new.raw_user_meta_data->>'full_name', 'User'));
  return new;
end;
$$ language plpgsql security definer;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure public.handle_new_user();
