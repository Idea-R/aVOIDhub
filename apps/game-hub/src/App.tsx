import { BrowserRouter as Router, Routes, Route } from 'react-router-dom'
import { useEffect, useState } from 'react'
import { unifiedAuth, type GameSession } from './services/UnifiedAuthService'

// Components
import Navbar from './components/Navbar'
import CustomCursor from './components/CustomCursor'
import AuthModal from './components/AuthModal'
import ProUpgradeModal from './components/auth/ProUpgradeModal'
import ErrorBoundary from './components/ErrorBoundary'
import ErrorDashboard from './components/ErrorDashboard'

// Pages
import HomePage from './pages/HomePage'
import GamePage from './pages/GamePage'
import GamesLibrary from './pages/GamesLibrary'
import LeaderboardsPage from './pages/LeaderboardsPage'
import ProfilePage from './pages/ProfilePage'
import NotFoundPage from './pages/NotFoundPage'
import AuthCallbackPage from './pages/AuthCallbackPage'

// Context
import { AuthProvider } from './contexts/AuthContext'

function App() {
  const [gameSession, setGameSession] = useState<GameSession | null>(null)
  const [loading, setLoading] = useState(true)
  const [showAuthModal, setShowAuthModal] = useState(false)
  const [showProModal, setShowProModal] = useState(false)

  useEffect(() => {
    // Check initial session
    const currentSession = unifiedAuth.getCurrentSession()
    if (currentSession) {
      setGameSession(currentSession)
    }
    setLoading(false)

    // Listen for auth state changes
    const unsubscribe = unifiedAuth.onAuthStateChange((session) => {
      console.log('🔐 Auth state changed in App:', session?.user?.username || 'No user')
      setGameSession(session)
      if (session) {
        setShowAuthModal(false)
      }
      setLoading(false)
    })

    return () => {
      unsubscribe()
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
    <AuthProvider value={{ 
      user: gameSession?.user || null, 
      setUser: (user) => {
        if (gameSession && user) {
          setGameSession({ ...gameSession, user })
        }
      }, 
      showAuthModal, 
      setShowAuthModal,
      showProModal,
      setShowProModal,
      gameSession,
      isAuthenticated: unifiedAuth.isAuthenticated()
    }}>
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
                <Route path="/auth/callback" element={<AuthCallbackPage />} />
                
                {/* Game Routes - Redirect to parameterized routes */}
                <Route path="/voidavoid" element={<GamePage />} />
                <Route path="/tankavoid" element={<GamePage />} />
                <Route path="/wreckavoid" element={<GamePage />} />
                <Route path="/wordavoid" element={<GamePage />} />
                
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

          {showProModal && (
            <ProUpgradeModal 
              isOpen={showProModal} 
              onClose={() => setShowProModal(false)} 
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
