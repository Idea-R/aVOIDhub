import { useParams } from 'react-router-dom'
import { useAuth } from '../contexts/AuthContext'
import { User } from 'lucide-react'
import UserProfile from '../components/auth/UserProfile'

const ProfilePage = () => {
  const { userId } = useParams<{ userId?: string }>()
  const { user, setShowAuthModal } = useAuth()

  // If viewing someone else's profile, we'd need to fetch their data
  // For now, we'll just handle the current user's profile
  if (!user && !userId) {
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

  return <UserProfile userId={userId} />
}

export default ProfilePage 