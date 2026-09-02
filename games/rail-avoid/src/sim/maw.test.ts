import { describe, it, expect } from 'vitest';
import { EventBus } from '../core/events';
import { createSim } from './sim';
import { TEST_SEED } from '../core/config';

describe('void maw', () => {
  it('dies to a tesla-heavy god train circling the loop within 120 s', () => {
    const bus = new EventBus();
    const sim = createSim(TEST_SEED, bus);
    let died = false; bus.on('boss:died', () => { died = true; });
    sim.debug.godTrain();
    sim.debug.invulnerable(true);
    sim.debug.spawnBoss('boss_maw');
    expect(sim.state.boss.active).toBe(true);
    let minHp = 1e9; let lastLog = '';
    for (let i = 0; i < 120 * 20 && !died; i++) {
      if (i % 10 === 0 && sim.state.train.stopped && sim.state.train.stopReason === 'no_route') {
        const o = sim.plannableTiles(); if (o.length) sim.planTile(o[0].col, o[0].row);
      }
      sim.update(0.05);
      const maw = sim.state.enemies.find(e => e.type === 'boss_maw');
      if (maw) minHp = Math.min(minHp, maw.hp);
      if (i % 200 === 0) {
        const maw2 = sim.state.enemies.find(e => e.type === 'boss_maw');
        const teslas = sim.state.train.cars.filter(c => c.type === 'tesla').map(c => c.derived.powerRatio.toFixed(2) + '/' + (c.derived.targetEnemyId ? 'T' : '-'));
        const lp = sim.locoPos();
        lastLog = `t=${sim.state.time.toFixed(0)} mawHp=${maw2?.hp.toFixed(0)} d=${maw2 ? Math.hypot(maw2.x - lp.x, maw2.y - lp.y).toFixed(0) : '?'} teslas=${teslas.join(',')} stopped=${sim.state.train.stopped}/${sim.state.train.stopReason} enemies=${sim.state.enemies.length}`;
      }
    }
    expect(died, 'maw should die; last: ' + lastLog + ' minHp=' + minHp).toBe(true);
    expect(sim.state.boss.gateOpen).toBe(true);
  });
});
