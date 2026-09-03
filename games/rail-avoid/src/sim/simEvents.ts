/** Passenger event scheduling and resolution. */
import type { SimContext } from './api';
import { PASSENGER_EVENTS, eventById } from '../core/passengerEvents';
import { EVENTS } from '../core/config';
import { addResource, hasCar, log } from './helpers';
import { spawnWave } from './waves';
import { addCar } from './train';
import type { CarType } from '../core/types';
import { addCrew, removePassengers } from './train';
import { addMarks, offerRelics, hasRelic } from './loot';

export function updateEvents(ctx: SimContext): void {
  const { state, dt } = ctx;
  if (state.phase !== 'running') return;
  state.eventCooldown -= dt;
  if (state.eventCooldown > 0) return;
  if (state.train.passengers <= 0 || state.boss.active || state.train.stopped) { state.eventCooldown = 8; return; }
  const sleeper = hasCar(state, 'sleeper');
  let pool = PASSENGER_EVENTS.filter(e => !state.usedEvents.includes(e.id));  // node events are never scheduled
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

function requirementMet(ctx: SimContext, opt: { requires?: { car?: any; resource?: any; amount?: number; marks?: number } }): boolean {
  if (!opt.requires) return true;
  if (opt.requires.marks && (ctx.state.train.marks ?? 0) < opt.requires.marks) return false;
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
    case 'node_shrine:0': t.locoUpgrades.power = Math.min(3, t.locoUpgrades.power + 1); ctx.bus.defer('loco:upgraded', { kind: 'power', level: t.locoUpgrades.power }); summary = 'The boiler sings. Power +2.'; break;
    case 'node_shrine:1': for (const c of t.cars) { c.hp = Math.min(c.maxHp, c.hp + 40); c.heat = 0; c.onFire = false; } summary = 'Every coupling gleams; the cars are cool and patched.'; break;
    case 'node_shrine:2': addResource(ctx, 'scrap', -10); addResource(ctx, 'rails', 25); summary = 'The offering is accepted: 25 rails.'; break;
    case 'node_shrine:3': morale(3); summary = 'The crew nods at the shrine and moves on.'; break;
    case 'node_market:0': addResource(ctx, 'scrap', -12); addResource(ctx, 'rails', 10); summary = 'Rails bought.'; break;
    case 'node_market:1': addResource(ctx, 'food', -8); addResource(ctx, 'ammo', 30); summary = 'Crates of ammunition loaded.'; break;
    case 'node_market:2': addResource(ctx, 'ammo', -25); addResource(ctx, 'scrap', 18); summary = 'Ammunition sold for scrap.'; break;
    case 'node_market:3': morale(2); summary = 'Window shopping.'; break;
    case 'node_market:4': addMarks(ctx, -6, 'market relic'); summary = 'A wrapped relic changes hands.'; state.activeEvent = null; state.phase = 'running'; ctx.bus.defer('event:resolved', { defId: def.id, option: index, summary }); offerRelics(ctx, 'market'); return true;
    case 'node_site:0': summary = 'Choose your crew.'; state.activeEvent = null; state.phase = 'running'; ctx.bus.defer('event:resolved', { defId: def.id, option: index, summary }); ctx.bus.defer('phase:change', { phase: 'running' }); return true; // the UI shows the crew picker and calls startExpedition(crewIds); cancelling simply continues the run
    case 'node_site:1': addResource(ctx, 'scrap', 6); addResource(ctx, 'ammo', 4); summary = 'A quick sweep of the edge.'; break;
    case 'node_site:2': morale(2); summary = 'Not today.'; break;
    case 'mystery_cache:0': {
      const roll = rng.int(0, 3);
      if (roll === 0) { addResource(ctx, 'scrap', 22); summary = 'The chest holds a machinist\'s salvage kit: +22 scrap.'; }
      else if (roll === 1) { addResource(ctx, 'ammo', 34); summary = 'Sealed ammunition tins fill the chest: +34 ammo.'; }
      else if (roll === 2) { addMarks(ctx, 5, 'signal lockbox'); summary = 'Five Void Marks hum beneath the false bottom.'; }
      else { summary = 'A wrapped relic waits inside.'; state.activeEvent = null; state.phase = 'running'; ctx.bus.defer('event:resolved', { defId: def.id, option: index, summary }); offerRelics(ctx, 'mystery cache'); return true; }
      break;
    }
    case 'mystery_cache:1': addResource(ctx, 'scrap', 12); summary = 'The lockbox fittings come away cleanly.'; break;
    case 'mystery_cache:2': morale(2); summary = 'Some mysteries are safer unopened.'; break;
    case 'mystery_away:0': summary = 'Choose your away team.'; state.activeEvent = null; state.phase = 'running'; ctx.bus.defer('event:resolved', { defId: def.id, option: index, summary }); ctx.bus.defer('phase:change', { phase: 'running' }); return true;
    case 'mystery_away:1': addResource(ctx, 'scrap', 7); addResource(ctx, 'ammo', 5); summary = 'A careful sweep finds loose stores.'; break;
    case 'mystery_away:2': morale(2); summary = 'The lights recede behind the last car.'; break;
    case 'mystery_ambush:0': {
      const region = Math.max(0, Math.min(3, state.region));
      const comp = region < 2 ? ['raider', 'raider', 'hound', 'raider'] : ['raider', 'crawler', 'harpy', 'wisp'];
      state.activeEvent = null; state.phase = 'running'; ctx.bus.defer('phase:change', { phase: 'running' });
      t.stopped = false; t.stopReason = 'none'; t.stopTimer = 0;
      spawnWave(ctx, comp as any, rng.chance(0.5) ? 'north' : 'south');
      addMarks(ctx, 3, 'false signal');
      summary = 'The throttle opens as the ambush closes in.';
      ctx.bus.defer('event:resolved', { defId: def.id, option: index, summary });
      return true;
    }
    case 'mystery_ambush:1': addResource(ctx, 'scrap', -14); summary = 'The decoy clatters down the siding. The attackers follow it.'; break;
    case 'mystery_ambush:2': morale(-8); summary = 'The consist reverses clear, shaken but intact.'; break;
    case 'mystery_survivor:0': addResource(ctx, 'food', -4); addCrew(state, 'gunner', 'Nils'); ctx.bus.defer('crew:joined', { specialty: 'gunner', name: 'Nils' }); summary = 'Nils and her lantern come aboard.'; break;
    case 'mystery_survivor:1': addResource(ctx, 'food', -5); addResource(ctx, 'ammo', 24); summary = 'A hot meal for two sealed ammunition cases.'; break;
    case 'mystery_survivor:2': morale(-3); summary = 'Her lantern dwindles behind the train.'; break;
    case 'mystery_weapon:0': {
      if (t.cars.length >= 10) { addResource(ctx, 'scrap', 10); summary = 'No room in the consist; the crew recovers 10 scrap instead.'; break; }
      addResource(ctx, 'scrap', -18);
      const type: CarType = state.region >= 2 ? 'flak' : 'gatling';
      const car = addCar(ctx, type);
      if (car) {
        car.hp = Math.max(1, Math.round(car.maxHp * 0.45));
        addResource(ctx, 'ammo', 12);
        ctx.bus.defer('car:bought', { type });
        summary = `A damaged ${type === 'flak' ? 'Flak Battery' : 'Gatling Turret'} joins the consist with 12 ammo.`;
      } else { addResource(ctx, 'scrap', 18); summary = 'The coupling fails; the repair scrap is recovered.'; }
      break;
    }
    case 'mystery_weapon:1': addResource(ctx, 'scrap', 16); addResource(ctx, 'ammo', 12); summary = 'The mounting yields useful parts and ammunition.'; break;
    case 'mystery_weapon:2': addResource(ctx, 'rails', 4); summary = 'The forgotten siding is added to the track plan.'; break;
    case 'node_crossroads:0': {
      const region = Math.max(0, Math.min(3, state.region));
      const comp = region === 0 ? ['raider', 'raider', 'raider', 'hound', 'hound', 'raider'] : region === 1 ? ['crawler', 'raider', 'raider', 'sapper', 'hound', 'hound'] : region === 2 ? ['harpy', 'harpy', 'wisp', 'raider', 'raider', 'crawler'] : ['wisp', 'wisp', 'harpy', 'crawler', 'raider', 'raider'];
      state.activeEvent = null; state.phase = 'running'; ctx.bus.defer('phase:change', { phase: 'running' });
      state.train.stopped = false; state.train.stopReason = 'none'; state.train.stopTimer = 0;
      spawnWave(ctx, comp as any, 'east');
      // promote two members to elites (guaranteed relic + marks on kill)
      let promoted = 0;
      for (let i = state.enemies.length - 1; i >= 0 && promoted < 2; i--) { const e = state.enemies[i]; if (e.state === 'dead' || e.type.startsWith('boss_') || e.type === 'sapper') continue; e.extra.elite = 1; e.maxHp = Math.round(e.maxHp * 1.6); e.hp = e.maxHp; ctx.bus.defer('enemy:elite', { id: e.id, type: e.type }); promoted++; }
      addMarks(ctx, 6, 'crossroads');
      summary = 'The barricades open. Steel meets steel.';
      ctx.bus.defer('event:resolved', { defId: def.id, option: index, summary });
      return true;
    }
    case 'node_crossroads:1': addResource(ctx, 'scrap', -24); summary = 'The toll is paid. The barricades part.'; break;
    case 'node_crossroads:2': addMarks(ctx, -5, 'crossroads bribe'); state.train.watchUntil = state.time + 300; summary = 'The tower talks. You know what is coming.'; break;
    case 'node_wreck:0': {
      const pool: CarType[] = ['coal_bunker', 'boiler', 'radiator', 'cargo', 'gatling', 'barracks', 'scout', 'coach', 'caboose'];
      if (rng.chance(0.75) && t.cars.length < 10) { const type = rng.pick(pool); const car = addCar(ctx, type); if (car) { car.hp = Math.round(car.maxHp * 0.6); summary = `A ${type.replace('_', ' ')} is dragged onto the rails.`; ctx.bus.defer('car:bought', { type }); break; } }
      addResource(ctx, 'scrap', 15); summary = 'Nothing worth coupling. +15 scrap.'; break;
    }
    case 'node_wreck:1': addResource(ctx, 'scrap', 20); addResource(ctx, 'ammo', 10); summary = 'Stripped for parts.'; break;
    case 'node_wreck:2': addResource(ctx, 'food', 8); if (rng.chance(0.5)) { addCrew(state, 'mechanic'); ctx.bus.defer('crew:joined', { specialty: 'mechanic', name: 'a survivor' }); summary = 'A survivor mechanic joins.'; } else summary = 'Tins of food, nothing else.'; if (rng.chance(0.25)) { spawnWave(ctx, ['raider', 'raider', 'raider'], 'north'); summary += ' Scavengers were watching.'; } break;
    default: summary = 'Resolved.';
  }
  state.stats.eventsResolved++;
  if (hasRelic(state, 'conductors_watch') && !def.id.startsWith('node_') && !def.id.startsWith('mystery_')) addMarks(ctx, 2, 'conductors watch');
  log(state, `${def.title}: ${summary}`, def.negative ? 'warn' : 'good');
  state.activeEvent = null;
  state.phase = 'running';
  ctx.bus.defer('event:resolved', { defId: def.id, option: index, summary });
  ctx.bus.defer('phase:change', { phase: 'running' });
  return true;
}
