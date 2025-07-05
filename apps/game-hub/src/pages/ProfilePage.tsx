import { useAuth } from '../contexts/AuthContext'
import { User, Trophy, Target, Calendar } from 'lucide-react'
import { Link } from 'react-router-dom'

const ProfilePage = () => {
  const { user, setShowAuthModal } = useAuth()

  if (!user) {
    return (
      <div className="min-h-screen flex items-center justify-center p-8">
        <div className="text-center">
          <User className="mx-auto text-white/30 mb-6" size={64} />
          <h1 className="text-4xl font-bold text-white mb-4">Profile</h1>
          <p className="text-white/60 mb-8">Sign in to view your profile and game statistics</p>
          <button 
            onClick={() => setShowAuthModal(true)}
            className="btn-primary"
          >
            Sign In
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen p-8">
      <div className="max-w-4xl mx-auto">
        
        {/* Profile Header */}
        <div className="stats-card mb-8">
          <div className="flex items-center space-x-6">
            <div className="w-20 h-20 bg-gradient-to-br from-blue-500 to-purple-600 rounded-full flex items-center justify-center">
              <User size={32} className="text-white" />
            </div>
            <div>
              <h1 className="text-3xl font-bold text-white mb-2">
                {user.display_name || user.username || 'Player'}
              </h1>
              <p className="text-white/60">@{user.username || 'username'}</p>
              <div className="flex items-center space-x-4 mt-2 text-sm text-white/60">
                <div className="flex items-center space-x-1">
                  <Calendar size={16} />
                  <span>Joined {new Date(user.created_at || '').toLocaleDateString()}</span>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Stats Grid */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
          <div className="stats-card text-center">
            <Trophy className="mx-auto text-yellow-400 mb-4" size={32} />
            <div className="text-3xl font-bold glow-text mb-2">0</div>
            <div className="text-white/60">High Score</div>
          </div>
          
          <div className="stats-card text-center">
            <Target className="mx-auto text-blue-400 mb-4" size={32} />
            <div className="text-3xl font-bold glow-text mb-2">0</div>
            <div className="text-white/60">Games Played</div>
          </div>
          
          <div className="stats-card text-center">
            <Trophy className="mx-auto text-purple-400 mb-4" size={32} />
            <div className="text-3xl font-bold glow-text mb-2">-</div>
            <div className="text-white/60">Rank</div>
          </div>
        </div>

        {/* Recent Games */}
        <div className="stats-card">
          <h2 className="text-2xl font-bold text-white mb-6">Recent Games</h2>
          <div className="text-center py-12">
            <Target className="mx-auto text-white/30 mb-4" size={64} />
            <p className="text-white/60 text-lg mb-4">No games played yet</p>
            <Link to="/games/voidavoid" className="btn-primary">
              Play Your First Game
            </Link>
          </div>
        </div>
      </div>
    </div>
  )
}

export default ProfilePage 