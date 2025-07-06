export interface GameScore {
    id: string;
    userId: string;
    gameKey: string;
    score: number;
    metadata?: any;
    achievedAt: string;
    username: string;
    userAvatar?: string;
}
export interface GlobalScore {
    userId: string;
    username: string;
    userAvatar?: string;
    totalScore: number;
    gamesPlayed: number;
    averageScore: number;
    bestGame: string;
    bestGameScore: number;
    gameScores: {
        [gameKey: string]: number;
    };
    rank: number;
    lastUpdated: string;
}
export interface LeaderboardConfig {
    gameKey: string;
    displayName: string;
    scoreType: 'high' | 'low' | 'time';
    scoreUnit?: string;
    maxEntries: number;
    isActive: boolean;
}
export declare class UnifiedLeaderboardSystem {
    private static instance;
    private supabase;
    private leaderboardConfigs;
    private listeners;
    private cache;
    private constructor();
    static getInstance(): UnifiedLeaderboardSystem;
    setSupabaseClient(supabase: any): void;
    private setupLeaderboardConfigs;
    submitScore(userId: string, gameKey: string, score: number, metadata?: any): Promise<{
        success: boolean;
        rank?: number;
        error?: string;
    }>;
    getGameLeaderboard(gameKey: string, limit?: number, offset?: number): Promise<{
        success: boolean;
        data?: GameScore[];
        error?: string;
    }>;
    getGlobalLeaderboard(limit?: number, offset?: number): Promise<{
        success: boolean;
        data?: GlobalScore[];
        error?: string;
    }>;
    getUserRank(userId: string, gameKey?: string): Promise<{
        success: boolean;
        rank?: number;
        error?: string;
    }>;
    private calculateRank;
    private updateGlobalLeaderboard;
    private updateGlobalRanks;
    addGame(config: LeaderboardConfig): void;
    getGameConfig(gameKey: string): LeaderboardConfig | null;
    getAllGameConfigs(): LeaderboardConfig[];
    private setCache;
    private getFromCache;
    private invalidateCache;
    on(event: string, callback: Function): void;
    off(event: string, callback: Function): void;
    private emit;
}
export declare const unifiedLeaderboard: UnifiedLeaderboardSystem;
export default unifiedLeaderboard;
