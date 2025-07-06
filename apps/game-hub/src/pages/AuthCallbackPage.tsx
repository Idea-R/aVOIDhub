import { useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'

const AuthCallbackPage = () => {
  const navigate = useNavigate()

  useEffect(() => {
    const handleAuthCallback = async () => {
      try {
        // Get the session from the URL hash
        const { data, error } = await supabase?.auth.getSession()
        
        if (error) {
          console.error('Auth callback error:', error)
          navigate('/?error=auth_failed')
          return
        }

        if (data?.session) {
          // Successfully authenticated
          console.log('Auth successful:', data.session.user)
          navigate('/')
        } else {
          // No session found
          navigate('/?error=no_session')
        }
      } catch (error) {
        console.error('Auth callback error:', error)
        navigate('/?error=callback_failed')
      }
    }

    handleAuthCallback()
  }, [navigate])

  return (
    <div className="min-h-screen bg-gray-900 flex items-center justify-center">
      <div className="text-center">
        <div className="loading-spinner w-8 h-8 mx-auto mb-4"></div>
        <p className="text-white">Completing sign in...</p>
      </div>
    </div>
  )
}

export default AuthCallbackPage
