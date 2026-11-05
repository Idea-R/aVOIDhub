-- Local/review only until the platform migration rollout gate is approved.
-- Collaboration conveys no creator, publishing, billing or platform-admin rights.
create table if not exists public.platform_teams (
  id uuid primary key default gen_random_uuid(),
  name text not null check (char_length(name) between 2 and 80 and name = btrim(name)),
  owner_id uuid not null references auth.users(id) on delete cascade,
  created_at timestamptz not null default now()
);
create index if not exists platform_teams_owner on public.platform_teams(owner_id);
-- Additive for populated local copies of the earlier, still-unapplied migration.
-- Supplementary Unicode characters count twice, matching JS string.length.
alter table public.platform_teams add column if not exists notes text not null default ''
  check (2 * char_length(notes) - char_length(regexp_replace(notes, U&'[\+010000-\+10FFFF]', '', 'g')) <= 2000);
alter table public.platform_teams add column if not exists notes_revision integer not null default 0
  check (notes_revision >= 0);

create table if not exists public.platform_team_members (
  team_id uuid not null references public.platform_teams(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  joined_at timestamptz not null default now(),
  primary key (team_id, user_id)
);
create index if not exists platform_team_members_user on public.platform_team_members(user_id);

create table if not exists public.platform_team_invitations (
  id uuid primary key default gen_random_uuid(),
  team_id uuid not null references public.platform_teams(id) on delete cascade,
  email text not null check (char_length(email) between 3 and 254 and email = lower(btrim(email)) and email ~ '^[^[:space:]@]+@[^[:space:]@]+\.[^[:space:]@]+$'),
  token_hash text not null unique check (token_hash ~ '^[0-9a-f]{64}$'),
  created_at timestamptz not null default now(),
  expires_at timestamptz not null default (now() + interval '7 days'),
  revoked_at timestamptz,
  accepted_at timestamptz,
  accepted_by uuid references auth.users(id) on delete set null
);
create index if not exists platform_team_invitations_team on public.platform_team_invitations(team_id);

alter table public.platform_teams enable row level security;
alter table public.platform_team_members enable row level security;
alter table public.platform_team_invitations enable row level security;
-- No table read/write grants: invitation digests and addresses are RPC-private.
revoke all on public.platform_teams, public.platform_team_members, public.platform_team_invitations from public, anon, authenticated;

create or replace function public.platform_teams_snapshot()
returns jsonb language plpgsql security definer set search_path = '' as $$
declare v_actor uuid := auth.uid(); v_result jsonb;
begin
  if v_actor is null then raise exception using errcode = 'PT401', message = 'authentication_required'; end if;
  select coalesce(jsonb_agg(jsonb_build_object(
    'id', t.id, 'name', t.name, 'owner_id', t.owner_id, 'created_at', t.created_at,
    'notes', t.notes, 'notes_revision', t.notes_revision,
    'members', (select coalesce(jsonb_agg(jsonb_build_object('user_id', m.user_id, 'role', case when m.user_id = t.owner_id then 'owner' else 'member' end, 'joined_at', m.joined_at) order by m.joined_at, m.user_id), '[]'::jsonb) from public.platform_team_members m where m.team_id = t.id),
    'invitations', case when t.owner_id = v_actor then
      (select coalesce(jsonb_agg(jsonb_build_object('id', i.id, 'email', i.email, 'created_at', i.created_at, 'expires_at', i.expires_at, 'revoked_at', i.revoked_at, 'accepted_at', i.accepted_at) order by i.created_at desc), '[]'::jsonb)
       from (select * from public.platform_team_invitations where team_id = t.id and expires_at > now() - interval '7 days'
         order by (accepted_at is null and revoked_at is null and expires_at > now()) desc, created_at desc, id limit 50) i)
      else '[]'::jsonb end
  ) order by t.created_at, t.id), '[]'::jsonb) into v_result
  from public.platform_teams t
  where exists (select 1 from public.platform_team_members m where m.team_id = t.id and m.user_id = v_actor);
  return jsonb_build_object('userId', v_actor, 'teams', v_result);
end;
$$;

-- Remove the previous seven-argument overload, including its old client grant.
-- No caller can select an older authority path after an additive local upgrade.
drop function if exists public.platform_team_action(text, uuid, text, text, text, uuid, uuid);
create or replace function public.platform_team_action(
  p_action text, p_team_id uuid default null, p_name text default null,
  p_email text default null, p_token_hash text default null,
  p_invitation_id uuid default null, p_member_id uuid default null,
  p_notes text default null, p_expected_revision integer default null
)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare
  v_actor uuid := auth.uid(); v_team public.platform_teams%rowtype;
  v_invite public.platform_team_invitations%rowtype; v_email text; v_id uuid;
begin
  if v_actor is null then raise exception using errcode = 'PT401', message = 'authentication_required'; end if;
  if p_action is null or p_action not in ('create', 'invite', 'revoke', 'accept', 'remove', 'leave', 'save-notes') then
    raise exception using errcode = 'PT400', message = 'invalid_team_action';
  end if;
  -- Serializes membership/ownership limits for this user, including cross-team accepts.
  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(v_actor::text, 615221));
  if p_action = 'create' then
    if p_name is null or char_length(btrim(p_name)) not between 2 and 80
      or p_name ~ U&'[\0001-\001F\007F-\009F]' then
      raise exception using errcode = 'PT400', message = 'invalid_team_name';
    end if;
    if (select count(*) from public.platform_teams where owner_id = v_actor) >= 5
      or (select count(*) from public.platform_team_members where user_id = v_actor) >= 20 then
      raise exception using errcode = 'PT409', message = 'team_limit_reached';
    end if;
    insert into public.platform_teams(name, owner_id) values (btrim(p_name), v_actor) returning id into v_id;
    insert into public.platform_team_members(team_id, user_id) values (v_id, v_actor);
    return jsonb_build_object('teamId', v_id);
  end if;

  if p_action = 'accept' then
    if p_token_hash is null or p_token_hash !~ '^[0-9a-f]{64}$' then
      raise exception using errcode = 'PT400', message = 'invalid_invitation';
    end if;
    -- Resolve the team before taking locks; always lock team then invitation.
    select team_id into p_team_id from public.platform_team_invitations where token_hash = p_token_hash;
  end if;
  select * into v_team from public.platform_teams where id = p_team_id for update;
  if not found then raise exception using errcode = 'PT404', message = 'team_or_invitation_unavailable'; end if;

  if p_action = 'save-notes' then
    -- Removal, leaving and saves share this team lock. Membership is evaluated
    -- after waiting, so a removed user's stale draft can never restore access.
    if not exists (select 1 from public.platform_team_members where team_id = v_team.id and user_id = v_actor) then
      raise exception using errcode = 'PT404', message = 'team_or_invitation_unavailable';
    end if;
    if p_notes is null or 2 * char_length(p_notes) - char_length(regexp_replace(p_notes, U&'[\+010000-\+10FFFF]', '', 'g')) > 2000
      or p_expected_revision is null or p_expected_revision < 0 then
      raise exception using errcode = 'PT400', message = 'invalid_team_notes';
    end if;
    if p_expected_revision <> v_team.notes_revision or v_team.notes_revision = 2147483647 then
      raise exception using errcode = 'PT409', message = 'team_notes_revision_conflict';
    end if;
    update public.platform_teams set notes = p_notes, notes_revision = notes_revision + 1 where id = v_team.id;
    return jsonb_build_object('teamId', v_team.id, 'notesRevision', v_team.notes_revision + 1);
  elsif p_action = 'accept' then
    select * into v_invite from public.platform_team_invitations where team_id = v_team.id and token_hash = p_token_hash for update;
    select lower(btrim(email)) into v_email from auth.users where id = v_actor and email_confirmed_at is not null;
    if v_invite.id is null or v_invite.revoked_at is not null or v_invite.accepted_at is not null
      or v_invite.expires_at <= clock_timestamp() or v_email is null or v_email <> v_invite.email then
      raise exception using errcode = 'PT404', message = 'team_or_invitation_unavailable';
    end if;
    if exists (select 1 from public.platform_team_members where team_id = v_team.id and user_id = v_actor) then
      raise exception using errcode = 'PT409', message = 'already_team_member';
    end if;
    if (select count(*) from public.platform_team_members where team_id = v_team.id) >= 20
      or (select count(*) from public.platform_team_members where user_id = v_actor) >= 20 then
      raise exception using errcode = 'PT409', message = 'team_limit_reached';
    end if;
    insert into public.platform_team_members(team_id, user_id) values (v_team.id, v_actor);
    update public.platform_team_invitations set accepted_at = clock_timestamp(), accepted_by = v_actor where id = v_invite.id;
  elsif p_action = 'leave' then
    if v_team.owner_id = v_actor then raise exception using errcode = 'PT409', message = 'owner_cannot_leave'; end if;
    if not exists (select 1 from public.platform_team_members where team_id = v_team.id and user_id = v_actor) then
      raise exception using errcode = 'PT404', message = 'team_or_invitation_unavailable';
    end if;
    delete from public.platform_team_members where team_id = v_team.id and user_id = v_actor;
  else
    if v_team.owner_id <> v_actor then raise exception using errcode = 'PT404', message = 'team_or_invitation_unavailable'; end if;
    if p_action = 'invite' then
      v_email := lower(btrim(p_email));
      if v_email is null or char_length(v_email) not between 3 and 254
        or v_email !~ '^[^[:space:]@]+@[^[:space:]@]+\.[^[:space:]@]+$'
        or p_token_hash is null or p_token_hash !~ '^[0-9a-f]{64}$' then
        raise exception using errcode = 'PT400', message = 'invalid_invitation';
      end if;
      if exists (select 1 from public.platform_team_invitations where team_id = v_team.id and email = v_email and accepted_at is null and revoked_at is null and expires_at > now()) then
        raise exception using errcode = 'PT409', message = 'invitation_already_pending';
      end if;
      if (select count(*) from public.platform_team_invitations where team_id = v_team.id and accepted_at is null and revoked_at is null and expires_at > now()) >= 20
        or (select count(*) from public.platform_team_invitations where team_id = v_team.id and created_at > now() - interval '24 hours') >= 100
        or (select count(*) from public.platform_team_members where team_id = v_team.id) >= 20 then
        raise exception using errcode = 'PT409', message = 'team_limit_reached';
      end if;
      insert into public.platform_team_invitations(team_id, email, token_hash) values (v_team.id, v_email, p_token_hash) returning * into v_invite;
      return jsonb_build_object('teamId', v_team.id, 'invitationId', v_invite.id, 'expiresAt', v_invite.expires_at);
    elsif p_action = 'revoke' then
      update public.platform_team_invitations set revoked_at = coalesce(revoked_at, now()) where id = p_invitation_id and team_id = v_team.id and accepted_at is null;
      if not found then raise exception using errcode = 'PT404', message = 'team_or_invitation_unavailable'; end if;
    elsif p_action = 'remove' then
      if p_member_id = v_team.owner_id then raise exception using errcode = 'PT409', message = 'owner_cannot_be_removed'; end if;
      delete from public.platform_team_members where team_id = v_team.id and user_id = p_member_id;
      if not found then raise exception using errcode = 'PT404', message = 'team_or_invitation_unavailable'; end if;
    end if;
  end if;
  return jsonb_build_object('teamId', v_team.id);
end;
$$;

revoke all on function public.platform_teams_snapshot() from public, anon, authenticated;
revoke all on function public.platform_team_action(text, uuid, text, text, text, uuid, uuid, text, integer) from public, anon, authenticated;
grant execute on function public.platform_teams_snapshot() to authenticated;
grant execute on function public.platform_team_action(text, uuid, text, text, text, uuid, uuid, text, integer) to authenticated;
