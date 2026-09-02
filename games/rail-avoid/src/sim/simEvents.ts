/** Passenger event scheduling and resolution. */
import type { SimContext } from './api';
import { PASSENGER_EVENTS, eventById } from '../core/passengerEvents';
import { EVENTS } from '../core/config';
import { addResource, hasCar, log } from './helpers';
import { addCrew, removePassengers } from './train';

export function updateEvents(ctx: SimContext): void {
  const { state, dt } = ctx;
  if (state.phase !== 'running') return;
  state.eventCooldown -= dt;
  if (state.eventCooldown > 0) return;
  if (state.train.passengers <= 0 || state.boss.active || state.train.stopped) { state.eventCooldown = 8; return; }
  const sleeper = hasCar(state, 'sleeper');
  let pool = PASSENGER_EVENTS.filter(e => !state.usedEvents.includes(e.id));
  if (pool.length === 0) { state.usedEvents = []; pool = PASSENGER_EVENTS.slice(); }
  const weights = pool.map(e => (e.negative ? (sleeper ? 0.5 : 1.2) : 1));
  const def = ctx.rng.events.weighted(pool, weights);
  state.usedEvents.push(def.id);
  state.activeEvent = { defId: def.id, startedAt: state.time };
  state.phase = 'event';
  ctx.bus.defer('phase:change', { phase: 'event' });
  ctx.bus.defer('event:show', { defId: def.id });
  state.eventCooldown = EVENTS.interval + ctx.rng.events.range(-EVENTS.variance, EVENTS.variance);
}

function requirementMet(ctx: SimContext, opt: { requires?: { car?: any; resource?: any; amount?: number } }): boolean {
  if (!opt.requires) return true;
  if (opt.requires.car && !hasCar(ctx.state, opt.requires.car)) return false;
  if (opt.requires.resource && ctx.state.train.resources[opt.requires.resource as 'rails'] < (opt.requires.amount ?? 0)) return false;
  return true;
}

export function chooseEventOption(ctx: SimContext, index: number): boolean {
  const { state } = ctx;
  if (state.phase !== 'event' || !state.activeEvent) return false;
  const def = eventById(state.activeEvent.defId);
  if (!def) { state.activeEvent = null; state.phase = 'running'; return false; }
  const opt = def.options[index];
  if (!opt || !requirementMet(ctx, opt)) return false;
  const t = state.train;
  const rng = ctx.rng.events;
  let summary = '';
  const morale = (d: number) => { t.morale = Math.max(0, Math.min(100, t.morale + d)); };
  switch (def.id + ':' + index) {
    case 'stowaway:0': addCrew(state, 'surveyor', 'Wren'); addResource(ctx, 'food', -4); summary = 'Wren the surveyor joins the crew.'; ctx.bus.defer('crew:joined', { specialty: 'surveyor', name: 'Wren' }); break;
    case 'stowaway:1': addResource(ctx, 'coal', 6); summary = 'She shovels coal until the next stop.'; break;
    case 'stowaway:2': morale(-5); summary = 'She will leave at the next stop.'; break;
    case 'sickness:0': morale(10); summary = 'The medical car treats the fever.'; break;
    case 'sickness:1': addResource(ctx, 'food', -6); if (rng.chance(0.5)) { removePassengers(ctx, 1, 'fever'); summary = 'One passenger did not recover.'; } else summary = 'Everyone pulls through.'; break;
    case 'sickness:2': removePassengers(ctx, 3, 'quarantine'); morale(-10); summary = 'Three passengers left behind in quarantine.'; break;
    case 'hungry:0': addResource(ctx, 'food', -8); morale(12); summary = 'A proper meal. Spirits lift.'; break;
    case 'hungry:1': morale(-15); if (t.morale < 25 && rng.chance(0.5)) { removePassengers(ctx, 2, 'riot'); summary = 'A scuffle in the coach. Two passengers are gone.'; } else summary = 'Grumbling, but order holds.'; break;
    case 'hungry:2': morale(-5); state.stats.eventsResolved; summary = 'They will hold you to the promise of a farm.'; break;
    case 'volunteer:0': addCrew(state, 'gunner', 'Sgt. Okoro'); ctx.bus.defer('crew:joined', { specialty: 'gunner', name: 'Sgt. Okoro' }); summary = 'A veteran gunner joins.'; break;
    case 'volunteer:1': morale(3); summary = 'He returns to his seat, a little proud.'; break;
    case 'childs_map:0': addResource(ctx, 'rails', 8); summary = 'A cache of rails, right where she said.'; break;
    case 'childs_map:1': addResource(ctx, 'food', -2); addResource(ctx, 'rails', 12); summary = 'A sweet deal: 12 rails.'; break;
    case 'mutiny:0': morale(8); summary = 'The sleeper crew talks them down.'; break;
    case 'mutiny:1': addResource(ctx, 'scrap', -12); morale(4); summary = 'Bought peace with scrap.'; break;
    case 'mutiny:2': removePassengers(ctx, 4, 'mutiny'); morale(-8); summary = 'Four passengers walk west.'; break;
    case 'salvage:0': addResource(ctx, 'scrap', 14); addResource(ctx, 'ammo', 10); t.stopped = true; t.stopReason = 'settlement'; t.stopTimer = 13; summary = 'Salvage aboard. The train idles briefly.'; break;
    case 'salvage:1': summary = 'The wreck slides past.'; break;
    case 'engineer:0': addCrew(state, 'engineer', 'Hale'); addResource(ctx, 'scrap', -3); ctx.bus.defer('crew:joined', { specialty: 'engineer', name: 'Hale' }); summary = 'Hale the engineer joins.'; break;
    case 'engineer:1': summary = 'The gauge keeps lying.'; break;
    case 'birthday:0': addResource(ctx, 'food', -3); morale(12); summary = 'Singing carries down the train.'; break;
    case 'birthday:1': morale(4); summary = 'A quiet toast.'; break;
    case 'fire_drill:0': summary = 'The radiator vents the smoke.'; break;
    case 'fire_drill:1': { const coaches = t.cars.map((c, i) => ({ c, i })).filter(x => x.c.passengers > 0 || x.c.type === 'coach' || x.c.type === 'sleeper'); const pick = coaches.length ? rng.pick(coaches) : null; if (pick) { pick.c.heat = Math.min(120, pick.c.heat + 30); pick.c.hp = Math.max(1, pick.c.hp - 20); } summary = 'Doused by hand; the coach is scorched.'; break; }
    case 'medic_offer:0': addCrew(state, 'medic', 'Ines'); ctx.bus.defer('crew:joined', { specialty: 'medic', name: 'Ines' }); summary = 'Ines the medic joins.'; break;
    case 'medic_offer:1': addResource(ctx, 'food', -4); morale(6); summary = 'Supplies handed over.'; break;
    case 'ammo_cache:0': addResource(ctx, 'ammo', 24); morale(-3); summary = 'Crates confiscated.'; break;
    case 'ammo_cache:1': addResource(ctx, 'scrap', -6); addResource(ctx, 'ammo', 30); summary = 'A fair trade.'; break;
    case 'mechanic:0': addCrew(state, 'mechanic', 'Rook'); ctx.bus.defer('crew:joined', { specialty: 'mechanic', name: 'Rook' }); summary = 'Rook the mechanic joins.'; break;
    case 'mechanic:1': for (const c of t.cars) c.hp = Math.min(c.maxHp, c.hp + 10); summary = 'Every car patched up a little.'; break;
    case 'void_sermon:0': morale(5); summary = 'The medics talk them back.'; break;
    case 'void_sermon:1': morale(-6); summary = 'Doors locked. Nobody leaves.'; break;
    case 'void_sermon:2': removePassengers(ctx, 5, 'walked into the void'); morale(2); summary = 'Five walk west into the dark.'; break;
    default: summary = 'Resolved.';
  }
  state.stats.eventsResolved++;
  log(state, `${def.title}: ${summary}`, def.negative ? 'warn' : 'good');
  state.activeEvent = null;
  state.phase = 'running';
  ctx.bus.defer('event:resolved', { defId: def.id, option: index, summary });
  ctx.bus.defer('phase:change', { phase: 'running' });
  return true;
}
