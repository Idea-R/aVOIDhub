import { User, Session } from '@supabase/supabase-js';
export interface UnifiedUser {
    id: string;
    email: string | null;
    username: string | null;
    avatar_url: string | null;
    created_at: string;
    last_sign_in_at: string | null;
    voidavoid_best_score?: number;
    wreckavoid_best_score?: number;
    tankavoid_best_score?: number;
    total_games_played: number;
    total_time_played: number;
    favorite_game?: string;
    achievements: string[];
}
export interface GameSession {
    user: UnifiedUser;
    session: Session;
    currentGame: string;
    isAuthenticated: boolean;
}
export declare class UnifiedAuthService {
    private supabase;
    private currentSession;
    private authListeners;
    private readonly STORAGE_KEY;
    constructor();
    private initializeAuth;
    private getCurrentGame;
    private getOrCreateUnifiedUser;
    private updateLastSignIn;
    private trackGameSession;
    private storeSessionData;
    private clearSessionData;
    signUp(email: string, password: string, username?: string): Promise<{
        success: boolean;
        data: {
            user: User | null;
            session: Session | null;
        };
        error?: undefined;
    } | {
        success: boolean;
        error: string;
        data?: undefined;
    }>;
    signIn(email: string, password: string): Promise<{
        success: boolean;
        data: {
            user: User;
            session: Session;
            weakPassword?: import("@supabase/auth-js").WeakPassword;
        };
        error?: undefined;
    } | {
        success: boolean;
        error: string;
        data?: undefined;
    }>;
    signOut(): Promise<{
        success: boolean;
        error?: undefined;
    } | {
        success: boolean;
        error: string;
    }>;
    signInWithGoogle(): Promise<{
        success: boolean;
        data: {
            provider: import("@supabase/auth-js").Provider;
            url: string;
        };
        error?: undefined;
    } | {
        success: boolean;
        error: string;
        data?: undefined;
    }>;
    updateGameScore(game: string, score: number): Promise<{
        success: boolean;
        error: string;
    } | {
        success: boolean;
        error?: undefined;
    }>;
    saveLeaderboardScore(game: string, score: number): Promise<{
        success: boolean;
        error: string;
    } | {
        success: boolean;
        error?: undefined;
    }>;
    getLeaderboard(game: string, limit?: number): Promise<{
        success: boolean;
        data: any[];
        error?: undefined;
    } | {
        success: boolean;
        error: string;
        data: never[];
    }>;
    getCurrentSession(): GameSession | null;
    isAuthenticated(): boolean;
    onAuthStateChange(callback: (session: GameSession | null) => void): () => void;
    switchGame(gameKey: string): Promise<void>;
}
export declare const unifiedAuth: UnifiedAuthService;
export default unifiedAuth;
