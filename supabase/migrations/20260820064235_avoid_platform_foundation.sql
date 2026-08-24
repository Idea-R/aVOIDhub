-- aVOID platform foundation.
--
-- This is an intentionally coordinated migration: the run API and game clients must
-- deploy with it because direct browser writes to leaderboard_scores are removed.

create extension if not exists pgcrypto with schema extensions;

create table if not exists public.membership_plans (
  plan_key text primary key,
  name text not null,
  audience text not null,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.entitlement_definitions (
  entitlement_key text primary key,
  description text not null,
  created_at timestamptz not null default now()
);

create table if not exists public.plan_entitlements (
  plan_key text not null references public.membership_plans(plan_key) on delete cascade,
  entitlement_key text not null references public.entitlement_definitions(entitlement_key) on delete cascade,
  primary key (plan_key, entitlement_key)
);

create table if not exists public.user_entitlements (
  user_id uuid not null references auth.users(id) on delete cascade,
  entitlement_key text not null references public.entitlement_definitions(entitlement_key) on delete cascade,
  source text not null check (source in ('subscription', 'grant', 'migration')),
  source_reference text,
  starts_at timestamptz not null default now(),
  expires_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (user_id, entitlement_key)
);

-- These billing tables live in public only because the Supabase Data API is the
-- platform server's current persistence path. They have no client grants or policies.
create table if not exists public.billing_accounts (
  user_id uuid primary key references auth.users(id) on delete cascade,
  stripe_customer_id text not null unique,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.billing_subscriptions (
  stripe_subscription_id text primary key,
  user_id uuid not null references auth.users(id) on delete cascade,
  plan_key text not null references public.membership_plans(plan_key),
  stripe_price_id text,
  status text not null,
  cancel_at_period_end boolean not null default false,
  current_period_end timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.stripe_webhook_events (
  event_id text primary key,
  event_type text not null,
  livemode boolean not null,
  received_at timestamptz not null default now(),
  processed_at timestamptz,
  processing_error text
);

create table if not exists public.creator_applications (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  display_name text not null check (char_length(display_name) between 2 and 60),
  portfolio_url text,
  pitch text not null check (char_length(pitch) between 40 and 2000),
  status text not null default 'pending' check (status in ('pending', 'reviewing', 'approved', 'declined', 'withdrawn')),
  submitted_at timestamptz not null default now(),
  reviewed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index if not exists creator_applications_one_open_per_user
  on public.creator_applications(user_id)
  where status in ('pending', 'reviewing');

create table if not exists public.creator_profiles (
  user_id uuid primary key references auth.users(id) on delete cascade,
  slug text not null unique check (slug ~ '^[a-z0-9](?:[a-z0-9-]{1,38}[a-z0-9])?$'),
  display_name text not null check (char_length(display_name) between 2 and 60),
  bio text check (char_length(bio) <= 500),
  website_url text,
  is_published boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.game_submissions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  title text not null check (char_length(title) between 2 and 80),
  game_url text not null,
  source_url text,
  summary text not null check (char_length(summary) between 40 and 2000),
  requested_hosting text not null default 'directory' check (requested_hosting in ('directory', 'subdomain', 'managed')),
  status text not null default 'draft' check (status in ('draft', 'submitted', 'reviewing', 'changes_requested', 'approved', 'declined', 'withdrawn')),
  submitted_at timestamptz,
  reviewed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.game_favorites (
  user_id uuid not null references auth.users(id) on delete cascade,
  game_key text not null,
  created_at timestamptz not null default now(),
  primary key (user_id, game_key)
);

create table if not exists public.game_run_sessions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  game_key text not null,
  mode text not null default 'default' check (char_length(mode) between 1 and 40),
  ruleset_version text not null default 'v1',
  ticket_hash text not null check (ticket_hash ~ '^[a-f0-9]{64}$'),
  origin text,
  status text not null default 'started' check (status in ('started', 'finished', 'expired', 'rejected')),
  client_metadata jsonb not null default '{}'::jsonb,
  started_at timestamptz not null default now(),
  expires_at timestamptz not null,
  finished_at timestamptz,
  created_at timestamptz not null default now()
);

create index if not exists game_run_sessions_user_started_idx
  on public.game_run_sessions(user_id, started_at desc);

create table if not exists public.score_submissions (
  id uuid primary key default gen_random_uuid(),
  run_session_id uuid not null unique references public.game_run_sessions(id) on delete restrict,
  user_id uuid not null references auth.users(id) on delete cascade,
  game_key text not null,
  mode text not null,
  ruleset_version text not null default 'v1',
  score integer not null check (score >= 0),
  metrics jsonb not null default '{}'::jsonb,
  verification_level text not null default 'provisional' check (verification_level in ('provisional', 'validated', 'verified')),
  status text not null default 'accepted' check (status in ('accepted', 'rejected', 'review')),
  rejection_reason text,
  created_at timestamptz not null default now()
);

alter table public.game_run_sessions
  add column if not exists ruleset_version text not null default 'v1';
alter table public.score_submissions
  add column if not exists ruleset_version text not null default 'v1';

alter table public.leaderboard_scores add column if not exists submission_id uuid;
alter table public.leaderboard_scores add column if not exists verification_level text not null default 'legacy';
alter table public.leaderboard_scores add column if not exists metadata jsonb not null default '{}'::jsonb;

-- Every pre-foundation score is evidence of a historical play session, not proof of
-- a validated run. Preserve all rows while removing the unsafe legacy verified flag.
update public.leaderboard_scores
set is_verified = false,
    verification_level = 'legacy'
where submission_id is null;

alter table public.leaderboard_scores alter column is_verified set default false;
alter table public.leaderboard_scores alter column is_verified set not null;

do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conrelid = 'public.leaderboard_scores'::regclass
      and conname = 'leaderboard_scores_verification_level_check'
  ) then
    alter table public.leaderboard_scores
      add constraint leaderboard_scores_verification_level_check
      check (verification_level in ('legacy', 'provisional', 'validated', 'verified')) not valid;
  end if;

  if not exists (
    select 1 from pg_constraint
    where conrelid = 'public.leaderboard_scores'::regclass
      and conname = 'leaderboard_scores_verified_consistency_check'
  ) then
    alter table public.leaderboard_scores
      add constraint leaderboard_scores_verified_consistency_check
      check (is_verified = (verification_level = 'verified')) not valid;
  end if;

  if not exists (
    select 1 from pg_constraint
    where conrelid = 'public.game_run_sessions'::regclass
      and conname = 'game_run_sessions_ruleset_version_check'
  ) then
    alter table public.game_run_sessions
      add constraint game_run_sessions_ruleset_version_check
      check (ruleset_version ~ '^[a-zA-Z0-9._-]{1,40}$') not valid;
  end if;

  if not exists (
    select 1 from pg_constraint
    where conrelid = 'public.score_submissions'::regclass
      and conname = 'score_submissions_ruleset_version_check'
  ) then
    alter table public.score_submissions
      add constraint score_submissions_ruleset_version_check
      check (ruleset_version ~ '^[a-zA-Z0-9._-]{1,40}$') not valid;
  end if;

  if not exists (
    select 1 from pg_constraint
    where conrelid = 'public.game_favorites'::regclass
      and conname = 'game_favorites_game_key_fkey'
  ) then
    alter table public.game_favorites
      add constraint game_favorites_game_key_fkey
      foreign key (game_key) references public.games(game_key) on delete cascade not valid;
  end if;

  if not exists (
    select 1 from pg_constraint
    where conrelid = 'public.game_run_sessions'::regclass
      and conname = 'game_run_sessions_game_key_fkey'
  ) then
    alter table public.game_run_sessions
      add constraint game_run_sessions_game_key_fkey
      foreign key (game_key) references public.games(game_key) on delete restrict not valid;
  end if;

  if not exists (
    select 1 from pg_constraint
    where conrelid = 'public.score_submissions'::regclass
      and conname = 'score_submissions_game_key_fkey'
  ) then
    alter table public.score_submissions
      add constraint score_submissions_game_key_fkey
      foreign key (game_key) references public.games(game_key) on delete restrict not valid;
  end if;

  if not exists (
    select 1 from pg_constraint
    where conrelid = 'public.leaderboard_scores'::regclass
      and conname = 'leaderboard_scores_submission_id_fkey'
  ) then
    alter table public.leaderboard_scores
      add constraint leaderboard_scores_submission_id_fkey
      foreign key (submission_id) references public.score_submissions(id) on delete restrict not valid;
  end if;
end;
$$;

alter table public.leaderboard_scores validate constraint leaderboard_scores_verification_level_check;
alter table public.leaderboard_scores validate constraint leaderboard_scores_verified_consistency_check;
alter table public.game_run_sessions validate constraint game_run_sessions_ruleset_version_check;
alter table public.score_submissions validate constraint score_submissions_ruleset_version_check;
alter table public.game_favorites validate constraint game_favorites_game_key_fkey;
alter table public.game_run_sessions validate constraint game_run_sessions_game_key_fkey;
alter table public.score_submissions validate constraint score_submissions_game_key_fkey;
alter table public.leaderboard_scores validate constraint leaderboard_scores_submission_id_fkey;

create unique index if not exists leaderboard_scores_submission_unique
  on public.leaderboard_scores(submission_id)
  where submission_id is not null;

create index if not exists user_entitlements_entitlement_idx
  on public.user_entitlements(entitlement_key);
create index if not exists billing_subscriptions_user_idx
  on public.billing_subscriptions(user_id);
create index if not exists billing_subscriptions_plan_idx
  on public.billing_subscriptions(plan_key);
create index if not exists creator_applications_user_idx
  on public.creator_applications(user_id, submitted_at desc);
create index if not exists game_submissions_user_idx
  on public.game_submissions(user_id, created_at desc);
create index if not exists game_favorites_game_idx
  on public.game_favorites(game_key);
create index if not exists game_run_sessions_game_status_idx
  on public.game_run_sessions(game_key, status, started_at desc);
create index if not exists score_submissions_user_created_idx
  on public.score_submissions(user_id, created_at desc);
create index if not exists score_submissions_game_score_idx
  on public.score_submissions(game_key, mode, score desc, created_at asc);

insert into public.membership_plans (plan_key, name, audience) values
  ('player', 'Founding player', 'player'),
  ('creator', 'Creator', 'creator')
on conflict (plan_key) do update set
  name = excluded.name,
  audience = excluded.audience,
  updated_at = now();

insert into public.entitlement_definitions (entitlement_key, description) values
  ('platform.ad_free', 'Do not request platform display ads for this member.'),
  ('profile.founding_mark', 'Display the founding player profile mark.'),
  ('experiments.early_access', 'Access selected early platform experiments.'),
  ('cosmetics.supporter', 'Receive supporter cosmetics in games that implement them.'),
  ('creator.submit_game', 'Use paid submission capacity after creator approval.')
on conflict (entitlement_key) do update set description = excluded.description;

insert into public.plan_entitlements (plan_key, entitlement_key) values
  ('player', 'platform.ad_free'),
  ('player', 'profile.founding_mark'),
  ('player', 'experiments.early_access'),
  ('player', 'cosmetics.supporter'),
  ('creator', 'platform.ad_free'),
  ('creator', 'profile.founding_mark'),
  ('creator', 'experiments.early_access'),
  ('creator', 'cosmetics.supporter'),
  ('creator', 'creator.submit_game')
on conflict do nothing;

alter table public.membership_plans enable row level security;
alter table public.entitlement_definitions enable row level security;
alter table public.plan_entitlements enable row level security;
alter table public.user_entitlements enable row level security;
alter table public.billing_accounts enable row level security;
alter table public.billing_subscriptions enable row level security;
alter table public.stripe_webhook_events enable row level security;
alter table public.creator_applications enable row level security;
alter table public.creator_profiles enable row level security;
alter table public.game_submissions enable row level security;
alter table public.game_favorites enable row level security;
alter table public.game_run_sessions enable row level security;
alter table public.score_submissions enable row level security;

-- Start from a deny-by-default Data API surface. Production currently grants all
-- table privileges to both browser roles, including the two manual backup tables.
revoke all on all tables in schema public from public, anon, authenticated;
alter default privileges in schema public revoke all on tables from public, anon, authenticated;
alter default privileges in schema public revoke execute on functions from public;

grant select on public.games, public.leaderboard_scores to anon, authenticated;
grant select on public.user_profiles to anon, authenticated;
grant update (username, bio, cursor_color, social_links, is_public, display_name, avatar_url, country_code)
  on public.user_profiles to authenticated;
grant select on public.membership_plans, public.entitlement_definitions, public.plan_entitlements
  to anon, authenticated;
grant select on public.user_entitlements, public.creator_applications, public.game_submissions
  to authenticated;
grant select on public.creator_profiles to anon, authenticated;
grant select, insert, delete on public.game_favorites to authenticated;
grant all on public.membership_plans, public.entitlement_definitions,
  public.plan_entitlements, public.user_entitlements, public.billing_accounts,
  public.billing_subscriptions, public.stripe_webhook_events,
  public.creator_applications, public.creator_profiles, public.game_submissions,
  public.game_favorites, public.game_run_sessions, public.score_submissions,
  public.games, public.leaderboard_scores, public.user_profiles, public.game_scores
  to service_role;

-- The server API owns application and submission mutations. Favorites remain the
-- one low-risk direct client write and are constrained to the current user's row.
do $$
declare
  policy_record record;
begin
  for policy_record in
    select schemaname, tablename, policyname
    from pg_policies
    where schemaname = 'public'
      and tablename in (
        'games', 'leaderboard_scores', 'user_profiles', 'game_scores',
        'leaderboard_scores_backup_manual', 'user_profiles_backup_manual',
        'membership_plans', 'entitlement_definitions', 'plan_entitlements',
        'user_entitlements', 'billing_accounts', 'billing_subscriptions',
        'stripe_webhook_events', 'creator_applications', 'creator_profiles',
        'game_submissions', 'game_favorites', 'game_run_sessions', 'score_submissions'
      )
  loop
    execute format('drop policy %I on %I.%I', policy_record.policyname,
      policy_record.schemaname, policy_record.tablename);
  end loop;
end;
$$;

create policy "Active games are public" on public.games
  for select to anon, authenticated using (is_active is true);
create policy "Leaderboard scores are public" on public.leaderboard_scores
  for select to anon, authenticated using (true);
create policy "Public or owned profiles are readable" on public.user_profiles
  for select to anon, authenticated
  using (is_public is true or (select auth.uid()) = id);
create policy "Users update own profile presentation" on public.user_profiles
  for update to authenticated
  using ((select auth.uid()) = id)
  with check ((select auth.uid()) = id);

create policy "Membership plans are public" on public.membership_plans
  for select to anon, authenticated using (is_active is true);
create policy "Entitlement definitions are public" on public.entitlement_definitions
  for select to anon, authenticated using (true);
create policy "Plan entitlements are public" on public.plan_entitlements
  for select to anon, authenticated using (true);
create policy "Users read own entitlements" on public.user_entitlements
  for select to authenticated using ((select auth.uid()) = user_id);
create policy "Users read own creator applications" on public.creator_applications
  for select to authenticated using ((select auth.uid()) = user_id);
create policy "Published creator profiles are public" on public.creator_profiles
  for select to anon, authenticated
  using (is_published is true or (select auth.uid()) = user_id);
create policy "Users read own game submissions" on public.game_submissions
  for select to authenticated using ((select auth.uid()) = user_id);
create policy "Users read own favorites" on public.game_favorites
  for select to authenticated using ((select auth.uid()) = user_id);
create policy "Users add own favorites" on public.game_favorites
  for insert to authenticated with check ((select auth.uid()) = user_id);
create policy "Users remove own favorites" on public.game_favorites
  for delete to authenticated using ((select auth.uid()) = user_id);

-- Privacy-first profiles: new rows are private, and the 15 legacy rows are held
-- private until their owners choose to publish them from the rebuilt profile UI.
alter table public.user_profiles alter column is_public set default false;

-- Retire browser-era side effects before the new server-owned score path is used.
drop trigger if exists trigger_update_user_stats_on_score_insert on public.leaderboard_scores;
drop trigger if exists trigger_sync_leaderboard_player_name on public.user_profiles;
drop trigger if exists update_user_profiles_updated_at on public.user_profiles;
drop function if exists public.update_user_profile_stats();
drop function if exists public.sync_leaderboard_player_name();

update public.user_profiles set is_public = false where is_public is distinct from false;

-- Remove every inherited or explicit Data API execute grant, then add back only the
-- two service-role functions needed by the foundation workflow.
revoke execute on all functions in schema public from public, anon, authenticated;

create or replace function public.create_user_profile()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_display_name text;
  v_username text;
begin
  v_display_name := coalesce(
    nullif(btrim(new.raw_user_meta_data ->> 'display_name'), ''),
    'Player'
  );
  v_display_name := left(v_display_name, 60);
  v_username := 'player-' || left(replace(new.id::text, '-', ''), 20);

  insert into public.user_profiles (
    id, username, display_name, bio, cursor_color, social_links, is_public,
    total_games_played, total_meteors_destroyed, total_survival_time,
    created_at, updated_at
  ) values (
    new.id, v_username, v_display_name, null, '#06b6d4', '{}'::jsonb, false,
    0, 0, 0, now(), now()
  )
  on conflict (id) do nothing;

  return new;
end;
$$;

create or replace function public.backfill_missing_profiles()
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_profiles_created integer;
begin
  insert into public.user_profiles (
    id, username, display_name, bio, cursor_color, social_links, is_public,
    total_games_played, total_meteors_destroyed, total_survival_time,
    created_at, updated_at
  )
  select
    au.id,
    'player-' || left(replace(au.id::text, '-', ''), 20),
    left(coalesce(nullif(btrim(au.raw_user_meta_data ->> 'display_name'), ''), 'Player'), 60),
    null,
    '#06b6d4',
    '{}'::jsonb,
    false,
    0,
    0,
    0,
    au.created_at,
    now()
  from auth.users as au
  left join public.user_profiles as up on up.id = au.id
  where up.id is null
  on conflict (id) do nothing;

  get diagnostics v_profiles_created = row_count;
  return v_profiles_created;
end;
$$;

create or replace function public.update_updated_at_column()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.create_user_profile();

create trigger update_user_profiles_updated_at
  before update on public.user_profiles
  for each row execute function public.update_updated_at_column();

drop function if exists public.update_game_statistics(
  uuid, integer, integer, numeric, numeric, integer, integer, numeric, numeric
);
create or replace function public.update_game_statistics(
  p_user_id uuid,
  games_increment integer default 0,
  meteors_increment integer default 0,
  survival_increment numeric default 0,
  distance_increment numeric default 0,
  current_score integer default 0,
  current_meteors integer default 0,
  current_survival_time numeric default 0,
  current_distance numeric default 0
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if games_increment not between 0 and 1
    or meteors_increment not between 0 and 100000
    or survival_increment not between 0 and 86400
    or distance_increment not between 0 and 1000000000
    or current_score not between 0 and 2000000000
    or current_meteors not between 0 and 100000
    or current_survival_time not between 0 and 86400
    or current_distance not between 0 and 1000000000 then
    raise exception 'statistics_out_of_range' using errcode = '22003';
  end if;

  update public.user_profiles as up set
    total_games_played = coalesce(up.total_games_played, 0) + games_increment,
    total_meteors_destroyed = coalesce(up.total_meteors_destroyed, 0) + meteors_increment,
    total_survival_time = coalesce(up.total_survival_time, 0) + survival_increment,
    total_distance_traveled = coalesce(up.total_distance_traveled, 0) + distance_increment,
    best_game_score = greatest(coalesce(up.best_game_score, 0), current_score),
    best_game_meteors = greatest(coalesce(up.best_game_meteors, 0), current_meteors),
    best_game_time = greatest(coalesce(up.best_game_time, 0), current_survival_time),
    best_game_distance = greatest(coalesce(up.best_game_distance, 0), current_distance),
    updated_at = now()
  where up.id = p_user_id;

  if not found then
    raise exception 'profile_not_found' using errcode = 'P0002';
  end if;
end;
$$;

revoke all on function public.create_user_profile() from public, anon, authenticated;
revoke all on function public.update_updated_at_column() from public, anon, authenticated;
revoke all on function public.update_game_statistics(uuid, integer, integer, numeric, numeric, integer, integer, numeric, numeric)
  from public, anon, authenticated;
grant execute on function public.update_game_statistics(uuid, integer, integer, numeric, numeric, integer, integer, numeric, numeric)
  to service_role;
revoke all on function public.backfill_missing_profiles() from public, anon, authenticated;
grant execute on function public.backfill_missing_profiles() to service_role;

create or replace function public.finish_provisional_run(
  p_run_id uuid,
  p_user_id uuid,
  p_ticket_hash text,
  p_score integer,
  p_metrics jsonb default '{}'::jsonb
)
returns table (submission_id uuid, leaderboard_score_id uuid, verification_level text)
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_run public.game_run_sessions%rowtype;
  v_submission_id uuid;
  v_leaderboard_id uuid;
  v_verification_level text;
  v_player_name text;
begin
  if p_score < 0 or p_score > 2147483647 then
    raise exception 'score_out_of_range' using errcode = '22003';
  end if;
  if jsonb_typeof(coalesce(p_metrics, '{}'::jsonb)) <> 'object'
    or octet_length(coalesce(p_metrics, '{}'::jsonb)::text) > 8192 then
    raise exception 'metrics_invalid' using errcode = '22023';
  end if;
  if p_ticket_hash !~ '^[a-f0-9]{64}$' then
    raise exception 'invalid_run_ticket' using errcode = '28000';
  end if;

  select * into v_run
  from public.game_run_sessions
  where id = p_run_id
  for update;

  if not found or v_run.user_id <> p_user_id then
    raise exception 'run_not_found' using errcode = 'P0002';
  end if;
  if v_run.ticket_hash <> p_ticket_hash then
    raise exception 'invalid_run_ticket' using errcode = '28000';
  end if;
  if v_run.status = 'finished' then
    select submission.id, leaderboard.id, submission.verification_level
    into v_submission_id, v_leaderboard_id, v_verification_level
    from public.score_submissions as submission
    join public.leaderboard_scores as leaderboard
      on leaderboard.submission_id = submission.id
    where submission.run_session_id = v_run.id;

    if not found then
      raise exception 'run_receipt_incomplete' using errcode = 'P0002';
    end if;

    return query select v_submission_id, v_leaderboard_id, v_verification_level;
    return;
  end if;
  if v_run.status <> 'started' then
    raise exception 'run_already_consumed' using errcode = '23505';
  end if;
  if v_run.expires_at <= now() then
    raise exception 'run_expired' using errcode = '22023';
  end if;
  insert into public.score_submissions (
    run_session_id, user_id, game_key, mode, ruleset_version, score, metrics,
    verification_level, status
  ) values (
    v_run.id, v_run.user_id, v_run.game_key, v_run.mode, v_run.ruleset_version, p_score,
    coalesce(p_metrics, '{}'::jsonb), 'provisional', 'accepted'
  ) returning id into v_submission_id;

  select coalesce(nullif(display_name, ''), nullif(username, ''), 'player') into v_player_name
  from public.user_profiles where id = v_run.user_id;
  v_player_name := left(coalesce(v_player_name, 'player'), 50);

  insert into public.leaderboard_scores (
    player_name, score, user_id, game_session_id, is_verified, game_key,
    submission_id, verification_level, metadata
  ) values (
    v_player_name, p_score, v_run.user_id, v_run.id::text, false, v_run.game_key,
    v_submission_id, 'provisional', coalesce(p_metrics, '{}'::jsonb) || jsonb_build_object(
      'mode', v_run.mode,
      'rulesetVersion', v_run.ruleset_version
    )
  ) returning id into v_leaderboard_id;

  update public.game_run_sessions
  set status = 'finished', finished_at = now()
  where id = v_run.id;

  return query select v_submission_id, v_leaderboard_id, 'provisional'::text;
end;
$$;

revoke all on function public.finish_provisional_run(uuid, uuid, text, integer, jsonb) from public, anon, authenticated;
grant execute on function public.finish_provisional_run(uuid, uuid, text, integer, jsonb) to service_role;

comment on function public.finish_provisional_run(uuid, uuid, text, integer, jsonb) is
  'Consumes a server-issued one-use run ticket and returns the same provisional receipt on an authenticated retry. Service role only.';
