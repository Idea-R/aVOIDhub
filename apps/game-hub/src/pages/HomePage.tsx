import { useState, useEffect } from 'react'
import { Link } from 'react-router-dom'
import { Play, Trophy, Users, Star, ArrowRight, LogIn, UserPlus } from 'lucide-react'
import { getGames, getLeaderboard } from '../lib/supabase'
import type { Game, LeaderboardScore } from '../lib/supabase'
import { gameAssets, gameVideos, fallbackAssets } from '../config/supabaseAssets'
import Footer from '../components/Footer'
import AuthModal from '../components/auth/AuthModal'
import UserProfile from '../components/auth/UserProfile'
import { unifiedAuth, GameSession } from '../services/UnifiedAuthService'

const HomePage = () => {
  const [games, setGames] = useState<Game[]>([])
  const [recentScores, setRecentScores] = useState<LeaderboardScore[]>([])
  const [loading, setLoading] = useState(true)
  const [session, setSession] = useState<GameSession | null>(null)
  const [authModalOpen, setAuthModalOpen] = useState(false)
  const [authModalMode, setAuthModalMode] = useState<'login' | 'signup'>('login')

  useEffect(() => {
    const loadData = async () => {
      try {
        // Load games
        const { data: gamesData } = await getGames()
        if (gamesData) {
          setGames(gamesData)
        }

        // Load recent scores from VOIDaVOID (the current game)
        const { data: scoresData } = await getLeaderboard('voidavoid', 5)
        if (scoresData) {
          setRecentScores(scoresData)
        }
      } catch (error) {
        console.error('Error loading homepage data:', error)
      } finally {
        setLoading(false)
      }
    }

    loadData()
  }, [])

  useEffect(() => {
    // Initialize authentication
    const currentSession = unifiedAuth.getCurrentSession()
    setSession(currentSession)

    // Listen for auth changes
    const unsubscribe = unifiedAuth.onAuthStateChange((newSession) => {
      setSession(newSession)
      if (newSession) {
        setAuthModalOpen(false)
      }
    })

    return unsubscribe
  }, [])

  const openAuthModal = (mode: 'login' | 'signup') => {
    setAuthModalMode(mode)
    setAuthModalOpen(true)
  }

  const handleSignOut = () => {
    setSession(null)
  }

  const featuredGames = [
    {
      key: 'voidavoid',
      name: 'VOIDaVOID',
      description: 'Navigate through space avoiding obstacles in this fast-paced cursor game',
      image: gameAssets.logos.voidavoid,
      fallbackImage: fallbackAssets.logos.voidavoid,
      status: 'Available',
      players: 'TBA',
      rating: 0,
      videoUrl: gameVideos.previews.voidavoid
    },
    {
      key: 'tankavoid',
      name: 'TankaVOID',
      description: 'Tank warfare meets cursor precision in this strategic action game',
      image: gameAssets.logos.tankavoid,
      fallbackImage: fallbackAssets.logos.tankavoid,
      status: 'Available',
      players: 'TBA',
      rating: 0,
      videoUrl: gameVideos.previews.tankavoid
    },
    {
      key: 'wreckavoid',
      name: 'WreckaVOID',
      description: 'Demolition chaos with cursor control - destroy everything in sight!',
      image: gameAssets.logos.wreckavoid,
      fallbackImage: fallbackAssets.logos.wreckavoid,
      status: 'Available',
      players: 'TBA',
      rating: 0,
      videoUrl: gameVideos.previews.wreckavoid
    },
    {
      key: 'wordavoid',
      name: 'WORDaVOID',
      description: 'Test your typing speed while avoiding falling words in this fast-paced typing game',
      image: gameAssets.logos.wordavoid,
      fallbackImage: fallbackAssets.logos.wordavoid,
      status: 'Available',
      players: 'TBA',
      rating: 0,
      videoUrl: gameVideos.previews.wordavoid
    }
  ]

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="loading-spinner"></div>
        <span className="ml-3 text-white">Loading aVOIDgame.io...</span>
      </div>
    )
  }

  return (
    <div className="min-h-screen">
      
      
      {/* Hero Section */}
      <section className="relative overflow-hidden py-20 px-4" style={{
        backgroundImage: `url(${gameAssets.heroes.main})`,
        backgroundSize: 'cover',
        backgroundPosition: 'center',
        backgroundRepeat: 'no-repeat'
      }}>
        <div className="absolute inset-0 bg-black/60"></div>
        <div className="max-w-7xl mx-auto text-center">
          <div className="absolute inset-0 bg-gradient-to-r from-blue-600/20 to-purple-600/20 blur-3xl"></div>
          <div className="relative z-10">
            <h1 className="text-6xl md:text-8xl font-game font-bold mb-6">
              <span className="glow-text">aVOIDgame.io</span>
            </h1>
            <p className="text-xl md:text-2xl text-white/80 mb-8 max-w-3xl mx-auto">
              The ultimate cursor-based gaming platform. Test your reflexes, climb the leaderboards, 
              and become the ultimate aVOID champion.
            </p>
            <div className="flex flex-col sm:flex-row gap-4 justify-center">
              <Link to="/games" className="btn-primary inline-flex items-center space-x-2">
                <Play size={20} />
                <span>Play Now</span>
              </Link>
              <Link to="/leaderboards" className="btn-secondary inline-flex items-center space-x-2">
                <Trophy size={20} />
                <span>View Leaderboards</span>
              </Link>
            </div>
          </div>
        </div>
      </section>

      {/* Stats Section */}
      <section className="py-16 px-4 border-y border-white/10">
        <div className="max-w-7xl mx-auto">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            <div className="stats-card text-center">
              <div className="text-4xl font-bold glow-text mb-2">{recentScores.length > 0 ? '1.2k+' : '0'}</div>
              <div className="text-white/60">Active Players</div>
            </div>
            <div className="stats-card text-center">
              <div className="text-4xl font-bold glow-text mb-2">{games.length}</div>
              <div className="text-white/60">Games Available</div>
            </div>
            <div className="stats-card text-center">
              <div className="text-4xl font-bold glow-text mb-2">{recentScores.length > 0 ? '50k+' : '0'}</div>
              <div className="text-white/60">High Scores</div>
            </div>
          </div>
        </div>
      </section>

      {/* Featured Games */}
      <section className="py-20 px-4">
        <div className="max-w-7xl mx-auto">
          <div className="text-center mb-12">
            <h2 className="text-4xl font-bold glow-text mb-4">Featured Games</h2>
            <p className="text-xl text-white/60">Experience the next generation of cursor-based gaming</p>
          </div>
          
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
            {featuredGames.map((game) => (
              <div key={game.key} className="game-card">
                <div className="aspect-video bg-gradient-to-br from-gray-700 to-gray-800 rounded-t-2xl overflow-hidden">
                  <img 
                    src={game.image} 
                    alt={`${game.name} Logo`}
                    className="w-full h-full object-contain p-4"
                    onError={(e) => {
                      // Fallback to local asset if Supabase asset fails
                      const img = e.target as HTMLImageElement;
                      img.src = game.fallbackImage;
                    }}
                  />
                </div>
                
                <div className="p-6">
                  <div className="flex items-center justify-between mb-3">
                    <h3 className="text-xl font-bold text-white">{game.name}</h3>
                    <span className={`px-2 py-1 rounded-full text-xs font-medium ${
                      game.status === 'Available' 
                        ? 'bg-green-500/20 text-green-400' 
                        : 'bg-yellow-500/20 text-yellow-400'
                    }`}>
                      {game.status}
                    </span>
                  </div>
                  
                  <p className="text-white/60 mb-4">{game.description}</p>
                  
                  <div className="flex items-center justify-between text-sm text-white/60 mb-4">
                    <div className="flex items-center space-x-1">
                      <Users size={16} />
                      <span>{game.players} players</span>
                    </div>
                    {game.rating > 0 && (
                      <div className="flex items-center space-x-1">
                        <Star size={16} className="text-yellow-400" />
                        <span>{game.rating}</span>
                      </div>
                    )}
                  </div>
                  
                  {game.status === 'Available' ? (
                    <div className="space-y-2">
                      <Link 
                        to={`/games/${game.key}`}
                        className="w-full btn-secondary flex items-center justify-center space-x-2"
                      >
                        <span>Learn More</span>
                      </Link>
                      <a 
                        href={
                          game.key === 'voidavoid' ? '/VOIDaVOID' :
                          game.key === 'tankavoid' ? '/TankaVOID' :
                          game.key === 'wreckavoid' ? '/WreckaVOID' :
                          game.key === 'wordavoid' ? '/WORDaVOID' : 
                          `/${game.key}`
                        }
                        className="w-full btn-primary flex items-center justify-center space-x-2"
                      >
                        <Play size={18} />
                        <span>Quick Play</span>
                      </a>
                    </div>
                  ) : (
                    <button 
                      disabled
                      className="w-full btn-secondary opacity-50 cursor-not-allowed flex items-center justify-center space-x-2"
                    >
                      <span>Coming Soon</span>
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Recent Scores */}
      {recentScores.length > 0 && (
        <section className="py-20 px-4 bg-white/5">
          <div className="max-w-7xl mx-auto">
            <div className="flex items-center justify-between mb-8">
              <h2 className="text-3xl font-bold glow-text">Recent High Scores</h2>
              <Link 
                to="/leaderboards" 
                className="btn-ghost flex items-center space-x-2"
              >
                <span>View All</span>
                <ArrowRight size={18} />
              </Link>
            </div>
            
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {recentScores.slice(0, 6).map((score, index) => (
                <div key={score.id} className="stats-card">
                  <div className="flex items-center justify-between">
                    <div>
                      <div className="font-semibold text-white">
                        {score.user_profiles?.display_name || score.user_profiles?.username || 'Anonymous'}
                      </div>
                      <div className="text-2xl font-bold glow-text">
                        {score.score.toLocaleString()}
                      </div>
                      <div className="text-sm text-white/60">
                        {new Date(score.achieved_at).toLocaleDateString()}
                      </div>
                    </div>
                    <div className={`leaderboard-rank ${
                      index === 0 ? 'rank-1' : 
                      index === 1 ? 'rank-2' : 
                      index === 2 ? 'rank-3' : 'rank-other'
                    }`}>
                      {index + 1}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </section>
      )}

      {/* Call to Action */}
      <section className="py-20 px-4">
        <div className="max-w-4xl mx-auto text-center">
          <h2 className="text-4xl font-bold glow-text mb-6">Ready to aVOID?</h2>
          <p className="text-xl text-white/60 mb-8">
            Join thousands of players testing their reflexes and climbing the leaderboards.
          </p>
          <Link to="/games" className="btn-primary inline-flex items-center space-x-2">
            <Play size={20} />
            <span>Browse All Games</span>
          </Link>
        </div>
      </section>

      {/* Footer */}
      <Footer />

      {/* Auth Modal */}
      <AuthModal 
        isOpen={authModalOpen}
        onClose={() => setAuthModalOpen(false)}
        defaultMode={authModalMode}
      />
    </div>
  )
}

export default HomePage 