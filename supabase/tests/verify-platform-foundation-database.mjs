// Native PostgreSQL rehearsal against an EXPLICIT SYNTHETIC legacy contract.
// No project env files, credentials, hosted endpoints or pre-existing databases.
import assert from "node:assert/strict";
import { execFile, spawn } from "node:child_process";
import { mkdtemp, readFile, realpath, rm } from "node:fs/promises";
import net from "node:net";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { promisify } from "node:util";

const exec = promisify(execFile);
const here = path.dirname(fileURLToPath(import.meta.url));
const bin =
  process.env.FOUNDATION_TEST_PG_BIN ||
  "C:\\Program Files\\PostgreSQL\\17\\bin";
const executable = (name) =>
  path.join(bin, process.platform === "win32" ? `${name}.exe` : name);
const temporaryRoot = await realpath(os.tmpdir());
const directory = await realpath(
  await mkdtemp(path.join(temporaryRoot, "avoid-foundation-pg-")),
);
assert.equal(path.dirname(directory), temporaryRoot);
const dataDirectory = path.join(directory, "data");
const listener = net.createServer();
await new Promise((resolve, reject) => {
  listener.once("error", reject);
  listener.listen(0, "127.0.0.1", resolve);
});
const port = listener.address().port;
await new Promise((resolve) => listener.close(resolve));
const env = { ...process.env };
for (const key of Object.keys(env)) if (key.startsWith("PG")) delete env[key];
const control = (args) =>
  new Promise((resolve, reject) => {
    const child = spawn(executable("pg_ctl"), args, {
      env,
      stdio: "ignore",
      windowsHide: true,
    });
    child.once("error", reject);
    child.once("close", (code) =>
      code === 0 ? resolve() : reject(new Error(`pg_ctl exited ${code}`)),
    );
  });
// Feed SQL on stdin: Windows command lines have a 32K limit. The actual migration
// bytes remain intact, and explicit BEGIN/COMMIT below makes each rehearsal atomic.
const sql = (source, database = "postgres") =>
  new Promise((resolve, reject) => {
    const child = spawn(
      executable("psql"),
      [
        "-X",
        "-q",
        "-A",
        "-t",
        "-v",
        "ON_ERROR_STOP=1",
        "-v",
        "VERBOSITY=verbose",
        "-h",
        "127.0.0.1",
        "-p",
        String(port),
        "-U",
        "postgres",
        "-d",
        database,
        "-f",
        "-",
      ],
      { env, windowsHide: true },
    );
    let stdout = "",
      stderr = "";
    child.stdout.on("data", (chunk) => {
      stdout += chunk;
    });
    child.stderr.on("data", (chunk) => {
      stderr += chunk;
    });
    child.once("error", reject);
    child.once("close", (code) =>
      code === 0
        ? resolve(stdout.trim())
        : reject(
            Object.assign(new Error(`psql exited ${code}`), {
              stderr,
              stdout,
              code,
            }),
          ),
    );
    child.stdin.on("error", reject);
    child.stdin.end(source);
  });
const user = (n) => `00000000-0000-4000-8000-${String(n).padStart(12, "0")}`;
const actor = (id, source, role = "authenticated") =>
  `begin; set local role ${role}; set local "request.jwt.claim.sub"='${id || ""}'; ${source}; commit;`;
let assertions = 0;
const failures = [];
async function test(name, run) {
  try {
    await run();
    assertions++;
    console.log(`PASS ${name}`);
  } catch (error) {
    failures.push({ name, error });
    console.error(`FAIL ${name}: ${error.stderr || error.message}`);
  }
}
async function denied(source, code, db) {
  try {
    await sql(source, db);
    assert.fail("unexpected success");
  } catch (error) {
    assert.match(
      error.stderr || "",
      new RegExp(`\\b${code}\\b`),
      error.stderr || error.message,
    );
  }
}
const fingerprint = async (db, tables, strip = []) => {
  const output = {};
  for (const table of tables)
    output[table] = await sql(
      `select md5(coalesce(jsonb_agg(to_jsonb(t) ${strip.map((c) => `- '${c}'`).join(" ")} order by to_jsonb(t)::text)::text,'[]')) from public.${table} t`,
      db,
    );
  return JSON.stringify(output);
};
const fixture = await readFile(
  path.join(here, "database/platform_foundation_legacy_fixture.sql"),
  "utf8",
);
const historical = await Promise.all(
  [
    "20250607070000_fix_current_time_issue.sql",
    "20250705173200_enhanced_leaderboard_system.sql",
  ].map((name) => readFile(path.join(here, "../migrations", name), "utf8")),
);
const foundation = await readFile(
  path.join(here, "../migrations/20260820064235_avoid_platform_foundation.sql"),
  "utf8",
);
const teams = await readFile(
  path.join(here, "../migrations/20261105090000_platform_teams.sql"),
  "utf8",
);
const runId = "10000000-0000-4000-8000-000000000001";
const hash = "a".repeat(64);
const finish = (
  id = runId,
  owner = `'${user(1)}'`,
  ticket = `'${hash}'`,
  score = "42",
  metrics = "'{}'::jsonb",
) =>
  `select row_to_json(r) from public.finish_provisional_run('${id}',${owner},${ticket},${score},${metrics}) r`;
let started = false;
try {
  await exec(
    executable("initdb"),
    [
      "-D",
      dataDirectory,
      "-U",
      "postgres",
      "-A",
      "trust",
      "--no-locale",
      "--encoding=UTF8",
    ],
    { env },
  );
  started = true;
  try {
    await control([
      "-D",
      dataDirectory,
      "-l",
      path.join(directory, "postgres.log"),
      "-o",
      `-h 127.0.0.1 -p ${port} -c unix_socket_directories=`,
      "-w",
      "-t",
      "30",
      "start",
    ]);
  } catch (error) {
    throw new Error(
      await readFile(path.join(directory, "postgres.log"), "utf8").catch(
        () => error.message,
      ),
      { cause: error },
    );
  }
  for (const populated of [false, true]) {
    const db = populated ? "foundation_populated" : "foundation_empty";
    await sql(`create database ${db}`);
    await sql(fixture, db);
    if (populated)
      await sql(
        `
      insert into auth.users(id,email,email_confirmed_at) values('${user(1)}','owner@example.com',now()),('${user(2)}','member@example.com',now());
      insert into public.user_profiles(id,username,display_name,best_score,total_games_played,is_public) values('${user(1)}','legacy-owner','Owner',777,9,true),('${user(2)}','legacy-member','Member',555,7,true);
      insert into public.games values('fixture-game',true),('hidden-game',false);
      insert into public.leaderboard_scores(player_name,score,user_id,game_session_id,game_key,is_verified) values('Legacy',777,'${user(1)}','preserve-session','fixture-game',true);
      insert into public.user_profiles_backup_manual select * from public.user_profiles;
      insert into public.leaderboard_scores_backup_manual select * from public.leaderboard_scores;
      insert into public.game_scores(user_id,score) values('${user(1)}',123);
    `,
        db,
      );
    await sql(historical[0], db);
    await sql(historical[1], db);
    const legacyBefore = await fingerprint(
      db,
      ["user_profiles", "leaderboard_scores"],
      [
        "is_public",
        "is_verified",
        "verification_level",
        "submission_id",
        "metadata",
      ],
    );
    const unrelatedBefore = await fingerprint(db, [
      "game_scores",
      "user_profiles_backup_manual",
      "leaderboard_scores_backup_manual",
      "global_user_stats",
      "user_game_stats",
      "game_statistics",
    ]);
    // Test that the migration establishes RLS rather than trusting legacy flags.
    await sql(
      "alter table public.user_profiles disable row level security;alter table public.games disable row level security;alter table public.leaderboard_scores disable row level security;alter table public.game_scores disable row level security",
      db,
    );
    await sql(`begin; ${foundation}; commit;`, db);
    await test(`${db}: actual foundation applies and retains legacy owner/score data`, async () =>
      assert.equal(
        await fingerprint(
          db,
          ["user_profiles", "leaderboard_scores"],
          [
            "is_public",
            "is_verified",
            "verification_level",
            "submission_id",
            "metadata",
          ],
        ),
        legacyBefore,
      ));
    await test(`${db}: legacy profile/game/score tables enforce RLS`, async () =>
      assert.equal(
        await sql(
          "select count(*) from pg_class where oid in ('public.user_profiles'::regclass,'public.games'::regclass,'public.leaderboard_scores'::regclass,'public.game_scores'::regclass) and relrowsecurity",
          db,
        ),
        "4",
      ));
    await test(`${db}: historical aggregates, backups and unrelated scores preserved`, async () =>
      assert.equal(
        await fingerprint(db, [
          "game_scores",
          "user_profiles_backup_manual",
          "leaderboard_scores_backup_manual",
          "global_user_stats",
          "user_game_stats",
          "game_statistics",
        ]),
        unrelatedBefore,
      ));
    await test(`${db}: legacy privacy and unsafe verified flags closed`, async () =>
      assert.equal(
        await sql(
          "select (not exists(select from public.user_profiles where is_public) and not exists(select from public.leaderboard_scores where is_verified))",
          db,
        ),
        "t",
      ));
    await test(`${db}: unknown legacy RPC execute revoked`, () =>
      denied(
        actor(user(1), "select public.legacy_untrusted_rpc()"),
        "42501",
        db,
      ));
    const first = await fingerprint(db, [
      "user_profiles",
      "leaderboard_scores",
    ]);
    await sql(`begin; ${foundation}; commit;`, db);
    await test(`${db}: immediate foundation replay preserves all profile and score bytes`, async () =>
      assert.equal(
        await fingerprint(db, ["user_profiles", "leaderboard_scores"]),
        first,
      ));
    await sql(teams, db);
    await test(`${db}: actual team extension applies after foundation`, async () =>
      assert.equal(
        await sql("select count(*) from public.platform_teams", db),
        "0",
      ));
    if (!populated) continue;
    const asActor = (source, number = 1, role = "authenticated") =>
      sql(actor(user(number), source, role), db);
    for (const role of ["anon", "authenticated"]) {
      for (const table of [
        "leaderboard_scores",
        "game_scores",
        "billing_accounts",
        "game_run_sessions",
        "score_submissions",
        "creator_applications",
        "game_submissions",
      ])
        await test(`${role}: direct ${table} insertion denied`, () =>
          denied(
            actor(user(1), `insert into public.${table} default values`, role),
            "42501",
            db,
          ));
      for (const table of [
        "user_profiles_backup_manual",
        "leaderboard_scores_backup_manual",
        "billing_accounts",
        "game_run_sessions",
        "score_submissions",
      ])
        await test(`${role}: private ${table} read denied`, () =>
          denied(
            actor(user(1), `select * from public.${table}`, role),
            "42501",
            db,
          ));
      await test(`${role}: accepted-score RPC denied`, () =>
        denied(actor(user(1), finish(), role), "42501", db));
      await test(`${role}: statistics RPC denied`, () =>
        denied(
          actor(
            user(1),
            `select public.update_game_statistics('${user(1)}')`,
            role,
          ),
          "42501",
          db,
        ));
    }
    await test("anonymous and unrelated actors cannot read private owner profile", async () => {
      assert.equal(
        await asActor(
          `select count(*) from public.user_profiles where id='${user(1)}'`,
          2,
        ),
        "0",
      );
      assert.equal(
        await sql(
          actor(null, "select count(*) from public.user_profiles", "anon"),
          db,
        ),
        "0",
      );
    });
    await test("owner can opt into public profile visibility", async () => {
      await asActor(
        `update public.user_profiles set is_public=true where id='${user(1)}'`,
      );
      assert.equal(
        await asActor(
          `select count(*) from public.user_profiles where id='${user(1)}'`,
          2,
        ),
        "1",
      );
    });
    await test("owner cannot modify aggregate or billing columns", () =>
      denied(
        actor(
          user(1),
          `update public.user_profiles set best_score=999,stripe_customer_id='forged' where id='${user(1)}'`,
        ),
        "42501",
        db,
      ));
    await test("anonymous inherited column-only backup grant is closed", () =>
      denied(
        actor(
          null,
          "select player_name from public.leaderboard_scores_backup_manual",
          "anon",
        ),
        "42501",
        db,
      ));
    await test("unrelated profile mutation affects no owner rows", async () => {
      await asActor(
        `update public.user_profiles set display_name='forged' where id='${user(1)}'`,
        2,
      );
      assert.equal(
        await sql(
          `select display_name from public.user_profiles where id='${user(1)}'`,
          db,
        ),
        "Owner",
      );
    });
    await test("game RLS hides inactive games from browser roles", async () =>
      assert.equal(await asActor("select count(*) from public.games"), "1"));
    await test("favorite ownership RLS allows own row and blocks forged owner", async () => {
      await asActor(
        `insert into public.game_favorites(user_id,game_key) values('${user(1)}','fixture-game')`,
      );
      assert.equal(
        await asActor("select count(*) from public.game_favorites", 2),
        "0",
      );
      await denied(
        actor(
          user(2),
          `insert into public.game_favorites(user_id,game_key) values('${user(1)}','hidden-game')`,
        ),
        "42501",
        db,
      );
    });
    await test("favorite FK rejects unknown game", () =>
      denied(
        actor(
          user(1),
          `insert into public.game_favorites(user_id,game_key) values('${user(1)}','unknown-game')`,
        ),
        "23503",
        db,
      ));
    await test("signup ignores forged metadata roles/email and creates private profile", async () => {
      await sql(
        `insert into auth.users(id,email,raw_user_meta_data) values('${user(3)}','private-address@example.com','{"display_name":" Friendly ","role":"admin","email":"leaked@example.com"}')`,
        db,
      );
      assert.equal(
        await sql(
          `select display_name='Friendly' and not is_public and username not like '%private%' from public.user_profiles where id='${user(3)}'`,
          db,
        ),
        "t",
      );
    });
    await test("shared-prefix UUID signups receive distinct usernames within API bound", async () => {
      await sql(
        `insert into auth.users(id,email) values('${user(4)}','second@example.com')`,
        db,
      );
      assert.equal(
        await sql(
          `select count(distinct username)=2 and bool_and(length(username)<=24) from public.user_profiles where id in ('${user(3)}','${user(4)}')`,
          db,
        ),
        "t",
      );
    });
    await test("signup retries occupied deterministic username without changing existing owner", async () => {
      await sql(
        `update public.user_profiles set username='player-'||left(md5('${user(7)}:0'),17) where id='${user(2)}';insert into auth.users(id,email) values('${user(7)}','retry@example.com')`,
        db,
      );
      assert.equal(
        await sql(
          `select username='player-'||left(md5('${user(7)}:1'),17) from public.user_profiles where id='${user(7)}'`,
          db,
        ),
        "t",
      );
      assert.equal(
        await sql(
          `select username='player-'||left(md5('${user(7)}:0'),17) from public.user_profiles where id='${user(2)}'`,
          db,
        ),
        "t",
      );
    });
    // Backfill is exercised against two missing profiles with the same UUID prefix.
    await sql(
      `alter table auth.users disable trigger on_auth_user_created; insert into auth.users(id,email) values('${user(5)}','backfill-one@example.com'),('${user(6)}','backfill-two@example.com'); alter table auth.users enable trigger on_auth_user_created`,
      db,
    );
    await sql(
      `update public.user_profiles set username='player-'||left(md5('${user(5)}:0'),17) where id='${user(2)}'`,
      db,
    );
    await test("service backfill supports shared-prefix IDs, occupied handle retry and replay", async () => {
      assert.equal(
        await asActor(
          "select public.backfill_missing_profiles()",
          1,
          "service_role",
        ),
        "2",
      );
      assert.equal(
        await asActor(
          "select public.backfill_missing_profiles()",
          1,
          "service_role",
        ),
        "0",
      );
      assert.equal(
        await sql(
          `select username='player-'||left(md5('${user(5)}:1'),17) from public.user_profiles where id='${user(5)}'`,
          db,
        ),
        "t",
      );
    });
    await sql(
      `insert into public.game_run_sessions(id,user_id,game_key,ticket_hash,expires_at,ruleset_version) values('${runId}','${user(1)}','fixture-game','${hash}',now()+interval '1 hour','rules-v2')`,
      db,
    );
    const service = (source) => asActor(source, 1, "service_role");
    for (const [name, source, code] of [
      ["negative score", finish(runId, undefined, undefined, "-1"), "22003"],
      [
        "array metrics",
        finish(runId, undefined, undefined, "42", "'[]'::jsonb"),
        "22023",
      ],
      [
        "overlimit metrics",
        finish(
          runId,
          undefined,
          undefined,
          "42",
          "jsonb_build_object('x',repeat('x',8192))",
        ),
        "22023",
      ],
      ["wrong actor", finish(runId, `'${user(2)}'`), "P0002"],
      [
        "wrong ticket",
        finish(runId, undefined, `'${"b".repeat(64)}'`),
        "28000",
      ],
      ["null actor", finish(runId, "null"), "P0002"],
      ["null ticket", finish(runId, undefined, "null"), "28000"],
      ["null score", finish(runId, undefined, undefined, "null"), "22003"],
    ])
      await test(`accepted-score rejects ${name}`, () =>
        denied(actor(user(1), source, "service_role"), code, db));
    let receipt;
    await test("accepted-score RPC succeeds after retiring legacy aggregate trigger", async () => {
      receipt = JSON.parse(await service(finish()));
      assert.equal(receipt.verification_level, "provisional");
      assert.equal(
        await sql(
          `select score=42 and not is_verified and metadata->>'rulesetVersion'='rules-v2' from public.leaderboard_scores where id='${receipt.leaderboard_score_id}'`,
          db,
        ),
        "t",
      );
    });
    await test("accepted-score retry returns identical receipt without duplicate rows", async () => {
      assert.ok(receipt);
      assert.deepEqual(JSON.parse(await service(finish())), receipt);
      assert.equal(
        await sql(
          `select count(*) from public.score_submissions where run_session_id='${runId}'`,
          db,
        ),
        "1",
      );
    });
    const concurrent = "10000000-0000-4000-8000-000000000002";
    await sql(
      `insert into public.game_run_sessions(id,user_id,game_key,ticket_hash,expires_at) values('${concurrent}','${user(1)}','fixture-game','${hash}',now()+interval '1 hour')`,
      db,
    );
    await test("concurrent accepted-score retries consume once and share receipt", async () => {
      const replies = await Promise.all([
        service(finish(concurrent)),
        service(finish(concurrent)),
      ]);
      assert.equal(replies[0], replies[1]);
      assert.equal(
        await sql(
          `select count(*) from public.score_submissions where run_session_id='${concurrent}'`,
          db,
        ),
        "1",
      );
    });
    const expired = "10000000-0000-4000-8000-000000000003";
    await sql(
      `insert into public.game_run_sessions(id,user_id,game_key,ticket_hash,expires_at) values('${expired}','${user(1)}','fixture-game','${hash}',now()+interval '1 hour')`,
      db,
    );
    await test("accepted-score expiry uses wall clock after transaction starts", () =>
      denied(
        `begin; update public.game_run_sessions set expires_at=now()+interval '100 milliseconds' where id='${expired}';set local role service_role;select pg_sleep(0.2);${finish(expired)};commit;`,
        "22023",
        db,
      ));
    await test("statistics reject explicit null increments without corrupting totals", () =>
      denied(
        actor(
          user(1),
          `select public.update_game_statistics('${user(1)}',null)`,
          "service_role",
        ),
        "22003",
        db,
      ));
    await test("statistics reject negative and overlimit increments", async () => {
      await denied(
        actor(
          user(1),
          `select public.update_game_statistics('${user(1)}',-1)`,
          "service_role",
        ),
        "22003",
        db,
      );
      await denied(
        actor(
          user(1),
          `select public.update_game_statistics('${user(1)}',1,100001)`,
          "service_role",
        ),
        "22003",
        db,
      );
    });
    await test("statistics update resolves legacy current_survival_time column unambiguously", async () => {
      await service(
        `select public.update_game_statistics('${user(1)}',1,2,3,4,50,6,7,8)`,
      );
      assert.equal(
        await sql(
          `select total_games_played=10 and total_meteors_destroyed=2 and total_survival_time=3 and total_distance_traveled=4 and best_game_score=50 and best_game_time=7 from public.user_profiles where id='${user(1)}'`,
          db,
        ),
        "t",
      );
    });
    await test("provisional receipts do not mutate historical aggregates", async () =>
      assert.equal(
        await fingerprint(db, [
          "game_scores",
          "user_profiles_backup_manual",
          "leaderboard_scores_backup_manual",
          "global_user_stats",
          "user_game_stats",
          "game_statistics",
        ]),
        unrelatedBefore,
      ));
    const team = JSON.parse(
      await asActor(
        "select public.platform_team_action('create',p_name=>'Foundation team')",
      ),
    ).teamId;
    await test("team snapshot works with real foundation profiles", async () =>
      assert.equal(
        JSON.parse(await asActor("select public.platform_teams_snapshot()"))
          .teams[0].id,
        team,
      ));
    await test("real foundation identities support team invitation acceptance and member brief", async () => {
      await asActor(
        `select public.platform_team_action('invite',p_team_id=>'${team}',p_email=>'member@example.com',p_token_hash=>'${"b".repeat(64)}')`,
      );
      await asActor(
        `select public.platform_team_action('accept',p_token_hash=>'${"b".repeat(64)}')`,
        2,
      );
      await asActor(
        `select public.platform_team_action('save-notes',p_team_id=>'${team}',p_notes=>'Preserved member brief',p_expected_revision=>0)`,
        2,
      );
      const shared = JSON.parse(
        await asActor("select public.platform_teams_snapshot()", 2),
      ).teams[0];
      assert.equal(shared.notes, "Preserved member brief");
      assert.equal(shared.notes_revision, 1);
      assert.equal(shared.members.length, 2);
      assert.equal(shared.invitations.length, 0);
    });
    await sql(
      `insert into public.user_entitlements(user_id,entitlement_key,source,source_reference) values('${user(1)}','cosmetics.supporter','grant','preserve-manual-grant');insert into public.creator_profiles(user_id,slug,display_name,is_published) values('${user(1)}','creator-fixture','Creator fixture',true);insert into public.creator_applications(user_id,display_name,pitch,status) values('${user(1)}','Creator fixture',repeat('p',40),'approved');insert into public.game_submissions(user_id,title,game_url,summary,status) values('${user(1)}','Preserved game','https://example.invalid/game',repeat('s',40),'approved');insert into public.billing_accounts(user_id,stripe_customer_id) values('${user(1)}','synthetic-local-only')`,
      db,
    );
    await test("entitlement/application/submission RLS isolates unrelated user", async () => {
      for (const table of [
        "user_entitlements",
        "creator_applications",
        "game_submissions",
      ]) {
        assert.equal(
          await asActor(`select count(*) from public.${table}`),
          "1",
        );
        assert.equal(
          await asActor(`select count(*) from public.${table}`, 2),
          "0",
        );
      }
    });
    const preserved = [
      "user_profiles",
      "leaderboard_scores",
      "game_scores",
      "global_user_stats",
      "user_game_stats",
      "game_statistics",
      "platform_teams",
      "platform_team_members",
      "platform_team_invitations",
      "user_entitlements",
      "creator_profiles",
      "creator_applications",
      "game_submissions",
      "billing_accounts",
      "membership_plans",
      "entitlement_definitions",
      "plan_entitlements",
      "platform_foundation_migration_state",
    ];
    const beforeReplay = await fingerprint(db, preserved);
    await sql(`begin; ${foundation}; commit;`, db);
    await test("populated foundation replay preserves profile publication, scores, teams and aggregates", async () =>
      assert.equal(await fingerprint(db, preserved), beforeReplay));
    await test("foundation replay preserves subsequently authorized team RPC", async () =>
      assert.equal(
        JSON.parse(await asActor("select public.platform_teams_snapshot()"))
          .teams[0].id,
        team,
      ));
    await sql(teams, db);
    await test("foundation then team replay preserves populated data and authorization", async () => {
      assert.equal(await fingerprint(db, preserved), beforeReplay);
      assert.equal(
        JSON.parse(await asActor("select public.platform_teams_snapshot()"))
          .teams[0].id,
        team,
      );
    });
    for (const role of ["anon", "authenticated"]) {
      await test(`${role}: foundation completion marker unreadable`, () =>
        denied(
          actor(
            user(1),
            "select * from public.platform_foundation_migration_state",
            role,
          ),
          "42501",
          db,
        ));
      await test(`${role}: foundation completion marker cannot be forged`, () =>
        denied(
          actor(
            user(1),
            "insert into public.platform_foundation_migration_state(version) values('20260820064235') on conflict do nothing",
            role,
          ),
          "42501",
          db,
        ));
    }
    await sql(
      "create database foundation_unmarked template foundation_populated",
    );
    await sql(
      "drop table public.platform_foundation_migration_state",
      "foundation_unmarked",
    );
    const unmarkedTables = preserved.filter(
      (t) => t !== "platform_foundation_migration_state",
    );
    const unmarkedBefore = await fingerprint(
      "foundation_unmarked",
      unmarkedTables,
    );
    await test("existing unmarked full foundation fails closed and preserves opt-in/team data", async () => {
      await denied(
        `begin; ${foundation}; commit;`,
        "55000",
        "foundation_unmarked",
      );
      assert.equal(
        await fingerprint("foundation_unmarked", unmarkedTables),
        unmarkedBefore,
      );
      assert.equal(
        JSON.parse(
          await sql(
            actor(user(1), "select public.platform_teams_snapshot()"),
            "foundation_unmarked",
          ),
        ).teams[0].id,
        team,
      );
    });
    await sql("create database foundation_partial");
    await sql(fixture, "foundation_partial");
    await sql(
      "create table public.membership_plans(plan_key text primary key);insert into public.membership_plans values('preserve-partial');create table public.platform_foundation_migration_state(version text primary key,completed_at timestamptz default now())",
      "foundation_partial",
    );
    await test("empty marker with partial foundation is not inferred successful", async () => {
      await denied(
        `begin; ${foundation}; commit;`,
        "55000",
        "foundation_partial",
      );
      assert.equal(
        await sql(
          "select plan_key from public.membership_plans",
          "foundation_partial",
        ),
        "preserve-partial",
      );
      assert.equal(
        await sql(
          "select count(*) from public.platform_foundation_migration_state",
          "foundation_partial",
        ),
        "0",
      );
    });
  }
  await sql("create database foundation_rollback");
  await sql(fixture, "foundation_rollback");
  for (const migration of historical)
    await sql(migration, "foundation_rollback");
  await test("failed atomic foundation transaction rolls back completion marker and DDL", async () => {
    await denied(
      `begin; ${foundation}; select 1/0; commit;`,
      "22012",
      "foundation_rollback",
    );
    assert.equal(
      await sql(
        "select to_regclass('public.platform_foundation_migration_state') is null and to_regclass('public.membership_plans') is null",
        "foundation_rollback",
      ),
      "t",
    );
  });
  await test("fresh foundation can run after rolled-back failed attempt", async () => {
    await sql(`begin; ${foundation}; commit;`, "foundation_rollback");
    assert.equal(
      await sql(
        "select count(*) from public.platform_foundation_migration_state",
        "foundation_rollback",
      ),
      "1",
    );
  });
  await sql("create database legacy_rename");
  await sql(fixture, "legacy_rename");
  await sql(
    `alter table public.user_profiles drop column current_survival_time;alter table public.user_profiles add column "current_time" numeric;insert into auth.users(id) values('${user(1)}');insert into public.user_profiles(id,username,"current_time") values('${user(1)}','rename-preserve',37.5)`,
    "legacy_rename",
  );
  await test("202506 old reserved column rename preserves nonzero survival value", async () => {
    await sql(historical[0], "legacy_rename");
    assert.equal(
      await sql(
        "select current_survival_time from public.user_profiles",
        "legacy_rename",
      ),
      "37.5",
    );
  });
  const renamed = await fingerprint("legacy_rename", ["user_profiles"]);
  await test("202506 replay on corrected column preserves profile bytes", async () => {
    await sql(historical[0], "legacy_rename");
    assert.equal(
      await fingerprint("legacy_rename", ["user_profiles"]),
      renamed,
    );
  });
  await sql(
    'alter table public.user_profiles add column "current_time" numeric default 81.5',
    "legacy_rename",
  );
  const ambiguous = await fingerprint("legacy_rename", ["user_profiles"]);
  await test("202506 both-column ambiguity fails closed and preserves both values", async () => {
    await denied(historical[0], "55000", "legacy_rename");
    assert.equal(
      await fingerprint("legacy_rename", ["user_profiles"]),
      ambiguous,
    );
  });
  console.log(
    `Foundation native PostgreSQL rehearsal: ${assertions} passed, ${failures.length} failed. PostgreSQL ${await sql("show server_version")}. Synthetic contract only; missing production history remains unverified.`,
  );
  if (failures.length)
    throw new Error(`${failures.length} named database assertions failed`);
} finally {
  if (started) {
    let running = false;
    try {
      await exec(executable("pg_ctl"), ["-D", dataDirectory, "status"], {
        env,
      });
      running = true;
    } catch (error) {
      if (error.code !== 3) throw error;
    }
    if (running)
      await control([
        "-D",
        dataDirectory,
        "-m",
        "fast",
        "-w",
        "-t",
        "30",
        "stop",
      ]);
    try {
      await exec(executable("pg_ctl"), ["-D", dataDirectory, "status"], {
        env,
      });
      throw new Error(`Owned cluster still running; preserving ${directory}`);
    } catch (error) {
      if (error.code !== 3) throw error;
    }
  }
  assert.equal(await realpath(directory), directory);
  assert.equal(path.dirname(directory), temporaryRoot);
  assert.ok(path.basename(directory).startsWith("avoid-foundation-pg-"));
  await rm(directory, { recursive: true, force: false });
  console.log("Stopped and removed the owned temporary PostgreSQL cluster.");
}
