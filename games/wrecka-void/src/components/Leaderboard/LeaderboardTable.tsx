import React from 'react';
import { Trophy, Medal, Award, User, Clock, Zap } from 'lucide-react';
import { GameScore } from '../../lib/supabase';
import { useAuth } from '../../hooks/useAuth';

interface LeaderboardTableProps {
  scores: GameScore[];
  loading: boolean;
}

export function LeaderboardTable({ scores, loading }: LeaderboardTableProps) {
  const { user } = useAuth();
  
  const getRankIcon = (rank: number) => {
    switch (rank) {
      case 1:
        return <Trophy className="w-6 h-6 text-yellow-400" />;
      case 2:
        return <Medal className="w-6 h-6 text-gray-400" />;
      case 3:
        return <Award className="w-6 h-6 text-amber-600" />;
      default:
        return <span className="w-6 h-6 flex items-center justify-center text-gray-400 font-bold">{rank}</span>;
    }
  };

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  if (loading) {
    return (
      <div className="bg-gray-800/50 rounded-lg p-8">
        <div className="animate-pulse space-y-4">
          {[...Array(10)].map((_, i) => (
            <div key={i} className="flex items-center space-x-4">
              <div className="w-8 h-8 bg-gray-700 rounded"></div>
              <div className="flex-1 h-4 bg-gray-700 rounded"></div>
              <div className="w-20 h-4 bg-gray-700 rounded"></div>
            </div>
          ))}
        </div>
      </div>
    );
  }

  if (scores.length === 0) {
    return (
      <div className="bg-gray-800/50 rounded-lg p-8 text-center">
        <Trophy className="w-16 h-16 text-gray-600 mx-auto mb-4" />
        <h3 className="text-xl font-semibold text-gray-300 mb-2">No Scores Yet</h3>
        <p className="text-gray-400 mb-4">Be the first to set a high score!</p>
        {!user && (
          <div className="bg-blue-900/20 border border-blue-600/30 rounded-lg p-4 max-w-md mx-auto">
            <p className="text-blue-300 text-sm">
              Sign in to save your scores and compete on the leaderboard!
            </p>
          </div>
        )}
      </div>
    );
  }

  return (
    <div className="bg-gray-800/50 rounded-lg overflow-hidden">
      <div className="p-6 border-b border-gray-700">
        <h2 className="text-2xl font-bold text-white flex items-center space-x-2">
          <Trophy className="w-8 h-8 text-yellow-400" />
          <span>Global Leaderboard</span>
        </h2>
        {!user && (
          <div className="mt-3 bg-blue-900/20 border border-blue-600/30 rounded-lg p-3">
            <p className="text-blue-300 text-sm">
              <strong>Playing as guest:</strong> Your scores won't appear here. Sign in to compete!
            </p>
          </div>
        )}
      </div>
      
      <div className="overflow-x-auto">
        <table className="w-full">
          <thead className="bg-gray-700/50">
            <tr>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-300 uppercase tracking-wider">
                Rank
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-300 uppercase tracking-wider">
                Player
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-300 uppercase tracking-wider">
                Score
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-300 uppercase tracking-wider">
                Wave
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-300 uppercase tracking-wider">
                Time
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-300 uppercase tracking-wider">
                Date
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-700">
            {scores.map((score, index) => (
              <tr key={score.id} className="hover:bg-gray-700/30 transition-colors">
                <td className="px-6 py-4 whitespace-nowrap">
                  <div className="flex items-center">
                    {getRankIcon(index + 1)}
                  </div>
                </td>
                <td className="px-6 py-4 whitespace-nowrap">
                  <div className="flex items-center space-x-3">
                    <div className="w-8 h-8 bg-gray-600 rounded-full flex items-center justify-center">
                      <User className="w-4 h-4 text-gray-300" />
                    </div>
                    <div>
                      <div className="text-sm font-medium text-white">
                        {score.user_profile?.username || 'Anonymous'}
                      </div>
                      {score.user_profile?.bio && (
                        <div className="text-xs text-gray-400 truncate max-w-32">
                          {score.user_profile.bio}
                        </div>
                      )}
                    </div>
                  </div>
                </td>
                <td className="px-6 py-4 whitespace-nowrap">
                  <div className="text-lg font-bold text-yellow-400">
                    {score.score.toLocaleString()}
                  </div>
                </td>
                <td className="px-6 py-4 whitespace-nowrap">
                  <div className="flex items-center space-x-1 text-blue-400">
                    <Zap className="w-4 h-4" />
                    <span className="font-semibold">{score.wave}</span>
                  </div>
                </td>
                <td className="px-6 py-4 whitespace-nowrap">
                  <div className="flex items-center space-x-1 text-green-400">
                    <Clock className="w-4 h-4" />
                    <span>{formatTime(score.survival_time)}</span>
                  </div>
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-400">
                  {new Date(score.created_at).toLocaleDateString()}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}