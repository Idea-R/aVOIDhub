import { useParams, useLocation } from 'react-router-dom'
import { useState, useEffect } from 'react'
import { ArrowLeft, ExternalLink, Loader, CheckCircle, XCircle } from 'lucide-react'
import { Link } from 'react-router-dom'
import { gameAssets, fallbackAssets } from '../config/supabaseAssets'

const GamePage = () => {
  const { gameKey: routeGameKey } = useParams<{ gameKey: string }>()
  const location = useLocation()
  const [serverStatus, setServerStatus] = useState<'checking' | 'online' | 'offline'>('checking')
  
  // Extract gameKey from route params or path
  const gameKey = routeGameKey || (() => {
    const path = location.pathname.replace('/', '')
    if (['voidavoid', 'tankavoid', 'wreckavoid', 'wordavoid'].includes(path)) {
      return path
    }
    return 'voidavoid' // default fallback
  })()

  const gameDetails: Record<string, any> = {
    voidavoid: {
      name: 'VOIDaVOID',
      description: 'Navigate through space avoiding obstacles in this fast-paced cursor game',
      url: 'http://localhost:5174', // void-avoid dev server
      status: 'Development',
      logo: gameAssets.logos.voidavoid,
      fallbackLogo: fallbackAssets.logos.voidavoid,
      videoUrl: null,
      instructions: 'Run: npm run dev in games/void-avoid directory'
    },
    tankavoid: {
      name: 'TankaVOID',
      description: 'Tank warfare meets cursor precision in this strategic action game',
      url: 'http://localhost:5175', // tanka-void dev server
      status: 'Development',
      logo: gameAssets.logos.tankavoid,
      fallbackLogo: fallbackAssets.logos.tankavoid,
      videoUrl: null,
      instructions: 'Run: npm run dev in games/tanka-void directory'
    },
    wreckavoid: {
      name: 'WreckaVOID',
      description: 'Demolition chaos with cursor control - destroy everything in sight!',
      url: 'http://localhost:5178', // wrecka-void dev server
      status: 'Development',
      logo: gameAssets.logos.wreckavoid,
      fallbackLogo: fallbackAssets.logos.wreckavoid,
      videoUrl: null,
      instructions: 'Run: npm run dev in games/wrecka-void directory'
    },
    wordavoid: {
      name: 'WORDaVOID',
      description: 'Test your typing speed while avoiding falling words in this fast-paced typing game',
      url: 'http://localhost:5177', // word-avoid dev server
      status: 'Development',
      logo: gameAssets.logos.wordavoid,
      fallbackLogo: fallbackAssets.logos.wordavoid,
      videoUrl: null,
      instructions: 'Run: npm run dev in games/word-avoid directory'
    }
  }

  const game = gameDetails[gameKey]

  // Check if the game server is running
  const checkServerStatus = async (url: string) => {
    try {
      const response = await fetch(url, { 
        method: 'HEAD', 
        mode: 'no-cors',
        cache: 'no-cache'
      })
      // In no-cors mode, we can't read the response, but if no error is thrown, server is likely up
      setServerStatus('online')
    } catch (error) {
      setServerStatus('offline')
    }
  }

  useEffect(() => {
    if (game && game.status === 'Development') {
      checkServerStatus(game.url)
    }
  }, [game])

  if (!game) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <h1 className="text-4xl font-bold text-white mb-4">Game Not Found</h1>
          <Link to="/" className="btn-primary">Back to Home</Link>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen p-8">
      <div className="max-w-4xl mx-auto">
        
        {/* Back Button */}
        <Link to="/" className="btn-ghost inline-flex items-center space-x-2 mb-8">
          <ArrowLeft size={18} />
          <span>Back to Games</span>
        </Link>

        {/* Game Header */}
        <div className="text-center mb-12">
          <h1 className="text-6xl font-game font-bold glow-text mb-4">{game.name}</h1>
          <p className="text-xl text-white/60 mb-8">{game.description}</p>
          
          {game.status === 'Development' ? (
            <div className="space-y-4">
              <div className="bg-yellow-900/30 border border-yellow-600/50 rounded-lg p-4 mb-4">
                <h3 className="text-yellow-400 font-semibold mb-2">🚧 Development Mode</h3>
                <p className="text-yellow-200 text-sm mb-2">{game.instructions}</p>
                <p className="text-yellow-300 text-xs mb-3">Expected at: {game.url}</p>
                
                {/* Server Status */}
                <div className="flex items-center space-x-2 text-sm">
                  {serverStatus === 'checking' && (
                    <>
                      <Loader className="animate-spin text-blue-400" size={16} />
                      <span className="text-blue-400">Checking server status...</span>
                    </>
                  )}
                  {serverStatus === 'online' && (
                    <>
                      <CheckCircle className="text-green-400" size={16} />
                      <span className="text-green-400">Server is running!</span>
                    </>
                  )}
                  {serverStatus === 'offline' && (
                    <>
                      <XCircle className="text-red-400" size={16} />
                      <span className="text-red-400">Server not running</span>
                    </>
                  )}
                </div>
              </div>
              
              {serverStatus === 'online' ? (
                <a 
                  href={game.url} 
                  target="_blank"
                  rel="noopener noreferrer"
                  className="btn-primary inline-flex items-center space-x-2"
                >
                  <ExternalLink size={20} />
                  <span>Launch {game.name}</span>
                </a>
              ) : (
                <div className="space-y-3">
                  <button 
                    onClick={() => checkServerStatus(game.url)}
                    disabled={serverStatus === 'checking'}
                    className="btn-secondary inline-flex items-center space-x-2"
                  >
                    <Loader className={`${serverStatus === 'checking' ? 'animate-spin' : ''}`} size={18} />
                    <span>Check Server Status</span>
                  </button>
                  
                  {serverStatus === 'offline' && (
                    <div className="bg-red-900/30 border border-red-600/50 rounded-lg p-3">
                      <p className="text-red-200 text-sm mb-2">🔧 To start the server:</p>
                      <code className="bg-black/30 px-2 py-1 rounded text-xs text-green-400">
                        cd C:\dev\aVOID\games\{gameKey.replace('avoid', '-avoid')} && npm run dev
                      </code>
                    </div>
                  )}
                </div>
              )}
            </div>
          ) : game.status === 'Available' ? (
            <a 
              href={game.url} 
              target="_blank"
              rel="noopener noreferrer"
              className="btn-primary inline-flex items-center space-x-2"
            >
              <ExternalLink size={20} />
              <span>Play {game.name}</span>
            </a>
          ) : (
            <div className="btn-secondary opacity-50 cursor-not-allowed inline-flex items-center space-x-2">
              <span>Coming Soon</span>
            </div>
          )}
        </div>

        {/* Game Preview */}
        <div className="game-card mb-8">
          <div className="aspect-video bg-gradient-to-br from-gray-700 to-gray-800 rounded-2xl overflow-hidden">
            {game.videoUrl ? (
              <video 
                src={game.videoUrl} 
                autoPlay 
                loop 
                muted 
                className="w-full h-full object-cover"
                poster={game.logo}
              />
            ) : (
              <div className="w-full h-full flex items-center justify-center bg-gradient-to-br from-gray-700 to-gray-800">
                <img 
                  src={game.logo} 
                  alt={`${game.name} Logo`}
                  className="max-w-full max-h-full object-contain p-8"
                  onError={(e) => {
                    // Fallback to local asset if Supabase asset fails
                    const img = e.target as HTMLImageElement;
                    img.src = game.fallbackLogo;
                  }}
                />
              </div>
            )}
          </div>
          <div className="p-4 text-center">
            <p className="text-white/60 text-sm">
              {game.videoUrl ? 'Gameplay Preview' : 'Gameplay video coming soon'}
            </p>
          </div>
        </div>

        {/* Instructions */}
        <div className="stats-card">
          <h3 className="text-2xl font-bold text-white mb-4">How to Play</h3>
          <div className="text-white/80 space-y-2">
            <p>• Use your cursor to navigate and control the game</p>
            <p>• Avoid obstacles and enemies to survive</p>
            <p>• Collect power-ups to boost your score</p>
            <p>• Compete for the highest score on the leaderboards</p>
          </div>
        </div>
      </div>
    </div>
  )
}

export default GamePage 