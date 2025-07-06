export declare const buildAssetUrl: (bucket: string, path: string) => string;
export declare const gameAssets: {
    readonly logos: {
        readonly voidavoid: string;
        readonly tankavoid: string;
        readonly wreckavoid: string;
    };
    readonly heroes: {
        readonly main: string;
    };
    readonly icons: {
        readonly favicon: string;
    };
};
export declare const gameAudio: {
    readonly music: {
        readonly voidavoid: {
            readonly ambient: string;
        };
        readonly tankavoid: {
            readonly background: string;
            readonly battle: string;
        };
        readonly wreckavoid: {
            readonly background: string;
            readonly destruction: string;
        };
    };
    readonly sfx: {
        readonly explosion: string;
        readonly hit: string;
        readonly powerup: string;
    };
};
export declare const gameVideos: {
    readonly previews: {
        readonly voidavoid: string;
        readonly tankavoid: string;
        readonly wreckavoid: string;
    };
    readonly tutorials: {
        readonly howToPlay: string;
    };
};
export declare const fallbackAssets: {
    readonly logos: {
        readonly voidavoid: "/VoidaVOID.png";
        readonly tankavoid: "/Tank aVOID Logo Design.png";
        readonly wreckavoid: "/WreckAVOID.png";
    };
    readonly heroes: {
        readonly main: "/AVOIDhero.png";
    };
    readonly icons: {
        readonly favicon: "/vite.svg";
    };
};
export declare const getAssetUrl: (category: "logos" | "heroes" | "icons", asset: string, useFallback?: boolean) => string;
export type GameAssetCategory = keyof typeof gameAssets;
export type GameAudioCategory = keyof typeof gameAudio;
export type GameVideoCategory = keyof typeof gameVideos;
