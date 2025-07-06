// Supabase Storage Asset Configuration
// Base URL for your Supabase project storage
const SUPABASE_PROJECT_REF = 'jyuafqzjrzifqbgcqbnt';
const STORAGE_BASE_URL = `https://${SUPABASE_PROJECT_REF}.supabase.co/storage/v1/object/public`;
// Asset URL builders
export const buildAssetUrl = (bucket, path) => {
    return `${STORAGE_BASE_URL}/${bucket}/${path}`;
};
// Game Assets
export const gameAssets = {
    logos: {
        voidavoid: buildAssetUrl('game-assets', 'logos/voidavoid.png'),
        tankavoid: buildAssetUrl('game-assets', 'logos/tankavoid.png'),
        wreckavoid: buildAssetUrl('game-assets', 'logos/wreckavoid.png'),
    },
    heroes: {
        main: buildAssetUrl('game-assets', 'heroes/avoid-hero.png'),
    },
    icons: {
        favicon: buildAssetUrl('game-assets', 'icons/favicon.ico'),
    },
};
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
    },
    sfx: {
        explosion: buildAssetUrl('game-audio', 'sfx/explosion.wav'),
        hit: buildAssetUrl('game-audio', 'sfx/hit.wav'),
        powerup: buildAssetUrl('game-audio', 'sfx/powerup.wav'),
    },
};
// Game Video Assets
export const gameVideos = {
    previews: {
        voidavoid: buildAssetUrl('game-videos', 'previews/voidavoid-preview.mp4'),
        tankavoid: buildAssetUrl('game-videos', 'previews/tankavoid-preview.mp4'),
        wreckavoid: buildAssetUrl('game-videos', 'previews/wreckavoid-preview.mp4'),
    },
    tutorials: {
        howToPlay: buildAssetUrl('game-videos', 'tutorials/how-to-play.mp4'),
    },
};
// Fallback assets (local backups)
export const fallbackAssets = {
    logos: {
        voidavoid: '/VoidaVOID.png',
        tankavoid: '/Tank aVOID Logo Design.png',
        wreckavoid: '/WreckAVOID.png',
    },
    heroes: {
        main: '/AVOIDhero.png',
    },
    icons: {
        favicon: '/vite.svg',
    },
};
// Asset loading with fallback
export const getAssetUrl = (category, asset, useFallback = false) => {
    if (useFallback) {
        return fallbackAssets[category]?.[asset] || '';
    }
    return gameAssets[category]?.[asset] || '';
};
