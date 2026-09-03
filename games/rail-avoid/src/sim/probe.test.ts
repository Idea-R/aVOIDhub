import { it } from 'vitest';
import { writeFileSync } from 'node:fs';
import { EventBus } from '../core/events';
import { createSim } from './sim';
import { hexDistance } from '../core/hex';
const PROBE = !!process.env.PROBE;
(PROBE ? it : it.skip)('long run probe', () => {
  const bus = new EventBus();
  const sim = createSim(12345, bus);
  const lines: string[] = [];
  const counts: Record<string, number> = {};
  for (const ev of ['enemy:spawn','enemy:died','weapon:fire','enemy:boarded','wave:spawn','settlement:reached','car:destroyed','sapper:planted','boss:spawn','boss:died','rift:open'] as const) bus.on(ev as any, () => { counts[ev] = (counts[ev] ?? 0) + 1; });
  const stepsTotal = Math.round(20 * 60 / 0.05);
  for (let i = 0; i < stepsTotal; i++) {
    const s = sim.state;
    if (i % 10 === 0) {
      if (s.phase === 'shop') { sim.repairAll(); const list = ['cannon','radiator','boiler','flak','tesla','armor_plate','scout','barracks']; for (const t of list) { if (s.train.resources.scrap > 60) sim.buyCar(t as any); } sim.closeShop(); }
      else if (s.phase === 'relic') sim.chooseRelic(0);
      else if (s.phase === 'expedition') { const x = s.expedition!; if (x.outcome) sim.endExpedition(); else if (x.pending) sim.expeditionResolve('good'); else sim.expeditionAction('strike'); }
      else if (s.phase === 'event') { if (!sim.chooseEventOption(0)) if (!sim.chooseEventOption(1)) sim.chooseEventOption(2); }
      else if (s.phase === 'running') {
        const ahead = s.route.path.length - 1 - s.train.routeIndex;
        if (ahead < sim.currentPlanRange() - 1) {
          const end = s.route.path[s.route.path.length - 1];
          const targets = s.settlements.filter(st => !st.visited && !st.consumed && st.col > end[0] && hexDistance(st.col, st.row, end[0], end[1]) <= 9).sort((a, b) => hexDistance(a.col, a.row, end[0], end[1]) - hexDistance(b.col, b.row, end[0], end[1]));
          let ok = false;
          for (const t of targets.slice(0, 3)) { if (sim.planPathTo(t.col, t.row).ok) { ok = true; break; } }
          if (!ok) { for (let dr = 0; dr <= 3 && !ok; dr++) for (const sgn of [1, -1]) { const r = sim.planPathTo(Math.min(54, end[0] + 5), Math.max(0, Math.min(25, end[1] + dr * sgn))); if (r.ok) { ok = true; break; } } }
          if (!ok) { const o = sim.plannableTiles().sort((a, b) => b.col - a.col)[0]; if (o) sim.planTile(o.col, o.row); }
        }
        if (s.train.stopped && s.train.stopReason === 'settlement' && s.train.stopTimer > 5) sim.depart();
        for (const c of s.train.crew) if (c.carIndex < 0) { const idx = s.train.cars.findIndex(car => !car.crewId); if (idx >= 0) sim.assignCrew(c.id, idx); }
      }
    }
    sim.update(0.05);
    if (i % 1200 === 0 || sim.state.phase === 'defeat' || sim.state.phase === 'victory') {
      lines.push(`t=${s.time.toFixed(0)} ph=${s.phase} reg=${s.region} col=${s.route.path[s.train.routeIndex]?.[0]} void=${sim.voidDistance().toFixed(0)} cars=${s.train.cars.map(c => c.type.slice(0,4)+':'+c.hp.toFixed(0)+'/'+c.heat.toFixed(0)).join(' ')} res=${Object.entries(s.train.resources).map(([k,v])=>k[0]+Math.round(v)).join(' ')} pax=${s.train.passengers} en=${s.enemies.length} boss=${s.boss.active?s.boss.type:'-'} wave=${s.director.waveCount}`);
    }
    if (sim.state.phase === 'defeat' || sim.state.phase === 'victory') break;
  }
  lines.push('END ' + sim.state.phase + ' ' + sim.state.defeatReason + ' score=' + sim.state.stats.score);
  lines.push(JSON.stringify(counts));
  lines.push(JSON.stringify(sim.state.stats.kills));
  lines.push(...sim.state.log.slice(-25).map(l => l.t.toFixed(0) + ' ' + l.text));
  writeFileSync('probe.txt', lines.join('\n'));
});
