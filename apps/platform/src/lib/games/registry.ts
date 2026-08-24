export const rankedGameRegistry = {
  voidavoid: {
    name: 'VOIDaVOID',
    allowedOrigins: ['https://avoidgame.io'],
    maxScore: 2_000_000_000,
    trust: 'provisional',
  },
  wreckavoid: {
    name: 'WreckaVOID',
    allowedOrigins: ['https://avoidgame.io'],
    maxScore: 2_000_000_000,
    trust: 'provisional',
  },
  wordavoid: {
    name: 'WORDaVOID',
    allowedOrigins: ['https://avoidgame.io'],
    maxScore: 2_000_000_000,
    trust: 'provisional',
  },
  tankavoid: {
    name: 'TankaVOID',
    allowedOrigins: ['https://avoidgame.io'],
    maxScore: 5_770,
    trust: 'provisional',
  },
} as const

export type RankedGameKey = keyof typeof rankedGameRegistry

export function isRankedGameKey(value: unknown): value is RankedGameKey {
  return typeof value === 'string' && value in rankedGameRegistry
}
