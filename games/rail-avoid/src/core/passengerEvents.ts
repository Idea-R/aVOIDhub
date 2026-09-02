/** Passenger event content. Resolution logic lives in sim/events.ts. */
import type { PassengerEventDef } from './types';

export const PASSENGER_EVENTS: PassengerEventDef[] = [
  {
    id: 'stowaway', title: 'Stowaway', negative: false,
    text: 'A stowaway is found hiding among the coal. She says she was a rail surveyor before the void came.',
    options: [
      { label: 'Welcome her aboard', desc: 'Gain a Surveyor crew member. -4 food.' },
      { label: 'Put her to work shovelling', desc: '+6 coal now. She leaves at the next stop.' },
      { label: 'Leave her at the next stop', desc: 'Nothing happens. Morale -5.' },
    ],
  },
  {
    id: 'sickness', title: 'Fever in the Coach', negative: true,
    text: 'Three passengers have a fever. Others are muttering about quarantine.',
    options: [
      { label: 'Treat them', desc: 'Requires a Medical Car. Passengers recover; morale +10.', requires: { car: 'medical' } },
      { label: 'Ration medicine', desc: '-6 food. One passenger may not make it.' },
      { label: 'Isolate them in the last car', desc: 'Lose 3 passengers. Morale -10.' },
    ],
  },
  {
    id: 'hungry', title: 'Empty Bowls', negative: true,
    text: 'Passengers are demanding a proper meal. A few are eyeing the cargo hold.',
    options: [
      { label: 'Open the stores', desc: '-8 food. Morale +12.' },
      { label: 'Hold the line', desc: 'Morale -15. Riot risk if morale is low.' },
      { label: 'Promise the next farm', desc: 'Morale -5 now, +10 when you reach a farm.' },
    ],
  },
  {
    id: 'volunteer', title: 'The Volunteer', negative: false,
    text: 'An old artillery sergeant among the passengers offers to crew a turret.',
    options: [
      { label: 'Accept', desc: 'Gain a Gunner crew member.' },
      { label: 'Decline politely', desc: 'Morale +3.' },
    ],
  },
  {
    id: 'childs_map', title: "A Child's Map", negative: false,
    text: 'A child shows you a crayon map of an old spur line her father used to drive.',
    options: [
      { label: 'Follow the drawing', desc: '+8 rails from a hidden cache.' },
      { label: 'Trade her sweets for it', desc: '-2 food, +12 rails.' },
    ],
  },
  {
    id: 'mutiny', title: 'Mutiny Whispers', negative: true,
    text: 'A group of passengers wants to turn back toward the void to find family. They are armed.',
    options: [
      { label: 'Talk them down', desc: 'Requires a Sleeper Coach. Morale +8.', requires: { car: 'sleeper' } },
      { label: 'Bribe them with scrap', desc: '-12 scrap. Morale +4.' },
      { label: 'Put them off the train', desc: 'Lose 4 passengers. Morale -8.' },
    ],
  },
  {
    id: 'salvage', title: 'Salvage Party', negative: false,
    text: 'Passengers spotted a wreck by the line and want to strip it while the train slows.',
    options: [
      { label: 'Slow down for salvage', desc: '+14 scrap, +10 ammo. Train stops 12 s (stop pressure).' },
      { label: 'Keep moving', desc: 'Nothing lost.' },
    ],
  },
  {
    id: 'engineer', title: 'Broken Gauge', negative: false,
    text: 'A passenger who worked the yards notices the boiler gauge is lying. She could recalibrate it.',
    options: [
      { label: 'Let her at it', desc: 'Gain an Engineer crew member. -3 scrap.' },
      { label: 'Not now', desc: 'Nothing happens.' },
    ],
  },
  {
    id: 'birthday', title: 'A Small Celebration', negative: false,
    text: "It's someone's birthday. The coach wants to sing.",
    options: [
      { label: 'Share some food', desc: '-3 food. Morale +12.' },
      { label: 'Quietly', desc: 'Morale +4.' },
    ],
  },
  {
    id: 'fire_drill', title: 'Smoke in the Sleeper', negative: true,
    text: 'A cooking fire got out of hand in a passenger car.',
    options: [
      { label: 'Vent and douse', desc: 'Requires a Radiator Car. No damage.', requires: { car: 'radiator' } },
      { label: 'Fight it by hand', desc: 'Random passenger car takes 20 damage and +30 heat.' },
    ],
  },
  {
    id: 'medic_offer', title: 'The Field Nurse', negative: false,
    text: 'A field nurse among the refugees is quietly treating the wounded. She asks for a proper post.',
    options: [
      { label: 'Give her a post', desc: 'Gain a Medic crew member.' },
      { label: 'Give her supplies instead', desc: '-4 food. Morale +6.' },
    ],
  },
  {
    id: 'ammo_cache', title: 'Hidden Ammunition', negative: false,
    text: 'A former militiaman admits he smuggled crates of ammunition aboard.',
    options: [
      { label: 'Confiscate it', desc: '+24 ammo. Morale -3.' },
      { label: 'Buy it from him', desc: '-6 scrap, +30 ammo.' },
    ],
  },
  {
    id: 'mechanic', title: 'Grease and Grit', negative: false,
    text: 'A passenger has been secretly fixing the bogies at night. Crew say the ride is smoother.',
    options: [
      { label: 'Make it official', desc: 'Gain a Mechanic crew member.' },
      { label: 'Thank him', desc: 'Every car repairs 10 HP.' },
    ],
  },
  {
    id: 'void_sermon', title: 'The Preacher', negative: true,
    text: 'A preacher claims the void is a mercy. Some passengers want to walk into it.',
    options: [
      { label: 'Let the medics talk to them', desc: 'Requires a Medical Car. Morale +5.', requires: { car: 'medical' } },
      { label: 'Lock the doors at night', desc: 'Morale -6. No one leaves.' },
      { label: 'Let them go', desc: 'Lose 5 passengers. Morale +2 among the rest.' },
    ],
  },
];

/** Events triggered by arriving at special nodes (never scheduled randomly). */
export const NODE_EVENTS: PassengerEventDef[] = [
  {
    id: 'node_shrine', title: 'The Rail Shrine', negative: false,
    text: 'An old shrine to the line-layers stands by the track. Offerings glitter in the ash. The crew waits for your word.',
    options: [
      { label: 'Bless the boiler', desc: 'Locomotive Boiler pressure +1 level (permanent power).' },
      { label: 'Anoint the couplings', desc: 'Every car repairs 40 HP and sheds its heat.' },
      { label: 'Offer 10 scrap', desc: '-10 scrap, +25 rails.', requires: { resource: 'scrap', amount: 10 } },
      { label: 'Leave it be', desc: 'Nothing happens. Morale +3.' },
    ],
  },
  {
    id: 'node_market', title: 'Trackside Market', negative: false,
    text: 'Traders have set up stalls on the platform. Prices are steep, but they have what the line does not.',
    options: [
      { label: 'Buy rails', desc: '-12 scrap, +10 rails.', requires: { resource: 'scrap', amount: 12 } },
      { label: 'Buy ammunition', desc: '-8 food, +30 ammo.', requires: { resource: 'food', amount: 8 } },
      { label: 'Sell ammunition', desc: '-25 ammo, +18 scrap.', requires: { resource: 'ammo', amount: 25 } },
      { label: 'Just browse', desc: 'Morale +2.' },
    ],
  },
  {
    id: 'node_wreck', title: 'The Wreck', negative: false,
    text: 'A derailed convoy lies rusting beside the line. One car looks salvageable if the crew can drag it onto the rails.',
    options: [
      { label: 'Salvage the car', desc: 'Couple a random tier-1 car if there is room (75%); otherwise +15 scrap.' },
      { label: 'Strip it for parts', desc: '+20 scrap, +10 ammo.' },
      { label: 'Search the cabins', desc: '+8 food, 50% chance of a mechanic; small chance of raiders nearby.' },
    ],
  },
];

export function eventById(id: string): PassengerEventDef | undefined {
  const n = NODE_EVENTS.find(e => e.id === id);
  if (n) return n;
  return PASSENGER_EVENTS.find(e => e.id === id);
}
