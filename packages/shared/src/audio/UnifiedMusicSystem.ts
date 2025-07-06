export interface Track {
  id: string
  title: string
  artist: string
  album?: string
  url: string
  duration?: number
  tags?: string[]
  bpm?: number
  mood?: string
  energy_level?: number
  is_loop?: boolean
  game?: string
  file_path?: string
  file_size?: number
}

export interface GameMusicConfig {
  gameKey: string
  defaultTrack: string
  trackIds: string[]
}

export class UnifiedMusicSystem {
  private static instance: UnifiedMusicSystem
  private audioContext: AudioContext | null = null
  private currentTrack: HTMLAudioElement | null = null
  private tracks: Track[] = []
  private playlists: Map<string, string[]> = new Map()
  private gameMusicConfigs: Map<string, GameMusicConfig> = new Map()
  private isPlaying = false
  private volume = 0.7
  private isMuted = false
  private currentTrackId: string | null = null
  private playlist: string[] = []
  private currentPlaylistIndex = 0
  private listeners: Map<string, Function[]> = new Map()
  private supabase: any = null
  private supabaseStorageUrl: string = ''
  private tracksLoaded = false
  
  private constructor() {
    this.initializeAudioContext()
    this.loadTracks()
    this.setupGameConfigs()
  }

  public static getInstance(): UnifiedMusicSystem {
    if (!UnifiedMusicSystem.instance) {
      UnifiedMusicSystem.instance = new UnifiedMusicSystem()
    }
    return UnifiedMusicSystem.instance
  }

  public setSupabaseClient(supabase: any) {
    this.supabase = supabase
    if (supabase?.supabaseUrl) {
      this.supabaseStorageUrl = `${supabase.supabaseUrl}/storage/v1/object/public/music/`
    }
    // Load tracks from database when Supabase client is set
    this.loadTracksFromDatabase()
  }

  private initializeAudioContext() {
    try {
      this.audioContext = new (window.AudioContext || (window as any).webkitAudioContext)()
    } catch (error) {
      console.warn('Audio context not supported:', error)
    }
  }

  private async loadTracksFromDatabase() {
    if (!this.supabase) {
      console.warn('Supabase client not initialized')
      return
    }

    try {
      const { data: tracks, error } = await this.supabase
        .from('music_tracks')
        .select('*')
        .order('title')

      if (error) {
        console.error('Error loading tracks from database:', error)
        return
      }

      // Convert database tracks to our Track format
      this.tracks = tracks.map((dbTrack: any) => ({
        id: dbTrack.id,
        title: dbTrack.title,
        artist: dbTrack.artist,
        album: dbTrack.album,
        duration: dbTrack.duration,
        url: this.getTrackUrl(dbTrack.file_path),
        tags: dbTrack.tags || [],
        bpm: dbTrack.bpm,
        mood: dbTrack.mood,
        energy_level: dbTrack.energy_level,
        is_loop: dbTrack.is_loop,
        game: dbTrack.game,
        file_path: dbTrack.file_path,
        file_size: dbTrack.file_size
      }))

      this.tracksLoaded = true
      console.log(`Loaded ${this.tracks.length} tracks from database`)

      // Load playlists after tracks are loaded
      await this.loadPlaylistsFromDatabase()

    } catch (error) {
      console.error('Failed to load tracks from database:', error)
    }
  }

  private async loadPlaylistsFromDatabase() {
    if (!this.supabase) return

    try {
      const { data: playlists, error } = await this.supabase
        .from('playlists')
        .select(`
          *,
          playlist_tracks (
            track_id,
            position
          )
        `)
        .order('name')

      if (error) {
        console.error('Error loading playlists:', error)
        return
      }

      // Convert database playlists to our format
      playlists?.forEach((playlist: any) => {
        const trackIds = playlist.playlist_tracks
          ?.sort((a: any, b: any) => a.position - b.position)
          ?.map((pt: any) => pt.track_id) || []
        
        this.playlists.set(playlist.name, trackIds)
      })

      console.log(`Loaded ${playlists?.length || 0} playlists from database`)

      // Update game configs with database playlists
      this.setupGameConfigsFromDatabase()

    } catch (error) {
      console.error('Failed to load playlists from database:', error)
    }
  }

  private getTrackUrl(filePath: string): string {
    if (!filePath) return ''
    
    // If already a full URL, return as is
    if (filePath.startsWith('http')) {
      return filePath
    }
    
    // Construct Supabase storage URL
    return `${this.supabaseStorageUrl}${filePath}`
  }

  private setupGameConfigsFromDatabase() {
    // Setup game configs using playlists from database
    const gameKeys = ['voidavoid', 'tankavoid', 'wreckavoid', 'wordavoid', 'hub']
    
    gameKeys.forEach(gameKey => {
      const playlistName = `${gameKey}_default`
      const trackIds = this.playlists.get(playlistName) || []
      
      if (trackIds.length > 0) {
        this.gameMusicConfigs.set(gameKey, {
          gameKey,
          defaultTrack: trackIds[0],
          trackIds
        })
      }
    })
  }

  private loadTracks() {
    // Legacy method - now handled by loadTracksFromDatabase
    // Keep fallback tracks for when Supabase is not available
    if (!this.tracksLoaded && !this.supabase) {
      const fallbackTracks: Track[] = [
        {
          id: 'circuit-lounge',
          title: 'Circuit Lounge',
          artist: 'aVOID Original',
          url: '/Circuit Lounge.mp3'
        },
        {
          id: 'neon-keystrike',
          title: 'Neon Keystrike',
          artist: 'aVOID Original',
          url: '/Neon Keystrike.mp3'
        }
      ]
      
      this.tracks = fallbackTracks
      this.tracksLoaded = true
    }
  }

  private setupGameConfigs() {
    // Configure default tracks for each game
    this.gameMusicConfigs.set('voidavoid', {
      gameKey: 'voidavoid',
      defaultTrack: 'neon-keystrike',
      trackIds: ['neon-keystrike', 'neon-keystrike-remastered', 'circuit-lounge', 'overclocked-rebellion']
    })

    this.gameMusicConfigs.set('tankavoid', {
      gameKey: 'tankavoid',
      defaultTrack: 'overclocked-rebellion',
      trackIds: ['overclocked-rebellion', 'circuit-lounge', 'neon-keystrike', 'neon-keystrike-remastered']
    })

    this.gameMusicConfigs.set('wreckavoid', {
      gameKey: 'wreckavoid',
      defaultTrack: 'circuit-lounge',
      trackIds: ['circuit-lounge', 'overclocked-rebellion', 'neon-keystrike-remastered', 'neon-keystrike']
    })

    this.gameMusicConfigs.set('wordavoid', {
      gameKey: 'wordavoid',
      defaultTrack: 'neon-keystrike-remastered',
      trackIds: ['neon-keystrike-remastered', 'neon-keystrike', 'circuit-lounge', 'overclocked-rebellion']
    })

    this.gameMusicConfigs.set('hub', {
      gameKey: 'hub',
      defaultTrack: 'circuit-lounge',
      trackIds: ['circuit-lounge', 'neon-keystrike', 'neon-keystrike-remastered', 'overclocked-rebellion']
    })
  }

  public initializeForGame(gameKey: string) {
    const config = this.gameMusicConfigs.get(gameKey)
    if (!config) {
      console.warn(`No music config found for game: ${gameKey}`)
      return
    }

    this.playlist = config.trackIds
    this.currentPlaylistIndex = 0

    // Auto-play default track if no music is currently playing
    if (!this.isPlaying) {
      this.playTrack(config.defaultTrack)
    }

    this.emit('game-initialized', { gameKey, config })
  }

  public async playTrack(trackId: string): Promise<boolean> {
    const track = this.tracks.find(t => t.id === trackId)
    if (!track) {
      console.error(`Track not found: ${trackId}`)
      return false
    }

    try {
      // Stop current track
      if (this.currentTrack) {
        this.currentTrack.pause()
        this.currentTrack.removeEventListener('ended', this.onTrackEnded)
      }

      // Create new audio element
      this.currentTrack = new Audio(track.url)
      this.currentTrack.volume = this.isMuted ? 0 : this.volume
      this.currentTrack.loop = false
      
      // Add event listeners
      this.currentTrack.addEventListener('ended', this.onTrackEnded.bind(this))
      this.currentTrack.addEventListener('error', (e) => {
        console.error('Error playing track:', track.title, e)
        this.emit('track-error', { track, error: e })
      })

      // Play the track
      await this.currentTrack.play()
      
      this.currentTrackId = trackId
      this.isPlaying = true
      
      // Update playlist index
      this.currentPlaylistIndex = this.playlist.indexOf(trackId)
      if (this.currentPlaylistIndex === -1) {
        this.currentPlaylistIndex = 0
      }

      this.emit('track-started', { track })
      return true
    } catch (error) {
      console.error('Failed to play track:', error)
      this.emit('track-error', { track, error })
      return false
    }
  }

  private onTrackEnded = () => {
    this.emit('track-ended', { trackId: this.currentTrackId })
    this.playNext()
  }

  public playNext() {
    if (this.playlist.length === 0) return

    this.currentPlaylistIndex = (this.currentPlaylistIndex + 1) % this.playlist.length
    const nextTrackId = this.playlist[this.currentPlaylistIndex]
    this.playTrack(nextTrackId)
  }

  public playPrevious() {
    if (this.playlist.length === 0) return

    this.currentPlaylistIndex = this.currentPlaylistIndex === 0 
      ? this.playlist.length - 1 
      : this.currentPlaylistIndex - 1
    const prevTrackId = this.playlist[this.currentPlaylistIndex]
    this.playTrack(prevTrackId)
  }

  public pause() {
    if (this.currentTrack && this.isPlaying) {
      this.currentTrack.pause()
      this.isPlaying = false
      this.emit('track-paused', { trackId: this.currentTrackId })
    }
  }

  public resume() {
    if (this.currentTrack && !this.isPlaying) {
      this.currentTrack.play()
      this.isPlaying = true
      this.emit('track-resumed', { trackId: this.currentTrackId })
    }
  }

  public stop() {
    if (this.currentTrack) {
      this.currentTrack.pause()
      this.currentTrack.currentTime = 0
      this.isPlaying = false
      this.emit('track-stopped', { trackId: this.currentTrackId })
    }
  }

  public setVolume(volume: number) {
    this.volume = Math.max(0, Math.min(1, volume))
    if (this.currentTrack && !this.isMuted) {
      this.currentTrack.volume = this.volume
    }
    this.emit('volume-changed', { volume: this.volume })
  }

  public toggleMute() {
    this.isMuted = !this.isMuted
    if (this.currentTrack) {
      this.currentTrack.volume = this.isMuted ? 0 : this.volume
    }
    this.emit('mute-toggled', { isMuted: this.isMuted })
  }

  public getAvailableTracks(): Track[] {
    return this.tracks
  }

  public getCurrentTrack(): Track | null {
    return this.currentTrackId ? this.tracks.find(t => t.id === this.currentTrackId) || null : null
  }

  public getPlaylist(): Track[] {
    return this.playlist.map(id => this.tracks.find(t => t.id === id)).filter(Boolean) as Track[]
  }

  public shufflePlaylist() {
    for (let i = this.playlist.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [this.playlist[i], this.playlist[j]] = [this.playlist[j], this.playlist[i]]
    }
    this.currentPlaylistIndex = 0
    this.emit('playlist-shuffled', { playlist: this.getPlaylist() })
  }

  public setPlaylist(trackIds: string[]) {
    this.playlist = trackIds.filter(id => this.tracks.some(t => t.id === id))
    this.currentPlaylistIndex = 0
    this.emit('playlist-changed', { playlist: this.getPlaylist() })
  }

  public getGameConfig(gameKey: string): GameMusicConfig | null {
    return this.gameMusicConfigs.get(gameKey) || null
  }

  public getTracksByGame(gameKey: string): Track[] {
    return this.tracks.filter(track => track.game === gameKey)
  }

  public getTracksByMood(mood: string): Track[] {
    return this.tracks.filter(track => track.mood === mood)
  }

  public getTracksByTags(tags: string[]): Track[] {
    return this.tracks.filter(track => 
      track.tags?.some(tag => tags.includes(tag))
    )
  }

  public getPlaylistNames(): string[] {
    return Array.from(this.playlists.keys())
  }

  public loadPlaylist(playlistName: string): boolean {
    const trackIds = this.playlists.get(playlistName)
    if (trackIds) {
      this.setPlaylist(trackIds)
      return true
    }
    return false
  }

  public createPlaylist(name: string, trackIds: string[]): void {
    this.playlists.set(name, trackIds)
    this.emit('playlist-created', { name, trackIds })
  }

  // Event system
  public on(event: string, callback: Function) {
    if (!this.listeners.has(event)) {
      this.listeners.set(event, [])
    }
    this.listeners.get(event)!.push(callback)
  }

  public off(event: string, callback: Function) {
    const callbacks = this.listeners.get(event)
    if (callbacks) {
      const index = callbacks.indexOf(callback)
      if (index > -1) {
        callbacks.splice(index, 1)
      }
    }
  }

  private emit(event: string, data?: any) {
    const callbacks = this.listeners.get(event)
    if (callbacks) {
      callbacks.forEach(callback => callback(data))
    }
  }

  // State getters
  public getState() {
    return {
      isPlaying: this.isPlaying,
      isMuted: this.isMuted,
      volume: this.volume,
      currentTrack: this.getCurrentTrack(),
      playlist: this.getPlaylist(),
      currentPlaylistIndex: this.currentPlaylistIndex
    }
  }
}

// Export singleton instance
export const unifiedMusic = UnifiedMusicSystem.getInstance()
export default unifiedMusic
