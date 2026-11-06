import { chromium } from "playwright";
import assert from "node:assert/strict";
import fs from "node:fs/promises";
import { fileURLToPath } from "node:url";
const out = new URL(
  "../../../docs/boomerangavoid/evidence/gamefeel/",
  import.meta.url,
);
await fs.mkdir(out, { recursive: true });
const browser = await chromium.launch({
  channel: "chrome",
  headless: true,
  args: [
    "--no-sandbox",
    "--disable-background-timer-throttling",
    "--disable-renderer-backgrounding",
  ],
});
const errors = [];
const context = await browser.newContext({
  viewport: { width: 1440, height: 900 },
});
try {
  await context.addInitScript(() => {
    const buttons = Array.from({ length: 17 }, () => ({
      pressed: false,
      touched: false,
      value: 0,
    }));
    window.__testPad = {
      index: 0,
      id: "Simulated standard analog controller",
      connected: true,
      mapping: "standard",
      axes: [0, 0, 0, 0],
      buttons,
      timestamp: 0,
    };
    Object.defineProperty(navigator, "getGamepads", {
      value: () => [window.__testPad],
      configurable: true,
    });
  });
  const page = await context.newPage();
  page.on("pageerror", (e) => errors.push(e.message));
  await page.goto("http://127.0.0.1:5188/boomerangavoid/?studio=1");
  await page.getByRole("heading", { name: "Garden workshop" }).waitFor();
  await page.locator("#ads-template").selectOption("moss-court");
  await page
    .getByRole("button", { name: "Cast & motion", exact: true })
    .click();
  await page
    .locator("#ads-asset-status")
    .filter({ hasText: "12 clips" })
    .waitFor();
  await page.locator("#ads-character").selectOption("volt");
  await page
    .locator("#ads-asset-status")
    .filter({ hasText: "12 clips" })
    .waitFor();
  await page.locator("#ads-clip").selectOption("slash");
  await page.waitForTimeout(300);
  await page.screenshot({
    path: fileURLToPath(new URL("asset-studio.png", out)),
  });
  await page.locator('[data-tab="maps"]').click();
  await page.getByRole("button", { name: "Audit draft", exact: true }).click();
  await page.getByRole("status").filter({ hasText: "Audit passed" }).waitFor();
  await page.locator('[data-tab="crew"]').click();
  await page.locator('[data-remove-seat="3"]').click();
  await page.locator('[data-remove-seat="2"]').click();
  await page
    .locator('[data-seat="0"][data-field="control"]')
    .selectOption("pad0");
  await page
    .locator('[data-seat="1"][data-field="control"]')
    .selectOption("keyboard2");
  await page.locator('[data-tab="rules"]').click();
  await page.locator('[data-rule="wins"]').selectOption("5");
  for (const id of [
    "guard",
    "twin",
    "skipstone",
    "frost",
    "ember",
    "echo",
    "magnet",
  ])
    await page.locator(`[data-power="${id}"]`).uncheck();
  await page.locator("[data-stage-add]").click();
  await page.locator('[data-stage="1"]').selectOption("kiln-courtyard");
  await page.locator("#ads-biome").selectOption("dusk");
  await page.locator('[data-tab="exchange"]').click();
  const draft = JSON.parse(await page.locator("#ads-json").inputValue());
  assert.deepEqual(draft.match.enabledUpgrades, ["tailwind"]);
  assert.equal(draft.seats.length, 2);
  assert.equal(draft.biome, "dusk");
  assert.equal(draft.match.stageIds.length, 2);
  const invalid = structuredClone(draft);
  invalid.arena.spawns[0] = invalid.arena.spawns[1];
  await page.locator("#ads-json").fill(JSON.stringify(invalid));
  await page.getByRole("button", { name: "Import JSON", exact: true }).click();
  await page
    .getByRole("status")
    .filter({ hasText: "Spawns overlap" })
    .waitFor();
  await page.screenshot({ path: fileURLToPath(new URL("studio.png", out)) });
  await page
    .getByRole("button", { name: "Playtest this draft", exact: true })
    .click();
  await page.waitForFunction(
    () =>
      window.__BOOMERANGAVOID__?.state.phase === "playing" &&
      window.__BOOMERANGAVOID__.screen === "playing",
    null,
    { timeout: 60000 },
  );
  await page.waitForFunction(
    () => window.__BOOMERANGAVOID__.metrics.loadedCharacters >= 2,
    null,
    { timeout: 30000 },
  );
  const before = await page.evaluate(
    () => window.__BOOMERANGAVOID__.state.players[0],
  );
  const angle = 0.37,
    strength = 0.65;
  await page.evaluate(
    ({ angle, strength }) => {
      window.__testPad.axes = [
        Math.cos(angle) * strength,
        Math.sin(angle) * strength,
        0,
        0,
      ];
    },
    { angle, strength },
  );
  await page.waitForFunction(
    ({ x, y }) =>
      Math.hypot(
        window.__BOOMERANGAVOID__.state.players[0].x - x,
        window.__BOOMERANGAVOID__.state.players[0].y - y,
      ) > 0.7,
    { x: before.x, y: before.y },
    { timeout: 15000 },
  );
  const moved = await page.evaluate(
    () => window.__BOOMERANGAVOID__.state.players[0],
  );
  const measured = Math.atan2(moved.y - before.y, moved.x - before.x);
  assert.ok(
    Math.abs(measured - angle) < 0.025,
    `actual movement ${measured} vs ${angle}`,
  );
  await page.evaluate(() => {
    window.__testPad.axes = [0, 0, 0, 0];
  });
  await page.waitForTimeout(250);
  await page.evaluate(() => {
    window.__testPad.buttons[2] = { pressed: true, touched: true, value: 1 };
  });
  await page.waitForFunction(
    () =>
      window.__BOOMERANGAVOID__.state.players[0].slashCooldown >
      window.__BOOMERANGAVOID__.state.tick,
    null,
    { timeout: 10000 },
  );
  await page.evaluate(() => {
    window.__testPad.buttons[2] = { pressed: false, touched: false, value: 0 };
  });
  await page.screenshot({ path: fileURLToPath(new URL("gameplay.png", out)) });
  const debug = await page.evaluate(() => window.__BOOMERANGAVOID__);
  assert.equal(debug.state.config.wins, 5);
  assert.equal(debug.state.config.arenaDraft.ground, draft.arena.ground);
  assert.equal(debug.metrics.assetErrors.length, 0);
  const report = {
    case: "real-app simulated analog + ADS journey",
    timestamp: new Date().toISOString(),
    input: "navigator Gamepad API simulation; physical hardware unverified",
    angle,
    strength,
    measuredAngle: measured,
    delta: { x: moved.x - before.x, y: moved.y - before.y },
    loadedCharacters: debug.metrics.loadedCharacters,
    drawCalls: debug.metrics.drawCalls,
    assetErrors: debug.metrics.assetErrors,
    studio: {
      rules: draft.match,
      crew: draft.seats.length,
      biome: draft.biome,
      invalidImportRejected: true,
      liveSimulation: true,
    },
    errors,
  };
  await fs.writeFile(
    new URL("browser.json", out),
    JSON.stringify(report, null, 2),
  );
  console.log(JSON.stringify(report));
  assert.deepEqual(errors, []);
  await page.locator(".pause-button").click();
  await page.getByRole("button", { name: "Leave match", exact: true }).click();
  await page
    .getByRole("button", { name: "ADS · Garden workshop", exact: true })
    .click();
  await page.locator("#ads-template").selectOption("tideglass-steps");
  await page
    .getByRole("button", { name: "Playtest this draft", exact: true })
    .click();
  await page.waitForFunction(
    () => window.__BOOMERANGAVOID__?.state.phase === "playing",
    null,
    { timeout: 60000 },
  );
  await page.screenshot({ path: fileURLToPath(new URL("tideglass.png", out)) });
  await page.setViewportSize({ width: 390, height: 844 });
  await page.locator(".pause-button").click();
  await page.getByRole("button", { name: "Leave match", exact: true }).click();
  await page
    .getByRole("button", { name: "ADS · Garden workshop", exact: true })
    .click();
  await page.getByRole("heading", { name: "Garden workshop" }).waitFor();
  assert.ok(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth + 1,
    ),
    "mobile studio must not overflow horizontally",
  );
  await page.screenshot({
    path: fileURLToPath(new URL("studio-mobile.png", out)),
    fullPage: true,
  });
  await page.getByRole("button", { name: "Back to game", exact: true }).click();
  await page.locator('[data-action="practice"]').click();
  await page.waitForFunction(
    () => window.__BOOMERANGAVOID__?.state.phase === "playing",
    null,
    { timeout: 60000 },
  );
  const practice = await page.evaluate(() => window.__BOOMERANGAVOID__.state);
  assert.equal(practice.config.mapId, "moss-court");
  assert.equal(practice.config.stageIds, undefined);
  assert.equal(practice.config.arenaDraft, undefined);
  await page.evaluate(() => {
    window.__testPad.axes = [0.75, 0.3, 0, 0];
  });
  await page.waitForFunction(
    ({ x }) => window.__BOOMERANGAVOID__.state.players[0].x > x + 0.5,
    { x: practice.players[0].x },
    { timeout: 15000 },
  );
  await page.evaluate(() => {
    window.__testPad.axes = [0, 0, 0, 0];
  });
  await fs.writeFile(
    new URL("extended-browser.json", out),
    JSON.stringify(
      {
        timestamp: new Date().toISOString(),
        assetViewer: true,
        tideglassCapture: true,
        mobileStudioOverflow: false,
        practiceUsesController: true,
        practiceClearsStudioStages: true,
        errors,
      },
      null,
      2,
    ),
  );
} finally {
  await context.close();
  await browser.close();
}
