import type { SimState } from '../core/types';
import type { SimContext } from './api';
import { TRAIN } from '../core/config';
import { addResource, log } from './helpers';

const STAFFED = new Set(['village', 'depot', 'mine', 'farm', 'fuel', 'clinic', 'armory', 'market', 'crossroads', 'yard']);
export function hasFieldService(type: string): boolean { return STAFFED.has(type); }

/** Only a real, reached, unconsumed stop offers field service. Dialogue/combat
 * screens cannot issue these commands; pausing keeps the service state intact. */
export function serviceSite(state: SimState) {
  const t = state.train, p = state.route.path[t.routeIndex];
  if (!p || !t.stopped || t.reversing || t.stopReason !== 'settlement') return null;
  return state.settlements.find(s => s.col === p[0] && s.row === p[1] && s.visited && !s.consumed && STAFFED.has(s.type)) ?? null;
}

export function canService(ctx: SimContext): boolean {
  return ['running', 'paused', 'shop'].includes(ctx.state.phase) && !!serviceSite(ctx.state);
}

export function canReorder(ctx: SimContext): boolean {
  return ctx.state.phase === 'shop' || canService(ctx);
}

export function setServiceHold(ctx: SimContext, on: boolean): boolean {
  if (!canService(ctx) || ctx.state.phase === 'shop') return false;
  const t = ctx.state.train;
  if (on) t.service ??= { settlementId: serviceSite(ctx.state)!.id, repairing: false, repairTimer: 0 };
  else { t.service = undefined; t.stopTimer = 0; }
  return true;
}

export function fieldRepairTarget(state: SimState) {
  return state.train.cars.filter(c => c.hp > 0 && c.hp < c.maxHp * TRAIN.fieldRepairCap - .001)
    .sort((a, b) => a.hp / a.maxHp - b.hp / b.maxHp)[0];
}

export function setFieldRepair(ctx: SimContext, on: boolean): boolean {
  if (!canService(ctx) || ctx.state.phase === 'shop') return false;
  if (!on && !ctx.state.train.service) return true;
  if (on && (!fieldRepairTarget(ctx.state) || ctx.state.train.resources.scrap <= 0)) return false;
  if (!setServiceHold(ctx, true)) return false;
  ctx.state.train.service!.repairing = on;
  return true;
}

/** Real stopped world time; no work in paused/event/shop/expedition phases.
 * Charge only for restored HP, including fractional final repairs. */
export function updateFieldService(ctx: SimContext): boolean {
  const { state, dt } = ctx, t = state.train, service = t.service;
  if (!service) return false;
  if (serviceSite(state)?.id !== service.settlementId) { t.service = undefined; return false; }
  if (state.phase !== 'running' || !service.repairing) return true;
  const finish = (text: string) => {
    service.repairing = false;
    log(state, text, 'info');
    ctx.bus.defer('ui:notify', { text, kind: 'info' });
  };
  const target = fieldRepairTarget(state);
  if (!target || t.resources.scrap <= .000001) {
    finish(target ? 'Field repairs stopped: out of scrap. Depart when ready.' : 'Field repairs complete to 80%. Depart when ready.');
    return true;
  }
  service.repairTimer += dt;
  if (service.repairTimer + .000001 < TRAIN.fieldRepairInterval) return true;
  service.repairTimer -= TRAIN.fieldRepairInterval;
  const hp = Math.min(target.maxHp * TRAIN.fieldRepairFraction, target.maxHp * TRAIN.fieldRepairCap - target.hp,
    t.resources.scrap * TRAIN.fieldRepairHpPerScrap);
  addResource(ctx, 'scrap', -hp / TRAIN.fieldRepairHpPerScrap);
  target.hp += hp;
  ctx.bus.defer('car:repaired', { carIndex: t.cars.indexOf(target) });
  if (!fieldRepairTarget(state) || t.resources.scrap <= .000001) {
    finish(t.resources.scrap <= .000001 && fieldRepairTarget(state)
      ? 'Field repairs stopped: out of scrap. Depart when ready.' : 'Field repairs complete to 80%. Depart when ready.');
  }
  return true;
}
