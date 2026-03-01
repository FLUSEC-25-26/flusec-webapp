-- ============================================================
-- FluSec RLS Policy Fix
-- Run this in Supabase SQL Editor to fix the team membership
-- circular dependency issue
-- ============================================================

-- Drop the broken circular policies
drop policy if exists "Team members visible to team" on public.team_members;
drop policy if exists "Team members can read teams" on public.teams;

-- Fix 1: team_members — users can simply read rows where they ARE the user
-- (no circular lookup needed)
create policy "Users see own membership" on public.team_members
  for select using (user_id = auth.uid());

-- Fix 2: Also allow users to see OTHER members of their own team
-- (needed for leader dashboard to list members)
create policy "Team members see teammates" on public.team_members
  for select using (
    team_id in (
      select team_id from public.team_members where user_id = auth.uid()
    )
  );

-- Fix 3: teams — a member can read their team (now safe because team_members policy above works)
create policy "Team members can read their team" on public.teams
  for select using (
    id in (
      select team_id from public.team_members where user_id = auth.uid()
    )
  );

-- Also allow team leaders to update their team
create policy "Leaders can update team" on public.teams
  for update using (leader_id = auth.uid());

-- Allow insert for team creation (authenticated users)
create policy "Authenticated users can create teams" on public.teams
  for insert with check (auth.uid() is not null);

-- Allow insert into team_members (for joining via invite code)
create policy "Authenticated users can join teams" on public.team_members
  for insert with check (auth.uid() is not null);

-- Allow leaders to delete (remove) members
create policy "Leaders can remove members" on public.team_members
  for delete using (
    team_id in (
      select id from public.teams where leader_id = auth.uid()
    )
  );
