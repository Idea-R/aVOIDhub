-- Minimal local Supabase identity shim and unrelated foundation sentinels.
-- This is not a substitute for the full hosted/foundation migration history.
create role anon nologin;
create role authenticated nologin;
create role service_role nologin bypassrls;
create schema auth;
create table auth.users(id uuid primary key, email text, email_confirmed_at timestamptz, raw_user_meta_data jsonb default '{}'::jsonb);
create function auth.uid() returns uuid language sql stable as $$
  select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid
$$;
create table public.user_profiles(id uuid primary key, username text, best_score bigint);
create table public.user_entitlements(user_id uuid, entitlement_key text, source text, primary key(user_id, entitlement_key));
create table public.creator_applications(id uuid primary key, user_id uuid, status text);
create table public.creator_profiles(user_id uuid primary key, is_published boolean);
create table public.game_submissions(id uuid primary key, user_id uuid, status text, title text);
create table public.billing_accounts(user_id uuid primary key, stripe_customer_id text);
create table public.leaderboard_scores(id uuid primary key, user_id uuid, score bigint, metadata jsonb);
insert into auth.users values
  ('00000000-0000-4000-8000-000000000001','owner@example.com',now(),'{}'),
  ('00000000-0000-4000-8000-000000000002','member@example.com',now(),'{}'),
  ('00000000-0000-4000-8000-000000000003','stranger@example.com',now(),'{"role":"admin","email":"member@example.com"}'),
  ('00000000-0000-4000-8000-000000000004','unconfirmed@example.com',null,'{"email_confirmed":true}'),
  ('00000000-0000-4000-8000-000000000005','racer@example.com',now(),'{}'),
  ('00000000-0000-4000-8000-000000000006','seat-one@example.com',now(),'{}'),
  ('00000000-0000-4000-8000-000000000007','seat-two@example.com',now(),'{}');
insert into public.user_profiles select id, 'sentinel-' || email, 12345 from auth.users;
insert into public.user_entitlements select id, 'cosmetics.supporter', 'grant' from auth.users;
insert into public.creator_applications values ('10000000-0000-4000-8000-000000000001','00000000-0000-4000-8000-000000000001','approved');
insert into public.creator_profiles values ('00000000-0000-4000-8000-000000000001',true);
insert into public.game_submissions values ('20000000-0000-4000-8000-000000000001','00000000-0000-4000-8000-000000000001','published','preserve game');
insert into public.billing_accounts values ('00000000-0000-4000-8000-000000000001','local-sentinel-only');
insert into public.leaderboard_scores values ('30000000-0000-4000-8000-000000000001','00000000-0000-4000-8000-000000000001',987654,'{"preserve":true}');
