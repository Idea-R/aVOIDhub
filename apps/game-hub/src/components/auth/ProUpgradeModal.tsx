import React, { useState } from 'react'
import { X, Crown, Zap, Trophy, Star, Shield, Rocket } from 'lucide-react'
import { STRIPE_CONFIG, createCheckoutSession } from '../../lib/stripe'
import { useAuth } from '../../contexts/AuthContext'

interface ProUpgradeModalProps {
  isOpen: boolean
  onClose: () => void
}

const ProUpgradeModal: React.FC<ProUpgradeModalProps> = ({ isOpen, onClose }) => {
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const { user } = useAuth()

  if (!isOpen) return null

  const handleUpgrade = async () => {
    if (!user) {
      setError('Please sign in to upgrade to Pro')
      return
    }

    setLoading(true)
    setError('')

    try {
      await createCheckoutSession(STRIPE_CONFIG.PRO_PRICE_ID, user.id)
    } catch (error) {
      setError('Failed to start upgrade process. Please try again.')
      console.error('Upgrade error:', error)
    } finally {
      setLoading(false)
    }
  }

  const features = [
    {
      icon: <Zap className="w-5 h-5" />,
      title: 'Ad-Free Experience',
      description: 'Enjoy all games without any advertisements'
    },
    {
      icon: <Trophy className="w-5 h-5" />,
      title: 'Global Leaderboards',
      description: 'Compete on the exclusive global rankings'
    },
    {
      icon: <Star className="w-5 h-5" />,
      title: 'Social Media Links',
      description: 'Showcase your social profiles on your game profile'
    },
    {
      icon: <Crown className="w-5 h-5" />,
      title: 'Pro Member Badge',
      description: 'Display your supporter status with a golden crown'
    },
    {
      icon: <Shield className="w-5 h-5" />,
      title: 'Priority Support',
      description: 'Get faster help when you need assistance'
    },
    {
      icon: <Rocket className="w-5 h-5" />,
      title: 'Early Access',
      description: 'Play new games before everyone else'
    }
  ]

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm">
      <div className="relative w-full max-w-2xl mx-4 bg-gradient-to-br from-gray-900 to-gray-800 border border-yellow-500/30 rounded-2xl shadow-2xl overflow-hidden">
        {/* Header Glow Effect */}
        <div className="absolute inset-0 bg-gradient-to-br from-yellow-500/10 to-purple-500/10 pointer-events-none" />
        
        {/* Close Button */}
        <button
          onClick={onClose}
          className="absolute top-4 right-4 z-10 p-2 text-white/60 hover:text-white transition-colors"
        >
          <X size={20} />
        </button>

        <div className="relative p-8">
          {/* Header */}
          <div className="text-center mb-8">
            <div className="inline-flex items-center justify-center p-4 bg-gradient-to-br from-yellow-500/20 to-amber-500/20 rounded-2xl mb-4">
              <Crown className="w-12 h-12 text-yellow-500" />
            </div>
            <h2 className="text-3xl font-bold text-transparent bg-clip-text bg-gradient-to-r from-yellow-400 to-amber-500 mb-2">
              Upgrade to aVOID Pro
            </h2>
            <p className="text-white/70 text-lg">
              Support the games you love and unlock exclusive features
            </p>
          </div>

          {/* Pricing */}
          <div className="text-center mb-8">
            <div className="inline-block bg-gradient-to-r from-yellow-500/20 to-amber-500/20 border border-yellow-500/30 rounded-2xl p-6">
              <div className="text-4xl font-bold text-white mb-2">
                {STRIPE_CONFIG.PRO_PRICE}
                <span className="text-lg text-white/60 font-normal">/month</span>
              </div>
              <div className="text-yellow-400 font-medium">
                {STRIPE_CONFIG.TRIAL_DAYS}-day free trial
              </div>
            </div>
          </div>

          {/* Features Grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-8">
            {features.map((feature, index) => (
              <div
                key={index}
                className="flex items-start space-x-3 p-4 bg-white/5 border border-white/10 rounded-lg hover:bg-white/10 transition-colors"
              >
                <div className="flex-shrink-0 p-2 bg-yellow-500/20 rounded-lg text-yellow-400">
                  {feature.icon}
                </div>
                <div>
                  <h4 className="font-semibold text-white mb-1">{feature.title}</h4>
                  <p className="text-sm text-white/60">{feature.description}</p>
                </div>
              </div>
            ))}
          </div>

          {/* Error Message */}
          {error && (
            <div className="mb-6 p-4 bg-red-500/10 border border-red-500/20 rounded-lg text-red-400 text-center">
              {error}
            </div>
          )}

          {/* CTA Buttons */}
          <div className="space-y-4">
            <button
              onClick={handleUpgrade}
              disabled={loading}
              className="w-full py-4 bg-gradient-to-r from-yellow-500 to-amber-500 hover:from-yellow-600 hover:to-amber-600 text-gray-900 font-bold rounded-xl transition-all transform hover:scale-105 disabled:opacity-50 disabled:cursor-not-allowed disabled:transform-none flex items-center justify-center space-x-2"
            >
              {loading ? (
                <div className="w-6 h-6 border-2 border-gray-900/30 border-t-gray-900 rounded-full animate-spin" />
              ) : (
                <>
                  <Crown size={20} />
                  <span>Start {STRIPE_CONFIG.TRIAL_DAYS}-Day Free Trial</span>
                </>
              )}
            </button>
            
            <p className="text-center text-xs text-white/50">
              Cancel anytime. No commitment. Secure payment via Stripe.
            </p>
          </div>

          {/* Pro Benefits Summary */}
          <div className="mt-8 pt-6 border-t border-white/10">
            <div className="text-center">
              <h3 className="text-lg font-semibold text-white mb-3">Why Go Pro?</h3>
              <p className="text-white/60 text-sm leading-relaxed">
                Your subscription directly supports the development of new games, 
                server costs, and keeping the aVOID gaming experience free for everyone. 
                Plus, you get awesome perks!
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

export default ProUpgradeModal
