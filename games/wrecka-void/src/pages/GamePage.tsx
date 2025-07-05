import React from 'react';
import { GameEngine } from '../components/Game/GameEngine';

interface GamePageProps {
  onNavigate: (page: string) => void;
}

export function GamePage({ onNavigate }: GamePageProps) {
  return (
    <div className="min-h-screen bg-gray-900 overflow-hidden">
      <GameEngine onNavigate={onNavigate} />
    </div>
  );
}