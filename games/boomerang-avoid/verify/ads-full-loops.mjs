/** Actual ADS UI and realtime local matches; no simulation state writes or accelerated clocks. */
import { chromium } from 'playwright';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import { fileURLToPath } from 'node:url';

const out = new URL('../../../docs/boomerangavoid/evidence/completion/', import.meta.url);
const endpoint = process.env.BAV_BROWSER_URL || 'http://127.0.0.1:5188/boomerangavoid/';
const headless = JSON.parse(await fs.readFile(new URL('arena-full-match-audit.json', out), 'utf8'));
const specifications = [{ mode: 'ffa', seed: 41827 }, { mode: 'relay', seed: 1337 }];
const contexts = new Set();
const results = [];
const errors = [];
let browser;
let failure = null;

async function sample(page) {
  return page.evaluate(() => {
    const live = window.__BOOMERANGAVOID__;
    if (!live) return null;
    const s = live.state;
    return {
      screen: live.screen, playing: live.playing, paused: live.paused, online: live.online,
      arenaLabel:document.querySelector('#arena-label')?.textContent,
      tick: s.tick, phase: s.phase, round: s.round,
      arena: s.config.stageIds?.[(s.round - 1) % s.config.stageIds.length] || s.config.mapId,
      config: s.config,
      seats: s.players.map(({ id, name, character, color, team, bot }) => ({ id, name, character, color, team, bot })),
      scores: s.players.map(({ id, score, kills }) => ({ id, score, kills })),
      winnerIds: s.winnerIds, matchWinnerIds: s.matchWinnerIds, relayScores: s.relay.scores,
      controls: live.controls,
      finiteAndBounded: (() => {
        const stage = s.config.stageIds?.[(s.round - 1) % s.config.stageIds.length] || s.config.mapId;
        // These exact fixtures only rotate between the canonical 22x17 arenas and their same-size draft.
        const a = stage === s.config.mapId ? s.config.arenaDraft : { width: 22, height: 17 };
        return [...s.players, ...s.weapons, ...s.pickups, ...s.effects, s.relay].every(entity =>
          Object.values(entity).every(value => typeof value !== 'number' || Number.isFinite(value)) &&
          Math.abs(entity.x) <= a.width / 2 + 1e-5 && Math.abs(entity.y) <= a.height / 2 + 1e-5);
      })(),
    };
  });
}

async function exercise(page, spec, expected, draft, result) {
  const url = new URL(endpoint);
  url.searchParams.set('studio', '1');
  await page.goto(url.href, { waitUntil: 'domcontentloaded' });
  await page.getByRole('heading', { name: 'Garden workshop', exact: true }).waitFor();
  await page.locator('[data-tab="exchange"]').click();
  await page.locator('#ads-json').fill(JSON.stringify(draft));
  await page.locator('[data-do="import"]').click();
  assert.match(await page.locator('.ads-status').innerText(), /Imported and validated/);
  await page.locator('[data-do="audit"]').click();
  assert.match(await page.locator('.ads-status').innerText(), /Audit passed/);
  const downloadReady = page.waitForEvent('download');
  await page.locator('[data-do="export"]').click();
  const download = await downloadReady;
  const downloadedPath = await download.path();
  assert.ok(downloadedPath, 'Browser must produce a real downloadable JSON file');
  const exported = JSON.parse(await fs.readFile(downloadedPath, 'utf8'));
  assert.deepEqual(exported, draft, 'Actual ADS download must equal the exact audited fixture');
  await page.locator('[data-tab="exchange"]').click();
  await page.locator('#ads-json').fill(JSON.stringify(exported));
  await page.locator('[data-do="import"]').click();
  assert.match(await page.locator('.ads-status').innerText(), /Imported and validated/);
  result.importAuditExportReimportExact = true;
  await page.locator('[data-do="play"]').click();
  await page.waitForFunction(() => window.__BOOMERANGAVOID__?.screen === 'playing', null, { polling: 100 });
  const initial = await sample(page);
  assert.deepEqual(initial.config, { ...draft.match, arenaDraft: draft.arena });
  assert.deepEqual(initial.seats, draft.seats.map(({ control: _control, ...seat }) => seat));
  assert.deepEqual(initial.controls, draft.seats.map(({ id, control }) => ({ id, control })));
  assert.equal(initial.online, false);
  result.actualSimulationHandoffExact = true;

  let previous = '';
  const roundResults = new Map();
  let terminal;
  while (true) {
    const current = await sample(page);
    assert.ok(current?.playing && current.screen === 'playing' && !current.paused && !current.online, 'Authored local play must stay active');
    assert.equal(current.finiteAndBounded, true, `Invalid sampled entity state at tick ${current.tick}`);
    const arenaName=expected.original.roundResults.find(round=>round.round===current.round)?.name;
    assert.ok(arenaName,'The audited round must have a declared arena name');
    // The production HUD intentionally batches at90ms; authority can enter a new
    // countdown before the next HUD draw. Check bounded UI convergence, not same-frame equality.
    if(!current.arenaLabel.startsWith(arenaName))await page.waitForFunction(name=>document.querySelector('#arena-label')?.textContent?.startsWith(name),arenaName,{timeout:1500});
    const key = `${current.round}/${current.phase}/${current.arena}`;
    if (key !== previous) {
      result.transitions.push({ round: current.round, phase: current.phase, arena: current.arena, observedTick: current.tick });
      previous = key;
    }
    if (current.phase === 'roundResults' || current.phase === 'matchResults') {
      roundResults.set(current.round, { round: current.round, arena: current.arena, winners: current.winnerIds, scores: current.scores.map(({ id, score }) => ({ id, score })) });
    }
    result.lastObservation = { tick: current.tick, round: current.round, phase: current.phase, arena: current.arena, scores: current.scores, relayScores: current.relayScores };
    if (current.phase === 'matchResults') { terminal = current; break; }
    await page.waitForTimeout(100);
  }
  assert.deepEqual([...roundResults.values()], expected.original.roundResults.map(({ round, arena, winners, scores }) => ({ round, arena, winners, scores })), 'Observed natural round results must match the declared headless fields');
  assert.equal(terminal.tick, expected.original.ticks);
  assert.equal(terminal.round, expected.original.rounds);
  assert.deepEqual(terminal.scores, expected.original.scores);
  assert.deepEqual(terminal.matchWinnerIds, expected.original.winners);
  assert.deepEqual(terminal.relayScores, expected.original.relayScores);
  if(spec.mode==='relay'){const text=await page.locator('.result-crew').innerText();assert.match(text,/3 deliveries/);assert.doesNotMatch(text,/\d wins/);result.correctRelayResultUnits=true;}
  if (spec.mode === 'ffa') {
    assert.deepEqual([...new Set(result.transitions.map(t => t.arena))], draft.match.stageIds);
    assert.ok(result.transitions.some(t => t.round > draft.match.stageIds.length), 'FFA must return to the authored stage after the first rotation');
  } else {
    assert.equal(terminal.round, 1);
    assert.equal(Math.max(...terminal.relayScores), 3, 'Relay must finish through its natural three-delivery objective');
    assert.deepEqual([...new Set(result.transitions.map(t => t.arena))], [draft.arena.id]);
  }
  await page.locator('.results-panel').waitFor();
  assert.equal(await page.locator('.results-panel [data-action="rematch"]').isVisible(), true);
  const screenshot = `arena-full-${spec.mode}-results.png`;
  await page.screenshot({ path: fileURLToPath(new URL(screenshot, out)) });
  result.resultsScreenshot = screenshot;
  result.observedRoundResults = [...roundResults.values()];
  result.terminal = { tick: terminal.tick, round: terminal.round, scores: terminal.scores, winners: terminal.matchWinnerIds, relayScores: terminal.relayScores };
  result.fullNaturalResultsMatchHeadless = true;
  await page.locator('.results-panel [data-action="rematch"]').click();
  await page.waitForFunction(() => {
    const live = window.__BOOMERANGAVOID__;
    return live?.screen === 'playing' && live.state.round === 1 && live.state.phase === 'playing';
  }, null, { polling: 100 });
  const rematch = await sample(page);
  assert.equal(rematch.arena, draft.match.stageIds[0]);
  assert.deepEqual(rematch.config, { ...draft.match, arenaDraft: draft.arena });
  assert.deepEqual(rematch.scores, draft.seats.map(({ id }) => ({ id, score: 0, kills: 0 })));
  assert.deepEqual(rematch.relayScores, [0, 0]);
  result.rematchUiReturnsRoundOnePlaying = true;
  result.rematchObservedTick = rematch.tick;
}

try {
  await fs.mkdir(out, { recursive: true });
  browser = await chromium.launch({ channel: 'chrome', headless: true, args: ['--no-sandbox'] });
  for (const spec of specifications) {
    const expected = headless.results.find(r => r.mode === spec.mode && r.seed === spec.seed);
    assert.ok(expected, 'Exact expected headless case must exist');
    const draft = JSON.parse(await fs.readFile(new URL(expected.draft, out), 'utf8'));
    assert.equal(draft.match.mode, spec.mode);
    assert.equal(draft.match.seed, spec.seed);
    const result = { ...spec, draft: expected.draft, status: 'running', wallClockLimitMs: 180000, transitions: [] };
    results.push(result);
    const context = await browser.newContext({ viewport: { width: 1280, height: 800 }, acceptDownloads: true });
    contexts.add(context);
    const page = await context.newPage();
    page.setDefaultTimeout(15000);
    page.setDefaultNavigationTimeout(30000);
    page.on('pageerror', error => errors.push({ mode: spec.mode, message: error.message }));
    const started = Date.now();
    let timeout;
    try {
      await Promise.race([
        exercise(page, spec, expected, draft, result),
        new Promise((_, reject) => { timeout = setTimeout(() => reject(new Error(`${spec.mode} exceeded the 180-second case wall-clock bound`)), 180000); }),
      ]);
      assert.deepEqual(errors.filter(e => e.mode === spec.mode), [], 'No browser page errors');
      result.status = 'passed';
    } catch (error) {
      result.status = 'failed';
      result.error = error instanceof Error ? error.message : String(error);
      await page.screenshot({ path: fileURLToPath(new URL(`arena-full-${spec.mode}-failure.png`, out)), timeout: 5000 }).catch(() => {});
      throw error;
    } finally {
      clearTimeout(timeout);
      result.wallClockMs = Date.now() - started;
      await context.close();
      contexts.delete(context);
    }
    // Each case's context is closed before the next full-match renderer is created.
  }
} catch (error) {
  failure = error;
} finally {
  await Promise.allSettled([...contexts].map(context => context.close()));
  if (browser) await browser.close();
  const report = {
    timestamp: new Date().toISOString(), browser: 'Chrome headless', viewport: { width: 1280, height: 800 },
    passed: !failure && results.length === specifications.length && results.every(r => r.status === 'passed'),
    scope: 'Actual ADS UI import/audit/download/reimport/playtest, realtime complete FFA and natural-delivery Relay results, and UI rematch to round-one playing. Read-only development-hook observations; no simulation mutation, timing acceleration or seed override. Physical devices and other browsers untested.',
    results, errors, ...(failure ? { failure: failure instanceof Error ? failure.message : String(failure) } : {}),
  };
  await fs.writeFile(new URL('arena-full-browser.json', out), JSON.stringify(report, null, 2) + '\n');
  console.log(JSON.stringify({ passed: report.passed, results: results.map(({ mode, status, wallClockMs }) => ({ mode, status, wallClockMs })), errors }));
}
if (failure) throw failure;
