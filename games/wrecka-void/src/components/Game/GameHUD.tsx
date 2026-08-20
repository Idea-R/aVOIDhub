import { useState } from "react";
import type { User } from "@supabase/supabase-js";
import { ArrowLeft, HelpCircle, Pause, Volume2, VolumeX } from "lucide-react";
import { GameState } from "../../types/Game";
import { ActiveEffects, PlayerUpgrades } from "../../types/PowerUps";
import { ModalSurface } from "../ui/ModalSurface";

interface GameHUDProps {
  gameState: GameState;
  activeEffects: ActiveEffects;
  playerUpgrades: PlayerUpgrades;
  user: User | null;
  onNavigate: (page: string) => void;
  onToggleHelp: () => void;
  onTogglePause: () => void;
  audioEnabled: boolean;
  onToggleAudio: () => void;
  onExitDialogChange: (open: boolean) => void;
}

export function GameHUD({
  gameState,
  activeEffects,
  playerUpgrades,
  user,
  onNavigate,
  onToggleHelp,
  onTogglePause,
  audioEnabled,
  onToggleAudio,
  onExitDialogChange,
}: GameHUDProps) {
  const [hoveredUpgrade, setHoveredUpgrade] = useState<string | null>(null);
  const [showExitConfirm, setShowExitConfirm] = useState(false);

  const getActiveEffectIcons = () => {
    const icons = [];
    if (activeEffects.berserk)
      icons.push({ icon: "⚡", color: "#ff4488", name: "Berserk" });
    if (activeEffects.tempSpeed)
      icons.push({ icon: "💨", color: "#44ffff", name: "Speed" });
    if (activeEffects.electrified)
      icons.push({ icon: "⚡", color: "#ffff44", name: "Electric" });
    if (activeEffects.hyperSpin)
      icons.push({ icon: "🌀", color: "#aa88ff", name: "Hyper Spin" });
    return icons;
  };

  const handleBackClick = () => {
    setShowExitConfirm(true);
    onExitDialogChange(true);
  };

  const confirmExit = () => {
    onNavigate("home");
  };

  const cancelExit = () => {
    setShowExitConfirm(false);
    onExitDialogChange(false);
  };

  const getPermanentUpgradeIcons = () => {
    const upgrades = [];
    if (playerUpgrades.chainDamage > 0) {
      upgrades.push({
        icon: "⚔️",
        color: "#ff6b6b",
        count: playerUpgrades.chainDamage,
        name: "Chain Damage",
      });
    }
    if (playerUpgrades.ballDamage > 0) {
      upgrades.push({
        icon: "🔨",
        color: "#ff8c42",
        count: playerUpgrades.ballDamage,
        name: "Ball Damage",
      });
    }
    if (playerUpgrades.speedBoost > 0) {
      upgrades.push({
        icon: "💨",
        color: "#45b7d1",
        count: playerUpgrades.speedBoost,
        name: "Speed",
      });
    }
    if (playerUpgrades.ballSize > 0) {
      upgrades.push({
        icon: "🔵",
        color: "#f9ca24",
        count: playerUpgrades.ballSize,
        name: "Ball Size",
      });
    }
    if (playerUpgrades.healthIncrease > 0) {
      upgrades.push({
        icon: "❤️",
        color: "#4ecdc4",
        count: Math.floor(playerUpgrades.healthIncrease / 25),
        name: "Health",
      });
    }
    if (playerUpgrades.chainExtensions > 0) {
      upgrades.push({
        icon: "🔗",
        color: "#888888",
        count: playerUpgrades.chainExtensions,
        name: "Chain Length",
      });
    }
    if (playerUpgrades.hasSecondChain) {
      upgrades.push({
        icon: "⛓️",
        color: "#9b59b6",
        count: 1,
        name: "Second Chain",
      });
    }
    if (playerUpgrades.secondChainDamage > 0) {
      upgrades.push({
        icon: "🗡️",
        color: "#8e44ad",
        count: playerUpgrades.secondChainDamage,
        name: "Second Chain Damage",
      });
    }
    if (playerUpgrades.secondChainSpeed > 0) {
      upgrades.push({
        icon: "🌪️",
        color: "#6c5ce7",
        count: playerUpgrades.secondChainSpeed,
        name: "Second Chain Speed",
      });
    }
    return upgrades;
  };
  return (
    <>
      <div className="relative z-10 h-[calc(2.5rem+env(safe-area-inset-top))] flex-none border-b border-gray-700 bg-gray-900/90 pt-[env(safe-area-inset-top)] backdrop-blur-sm">
        <div className="flex items-center justify-between h-full gap-1 px-2 sm:px-4">
          {/* Left: Back Button, Power-ups and Health */}
          <div className="flex min-w-0 items-center gap-2 sm:gap-4">
            {/* Back Button */}
            <button
              onClick={handleBackClick}
              aria-label="Return to menu"
              className="flex shrink-0 items-center gap-1 rounded-md px-1.5 py-1 text-gray-300 transition-colors hover:bg-gray-800/50 hover:text-white sm:px-2"
            >
              <ArrowLeft className="w-3 h-3" />
              <span className="hidden text-xs sm:inline">Menu</span>
            </button>

            <div className="flex items-center lg:hidden">
              <button
                type="button"
                aria-label="Pause game"
                onClick={onTogglePause}
                className="rounded-md p-1 text-gray-300 transition-colors hover:bg-gray-800/50 hover:text-white"
              >
                <Pause className="h-3.5 w-3.5" />
              </button>
              <button
                type="button"
                aria-label="Show game help"
                onClick={onToggleHelp}
                className="rounded-md p-1 text-gray-300 transition-colors hover:bg-gray-800/50 hover:text-white"
              >
                <HelpCircle className="h-3.5 w-3.5" />
              </button>
            </div>

            <button
              type="button"
              aria-label={
                audioEnabled ? "Mute game audio" : "Enable game audio"
              }
              aria-pressed={audioEnabled}
              onClick={onToggleAudio}
              className="rounded-md p-1 text-gray-300 transition-colors hover:bg-gray-800/50 hover:text-white"
            >
              {audioEnabled ? (
                <Volume2 className="h-3.5 w-3.5" />
              ) : (
                <VolumeX className="h-3.5 w-3.5" />
              )}
            </button>

            {/* Health Bar */}
            <div className="flex min-w-0 items-center gap-1 sm:gap-2">
              <span className="text-white text-xs font-medium">HP:</span>
              <div className="h-2 w-12 overflow-hidden rounded-full bg-gray-700 sm:w-20">
                <div
                  className="h-full bg-gradient-to-r from-red-500 to-green-500 transition-all duration-200"
                  style={{
                    width: `${(gameState.health / gameState.maxHealth) * 100}%`,
                  }}
                />
              </div>
              <span className="text-white text-xs">{gameState.health}</span>
            </div>
          </div>

          {/* Center: Power-ups */}
          <div className="hidden items-center gap-4 md:flex">
            {/* Permanent Upgrades */}
            <div className="flex items-center space-x-0.5">
              {getPermanentUpgradeIcons().map((upgrade, index) => (
                <div
                  key={index}
                  className="relative flex items-center rounded-sm bg-gray-800/40 px-1 py-0.5 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-cyan-300"
                  tabIndex={0}
                  aria-label={`${upgrade.name} level ${upgrade.count}`}
                  onMouseEnter={() => setHoveredUpgrade(upgrade.name)}
                  onMouseLeave={() => setHoveredUpgrade(null)}
                  onFocus={() => setHoveredUpgrade(upgrade.name)}
                  onBlur={() => setHoveredUpgrade(null)}
                >
                  <span className="text-xs" style={{ color: upgrade.color }}>
                    {upgrade.icon}
                  </span>
                  <span className="text-xs text-white font-bold ml-0.5">
                    {upgrade.count}
                  </span>

                  {/* Tooltip */}
                  {hoveredUpgrade === upgrade.name && (
                    <div className="absolute bottom-full left-1/2 transform -translate-x-1/2 mb-2 px-2 py-1 bg-gray-800 text-white text-xs rounded whitespace-nowrap z-50 border border-gray-600">
                      {upgrade.name} +{upgrade.count}
                      <div className="absolute top-full left-1/2 transform -translate-x-1/2 w-0 h-0 border-l-4 border-r-4 border-t-4 border-transparent border-t-gray-800"></div>
                    </div>
                  )}
                </div>
              ))}
            </div>

            {/* Active Effects */}
            <div className="flex items-center space-x-1">
              {getActiveEffectIcons().map((effect, index) => (
                <div
                  key={index}
                  className="flex items-center space-x-0.5 bg-gray-800/60 rounded-md px-1.5 py-0.5"
                >
                  <span className="text-sm" style={{ color: effect.color }}>
                    {effect.icon}
                  </span>
                  <span className="text-xs text-gray-300">{effect.name}</span>
                </div>
              ))}
            </div>
          </div>

          {/* Right: Score, Wave, Time */}
          <div className="flex shrink-0 items-center gap-2 sm:gap-3">
            <div className="text-right">
              <div className="text-sm font-bold text-yellow-400">
                {gameState.score.toLocaleString()}
              </div>
              <div className="hidden text-xs text-gray-400 sm:block">Score</div>
            </div>
            <div className="text-right">
              <div className="text-sm font-bold text-blue-400">
                <span className="sm:hidden">W{gameState.wave}</span>
                <span className="hidden sm:inline">Wave {gameState.wave}</span>
              </div>
              <div className="text-xs text-gray-400">
                {Math.floor(gameState.gameTime)}s
              </div>
            </div>
            <div className="hidden text-right lg:block">
              <div className="text-xs text-gray-300">Press H for help</div>
              {!user && (
                <div className="text-xs text-yellow-400">Guest Mode</div>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Exit Confirmation Modal */}
      {showExitConfirm && (
        <ModalSurface
          labelledBy="wreckavoid-exit-title"
          describedBy="wreckavoid-exit-description"
          onEscape={cancelExit}
          overlayClassName="absolute inset-0 z-50 flex items-center justify-center bg-black/80 p-4 backdrop-blur-sm"
          dialogClassName="w-full max-w-sm rounded-2xl border border-gray-600 bg-gray-900 p-6 text-center shadow-2xl"
        >
            <h3
              id="wreckavoid-exit-title"
              className="mb-4 text-xl font-bold text-white"
            >
              Return to Title Screen?
            </h3>
            <p
              id="wreckavoid-exit-description"
              className="mb-6 text-gray-200"
            >
              Your current game progress will be lost.
            </p>
            <div className="flex space-x-3">
              <button
                onClick={confirmExit}
                className="flex-1 rounded-lg bg-red-600 px-4 py-2 font-semibold text-white transition-colors hover:bg-red-500 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-yellow-300"
              >
                Yes, Exit
              </button>
              <button
                onClick={cancelExit}
                data-autofocus
                className="flex-1 rounded-lg bg-gray-600 px-4 py-2 font-semibold text-white transition-colors hover:bg-gray-500 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-cyan-300"
              >
                Cancel
              </button>
            </div>
        </ModalSurface>
      )}
    </>
  );
}
