import { useParams } from 'react-router-dom'
import { ArrowLeft, ExternalLink } from 'lucide-react'
import { Link } from 'react-router-dom'
import { gameAssets, fallbackAssets } from '../config/supabaseAssets'

const GamePage = () => {
  const { gameKey } = useParams<{ gameKey: string }>()

  const gameDetails: Record<string, any> = {
    voidavoid: {
      name: 'VOIDaVOID',
      description: 'Navigate through space avoiding obstacles in this fast-paced cursor game',
      url: '/VOIDaVOID',
      status: 'Available',
      logo: gameAssets.logos.voidavoid,
      fallbackLogo: fallbackAssets.logos.voidavoid,
      videoUrl: null // Will be updated when video is ready: gameVideos.previews.voidavoid
    },
    tankavoid: {
      name: 'TankaVOID',
      description: 'Tank warfare meets cursor precision in this strategic action game',
      url: '/TankaVOID',
      status: 'Available',
      logo: gameAssets.logos.tankavoid,
      fallbackLogo: fallbackAssets.logos.tankavoid,
      videoUrl: null // Will be updated when video is ready: gameVideos.previews.tankavoid
    },
    wreckavoid: {
      name: 'WreckaVOID',
      description: 'Demolition chaos with cursor control - destroy everything in sight!',
      url: '/WreckaVOID',
      status: 'Available',
      logo: gameAssets.logos.wreckavoid,
      fallbackLogo: fallbackAssets.logos.wreckavoid,
      videoUrl: null // Will be updated when video is ready: gameVideos.previews.wreckavoid
    },
    wordavoid: {
      name: 'WORDaVOID',
      description: 'Test your typing speed while avoiding falling words in this fast-paced typing game',
      url: '/WORDaVOID',
      status: 'Available',
      logo: gameAssets.logos.wordavoid,
      fallbackLogo: fallbackAssets.logos.wordavoid,
      videoUrl: null // Will be updated when video is ready: gameVideos.previews.wordavoid
    }
  }

  const game = gameDetails[gameKey || 'voidavoid']

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
          
          {game.status === 'Available' ? (
            <a 
              href={game.url} 
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