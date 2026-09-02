/** Render palette. All colors as 0xRRGGBB numbers. */
import type { Terrain, SettlementType, ResourceKey } from '../core/types';

export const BG_COLOR = 0x0b0e1a;
export const BG_CSS = '#0b0e1a';

export const TERRAIN_COLORS: Record<Terrain, number> = {
  plains: 0x5f8f5a,
  forest: 0x3f6f46,
  hills: 0x8a7a5a,
  mountain: 0x6b6b70,
  water: 0x3d6f9a,
  ruins: 0x7a6f6a,
  ash: 0x6d6a75,
  crystal: 0x5d5aa0,
};

export const VOID_FILL = 0x0a0614;
export const VOID_RIM = 0x6d5fd6;
export const VOID_RIM_BRIGHT = 0xa79cff;

export const TRACK_RAIL = 0x8a8f9a;
export const TRACK_RAIL_DARK = 0x2a2f3a;
export const TRACK_RAIL_GAP = 0x3a3f4a;
export const TRACK_BUILT = 0xf1dfae;
export const TRACK_BUILT_EDGE = 0x6a5228;
export const TRACK_PLANNED = 0x6fb7e8;
export const TRACK_PLANNED_FREE = 0x8fe0a0;
export const TRACK_TRAVERSED = 0x0b0e1a;
export const JUNCTION_RING = 0xf4f6fb;

export const SETTLEMENT_COLORS: Record<SettlementType, number> = {
  start: 0xe8c170,
  village: 0x6fbf73,
  depot: 0xc9c9c9,
  mine: 0xc98a4b,
  farm: 0xd9d15a,
  fuel: 0x4a4a52,
  clinic: 0xf5f5f5,
  armory: 0xe86f6f,
  yard: 0x6fb7e8,
  terminus: 0xb98fe8,
};

export const RESOURCE_COLORS: Record<ResourceKey, number> = {
  rails: 0xe8c170,
  scrap: 0xc98a4b,
  coal: 0x9a9aa8,
  ammo: 0xe86f6f,
  food: 0x9fd85a,
};

export const UI_TEXT = '#e6e9f2';
export const UI_TEXT_DIM = '#8fa1c7';
export const ACCENT = 0xe8c170;
export const DANGER = 0xe86f6f;
export const GOOD = 0x6fbf73;
export const INFO = 0x6fb7e8;
export const WHITE = 0xffffff;

export const FONT = "'Segoe UI', system-ui, -apple-system, Roboto, sans-serif";
export const FONT_MONO = "'Cascadia Mono', 'Consolas', 'Menlo', monospace";
