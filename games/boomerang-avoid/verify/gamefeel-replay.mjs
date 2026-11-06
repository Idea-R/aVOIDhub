import { chromium } from "playwright";
import fs from "node:fs/promises";
import assert from "node:assert/strict";
import { fileURLToPath } from "node:url";
import * as sim from "../../../packages/boomerangavoid-sim/src/index.ts";
function replay(api) {
  return api.ARENAS.flatMap((arena) =>
    ["ffa", "teams", "relay"].map((mode) => {
      const seats = api.CHARACTERS.map((c, i) => ({
        id: `p${i}`,
        name: c.name,
        character: c.id,
        color: c.color,
        team: i % 2,
        bot: ["easy", "normal", "hard"][i % 3],
      }));
      const s = api.createMatch(
          {
            mode,
            wins: 3,
            mapId: arena.id,
            seed: 41827,
            friendlyFire: false,
            upgrades: true,
          },
          seats,
        ),
        hashes = [];
      for (let i = 0; i < 2400; i++) {
        api.step(s, api.getBotInputs(s));
        if (i % 120 === 119) hashes.push(api.stateHash(s));
      }
      return { arena: arena.id, mode, hashes };
    }),
  );
}
const node = replay(sim),
  browser = await chromium.launch({
    channel: "chrome",
    headless: true,
    args: ["--no-sandbox"],
  });
try {
  const page = await browser.newPage();
  await page.goto("http://127.0.0.1:5188/boomerangavoid/src/input.ts");
  const module =
    "/boomerangavoid/@fs/" +
    fileURLToPath(
      new URL(
        "../../../packages/boomerangavoid-sim/src/index.ts",
        import.meta.url,
      ),
    ).replaceAll("\\", "/");
  const chrome = await page.evaluate(
    async ({ code, module }) => {
      const api = await import(module);
      return (0, eval)(`(${code})`)(api);
    },
    { code: replay.toString(), module },
  );
  assert.deepEqual(chrome, node);
  const report = {
    timestamp: new Date().toISOString(),
    ruleset: sim.RULESET,
    node: process.version,
    browser: browser.version(),
    cases: node.length,
    checkpoints: node.reduce((sum, result) => sum + result.hashes.length, 0),
    identical: true,
    scope: "Node/Chrome V8 only; Firefox/WebKit unverified",
    results: node,
  };
  await fs.writeFile(
    new URL(
      `../../../docs/boomerangavoid/evidence/${['polish-next','bot-onboarding'].includes(process.env.BAV_EVIDENCE_NAME)?process.env.BAV_EVIDENCE_NAME:'gamefeel'}/replay-check.json`,
      import.meta.url,
    ),
    JSON.stringify(report, null, 2),
  );
  console.log(JSON.stringify({ cases: report.cases, checkpoints: report.checkpoints, identical: true }));
} finally {
  await browser.close();
}
