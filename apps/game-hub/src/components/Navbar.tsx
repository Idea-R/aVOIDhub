import { Link, useLocation } from 'react-router-dom'
import { useState, useEffect } from 'react'
import { Menu, X, User, LogOut, Trophy, Gamepad2, Crown } from 'lucide-react'
import { useAuth } from '../contexts/AuthContext'
import { unifiedAuth } from '../services/UnifiedAuthService'
import MusicController from './MusicController'

const Navbar = () => {
  const [isMenuOpen, setIsMenuOpen] = useState(false)
  const [scrolled, setScrolled] = useState(false)
  const location = useLocation()
  const { user, setShowAuthModal, setShowProModal } = useAuth()

  useEffect(() => {
    const handleScroll = () => {
      setScrolled(window.scrollY > 20)
    }

    window.addEventListener('scroll', handleScroll)
    return () => window.removeEventListener('scroll', handleScroll)
  }, [])

  const handleSignOut = async () => {
    await unifiedAuth.signOut()
    setIsMenuOpen(false)
  }

  const handleAuthClick = () => {
    setShowAuthModal(true)
    setIsMenuOpen(false)
  }

  const isActive = (path: string) => {
    return location.pathname === path || location.pathname.startsWith(path + '/')
  }

  const navLinks = [
    { path: '/', label: 'Home', icon: null },
    { path: '/games', label: 'Games', icon: Gamepad2 },
    { path: '/leaderboards', label: 'Leaderboards', icon: Trophy },
  ]

  return (
    <nav className={`fixed top-0 left-0 right-0 z-50 transition-all duration-300 ${
      scrolled ? 'bg-gray-900/95 backdrop-blur-md border-b border-white/10' : 'bg-transparent'
    }`}>
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16">
          
          {/* Logo */}
          <Link to="/" className="flex items-center space-x-2 group">
            <div className="w-8 h-8 bg-gradient-to-br from-blue-500 to-purple-600 rounded-lg flex items-center justify-center group-hover:scale-110 transition-transform duration-300">
              <span className="text-white font-bold text-lg">A</span>
            </div>
            <span className="text-xl font-game font-bold glow-text">
              aVOIDgame.io
            </span>
          </Link>

          {/* Desktop Navigation */}
          <div className="hidden md:flex items-center space-x-8">
            {navLinks.map(({ path, label, icon: Icon }) => (
              <Link
                key={path}
                to={path}
                className={`nav-link flex items-center space-x-2 ${
                  isActive(path) ? 'active' : ''
                }`}
              >
                {Icon && <Icon size={18} />}
                <span>{label}</span>
              </Link>
            ))}
          </div>

          {/* Music Controller */}
          <div className="hidden md:block">
            <MusicController compact={true} className="relative" />
          </div>

          {/* User Menu */}
          <div className="hidden md:flex items-center space-x-4">
            {user ? (
              <div className="flex items-center space-x-4">
                {!user.is_pro_member && (
                  <button
                    onClick={() => setShowProModal(true)}
                    className="btn-primary bg-gradient-to-r from-yellow-500 to-amber-500 hover:from-yellow-600 hover:to-amber-600 text-gray-900 flex items-center space-x-2"
                  >
                    <Crown size={16} />
                    <span>Go Pro</span>
                  </button>
                )}
                <Link
                  to="/profile"
                  className="flex items-center space-x-2 nav-link"
                >
                  <User size={18} />
                  <span>{user.username || user.email}</span>
                  {user.is_pro_member && (
                    <Crown className="w-4 h-4 text-yellow-500" />
                  )}
                </Link>
                <button
                  onClick={handleSignOut}
                  className="flex items-center space-x-2 nav-link text-red-400 hover:text-red-300"
                >
                  <LogOut size={18} />
                  <span>Sign Out</span>
                </button>
              </div>
            ) : (
              <button
                onClick={handleAuthClick}
                className="btn-primary"
              >
                Sign In
              </button>
            )}
          </div>

          {/* Mobile Menu Button */}
          <button
            className="md:hidden p-2 rounded-lg hover:bg-white/10 transition-colors duration-200"
            onClick={() => setIsMenuOpen(!isMenuOpen)}
            aria-label="Toggle menu"
          >
            {isMenuOpen ? <X size={24} /> : <Menu size={24} />}
          </button>
        </div>

        {/* Mobile Menu */}
        {isMenuOpen && (
          <div className="md:hidden border-t border-white/10">
            <div className="px-2 pt-2 pb-3 space-y-1">
              {navLinks.map(({ path, label, icon: Icon }) => (
                <Link
                  key={path}
                  to={path}
                  className={`block px-3 py-2 rounded-lg text-base font-medium transition-colors duration-200 ${
                    isActive(path)
                      ? 'bg-blue-600/20 text-blue-400'
                      : 'text-white/80 hover:bg-white/10 hover:text-white'
                  }`}
                  onClick={() => setIsMenuOpen(false)}
                >
                  <div className="flex items-center space-x-2">
                    {Icon && <Icon size={18} />}
                    <span>{label}</span>
                  </div>
                </Link>
              ))}
              
              {/* Mobile User Menu */}
              <div className="border-t border-white/10 pt-2 mt-2">
                {user ? (
                  <>
                    <Link
                      to="/profile"
                      className="block px-3 py-2 rounded-lg text-base font-medium text-white/80 hover:bg-white/10 hover:text-white transition-colors duration-200"
                      onClick={() => setIsMenuOpen(false)}
                    >
                      <div className="flex items-center space-x-2">
                        <User size={18} />
                        <span>{user.username || user.email}</span>
                      </div>
                    </Link>
                    <button
                      onClick={handleSignOut}
                      className="block w-full text-left px-3 py-2 rounded-lg text-base font-medium text-red-400 hover:bg-white/10 hover:text-red-300 transition-colors duration-200"
                    >
                      <div className="flex items-center space-x-2">
                        <LogOut size={18} />
                        <span>Sign Out</span>
                      </div>
                    </button>
                  </>
                ) : (
                  <button
                    onClick={handleAuthClick}
                    className="block w-full text-left px-3 py-2 rounded-lg text-base font-medium bg-gradient-to-r from-blue-600 to-purple-600 text-white hover:from-blue-700 hover:to-purple-700 transition-all duration-300"
                  >
                    Sign In
                  </button>
                )}
              </div>
            </div>
          </div>
        )}
      </div>
    </nav>
  )
}

export default Navbar 