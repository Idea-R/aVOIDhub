import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import path from "node:path";

const here = path.dirname(fileURLToPath(import.meta.url));
const migrationPath = path.resolve(
  here,
  "..",
  "migrations",
  "20260820064235_avoid_platform_foundation.sql",
);
const pgTapPath = path.resolve(here, "database", "platform_foundation.sql");

const [migrationSource, pgTapSource] = await Promise.all([
  readFile(migrationPath, "utf8"),
  readFile(pgTapPath, "utf8"),
]);

const migration = migrationSource.replaceAll("\r\n", "\n");
const pgTap = pgTapSource.replaceAll("\r\n", "\n");

const requiredMigrationFragments = [
  "revoke all on all tables in schema public from public, anon, authenticated;",
  "revoke execute on all functions in schema public from public, anon, authenticated;",
  "update public.leaderboard_scores\nset is_verified = false,",
  "verification_level = 'legacy'",
  "leaderboard_scores_verified_consistency_check",
  "leaderboard_scores_submission_id_fkey",
  "game_run_sessions_game_key_fkey",
  "score_submissions_game_key_fkey",
  "alter table public.user_profiles alter column is_public set default false;",
  "update public.user_profiles set is_public = false",
  "drop trigger if exists trigger_update_user_stats_on_score_insert",
  "drop trigger if exists trigger_sync_leaderboard_player_name",
  "create trigger on_auth_user_created",
  "v_username := 'player-'",
  "set search_path = ''",
  "grant execute on function public.finish_provisional_run",
  "to service_role;",
  "ruleset_version",
  "octet_length(coalesce(p_metrics, '{}'::jsonb)::text) > 8192",
];

for (const fragment of requiredMigrationFragments) {
  assert.ok(
    migration.includes(fragment),
    `Missing migration safety fragment: ${fragment}`,
  );
}

const forbiddenPatterns = [
  /grant\s+(?:all|insert|update|delete)[^;]*leaderboard_scores[^;]*to\s+(?:anon|authenticated)/is,
  /grant\s+insert[^;]*game_scores[^;]*to\s+authenticated/is,
  /grant\s+execute[^;]*update_game_statistics[^;]*to\s+authenticated/is,
  /grant\s+(?:insert|update)[^;]*(?:creator_applications|game_submissions)[^;]*to\s+authenticated/is,
  /create\s+policy[^;]*(?:leaderboard_scores|game_scores)[^;]*for\s+(?:insert|update|delete|all)/is,
  /raw_user_meta_data\s*->>\s*'email'/i,
  /split_part\s*\(\s*new\.email/i,
];

for (const pattern of forbiddenPatterns) {
  assert.doesNotMatch(
    migration,
    pattern,
    `Unsafe migration pattern remains: ${pattern}`,
  );
}

assert.equal(
  (migration.match(/\$\$/g) ?? []).length % 2,
  0,
  "Migration has an unmatched dollar-quoted block",
);
assert.match(pgTap, /^begin;/m, "pgTAP suite must run in a transaction");
assert.match(pgTap, /select no_plan\(\);/, "pgTAP suite must declare its plan");
assert.match(
  pgTap,
  /select \* from finish\(\);/,
  "pgTAP suite must finish cleanly",
);
assert.match(pgTap, /rollback;\s*$/m, "pgTAP suite must roll back test state");

const assertionCount = (pgTap.match(/select (?:has_|is\(|ok\()/g) ?? []).length;
assert.ok(
  assertionCount >= 35,
  `Expected at least 35 pgTAP assertions, found ${assertionCount}`,
);

console.log("Platform foundation static verification passed.");
console.log(`Migration: ${path.relative(process.cwd(), migrationPath)}`);
console.log(`pgTAP assertions: ${assertionCount}`);
