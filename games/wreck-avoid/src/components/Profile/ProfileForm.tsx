import React, { useState, useEffect } from 'react';
import { User, Save, Twitter, Youtube, Twitch, Instagram, AlertCircle, CheckCircle } from 'lucide-react';
import { useProfile } from '../../hooks/useProfile';
import { User as SupabaseUser } from '@supabase/supabase-js';

interface ProfileFormProps {
  user: SupabaseUser;
}

export function ProfileForm({ user }: ProfileFormProps) {
  const { profile, loading, updateProfile } = useProfile(user);
  const [formData, setFormData] = useState({
    username: '',
    bio: '',
    twitter: '',
    youtube: '',
    twitch: '',
    instagram: '',
  });
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  useEffect(() => {
    if (profile) {
      setFormData({
        username: profile.username || '',
        bio: profile.bio || '',
        twitter: profile.twitter || '',
        youtube: profile.youtube || '',
        twitch: profile.twitch || '',
        instagram: profile.instagram || '',
      });
    }
  }, [profile]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setMessage(null);

    const { error } = await updateProfile(formData);

    if (error) {
      setMessage({ type: 'error', text: 'Failed to update profile. Please try again.' });
    } else {
      setMessage({ type: 'success', text: 'Profile updated successfully!' });
    }

    setSaving(false);
  };

  const handleInputChange = (field: string, value: string) => {
    setFormData(prev => ({ ...prev, [field]: value }));
  };

  if (loading) {
    return (
      <div className="bg-gray-800/50 rounded-lg p-8">
        <div className="animate-pulse space-y-6">
          <div className="h-4 bg-gray-700 rounded w-1/4"></div>
          <div className="h-10 bg-gray-700 rounded"></div>
          <div className="h-4 bg-gray-700 rounded w-1/4"></div>
          <div className="h-20 bg-gray-700 rounded"></div>
          <div className="space-y-4">
            {[...Array(4)].map((_, i) => (
              <div key={i} className="h-10 bg-gray-700 rounded"></div>
            ))}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-gray-800/50 rounded-lg p-6">
      <div className="flex items-center space-x-3 mb-6">
        <User className="w-8 h-8 text-blue-400" />
        <h2 className="text-2xl font-bold text-white">Profile Settings</h2>
      </div>

      <form onSubmit={handleSubmit} className="space-y-6">
        <div>
          <label htmlFor="username" className="block text-sm font-medium text-gray-300 mb-2">
            Username *
          </label>
          <input
            id="username"
            type="text"
            value={formData.username}
            onChange={(e) => handleInputChange('username', e.target.value)}
            className="w-full px-4 py-3 bg-gray-700/50 border border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent text-white placeholder-gray-400"
            placeholder="Enter your username"
            required
            maxLength={50}
          />
        </div>

        <div>
          <label htmlFor="bio" className="block text-sm font-medium text-gray-300 mb-2">
            Bio
          </label>
          <textarea
            id="bio"
            value={formData.bio}
            onChange={(e) => handleInputChange('bio', e.target.value)}
            className="w-full px-4 py-3 bg-gray-700/50 border border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent text-white placeholder-gray-400 resize-none"
            placeholder="Tell us about yourself..."
            rows={3}
            maxLength={200}
          />
          <div className="text-xs text-gray-400 mt-1">
            {formData.bio.length}/200 characters
          </div>
        </div>

        <div className="space-y-4">
          <h3 className="text-lg font-semibold text-white">Social Media Links</h3>
          
          <div>
            <label htmlFor="twitter" className="block text-sm font-medium text-gray-300 mb-2">
              <div className="flex items-center space-x-2">
                <Twitter className="w-4 h-4 text-blue-400" />
                <span>Twitter</span>
              </div>
            </label>
            <input
              id="twitter"
              type="url"
              value={formData.twitter}
              onChange={(e) => handleInputChange('twitter', e.target.value)}
              className="w-full px-4 py-3 bg-gray-700/50 border border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent text-white placeholder-gray-400"
              placeholder="https://twitter.com/username"
            />
          </div>

          <div>
            <label htmlFor="youtube" className="block text-sm font-medium text-gray-300 mb-2">
              <div className="flex items-center space-x-2">
                <Youtube className="w-4 h-4 text-red-400" />
                <span>YouTube</span>
              </div>
            </label>
            <input
              id="youtube"
              type="url"
              value={formData.youtube}
              onChange={(e) => handleInputChange('youtube', e.target.value)}
              className="w-full px-4 py-3 bg-gray-700/50 border border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent text-white placeholder-gray-400"
              placeholder="https://youtube.com/channel/username"
            />
          </div>

          <div>
            <label htmlFor="twitch" className="block text-sm font-medium text-gray-300 mb-2">
              <div className="flex items-center space-x-2">
                <Twitch className="w-4 h-4 text-purple-400" />
                <span>Twitch</span>
              </div>
            </label>
            <input
              id="twitch"
              type="url"
              value={formData.twitch}
              onChange={(e) => handleInputChange('twitch', e.target.value)}
              className="w-full px-4 py-3 bg-gray-700/50 border border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent text-white placeholder-gray-400"
              placeholder="https://twitch.tv/username"
            />
          </div>

          <div>
            <label htmlFor="instagram" className="block text-sm font-medium text-gray-300 mb-2">
              <div className="flex items-center space-x-2">
                <Instagram className="w-4 h-4 text-pink-400" />
                <span>Instagram</span>
              </div>
            </label>
            <input
              id="instagram"
              type="url"
              value={formData.instagram}
              onChange={(e) => handleInputChange('instagram', e.target.value)}
              className="w-full px-4 py-3 bg-gray-700/50 border border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent text-white placeholder-gray-400"
              placeholder="https://instagram.com/username"
            />
          </div>
        </div>

        {message && (
          <div className={`flex items-center space-x-2 p-3 rounded-lg ${
            message.type === 'success' ? 'bg-green-900/20 text-green-400' : 'bg-red-900/20 text-red-400'
          }`}>
            {message.type === 'success' ? (
              <CheckCircle className="w-4 h-4" />
            ) : (
              <AlertCircle className="w-4 h-4" />
            )}
            <span className="text-sm">{message.text}</span>
          </div>
        )}

        <button
          type="submit"
          disabled={saving || !formData.username.trim()}
          className="w-full bg-blue-600 hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed text-white font-semibold py-3 px-4 rounded-lg transition-colors duration-200 flex items-center justify-center space-x-2"
        >
          <Save className="w-4 h-4" />
          <span>{saving ? 'Saving...' : 'Save Profile'}</span>
        </button>
      </form>
    </div>
  );
}