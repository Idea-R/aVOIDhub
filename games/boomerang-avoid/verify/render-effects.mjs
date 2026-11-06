/** Requires the existing Vite dev server; this harness starts no service or authority fixture.
 * BAV_CLIENT_URL=http://127.0.0.1:5177/boomerangavoid/ node verify/render-effects.mjs
 * BAV_BROWSER_CHANNEL defaults to chrome; set to chromium for Playwright's bundled browser.
 */
import { chromium } from "playwright";
import assert from "node:assert/strict";
import fs from "node:fs/promises";
import { execFileSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import ts from "typescript";

const base = new URL(
  process.env.BAV_CLIENT_URL || "http://127.0.0.1:5177/boomerangavoid/",
);
if (!base.pathname.endsWith("/")) base.pathname += "/";
const fixtureUrl = new URL("__verify-render-effects__.html", base);
const moduleUrl = new URL("src/render.ts", base);
const channel = process.env.BAV_BROWSER_CHANNEL || "chrome";
const browser = await chromium.launch({
  headless: true,
  ...(channel === "chromium" ? {} : { channel }),
  args: [
    "--no-sandbox",
    "--disable-background-timer-throttling",
    "--disable-renderer-backgrounding",
    "--disable-backgrounding-occluded-windows",
  ],
});
const errors = [];
try {
  const context = await browser.newContext({
    viewport: { width: 640, height: 480 },
    deviceScaleFactor: 1,
  });
  const page = await context.newPage();
  page.on("pageerror", (error) => errors.push(error.message));
  await page.route(fixtureUrl.href, (route) =>
    route.fulfill({
      contentType: "text/html",
      body: '<!doctype html><html><head><meta name="viewport" content="width=device-width,initial-scale=1"/><title>Isolated renderer ownership check</title></head><body style="margin:0"><canvas></canvas></body></html>',
    }),
  );
  await page.goto(fixtureUrl.href);
  const runFixture = async ({ url, baseline }) => {
    const { GardenRenderer } = await import(url);
    const check = (condition, message) => {
      if (!condition) throw new Error(message);
    };
    const renderer = new GardenRenderer(document.querySelector("canvas"), {
      music: 0,
      sfx: 0,
      reducedMotion: false,
      character: "pip",
      touch: false,
      quality: "low",
      bindings: [],
      gamepadButtons: { dash: 0, slash: 2, throw: 1 },
    });
    const player = (id, character, x) => ({
      id,
      name: id,
      character,
      color: 0x91ce68,
      team: 0,
      bot: null,
      x,
      y: 0,
      vx: 0,
      vy: 0,
      fx: 1,
      fy: 0,
      alive: true,
      score: 0,
      kills: 0,
      dashUntil: 0,
      dashCooldown: 0,
      slashUntil: 0,
      slashStart: 0,
      slashCooldown: 0,
      throwAt: 0,
      stunUntil: 0,
      shieldGraceUntil: 0,
      respawnAt: 0,
      protectedUntil: 0,
      shield: false,
      upgrades: [],
    });
    const state = {
      version: "isolated-render-test",
      tick: 200,
      round: 1,
      phase: "playing",
      phaseUntil: 0,
      config: {
        mode: "ffa",
        wins: 3,
        mapId: "moss-court",
        seed: 1,
        friendlyFire: false,
        upgrades: true,
      },
      rng: 1,
      nextId: 10,
      players: [player("p1", "pip", -4), player("p2", "kiln", 4)],
      weapons: [],
      pickups: [{ id: "pickup-a", upgrade: "guard", x: 2, y: 2, spawnTick: 0 }],
      effects: [
        {
          id: "fx-a",
          kind: "frost",
          ownerId: "p1",
          x: 0,
          y: 0,
          start: 0,
          end: 1000,
          radius: 0.7,
          triggered: false,
        },
      ],
      events: [],
      roundStart: 0,
      winnerIds: [],
      matchWinnerIds: [],
      relay: {
        carrierId: null,
        x: 0,
        y: 0,
        target: 0,
        progress: 0,
        lockUntil: 0,
        previousCarrier: null,
        previousLockUntil: 0,
        scores: [0, 0],
        endTick: 18000,
      },
    };
    let shieldMaterialsDisposed = 0,
      closingMaterialsDisposed = 0,
      foundationGeometriesDisposed = 0;
    const gapMaterials = [];
    const sphere = renderer.sphere.bind(renderer);
    renderer.sphere = (...args) => {
      const mesh = sphere(...args);
      if (args[0] === 0.75)
        mesh.material.addEventListener(
          "dispose",
          () => shieldMaterialsDisposed++,
        );
      return mesh;
    };
    const box = renderer.box.bind(renderer);
    renderer.box = (...args) => {
      const mesh = box(...args);
      if (args[1] === 1.3 && args[5] === -0.78)
        mesh.geometry.addEventListener(
          "dispose",
          () => foundationGeometriesDisposed++,
        );
      if (args[7] === renderer.closing)
        mesh.material.addEventListener(
          "dispose",
          () => closingMaterialsDisposed++,
        );
      if (args[7]?.userData.hazard?.kind === "gap") {
        const entry = { material: mesh.material, mesh, disposed: 0 };
        mesh.material.addEventListener("dispose", () => entry.disposed++);
        gapMaterials.push(entry);
      }
      return mesh;
    };
    const draw = () => {
      const before = JSON.stringify(state);
      renderer.draw(state, 1 / 60, () => {});
      check(
        JSON.stringify(state) === before,
        "Rendering must not mutate simulation state",
      );
    };
    try {
      draw();
      if (baseline) {
        const before = {
          meshes: renderer.collectibles.children.length,
          geometries: renderer.renderer.info.memory.geometries,
          drawCalls: renderer.metrics.drawCalls,
        };
        for (let i = 0; i < 120; i++) draw();
        const after = {
          meshes: renderer.collectibles.children.length,
          geometries: renderer.renderer.info.memory.geometries,
          drawCalls: renderer.metrics.drawCalls,
        };
        check(
          after.meshes - before.meshes === 120 &&
            after.geometries - before.geometries === 120 &&
            after.drawCalls - before.drawCalls === 120,
          "Baseline must reproduce one extra ring/geometry/draw call per stable-effect frame",
        );
        return {
          stableFrames: 121,
          before,
          after,
          growth: {
            meshes: after.meshes - before.meshes,
            geometries: after.geometries - before.geometries,
            drawCalls: after.drawCalls - before.drawCalls,
          },
          foundationGeometriesDisposed,
          closingMaterialsDisposed,
          shieldMaterialsDisposed,
          simulationUntouched: true,
        };
      }
      const effect = renderer.effectVisuals.get("fx-a");
      check(effect, "Effect visual must exist");
      const initialGeometry = effect.geometry,
        material = effect.material;
      let initialGeometryDisposed = 0,
        materialDisposed = 0;
      initialGeometry.addEventListener(
        "dispose",
        () => initialGeometryDisposed++,
      );
      material.addEventListener("dispose", () => materialDisposed++);
      const pickup = renderer.collectibles.children.find(
        (child) => child.userData.pickup,
      );
      let pickupDisposed = 0;
      pickup.geometry.addEventListener("dispose", () => pickupDisposed++);
      const stableMemory = renderer.renderer.info.memory.geometries,
        stableCalls = renderer.metrics.drawCalls;
      for (let i = 0; i < 120; i++) draw();
      check(
        renderer.effectVisuals.size === 1 &&
          renderer.effectGroup.children.length === 1,
        "Stable effect IDs must own one visual, not one per frame",
      );
      check(
        renderer.effectVisuals.get("fx-a") === effect &&
          effect.geometry === initialGeometry &&
          effect.material === material,
        "Stable effects must reuse their mesh, geometry and material",
      );
      check(
        initialGeometryDisposed === 0 && materialDisposed === 0,
        "Active resources must remain live",
      );
      check(
        renderer.renderer.info.memory.geometries === stableMemory &&
          renderer.metrics.drawCalls === stableCalls,
        "Stable effects must not grow GPU geometry count or draw calls",
      );
      state.effects[0].radius = 1.1;
      state.effects[0].x = 1;
      state.effects[0].kind = "ember";
      draw();
      check(
        initialGeometryDisposed === 1,
        "Replacing radius geometry must dispose the previous geometry exactly once",
      );
      check(
        effect.material === material && materialDisposed === 0,
        "Radius/kind changes must preserve the owned material",
      );
      check(
        effect.geometry.parameters.radius === 1.1 &&
          effect.position.x === 1 &&
          effect.material.color.getHex() === 0xff9361,
        "Visual radius, position and color must track the current effect",
      );
      let replacementGeometryDisposed = 0;
      effect.geometry.addEventListener(
        "dispose",
        () => replacementGeometryDisposed++,
      );
      state.effects.push({
        id: "fx-b",
        kind: "echo",
        ownerId: "p2",
        x: 3,
        y: 0,
        start: 0,
        end: 1000,
        radius: 0.38,
        triggered: false,
      });
      draw();
      const second = renderer.effectVisuals.get("fx-b");
      let secondGeometryDisposed = 0,
        secondMaterialDisposed = 0;
      second.geometry.addEventListener(
        "dispose",
        () => secondGeometryDisposed++,
      );
      second.material.addEventListener(
        "dispose",
        () => secondMaterialDisposed++,
      );
      check(
        renderer.effectGroup.children.length === 2,
        "Two effects must own two visuals",
      );
      check(
        renderer.collectibles.children.includes(pickup) && pickupDisposed === 0,
        "Effect churn must not rebuild live pickups",
      );
      state.effects = state.effects.filter((effect) => effect.id !== "fx-a");
      draw();
      draw();
      check(
        replacementGeometryDisposed === 1 && materialDisposed === 1,
        "Removed effect geometry and material must each dispose exactly once",
      );
      check(
        !renderer.effectVisuals.has("fx-a") &&
          renderer.effectGroup.children.length === 1,
        "Removed effect must detach from the scene and cache",
      );
      check(
        renderer.collectibles.children.includes(pickup) && pickupDisposed === 0,
        "Effect removal must preserve pickup ownership",
      );
      state.config.mapId = "tideglass-steps";
      state.effects = [];
      state.pickups = [];
      draw();
      check(
        secondGeometryDisposed === 1 && secondMaterialDisposed === 1,
        "Arena change must dispose remaining effect resources once",
      );
      check(
        renderer.effectVisuals.size === 0 &&
          renderer.effectGroup.children.length === 0,
        "Arena teardown must leave no effect visuals",
      );
      check(
        pickupDisposed === 1,
        "Arena teardown must dispose pickup geometry once",
      );
      check(
        gapMaterials.length === 2 &&
          gapMaterials.every(
            (entry) =>
              entry.mesh.material === entry.material && entry.disposed === 0,
          ),
        "Gap colors must reuse their owned floor material",
      );
      state.config.mapId = "kiln-courtyard";
      draw();
      check(
        gapMaterials.every((entry) => entry.disposed === 1),
        "Gap materials must dispose exactly once at map teardown",
      );
      check(
        foundationGeometriesDisposed === 3,
        "Each arena foundation must allocate one geometry and release it during static merging",
      );
      check(
        closingMaterialsDisposed === 12,
        "Superseded closing-strip materials must dispose at construction for every arena",
      );
      check(
        shieldMaterialsDisposed === 2,
        "Superseded actor shield materials must dispose at actor construction",
      );
      return {
        stableFrames: 121,
        stableEffectVisuals: 1,
        stableDrawCalls: stableCalls,
        stableGpuGeometries: stableMemory,
        geometryReplacementDisposals: initialGeometryDisposed,
        removedGeometryDisposals: replacementGeometryDisposed,
        removedMaterialDisposals: materialDisposed,
        pickupDisposals: pickupDisposed,
        arenaEffectDisposals: {
          geometry: secondGeometryDisposed,
          material: secondMaterialDisposed,
        },
        foundationGeometriesDisposed,
        closingMaterialsDisposed,
        shieldMaterialsDisposed,
        gapMaterialsDisposed: gapMaterials.map((entry) => entry.disposed),
        simulationUntouched: true,
      };
    } finally {
      renderer.renderer.dispose();
      renderer.renderer.forceContextLoss();
    }
  };
  const checks = await page.evaluate(runFixture, {
    url: moduleUrl.href,
    baseline: false,
  });
  let baseline = null;
  if (process.env.BAV_RENDER_BASELINE_REF) {
    const ref = process.env.BAV_RENDER_BASELINE_REF;
    assert.match(
      ref,
      /^[a-f0-9]{7,40}$/i,
      "Baseline must be an explicit commit hash",
    );
    const source = execFileSync(
      "git",
      ["show", `${ref}:games/boomerang-avoid/src/render.ts`],
      {
        cwd: fileURLToPath(new URL("../../../", import.meta.url)),
        encoding: "utf8",
        maxBuffer: 200000,
      },
    );
    const active = await (await page.request.get(moduleUrl.href)).text();
    const imports = [...active.matchAll(/from\s*["']([^"']+)["']/g)].map(
      (match) => match[1],
    );
    const mapping = {
      three: imports.find((spec) => /\/three\.js(?:\?|$)/.test(spec)),
      "three/addons/utils/BufferGeometryUtils.js": imports.find((spec) =>
        spec.includes("BufferGeometryUtils"),
      ),
      "@avoid/boomerangavoid-sim": imports.find((spec) =>
        spec.includes("boomerangavoid-sim"),
      ),
    };
    assert.ok(
      Object.values(mapping).every(Boolean),
      "Current Vite module must provide baseline dependency URLs",
    );
    const js = ts
      .transpileModule(source, {
        compilerOptions: {
          target: ts.ScriptTarget.ES2022,
          module: ts.ModuleKind.ESNext,
        },
      })
      .outputText.replace(
        /(from\s*)["']([^"']+)["']/g,
        (original, prefix, spec) =>
          mapping[spec] ? prefix + JSON.stringify(mapping[spec]) : original,
      );
    const baselineUrl = new URL("__verify-baseline-renderer__.mjs", base);
    await page.route(baselineUrl.href, (route) =>
      route.fulfill({ contentType: "text/javascript", body: js }),
    );
    await page.reload();
    baseline = {
      ref,
      checks: await page.evaluate(runFixture, {
        url: baselineUrl.href,
        baseline: true,
      }),
    };
  }
  assert.equal(errors.length, 0, JSON.stringify(errors));
  const report = {
    timestamp: new Date().toISOString(),
    checks,
    baseline,
    errors,
    scope:
      "Isolated renderer lifecycle regression in desktop Chrome at640x480,DPR1,manual low quality. No live game, authority, networking, physical-device or performance claim.",
  };
  await fs.mkdir(new URL("./raw/", import.meta.url), { recursive: true });
  await fs.writeFile(
    new URL("./raw/render-effects.json", import.meta.url),
    JSON.stringify(report, null, 2),
  );
  console.log(JSON.stringify(report, null, 2));
} finally {
  await browser.close();
}
