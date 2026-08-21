import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const auditDirectory = path.dirname(fileURLToPath(import.meta.url));
const repositoryRoot = path.resolve(auditDirectory, "..", "..");
const snapshotPath = path.join(
  auditDirectory,
  "production-baseline-2026-08-20.json",
);
const inventoryPath = path.join(
  auditDirectory,
  "production-readonly-inventory.sql",
);

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

const snapshot = JSON.parse(readFileSync(snapshotPath, "utf8"));
const inventory = readFileSync(inventoryPath, "utf8");

assert(
  snapshot.schemaVersion === 1,
  "Unexpected Sprint 0 snapshot schema version.",
);
assert(
  snapshot.project.ref === "jyuafqzjrzifqbgcqbnt",
  "Snapshot is not for the aVOID project.",
);
assert(
  snapshot.migrations.liveCount === snapshot.migrations.liveVersions.length,
  "Live migration count is inconsistent.",
);
assert(
  snapshot.publicSchema.tableCount === snapshot.publicSchema.tables.length,
  "Public table count is inconsistent.",
);
assert(
  snapshot.dataAggregates.scores.total === 69,
  "Frozen score count changed inside the snapshot.",
);
assert(
  snapshot.classification.allExistingLeaderboardScores === "legacy",
  "Legacy score classification is missing.",
);
assert(
  snapshot.branchCost.approvalRequired === true,
  "Hosted branch creation must remain approval-gated.",
);
assert(
  snapshot.project.scheduledBackupStatus.includes("not-verified"),
  "The unverified backup status must remain explicit.",
);

const forbiddenSnapshotKeys = new Set([
  "email",
  "playerName",
  "player_name",
  "userId",
  "user_id",
  "stripeCustomerId",
  "stripe_customer_id",
  "token",
  "password",
  "secret",
]);

function inspectKeys(value, trail = []) {
  if (Array.isArray(value)) {
    value.forEach((item, index) =>
      inspectKeys(item, [...trail, String(index)]),
    );
    return;
  }
  if (!value || typeof value !== "object") return;
  for (const [key, child] of Object.entries(value)) {
    assert(
      !forbiddenSnapshotKeys.has(key),
      `Sensitive key found at ${[...trail, key].join(".")}`,
    );
    inspectKeys(child, [...trail, key]);
  }
}

inspectKeys(snapshot);

const forbiddenSqlFragments = [
  "select email",
  "select raw_user_meta_data",
  "select player_name",
  "select stripe_customer_id",
  "select access_token",
  "select refresh_token",
];
for (const fragment of forbiddenSqlFragments) {
  assert(
    !inventory.toLowerCase().includes(fragment),
    `Inventory query contains forbidden row-level selection: ${fragment}`,
  );
}
assert(
  inventory.toLowerCase().includes("begin transaction read only"),
  "Inventory SQL must open a read-only transaction.",
);
assert(
  inventory.toLowerCase().includes("rollback;"),
  "Inventory SQL must end with rollback.",
);

const trackedFiles = execFileSync("git", ["ls-files"], {
  cwd: repositoryRoot,
  encoding: "utf8",
})
  .split(/\r?\n/)
  .filter(Boolean);
const trackedVersions = [
  ...new Set(
    trackedFiles.flatMap((file) => {
      const match = file.match(/supabase\/migrations\/(\d{14})_.*\.sql$/);
      return match ? [match[1]] : [];
    }),
  ),
].sort();

const liveVersions = [...snapshot.migrations.liveVersions].sort();
const expectedLiveMissing = liveVersions.filter(
  (version) => !trackedVersions.includes(version),
);
const expectedTrackedMissing = trackedVersions.filter(
  (version) => !liveVersions.includes(version),
);

assert(
  JSON.stringify(expectedLiveMissing) ===
    JSON.stringify([...snapshot.migrations.liveMissingFromTracked].sort()),
  "Live-to-repository migration drift no longer matches the snapshot.",
);
assert(
  JSON.stringify(expectedTrackedMissing) ===
    JSON.stringify([...snapshot.migrations.trackedMissingFromLive].sort()),
  "Repository-to-live migration drift no longer matches the snapshot.",
);

console.log(
  "Sprint 0 recoverability evidence is internally consistent and contains no forbidden row-level keys.",
);
console.log(
  `Live migrations: ${liveVersions.length}; tracked unique migrations: ${trackedVersions.length}.`,
);
console.log(
  `Live versions missing from source: ${expectedLiveMissing.length}; tracked versions missing from live: ${expectedTrackedMissing.length}.`,
);
