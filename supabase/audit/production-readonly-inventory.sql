-- aVOID production metadata and aggregate-data inventory.
-- Safe contract: SELECT-only, no player names, emails, user identifiers,
-- tokens, billing identifiers, or row-level profile data.

begin transaction read only;

select
  current_setting('server_version') as server_version,
  pg_database_size(current_database()) as database_size_bytes,
  now() as captured_at;

select version, name
from supabase_migrations.schema_migrations
order by version;

select
  c.relkind::text as kind,
  n.nspname as schema_name,
  c.relname as object_name,
  pg_get_userbyid(c.relowner) as owner,
  c.relrowsecurity as rls_enabled
from pg_class c
join pg_namespace n on n.oid = c.relnamespace
where n.nspname = 'public'
  and c.relkind in ('r', 'p', 'v', 'm', 'S')
order by c.relkind, c.relname;

select
  schemaname,
  tablename,
  policyname,
  permissive,
  roles,
  cmd,
  qual,
  with_check
from pg_policies
where schemaname = 'public'
order by tablename, policyname;

select
  grantee,
  table_name,
  privilege_type,
  is_grantable
from information_schema.role_table_grants
where table_schema = 'public'
  and grantee in ('anon', 'authenticated', 'service_role', 'PUBLIC')
order by table_name, grantee, privilege_type;

select
  n.nspname as schema_name,
  p.proname as function_name,
  pg_get_function_identity_arguments(p.oid) as arguments,
  p.prosecdef as security_definer,
  p.proconfig as settings,
  has_function_privilege('anon', p.oid, 'EXECUTE') as anon_execute,
  has_function_privilege('authenticated', p.oid, 'EXECUTE') as authenticated_execute,
  has_function_privilege('service_role', p.oid, 'EXECUTE') as service_execute
from pg_proc p
join pg_namespace n on n.oid = p.pronamespace
where n.nspname = 'public'
order by p.proname, arguments;

select
  event_object_table as table_name,
  trigger_name,
  event_manipulation,
  action_timing,
  action_statement
from information_schema.triggers
where trigger_schema = 'public'
order by table_name, trigger_name, event_manipulation;

select jsonb_build_object(
  'auth_users', (select count(*) from auth.users),
  'auth_identities', (select count(*) from auth.identities),
  'profiles', (
    select jsonb_build_object(
      'total', count(*),
      'public', count(*) filter (where is_public),
      'private', count(*) filter (where not coalesce(is_public, false)),
      'pro_members', count(*) filter (where coalesce(is_pro_member, false)),
      'stripe_customer_ids', count(*) filter (where stripe_customer_id is not null)
    )
    from public.user_profiles
  ),
  'scores_by_game', (
    select coalesce(jsonb_agg(x order by x.game_key), '[]'::jsonb)
    from (
      select
        game_key,
        count(*) as total,
        count(*) filter (where is_verified) as marked_verified,
        count(*) filter (where user_id is null) as guest,
        min(score) as min_score,
        max(score) as max_score
      from public.leaderboard_scores
      group by game_key
    ) x
  ),
  'score_integrity', (
    select jsonb_build_object(
      'total', count(*),
      'marked_verified', count(*) filter (where is_verified),
      'guest', count(*) filter (where user_id is null),
      'duplicate_session_groups', (
        select count(*)
        from (
          select game_session_id
          from public.leaderboard_scores
          group by game_session_id
          having count(*) > 1
        ) duplicates
      ),
      'missing_profile_refs', (
        select count(*)
        from public.leaderboard_scores scores
        left join public.user_profiles profiles on profiles.id = scores.user_id
        where scores.user_id is not null and profiles.id is null
      )
    )
    from public.leaderboard_scores
  ),
  'backups', jsonb_build_object(
    'score_rows', (select count(*) from public.leaderboard_scores_backup_manual),
    'score_ids_also_live', (
      select count(*)
      from public.leaderboard_scores_backup_manual backup
      join public.leaderboard_scores live using (id)
    ),
    'profile_rows', (select count(*) from public.user_profiles_backup_manual),
    'profile_ids_also_live', (
      select count(*)
      from public.user_profiles_backup_manual backup
      join public.user_profiles live using (id)
    )
  )
);

rollback;
