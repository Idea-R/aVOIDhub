import { createContext, useContext } from 'react'
import type { ReactNode } from 'react'
import type { UnifiedUser, GameSession } from '../services/UnifiedAuthService'

interface AuthContextType {
  user: UnifiedUser | null
  setUser: (user: UnifiedUser | null) => void
  showAuthModal: boolean
  setShowAuthModal: (show: boolean) => void
  showProModal: boolean
  setShowProModal: (show: boolean) => void
  gameSession: GameSession | null
  isAuthenticated: boolean
}

const AuthContext = createContext<AuthContextType | undefined>(undefined)

interface AuthProviderProps {
  children?: ReactNode
  value: AuthContextType
}

export const AuthProvider = ({ children, value }: AuthProviderProps) => {
  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  )
}

export const useAuth = () => {
  const context = useContext(AuthContext)
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider')
  }
  return context
}

export default AuthContext 