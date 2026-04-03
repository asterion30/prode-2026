-- Schema for Prode 2026

-- Users table (Extends Supabase Auth users)
create table if not exists public.users (
  id uuid references auth.users on delete cascade not null primary key,
  alias text not null,
  score integer default 0,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- Matches table
-- We can seed matches from the frontend or have an admin do it.
create table if not exists public.matches (
  id text primary key,
  stage text not null,
  home_team text not null,
  away_team text not null,
  match_date timestamp with time zone not null,
  home_flag text not null,
  away_flag text not null,
  home_goals text,
  away_goals text,
  status text default 'pending',
  tbd boolean default false
);

-- Predictions table
create table if not exists public.predictions (
  id uuid default uuid_generate_v4() primary key,
  user_id uuid references public.users on delete cascade not null,
  match_id text not null, -- Removed foreign key constraint to matches if we just push mock matches directly. If we want it strictly relational we can add references public.matches(id).
  result text,
  home_goals text,
  away_goals text,
  updated_at timestamp with time zone default timezone('utc'::text, now()) not null,
  unique(user_id, match_id)
);

-- Enable RLS
alter table public.users enable row level security;
-- alter table public.matches enable row level security; -- Matches can be public without RLS if we allow all reads
alter table public.predictions enable row level security;

-- Policies for public.users
create policy "Users can view all users" 
  on public.users for select 
  using ( true );

create policy "Users can insert their own profile" 
  on public.users for insert 
  with check ( auth.uid() = id );

create policy "Users can update own profile" 
  on public.users for update 
  using ( auth.uid() = id );

-- Policies for public.matches
-- Matches can be globally readable
alter table public.matches enable row level security;
create policy "Matches are readable by everyone"
  on public.matches for select
  using ( true );

create policy "Matches are insertable by everyone for MOCK sync"
  on public.matches for insert
  with check ( true );

-- Policies for public.predictions
create policy "Users can view all predictions" 
  on public.predictions for select 
  using ( true );

create policy "Users can insert their own predictions" 
  on public.predictions for insert 
  with check ( auth.uid() = user_id );

create policy "Users can update their own predictions" 
  on public.predictions for update 
  using ( auth.uid() = user_id );

-- Realtime Configuration
begin; 
  -- remove the supabase_realtime publication
  drop publication if exists supabase_realtime; 
  -- re-create the publication but don't enable it for any tables
  create publication supabase_realtime; 
commit;
-- add tables to the publication
alter publication supabase_realtime add table public.users;
alter publication supabase_realtime add table public.matches;
alter publication supabase_realtime add table public.predictions;

-- ==========================================
-- LEADERBOARD CALCULATION FUNCTION
-- ==========================================
-- This function calculates the score for all users.
-- Call this from the SQL Editor every time a match finishes, or set up a Supabase Edge Function/Cron.

create or replace function public.calculate_scores() returns void as $$
declare
  u record;
  p record;
  m record;
  total_score int;
  match_res text;
begin
  for u in select id from public.users loop
    total_score := 0;
    
    for p in select * from public.predictions where user_id = u.id loop
      select * into m from public.matches where id = p.match_id;
      
      if m.status = 'finished' and m.home_goals is not null and m.away_goals is not null then
          
          -- Calculate actual match result
          if m.home_goals::int > m.away_goals::int then match_res := 'L';
          elsif m.away_goals::int > m.home_goals::int then match_res := 'V';
          else match_res := 'E';
          end if;
          
          -- Compare with user prediction
          if p.result = match_res then
             total_score := total_score + 1; -- 1 point for guessing the winner/tie
             
             -- 2 extra points for exact goals (3 total)
             if p.home_goals = m.home_goals and p.away_goals = m.away_goals then
                total_score := total_score + 2; 
             end if;
          end if;
      end if;
    end loop;
    
    update public.users set score = total_score where id = u.id;
  end loop;
end;
$$ language plpgsql security definer;
