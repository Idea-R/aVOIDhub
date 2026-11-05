-- SYNTHETIC LEGACY CONTRACT, NOT A PRODUCTION SCHEMA OR MIGRATION BASELINE.
-- The checked-in 202506/202507 SQL alters tables whose creation history is absent.
-- These are the minimum explicit preconditions read by that SQL, the foundation
-- migration, its pgTAP contract, and server callers. Types/defaults here are test
-- assumptions; this fixture cannot prove compatibility with any hosted database.
-- The native harness applies the checked-in 202506 and 202507 migrations, then
-- foundation and teams. Numeric columns below also exercise the already-correct
-- 202506 upgrade case; separate cases test old-column rename and ambiguity.
do $$ begin
  if not exists(select from pg_roles where rolname='anon') then create role anon nologin; end if;
  if not exists(select from pg_roles where rolname='authenticated') then create role authenticated nologin; end if;
  if not exists(select from pg_roles where rolname='service_role') then create role service_role nologin bypassrls; end if;
end $$;
create schema auth;
create schema extensions;
create table auth.users (
  id uuid primary key, email text, email_confirmed_at timestamptz,
  raw_user_meta_data jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);
create function auth.uid() returns uuid language sql stable as $$
  select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid
$$;
grant usage on schema public, auth to anon, authenticated, service_role;
grant execute on function auth.uid() to anon, authenticated, service_role;
create table public.games(game_key text primary key, is_active boolean not null default true);
create table public.user_profiles (
  id uuid primary key references auth.users(id),
  username text unique, display_name text, bio text, cursor_color text,
  social_links jsonb default '{}'::jsonb, is_public boolean default true,
  avatar_url text, country_code text, is_pro_member boolean default false,
  stripe_customer_id text, achievements jsonb default '[]'::jsonb,
  best_score bigint default 0,
  total_games_played integer default 0, total_meteors_destroyed integer default 0,
  total_survival_time numeric default 0,
  current_survival_time numeric default 0, total_distance_traveled numeric default 0,
  best_game_score integer default 0, best_game_meteors integer default 0,
  best_game_time numeric default 0, best_game_distance numeric default 0,
  created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);
create table public.leaderboard_scores (
  id uuid primary key default gen_random_uuid(), player_name text not null,
  score integer not null, user_id uuid references auth.users(id),
  game_session_id text, is_verified boolean default true,
  game_key text not null references public.games(game_key),
  created_at timestamptz not null default now()
);
create table public.game_scores(id uuid primary key default gen_random_uuid(), user_id uuid references auth.users(id), score integer);
create table public.leaderboard_scores_backup_manual as table public.leaderboard_scores with no data;
create table public.user_profiles_backup_manual as table public.user_profiles with no data;
-- Model the legacy browser-wide access that foundation intentionally closes.
grant all on all tables in schema public to anon, authenticated;
-- Include explicit column ACLs as well as table grants in the lockdown rehearsal.
grant update(best_score, stripe_customer_id) on public.user_profiles to authenticated;
grant select(player_name) on public.leaderboard_scores_backup_manual to anon;
alter table public.games enable row level security;
alter table public.user_profiles enable row level security;
alter table public.leaderboard_scores enable row level security;
alter table public.game_scores enable row level security;
create policy legacy_profiles on public.user_profiles for all using(true) with check(true);
create policy legacy_scores on public.leaderboard_scores for all using(true) with check(true);
create function public.legacy_untrusted_rpc() returns integer language sql security definer as 'select 1';
grant execute on function public.legacy_untrusted_rpc() to anon, authenticated;
