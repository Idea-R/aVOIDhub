import assert from "node:assert/strict";
import { writeFile } from "node:fs/promises";
import { chromium } from "playwright";

// Start the existing local Vite preview first. This verifier creates no room or server.
// Optional override: BAV_REVIEW_BASE=http://127.0.0.1:5188/boomerangavoid/
const base = new URL(process.env.BAV_REVIEW_BASE || "http://127.0.0.1:5188/boomerangavoid/");
assert.ok(["127.0.0.1", "localhost", "[::1]"].includes(base.hostname), "Use a loopback preview for this verifier");
const output = new URL("../../../docs/boomerangavoid/evidence/polish/review-regressions.json", import.meta.url);
const browser = await chromium.launch({ channel: "chrome", headless: true, args: ["--no-sandbox"] });
// A cached hanging promise is itself a regression: do not leave Chrome running forever.
const deadline = setTimeout(() => { void browser.close(); }, 45000);
const contexts = [];
const results = [];

try {
  // Keep image decoding pending while the user starts a playtest. A late report
  // continuation must not restore the workshop over the active game.
  const reportContext = await browser.newContext();
  contexts.push(reportContext);
  const page = await reportContext.newPage();
  const reportErrors = [];
  page.on("pageerror", error => reportErrors.push(error.message));
  const studioUrl = new URL(base);
  studioUrl.searchParams.set("studio", "1");
  await page.goto(studioUrl.href);
  await page.getByRole("heading", { name: "Garden workshop", exact: true }).waitFor();
  await page.evaluate(() => {
    const original = HTMLImageElement.prototype.decode;
    HTMLImageElement.prototype.decode = function () {
      return original.call(this).then(() => new Promise(resolve => {
        window.__finishReviewCapture = resolve;
      }));
    };
  });
  await page.getByRole("button", { name: "Report pile", exact: true }).click();
  await page.locator("#ads-note").fill("Async review fixture");
  await page.getByRole("button", { name: "Capture note + map", exact: true }).click();
  await page.waitForFunction(() => typeof window.__finishReviewCapture === "function");
  await page.getByRole("button", { name: "Playtest this draft", exact: true }).click();
  await page.waitForFunction(() => window.__BOOMERANGAVOID__?.screen === "playing");
  await page.evaluate(() => window.__finishReviewCapture());
  await page.waitForTimeout(1200);
  const lateReport = {
    case: "late-report-after-playtest",
    screen: await page.evaluate(() => window.__BOOMERANGAVOID__.screen),
    studioOverwritesPlay: await page.getByRole("heading", { name: "Garden workshop", exact: true }).count(),
    observationMs: 1200,
    pageErrors: reportErrors,
  };
  assert.equal(lateReport.screen, "playing");
  assert.equal(lateReport.studioOverwritesPlay, 0);
  assert.deepEqual(reportErrors, []);
  results.push(lateReport);
  await reportContext.close();

  // Import only the character library on a blank same-origin page, avoiding the
  // attract scene's cache. Keep Pip's first request hanging, then allow its retry.
  const loaderContext = await browser.newContext();
  contexts.push(loaderContext);
  const loaderPage = await loaderContext.newPage();
  const loaderErrors = [];
  loaderPage.on("pageerror", error => loaderErrors.push(error.message));
  let pipRequests = 0;
  let kilnRequests = 0;
  let heldRoute;
  await loaderPage.route("**/review-recovery-fixture", route => route.fulfill({
    contentType: "text/html",
    body: "<html><body>Isolated character recovery review</body></html>",
  }));
  await loaderPage.route("**/models/gamefeel/pip.glb", route => {
    pipRequests++;
    if (pipRequests === 1) { heldRoute = route; return; }
    return route.continue();
  });
  await loaderPage.route("**/models/gamefeel/kiln.glb", route => {
    kilnRequests++;
    return kilnRequests === 1
      ? route.fulfill({ status: 503, body: "Transient recovery fixture" })
      : route.continue();
  });
  await loaderPage.goto(new URL("review-recovery-fixture", base).href);
  await loaderPage.evaluate(async moduleUrl => {
    window.__reviewAssets = await import(moduleUrl);
    window.__reviewController = new AbortController();
    window.__reviewFirstLoad = window.__reviewAssets.preloadCharacters(["pip"], window.__reviewController.signal)
      .then(() => "loaded", error => error.name);
  }, new URL("src/character-library.ts", base).href);
  for (let attempt = 0; pipRequests === 0 && attempt < 100; attempt++) await loaderPage.waitForTimeout(20);
  assert.equal(pipRequests, 1, "the first GLB request must be stalled before cancellation");
  const aborted = await loaderPage.evaluate(async () => {
    window.__reviewController.abort();
    return await window.__reviewFirstLoad;
  });
  const recovered = await loaderPage.evaluate(async () => {
    await window.__reviewAssets.preloadCharacters(["pip"], new AbortController().signal);
    return window.__reviewAssets.isCharacterReady("pip");
  });
  assert.equal(aborted, "AbortError");
  assert.equal(pipRequests, 2, "retry must issue a fresh request after cancellation");
  assert.equal(recovered, true);
  results.push({ case: "stalled-load-abort-then-fresh-retry", requests: pipRequests, aborted, recovered });

  const rejected = await loaderPage.evaluate(async () => {
    try {
      await window.__reviewAssets.preloadCharacters(["kiln"], new AbortController().signal);
      return "unexpected success";
    } catch (error) { return error.message; }
  });
  const failedRecovered = await loaderPage.evaluate(async () => {
    await window.__reviewAssets.preloadCharacters(["kiln"], new AbortController().signal);
    return window.__reviewAssets.isCharacterReady("kiln");
  });
  assert.match(rejected, /503/);
  assert.equal(kilnRequests, 2, "retry must issue a fresh request after HTTP failure");
  assert.equal(failedRecovered, true);
  assert.deepEqual(loaderErrors, []);
  results.push({ case: "http-503-then-fresh-retry", requests: kilnRequests, rejected, recovered: failedRecovered, pageErrors: loaderErrors });
  await heldRoute?.abort().catch(() => {});
  await loaderContext.close();

  const report = {
    checkedAt: new Date().toISOString(),
    command: "node games/boomerang-avoid/verify/recovery-polish.mjs",
    base: base.href,
    browser: { channel: "chrome", version: browser.version(), headless: true },
    passed: true,
    results,
    browserErrors: [...reportErrors, ...loaderErrors],
    sourceEditsDuringReview: false,
    scope: "Isolated loopback browser regressions; no room server, account, paid service, or remote write.",
    limitations: ["No physical controller test", "No internet latency or named-device performance claim"],
  };
  await writeFile(output, JSON.stringify(report, null, 2) + "\n");
  console.log(JSON.stringify(report));
} finally {
  clearTimeout(deadline);
  await Promise.allSettled(contexts.map(context => context.close()));
  await browser.close();
}
