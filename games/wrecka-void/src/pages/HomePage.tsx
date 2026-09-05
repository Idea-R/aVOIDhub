import { useState } from "react";
import {
  Play,
  Trophy,
  User,
  Settings,
  Zap,
  Shield,
  Gauge,
  Sparkles,
  Bug,
  Mail,
  Heart,
  Twitter,
} from "lucide-react";
import { usePlatformPlayer } from "../hooks/usePlatformPlayer";
import { SupportModal } from "../components/Support/SupportModal";
import logoImage from "../assets/wreckavoid-logo.webp";
import { WRECKAVOID_SIGN_IN_PATH } from "../platformAuth";

interface HomePageProps {
  onNavigate: (page: string) => void;
}

export function HomePage({ onNavigate }: HomePageProps) {
  const {
    player: user,
    cosmetics,
    cosmetic,
    selectCosmetic,
  } = usePlatformPlayer();
  const [showSupportModal, setShowSupportModal] = useState(false);

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-900 via-red-900/20 to-gray-900 relative overflow-hidden">
      {/* Animated background elements */}
      <div className="absolute inset-0">
        <div className="absolute top-1/4 left-1/4 w-64 h-64 bg-red-500/10 rounded-full blur-3xl animate-pulse"></div>
        <div className="absolute bottom-1/4 right-1/4 w-48 h-48 bg-orange-500/10 rounded-full blur-3xl animate-pulse delay-1000"></div>
        <div className="absolute top-3/4 left-1/2 w-32 h-32 bg-yellow-500/10 rounded-full blur-3xl animate-pulse delay-2000"></div>
      </div>

      <div className="relative z-10 container mx-auto px-4 py-8">
        {/* Header */}
        <header className="mb-12 flex flex-col items-center justify-between gap-3 sm:mb-16 sm:flex-row sm:gap-6">
          <div className="flex shrink-0 items-center">
            <img
              src={logoImage}
              alt="WreckaVOID"
              width="192"
              height="192"
              decoding="async"
              className="h-28 w-28 shrink-0 sm:h-48 sm:w-48"
            />
          </div>

          <nav className="grid w-full grid-cols-[minmax(0,1fr)_auto] items-center gap-3 sm:flex sm:w-auto sm:gap-4">
            {user ? (
              <>
                <a
                  href="/leaderboards/?game=wreckavoid"
                  className="flex min-w-0 items-center justify-center gap-2 rounded-lg bg-gradient-to-r from-yellow-500 to-yellow-600 px-4 py-3 font-bold text-black shadow-lg transition-all duration-200 hover:scale-105 hover:from-yellow-400 hover:to-yellow-500 sm:px-6"
                >
                  <Trophy className="w-5 h-5 text-yellow-900" />
                  <span>Leaderboard</span>
                </a>
                <a
                  href="/account/"
                  className="flex items-center justify-center gap-2 px-3 py-2 text-gray-300 transition-colors hover:text-white sm:px-4"
                >
                  <User className="w-5 h-5" />
                  <span>Profile</span>
                </a>
              </>
            ) : (
              <>
                <a
                  href="/leaderboards/?game=wreckavoid"
                  className="flex min-w-0 items-center justify-center gap-2 rounded-lg bg-gradient-to-r from-yellow-500 to-yellow-600 px-4 py-3 font-bold text-black shadow-lg transition-all duration-200 hover:scale-105 hover:from-yellow-400 hover:to-yellow-500 sm:px-6"
                >
                  <Trophy className="w-5 h-5 text-yellow-900" />
                  <span>Leaderboard</span>
                </a>
                <a
                  href={WRECKAVOID_SIGN_IN_PATH}
                  className="rounded-lg bg-gradient-to-r from-blue-500 to-blue-600 px-4 py-3 text-center font-bold text-white shadow-lg transition-all duration-200 hover:scale-105 hover:from-blue-400 hover:to-blue-500 sm:px-6"
                >
                  Sign In
                </a>
              </>
            )}
          </nav>
        </header>

        {/* Hero Section */}
        <div className="max-w-4xl mx-auto text-center mb-16">
          <h2 className="mb-6 text-5xl font-bold leading-tight text-white sm:text-6xl">
            Swing Your Way to
            <span className="text-transparent bg-clip-text bg-gradient-to-r from-red-400 to-orange-400">
              {" "}
              Victory
            </span>
          </h2>
          <p className="text-xl text-gray-300 mb-12 max-w-2xl mx-auto">
            Master the physics of destruction in this intense wrecking ball
            survival game. Swing through waves of enemies and climb to the top
            of the global leaderboard.
          </p>

          <div className="flex flex-col sm:flex-row gap-4 justify-center items-center">
            <button
              onClick={() => onNavigate("game")}
              className="inline-flex items-center space-x-3 px-8 py-4 bg-gradient-to-r from-red-500 to-orange-500 hover:from-red-400 hover:to-orange-400 text-white font-bold text-lg rounded-xl transform hover:scale-105 transition-all duration-200 shadow-2xl"
            >
              <Play className="w-6 h-6" />
              <span>Play Now</span>
            </button>

            {!user && (
              <div className="text-center bg-gray-800/60 backdrop-blur-sm border border-gray-600 rounded-lg p-4 max-w-sm">
                <div className="flex items-center justify-center space-x-2 mb-3">
                  <div className="w-3 h-3 bg-yellow-400 rounded-full animate-pulse"></div>
                  <p className="text-yellow-300 font-semibold text-sm">
                    Guest Mode Active
                  </p>
                </div>
                <p className="text-gray-300 text-sm mb-3">
                  Your scores won't be saved to the leaderboard
                </p>
                <button
                  onClick={() =>
                    (window.location.href = WRECKAVOID_SIGN_IN_PATH)
                  }
                  className="px-4 py-2 bg-gradient-to-r from-blue-500 to-blue-600 hover:from-blue-400 hover:to-blue-500 text-white font-semibold text-sm rounded-lg transition-all duration-200 transform hover:scale-105 shadow-md"
                >
                  Sign In to Save Scores
                </button>
              </div>
            )}
          </div>

          <section
            className="mx-auto mt-8 max-w-2xl border-y border-white/15 py-5"
            aria-label="Wrecking rig cosmetics"
          >
            <div className="mb-3 flex items-end justify-between gap-4 text-left">
              <div>
                <p className="text-[10px] font-black uppercase tracking-[0.24em] text-cyan-300">
                  Wrecking rig
                </p>
                <h3 className="mt-1 text-xl font-black text-white">
                  Pick the metal you bring into the yard.
                </h3>
              </div>
              <a
                href="/membership/"
                className="shrink-0 text-xs font-bold text-orange-300 hover:text-orange-200"
              >
                Membership
              </a>
            </div>
            <div className="grid gap-3 sm:grid-cols-2">
              {(
                cosmetics?.wreckavoid ?? [
                  {
                    id: "standard" as const,
                    name: "Yard steel",
                    description: "The original cold-steel wrecking rig.",
                    unlocked: true,
                  },
                  {
                    id: "founder-ember" as const,
                    name: "Founder ember",
                    description:
                      "A supporter cosmetic loaded from your platform membership.",
                    unlocked: false,
                  },
                ]
              ).map((option) => (
                <button
                  key={option.id}
                  type="button"
                  disabled={!option.unlocked}
                  aria-pressed={cosmetic === option.id}
                  onClick={() => selectCosmetic(option.id)}
                  className={`group relative overflow-hidden border px-4 py-3 text-left transition-all ${cosmetic === option.id ? "-translate-y-1 border-cyan-300 bg-cyan-300/15 shadow-[0_6px_0_#0f766e]" : "border-white/15 bg-gray-950/55 hover:border-orange-300"} disabled:cursor-not-allowed disabled:opacity-45`}
                >
                  <span
                    className={`absolute inset-y-0 left-0 w-2 ${option.id === "founder-ember" ? "bg-gradient-to-b from-orange-400 to-cyan-400" : "bg-gray-500"}`}
                  />
                  <strong className="block pl-2 text-sm text-white">
                    {option.name}
                  </strong>
                  <small className="mt-1 block pl-2 text-xs leading-5 text-gray-400">
                    {option.unlocked
                      ? option.description
                      : "Founding Player unlock"}
                  </small>
                </button>
              ))}
            </div>
          </section>
        </div>

        {/* Features Grid */}
        <div className="grid md:grid-cols-3 gap-8 max-w-6xl mx-auto mb-16">
          <div className="bg-gray-800/50 backdrop-blur-sm border border-gray-700 rounded-xl p-6">
            <div className="w-12 h-12 bg-red-600/20 rounded-lg flex items-center justify-center mb-4">
              <Settings className="w-6 h-6 text-red-400" />
            </div>
            <h3 className="text-xl font-semibold text-white mb-3">
              Realistic Physics
            </h3>
            <p className="text-gray-400">
              Experience authentic chain and ball physics with momentum,
              tension, and realistic collision dynamics.
            </p>
          </div>

          <div className="bg-gray-800/50 backdrop-blur-sm border border-gray-700 rounded-xl p-6">
            <div className="w-12 h-12 bg-orange-600/20 rounded-lg flex items-center justify-center mb-4">
              <Trophy className="w-6 h-6 text-orange-400" />
            </div>
            <h3 className="text-xl font-semibold text-white mb-3">
              Global Competition
            </h3>
            <p className="text-gray-400">
              Compete against players worldwide on our real-time leaderboard.
              Can you reach the top?
            </p>
          </div>

          <div className="bg-gray-800/50 backdrop-blur-sm border border-gray-700 rounded-xl p-6">
            <div className="w-12 h-12 bg-yellow-600/20 rounded-lg flex items-center justify-center mb-4">
              <Play className="w-6 h-6 text-yellow-400" />
            </div>
            <h3 className="text-xl font-semibold text-white mb-3">
              A Run You Can Finish
            </h3>
            <p className="text-gray-400">
              Break twenty timed waves and three boss checkpoints. Ten minutes
              gets you to the final fight; the last boss decides the run.
            </p>
          </div>
        </div>

        {/* Compact Game Info Section */}
        <div className="max-w-6xl mx-auto mb-16 grid md:grid-cols-2 gap-8">
          {/* How to Play */}
          <div className="bg-gray-800/40 backdrop-blur-sm border border-gray-700 rounded-xl p-6">
            <h3 className="text-2xl font-bold text-white mb-4 flex items-center">
              <Play className="w-6 h-6 mr-2 text-orange-400" />
              How to Play
            </h3>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <h4 className="font-semibold text-orange-400 mb-2 text-sm">
                  Controls
                </h4>
                <ul className="text-gray-300 space-y-1 text-sm">
                  <li>• Mouse to move</li>
                  <li>• Hold to retract</li>
                  <li>• Space to pause</li>
                </ul>
              </div>
              <div>
                <h4 className="font-semibold text-orange-400 mb-2 text-sm">
                  Strategy
                </h4>
                <ul className="text-gray-300 space-y-1 text-sm">
                  <li>• Swing ball to destroy</li>
                  <li>• Chain damages basics</li>
                  <li>• Collect power-ups</li>
                </ul>
              </div>
            </div>
          </div>

          {/* Power-ups */}
          <div className="bg-gray-800/40 backdrop-blur-sm border border-gray-700 rounded-xl p-6">
            <h3 className="text-2xl font-bold text-white mb-4 flex items-center">
              <Sparkles className="w-6 h-6 mr-2 text-purple-400" />
              Power-Up System
            </h3>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <h4 className="font-semibold text-blue-400 mb-2 text-sm flex items-center">
                  <Shield className="w-4 h-4 mr-1" />
                  Permanent
                </h4>
                <div className="space-y-1 text-sm">
                  <div className="flex items-center space-x-2">
                    <Zap className="w-3 h-3 text-red-400" />
                    <span className="text-gray-300">Damage</span>
                  </div>
                  <div className="flex items-center space-x-2">
                    <Shield className="w-3 h-3 text-green-400" />
                    <span className="text-gray-300">Health</span>
                  </div>
                  <div className="flex items-center space-x-2">
                    <Gauge className="w-3 h-3 text-blue-400" />
                    <span className="text-gray-300">Speed</span>
                  </div>
                </div>
              </div>
              <div>
                <h4 className="font-semibold text-purple-400 mb-2 text-sm flex items-center">
                  <Sparkles className="w-4 h-4 mr-1" />
                  Temporary
                </h4>
                <div className="space-y-1 text-sm">
                  <div className="flex items-center space-x-2">
                    <div className="w-3 h-3 bg-pink-400 rounded-full"></div>
                    <span className="text-gray-300">Berserk</span>
                  </div>
                  <div className="flex items-center space-x-2">
                    <div className="w-3 h-3 bg-cyan-400 rounded-full"></div>
                    <span className="text-gray-300">Speed Burst</span>
                  </div>
                  <div className="flex items-center space-x-2">
                    <div className="w-3 h-3 bg-yellow-400 rounded-full"></div>
                    <span className="text-gray-300">Electric</span>
                  </div>
                </div>
              </div>
            </div>
            <p className="text-gray-400 text-xs mt-3">
              Collect upgrades to enhance your wrecking ball and survive longer
              waves of enemies.
            </p>
          </div>
        </div>
      </div>

      {/* Footer */}
      <footer className="relative z-10 bg-gray-900/80 backdrop-blur-sm border-t border-gray-700 mt-16">
        <div className="container mx-auto px-4 py-8">
          <div className="grid md:grid-cols-4 gap-8">
            {/* Game Info */}
            <div>
              <h4 className="text-white font-bold mb-3">WreckaVOID</h4>
              <p className="text-gray-400 text-sm mb-3">
                An aVOID game by Ideas Realized
              </p>
              <p className="text-gray-400 text-xs">
                Like the game? Want more of it? Support the creator.
              </p>
            </div>

            {/* Support */}
            <div>
              <h4 className="text-white font-semibold mb-3">Support</h4>
              <div className="space-y-2">
                <button
                  onClick={() => setShowSupportModal(true)}
                  className="flex items-center space-x-2 text-pink-400 hover:text-pink-300 transition-colors text-sm"
                >
                  <Heart className="w-4 h-4" />
                  <span>Support the Dev</span>
                </button>
                <a
                  href="mailto:support@madxent.com"
                  className="flex items-center space-x-2 text-gray-400 hover:text-white transition-colors text-sm"
                >
                  <Mail className="w-4 h-4" />
                  <span>Contact</span>
                </a>
              </div>
            </div>

            {/* Help */}
            <div>
              <h4 className="text-white font-semibold mb-3">Help</h4>
              <div className="space-y-2">
                <a
                  href="mailto:bugs@madxent.com"
                  className="flex items-center space-x-2 text-gray-400 hover:text-white transition-colors text-sm"
                >
                  <Bug className="w-4 h-4" />
                  <span>Report Bugs</span>
                </a>
                <a
                  href="mailto:support@madxent.com"
                  className="flex items-center space-x-2 text-gray-400 hover:text-white transition-colors text-sm"
                >
                  <Mail className="w-4 h-4" />
                  <span>Support</span>
                </a>
              </div>
            </div>

            {/* Social */}
            <div>
              <h4 className="text-white font-semibold mb-3">Follow Us</h4>
              <div className="space-y-2">
                <a
                  href="https://x.com/Xentrilo"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center space-x-2 text-blue-400 hover:text-blue-300 transition-colors text-sm"
                >
                  <Twitter className="w-4 h-4" />
                  <span>Twitter/X</span>
                </a>
              </div>
            </div>
          </div>

          {/* Bottom Bar */}
          <div className="border-t border-gray-700 mt-8 pt-6 text-center">
            <p className="text-gray-400 text-sm">
              © 2026 Ideas Realized. All rights reserved. |
              <span className="text-purple-400 ml-1">
                More aVOID games coming soon!
              </span>
            </p>
          </div>
        </div>
      </footer>

      <SupportModal
        isOpen={showSupportModal}
        onClose={() => setShowSupportModal(false)}
      />
    </div>
  );
}
