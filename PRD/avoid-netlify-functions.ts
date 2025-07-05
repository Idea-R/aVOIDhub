// netlify/edge-functions/api.ts
// Main API edge function for aVOID Games platform

import { Context } from "https://edge.netlify.com";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import jwt from 'https://esm.sh/jsonwebtoken@9';

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
const SUPABASE_SERVICE_KEY = Deno.env.get('SUPABASE_SERVICE_KEY')!;
const JWT_SECRET = Deno.env.get('JWT_SECRET')!;
const STRIPE_SECRET_KEY = Deno.env.get('STRIPE_SECRET_KEY')!;

// Initialize Supabase client with service key for admin operations
const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);

// CORS headers
const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
};

export default async (request: Request, context: Context) => {
  // Handle CORS preflight
  if (request.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  const url = new URL(request.url);
  const path = url.pathname;

  try {
    // Route handlers
    if (path === '/api/validate-score' && request.method === 'POST') {
      return await handleValidateScore(request);
    }
    
    if (path === '/api/process-subscription' && request.method === 'POST') {
      return await handleProcessSubscription(request);
    }
    
    if (path === '/api/game-analytics' && request.method === 'POST') {
      return await handleGameAnalytics(request);
    }
    
    if (path === '/api/admin/approve-game' && request.method === 'POST') {
      return await handleApproveGame(request);
    }
    
    if (path === '/api/leaderboard-reset' && request.method === 'POST') {
      return await handleLeaderboardReset(request);
    }

    return new Response('Not Found', { status: 404, headers: corsHeaders });
  } catch (error) {
    console.error('Edge function error:', error);
    return new Response(
      JSON.stringify({ error: 'Internal server error' }), 
      { 
        status: 500, 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      }
    );
  }
};

// Score validation with anti-cheat
async function handleValidateScore(request: Request) {
  const authHeader = request.headers.get('Authorization');
  if (!authHeader) {
    return new Response('Unauthorized', { status: 401, headers: corsHeaders });
  }

  const body = await request.json();
  const { game_key, score, metadata, replay_data } = body;

  // Verify JWT token
  const token = authHeader.replace('Bearer ', '');
  let userId: string;
  
  try {
    const decoded = jwt.verify(token, JWT_SECRET) as any;
    userId = decoded.sub;
  } catch (error) {
    return new Response('Invalid token', { status: 401, headers: corsHeaders });
  }

  // Get game validation rules
  const { data: game } = await supabase
    .from('games')
    .select('id, settings')
    .eq('game_key', game_key)
    .single();

  if (!game) {
    return new Response('Game not found', { status: 404, headers: corsHeaders });
  }

  // Perform validation
  const validationRules = game.settings?.validation || {};
  let isValid = true;
  let flagReason = null;

  // Check max score
  if (validationRules.max_score && score > validationRules.max_score) {
    isValid = false;
    flagReason = 'Score exceeds maximum';
  }

  // Check score rate
  if (metadata?.time_played && validationRules.max_score_per_minute) {
    const scorePerMinute = score / (metadata.time_played / 60);
    if (scorePerMinute > validationRules.max_score_per_minute) {
      isValid = false;
      flagReason = 'Score rate too high';
    }
  }

  // Check required metadata
  if (validationRules.required_metadata) {
    for (const field of validationRules.required_metadata) {
      if (!metadata?.[field]) {
        isValid = false;
        flagReason = `Missing required field: ${field}`;
        break;
      }
    }
  }

  // Advanced replay validation (if provided)
  if (replay_data && validationRules.replay_validation) {
    // Implement replay validation logic
    // This could include checking movement patterns, timing, etc.
  }

  // Check for impossible patterns
  if (await checkForCheatingPatterns(userId, game.id, score, metadata)) {
    isValid = false;
    flagReason = 'Suspicious activity detected';
  }

  return new Response(
    JSON.stringify({ 
      valid: isValid, 
      flag_reason: flagReason,
      should_save: isValid || validationRules.save_flagged_scores 
    }),
    { 
      status: 200, 
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    }
  );
}

// Check for cheating patterns
async function checkForCheatingPatterns(
  userId: string, 
  gameId: string, 
  score: number, 
  metadata: any
): Promise<boolean> {
  // Get user's recent scores
  const { data: recentScores } = await supabase
    .from('scores')
    .select('score, achieved_at, metadata')
    .eq('user_id', userId)
    .eq('game_id', gameId)
    .order('achieved_at', { ascending: false })
    .limit(10);

  if (!recentScores || recentScores.length < 3) {
    return false; // Not enough data
  }

  // Check for sudden massive improvement
  const avgRecentScore = recentScores.slice(1, 6).reduce((sum, s) => sum + s.score, 0) / 5;
  if (score > avgRecentScore * 5) {
    return true; // 5x improvement is suspicious
  }

  // Check for identical scores
  const identicalScores = recentScores.filter(s => s.score === score).length;
  if (identicalScores > 3) {
    return true; // Too many identical scores
  }

  // Check for rapid submissions
  const timeSinceLastScore = Date.now() - new Date(recentScores[0].achieved_at).getTime();
  if (timeSinceLastScore < 5000) {
    return true; // Less than 5 seconds since last score
  }

  return false;
}

// Process subscription payments
async function handleProcessSubscription(request: Request) {
  const body = await request.json();
  const { user_id, tier, payment_method_id } = body;

  // Initialize Stripe
  const stripe = await initStripe();
  
  try {
    // Get user
    const { data: profile } = await supabase
      .from('profiles')
      .select('stripe_customer_id')
      .eq('id', user_id)
      .single();

    let customerId = profile?.stripe_customer_id;

    // Create customer if doesn't exist
    if (!customerId) {
      const customer = await stripe.customers.create({
        metadata: { user_id }
      });
      customerId = customer.id;

      await supabase
        .from('profiles')
        .update({ stripe_customer_id: customerId })
        .eq('id', user_id);
    }

    // Get price based on tier
    const prices: Record<string, string> = {
      pro: 'price_pro_monthly',
      premium: 'price_premium_monthly',
      developer: 'price_developer_monthly',
    };

    // Create subscription
    const subscription = await stripe.subscriptions.create({
      customer: customerId,
      items: [{ price: prices[tier] }],
      payment_behavior: 'default_incomplete',
      expand: ['latest_invoice.payment_intent'],
    });

    // Save subscription to database
    await supabase
      .from('subscriptions')
      .insert({
        user_id,
        tier,
        stripe_subscription_id: subscription.id,
        status: subscription.status,
        current_period_start: new Date(subscription.current_period_start * 1000),
        current_period_end: new Date(subscription.current_period_end * 1000),
      });

    // Update user profile
    await supabase
      .from('profiles')
      .update({ 
        subscription_tier: tier,
        subscription_expires_at: new Date(subscription.current_period_end * 1000)
      })
      .eq('id', user_id);

    return new Response(
      JSON.stringify({ 
        subscription_id: subscription.id,
        client_secret: subscription.latest_invoice.payment_intent.client_secret 
      }),
      { 
        status: 200, 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      }
    );
  } catch (error) {
    console.error('Subscription error:', error);
    return new Response(
      JSON.stringify({ error: 'Failed to process subscription' }),
      { 
        status: 500, 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      }
    );
  }
}

// Game analytics aggregation
async function handleGameAnalytics(request: Request) {
  const body = await request.json();
  const { game_id, date } = body;

  // Aggregate daily stats
  const startOfDay = new Date(date);
  startOfDay.setHours(0, 0, 0, 0);
  const endOfDay = new Date(date);
  endOfDay.setHours(23, 59, 59, 999);

  // Get unique players
  const { count: uniquePlayers } = await supabase
    .from('scores')
    .select('user_id', { count: 'exact', head: true })
    .eq('game_id', game_id)
    .gte('achieved_at', startOfDay.toISOString())
    .lte('achieved_at', endOfDay.toISOString());

  // Get total sessions
  const { count: totalSessions } = await supabase
    .from('scores')
    .select('*', { count: 'exact', head: true })
    .eq('game_id', game_id)
    .gte('achieved_at', startOfDay.toISOString())
    .lte('achieved_at', endOfDay.toISOString());

  // Get ad revenue
  const { data: adRevenue } = await supabase
    .from('ad_impressions')
    .select('revenue')
    .eq('game_id', game_id)
    .gte('created_at', startOfDay.toISOString())
    .lte('created_at', endOfDay.toISOString());

  const totalAdRevenue = adRevenue?.reduce((sum, imp) => sum + (imp.revenue || 0), 0) || 0;

  // Save aggregated stats
  await supabase
    .from('developer_stats')
    .upsert({
      game_id,
      date: startOfDay.toISOString(),
      unique_players: uniquePlayers || 0,
      total_sessions: totalSessions || 0,
      ad_revenue: totalAdRevenue,
      total_revenue: totalAdRevenue, // Add IAP revenue when implemented
    });

  return new Response(
    JSON.stringify({ success: true }),
    { 
      status: 200, 
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    }
  );
}

// Admin: Approve game
async function handleApproveGame(request: Request) {
  const authHeader = request.headers.get('Authorization');
  if (!authHeader) {
    return new Response('Unauthorized', { status: 401, headers: corsHeaders });
  }

  // Verify admin token
  const token = authHeader.replace('Bearer ', '');
  const decoded = jwt.verify(token, JWT_SECRET) as any;
  
  // Check if user is admin
  const { data: profile } = await supabase
    .from('profiles')
    .select('role')
    .eq('id', decoded.sub)
    .single();

  if (profile?.role !== 'admin') {
    return new Response('Forbidden', { status: 403, headers: corsHeaders });
  }

  const body = await request.json();
  const { game_id, approved, feedback } = body;

  if (approved) {
    await supabase
      .from('games')
      .update({ 
        status: 'approved',
        approved_at: new Date().toISOString()
      })
      .eq('id', game_id);

    // Create default leaderboard
    await supabase
      .from('leaderboards')
      .insert({
        game_id,
        leaderboard_key: 'high_score',
        name: 'High Score',
        score_type: 'numeric',
        sort_order: 'DESC',
      });
  } else {
    await supabase
      .from('games')
      .update({ 
        status: 'rejected',
        rejection_reason: feedback
      })
      .eq('id', game_id);
  }

  return new Response(
    JSON.stringify({ success: true }),
    { 
      status: 200, 
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    }
  );
}

// Scheduled leaderboard reset
async function handleLeaderboardReset(request: Request) {
  // This would typically be called by a cron job
  
  // Get all leaderboards that need resetting
  const now = new Date();
  const { data: leaderboards } = await supabase
    .from('leaderboards')
    .select('*')
    .lte('next_reset_at', now.toISOString())
    .not('reset_schedule', 'is', null);

  for (const leaderboard of leaderboards || []) {
    // Archive old scores (optional)
    // Could move to a historical table
    
    // Delete current scores
    await supabase
      .from('scores')
      .delete()
      .eq('leaderboard_id', leaderboard.id);

    // Calculate next reset time
    let nextReset = new Date();
    switch (leaderboard.reset_schedule) {
      case 'daily':
        nextReset.setDate(nextReset.getDate() + 1);
        break;
      case 'weekly':
        nextReset.setDate(nextReset.getDate() + 7);
        break;
      case 'monthly':
        nextReset.setMonth(nextReset.getMonth() + 1);
        break;
    }

    // Update leaderboard
    await supabase
      .from('leaderboards')
      .update({
        last_reset_at: now.toISOString(),
        next_reset_at: nextReset.toISOString(),
      })
      .eq('id', leaderboard.id);
  }

  return new Response(
    JSON.stringify({ 
      success: true, 
      reset_count: leaderboards?.length || 0 
    }),
    { 
      status: 200, 
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    }
  );
}

// Initialize Stripe (mock implementation)
async function initStripe() {
  // In real implementation, use Stripe SDK
  return {
    customers: {
      create: async (data: any) => ({ id: 'cus_' + Date.now() })
    },
    subscriptions: {
      create: async (data: any) => ({
        id: 'sub_' + Date.now(),
        status: 'active',
        current_period_start: Date.now() / 1000,
        current_period_end: (Date.now() + 30 * 24 * 60 * 60 * 1000) / 1000,
        latest_invoice: {
          payment_intent: {
            client_secret: 'pi_secret_' + Date.now()
          }
        }
      })
    }
  };
}