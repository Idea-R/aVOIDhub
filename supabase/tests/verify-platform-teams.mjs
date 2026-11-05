// Real PostgreSQL tests. Never reads project env, credentials, hosted URLs or a
// pre-existing service. Each run creates, stops and removes its own temp cluster.
import assert from 'node:assert/strict';
import { execFile, spawn } from 'node:child_process';
import { createHash } from 'node:crypto';
import { mkdtemp, readFile, realpath, rm, writeFile } from 'node:fs/promises';
import net from 'node:net';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { promisify } from 'node:util';

const exec = promisify(execFile);
// PostgreSQL daemon children inherit pipes on Windows. Discard pg_ctl's stdio
// so a successful start cannot keep execFile's captured streams open forever.
const daemonControl = (file, args, env) => new Promise((resolve, reject) => {
  const child = spawn(file, args, { env, stdio: 'ignore', windowsHide: true });
  child.once('error', reject);
  child.once('close', code => code === 0 ? resolve() : reject(new Error(`pg_ctl exited ${code}`)));
});
const here = path.dirname(fileURLToPath(import.meta.url));
const bin = process.env.TEAMS_TEST_PG_BIN || 'C:\\Program Files\\PostgreSQL\\17\\bin';
const executable = name => path.join(bin, process.platform === 'win32' ? `${name}.exe` : name);
const temporaryRoot = await realpath(os.tmpdir());
const directory = await mkdtemp(path.join(temporaryRoot, 'avoid-teams-pg-'));
const resolvedDirectory = await realpath(directory);
assert.equal(path.dirname(resolvedDirectory), temporaryRoot, 'Owned cluster must be directly in the resolved temporary directory');
const dataDirectory = path.join(resolvedDirectory, 'data');
const listener = net.createServer();
await new Promise((resolve, reject) => { listener.once('error', reject); listener.listen(0, '127.0.0.1', resolve); });
const port = listener.address().port;
await new Promise(resolve => listener.close(resolve));
const env = { ...process.env };
for (const key of Object.keys(env)) if (key.startsWith('PG')) delete env[key];
const common = ['-X', '-q', '-A', '-t', '-v', 'ON_ERROR_STOP=1', '-v', 'VERBOSITY=verbose', '-h', '127.0.0.1', '-p', String(port), '-U', 'postgres', '-d', 'postgres'];
const sql = async (source, database = 'postgres') => (await exec(executable('psql'), [...common.slice(0, -1), database, '-c', source], { env, maxBuffer: 4 * 1024 * 1024 })).stdout.trim();
const actor = (id, source, role = 'authenticated') => `begin; set local role ${role}; set local "request.jwt.claim.sub" = '${id || ''}'; ${source}; commit;`;
const user = number => `00000000-0000-4000-8000-${String(number).padStart(12, '0')}`;
const asUser = (number, source) => sql(actor(user(number), source));
const call = (action, args = '') => `select public.platform_team_action('${action}'${args ? `, ${args}` : ''})`;
const digest = label => createHash('sha256').update(label).digest('hex');
let assertions = 0;
function check(condition, message) { assert.ok(condition, message); assertions++; console.log(`PASS ${message}`); }
async function denied(source, code, message) {
  try { await sql(source); assert.fail(`${message}: unexpectedly succeeded`); }
  catch (error) { assert.match(error.stderr || '', new RegExp(`\\b${code}\\b`), `${message}: ${error.stderr || error}`); }
  assertions++; console.log(`PASS ${message}`);
}
async function invite(team, email, label) {
  return JSON.parse(await asUser(1, call('invite', `p_team_id => '${team}', p_email => '${email}', p_token_hash => '${digest(label)}'`)));
}
const preservedTables = ['user_profiles', 'user_entitlements', 'creator_applications', 'creator_profiles', 'game_submissions', 'billing_accounts', 'leaderboard_scores'];
async function fingerprints(tables) {
  const result = {};
  for (const table of tables) result[table] = await sql(`select md5(coalesce(jsonb_agg(to_jsonb(t) order by to_jsonb(t)::text)::text, '[]')) from public.${table} t`);
  return result;
}
let startAttempted = false;
try {
  await exec(executable('initdb'), ['-D', dataDirectory, '-U', 'postgres', '-A', 'trust', '--no-locale', '--encoding=UTF8'], { env });
  startAttempted = true;
  // All clients use loopback TCP. Disable Unix sockets so Linux runners never
  // need write access to a system PostgreSQL socket directory.
  try {
    await daemonControl(executable('pg_ctl'), ['-D', dataDirectory, '-l', path.join(resolvedDirectory, 'postgres.log'), '-o', `-h 127.0.0.1 -p ${port} -c unix_socket_directories=`, '-w', '-t', '30', 'start'], env);
  } catch (error) {
    const diagnostic = await readFile(path.join(resolvedDirectory, 'postgres.log'), 'utf8').catch(() => 'No owned-cluster startup log was created.');
    throw new Error(`Temporary PostgreSQL startup failed:\n${diagnostic}`, { cause: error });
  }
  const fixture = await readFile(path.join(here, 'database/platform_teams_fixture.sql'), 'utf8');
  const migration = await readFile(path.join(here, '../migrations/20261105090000_platform_teams.sql'), 'utf8');
  await sql(fixture);
  const before = await fingerprints(preservedTables);
  await sql(migration);
  check(await sql('select count(*) from public.platform_teams') === '0', 'fresh team schema has no records');
  // Simulate the former client-callable signature before replaying the extension.
  await sql(`create function public.platform_team_action(text, uuid, text, text, text, uuid, uuid) returns jsonb language sql as 'select ''{}''::jsonb'; grant execute on function public.platform_team_action(text, uuid, text, text, text, uuid, uuid) to anon, authenticated;`);
  await sql(migration);
  check(await sql(`select count(*) from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname='public' and p.proname='platform_team_action' and p.pronargs=9`) === '1' && await sql(`select count(*) from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname='public' and p.proname='platform_team_action' and p.pronargs<>9`) === '0', 'migration removes old RPC overload and retains exactly the bounded new signature');
  check(JSON.stringify(before) === JSON.stringify(await fingerprints(preservedTables)), 'fresh migration and replay preserve populated unrelated foundation sentinels');
  for (const role of ['anon', 'authenticated']) {
    for (const table of ['platform_teams', 'platform_team_members', 'platform_team_invitations']) {
      await denied(actor(user(3), `select * from public.${table}`, role), '42501', `${role} cannot directly read ${table}`);
      await denied(actor(user(3), `delete from public.${table}`, role), '42501', `${role} cannot directly mutate ${table}`);
    }
  }
  await denied(actor(user(3), 'select public.platform_teams_snapshot()', 'anon'), '42501', 'anonymous snapshot RPC denied');
  await denied(actor(user(3), call('create', "p_name => 'forged'"), 'anon'), '42501', 'anonymous mutation RPC denied');
  await denied(actor(null, 'select public.platform_teams_snapshot()'), 'PT401', 'missing authenticated actor denied');
  await denied(actor(null, call('create', "p_name => 'forged'")), 'PT401', 'actorless mutation denied');
  await denied(actor(user(3), "select public.platform_team_action('create', p_name => 'forged', p_owner_id => '" + user(1) + "')"), '42883', 'RPC cannot accept a forged owner parameter');
  await denied(actor(user(1), call('publish')), 'PT400', 'unsupported publishing action denied');
  await denied(actor(user(1), call('create', "p_name => 'x'")), 'PT400', 'invalid team name denied');
  await denied(actor(user(1), call('create', "p_name => E'Invalid\\nteam'")), 'PT400', 'control characters in team name denied by direct RPC');
  await denied(actor(user(1), call('create', "p_name => U&'Invalid\\0085team'")), 'PT400', 'C1 control characters in team name denied by direct RPC');
  const team = JSON.parse(await asUser(1, call('create', "p_name => 'Owner team'"))).teamId;
  check(await sql(`select notes = '' and notes_revision = 0 from public.platform_teams where id = '${team}'`) === 't', 'team brief starts empty at revision zero');
  await denied(actor(user(3), call('save-notes', `p_team_id => '${team}', p_notes => 'forged edit', p_expected_revision => 0`)), 'PT404', 'unrelated user cannot edit private team brief');
  await denied(actor(user(3), call('save-notes', `p_team_id => '${team}', p_notes => 'anonymous edit', p_expected_revision => 0`), 'anon'), '42501', 'anonymous user cannot edit team brief');
  check((await sql(`select owner_id from public.platform_teams where id = '${team}'`)) === user(1), 'team owner derives from auth.uid');
  await denied(actor(user(3), `update public.platform_teams set owner_id = '${user(3)}' where id = '${team}'`), '42501', 'owner identity cannot be changed by clients');
  check(JSON.parse(await asUser(3, 'select public.platform_teams_snapshot()')).teams.length === 0, 'unrelated user snapshot isolates team');
  await denied(actor(user(3), call('invite', `p_team_id => '${team}', p_email => 'stranger@example.com', p_token_hash => '${digest('forged')}'`)), 'PT404', 'unrelated user cannot invite despite forged admin metadata');
  await denied(actor(user(1), call('invite', `p_team_id => '${team}', p_email => 'bad', p_token_hash => '${digest('bad')}'`)), 'PT400', 'invalid invitation email denied');
  await denied(actor(user(1), call('invite', `p_team_id => '${team}', p_email => 'valid@example.com', p_token_hash => 'raw-token'`)), 'PT400', 'raw invitation token cannot be stored as a digest');
  const memberInvite = await invite(team, 'MEMBER@example.com', 'member-token');
  check((await sql(`select email from public.platform_team_invitations where id = '${memberInvite.invitationId}'`)) === 'member@example.com', 'invitation email is normalized');
  await denied(actor(user(1), call('invite', `p_team_id => '${team}', p_email => 'member@example.com', p_token_hash => '${digest('duplicate')}'`)), 'PT409', 'duplicate pending invitation denied');
  await denied(actor(user(3), call('accept', `p_token_hash => '${digest('member-token')}'`)), 'PT404', 'wrong authenticated email cannot consume invitation or use metadata email');
  const unconfirmed = await invite(team, 'unconfirmed@example.com', 'unconfirmed-token');
  await denied(actor(user(4), call('accept', `p_token_hash => '${digest('unconfirmed-token')}'`)), 'PT404', 'unconfirmed actual email cannot accept despite forged confirmation metadata');
  check(await sql(`select accepted_at is null from public.platform_team_invitations where id = '${unconfirmed.invitationId}'`) === 't', 'failed email acceptance does not consume invitation');
  const expired = await invite(team, 'stranger@example.com', 'expired-token');
  await sql(`update public.platform_team_invitations set expires_at = now() - interval '1 second' where id = '${expired.invitationId}'`);
  await denied(actor(user(3), call('accept', `p_token_hash => '${digest('expired-token')}'`)), 'PT404', 'expired invitation denied');
  const delayed = await invite(team, 'stranger@example.com', 'delayed-token');
  await denied(`begin; update public.platform_team_invitations set expires_at = now() + interval '100 milliseconds' where id = '${delayed.invitationId}'; set local role authenticated; set local "request.jwt.claim.sub" = '${user(3)}'; select pg_sleep(0.2); ${call('accept', `p_token_hash => '${digest('delayed-token')}'`)}; commit;`, 'PT404', 'acceptance checks wall-clock expiry even when transaction began before expiry');
  // The rejected transaction rolls its fixture expiry update back as well.
  await asUser(1, call('revoke', `p_team_id => '${team}', p_invitation_id => '${delayed.invitationId}'`));
  const revoked = await invite(team, 'stranger@example.com', 'revoked-token');
  await asUser(1, call('revoke', `p_team_id => '${team}', p_invitation_id => '${revoked.invitationId}'`));
  await asUser(1, call('revoke', `p_team_id => '${team}', p_invitation_id => '${revoked.invitationId}'`));
  check(await sql(`select revoked_at is not null from public.platform_team_invitations where id = '${revoked.invitationId}'`) === 't', 'owner revocation is safely repeatable');
  await denied(actor(user(3), call('accept', `p_token_hash => '${digest('revoked-token')}'`)), 'PT404', 'revoked invitation denied');
  await asUser(2, call('accept', `p_token_hash => '${digest('member-token')}'`));
  const memberSnapshot = JSON.parse(await asUser(2, 'select public.platform_teams_snapshot()'));
  check(memberSnapshot.teams.length === 1 && memberSnapshot.teams[0].members.find(m => m.user_id === user(2)).role === 'member', 'confirmed matching recipient receives ordinary membership');
  check(memberSnapshot.teams[0].invitations.length === 0 && !JSON.stringify(memberSnapshot).includes('example.com'), 'members cannot read invitation addresses');
  const saveNotes = (notes, revision) => call('save-notes', `p_team_id => '${team}', p_notes => ${notes}, p_expected_revision => ${revision}`);
  const ownerEdit = JSON.parse(await asUser(1, saveNotes("'Owner direction'", 0)));
  check(ownerEdit.notesRevision === 1, 'owner can save shared brief and increment revision');
  const briefSnapshot = JSON.parse(await asUser(2, 'select public.platform_teams_snapshot()')).teams[0];
  check(briefSnapshot.notes === 'Owner direction' && briefSnapshot.notes_revision === 1, 'current member reads shared brief and revision');
  await asUser(2, saveNotes("E'  Member direction\\nNext step  '", 1));
  check(await sql(`select notes = E'  Member direction\\nNext step  ' and notes_revision = 2 from public.platform_teams where id = '${team}'`) === 't', 'ordinary member can edit shared brief with whitespace preserved');
  await denied(actor(user(4), saveNotes("'pending invite is not membership'", 2)), 'PT404', 'invitation alone grants no brief edit access');
  await denied(actor(user(2), saveNotes("repeat('a',2001)", 2)), 'PT400', 'overlimit ASCII brief denied in database RPC');
  await denied(actor(user(1), `update public.platform_teams set notes = 'direct edit' where id = '${team}'`), '42501', 'brief cannot bypass RPC through direct client table writes');
  await denied(`update public.platform_teams set notes = repeat('a',2001) where id = '${team}'`, '23514', 'table constraint independently bounds brief length');
  await asUser(2, saveNotes("repeat(U&'\\+01F600',1000)", 2));
  check(await sql(`select char_length(notes) = 1000 and notes_revision = 3 from public.platform_teams where id = '${team}'`) === 't', 'exactly two thousand UTF16 units accepted for supplementary characters');
  await denied(actor(user(2), saveNotes("repeat(U&'\\+01F600',1001)", 3)), 'PT400', 'supplementary characters count twice in database brief limit');
  await denied(actor(user(2), saveNotes("'stale member draft'", 2)), 'PT409', 'stale brief revision cannot overwrite a later edit');
  await denied(actor(user(2), saveNotes("'negative revision'", -1)), 'PT400', 'negative brief revision denied');
  await denied(actor(user(2), saveNotes('null', 3)), 'PT400', 'null brief denied');
  await asUser(1, saveNotes("'Owner final direction'", 3));
  await denied(actor(user(1), saveNotes("'Owner final direction'", 3)), 'PT409', 'replayed successful brief save conflicts without duplicate revision increment');
  const writers = await Promise.allSettled([sql(actor(user(1), saveNotes("'Owner racing direction'", 4) + '; select pg_sleep(0.3)')), sql(actor(user(2), saveNotes("'Member racing direction'", 4)))]);
  check(writers.filter(r => r.status === 'fulfilled').length === 1 && writers.filter(r => r.status === 'rejected' && r.reason.stderr.includes('PT409')).length === 1, 'two writers with one base revision produce one winner and one conflict');
  check(await sql(`select notes_revision = 5 and notes in ('Owner racing direction','Member racing direction') from public.platform_teams where id = '${team}'`) === 't', 'concurrent brief save increments revision once and preserves winning text');
  const ownerSnapshot = await asUser(1, 'select public.platform_teams_snapshot()');
  check(ownerSnapshot.includes('member@example.com') && !ownerSnapshot.includes('token_hash') && !ownerSnapshot.includes(digest('member-token')), 'only owner sees invitation addresses; snapshots never expose digests');
  await denied(actor(user(2), call('accept', `p_token_hash => '${digest('member-token')}'`)), 'PT404', 'consumed invitation replay denied');
  await denied(actor(user(2), call('invite', `p_team_id => '${team}', p_email => 'stranger@example.com', p_token_hash => '${digest('member-escalation')}'`)), 'PT404', 'ordinary member cannot invite');
  await denied(actor(user(2), call('remove', `p_team_id => '${team}', p_member_id => '${user(1)}'`)), 'PT404', 'ordinary member cannot remove owner');
  await denied(actor(user(2), call('revoke', `p_team_id => '${team}', p_invitation_id => '${unconfirmed.invitationId}'`)), 'PT404', 'ordinary member cannot revoke invitations');
  await denied(actor(user(1), call('remove', `p_team_id => '${team}', p_member_id => '${user(1)}'`)), 'PT409', 'owner cannot remove owner');
  await denied(actor(user(1), call('leave', `p_team_id => '${team}'`)), 'PT409', 'owner cannot leave ownerless team');

  await invite(team, 'racer@example.com', 'racing-token');
  const races = await Promise.allSettled([sql(actor(user(5), call('accept', `p_token_hash => '${digest('racing-token')}'`) + '; select pg_sleep(0.3)')), sql(actor(user(5), call('accept', `p_token_hash => '${digest('racing-token')}'`)))]);
  check(races.filter(result => result.status === 'fulfilled').length === 1 && races.filter(result => result.status === 'rejected' && result.reason.stderr.includes('PT404')).length === 1, 'concurrent acceptance consumes one invitation exactly once');
  check(await sql(`select count(*) from public.platform_team_members where team_id = '${team}' and user_id = '${user(5)}'`) === '1', 'concurrent acceptance inserts exactly one membership');

  const otherTeam = JSON.parse(await asUser(3, call('create', "p_name => 'Unrelated team'"))).teamId;
  await denied(actor(user(1), call('revoke', `p_team_id => '${otherTeam}', p_invitation_id => '${unconfirmed.invitationId}'`)), 'PT404', 'owner cannot operate on another team');
  await denied(actor(user(3), call('revoke', `p_team_id => '${otherTeam}', p_invitation_id => '${unconfirmed.invitationId}'`)), 'PT404', 'invitation identifier cannot cross team boundary');
  for (let n = 0; n < 4; n++) await asUser(1, call('create', `p_name => 'Extra ${n}'`));
  await denied(actor(user(1), call('create', "p_name => 'Sixth team'")), 'PT409', 'five owned team limit enforced');
  await asUser(2, call('leave', `p_team_id => '${team}'`));
  check(JSON.parse(await asUser(2, 'select public.platform_teams_snapshot()')).teams.length === 0, 'leaving removes team read access');
  await denied(actor(user(2), saveNotes("'former member draft'", 5)), 'PT404', 'former member cannot edit team brief after leaving');
  const removal = sql(actor(user(1), `set local application_name = 'teams-remove-barrier'; ${call('remove', `p_team_id => '${team}', p_member_id => '${user(5)}'`)}; select pg_sleep(0.5)`));
  let removalLocked = false;
  for (let attempt = 0; attempt < 20; attempt++) {
    if (await sql("select exists(select 1 from pg_stat_activity where application_name='teams-remove-barrier' and wait_event='PgSleep')") === 't') { removalLocked = true; break; }
    await new Promise(resolve => setTimeout(resolve, 10));
  }
  check(removalLocked, 'removal acquired team lock before concurrent former-member save');
  const removedSave = await Promise.allSettled([removal, asUser(5, saveNotes("'racing removed member draft'", 5))]);
  check(removedSave[0].status === 'fulfilled' && removedSave[1].status === 'rejected' && removedSave[1].reason.stderr.includes('PT404'), 'save waiting behind membership removal rechecks membership and is denied');
  check(await sql(`select notes_revision = 5 from public.platform_teams where id = '${team}'`) === 't', 'removed-member race cannot alter shared brief revision');
  check(JSON.parse(await asUser(5, 'select public.platform_teams_snapshot()')).teams.length === 0, 'owner removal removes team read access');

  // Fill 18 additional seats to test different-user acceptance racing for the last seat.
  await sql(`insert into auth.users(id,email,email_confirmed_at) select ('40000000-0000-4000-8000-' || lpad(n::text,12,'0'))::uuid, 'filler' || n || '@example.com', now() from generate_series(1,18) n; insert into public.platform_team_members(team_id,user_id) select '${team}', id from auth.users where id::text like '40000000-%';`);
  await invite(team, 'seat-one@example.com', 'seat-one');
  await invite(team, 'seat-two@example.com', 'seat-two');
  const seats = await Promise.allSettled([sql(actor(user(6), call('accept', `p_token_hash => '${digest('seat-one')}'`) + '; select pg_sleep(0.3)')), sql(actor(user(7), call('accept', `p_token_hash => '${digest('seat-two')}'`)))]);
  check(seats.filter(result => result.status === 'fulfilled').length === 1 && seats.filter(result => result.status === 'rejected' && result.reason.stderr.includes('PT409')).length === 1, 'different users racing for final team seat cannot exceed member cap');
  check(await sql(`select count(*) from public.platform_team_members where team_id = '${team}'`) === '20', 'team member cap remains exactly twenty');
  await denied(actor(user(1), call('invite', `p_team_id => '${team}', p_email => 'full@example.com', p_token_hash => '${digest('full')}'`)), 'PT409', 'full team cannot create new invitation');
  // Limits are checked inside the same locks as mutations, independently of HTTP.
  for (let n = 0; n < 20; n++) await asUser(3, call('invite', `p_team_id => '${otherTeam}', p_email => 'pending${n}@example.com', p_token_hash => '${digest(`pending-${n}`)}'`));
  await denied(actor(user(3), call('invite', `p_team_id => '${otherTeam}', p_email => 'pending-overflow@example.com', p_token_hash => '${digest('pending-overflow')}'`)), 'PT409', 'twenty outstanding invitation limit enforced');
  await sql(`update public.platform_team_invitations set revoked_at = now() where team_id = '${otherTeam}'; insert into public.platform_team_invitations(team_id,email,token_hash,revoked_at) select '${otherTeam}', 'rate' || n || '@example.com', md5('rate-' || n) || md5('rate-' || n), now() from generate_series(1,80) n;`);
  await denied(actor(user(3), call('invite', `p_team_id => '${otherTeam}', p_email => 'rate-overflow@example.com', p_token_hash => '${digest('rate-overflow')}'`)), 'PT409', 'one hundred invitation creations per day limit enforced despite revocation churn');
  const limitedSnapshot = JSON.parse(await asUser(3, 'select public.platform_teams_snapshot()'));
  check(limitedSnapshot.teams.find(t => t.id === otherTeam).invitations.length === 50, 'owner snapshot invitation history is bounded to fifty');
  await sql(`update public.platform_team_invitations set revoked_at = null, created_at = now() - interval '12 hours' where team_id = '${otherTeam}' and email = 'pending0@example.com'`);
  const actionableSnapshot = JSON.parse(await asUser(3, 'select public.platform_teams_snapshot()'));
  check(actionableSnapshot.teams.find(t => t.id === otherTeam).invitations.some(i => i.email === 'pending0@example.com'), 'bounded history never hides an older active invitation from its owner');
  const membershipTeam = JSON.parse(await asUser(2, call('create', "p_name => 'Membership target'"))).teamId;
  // Local trusted fixture fills nineteen other memberships for the candidate.
  await sql(`insert into public.platform_teams(id,name,owner_id) select ('50000000-0000-4000-8000-' || lpad(n::text,12,'0'))::uuid, 'Membership fixture ' || n, '${user(1)}' from generate_series(1,20) n; insert into public.platform_team_members(team_id,user_id) select id, '${user(4)}' from public.platform_teams where id::text like '50000000-%'; update auth.users set email_confirmed_at = now() where id = '${user(4)}';`);
  const membershipInvite = JSON.parse(await asUser(2, call('invite', `p_team_id => '${membershipTeam}', p_email => 'unconfirmed@example.com', p_token_hash => '${digest('membership-cap')}'`)));
  await denied(actor(user(4), call('accept', `p_token_hash => '${digest('membership-cap')}'`)), 'PT409', 'twenty memberships per user limit enforced on acceptance');
  check(await sql(`select accepted_at is null from public.platform_team_invitations where id = '${membershipInvite.invitationId}'`) === 't', 'membership limit rejection leaves invitation unconsumed');
  await denied(actor(user(4), call('create', "p_name => 'Membership overflow'")), 'PT409', 'twenty memberships per user limit enforced on creation');
  const teamTables = ['platform_teams', 'platform_team_members', 'platform_team_invitations'];
  const populatedBefore = await fingerprints(teamTables);
  await sql(migration);
  check(JSON.stringify(populatedBefore) === JSON.stringify(await fingerprints(teamTables)), 'populated migration replay preserves team owners, memberships, invitation consumption and revocations');
  check(JSON.stringify(before) === JSON.stringify(await fingerprints(preservedTables)), 'all operations and replay preserve foundation profile/entitlement/creator/publish/billing/score sentinels');
  check(await sql(`select count(*) from pg_class where oid in ('public.platform_teams'::regclass,'public.platform_team_members'::regclass,'public.platform_team_invitations'::regclass) and relrowsecurity`) === '3', 'all team tables retain RLS');
  // Independently exercise upgrading a populated pre-brief schema. Roles are
  // cluster-global; the other identity/sentinel fixture objects are per database.
  await sql('create database teams_legacy_upgrade');
  const legacySql = source => sql(source, 'teams_legacy_upgrade');
  await legacySql(fixture.replace(/^create role [^;]+;\r?\n/gm, ''));
  await legacySql(`
    create table public.platform_teams(id uuid primary key default gen_random_uuid(), name text not null, owner_id uuid not null references auth.users(id), created_at timestamptz not null default now());
    create table public.platform_team_members(team_id uuid not null references public.platform_teams(id), user_id uuid not null references auth.users(id), joined_at timestamptz not null default now(), primary key(team_id,user_id));
    create table public.platform_team_invitations(id uuid primary key default gen_random_uuid(), team_id uuid not null references public.platform_teams(id), email text not null, token_hash text not null unique, created_at timestamptz not null default now(), expires_at timestamptz not null default now()+interval '7 days', revoked_at timestamptz, accepted_at timestamptz, accepted_by uuid references auth.users(id));
    insert into public.platform_teams(id,name,owner_id) values ('60000000-0000-4000-8000-000000000001','Existing owner team','${user(1)}');
    insert into public.platform_team_members(team_id,user_id) values ('60000000-0000-4000-8000-000000000001','${user(1)}'),('60000000-0000-4000-8000-000000000001','${user(2)}');
    insert into public.platform_team_invitations(team_id,email,token_hash,revoked_at) values ('60000000-0000-4000-8000-000000000001','racer@example.com','${digest('legacy-revoked')}',now());
    create function public.platform_team_action(text, uuid, text, text, text, uuid, uuid) returns jsonb language sql as 'select ''{}''::jsonb';
    grant execute on function public.platform_team_action(text, uuid, text, text, text, uuid, uuid) to authenticated;
  `);
  async function legacyFingerprint(includeBrief) {
    const fingerprints = {};
    for (const table of [...teamTables, ...preservedTables]) fingerprints[table] = await legacySql(`select md5(coalesce(jsonb_agg(${includeBrief ? 'to_jsonb(t)' : "to_jsonb(t) - 'notes' - 'notes_revision'"} order by to_jsonb(t)::text)::text,'[]')) from public.${table} t`);
    return JSON.stringify(fingerprints);
  }
  const legacyBefore = await legacyFingerprint(false);
  await legacySql(migration);
  check(await legacyFingerprint(false) === legacyBefore, 'populated pre-brief upgrade preserves existing owner, memberships, revoked invite and foundation sentinels');
  check(await legacySql("select notes = '' and notes_revision = 0 from public.platform_teams where id='60000000-0000-4000-8000-000000000001'") === 't', 'pre-brief team receives empty brief and revision zero defaults');
  check(await legacySql("select count(*) from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname='public' and p.proname='platform_team_action' and p.pronargs=7") === '0', 'populated pre-brief upgrade removes old callable overload');
  await legacySql(actor(user(2), call('save-notes', "p_team_id => '60000000-0000-4000-8000-000000000001', p_notes => 'Existing team collaboration', p_expected_revision => 0")));
  const legacyBriefBefore = await legacyFingerprint(true);
  await legacySql(migration);
  check(await legacyFingerprint(true) === legacyBriefBefore, 'populated upgraded replay preserves new brief text/revision and all existing data');
  const columns = JSON.parse(await sql(`select jsonb_agg(jsonb_build_object('table',c.relname,'name',a.attname,'type',format_type(a.atttypid,a.atttypmod),'nullable',not a.attnotnull) order by c.relname,a.attnum) from pg_attribute a join pg_class c on c.oid=a.attrelid join pg_namespace n on n.oid=c.relnamespace where n.nspname='public' and c.relname in ('platform_teams','platform_team_members','platform_team_invitations') and a.attnum>0 and not a.attisdropped`));
  let generated = '// Generated from the locally verified PostgreSQL schema by supabase/tests/verify-platform-teams.mjs --write-schema.\n// Do not edit manually. Table access still requires database grants; these types grant no authority.\nexport type TeamDatabaseRows = {\n';
  for (const table of ['platform_teams', 'platform_team_members', 'platform_team_invitations']) {
    generated += `  ${table}: {\n`;
    for (const column of columns.filter(c => c.table === table)) {
      assert.ok(['uuid', 'text', 'timestamp with time zone', 'integer'].includes(column.type), `Unknown schema type ${column.type}`);
      generated += `    ${column.name}: ${column.type === 'integer' ? 'number' : 'string'}${column.nullable ? ' | null' : ''}\n`;
    }
    generated += '  }\n';
  }
  generated += '}\n';
  const generatedPath = path.join(here, '../../apps/platform/src/lib/teams/schema.generated.ts');
  if (process.argv.includes('--write-schema')) await writeFile(generatedPath, generated);
  check((await readFile(generatedPath, 'utf8')).replaceAll('\r\n', '\n') === generated, 'checked-in team row types match verified local PostgreSQL columns and nullability');
  console.log(`Platform teams PostgreSQL verification passed: ${assertions} assertions. PostgreSQL ${await sql('show server_version')}.`);
} finally {
  if (startAttempted) {
    let running = false;
    try { await exec(executable('pg_ctl'), ['-D', dataDirectory, 'status'], { env }); running = true; }
    catch (error) { if (error.code !== 3) throw error; } // 3 explicitly means not running.
    if (running) await daemonControl(executable('pg_ctl'), ['-D', dataDirectory, '-m', 'fast', '-w', '-t', '30', 'stop'], env);
    // A failed or uncertain stop/status preserves the directory instead of deleting it.
  }
  // Never delete computed paths without verifying resolved containment and identity.
  assert.equal(await realpath(resolvedDirectory), resolvedDirectory);
  assert.equal(path.dirname(resolvedDirectory), temporaryRoot);
  assert.ok(path.basename(resolvedDirectory).startsWith('avoid-teams-pg-'));
  await rm(resolvedDirectory, { recursive: true, force: false });
  console.log('Stopped and removed the owned temporary PostgreSQL cluster.');
}
