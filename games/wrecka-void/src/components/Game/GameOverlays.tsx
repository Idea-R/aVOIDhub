import { useState } from "react";
import type { User } from "@supabase/supabase-js";
import { Share2, Copy, CheckCircle } from "lucide-react";
import { GameState } from "../../types/Game";
import logoImage from "../../assets/ChatGPT Image Jun 28, 2025, 12_39_11 PM.png";

interface GameOverlaysProps {
  gameState: GameState;
  showHelp: boolean;
  user: User | null;
  onToggleHelp: () => void;
  onTogglePause: () => void;
  onRestartGame: () => void;
}

export function GameOverlays({
  gameState,
  showHelp,
  user,
  onToggleHelp,
  onTogglePause,
  onRestartGame,
}: GameOverlaysProps) {
  const [shareStatus, setShareStatus] = useState<"idle" | "copied" | "shared">(
    "idle",
  );

  const generateShareText = () => {
    const minutes = Math.floor(gameState.gameTime / 60);
    const seconds = Math.floor(gameState.gameTime % 60);
    const timeText = minutes > 0 ? `${minutes}m ${seconds}s` : `${seconds}s`;
    const bossesKilled = Math.floor(gameState.wave / 10); // Rough estimate based on boss spawn rate

    return `🎮 Just survived ${timeText} in WreckaVOID! 

📊 Final Stats:
• Score: ${gameState.score.toLocaleString()}
• Wave: ${gameState.wave}
• Bosses Defeated: ${bossesKilled}
• Survival Time: ${timeText}

💪 Join the aVOID Game Leaderboards! Sign up and prove your worth!

#WreckaVOID #Gaming #Leaderboard`;
  };

  const handleCopyShare = async () => {
    try {
      await navigator.clipboard.writeText(generateShareText());
      setShareStatus("copied");
      setTimeout(() => setShareStatus("idle"), 2000);
    } catch (error) {
      console.error("Failed to copy to clipboard:", error);
    }
  };

  const handleTwitterShare = () => {
    const shareText = generateShareText();
    const twitterUrl = `https://twitter.com/intent/tweet?text=${encodeURIComponent(shareText)}`;
    window.open(twitterUrl, "_blank", "width=550,height=420");
    setShareStatus("shared");
    setTimeout(() => setShareStatus("idle"), 2000);
  };

  return (
    <>
      {/* Help Modal */}
      {showHelp && (
        <div className="absolute inset-0 bg-black/80 backdrop-blur-sm flex items-center justify-center z-50">
          <div className="bg-gray-900 p-8 rounded-lg text-center max-w-md border border-gray-700">
            <h2 className="text-2xl font-bold text-white mb-6">How to Play</h2>
            <div className="space-y-3 text-gray-300 text-left">
              <div>
                <strong>Mouse or touch:</strong> Control character
              </div>
              <div>
                <strong>Hold:</strong> Retract chain
              </div>
              <div>
                <strong>Space:</strong> Pause game
              </div>
              <div>
                <strong>H:</strong> Toggle this help
              </div>
              <div className="text-gray-400 text-sm mt-4">
                • Swing the ball to destroy enemies
                <br />
                • Chain damages basic enemies only
                <br />
                • Collect power-ups for upgrades
                <br />• Survive as long as possible!
              </div>
            </div>
            <button
              onClick={onToggleHelp}
              className="mt-6 bg-blue-600 hover:bg-blue-700 text-white font-semibold py-2 px-6 rounded-lg transition-colors"
            >
              Close
            </button>
          </div>
        </div>
      )}

      {/* Pause overlay */}
      {gameState.isPaused && !gameState.isGameOver && (
        <div className="absolute inset-0 bg-black/80 flex items-center justify-center backdrop-blur-sm z-40">
          <div className="bg-gray-900 p-8 rounded-lg text-center border border-gray-700">
            <div className="flex justify-center mb-6">
              <img src={logoImage} alt="WreckaVOID" className="w-40 h-40" />
            </div>
            <h2 className="text-3xl font-bold text-white mb-6">Game Paused</h2>
            <button
              onClick={onTogglePause}
              className="bg-blue-600 hover:bg-blue-700 text-white font-semibold py-3 px-8 rounded-lg transition-colors"
            >
              Resume Game
            </button>
          </div>
        </div>
      )}

      {/* Game over overlay */}
      {gameState.isGameOver && (
        <div className="absolute inset-0 z-40 flex items-center justify-center overflow-y-auto bg-black/90 p-3 backdrop-blur-sm sm:p-6">
          <div className="my-auto w-full max-w-md rounded-lg border border-gray-700 bg-gray-900 p-4 text-center sm:p-8">
            <h2 className="mb-3 text-3xl font-bold text-red-400 sm:mb-6 sm:text-4xl">
              Game Over!
            </h2>
            <div className="mb-4 space-y-2 text-gray-300 sm:mb-8 sm:space-y-3">
              <div className="text-xl font-bold text-yellow-400 sm:text-2xl">
                Final Score: {gameState.score.toLocaleString()}
              </div>
              <div>Wave Reached: {gameState.wave}</div>
              <div>Time Survived: {Math.floor(gameState.gameTime)}s</div>
              {!user && (
                <div className="mt-2 rounded-lg border border-yellow-600/30 bg-yellow-900/20 p-2 text-sm text-yellow-400 sm:mt-4 sm:p-3">
                  <p className="font-semibold mb-1">
                    Score not saved - Guest Mode
                  </p>
                  <p className="text-xs">
                    Sign in to save your scores to the leaderboard!
                  </p>
                </div>
              )}
            </div>
            <div className="space-y-3">
              {/* Share buttons for guest users */}
              {!user && (
                <div className="mb-2 rounded-lg border border-gray-600 bg-gray-800/60 p-3 sm:mb-4 sm:p-4">
                  <h4 className="mb-2 text-center font-semibold text-white sm:mb-3">
                    Share Your Score!
                  </h4>
                  <div className="flex space-x-2">
                    <button
                      onClick={handleCopyShare}
                      className="flex-1 flex items-center justify-center space-x-2 bg-gray-700 hover:bg-gray-600 text-white font-semibold py-2 px-3 rounded-lg transition-colors text-sm"
                    >
                      {shareStatus === "copied" ? (
                        <>
                          <CheckCircle className="w-4 h-4 text-green-400" />
                          <span>Copied!</span>
                        </>
                      ) : (
                        <>
                          <Copy className="w-4 h-4" />
                          <span>Copy</span>
                        </>
                      )}
                    </button>
                    <button
                      onClick={handleTwitterShare}
                      className="flex-1 flex items-center justify-center space-x-2 bg-blue-600 hover:bg-blue-700 text-white font-semibold py-2 px-3 rounded-lg transition-colors text-sm"
                    >
                      {shareStatus === "shared" ? (
                        <>
                          <CheckCircle className="w-4 h-4 text-green-400" />
                          <span>Shared!</span>
                        </>
                      ) : (
                        <>
                          <Share2 className="w-4 h-4" />
                          <span>Tweet</span>
                        </>
                      )}
                    </button>
                  </div>
                  <p className="mt-2 text-center text-xs text-gray-400">
                    Share your achievement and challenge your friends!
                  </p>
                </div>
              )}

              <button
                onClick={onRestartGame}
                className="w-full bg-red-600 hover:bg-red-700 text-white font-semibold py-3 px-6 rounded-lg transition-colors"
              >
                Play Again
              </button>
              {!user && (
                <button
                  onClick={() => (window.location.href = "/")}
                  className="w-full bg-blue-600 hover:bg-blue-700 text-white font-semibold py-2 px-6 rounded-lg transition-colors text-sm"
                >
                  Sign In to Save Scores
                </button>
              )}
            </div>
          </div>
        </div>
      )}
    </>
  );
}
