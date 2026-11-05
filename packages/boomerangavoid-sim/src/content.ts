import type { Arena, CharacterId, UpgradeId, Vec } from './types';
export interface CharacterDefinition {
  id: CharacterId;
  name: string;
  color: number;
  description: string;
}
export const CHARACTERS: CharacterDefinition[] = [
  {
    id: 'pip',
    name: 'Pip',
    color: 0x91ce68,
    description: 'A curious moss pebble',
  },
  {
    id: 'kiln',
    name: 'Kiln',
    color: 0xef986b,
    description: 'A little ceramic guardian',
  },
  {
    id: 'volt',
    name: 'Volt',
    color: 0xf3d75c,
    description: 'A wind-up firefly',
  },
  {
    id: 'nori',
    name: 'Nori',
    color: 0x67d7bc,
    description: 'A folded leaf adventurer',
  },
  {
    id: 'cairn',
    name: 'Cairn',
    color: 0xa6adf3,
    description: 'A cheerful stack of stones',
  },
  {
    id: 'comet',
    name: 'Comet',
    color: 0xf29eca,
    description: 'A soft wandering starseed',
  },
];
export interface UpgradeDefinition {
  id: UpgradeId;
  name: string;
  description: string;
  color: number;
  compatible: UpgradeId[];
}
const upgradeIds: UpgradeId[] = [
  'guard',
  'twin',
  'skipstone',
  'tailwind',
  'frost',
  'ember',
  'echo',
  'magnet',
];
export const UPGRADES: UpgradeDefinition[] = [
  {
    id: 'guard',
    name: 'Guard Shell',
    description: 'Absorbs one hit; coincident hits share a brief grace period.',
    color: 0x99dff5,
  },
  {
    id: 'twin',
    name: 'Twin Arc',
    description: 'Two returning weapons released as one narrow paired volley.',
    color: 0xf5dc88,
  },
  {
    id: 'skipstone',
    name: 'Skipstone',
    description: 'One wall ricochet per flight.',
    color: 0xb0b9ce,
  },
  {
    id: 'tailwind',
    name: 'Tailwind',
    description: 'Faster returning weapons.',
    color: 0x8fe4cc,
  },
  {
    id: 'frost',
    name: 'Frost Wake',
    description: 'Flying weapons leave short slowing patches.',
    color: 0xa4e9ff,
  },
  {
    id: 'ember',
    name: 'Ember Fuse',
    description: 'A grounded weapon leaves a warned delayed burst.',
    color: 0xff9c6d,
  },
  {
    id: 'echo',
    name: 'Echo Step',
    description: 'Dashing leaves a harmless fading decoy.',
    color: 0xc6acff,
  },
  {
    id: 'magnet',
    name: 'Magnet Bloom',
    description: 'A wider safe returning catch radius.',
    color: 0xe8a6d9,
  },
].map((u) => ({
  ...u,
  compatible: upgradeIds.filter((id) => id !== u.id),
})) as UpgradeDefinition[];
const spawns: Vec[] = [
  { x: -8, y: -5 },
  { x: 8, y: 5 },
  { x: -8, y: 5 },
  { x: 8, y: -5 },
  { x: 0, y: -6 },
  { x: 0, y: 6 },
];
const base = (
  id: string,
  name: string,
  subtitle: string,
  color: number,
): Arena => ({
  id,
  name,
  subtitle,
  color,
  ground: 0x283d41,
  sky: 0x131d32,
  width: 22,
  height: 17,
  spawns: spawns.map((p) => ({ ...p })),
  obstacles: [],
  hazards: [],
  targets: [
    { x: -7, y: 0 },
    { x: 7, y: 0 },
  ],
});
const moss = base(
  'moss-court',
  'Moss Court',
  'Open lanes and four mossy cover islands',
  0x8fc697,
);
moss.obstacles = [
  [-3, -2],
  [3, 2],
  [-3, 3],
  [3, -3],
].map(([x, y], i) => ({
  id: `moss-${i}`,
  x,
  y,
  w: 1.5,
  h: 1.5,
  height: 1,
  kind: 'stone',
}));
const kiln = base(
  'kiln-courtyard',
  'Kiln Courtyard',
  'Watch the pressure vents before they glow',
  0xe7a379,
);
kiln.ground = 0x574046;
kiln.obstacles = [
  { id: 'kiln-a', x: -4, y: 0, w: 1.5, h: 3, height: 1.5, kind: 'kiln' },
  { id: 'kiln-b', x: 4, y: 0, w: 1.5, h: 3, height: 1.5, kind: 'kiln' },
];
kiln.hazards = [-2.8, 0, 2.8].map((y, i) => ({
  id: `vent-${i}`,
  x: 0,
  y,
  w: 2.1,
  h: 1.5,
  kind: 'vent',
  angle: 0,
  period: 240,
  active: 55,
  offset: i * 70,
}));
const tide = base(
  'tideglass-steps',
  'Tideglass Steps',
  'Dash the gaps or take the outer route',
  0x73c8d2,
);
tide.ground = 0x294d60;
tide.hazards = [
  {
    id: 'gap-a',
    x: -3,
    y: 0,
    w: 1.1,
    h: 8,
    kind: 'gap',
    angle: 0,
    period: 1,
    active: 1,
    offset: 0,
  },
  {
    id: 'gap-b',
    x: 3,
    y: 0,
    w: 1.1,
    h: 8,
    kind: 'gap',
    angle: 0,
    period: 1,
    active: 1,
    offset: 0,
  },
  {
    id: 'bridge-a',
    x: -3,
    y: 0,
    w: 1.1,
    h: 2,
    kind: 'shutter',
    angle: 0,
    period: 240,
    active: 80,
    offset: 0,
  },
  {
    id: 'bridge-b',
    x: 3,
    y: 0,
    w: 1.1,
    h: 2,
    kind: 'shutter',
    angle: 0,
    period: 240,
    active: 80,
    offset: 120,
  },
];
const wind = base(
  'windbell-garden',
  'Windbell Garden',
  'Visible crosswinds bend flying weapons',
  0xa8d892,
);
wind.obstacles = [
  { id: 'bell-a', x: 0, y: -3, w: 2, h: 1, height: 1.2, kind: 'hedge' },
  { id: 'bell-b', x: 0, y: 3, w: 2, h: 1, height: 1.2, kind: 'hedge' },
];
wind.hazards = [
  {
    id: 'wind-west',
    x: -4,
    y: 0,
    w: 2,
    h: 12,
    kind: 'wind',
    angle: Math.PI / 2,
    period: 1,
    active: 1,
    offset: 0,
  },
  {
    id: 'wind-east',
    x: 4,
    y: 0,
    w: 2,
    h: 12,
    kind: 'wind',
    angle: -Math.PI / 2,
    period: 1,
    active: 1,
    offset: 0,
  },
];
const moon = base(
  'moonwell',
  'Moonwell',
  'Paired gates turn a throw into a surprise',
  0xb29bde,
);
moon.ground = 0x363858;
moon.obstacles = [
  { id: 'well', x: 0, y: -3, w: 2, h: 2, height: 0.8, kind: 'pillar' },
];
moon.hazards = [
  {
    id: 'gate-a',
    x: -5,
    y: -2,
    w: 1,
    h: 1,
    kind: 'gate',
    angle: 0,
    period: 1,
    active: 1,
    offset: 0,
    pair: 'gate-b',
  },
  {
    id: 'gate-b',
    x: 5,
    y: 2,
    w: 1,
    h: 1,
    kind: 'gate',
    angle: Math.PI / 2,
    period: 1,
    active: 1,
    offset: 0,
    pair: 'gate-a',
  },
];
const foundry = base(
  'lantern-foundry',
  'Lantern Foundry',
  'Conveyors and warned moving shutters',
  0xe2bd6b,
);
foundry.ground = 0x4d4146;
foundry.hazards = [
  {
    id: 'belt-north',
    x: 0,
    y: -2,
    w: 12,
    h: 1.5,
    kind: 'conveyor',
    angle: 0,
    period: 1,
    active: 1,
    offset: 0,
  },
  {
    id: 'belt-south',
    x: 0,
    y: 2,
    w: 12,
    h: 1.5,
    kind: 'conveyor',
    angle: Math.PI,
    period: 1,
    active: 1,
    offset: 0,
  },
  {
    id: 'shutter-west',
    x: -4,
    y: 0,
    w: 0.6,
    h: 3,
    kind: 'shutter',
    angle: 0,
    period: 300,
    active: 90,
    offset: 0,
  },
  {
    id: 'shutter-east',
    x: 4,
    y: 0,
    w: 0.6,
    h: 3,
    kind: 'shutter',
    angle: 0,
    period: 300,
    active: 90,
    offset: 150,
  },
];
export const ARENAS: Arena[] = [moss, kiln, tide, wind, moon, foundry];
