/** Authored location dialogue. Availability, copy and costs read the same run state. */
import type { PassengerEventDef, PassengerEventOption, SimState } from './types';
import { eventById } from './passengerEvents';
import { EXPEDITION } from './config';
import { TRACK_AMBUSH_EVENT, trackEncounterEvent } from './trackEncounters';

export const KEEPER_HELPED = 'keeper_aided';
export type KeeperAction = 'help' | 'mechanic' | 'kit' | 'prepare' | 'repair' | 'leave' | 'return';
export interface ConversationOption extends PassengerEventOption { action: KeeperAction }
export interface ConversationDef extends PassengerEventDef {
  options: ConversationOption[];
  exchange: Array<{ speaker: string; text: string }>;
  context: string;
}

export function eventStepKey(s: SimState): string {
  const e = s.activeEvent;
  return e ? `${e.defId}:${e.startedAt}:${e.locationId ?? ''}:${e.trackEncounterId ?? ''}:${e.dialogue?.step ?? 'arrival'}:${e.dialogue?.approach ?? ''}:${!!e.preparingExpedition}` : '';
}

export function keeperConversation(s: SimState): ConversationDef {
  const e = s.activeEvent;
  const step = e?.dialogue?.step ?? 'arrival';
  const trusted = s.storyFlags?.includes(KEEPER_HELPED) ?? false;
  const mechanic = s.train.crew.find(c => c.specialty === 'mechanic' && c.hp > 20);
  const keeper = 'Mara · Junction keeper';
  const base = { id: 'node_crossroads', title: 'The Keeper’s Signal', text: '', negative: false };
  if (step === 'receipt') return {
    ...base, context: 'Visit complete',
    exchange: [{ speaker: keeper, text: e?.dialogue?.receipt ?? 'The lamp is green. Thank you for stopping.' }, { speaker: 'The Conductor', text: 'Keep your lamp burning. There are more trains behind us.' }],
    options: [{ action: 'return', label: 'Return to the train', desc: 'Keep your route. Travel resumes; no extra cost.' }],
  };
  if (step === 'briefing') {
    const approach = e?.dialogue?.approach ?? 'help';
    const cost = approach === 'kit' ? 3 : approach === 'mechanic' ? 8 : 24;
    const finalCost = trusted ? Math.max(1, cost - 4) : cost;
    const context = approach === 'kit' ? 'Tinker’s Kit · spare lifting gear' : approach === 'mechanic' ? `${mechanic?.name ?? 'Your Mechanic'} · hoist inspection` : 'The Conductor · a helping hand';
    return {
      ...base, context: `${context}${trusted ? ' · keepers supply up to 4 scrap' : ''}`,
      exchange: [
        { speaker: keeper, text: 'Scavengers hold the lower works. My people are hiding below. Take the stairs, or mend the hoist to lift them out.' },
        { speaker: 'The Conductor', text: approach === 'kit' ? 'Our kit has a spare ratchet. We can fix the hoist from here.' : approach === 'mechanic' ? `${mechanic?.name ?? 'Our Mechanic'} found a broken coupling. We can repair it here, or go below.` : 'We can send a team below, or buy the parts. The main line is still open.' },
      ],
      options: [
        { action: 'prepare', label: 'Prepare an away team', desc: `${s.region >= 2 ? 3 : 2} chambers · ${EXPEDITION.voidSecondsPerRound}s Void travel per round (minimum one). Wounds carry back. Choose crew next; cancel freely.`, requires: { fitCrew: true } },
        { action: 'repair', label: 'Repair the platform hoist', desc: `${finalCost} scrap → 3 marks. Rescue workers without combat. Earn keeper goodwill; no extra Void time.`, requires: { resource: 'scrap', amount: finalCost, ...(approach === 'mechanic' ? { crew: 'mechanic' as const } : {}), ...(approach === 'kit' ? { relic: 'tinkers_kit' } : {}) } },
        { action: 'leave', label: 'Leave the keeper to it', desc: 'No cost or reward. Keep your route; this visit ends.' },
      ],
    };
  }
  return {
    ...base, context: trusted ? 'The keepers remember your help' : 'A lamp beside the crossroads',
    exchange: [
      { speaker: keeper, text: trusted ? 'Word came down the line: you help your own. Our hoist has failed, and my crew are trapped below the platform. Can you stop?' : 'Conductor! The main line is clear, but our platform hoist has failed. My crew are trapped in the old works below.' },
      { speaker: 'The Conductor', text: 'Hold the signal. Tell me what you need.' },
    ],
    options: [
      { action: 'help', label: 'Hear the keeper out', desc: 'Find out what happened. No cost; decide whether to help next.' },
      { action: 'mechanic', label: mechanic ? `Ask ${mechanic.name} to inspect` : 'Ask a Mechanic to inspect', desc: 'A fit Mechanic can reduce repair parts from 24 to 8 scrap.', requires: { crew: 'mechanic' } },
      { action: 'kit', label: 'Offer the Tinker’s Kit', desc: 'Use its lifting gear: repairs need only 3 scrap. The relic is kept.', requires: { relic: 'tinkers_kit' } },
    ],
  };
}

export function activeEventDef(s: SimState, id = s.activeEvent?.defId): PassengerEventDef | undefined {
  if (id === TRACK_AMBUSH_EVENT) return trackEncounterEvent(s);
  return id === 'node_crossroads' ? keeperConversation(s) : id ? eventById(id) : undefined;
}
