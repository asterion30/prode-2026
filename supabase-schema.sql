-- Schema for Prode 2026

-- Users table (Extends Supabase Auth users)
create table if not exists public.users (
  id uuid references auth.users on delete cascade not null primary key,
  alias text not null,              -- Se mantiene por compatibilidad; se setea como 'nombre apellido'
  nombre text not null default '',
  apellido text not null default '',
  legajo text not null default '',
  score integer default 0,
  is_banned boolean default false,
  last_jackpot_win text default null,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- Índice único en legajo para evitar doble registro con el mismo número
-- Se permite legajo vacío solo en la fila vacía de migración.
create unique index if not exists users_legajo_unique
  on public.users (legajo)
  where legajo != '';

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
  qualified_team text,
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
  qualified_team text,
  updated_at timestamp with time zone default timezone('utc'::text, now()) not null,
  unique(user_id, match_id)
);

-- Enable RLS
alter table public.users enable row level security;
-- alter table public.matches enable row level security; -- Matches can be public without RLS if we allow all reads
alter table public.predictions enable row level security;

-- Policies for public.users
-- El ranking público solo ve nombre, apellido y score (no legajo).
-- Para restringir columnas especificas en Supabase se usa una VIEW pública.
create policy "Users can view all users" 
  on public.users for select 
  using ( true );

create policy "Users can insert their own profile" 
  on public.users for insert 
  with check ( auth.uid() = id );

create policy "Users can update own profile" 
  on public.users for update 
  using ( auth.uid() = id );

-- Política adicional: permite actualizar cualquier perfil (para el panel admin).
-- La validación real de quién es admin se hace en el frontend.
create policy "Admin puede actualizar cualquier perfil"
  on public.users for update
  using ( true )
  with check ( true );

-- Política permisiva de DELETE para que el admin pueda eliminar usuarios desde el frontend.
-- Para producción con mayor seguridad, reemplazar 'true' por:
--   auth.uid() IN (SELECT id FROM public.users WHERE alias = 'asterion30')
-- pero requeriría que el admin tenga service_role o una Edge Function.
create policy "Admin puede eliminar usuarios"
  on public.users for delete
  using ( true );

-- Los admins pueden actualizar cualquier usuario (para el panel de admin)
-- NOTA: La validación de quién es admin se hace en el frontend.
-- Para mayor seguridad en producción, crear una tabla public.admins y usar auth.uid() IN (SELECT id FROM public.admins).

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
  actual_qualified text;
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
          
          -- Compare with user prediction for 90 min result
          if p.result = match_res then
             total_score := total_score + 1; -- 1 point for guessing the winner/tie
             
             -- 2 extra points for exact goals (3 total)
             if p.home_goals = m.home_goals and p.away_goals = m.away_goals then
                total_score := total_score + 2; 
             end if;
          end if;

          -- Compare with user prediction for qualified team (1 point)
          if p.qualified_team is not null and p.qualified_team != '' then
             actual_qualified := m.qualified_team;
             if actual_qualified is null or actual_qualified = '' then
                if m.home_goals::int > m.away_goals::int then actual_qualified := m.home_team;
                elsif m.away_goals::int > m.home_goals::int then actual_qualified := m.away_team;
                end if;
             end if;
             if actual_qualified is not null and p.qualified_team = actual_qualified then
                total_score := total_score + 1;
             end if;
          end if;
      end if;
    end loop;
    
    update public.users set score = total_score where id = u.id;
  end loop;
end;
$$ language plpgsql security definer set search_path = '';

-- ==========================================
-- ESPECIALES TABLE
-- ==========================================
drop table if exists public.especiales cascade;

create table public.especiales (
  user_id uuid references public.users on delete cascade not null primary key,
  favorito text,
  sorpresa text,
  decepcion text,
  updated_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- Grant explicit privileges to prevent default permission override issues
grant all on table public.especiales to postgres;
grant all on table public.especiales to authenticated;
grant all on table public.especiales to anon;
grant all on table public.especiales to service_role;

alter table public.especiales enable row level security;

create policy "Users can view all especiales" 
  on public.especiales for select 
  using ( true );

create policy "Users can insert their own especiales" 
  on public.especiales for insert 
  with check ( auth.uid() = user_id );

create policy "Users can update their own especiales" 
  on public.especiales for update 
  using ( auth.uid() = user_id )
  with check ( auth.uid() = user_id );

