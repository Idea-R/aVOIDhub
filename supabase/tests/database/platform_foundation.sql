begin;

create extension if not exists pgtap with schema extensions;
select no_plan();

select has_table('public', 'membership_plans', 'membership plans table exists');
select has_table('public', 'entitlement_definitions', 'entitlement definitions table exists');
select has_table('public', 'plan_entitlements', 'plan entitlements table exists');
select has_table('public', 'user_entitlements', 'user entitlements table exists');
select has_table('public', 'billing_accounts', 'billing accounts table exists');
select has_table('public', 'billing_subscriptions', 'billing subscriptions table exists');
select has_table('public', 'stripe_webhook_events', 'Stripe webhook ledger exists');
select has_table('public', 'creator_applications', 'creator applications table exists');
select has_table('public', 'creator_profiles', 'creator profiles table exists');
select has_table('public', 'game_submissions', 'game submissions table exists');
select has_table('public', 'game_favorites', 'game favorites table exists');
select has_table('public', 'game_run_sessions', 'run sessions table exists');
select has_table('public', 'score_submissions', 'score submissions table exists');

select has_column('public', 'leaderboard_scores', 'submission_id', 'scores link to submissions');
select has_column('public', 'leaderboard_scores', 'verification_level', 'scores expose trust level');
select has_column('public', 'leaderboard_scores', 'metadata', 'scores retain bounded metadata');
select has_column('public', 'game_run_sessions', 'ruleset_version', 'runs record ruleset version');
select has_column('public', 'score_submissions', 'ruleset_version', 'submissions record ruleset version');

select ok(
  (select relrowsecurity from pg_class where oid = 'public.leaderboard_scores'::regclass),
  'leaderboard scores use RLS'
);
select ok(
  (select relrowsecurity from pg_class where oid = 'public.user_profiles'::regclass),
  'profiles use RLS'
);
select ok(
  (select relrowsecurity from pg_class where oid = 'public.game_run_sessions'::regclass),
  'run sessions use RLS'
);
select ok(
  (select relrowsecurity from pg_class where oid = 'public.score_submissions'::regclass),
  'score submissions use RLS'
);
select ok(
  (select relrowsecurity from pg_class where oid = 'public.billing_accounts'::regclass),
  'billing accounts use RLS'
);
select ok(
  (select relrowsecurity from pg_class where oid = 'public.stripe_webhook_events'::regclass),
  'webhook ledger uses RLS'
);

select is(
  has_table_privilege('anon', 'public.leaderboard_scores', 'INSERT'),
  false,
  'anonymous users cannot insert leaderboard scores'
);
select is(
  has_table_privilege('authenticated', 'public.leaderboard_scores', 'INSERT'),
  false,
  'authenticated users cannot insert leaderboard scores'
);
select is(
  has_table_privilege('authenticated', 'public.game_scores', 'INSERT'),
  false,
  'legacy Wreck score writes are closed'
);
select is(
  has_table_privilege('anon', 'public.leaderboard_scores_backup_manual', 'SELECT'),
  false,
  'anonymous users cannot read the score backup'
);
select is(
  has_table_privilege('authenticated', 'public.user_profiles_backup_manual', 'SELECT'),
  false,
  'authenticated users cannot read the profile backup'
);
select is(
  has_column_privilege('authenticated', 'public.user_profiles', 'username', 'UPDATE'),
  true,
  'users may update profile presentation fields'
);
select is(
  has_column_privilege('authenticated', 'public.user_profiles', 'best_score', 'UPDATE'),
  false,
  'users cannot update aggregate scores'
);
select is(
  has_column_privilege('authenticated', 'public.user_profiles', 'stripe_customer_id', 'UPDATE'),
  false,
  'users cannot update billing identity'
);
select is(
  has_table_privilege('authenticated', 'public.creator_applications', 'INSERT'),
  false,
  'creator application writes are server-owned'
);
select is(
  has_table_privilege('authenticated', 'public.game_submissions', 'UPDATE'),
  false,
  'game submission writes are server-owned'
);
select is(
  has_table_privilege('service_role', 'public.game_run_sessions', 'INSERT'),
  true,
  'service role can start run sessions'
);
select is(
  has_table_privilege('service_role', 'public.billing_subscriptions', 'UPDATE'),
  true,
  'service role can reconcile subscriptions'
);
select is(
  (
    select count(*)
    from public.plan_entitlements
    where plan_key = 'creator'
      and entitlement_key = 'creator.profile'
  ),
  0::bigint,
  'payment does not grant creator approval or profile publication'
);
select is(
  (
    select count(*)
    from public.plan_entitlements
    where plan_key = 'creator'
      and entitlement_key = 'creator.submit_game'
  ),
  1::bigint,
  'creator subscription grants only the paid submission half of eligibility'
);

select is(
  (
    select count(*)
    from pg_policies
    where schemaname = 'public'
      and tablename in ('leaderboard_scores', 'game_scores')
      and cmd in ('INSERT', 'UPDATE', 'DELETE', 'ALL')
  ),
  0::bigint,
  'score tables have no browser-write policies'
);
select is(
  (
    select count(*)
    from pg_policies
    where schemaname = 'public'
      and tablename in ('leaderboard_scores_backup_manual', 'user_profiles_backup_manual')
  ),
  0::bigint,
  'manual backups expose no policies'
);
select is(
  (
    select count(*)
    from pg_policies
    where schemaname = 'public'
      and tablename = 'user_profiles'
  ),
  2::bigint,
  'profiles have one read policy and one presentation update policy'
);

select is(
  has_function_privilege(
    'anon',
    'public.finish_provisional_run(uuid,uuid,text,integer,jsonb)',
    'EXECUTE'
  ),
  false,
  'anonymous users cannot finish runs directly'
);
select is(
  has_function_privilege(
    'authenticated',
    'public.finish_provisional_run(uuid,uuid,text,integer,jsonb)',
    'EXECUTE'
  ),
  false,
  'authenticated users cannot finish runs directly'
);
select is(
  has_function_privilege(
    'service_role',
    'public.finish_provisional_run(uuid,uuid,text,integer,jsonb)',
    'EXECUTE'
  ),
  true,
  'service role can finish runs'
);
select is(
  has_function_privilege(
    'authenticated',
    'public.update_game_statistics(uuid,integer,integer,numeric,numeric,integer,integer,numeric,numeric)',
    'EXECUTE'
  ),
  false,
  'browser clients cannot author aggregate statistics'
);
select is(
  has_function_privilege('anon', 'public.backfill_missing_profiles()', 'EXECUTE'),
  false,
  'anonymous users cannot run the profile backfill'
);

select is(
  (
    select count(*)
    from public.leaderboard_scores
    where verification_level = 'legacy' and is_verified is true
  ),
  0::bigint,
  'no legacy score remains marked verified'
);
select ok(
  (
    select convalidated
    from pg_constraint
    where conrelid = 'public.leaderboard_scores'::regclass
      and conname = 'leaderboard_scores_verified_consistency_check'
  ),
  'verification consistency constraint is validated'
);
select ok(
  (
    select convalidated
    from pg_constraint
    where conrelid = 'public.leaderboard_scores'::regclass
      and conname = 'leaderboard_scores_submission_id_fkey'
  ),
  'leaderboard submission foreign key is validated'
);
select is(
  (
    select count(*)
    from information_schema.triggers
    where trigger_schema = 'public'
      and trigger_name in (
        'trigger_update_user_stats_on_score_insert',
        'trigger_sync_leaderboard_player_name'
      )
  ),
  0::bigint,
  'browser-era score side-effect triggers are gone'
);
select is(
  (
    select count(*)
    from information_schema.triggers
    where trigger_schema = 'auth'
      and trigger_name = 'on_auth_user_created'
      and action_statement = 'EXECUTE FUNCTION create_user_profile()'
  ),
  1::bigint,
  'signup retains exactly one profile creation trigger'
);
select is(
  (
    select pg_get_expr(d.adbin, d.adrelid)
    from pg_attrdef as d
    join pg_attribute as a on a.attrelid = d.adrelid and a.attnum = d.adnum
    where d.adrelid = 'public.user_profiles'::regclass
      and a.attname = 'is_public'
  ),
  'false'::text,
  'new profiles are private by default'
);

select * from finish();
rollback;
