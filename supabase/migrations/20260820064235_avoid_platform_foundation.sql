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
  score integer not null check (score >= 0),
  metrics jsonb not null default '{}'::jsonb,
  verification_level text not null default 'provisional' check (verification_level in ('provisional', 'validated', 'verified')),
  status text not null default 'accepted' check (status in ('accepted', 'rejected', 'review')),
  rejection_reason text,
  created_at timestamptz not null default now()
);

alter table public.leaderboard_scores add column if not exists submission_id uuid;
alter table public.leaderboard_scores add column if not exists verification_level text not null default 'legacy';
alter table public.leaderboard_scores add column if not exists metadata jsonb not null default '{}'::jsonb;

create unique index if not exists leaderboard_scores_submission_unique
  on public.leaderboard_scores(submission_id)
  where submission_id is not null;

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
  ('creator.profile', 'Create and publish a creator profile.'),
  ('creator.submit_game', 'Submit games to the review queue.')
on conflict (entitlement_key) do update set description = excluded.description;

insert into public.plan_entitlements (plan_key, entitlement_key) values
  ('player', 'platform.ad_free'),
  ('player', 'profile.founding_mark'),
  ('player', 'experiments.early_access'),
  ('creator', 'platform.ad_free'),
  ('creator', 'profile.founding_mark'),
  ('creator', 'experiments.early_access'),
  ('creator', 'creator.profile'),
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

revoke all on public.billing_accounts, public.billing_subscriptions, public.stripe_webhook_events,
  public.game_run_sessions, public.score_submissions from anon, authenticated;
grant select on public.membership_plans, public.entitlement_definitions, public.plan_entitlements to anon, authenticated;
grant select on public.user_entitlements to authenticated;
grant select, insert, update on public.creator_applications, public.game_submissions to authenticated;
grant select on public.creator_profiles to anon, authenticated;
grant select, insert, delete on public.game_favorites to authenticated;

drop policy if exists "Membership plans are public" on public.membership_plans;
create policy "Membership plans are public" on public.membership_plans for select using (is_active);
drop policy if exists "Entitlement definitions are public" on public.entitlement_definitions;
create policy "Entitlement definitions are public" on public.entitlement_definitions for select using (true);
drop policy if exists "Plan entitlements are public" on public.plan_entitlements;
create policy "Plan entitlements are public" on public.plan_entitlements for select using (true);
drop policy if exists "Users read own entitlements" on public.user_entitlements;
create policy "Users read own entitlements" on public.user_entitlements
  for select to authenticated using ((select auth.uid()) = user_id);

drop policy if exists "Users read own creator applications" on public.creator_applications;
create policy "Users read own creator applications" on public.creator_applications
  for select to authenticated using ((select auth.uid()) = user_id);
drop policy if exists "Users submit own creator applications" on public.creator_applications;
create policy "Users submit own creator applications" on public.creator_applications
  for insert to authenticated with check ((select auth.uid()) = user_id and status = 'pending');
drop policy if exists "Users withdraw own creator applications" on public.creator_applications;
create policy "Users withdraw own creator applications" on public.creator_applications
  for update to authenticated
  using ((select auth.uid()) = user_id and status = 'pending')
  with check ((select auth.uid()) = user_id and status = 'withdrawn');

drop policy if exists "Published creator profiles are public" on public.creator_profiles;
create policy "Published creator profiles are public" on public.creator_profiles
  for select using (is_published or (select auth.uid()) = user_id);

drop policy if exists "Users read own game submissions" on public.game_submissions;
create policy "Users read own game submissions" on public.game_submissions
  for select to authenticated using ((select auth.uid()) = user_id);
drop policy if exists "Users create own game drafts" on public.game_submissions;
create policy "Users create own game drafts" on public.game_submissions
  for insert to authenticated with check ((select auth.uid()) = user_id and status in ('draft', 'submitted'));
drop policy if exists "Users edit own game drafts" on public.game_submissions;
create policy "Users edit own game drafts" on public.game_submissions
  for update to authenticated
  using ((select auth.uid()) = user_id and status in ('draft', 'changes_requested'))
  with check ((select auth.uid()) = user_id and status in ('draft', 'submitted', 'withdrawn'));

drop policy if exists "Users read own favorites" on public.game_favorites;
create policy "Users read own favorites" on public.game_favorites
  for select to authenticated using ((select auth.uid()) = user_id);
drop policy if exists "Users add own favorites" on public.game_favorites;
create policy "Users add own favorites" on public.game_favorites
  for insert to authenticated with check ((select auth.uid()) = user_id);
drop policy if exists "Users remove own favorites" on public.game_favorites;
create policy "Users remove own favorites" on public.game_favorites
  for delete to authenticated using ((select auth.uid()) = user_id);

-- Remove the legacy browser-write path. The server RPC below becomes the only writer.
drop policy if exists "Anyone can insert scores" on public.leaderboard_scores;
drop policy if exists "Authenticated users can insert scores" on public.leaderboard_scores;
drop policy if exists "Users can insert their own scores" on public.leaderboard_scores;
drop policy if exists "Users can update own verified scores" on public.leaderboard_scores;
revoke insert, update, delete on public.leaderboard_scores from anon, authenticated;

-- Legacy profile clients may edit presentation fields, never billing or aggregate
-- statistics. VOIDaVOID's aggregate RPC remains available but can only target the
-- current user and is bounded because those values are browser-reported.
revoke update on public.user_profiles from authenticated;
grant update (username, bio, cursor_color, social_links, is_public, display_name, avatar_url, country_code)
  on public.user_profiles to authenticated;

create or replace function public.update_game_statistics(
  user_id uuid,
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
  if (select auth.uid()) is distinct from $1 then
    raise exception 'user_mismatch' using errcode = '42501';
  end if;
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
  where up.id = $1;
end;
$$;

revoke all on function public.update_game_statistics(uuid, integer, integer, numeric, numeric, integer, integer, numeric, numeric) from public, anon;
grant execute on function public.update_game_statistics(uuid, integer, integer, numeric, numeric, integer, integer, numeric, numeric) to authenticated;
revoke all on function public.create_user_profile() from public, anon, authenticated;
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
  v_player_name text;
begin
  if p_score < 0 or p_score > 2147483647 then
    raise exception 'score_out_of_range' using errcode = '22003';
  end if;

  select * into v_run
  from public.game_run_sessions
  where id = p_run_id
  for update;

  if not found or v_run.user_id <> p_user_id then
    raise exception 'run_not_found' using errcode = 'P0002';
  end if;
  if v_run.status <> 'started' then
    raise exception 'run_already_consumed' using errcode = '23505';
  end if;
  if v_run.expires_at <= now() then
    update public.game_run_sessions set status = 'expired' where id = p_run_id;
    raise exception 'run_expired' using errcode = '22023';
  end if;
  if v_run.ticket_hash <> p_ticket_hash then
    raise exception 'invalid_run_ticket' using errcode = '28000';
  end if;

  insert into public.score_submissions (
    run_session_id, user_id, game_key, mode, score, metrics, verification_level, status
  ) values (
    v_run.id, v_run.user_id, v_run.game_key, v_run.mode, p_score,
    coalesce(p_metrics, '{}'::jsonb), 'provisional', 'accepted'
  ) returning id into v_submission_id;

  select coalesce(nullif(username, ''), 'player') into v_player_name
  from public.user_profiles where id = v_run.user_id;
  v_player_name := coalesce(v_player_name, 'player');

  insert into public.leaderboard_scores (
    player_name, score, user_id, game_session_id, is_verified, game_key,
    submission_id, verification_level, metadata
  ) values (
    v_player_name, p_score, v_run.user_id, v_run.id::text, false, v_run.game_key,
    v_submission_id, 'provisional', coalesce(p_metrics, '{}'::jsonb) || jsonb_build_object('mode', v_run.mode)
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
  'Consumes a server-issued one-use run ticket and records a provisional score. Service role only.';
