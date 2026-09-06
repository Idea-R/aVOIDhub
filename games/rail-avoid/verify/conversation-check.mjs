/** Functional/visual fixtures, not campaign difficulty evidence. Uses an isolated browser/save. */
import { chromium } from 'playwright';
import fs from 'node:fs';

const base = process.argv.find(a => a.startsWith('--url='))?.slice(6) ?? 'http://localhost:5178/RAILaVOID/';
const out = process.argv.find(a => a.startsWith('--out='))?.slice(6) ?? 'verify/screenshots/conversation';
fs.mkdirSync(out, { recursive: true });
const failures = [], errors = [], results = [];
const check = (ok, message) => { if (!ok) failures.push(message); };
const browser = await chromium.launch({ args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--mute-audio'] });
const page = await browser.newPage();
page.on('pageerror', e => errors.push(e.message));
await page.addInitScript(() => window.__RAIL_SKIP_OPENING = true);
await page.addInitScript(() => {
  window.__conversationInputs = [];
  for (const type of ['keydown', 'keyup', 'click']) window.addEventListener(type, e => {
    window.__conversationInputs.push({ type, key: e.key, prevented: e.defaultPrevented, target: e.target?.textContent?.slice(0, 90), phase: window.__RAIL?.state?.phase, event: JSON.stringify(window.__RAIL?.state?.activeEvent) });
    if (window.__conversationInputs.length > 40) window.__conversationInputs.shift();
  });
});

async function fresh({ width = 1280, height = 720, scale = .75, crew = true, kit = false } = {}) {
  await page.setViewportSize({ width, height });
  await page.evaluate(({ scale, crew, kit }) => {
    const R = window.__RAIL;
    R.ctx.settings.setMeta({ introSeen: true });
    R.ctx.settings.set({ reducedMotion: false, showTutorial: false, uiScale: scale, largeText: scale === 1.1 });
    R.newRun(12345); R.resume();
    if (crew) R.state.train.crew.push(
      { id: 'qa-mechanic', name: 'Vey', specialty: 'mechanic', hp: 100, carIndex: -1 },
      { id: 'qa-medic', name: 'Ines', specialty: 'medic', hp: 100, carIndex: -1 },
    );
    if (kit) R.state.train.relics.push('tinkers_kit');
    R.sim.debug.triggerEvent('node_crossroads');
    const e = R.state.activeEvent;
    e.locationId = R.state.settlements.find(s => s.type === 'crossroads')?.id;
    e.arrival = { passengers: 3, crewName: 'Vey' }; // receipt fixture only
    R.ctx.bus.emit('event:show', { defId: e.defId });
  }, { scale, crew, kit });
  await page.locator('.rv-conversation[data-dialogue-step="arrival"]').waitFor();
  await page.waitForTimeout(650);
}
async function snapshot(label) {
  const data = await page.locator('.rv-conversation').evaluate(n => {
    const r = n.getBoundingClientRect();
    const list = [...n.querySelectorAll('button')].map(b => {
      const box = b.getBoundingClientRect();
      return { x: box.x, y: box.y, width: box.width, height: box.height, disabled: b.disabled, text: b.textContent, overflow: b.scrollHeight - b.clientHeight };
    });
    return { x: r.x, y: r.y, width: r.width, height: r.height, innerWidth, innerHeight, list, bodyOverflow: n.scrollHeight - n.clientHeight, transform: getComputedStyle(n).transform };
  });
  check(data.transform === 'none', `${label}: card moves by transform`);
  check(data.x >= 0 && data.y >= 0 && data.x + data.width <= data.innerWidth + 1 && data.y + data.height <= data.innerHeight + 1, `${label}: card outside screen`);
  check(data.bodyOverflow <= 1, `${label}: whole card overflows ${data.bodyOverflow}`);
  for (const [i, b] of data.list.entries()) {
    check(b.width >= 44 && b.height >= 44, `${label}: choice ${i} too small`);
    check(b.x >= 0 && b.y >= 0 && b.x + b.width <= data.innerWidth + 1 && b.y + b.height <= data.innerHeight + 1, `${label}: choice ${i} outside screen`);
    check(b.overflow <= 1, `${label}: choice ${i} requires internal scrolling (${b.overflow})`);
  }
  check(await page.locator('.rv-conversation button').evaluateAll(ns => ns.every(n => {
    const r = n.getBoundingClientRect(); return n.contains(document.elementFromPoint(r.x + r.width / 2, r.y + 10));
  })), `${label}: another component covers a choice`);
  await page.screenshot({ path: `${out}/${label}.png` });
  results.push({ label, ...data });
  return data;
}
async function compareAnchor(before, after, label) {
  for (const key of ['x', 'y', 'width', 'height']) check(Math.abs(before[key] - after[key]) < 1, `${label}: card ${key} shifted`);
  check(Math.abs(before.list[0].y - after.list[0].y) < 1, `${label}: choices shifted`);
}
try {
  await page.goto(base);
  await page.waitForFunction(() => window.__RAIL?.ready && window.__RAIL.view);
  for (const [width, height, scale] of [[1280,720,.75],[800,600,.75],[390,844,.75],[360,740,.75],[844,450,.75],[1280,720,1.1],[800,600,1.1],[390,844,1.1]]) {
    const key = `${width}-${height}-${scale}`;
    await fresh({ width, height, scale });
    const arrival = await snapshot(`arrival-${key}`);
    check(await page.locator('.rv-conversation .rv-option').nth(2).isDisabled(), `${key}: absent relic is enabled`);
    check((await page.locator('.rv-conversation-lines').textContent()).includes('Hold the signal.'), `${key}: dialogue truncated by typewriter`);
    await page.keyboard.press('2');
    await page.locator('.rv-conversation[data-dialogue-step="briefing"]').waitFor();
    const briefing = await snapshot(`briefing-${key}`);
    await compareAnchor(arrival, briefing, key);
    check((await page.locator('.rv-conversation-context').textContent()).includes('Vey'), `${key}: mechanic not named`);
    const before = await page.evaluate(() => window.__RAIL.state.train.resources.scrap);
    await page.keyboard.press('2');
    await page.locator('.rv-conversation[data-dialogue-step="receipt"]').waitFor();
    const receipt = await snapshot(`receipt-${key}`);
    await compareAnchor(briefing, receipt, key);
    check(await page.evaluate(scrap => window.__RAIL.state.train.resources.scrap === scrap - 8, before), `${key}: wrong repair charge`);
    await page.keyboard.press('Enter');
    await page.waitForFunction(() => window.__RAIL.state.phase === 'running');
  }

  // A new player has no specialist or relic; the baseline and free exit still work.
  await fresh({ crew: false });
  check(await page.locator('.rv-conversation .rv-option').nth(1).isDisabled(), 'unowned mechanic option enabled');
  await page.keyboard.press('1');
  await page.keyboard.press('3');
  await page.keyboard.press('Enter');
  await page.waitForFunction(() => window.__RAIL.state.phase === 'running');

  // Controller D-pad selects the same native choice; A confirms without world input.
  await fresh({ kit: true });
  await page.evaluate(() => {
    window.__qaPad = { index: 0, id: 'QA controller', connected: true, mapping: 'standard', axes: [0, 0, 0, 0], buttons: Array.from({ length: 17 }, () => ({ pressed: false, touched: false, value: 0 })) };
    window.__qaPadPolls = 0;
    Object.defineProperty(navigator, 'getGamepads', { configurable: true, value: () => { window.__qaPadPolls++; return [window.__qaPad]; } });
  });
  async function pad(button) {
    const pressedAt = await page.evaluate(i => { window.__qaPad.buttons[i] = { pressed: true, touched: true, value: 1 }; return window.__qaPadPolls; }, button);
    await page.waitForFunction(at => window.__qaPadPolls > at, pressedAt);
    const releasedAt = await page.evaluate(i => { window.__qaPad.buttons[i] = { pressed: false, touched: false, value: 0 }; return window.__qaPadPolls; }, button);
    await page.waitForFunction(at => window.__qaPadPolls > at, releasedAt);
  }
  await pad(13); await pad(13); await pad(0);
  await page.locator('.rv-conversation[data-dialogue-step="briefing"]').waitFor();
  check(await page.evaluate(() => window.__RAIL.state.activeEvent.dialogue.approach === 'kit'), 'controller did not choose the Tinker’s Kit');
  await page.evaluate(() => Object.defineProperty(navigator, 'getGamepads', { configurable: true, value: () => [] }));

  // Real keyboard cancellation must never start combat or lose the location event.
  await fresh();
  await page.keyboard.press('1'); await page.keyboard.press('1');
  await page.locator('.rv-crewpick').waitFor({ state: 'visible' });
  const scrap = await page.evaluate(() => window.__RAIL.state.train.resources.scrap);
  await page.getByRole('button', { name: 'Cancel (Esc)', exact: true }).focus();
  await page.keyboard.press('Enter');
  await page.locator('.rv-conversation[data-dialogue-step="briefing"]').waitFor();
  check(await page.evaluate(n => window.__RAIL.state.train.resources.scrap === n && !window.__RAIL.state.expedition, scrap), 'cancel charged or started battle');

  // Save mid-dialogue, then during a pending attack; UI must restore each active task.
  await page.evaluate(() => { const R = window.__RAIL; R.sim.restore(R.sim.serialize()); });
  await page.locator('.rv-conversation[data-dialogue-step="briefing"]').waitFor();
  await page.keyboard.press('1');
  await page.locator('.rv-crewpick').waitFor({ state: 'visible' });
  await page.keyboard.press('2'); await page.keyboard.press('3');
  await page.getByRole('button', { name: 'Start the expedition (Enter)', exact: true }).click();
  await page.locator('.rv-exp-menu').waitFor({ state: 'visible' });
  await page.evaluate(() => {
    const R = window.__RAIL;
    R.sim.expeditionAction('strike');
    R.ctx.settings.writeSave(R.sim.serialize());
  });
  await page.reload();
  await page.waitForFunction(() => window.__RAIL?.ready && window.__RAIL.view);
  await page.evaluate(() => { if (!window.__RAIL.ctx.continueRun()) throw new Error('Saved expedition did not continue'); });
  await page.waitForFunction(() => window.__RAIL.state.phase === 'expedition');
  await page.waitForTimeout(200);
  await page.screenshot({ path: `${out}/restored-battle.png` });
  // Resolver-driven finish proves handoff/reward continuity, not timing skill or balance.
  await page.evaluate(() => {
    const R = window.__RAIL;
    for (let i = 0; i < 400 && !R.state.expedition?.outcome; i++) {
      const x = R.state.expedition;
      if (x.awaitingAdvance) R.sim.advanceExpedition(true);
      else if (x.pending) R.sim.expeditionResolve('perfect');
      else if (x.turn === 'player') R.sim.expeditionAction('strike');
    }
    if (R.state.expedition?.outcome !== 'won') throw new Error('Victory fixture did not finish');
    R.sim.restore(R.sim.serialize());
  });
  await page.locator('.rv-exp-result').waitFor({ state: 'visible' });
  await page.screenshot({ path: `${out}/restored-victory.png` });
  await page.locator('.rv-exp-result button').click();
  await page.waitForFunction(() => window.__RAIL.state.phase === 'relic');
  await page.evaluate(() => { const R = window.__RAIL; R.sim.restore(R.sim.serialize()); });
  await page.waitForFunction(() => window.__RAIL.state.phase === 'relic');
  await page.evaluate(() => window.__RAIL.sim.chooseRelic(0));
  await page.locator('.rv-conversation[data-dialogue-step="receipt"]').waitFor();
  await snapshot('expedition-return');
  await page.keyboard.press('Enter');
  await page.waitForFunction(() => window.__RAIL.state.phase === 'running');
} catch (error) {
  failures.push(error.stack ?? String(error));
  fs.writeFileSync(`${out}/failure-state.json`, JSON.stringify(await page.evaluate(() => ({ inputs: window.__conversationInputs, event: window.__RAIL?.state.activeEvent, phase: window.__RAIL?.state.phase, focus: document.activeElement?.outerHTML, keys: [...document.querySelectorAll('.rv-overlay:not([hidden])')].map(x => ({ name: x.getAttribute('aria-label'), class: x.className })) })), null, 2));
  await page.screenshot({ path: `${out}/failure.png` }).catch(() => {});
} finally {
  check(errors.length === 0, `Page errors: ${errors.join('; ')}`);
  await browser.close();
  fs.writeFileSync(`${out}/results.json`, JSON.stringify({ failures, errors, results }, null, 2));
  console.log(JSON.stringify({ failures, errors, samples: results.length }, null, 2));
  if (failures.length) process.exitCode = 1;
}
