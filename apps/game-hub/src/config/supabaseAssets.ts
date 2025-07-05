// Supabase Storage Asset Configuration
// Base URL for your Supabase project storage
const SUPABASE_PROJECT_REF = 'jyuafqzjrzifqbgcqbnt'
const STORAGE_BASE_URL = `https://${SUPABASE_PROJECT_REF}.supabase.co/storage/v1/object/public`

// Asset URL builders
export const buildAssetUrl = (bucket: string, path: string): string => {
  return `${STORAGE_BASE_URL}/${bucket}/${path}`
}

// Game Assets
export const gameAssets = {
  logos: {
    voidavoid: buildAssetUrl('game-assets', 'logos/voidavoid.png'),
    tankavoid: buildAssetUrl('game-assets', 'logos/tankavoid.png'),
    wreckavoid: buildAssetUrl('game-assets', 'logos/wreckavoid.png'),
    wordavoid: buildAssetUrl('game-assets', 'logos/wordavoid.png'),
  },
  heroes: {
    main: buildAssetUrl('game-assets', 'heroes/avoid-hero.png'),
  },
  icons: {
    favicon: buildAssetUrl('game-assets', 'icons/favicon.ico'),
  },
} as const

// Game Audio Assets
export const gameAudio = {
  music: {
    voidavoid: {
      ambient: buildAssetUrl('game-audio', 'music/voidavoid/ambient.mp3'),
    },
    tankavoid: {
      background: buildAssetUrl('game-audio', 'music/tankavoid/background.mp3'),
      battle: buildAssetUrl('game-audio', 'music/tankavoid/battle.mp3'),
    },
    wreckavoid: {
      background: buildAssetUrl('game-audio', 'music/wreckavoid/background.mp3'),
      destruction: buildAssetUrl('game-audio', 'music/wreckavoid/destruction.mp3'),
    },
    wordavoid: {
      background: buildAssetUrl('game-audio', 'music/wordavoid/background.mp3'),
      typing: buildAssetUrl('game-audio', 'music/wordavoid/typing.mp3'),
    },
  },
  sfx: {
    explosion: buildAssetUrl('game-audio', 'sfx/explosion.wav'),
    hit: buildAssetUrl('game-audio', 'sfx/hit.wav'),
    powerup: buildAssetUrl('game-audio', 'sfx/powerup.wav'),
  },
} as const

// Game Video Assets
export const gameVideos = {
  previews: {
    voidavoid: buildAssetUrl('game-videos', 'previews/voidavoid-preview.mp4'),
    tankavoid: buildAssetUrl('game-videos', 'previews/tankavoid-preview.mp4'),
    wreckavoid: buildAssetUrl('game-videos', 'previews/wreckavoid-preview.mp4'),
    wordavoid: buildAssetUrl('game-videos', 'previews/wordavoid-preview.mp4'),
  },
  tutorials: {
    howToPlay: buildAssetUrl('game-videos', 'tutorials/how-to-play.mp4'),
  },
} as const

// Fallback assets (local backups)
export const fallbackAssets = {
  logos: {
    voidavoid: '/VOIDaVOIDmain.png',
    tankavoid: '/Tank aVOID Logo Design.png',
    wreckavoid: '/WreckAVOID.png',
    wordavoid: '/wordavoid-logo.png',
  },
  heroes: {
    main: '/AVOIDhero.png',
  },
  icons: {
    favicon: '/vite.svg',
  },
} as const

// Asset loading with fallback
export const getAssetUrl = (
  category: 'logos' | 'heroes' | 'icons',
  asset: string,
  useFallback: boolean = false
): string => {
  if (useFallback) {
    return fallbackAssets[category]?.[asset as keyof typeof fallbackAssets[typeof category]] || ''
  }
  return gameAssets[category]?.[asset as keyof typeof gameAssets[typeof category]] || ''
}

// Export types for better TypeScript support
export type GameAssetCategory = keyof typeof gameAssets
export type GameAudioCategory = keyof typeof gameAudio
export type GameVideoCategory = keyof typeof gameVideos 