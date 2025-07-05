import React from 'react';
import { ArrowLeft } from 'lucide-react';
import { useLeaderboard } from '../hooks/useLeaderboard';
import { LeaderboardTable } from '../components/Leaderboard/LeaderboardTable';

interface LeaderboardPageProps {
  onNavigate: (page: string) => void;
}

export function LeaderboardPage({ onNavigate }: LeaderboardPageProps) {
  const { scores, loading } = useLeaderboard();

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-900 via-blue-900/20 to-gray-900">
      <div className="container mx-auto px-4 py-8">
        <div className="flex items-center justify-between mb-8">
          <button
            onClick={() => onNavigate('home')}
            className="flex items-center space-x-2 px-4 py-2 text-gray-300 hover:text-white transition-colors"
          >
            <ArrowLeft className="w-5 h-5" />
            <span>Back to Menu</span>
          </button>
          
          <h1 className="text-3xl font-bold text-white">Global Leaderboard</h1>
          
          <div className="w-24"></div> {/* Spacer for centering */}
        </div>
        
        <div className="max-w-6xl mx-auto">
          <LeaderboardTable scores={scores} loading={loading} />
        </div>
      </div>
    </div>
  );
}