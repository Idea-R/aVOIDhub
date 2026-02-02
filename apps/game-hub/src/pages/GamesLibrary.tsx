import React, { useState, useEffect } from 'react'
import { Link } from 'react-router-dom'
import { Play, Users, Star, Search, Filter, ArrowLeft } from 'lucide-react'
import { gameAssets, fallbackAssets } from '../config/supabaseAssets'

const GamesLibrary: React.FC = () => {
  const [loading, setLoading] = useState(true)
  const [searchTerm, setSearchTerm] = useState('')
  const [selectedCategory, setSelectedCategory] = useState('All')

  // All games data
  const allGames = [
    {
      id: 'voidavoid',
      key: 'voidavoid',
      name: 'VOIDaVOID',
      description: 'Navigate through space avoiding obstacles in this fast-paced cursor game. Test your reflexes and survive as long as possible in the endless void.',
      image: gameAssets.logos.voidavoid,
      fallbackImage: fallbackAssets.logos.voidavoid,
      status: 'Available',
      category: 'Action',
      players: 'Single Player',
      rating: 4.8,
      playCount: 1200,
      gameUrl: '/voidavoid',
      gamePageUrl: '/games/voidavoid'
    },
    {
      id: 'tankavoid',
      key: 'tankavoid',
      name: 'TankaVOID',
      description: 'Tank warfare meets cursor precision in this strategic action game. Command your tank through intense battles and avoid enemy fire.',
      image: gameAssets.logos.tankavoid,
      fallbackImage: fallbackAssets.logos.tankavoid,
      status: 'Available',
      category: 'Strategy',
      players: 'Single Player',
      rating: 4.6,
      playCount: 850,
      gameUrl: '/tankavoid',
      gamePageUrl: '/games/tankavoid'
    },
    {
      id: 'wreckavoid',
      key: 'wreckavoid',
      name: 'WreckaVOID',
      description: 'Demolition chaos with cursor control - destroy everything in sight! Create massive destruction while avoiding the consequences.',
      image: gameAssets.logos.wreckavoid,
      fallbackImage: fallbackAssets.logos.wreckavoid,
      status: 'Available',
      category: 'Action',
      players: 'Single Player',
      rating: 4.7,
      playCount: 950,
      gameUrl: '/wreckavoid',
      gamePageUrl: '/games/wreckavoid'
    },
    {
      id: 'wordavoid',
      key: 'wordavoid',
      name: 'WORDaVOID',
      description: 'Test your typing speed while avoiding falling words in this fast-paced typing game. Type words quickly to destroy them before they reach the bottom.',
      image: gameAssets.logos.wordavoid,
      fallbackImage: fallbackAssets.logos.wordavoid,
      status: 'Available',
      category: 'Puzzle',
      players: 'Single Player',
      rating: 4.9,
      playCount: 750,
      gameUrl: '/wordavoid',
      gamePageUrl: '/games/wordavoid'
    }
  ]

  const categories = ['All', 'Action', 'Strategy', 'Puzzle', 'Arcade']

  const filteredGames = allGames.filter(game => {
    const matchesSearch = game.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         game.description.toLowerCase().includes(searchTerm.toLowerCase())
    const matchesCategory = selectedCategory === 'All' || game.category === selectedCategory
    return matchesSearch && matchesCategory
  })

  useEffect(() => {
    const loadGames = async () => {
      setLoading(false)
    }
    loadGames()
  }, [])

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="loading-spinner"></div>
        <span className="ml-3 text-white">Loading Games Library...</span>
      </div>
    )
  }

  return (
    <div className="min-h-screen p-4 md:p-8">
      <div className="max-w-7xl mx-auto">
        
        {/* Header */}
        <div className="mb-8">
          <Link to="/" className="btn-ghost inline-flex items-center space-x-2 mb-6">
            <ArrowLeft size={18} />
            <span>Back to Home</span>
          </Link>
          
          <div className="text-center mb-8">
            <h1 className="text-5xl md:text-6xl font-game font-bold glow-text mb-4">
              Games Library
            </h1>
            <p className="text-xl text-white/60 max-w-2xl mx-auto">
              Discover and play the complete collection of aVOID games. 
              Test your skills, climb the leaderboards, and master every challenge.
            </p>
          </div>
        </div>

        {/* Search and Filter */}
        <div className="mb-8">
          <div className="flex flex-col md:flex-row gap-4 items-center justify-between">
            <div className="relative flex-1 max-w-md">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-white/60" size={18} />
              <input
                type="text"
                placeholder="Search games..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full bg-white/10 border border-white/20 rounded-lg pl-10 pr-4 py-2 text-white placeholder-white/60 focus:outline-none focus:border-purple-500"
              />
            </div>
            
            <div className="flex items-center space-x-2">
              <Filter size={18} className="text-white/60" />
              <select
                value={selectedCategory}
                onChange={(e) => setSelectedCategory(e.target.value)}
                className="bg-white/10 border border-white/20 rounded-lg px-4 py-2 text-white focus:outline-none focus:border-purple-500"
              >
                {categories.map(category => (
                  <option key={category} value={category} className="bg-gray-800">
                    {category.charAt(0).toUpperCase() + category.slice(1)}
                  </option>
                ))}
              </select>
            </div>
          </div>
        </div>

        {/* Game Stats */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-12">
          <div className="stats-card text-center">
            <div className="text-3xl font-bold glow-text mb-2">{allGames.length}</div>
            <div className="text-white/60">Total Games</div>
          </div>
          <div className="stats-card text-center">
            <div className="text-3xl font-bold glow-text mb-2">
              {allGames.reduce((sum, game) => sum + game.playCount, 0).toLocaleString()}
            </div>
            <div className="text-white/60">Total Plays</div>
          </div>
          <div className="stats-card text-center">
            <div className="text-3xl font-bold glow-text mb-2">
              {(allGames.reduce((sum, game) => sum + game.rating, 0) / allGames.length).toFixed(1)}
            </div>
            <div className="text-white/60">Average Rating</div>
          </div>
        </div>

        {/* Games Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
          {filteredGames.map((game) => (
            <div key={game.id} className="game-card group">
              <div className="aspect-video bg-gradient-to-br from-gray-700 to-gray-800 rounded-t-2xl overflow-hidden">
                <img 
                  src={game.image} 
                  alt={`${game.name} Logo`}
                  className="w-full h-full object-contain p-4 group-hover:scale-105 transition-transform duration-300"
                  onError={(e) => {
                    const img = e.target as HTMLImageElement;
                    img.src = game.fallbackImage;
                  }}
                />
              </div>
              
              <div className="p-6">
                <div className="flex items-center justify-between mb-3">
                  <h3 className="text-2xl font-bold text-white">{game.name}</h3>
                  <span className={`px-3 py-1 rounded-full text-xs font-medium ${
                    game.status === 'Available' 
                      ? 'bg-green-500/20 text-green-400' 
                      : 'bg-yellow-500/20 text-yellow-400'
                  }`}>
                    {game.status}
                  </span>
                </div>
                
                <p className="text-white/80 mb-4 line-clamp-3">{game.description}</p>
                
                <div className="grid grid-cols-2 gap-4 text-sm text-white/60 mb-6">
                  <div className="flex items-center space-x-2">
                    <Users size={16} />
                    <span>{game.players}</span>
                  </div>
                  <div className="flex items-center space-x-2">
                    <Star size={16} className="text-yellow-400" />
                    <span>{game.rating}</span>
                  </div>
                  <div className="col-span-2">
                    <span className="text-purple-400">{game.category}</span>
                    <span className="mx-2">•</span>
                    <span>{game.playCount.toLocaleString()} plays</span>
                  </div>
                </div>
                
                <div className="space-y-3">
                  <a 
                    href={game.gameUrl}
                    className="w-full btn-primary flex items-center justify-center space-x-2"
                  >
                    <Play size={18} />
                    <span>Play Now</span>
                  </a>
                  <Link 
                    to={game.gamePageUrl}
                    className="w-full btn-secondary flex items-center justify-center space-x-2"
                  >
                    <span>Learn More</span>
                  </Link>
                </div>
              </div>
            </div>
          ))}
        </div>

        {/* No results */}
        {filteredGames.length === 0 && (
          <div className="text-center py-12">
            <div className="text-6xl mb-4">🎮</div>
            <h3 className="text-2xl font-bold text-white mb-2">No games found</h3>
            <p className="text-white/60">Try adjusting your search or filter criteria</p>
          </div>
        )}
      </div>
    </div>
  )
}

export default GamesLibrary 