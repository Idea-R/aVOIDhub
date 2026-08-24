export const rankedGameRegistry = {
  voidavoid: {
    name: 'VOIDaVOID',
    allowedOrigins: ['https://avoidgame.io'],
    maxScore: 2_000_000_000,
    trust: 'provisional',
    modes: [{ key: 'endless', label: 'Endless' }],
  },
  wreckavoid: {
    name: 'WreckaVOID',
    allowedOrigins: ['https://avoidgame.io'],
    maxScore: 2_000_000_000,
    trust: 'provisional',
    modes: [{ key: 'wreck-run', label: 'Survival' }],
  },
  wordavoid: {
    name: 'WORDaVOID',
    allowedOrigins: ['https://avoidgame.io'],
    maxScore: 2_000_000_000,
    trust: 'provisional',
    modes: [
      { key: 'classic', label: 'Classic' },
      { key: 'timeAttack', label: 'Time attack' },
    ],
  },
  tankavoid: {
    name: 'TankaVOID',
    allowedOrigins: ['https://avoidgame.io'],
    maxScore: 5_770,
    trust: 'provisional',
    modes: [{ key: 'five-wave', label: 'Five waves' }],
  },
} as const

export type RankedGameKey = keyof typeof rankedGameRegistry

export function isRankedGameKey(value: unknown): value is RankedGameKey {
  return typeof value === 'string' && value in rankedGameRegistry
}
