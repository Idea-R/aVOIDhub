import { useState } from "react";
import { Share2, Copy, CheckCircle } from "lucide-react";
import type { PlatformPlayer } from "../../api/playerContext";
import { GameState } from "../../types/Game";
import { ModalSurface } from "../ui/ModalSurface";
import logoImage from "../../assets/wreckavoid-logo.webp";

interface GameOverlaysProps {
  gameState: GameState;
  showHelp: boolean;
  user: PlatformPlayer | null;
  exitDialogOpen: boolean;
  viewportSupported: boolean;
  onToggleHelp: () => void;
  onTogglePause: () => void;
  onRestartGame: () => void;
}

export function GameOverlays({
  gameState,
  showHelp,
  user,
  exitDialogOpen,
  viewportSupported,
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
    const won = gameState.runOutcome === "victory";

    return `🎮 ${won ? "I cleared Wreck Run" : `I survived ${timeText}`} in WreckaVOID!

📊 Final Stats:
• Score: ${gameState.score.toLocaleString()}
• Wave: ${gameState.wave}
• Bosses Defeated: ${gameState.bossesDefeated}/3
• Survival Time: ${timeText}

Think you can go farther? Meet me on the aVOID leaderboard.

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
        <ModalSurface
          labelledBy="wreckavoid-help-title"
          describedBy="wreckavoid-help-description"
          onEscape={onToggleHelp}
          overlayClassName="absolute inset-0 z-50 flex items-center justify-center bg-black/80 p-4 backdrop-blur-sm"
          dialogClassName="max-h-full w-full max-w-md overflow-y-auto rounded-2xl border border-gray-600 bg-gray-900 p-6 text-center shadow-2xl sm:p-8"
        >
          <h2
            id="wreckavoid-help-title"
            className="mb-6 text-2xl font-bold text-white"
          >
            How to Play
          </h2>
          <div
            id="wreckavoid-help-description"
            className="space-y-3 text-left text-gray-200"
          >
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
              <br />• Break all three bosses to clear Wreck Run
            </div>
          </div>
          <button
            onClick={onToggleHelp}
            data-autofocus
            className="mt-6 rounded-lg bg-blue-600 px-6 py-2 font-semibold text-white transition-colors hover:bg-blue-500 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-cyan-300"
          >
            Close
          </button>
        </ModalSurface>
      )}

      {/* Pause overlay */}
      {gameState.isPaused &&
        !gameState.isGameOver &&
        !showHelp &&
        !exitDialogOpen &&
        viewportSupported && (
          <ModalSurface
            labelledBy="wreckavoid-pause-title"
            onEscape={onTogglePause}
            overlayClassName="absolute inset-0 z-40 flex items-center justify-center bg-black/80 p-4 backdrop-blur-sm"
            dialogClassName="w-full max-w-sm rounded-2xl border border-gray-600 bg-gray-900 p-6 text-center shadow-2xl sm:p-8"
          >
            <div className="flex justify-center mb-6">
              <img
                src={logoImage}
                alt=""
                aria-hidden="true"
                width="160"
                height="160"
                decoding="async"
                className="h-32 w-32 sm:h-40 sm:w-40"
              />
            </div>
            <h2
              id="wreckavoid-pause-title"
              className="mb-6 text-3xl font-bold text-white"
            >
              Game Paused
            </h2>
            <button
              onClick={onTogglePause}
              data-autofocus
              className="rounded-lg bg-blue-600 px-8 py-3 font-semibold text-white transition-colors hover:bg-blue-500 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-cyan-300"
            >
              Resume Game
            </button>
          </ModalSurface>
        )}

      {/* Game over overlay */}
      {gameState.isGameOver && (
        <ModalSurface
          labelledBy="wreckavoid-result-title"
          describedBy="wreckavoid-result-summary"
          overlayClassName="absolute inset-0 z-40 flex items-center justify-center overflow-y-auto bg-black/90 p-3 backdrop-blur-sm sm:p-6"
          dialogClassName="my-auto max-h-full w-full max-w-md overflow-y-auto rounded-2xl border border-gray-600 bg-gray-900 p-4 text-center shadow-2xl sm:p-8"
        >
          <h2
            id="wreckavoid-result-title"
            className={`mb-3 text-3xl font-bold sm:mb-6 sm:text-4xl ${gameState.runOutcome === "victory" ? "text-cyan-300" : "text-red-300"}`}
          >
            {gameState.runOutcome === "victory"
              ? "Wreck Run Complete!"
              : "Wrecked!"}
          </h2>
          <div
            id="wreckavoid-result-summary"
            className="mb-4 space-y-2 text-gray-200 sm:mb-8 sm:space-y-3"
          >
            <div className="text-xl font-bold text-yellow-300 sm:text-2xl">
              Final Score: {gameState.score.toLocaleString()}
            </div>
            <div>Wave Reached: {gameState.wave}</div>
            <div>Bosses Broken: {gameState.bossesDefeated}/3</div>
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
                    className="flex flex-1 items-center justify-center space-x-2 rounded-lg bg-gray-700 px-3 py-2 text-sm font-semibold text-white transition-colors hover:bg-gray-600 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-cyan-300"
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
                    className="flex flex-1 items-center justify-center space-x-2 rounded-lg bg-blue-600 px-3 py-2 text-sm font-semibold text-white transition-colors hover:bg-blue-500 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-cyan-300"
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
              data-autofocus
              className="w-full rounded-lg bg-red-600 px-6 py-3 font-semibold text-white transition-colors hover:bg-red-500 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-yellow-300"
            >
              {gameState.runOutcome === "victory" ? "Run It Back" : "Try Again"}
            </button>
            {!user && (
              <button
                onClick={() =>
                  (window.location.href = "/login/?returnTo=%2Fwreckavoid%2F")
                }
                className="w-full rounded-lg bg-blue-600 px-6 py-2 text-sm font-semibold text-white transition-colors hover:bg-blue-500 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-cyan-300"
              >
                Sign In to Save Scores
              </button>
            )}
          </div>
          <p className="sr-only" aria-live="polite" aria-atomic="true">
            {shareStatus === "copied"
              ? "Score copied to clipboard."
              : shareStatus === "shared"
                ? "Share window opened."
                : ""}
          </p>
        </ModalSurface>
      )}
    </>
  );
}
