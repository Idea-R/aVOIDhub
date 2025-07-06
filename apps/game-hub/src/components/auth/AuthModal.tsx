import React, { useState } from 'react'
import { X, Mail, Lock, User, LogIn, UserPlus } from 'lucide-react'
import { unifiedAuth } from '../../services/UnifiedAuthService'

interface AuthModalProps {
  isOpen: boolean
  onClose: () => void
  defaultMode?: 'login' | 'signup'
}

const AuthModal: React.FC<AuthModalProps> = ({ isOpen, onClose, defaultMode = 'login' }) => {
  const [mode, setMode] = useState<'login' | 'signup'>(defaultMode)
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [username, setUsername] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')

  if (!isOpen) return null

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    setError('')
    setSuccess('')

    try {
      if (mode === 'login') {
        const result = await unifiedAuth.signIn(email, password)
        if (result.success) {
          setSuccess('Successfully signed in!')
          setTimeout(() => {
            onClose()
            resetForm()
          }, 1000)
        } else {
          setError(result.error || 'Failed to sign in')
        }
      } else {
        const result = await unifiedAuth.signUp(email, password, username)
        if (result.success) {
          setSuccess('Account created! Check your email to verify.')
          setTimeout(() => {
            onClose()
            resetForm()
          }, 2000)
        } else {
          setError(result.error || 'Failed to create account')
        }
      }
    } catch (error) {
      setError('An unexpected error occurred')
    } finally {
      setLoading(false)
    }
  }

  const handleGoogleSignIn = async () => {
    setLoading(true)
    setError('')
    
    try {
      const result = await unifiedAuth.signInWithGoogle()
      if (result.success) {
        setSuccess('Redirecting to Google...')
      } else {
        setError(result.error || 'Failed to sign in with Google')
      }
    } catch (error) {
      setError('An unexpected error occurred')
    } finally {
      setLoading(false)
    }
  }

  const resetForm = () => {
    setEmail('')
    setPassword('')
    setUsername('')
    setError('')
    setSuccess('')
  }

  const switchMode = () => {
    setMode(mode === 'login' ? 'signup' : 'login')
    resetForm()
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm">
      <div className="relative w-full max-w-md mx-4 bg-gray-900 border border-purple-500/20 rounded-2xl shadow-2xl">
        {/* Close Button */}
        <button
          onClick={onClose}
          className="absolute top-4 right-4 p-2 text-white/60 hover:text-white transition-colors"
        >
          <X size={20} />
        </button>

        {/* Header */}
        <div className="p-8 pb-6">
          <div className="text-center mb-6">
            <h2 className="text-3xl font-bold glow-text mb-2">
              {mode === 'login' ? 'Welcome Back' : 'Join aVOID'}
            </h2>
            <p className="text-white/60">
              {mode === 'login' 
                ? 'Sign in to save your scores and track progress across all games'
                : 'Create an account to compete on leaderboards and unlock achievements'
              }
            </p>
          </div>

          {/* Error/Success Messages */}
          {error && (
            <div className="mb-4 p-3 bg-red-500/10 border border-red-500/20 rounded-lg text-red-400 text-sm">
              {error}
            </div>
          )}
          {success && (
            <div className="mb-4 p-3 bg-green-500/10 border border-green-500/20 rounded-lg text-green-400 text-sm">
              {success}
            </div>
          )}

          {/* Google Sign In */}
          <button
            onClick={handleGoogleSignIn}
            disabled={loading}
            className="w-full mb-6 p-3 bg-white text-gray-900 rounded-lg font-medium hover:bg-gray-100 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center space-x-3 group"
          >
            <svg className="w-5 h-5" viewBox="0 0 24 24">
              <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
              <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
              <path fill="#FBBC04" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/>
              <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
            </svg>
            <span className="group-hover:text-gray-700 transition-colors">
              Continue with Google
            </span>
            {loading && (
              <div className="w-4 h-4 border-2 border-gray-600/30 border-t-gray-600 rounded-full animate-spin ml-2" />
            )}
          </button>

          <div className="relative mb-6">
            <div className="absolute inset-0 flex items-center">
              <div className="w-full border-t border-white/20"></div>
            </div>
            <div className="relative flex justify-center text-sm">
              <span className="px-2 bg-gray-900 text-white/60">or</span>
            </div>
          </div>

          {/* Form */}
          <form onSubmit={handleSubmit} className="space-y-4">
            {mode === 'signup' && (
              <div>
                <label className="block text-sm font-medium text-white/80 mb-2">
                  <User size={16} className="inline mr-2" />
                  Username
                </label>
                <input
                  type="text"
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  className="w-full p-3 bg-white/10 border border-white/20 rounded-lg text-white placeholder-white/60 focus:outline-none focus:border-purple-500"
                  placeholder="Choose a username"
                  required={mode === 'signup'}
                />
              </div>
            )}

            <div>
              <label className="block text-sm font-medium text-white/80 mb-2">
                <Mail size={16} className="inline mr-2" />
                Email
              </label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full p-3 bg-white/10 border border-white/20 rounded-lg text-white placeholder-white/60 focus:outline-none focus:border-purple-500"
                placeholder="Enter your email"
                required
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-white/80 mb-2">
                <Lock size={16} className="inline mr-2" />
                Password
              </label>
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full p-3 bg-white/10 border border-white/20 rounded-lg text-white placeholder-white/60 focus:outline-none focus:border-purple-500"
                placeholder="Enter your password"
                required
                minLength={6}
              />
              {mode === 'signup' && (
                <p className="mt-1 text-xs text-white/60">
                  Password must be at least 6 characters
                </p>
              )}
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full btn-primary disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center space-x-2"
            >
              {loading ? (
                <div className="loading-spinner w-5 h-5"></div>
              ) : (
                <>
                  {mode === 'login' ? <LogIn size={18} /> : <UserPlus size={18} />}
                  <span>{mode === 'login' ? 'Sign In' : 'Create Account'}</span>
                </>
              )}
            </button>
          </form>

          {/* Switch Mode */}
          <div className="mt-6 text-center">
            <p className="text-white/60">
              {mode === 'login' ? "Don't have an account?" : "Already have an account?"}
              {' '}
              <button
                onClick={switchMode}
                className="text-purple-400 hover:text-purple-300 font-medium transition-colors"
              >
                {mode === 'login' ? 'Sign up' : 'Sign in'}
              </button>
            </p>
          </div>
        </div>
      </div>
    </div>
  )
}

export default AuthModal 