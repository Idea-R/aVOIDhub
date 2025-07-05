import { Link } from 'react-router-dom'
import { Home, ArrowLeft } from 'lucide-react'

const NotFoundPage = () => {
  return (
    <div className="min-h-screen flex items-center justify-center p-8">
      <div className="text-center max-w-md">
        
        {/* 404 Text */}
        <div className="mb-8">
          <h1 className="text-8xl font-game font-bold glow-text mb-4">404</h1>
          <h2 className="text-3xl font-bold text-white mb-4">Page Not Found</h2>
          <p className="text-white/60 text-lg">
            Looks like you've wandered into the VOID. Let's get you back to the game!
          </p>
        </div>

        {/* Action Buttons */}
        <div className="flex flex-col sm:flex-row gap-4 justify-center">
          <Link 
            to="/" 
            className="btn-primary inline-flex items-center justify-center space-x-2"
          >
            <Home size={20} />
            <span>Back to Home</span>
          </Link>
          
          <button 
            onClick={() => window.history.back()}
            className="btn-secondary inline-flex items-center justify-center space-x-2"
          >
            <ArrowLeft size={20} />
            <span>Go Back</span>
          </button>
        </div>

        {/* Fun Element */}
        <div className="mt-12 p-6 bg-white/5 rounded-2xl border border-white/10">
          <p className="text-white/60 text-sm mb-4">
            While you're here, did you know that aVOIDgame.io features:
          </p>
          <ul className="text-white/80 text-sm space-y-1">
            <li>🎮 Multiple cursor-based games</li>
            <li>🏆 Global leaderboards</li>
            <li>⚡ Real-time score updates</li>
            <li>🎯 Precision gameplay</li>
          </ul>
        </div>
      </div>
    </div>
  )
}

export default NotFoundPage 