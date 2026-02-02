import React, { useState, useEffect } from 'react'
import { Camera, Crown, Edit3, Save, X, ExternalLink, Trophy, Gamepad2, TrendingUp } from 'lucide-react'
import { useAuth } from '../../contexts/AuthContext'
import { unifiedAuth } from '../../services/UnifiedAuthService'
import ProUpgradeModal from './ProUpgradeModal'
import { createCustomerPortalSession } from '../../lib/stripe'

interface UserProfileProps {
  userId?: string
}

const UserProfile: React.FC<UserProfileProps> = ({ userId }) => {
  const { user: currentUser } = useAuth()
  const [user] = useState(currentUser)
  const [isEditing, setIsEditing] = useState(false)
  const [showProModal, setShowProModal] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  
  // Edit form state
  const [editForm, setEditForm] = useState({
    display_name: '',
    bio: '',
    country_code: '',
    cursor_color: '#06b6d4',
    social_links: {
      twitter: '',
      instagram: '',
      youtube: '',
      twitch: '',
      github: '',
      website: ''
    }
  })

  const isOwnProfile = !userId || userId === currentUser?.id

  useEffect(() => {
    if (user) {
      setEditForm({
        display_name: user.display_name || '',
        bio: '',
        country_code: user.country_code || '',
        cursor_color: '#06b6d4',
        social_links: {
          twitter: user.social_links?.twitter || '',
          instagram: user.social_links?.instagram || '',
          youtube: user.social_links?.youtube || '',
          twitch: user.social_links?.twitch || '',
          github: user.social_links?.github || '',
          website: user.social_links?.website || ''
        }
      })
    }
  }, [user])

  const handleSaveProfile = async () => {
    if (!user) return
    
    setLoading(true)
    setError('')

          try {
        // Update basic profile info (available to all users)
        const basicUpdates = {
          display_name: editForm.display_name,
          country_code: editForm.country_code
        }

      // Update social links (pro members only)
      if (user.is_pro_member) {
        await unifiedAuth.updateSocialLinks(editForm.social_links)
      }

      // Update other profile fields via Supabase
      // This would typically go through a profile update API
      
      setIsEditing(false)
    } catch (error) {
      setError('Failed to update profile')
      console.error('Profile update error:', error)
    } finally {
      setLoading(false)
    }
  }

  const handleManageSubscription = async () => {
    if (!user?.stripe_customer_id) return
    
    try {
      await createCustomerPortalSession(user.stripe_customer_id)
    } catch (error) {
      setError('Failed to open subscription management')
    }
  }

  const socialPlatforms = [
    { key: 'twitter', label: 'Twitter', icon: '🐦', baseUrl: 'https://twitter.com/' },
    { key: 'instagram', label: 'Instagram', icon: '📷', baseUrl: 'https://instagram.com/' },
    { key: 'youtube', label: 'YouTube', icon: '🎥', baseUrl: 'https://youtube.com/c/' },
    { key: 'twitch', label: 'Twitch', icon: '🎮', baseUrl: 'https://twitch.tv/' },
    { key: 'github', label: 'GitHub', icon: '👨‍💻', baseUrl: 'https://github.com/' },
    { key: 'website', label: 'Website', icon: '🌐', baseUrl: '' }
  ]

  if (!user) {
    return (
      <div className="min-h-screen bg-space flex items-center justify-center">
        <div className="text-center">
          <div className="loading-spinner mb-4" />
          <p className="text-white/60">Loading profile...</p>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-space pt-8 pb-16">
      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
        
        {/* Profile Header */}
        <div className="bg-gradient-to-br from-gray-900/50 to-gray-800/50 border border-white/10 rounded-2xl p-8 mb-8">
          <div className="flex flex-col md:flex-row items-start md:items-center space-y-6 md:space-y-0 md:space-x-8">
            
            {/* Avatar */}
            <div className="relative">
              <div className="w-32 h-32 rounded-2xl bg-gradient-to-br from-blue-500 to-purple-600 flex items-center justify-center text-4xl font-bold text-white border-4 border-white/20">
                {user.avatar_url ? (
                  <img 
                    src={user.avatar_url} 
                    alt={user.display_name || user.username || ''}
                    className="w-full h-full rounded-2xl object-cover"
                  />
                ) : (
                  (user.display_name || user.username || '?')[0]?.toUpperCase()
                )}
              </div>
              {isOwnProfile && (
                <button className="absolute -bottom-2 -right-2 p-2 bg-purple-600 hover:bg-purple-700 rounded-full text-white transition-colors">
                  <Camera size={16} />
                </button>
              )}
            </div>

            {/* Profile Info */}
            <div className="flex-1">
              <div className="flex items-center space-x-3 mb-2">
                <h1 className="text-3xl font-bold text-white">
                  {user.display_name || user.username}
                </h1>
                {user.is_pro_member && (
                  <Crown className="w-8 h-8 text-yellow-500" />
                )}
              </div>
              
              <p className="text-white/60 mb-4">
                @{user.username}
                {user.country_code && (
                  <span className="ml-2 px-2 py-1 bg-white/10 rounded text-xs">
                    {user.country_code}
                  </span>
                )}
              </p>

              {/* Bio section would go here when bio property is added to UnifiedUser */}

              {/* Social Links */}
              {user.is_pro_member && user.social_links && (
                <div className="flex flex-wrap gap-2">
                  {Object.entries(user.social_links)
                    .filter(([_, url]) => url)
                    .map(([platform, url]) => {
                      const platformInfo = socialPlatforms.find(p => p.key === platform)
                      return (
                        <a
                          key={platform}
                          href={url as string}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="flex items-center space-x-2 px-3 py-1 bg-white/10 hover:bg-white/20 rounded-lg text-sm text-white/80 hover:text-white transition-colors"
                        >
                          <span>{platformInfo?.icon}</span>
                          <span>{platformInfo?.label}</span>
                          <ExternalLink size={12} />
                        </a>
                      )
                    })
                  }
                </div>
              )}
            </div>

            {/* Action Buttons */}
            {isOwnProfile && (
              <div className="flex flex-col space-y-3">
                <button
                  onClick={() => setIsEditing(!isEditing)}
                  className="btn-secondary flex items-center space-x-2"
                >
                  <Edit3 size={16} />
                  <span>Edit Profile</span>
                </button>
                
                {!user.is_pro_member ? (
                  <button
                    onClick={() => setShowProModal(true)}
                    className="btn-primary bg-gradient-to-r from-yellow-500 to-amber-500 hover:from-yellow-600 hover:to-amber-600 text-gray-900 flex items-center space-x-2"
                  >
                    <Crown size={16} />
                    <span>Upgrade to Pro</span>
                  </button>
                ) : (
                  <button
                    onClick={handleManageSubscription}
                    className="btn-secondary flex items-center space-x-2"
                  >
                    <Crown size={16} />
                    <span>Manage Pro</span>
                  </button>
                )}
              </div>
            )}
          </div>
        </div>

        {/* Edit Profile Form */}
        {isEditing && isOwnProfile && (
          <div className="bg-gradient-to-br from-gray-900/50 to-gray-800/50 border border-white/10 rounded-2xl p-8 mb-8">
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-2xl font-bold text-white">Edit Profile</h2>
              <button
                onClick={() => setIsEditing(false)}
                className="p-2 text-white/60 hover:text-white transition-colors"
              >
                <X size={20} />
              </button>
            </div>

            {error && (
              <div className="mb-6 p-4 bg-red-500/10 border border-red-500/20 rounded-lg text-red-400">
                {error}
              </div>
            )}

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {/* Basic Info */}
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-white/80 mb-2">
                    Display Name
                  </label>
                  <input
                    type="text"
                    value={editForm.display_name}
                    onChange={(e) => setEditForm(prev => ({ ...prev, display_name: e.target.value }))}
                    className="w-full p-3 bg-white/10 border border-white/20 rounded-lg text-white placeholder-white/60 focus:outline-none focus:border-purple-500"
                    placeholder="Your display name"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-white/80 mb-2">
                    Bio
                  </label>
                  <textarea
                    value={editForm.bio}
                    onChange={(e) => setEditForm(prev => ({ ...prev, bio: e.target.value }))}
                    rows={3}
                    className="w-full p-3 bg-white/10 border border-white/20 rounded-lg text-white placeholder-white/60 focus:outline-none focus:border-purple-500 resize-none"
                    placeholder="Tell us about yourself..."
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-white/80 mb-2">
                    Country
                  </label>
                  <input
                    type="text"
                    value={editForm.country_code}
                    onChange={(e) => setEditForm(prev => ({ ...prev, country_code: e.target.value }))}
                    className="w-full p-3 bg-white/10 border border-white/20 rounded-lg text-white placeholder-white/60 focus:outline-none focus:border-purple-500"
                    placeholder="US, CA, UK, etc."
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-white/80 mb-2">
                    Cursor Color
                  </label>
                  <input
                    type="color"
                    value={editForm.cursor_color}
                    onChange={(e) => setEditForm(prev => ({ ...prev, cursor_color: e.target.value }))}
                    className="w-full h-12 bg-white/10 border border-white/20 rounded-lg focus:outline-none focus:border-purple-500"
                  />
                </div>
              </div>

              {/* Social Links (Pro Only) */}
              <div className="space-y-4">
                <div className="flex items-center space-x-2 mb-4">
                  <h3 className="text-lg font-semibold text-white">Social Links</h3>
                  {!user.is_pro_member && (
                    <div className="flex items-center space-x-2 text-yellow-500">
                      <Crown size={16} />
                      <span className="text-sm">Pro Only</span>
                    </div>
                  )}
                </div>
                
                {socialPlatforms.map((platform) => (
                  <div key={platform.key}>
                    <label className="block text-sm font-medium text-white/80 mb-2">
                      {platform.icon} {platform.label}
                    </label>
                    <input
                      type="text"
                      value={editForm.social_links[platform.key as keyof typeof editForm.social_links]}
                      onChange={(e) => setEditForm(prev => ({
                        ...prev,
                        social_links: {
                          ...prev.social_links,
                          [platform.key]: e.target.value
                        }
                      }))}
                      disabled={!user.is_pro_member}
                      className={`w-full p-3 border rounded-lg text-white placeholder-white/60 focus:outline-none focus:border-purple-500 ${
                        user.is_pro_member 
                          ? 'bg-white/10 border-white/20' 
                          : 'bg-white/5 border-white/10 cursor-not-allowed'
                      }`}
                      placeholder={platform.baseUrl ? `${platform.baseUrl}yourusername` : 'https://yourwebsite.com'}
                    />
                  </div>
                ))}
              </div>
            </div>

            <div className="flex items-center justify-end space-x-4 mt-8">
              <button
                onClick={() => setIsEditing(false)}
                className="btn-secondary"
              >
                Cancel
              </button>
              <button
                onClick={handleSaveProfile}
                disabled={loading}
                className="btn-primary flex items-center space-x-2"
              >
                {loading ? (
                  <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                ) : (
                  <Save size={16} />
                )}
                <span>Save Changes</span>
              </button>
            </div>
          </div>
        )}

        {/* Stats Cards */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
          <div className="bg-gradient-to-br from-blue-600/10 to-blue-800/10 border border-blue-500/20 rounded-xl p-6">
            <div className="flex items-center justify-between mb-4">
              <Trophy className="w-8 h-8 text-blue-400" />
              <span className="text-2xl font-bold text-blue-400">
                {Math.max(user.voidavoid_best_score || 0, user.wreckavoid_best_score || 0, user.tankavoid_best_score || 0).toLocaleString()}
              </span>
            </div>
            <h3 className="font-semibold text-white mb-1">Best Score</h3>
            <p className="text-sm text-white/60">Personal record</p>
          </div>
          
          <div className="bg-gradient-to-br from-purple-600/10 to-purple-800/10 border border-purple-500/20 rounded-xl p-6">
            <div className="flex items-center justify-between mb-4">
              <Gamepad2 className="w-8 h-8 text-purple-400" />
              <span className="text-2xl font-bold text-purple-400">
                {user.total_games_played || 0}
              </span>
            </div>
            <h3 className="font-semibold text-white mb-1">Games Played</h3>
            <p className="text-sm text-white/60">Total sessions</p>
          </div>
          
          <div className="bg-gradient-to-br from-green-600/10 to-green-800/10 border border-green-500/20 rounded-xl p-6">
            <div className="flex items-center justify-between mb-4">
              <TrendingUp className="w-8 h-8 text-green-400" />
              <span className="text-2xl font-bold text-green-400">
                {user.total_games_played > 0 
                  ? Math.round(Math.max(user.voidavoid_best_score || 0, user.wreckavoid_best_score || 0, user.tankavoid_best_score || 0) / user.total_games_played)
                  : 0
                }
              </span>
            </div>
            <h3 className="font-semibold text-white mb-1">Average Score</h3>
            <p className="text-sm text-white/60">Performance metric</p>
          </div>
        </div>

        {/* Pro Upgrade Modal */}
        <ProUpgradeModal
          isOpen={showProModal}
          onClose={() => setShowProModal(false)}
        />
      </div>
    </div>
  )
}

export default UserProfile
