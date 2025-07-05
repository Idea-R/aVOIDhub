import { BrowserRouter as Router, Routes, Route } from 'react-router-dom'
import { useEffect, useState } from 'react'
import { supabase, getCurrentUser, type User } from './lib/supabase'

// Components
import Navbar from './components/Navbar'
import CustomCursor from './components/CustomCursor'
import AuthModal from './components/AuthModal'
import ErrorBoundary from './components/ErrorBoundary'
import ErrorDashboard from './components/ErrorDashboard'

// Pages
import HomePage from './pages/HomePage'
import GamePage from './pages/GamePage'
import GamesLibrary from './pages/GamesLibrary'
import LeaderboardsPage from './pages/LeaderboardsPage'
import ProfilePage from './pages/ProfilePage'
import NotFoundPage from './pages/NotFoundPage'

// Context
import { AuthProvider } from './contexts/AuthContext'

function App() {
  const [user, setUser] = useState<User | null>(null)
  const [loading, setLoading] = useState(true)
  const [showAuthModal, setShowAuthModal] = useState(false)

  useEffect(() => {
    // Check initial session
    const checkUser = async () => {
      try {
        const currentUser = await getCurrentUser()
        setUser(currentUser)
      } catch (error) {
        console.error('Error checking user:', error)
      } finally {
        setLoading(false)
      }
    }

    checkUser()

    // Listen for auth changes
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (_event, session) => {
        if (session?.user) {
          // Fetch the complete user profile when user signs in
          try {
            const userProfile = await getCurrentUser()
            setUser(userProfile)
            setShowAuthModal(false)
          } catch (error) {
            console.error('Error fetching user profile:', error)
            setUser(null)
          }
        } else {
          setUser(null)
        }
        setLoading(false)
      }
    )

    return () => {
      subscription.unsubscribe()
    }
  }, [])

  if (loading) {
    return (
      <div className="min-h-screen bg-space flex items-center justify-center">
        <div className="loading-spinner"></div>
        <span className="ml-3 text-white">Loading aVOIDgame.io...</span>
      </div>
    )
  }

  return (
    <AuthProvider value={{ user, setUser, showAuthModal, setShowAuthModal }}>
      <Router>
        <div className="min-h-screen bg-space">
          <CustomCursor />
          <Navbar />
          
          <main className="pt-16">
            <ErrorBoundary>
              <Routes>
                <Route path="/" element={<HomePage />} />
                <Route path="/games" element={<GamesLibrary />} />
                <Route path="/games/:gameKey" element={<GamePage />} />
                <Route path="/leaderboards" element={<LeaderboardsPage />} />
                <Route path="/leaderboards/:gameKey" element={<LeaderboardsPage />} />
                <Route path="/profile" element={<ProfilePage />} />
                <Route path="/profile/:userId" element={<ProfilePage />} />
                
                {/* Game Routes */}
                <Route path="/voidavoid" element={<GamePage />} />
                <Route path="/tankavoid" element={<GamePage />} />
                <Route path="/wreckavoid" element={<GamePage />} />
                
                {/* Catch-all */}
                <Route path="*" element={<NotFoundPage />} />
              </Routes>
            </ErrorBoundary>
          </main>

          {showAuthModal && (
            <AuthModal 
              isOpen={showAuthModal} 
              onClose={() => setShowAuthModal(false)} 
            />
          )}

          {/* Error Dashboard for Development */}
          <ErrorDashboard />
        </div>
      </Router>
    </AuthProvider>
  )
}

export default App
