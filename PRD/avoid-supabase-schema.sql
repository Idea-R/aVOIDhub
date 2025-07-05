-- aVOID Games Supabase Database Schema
-- Complete setup for multi-game platform with social features

-- Enable required extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pg_trgm"; -- For text search

-- Custom types
CREATE TYPE user_role AS ENUM ('player', 'developer', 'moderator', 'admin');
CREATE TYPE subscription_tier AS ENUM ('free', 'pro', 'premium', 'developer');
CREATE TYPE game_status AS ENUM ('pending', 'approved', 'featured', 'disabled');
CREATE TYPE social_platform AS ENUM ('twitter', 'youtube', 'twitch', 'instagram', 'tiktok', 'linkedin', 'github', 'discord', 'facebook', 'reddit', 'steam');

-- Users table (extends Supabase auth.users)
CREATE TABLE public.profiles (
    id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
    username VARCHAR(30) UNIQUE NOT NULL CHECK (username ~ '^[a-zA-Z0-9_]+$'),
    display_name VARCHAR(50) NOT NULL,
    bio TEXT CHECK (LENGTH(bio) <= 500),
    quote VARCHAR(200),
    avatar_url VARCHAR(500),
    banner_url VARCHAR(500),
    country_code CHAR(2),
    
    -- Subscription info
    subscription_tier subscription_tier DEFAULT 'free',
    subscription_expires_at TIMESTAMP WITH TIME ZONE,
    lifetime_revenue DECIMAL(10,2) DEFAULT 0,
    
    -- Stats
    global_score BIGINT DEFAULT 0,
    total_play_time INTEGER DEFAULT 0,
    games_played INTEGER DEFAULT 0,
    achievements_unlocked INTEGER DEFAULT 0,
    
    -- Customization
    theme_color VARCHAR(7) DEFAULT '#0080ff',
    profile_style JSONB DEFAULT '{}',
    character_customization JSONB DEFAULT '{}',
    
    -- Settings
    email_notifications BOOLEAN DEFAULT TRUE,
    show_ads BOOLEAN DEFAULT TRUE,
    profile_visibility VARCHAR(20) DEFAULT 'public', -- public, friends, private
    
    -- Metadata
    role user_role DEFAULT 'player',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    last_active_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    is_verified BOOLEAN DEFAULT FALSE,
    is_banned BOOLEAN DEFAULT FALSE,
    ban_reason TEXT,
    ban_expires_at TIMESTAMP WITH TIME ZONE
);

-- Social links table
CREATE TABLE public.social_links (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    platform social_platform NOT NULL,
    url VARCHAR(500) NOT NULL,
    display_order INTEGER DEFAULT 0,
    is_verified BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE(user_id, platform)
);

-- Games table (both official and user-submitted)
CREATE TABLE public.games (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    game_key VARCHAR(50) UNIQUE NOT NULL,
    name VARCHAR(100) NOT NULL,
    description TEXT,
    short_description VARCHAR(200),
    
    -- URLs
    icon_url VARCHAR(500),
    banner_url VARCHAR(500),
    thumbnail_url VARCHAR(500),
    play_url VARCHAR(500) NOT NULL,
    repo_url VARCHAR(500),
    
    -- Developer info
    developer_id UUID REFERENCES public.profiles(id),
    organization_name VARCHAR(100),
    
    -- Game metadata
    category VARCHAR(50),
    tags TEXT[],
    min_players INTEGER DEFAULT 1,
    max_players INTEGER DEFAULT 1,
    
    -- Platform requirements
    is_mobile_friendly BOOLEAN DEFAULT TRUE,
    required_features TEXT[],
    
    -- Status and monetization
    status game_status DEFAULT 'pending',
    is_featured BOOLEAN DEFAULT FALSE,
    revenue_share DECIMAL(3,2) DEFAULT 0.70, -- Developer gets 70%
    has_ads BOOLEAN DEFAULT TRUE,
    
    -- Stats
    total_players INTEGER DEFAULT 0,
    total_sessions INTEGER DEFAULT 0,
    average_session_time INTEGER DEFAULT 0,
    rating DECIMAL(3,2) DEFAULT 0,
    rating_count INTEGER DEFAULT 0,
    
    -- Timestamps
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    approved_at TIMESTAMP WITH TIME ZONE,
    featured_at TIMESTAMP WITH TIME ZONE,
    
    -- Settings
    settings JSONB DEFAULT '{}'
);

-- Leaderboards configuration
CREATE TABLE public.leaderboards (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    game_id UUID NOT NULL REFERENCES public.games(id) ON DELETE CASCADE,
    leaderboard_key VARCHAR(50) NOT NULL,
    name VARCHAR(100) NOT NULL,
    description TEXT,
    
    -- Configuration
    score_type VARCHAR(20) DEFAULT 'numeric', -- numeric, time, custom
    sort_order VARCHAR(4) DEFAULT 'DESC',
    decimal_places INTEGER DEFAULT 0,
    
    -- Reset schedule
    reset_schedule VARCHAR(20), -- daily, weekly, monthly, never
    last_reset_at TIMESTAMP WITH TIME ZONE,
    next_reset_at TIMESTAMP WITH TIME ZONE,
    
    -- Display settings
    display_format VARCHAR(50), -- score, time, percentage
    show_top_count INTEGER DEFAULT 100,
    
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    
    UNIQUE(game_id, leaderboard_key)
);

-- Scores table
CREATE TABLE public.scores (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    game_id UUID NOT NULL REFERENCES public.games(id) ON DELETE CASCADE,
    leaderboard_id UUID NOT NULL REFERENCES public.leaderboards(id) ON DELETE CASCADE,
    
    score NUMERIC NOT NULL,
    metadata JSONB DEFAULT '{}',
    replay_data JSONB,
    
    -- Anti-cheat
    is_verified BOOLEAN DEFAULT TRUE,
    verification_data JSONB,
    flagged_at TIMESTAMP WITH TIME ZONE,
    flagged_reason TEXT,
    
    achieved_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    
    -- Indexes for performance
    INDEX idx_leaderboard_scores (leaderboard_id, score DESC),
    INDEX idx_user_game_scores (user_id, game_id),
    INDEX idx_achieved_at (achieved_at)
);

-- Global leaderboard view
CREATE OR REPLACE VIEW global_leaderboard AS
SELECT 
    p.id as user_id,
    p.username,
    p.display_name,
    p.avatar_url,
    p.country_code,
    p.global_score,
    p.games_played,
    p.achievements_unlocked,
    p.subscription_tier,
    RANK() OVER (ORDER BY p.global_score DESC) as global_rank
FROM public.profiles p
WHERE p.is_banned = FALSE
ORDER BY p.global_score DESC;

-- Achievements system
CREATE TABLE public.achievements (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    game_id UUID NOT NULL REFERENCES public.games(id) ON DELETE CASCADE,
    achievement_key VARCHAR(50) NOT NULL,
    name VARCHAR(100) NOT NULL,
    description TEXT,
    icon_url VARCHAR(500),
    
    -- Achievement data
    points INTEGER DEFAULT 10,
    rarity VARCHAR(20) DEFAULT 'common', -- common, rare, epic, legendary
    category VARCHAR(50),
    
    -- Requirements
    requirements JSONB DEFAULT '{}',
    is_hidden BOOLEAN DEFAULT FALSE,
    
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE(game_id, achievement_key)
);

-- User achievements
CREATE TABLE public.user_achievements (
    user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    achievement_id UUID NOT NULL REFERENCES public.achievements(id) ON DELETE CASCADE,
    unlocked_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    progress JSONB DEFAULT '{}',
    PRIMARY KEY (user_id, achievement_id)
);

-- Subscriptions and payments
CREATE TABLE public.subscriptions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    tier subscription_tier NOT NULL,
    
    -- Stripe/payment data
    stripe_subscription_id VARCHAR(255) UNIQUE,
    stripe_customer_id VARCHAR(255),
    
    -- Subscription details
    amount DECIMAL(10,2) NOT NULL,
    currency VARCHAR(3) DEFAULT 'USD',
    interval VARCHAR(20) NOT NULL, -- monthly, yearly
    
    -- Status
    status VARCHAR(20) NOT NULL, -- active, canceled, past_due
    current_period_start TIMESTAMP WITH TIME ZONE NOT NULL,
    current_period_end TIMESTAMP WITH TIME ZONE NOT NULL,
    canceled_at TIMESTAMP WITH TIME ZONE,
    
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Ad impressions tracking
CREATE TABLE public.ad_impressions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
    game_id UUID REFERENCES public.games(id) ON DELETE CASCADE,
    
    ad_type VARCHAR(50) NOT NULL, -- banner, interstitial, rewarded
    ad_provider VARCHAR(50),
    revenue DECIMAL(10,4) DEFAULT 0,
    
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    
    -- Index for analytics
    INDEX idx_ad_impressions_date (created_at)
);

-- Developer dashboard data
CREATE TABLE public.developer_stats (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    game_id UUID NOT NULL REFERENCES public.games(id) ON DELETE CASCADE,
    date DATE NOT NULL,
    
    -- Daily stats
    unique_players INTEGER DEFAULT 0,
    total_sessions INTEGER DEFAULT 0,
    total_playtime INTEGER DEFAULT 0, -- in seconds
    new_players INTEGER DEFAULT 0,
    
    -- Revenue
    ad_revenue DECIMAL(10,2) DEFAULT 0,
    iap_revenue DECIMAL(10,2) DEFAULT 0,
    total_revenue DECIMAL(10,2) DEFAULT 0,
    
    -- Engagement
    average_session_time INTEGER DEFAULT 0,
    retention_day1 DECIMAL(5,2),
    retention_day7 DECIMAL(5,2),
    retention_day30 DECIMAL(5,2),
    
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE(game_id, date)
);

-- Friends system
CREATE TABLE public.friendships (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    friend_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    status VARCHAR(20) DEFAULT 'pending', -- pending, accepted, blocked
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    accepted_at TIMESTAMP WITH TIME ZONE,
    
    UNIQUE(user_id, friend_id),
    CHECK (user_id != friend_id)
);

-- Chat/messaging (for future social features)
CREATE TABLE public.messages (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    sender_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    recipient_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    content TEXT NOT NULL CHECK (LENGTH(content) <= 1000),
    is_read BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    
    INDEX idx_messages_recipient (recipient_id, created_at DESC)
);

-- Tournaments/events
CREATE TABLE public.tournaments (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    game_id UUID NOT NULL REFERENCES public.games(id) ON DELETE CASCADE,
    name VARCHAR(100) NOT NULL,
    description TEXT,
    
    -- Tournament config
    start_date TIMESTAMP WITH TIME ZONE NOT NULL,
    end_date TIMESTAMP WITH TIME ZONE NOT NULL,
    entry_fee DECIMAL(10,2) DEFAULT 0,
    prize_pool DECIMAL(10,2) DEFAULT 0,
    max_participants INTEGER,
    
    -- Status
    status VARCHAR(20) DEFAULT 'upcoming', -- upcoming, active, completed
    
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    created_by UUID REFERENCES public.profiles(id)
);

-- Row Level Security Policies
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.social_links ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.games ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.scores ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.friendships ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.messages ENABLE ROW LEVEL SECURITY;

-- Profiles policies
CREATE POLICY "Public profiles are viewable by everyone" 
    ON public.profiles FOR SELECT 
    USING (true);

CREATE POLICY "Users can update own profile" 
    ON public.profiles FOR UPDATE 
    USING (auth.uid() = id);

-- Social links policies
CREATE POLICY "Social links are viewable by everyone" 
    ON public.social_links FOR SELECT 
    USING (true);

CREATE POLICY "Users can manage own social links" 
    ON public.social_links FOR ALL 
    USING (auth.uid() = user_id);

-- Games policies
CREATE POLICY "Games are viewable by everyone" 
    ON public.games FOR SELECT 
    USING (status != 'disabled');

CREATE POLICY "Developers can update own games" 
    ON public.games FOR UPDATE 
    USING (auth.uid() = developer_id);

-- Scores policies
CREATE POLICY "Scores are viewable by everyone" 
    ON public.scores FOR SELECT 
    USING (true);

CREATE POLICY "Users can submit own scores" 
    ON public.scores FOR INSERT 
    USING (auth.uid() = user_id);

-- Functions and triggers
CREATE OR REPLACE FUNCTION update_global_score()
RETURNS TRIGGER AS $$
BEGIN
    -- Update user's global score
    UPDATE public.profiles
    SET global_score = (
        SELECT COALESCE(SUM(s.score), 0)
        FROM public.scores s
        WHERE s.user_id = NEW.user_id
        AND s.is_verified = true
    )
    WHERE id = NEW.user_id;
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_global_score_trigger
AFTER INSERT OR UPDATE ON public.scores
FOR EACH ROW
EXECUTE FUNCTION update_global_score();

-- Update timestamps
CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_profiles_updated_at
BEFORE UPDATE ON public.profiles
FOR EACH ROW
EXECUTE FUNCTION update_updated_at();

CREATE TRIGGER update_games_updated_at
BEFORE UPDATE ON public.games
FOR EACH ROW
EXECUTE FUNCTION update_updated_at();

-- Game stats aggregation
CREATE OR REPLACE FUNCTION update_game_stats()
RETURNS void AS $$
BEGIN
    UPDATE public.games g
    SET 
        total_players = (
            SELECT COUNT(DISTINCT user_id) 
            FROM public.scores 
            WHERE game_id = g.id
        ),
        total_sessions = (
            SELECT COUNT(*) 
            FROM public.scores 
            WHERE game_id = g.id
        );
END;
$$ LANGUAGE plpgsql;

-- Realtime subscriptions
ALTER PUBLICATION supabase_realtime ADD TABLE public.scores;
ALTER PUBLICATION supabase_realtime ADD TABLE public.messages;
ALTER PUBLICATION supabase_realtime ADD TABLE public.friendships;