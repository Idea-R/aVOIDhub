import { it } from 'vitest';
import { EventBus } from '../core/events';
import { createSim } from './sim';
import { hexDistance } from '../core/hex';

// Opt-in balance evidence, not a promise of player win rate. No debug grants,
// invulnerability, warps or perfect timing. Run identically before/after tuning.
it.skipIf(!process.env.RECOVERY_PROBE)('ordinary-loadout recovery probe', () => {
  for (const seed of [12345, 42, 2026, 7331, 91]) {
    const sim = createSim(seed, new EventBus());
    let serviceUsed = false;
    for (let i = 0; i < 24000; i++) {
      const s = sim.state, t = s.train;
      if (s.phase === 'defeat' || s.phase === 'victory' || s.route.path[t.routeIndex][0] >= Number(process.env.PROBE_COL ?? 52)) break;
      if (i % 10 === 0) {
        if (s.phase === 'shop') {
          sim.repairAll();
          if (!t.cars.some(c => c.type === 'cannon') && t.resources.scrap >= 48) sim.buyCar('cannon');
          sim.closeShop();
        } else if (s.phase === 'relic') sim.chooseRelic(0);
        else if (s.phase === 'expedition') {
          const x = s.expedition!;
          if (x.outcome) sim.endExpedition();
          else if (x.awaitingAdvance) sim.advanceExpedition(true);
          else if (x.pending) sim.expeditionResolve('good');
          else sim.expeditionAction('strike');
        } else if (s.phase === 'event') {
          if (!sim.chooseEventOption(2)) if (!sim.chooseEventOption(1)) sim.chooseEventOption(0);
        } else if (s.phase === 'running') {
          for (const cr of t.crew) if (cr.carIndex < 0) {
            const idx = t.cars.findIndex(c => !c.crewId && c.hp > 0);
            if (idx >= 0) sim.assignCrew(cr.id, idx);
          }
          const api = sim as typeof sim & { canService?: () => boolean; setFieldRepair?: (on: boolean) => boolean };
          if (process.env.FIELD_SERVICE && api.canService?.() && t.stopTimer < 1 && t.cars.some(c => c.hp / c.maxHp < .65) && sim.voidDistance() > 350) {
            serviceUsed = !!api.setFieldRepair?.(true) || serviceUsed;
          }
          const active = (t as typeof t & { service?: { repairing: boolean } }).service?.repairing;
          if (t.stopped && t.stopReason === 'settlement' && t.stopTimer > 5 && !active) sim.depart();
          if (active && sim.voidDistance() < 250) sim.depart();
          if (s.route.path.length - 1 - t.routeIndex < sim.currentPlanRange() - 1) {
            const end = s.route.path.at(-1)!;
            const targets = s.settlements.filter(st => !st.visited && !st.consumed && st.col > end[0] && hexDistance(st.col, st.row, ...end) <= 9)
              .sort((a, b) => hexDistance(a.col, a.row, ...end) - hexDistance(b.col, b.row, ...end));
            let ok = targets.slice(0, 3).some(st => sim.planPathTo(st.col, st.row).ok);
            if (!ok) {
              const branches = sim.junctionOptions().sort((a, b) => b.col - a.col);
              ok = branches.some(b => sim.planTile(b.col, b.row).ok);
            }
            if (!ok) {
              const tile = sim.plannableTiles().sort((a, b) => Number(b.free) - Number(a.free) || b.col - a.col)[0];
              if (tile) sim.planTile(tile.col, tile.row);
            }
          }
        }
      }
      sim.update(.05);
    }
    const s = sim.state;
    process.stdout.write(JSON.stringify({ seed, seconds: Math.round(s.time), region: s.region + 1, col: s.route.path[s.train.routeIndex][0],
      phase: s.phase, cause: s.defeatReason, lost: s.stats.carsLost, damage: Math.round(s.stats.damageTaken), serviceUsed,
      hulls: s.train.cars.map(c => `${c.type}:${Math.round(c.hp / c.maxHp * 100)}%`),
      ammo: Math.round(s.train.resources.ammo), scrap: Math.round(s.train.resources.scrap), bosses: s.stats.bossesDefeated }) + '\n');
  }
}, 120000);
