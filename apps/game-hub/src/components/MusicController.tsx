import React, { useState, useEffect } from 'react'
import { 
  Play, 
  Pause, 
  SkipForward, 
  SkipBack, 
  Volume2, 
  VolumeX, 
  Music,
  Shuffle,
  List
} from 'lucide-react'
import { unifiedMusic } from '@avoid/shared'

interface MusicControllerProps {
  gameKey?: string
  className?: string
  compact?: boolean
}

const MusicController: React.FC<MusicControllerProps> = ({ 
  gameKey = 'hub', 
  className = '',
  compact = false 
}) => {
  const [musicState, setMusicState] = useState(unifiedMusic.getState())
  const [isExpanded, setIsExpanded] = useState(false)
  const [showPlaylist, setShowPlaylist] = useState(false)

  useEffect(() => {
    // Initialize music for current game
    unifiedMusic.initializeForGame(gameKey)

    // Listen for music state changes
    const updateState = () => setMusicState(unifiedMusic.getState())
    
    unifiedMusic.on('track-started', updateState)
    unifiedMusic.on('track-paused', updateState)
    unifiedMusic.on('track-resumed', updateState)
    unifiedMusic.on('track-stopped', updateState)
    unifiedMusic.on('volume-changed', updateState)
    unifiedMusic.on('mute-toggled', updateState)
    unifiedMusic.on('playlist-changed', updateState)

    return () => {
      unifiedMusic.off('track-started', updateState)
      unifiedMusic.off('track-paused', updateState)
      unifiedMusic.off('track-resumed', updateState)
      unifiedMusic.off('track-stopped', updateState)
      unifiedMusic.off('volume-changed', updateState)
      unifiedMusic.off('mute-toggled', updateState)
      unifiedMusic.off('playlist-changed', updateState)
    }
  }, [gameKey])

  const handlePlayPause = () => {
    if (musicState.isPlaying) {
      unifiedMusic.pause()
    } else {
      unifiedMusic.resume()
    }
  }

  const handleVolumeToggle = () => {
    unifiedMusic.toggleMute()
  }

  const handleVolumeChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const volume = parseFloat(e.target.value)
    unifiedMusic.setVolume(volume)
  }

  const handleTrackSelect = (trackId: string) => {
    unifiedMusic.playTrack(trackId)
    setShowPlaylist(false)
  }

  const handleShuffle = () => {
    unifiedMusic.shufflePlaylist()
  }

  if (compact) {
    return (
      <div className={`music-controller compact ${className}`}>
        <div className="flex items-center space-x-2 bg-black/20 backdrop-blur-sm rounded-lg p-2">
          <button
            onClick={handlePlayPause}
            className="p-2 rounded-full bg-purple-600 hover:bg-purple-700 transition-colors"
            title={musicState.isPlaying ? 'Pause' : 'Play'}
          >
            {musicState.isPlaying ? <Pause size={16} /> : <Play size={16} />}
          </button>
          
          <button
            onClick={handleVolumeToggle}
            className="p-2 rounded-full hover:bg-white/10 transition-colors"
            title={musicState.isMuted ? 'Unmute' : 'Mute'}
          >
            {musicState.isMuted ? <VolumeX size={16} /> : <Volume2 size={16} />}
          </button>

          {musicState.currentTrack && (
            <div className="text-sm text-white/80 truncate max-w-[120px]">
              {musicState.currentTrack.name}
            </div>
          )}

          <button
            onClick={() => setIsExpanded(!isExpanded)}
            className="p-2 rounded-full hover:bg-white/10 transition-colors"
            title="Expand music controls"
          >
            <Music size={16} />
          </button>
        </div>

        {isExpanded && (
          <div className="absolute bottom-full mb-2 right-0 bg-gray-900 border border-purple-500/20 rounded-xl p-4 shadow-2xl min-w-[300px] z-50">
            <FullMusicControls 
              musicState={musicState}
              showPlaylist={showPlaylist}
              setShowPlaylist={setShowPlaylist}
              handlePlayPause={handlePlayPause}
              handleVolumeToggle={handleVolumeToggle}
              handleVolumeChange={handleVolumeChange}
              handleTrackSelect={handleTrackSelect}
              handleShuffle={handleShuffle}
            />
          </div>
        )}
      </div>
    )
  }

  return (
    <div className={`music-controller ${className}`}>
      <div className="bg-gray-900 border border-purple-500/20 rounded-xl p-4 shadow-xl">
        <FullMusicControls 
          musicState={musicState}
          showPlaylist={showPlaylist}
          setShowPlaylist={setShowPlaylist}
          handlePlayPause={handlePlayPause}
          handleVolumeToggle={handleVolumeToggle}
          handleVolumeChange={handleVolumeChange}
          handleTrackSelect={handleTrackSelect}
          handleShuffle={handleShuffle}
        />
      </div>
    </div>
  )
}

interface FullMusicControlsProps {
  musicState: any
  showPlaylist: boolean
  setShowPlaylist: (show: boolean) => void
  handlePlayPause: () => void
  handleVolumeToggle: () => void
  handleVolumeChange: (e: React.ChangeEvent<HTMLInputElement>) => void
  handleTrackSelect: (trackId: string) => void
  handleShuffle: () => void
}

const FullMusicControls: React.FC<FullMusicControlsProps> = ({
  musicState,
  showPlaylist,
  setShowPlaylist,
  handlePlayPause,
  handleVolumeToggle,
  handleVolumeChange,
  handleTrackSelect,
  handleShuffle
}) => {
  return (
    <>
      {/* Current Track Info */}
      <div className="mb-4">
        <div className="flex items-center space-x-2 mb-2">
          <Music className="text-purple-400" size={20} />
          <span className="text-white font-medium">Now Playing</span>
        </div>
        {musicState.currentTrack ? (
          <div className="text-center">
            <div className="text-white font-bold text-lg mb-1">
              {musicState.currentTrack.name}
            </div>
            <div className="text-white/60 text-sm">
              {musicState.currentTrack.artist}
            </div>
            {musicState.currentTrack.genre && (
              <div className="text-purple-400 text-xs mt-1">
                {musicState.currentTrack.genre}
              </div>
            )}
          </div>
        ) : (
          <div className="text-white/60 text-center py-4">
            No track selected
          </div>
        )}
      </div>

      {/* Playback Controls */}
      <div className="flex items-center justify-center space-x-4 mb-4">
        <button
          onClick={handleShuffle}
          className="p-2 rounded-full hover:bg-white/10 transition-colors"
          title="Shuffle playlist"
        >
          <Shuffle size={18} className="text-white/70 hover:text-white" />
        </button>

        <button
          onClick={() => unifiedMusic.playPrevious()}
          className="p-2 rounded-full hover:bg-white/10 transition-colors"
          title="Previous track"
        >
          <SkipBack size={20} className="text-white" />
        </button>

        <button
          onClick={handlePlayPause}
          className="p-3 rounded-full bg-purple-600 hover:bg-purple-700 transition-colors"
          title={musicState.isPlaying ? 'Pause' : 'Play'}
        >
          {musicState.isPlaying ? <Pause size={24} /> : <Play size={24} />}
        </button>

        <button
          onClick={() => unifiedMusic.playNext()}
          className="p-2 rounded-full hover:bg-white/10 transition-colors"
          title="Next track"
        >
          <SkipForward size={20} className="text-white" />
        </button>

        <button
          onClick={() => setShowPlaylist(!showPlaylist)}
          className="p-2 rounded-full hover:bg-white/10 transition-colors"
          title="Toggle playlist"
        >
          <List size={18} className="text-white/70 hover:text-white" />
        </button>
      </div>

      {/* Volume Controls */}
      <div className="mb-4">
        <div className="flex items-center space-x-3">
          <button
            onClick={handleVolumeToggle}
            className="p-1 rounded hover:bg-white/10 transition-colors"
          >
            {musicState.isMuted ? (
              <VolumeX size={18} className="text-white/70" />
            ) : (
              <Volume2 size={18} className="text-white/70" />
            )}
          </button>
          
          <div className="flex-1">
            <input
              type="range"
              min="0"
              max="1"
              step="0.1"
              value={musicState.isMuted ? 0 : musicState.volume}
              onChange={handleVolumeChange}
              className="w-full h-2 bg-gray-700 rounded-lg appearance-none cursor-pointer slider"
              disabled={musicState.isMuted}
            />
          </div>
          
          <span className="text-white/60 text-sm min-w-[30px]">
            {Math.round((musicState.isMuted ? 0 : musicState.volume) * 100)}%
          </span>
        </div>
      </div>

      {/* Playlist */}
      {showPlaylist && (
        <div className="border-t border-white/10 pt-4">
          <div className="text-white font-medium mb-3">Playlist</div>
          <div className="space-y-2 max-h-48 overflow-y-auto">
            {musicState.playlist.map((track: any, index: number) => (
              <button
                key={track.id}
                onClick={() => handleTrackSelect(track.id)}
                className={`w-full p-2 rounded-lg text-left transition-colors ${
                  musicState.currentTrack?.id === track.id
                    ? 'bg-purple-600/20 border border-purple-500/30'
                    : 'hover:bg-white/5'
                }`}
              >
                <div className="flex items-center space-x-3">
                  <div className="w-6 h-6 flex items-center justify-center">
                    {musicState.currentTrack?.id === track.id && musicState.isPlaying ? (
                      <div className="w-2 h-2 bg-purple-400 rounded-full animate-pulse" />
                    ) : (
                      <span className="text-white/40 text-xs">
                        {index + 1}
                      </span>
                    )}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className={`text-sm truncate ${
                      musicState.currentTrack?.id === track.id 
                        ? 'text-purple-300 font-medium' 
                        : 'text-white'
                    }`}>
                      {track.name}
                    </div>
                    <div className="text-xs text-white/60 truncate">
                      {track.artist}
                    </div>
                  </div>
                  {track.genre && (
                    <div className="text-xs text-purple-400 px-2 py-1 bg-purple-500/10 rounded">
                      {track.genre}
                    </div>
                  )}
                </div>
              </button>
            ))}
          </div>
        </div>
      )}

      <style jsx>{`
        .slider::-webkit-slider-thumb {
          appearance: none;
          width: 16px;
          height: 16px;
          border-radius: 50%;
          background: #8b5cf6;
          cursor: pointer;
          border: 2px solid #ffffff;
          box-shadow: 0 2px 6px rgba(0, 0, 0, 0.3);
        }

        .slider::-moz-range-thumb {
          width: 16px;
          height: 16px;
          border-radius: 50%;
          background: #8b5cf6;
          cursor: pointer;
          border: 2px solid #ffffff;
          box-shadow: 0 2px 6px rgba(0, 0, 0, 0.3);
        }

        .slider::-webkit-slider-track {
          background: linear-gradient(to right, #8b5cf6 0%, #8b5cf6 var(--value, 0%), #374151 var(--value, 0%), #374151 100%);
        }
      `}</style>
    </>
  )
}

export default MusicController
