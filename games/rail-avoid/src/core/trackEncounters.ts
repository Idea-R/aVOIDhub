/** Physical rail and encounter state are separate: a barricade never erases track. */
import type { SimState, PassengerEventDef } from './types';
import { edgeKey } from './hex';
import { EXPEDITION } from './config';

export const TRACK_AMBUSH_EVENT = 'track_ambush';

export function blockedTrack(s: SimState, from: [number, number], to: [number, number]) {
  const edge = edgeKey(...from, ...to);
  return s.route.encounters?.find(e => e.status === 'blocked' && e.edge === edge);
}

export function nearbyTrackEncounter(s: SimState) {
  if (s.train.reversing || s.train.progress > 0) return undefined;
  const p = s.route.path[s.train.routeIndex];
  return p && s.route.encounters?.find(e => e.status === 'blocked'
    && [e.from, e.to].some(t => t[0] === p[0] && t[1] === p[1]));
}

export function trackEncounterEvent(s: SimState): PassengerEventDef {
  const encounter = s.route.encounters?.find(e => e.id === s.activeEvent?.trackEncounterId);
  return {
    id: TRACK_AMBUSH_EVENT, title: 'A Barricade on the Line', negative: true,
    text: encounter?.attempts ? 'Your crew is back aboard. The barricade still holds. You can try again or find another way around.'
      : 'A red lamp hangs over a heap of sleepers. Raiders hold the rail works beyond it. This stretch of track stays closed until the crew clears both positions.',
    options: [
      { label: encounter?.attempts ? 'Prepare another attempt' : 'Send an away team', desc: `Two stages. ${EXPEDITION.voidSecondsPerRound}s Void travel per round, minimum one. Wounds carry back. Each attempt restarts both stages; no partial reward. Choose crew next; cancel freely.`, requires: { fitCrew: true } },
      { label: 'Stay aboard · choose another route', desc: 'No cost. The barricade stays. Clear the untravelled plan, then reverse or lay a route around it. Inspect again here to retry.' },
    ],
  };
}
