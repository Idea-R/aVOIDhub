import { execFileSync } from "node:child_process";
import { readdir, readFile, stat } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const repositoryRoot = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  "..",
);
const npm = process.platform === "win32" ? "npm.cmd" : "npm";

function run(args) {
  console.log(`\n> npm ${args.join(" ")}`);
  execFileSync(npm, args, {
    cwd: repositoryRoot,
    stdio: "inherit",
    env: process.env,
    shell: process.platform === "win32",
  });
}

run(["run", "verify", "--workspace=@avoid/tankavoid-contract"]);
run(["run", "verify:release", "--workspace=@avoid/tanka-void"]);
run(["run", "test", "--workspace=@avoid/platform"]);
run(["run", "typecheck", "--workspace=@avoid/platform"]);
run(["run", "test:catalog", "--workspace=@avoid/platform"]);
run(["run", "test:foundation"]);
run(["run", "build:platform:netlify"]);

const reviewRoot = path.join(
  repositoryRoot,
  "apps",
  "platform",
  "public",
  "TankaVOID",
);
const indexPath = path.join(reviewRoot, "index.html");
const assetsPath = path.join(reviewRoot, "assets");
const indexStats = await stat(indexPath);
const assets = await readdir(assetsPath);
const netlify = await readFile(
  path.join(repositoryRoot, "netlify.toml"),
  "utf8",
);

if (!indexStats.isFile() || indexStats.size === 0)
  throw new Error("TankaVOID review index is missing or empty.");
if (!assets.some((file) => file.endsWith(".js")))
  throw new Error("TankaVOID review JavaScript asset is missing.");
if (!assets.some((file) => file.endsWith(".css")))
  throw new Error("TankaVOID review CSS asset is missing.");
if (/from\s*=\s*["']\/(?:tankavoid|TankaVOID)(?:\/|["'])/i.test(netlify))
  throw new Error(
    "TankaVOID still requires database, physical-device, and release approval; remove its public redirect.",
  );

console.log("\nTankaVOID release-candidate verification passed.");
console.log(`Review index: ${path.relative(repositoryRoot, indexPath)}`);
console.log(`Review assets: ${assets.length}`);
console.log("Public friendly route: held");
