import { createContext, useContext } from 'react'
import type { ReactNode } from 'react'
import type { User } from '../lib/supabase'

interface AuthContextType {
  user: User | null
  setUser: (user: User | null) => void
  showAuthModal: boolean
  setShowAuthModal: (show: boolean) => void
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