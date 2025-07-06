export class UnifiedMusicSystem {
    static instance;
    audioContext = null;
    currentTrack = null;
    tracks = [];
    playlists = new Map();
    gameMusicConfigs = new Map();
    isPlaying = false;
    volume = 0.7;
    isMuted = false;
    currentTrackId = null;
    playlist = [];
    currentPlaylistIndex = 0;
    listeners = new Map();
    supabase = null;
    supabaseStorageUrl = '';
    tracksLoaded = false;
    constructor() {
        this.initializeAudioContext();
        this.loadTracks();
        this.setupGameConfigs();
    }
    static getInstance() {
        if (!UnifiedMusicSystem.instance) {
            UnifiedMusicSystem.instance = new UnifiedMusicSystem();
        }
        return UnifiedMusicSystem.instance;
    }
    setSupabaseClient(supabase) {
        this.supabase = supabase;
        if (supabase?.supabaseUrl) {
            this.supabaseStorageUrl = `${supabase.supabaseUrl}/storage/v1/object/public/music/`;
        }
        // Load tracks from database when Supabase client is set
        this.loadTracksFromDatabase();
    }
    initializeAudioContext() {
        try {
            this.audioContext = new (window.AudioContext || window.webkitAudioContext)();
        }
        catch (error) {
            console.warn('Audio context not supported:', error);
        }
    }
    async loadTracksFromDatabase() {
        if (!this.supabase) {
            console.warn('Supabase client not initialized');
            return;
        }
        try {
            const { data: tracks, error } = await this.supabase
                .from('music_tracks')
                .select('*')
                .order('title');
            if (error) {
                console.error('Error loading tracks from database:', error);
                return;
            }
            // Convert database tracks to our Track format
            this.tracks = tracks.map((dbTrack) => ({
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
            }));
            this.tracksLoaded = true;
            console.log(`Loaded ${this.tracks.length} tracks from database`);
            // Load playlists after tracks are loaded
            await this.loadPlaylistsFromDatabase();
        }
        catch (error) {
            console.error('Failed to load tracks from database:', error);
        }
    }
    async loadPlaylistsFromDatabase() {
        if (!this.supabase)
            return;
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
                .order('name');
            if (error) {
                console.error('Error loading playlists:', error);
                return;
            }
            // Convert database playlists to our format
            playlists?.forEach((playlist) => {
                const trackIds = playlist.playlist_tracks
                    ?.sort((a, b) => a.position - b.position)
                    ?.map((pt) => pt.track_id) || [];
                this.playlists.set(playlist.name, trackIds);
            });
            console.log(`Loaded ${playlists?.length || 0} playlists from database`);
            // Update game configs with database playlists
            this.setupGameConfigsFromDatabase();
        }
        catch (error) {
            console.error('Failed to load playlists from database:', error);
        }
    }
    getTrackUrl(filePath) {
        if (!filePath)
            return '';
        // If already a full URL, return as is
        if (filePath.startsWith('http')) {
            return filePath;
        }
        // Construct Supabase storage URL
        return `${this.supabaseStorageUrl}${filePath}`;
    }
    setupGameConfigsFromDatabase() {
        // Setup game configs using playlists from database
        const gameKeys = ['voidavoid', 'tankavoid', 'wreckavoid', 'wordavoid', 'hub'];
        gameKeys.forEach(gameKey => {
            const playlistName = `${gameKey}_default`;
            const trackIds = this.playlists.get(playlistName) || [];
            if (trackIds.length > 0) {
                this.gameMusicConfigs.set(gameKey, {
                    gameKey,
                    defaultTrack: trackIds[0],
                    trackIds
                });
            }
        });
    }
    loadTracks() {
        // Legacy method - now handled by loadTracksFromDatabase
        // Keep fallback tracks for when Supabase is not available
        if (!this.tracksLoaded && !this.supabase) {
            const fallbackTracks = [
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
            ];
            this.tracks = fallbackTracks;
            this.tracksLoaded = true;
        }
    }
    setupGameConfigs() {
        // Configure default tracks for each game
        this.gameMusicConfigs.set('voidavoid', {
            gameKey: 'voidavoid',
            defaultTrack: 'neon-keystrike',
            trackIds: ['neon-keystrike', 'neon-keystrike-remastered', 'circuit-lounge', 'overclocked-rebellion']
        });
        this.gameMusicConfigs.set('tankavoid', {
            gameKey: 'tankavoid',
            defaultTrack: 'overclocked-rebellion',
            trackIds: ['overclocked-rebellion', 'circuit-lounge', 'neon-keystrike', 'neon-keystrike-remastered']
        });
        this.gameMusicConfigs.set('wreckavoid', {
            gameKey: 'wreckavoid',
            defaultTrack: 'circuit-lounge',
            trackIds: ['circuit-lounge', 'overclocked-rebellion', 'neon-keystrike-remastered', 'neon-keystrike']
        });
        this.gameMusicConfigs.set('wordavoid', {
            gameKey: 'wordavoid',
            defaultTrack: 'neon-keystrike-remastered',
            trackIds: ['neon-keystrike-remastered', 'neon-keystrike', 'circuit-lounge', 'overclocked-rebellion']
        });
        this.gameMusicConfigs.set('hub', {
            gameKey: 'hub',
            defaultTrack: 'circuit-lounge',
            trackIds: ['circuit-lounge', 'neon-keystrike', 'neon-keystrike-remastered', 'overclocked-rebellion']
        });
    }
    initializeForGame(gameKey) {
        const config = this.gameMusicConfigs.get(gameKey);
        if (!config) {
            console.warn(`No music config found for game: ${gameKey}`);
            return;
        }
        this.playlist = config.trackIds;
        this.currentPlaylistIndex = 0;
        // Auto-play default track if no music is currently playing
        if (!this.isPlaying) {
            this.playTrack(config.defaultTrack);
        }
        this.emit('game-initialized', { gameKey, config });
    }
    async playTrack(trackId) {
        const track = this.tracks.find(t => t.id === trackId);
        if (!track) {
            console.error(`Track not found: ${trackId}`);
            return false;
        }
        try {
            // Stop current track
            if (this.currentTrack) {
                this.currentTrack.pause();
                this.currentTrack.removeEventListener('ended', this.onTrackEnded);
            }
            // Create new audio element
            this.currentTrack = new Audio(track.url);
            this.currentTrack.volume = this.isMuted ? 0 : this.volume;
            this.currentTrack.loop = false;
            // Add event listeners
            this.currentTrack.addEventListener('ended', this.onTrackEnded.bind(this));
            this.currentTrack.addEventListener('error', (e) => {
                console.error('Error playing track:', track.title, e);
                this.emit('track-error', { track, error: e });
            });
            // Play the track
            await this.currentTrack.play();
            this.currentTrackId = trackId;
            this.isPlaying = true;
            // Update playlist index
            this.currentPlaylistIndex = this.playlist.indexOf(trackId);
            if (this.currentPlaylistIndex === -1) {
                this.currentPlaylistIndex = 0;
            }
            this.emit('track-started', { track });
            return true;
        }
        catch (error) {
            console.error('Failed to play track:', error);
            this.emit('track-error', { track, error });
            return false;
        }
    }
    onTrackEnded = () => {
        this.emit('track-ended', { trackId: this.currentTrackId });
        this.playNext();
    };
    playNext() {
        if (this.playlist.length === 0)
            return;
        this.currentPlaylistIndex = (this.currentPlaylistIndex + 1) % this.playlist.length;
        const nextTrackId = this.playlist[this.currentPlaylistIndex];
        this.playTrack(nextTrackId);
    }
    playPrevious() {
        if (this.playlist.length === 0)
            return;
        this.currentPlaylistIndex = this.currentPlaylistIndex === 0
            ? this.playlist.length - 1
            : this.currentPlaylistIndex - 1;
        const prevTrackId = this.playlist[this.currentPlaylistIndex];
        this.playTrack(prevTrackId);
    }
    pause() {
        if (this.currentTrack && this.isPlaying) {
            this.currentTrack.pause();
            this.isPlaying = false;
            this.emit('track-paused', { trackId: this.currentTrackId });
        }
    }
    resume() {
        if (this.currentTrack && !this.isPlaying) {
            this.currentTrack.play();
            this.isPlaying = true;
            this.emit('track-resumed', { trackId: this.currentTrackId });
        }
    }
    stop() {
        if (this.currentTrack) {
            this.currentTrack.pause();
            this.currentTrack.currentTime = 0;
            this.isPlaying = false;
            this.emit('track-stopped', { trackId: this.currentTrackId });
        }
    }
    setVolume(volume) {
        this.volume = Math.max(0, Math.min(1, volume));
        if (this.currentTrack && !this.isMuted) {
            this.currentTrack.volume = this.volume;
        }
        this.emit('volume-changed', { volume: this.volume });
    }
    toggleMute() {
        this.isMuted = !this.isMuted;
        if (this.currentTrack) {
            this.currentTrack.volume = this.isMuted ? 0 : this.volume;
        }
        this.emit('mute-toggled', { isMuted: this.isMuted });
    }
    getAvailableTracks() {
        return this.tracks;
    }
    getCurrentTrack() {
        return this.currentTrackId ? this.tracks.find(t => t.id === this.currentTrackId) || null : null;
    }
    getPlaylist() {
        return this.playlist.map(id => this.tracks.find(t => t.id === id)).filter(Boolean);
    }
    shufflePlaylist() {
        for (let i = this.playlist.length - 1; i > 0; i--) {
            const j = Math.floor(Math.random() * (i + 1));
            [this.playlist[i], this.playlist[j]] = [this.playlist[j], this.playlist[i]];
        }
        this.currentPlaylistIndex = 0;
        this.emit('playlist-shuffled', { playlist: this.getPlaylist() });
    }
    setPlaylist(trackIds) {
        this.playlist = trackIds.filter(id => this.tracks.some(t => t.id === id));
        this.currentPlaylistIndex = 0;
        this.emit('playlist-changed', { playlist: this.getPlaylist() });
    }
    getGameConfig(gameKey) {
        return this.gameMusicConfigs.get(gameKey) || null;
    }
    getTracksByGame(gameKey) {
        return this.tracks.filter(track => track.game === gameKey);
    }
    getTracksByMood(mood) {
        return this.tracks.filter(track => track.mood === mood);
    }
    getTracksByTags(tags) {
        return this.tracks.filter(track => track.tags?.some(tag => tags.includes(tag)));
    }
    getPlaylistNames() {
        return Array.from(this.playlists.keys());
    }
    loadPlaylist(playlistName) {
        const trackIds = this.playlists.get(playlistName);
        if (trackIds) {
            this.setPlaylist(trackIds);
            return true;
        }
        return false;
    }
    createPlaylist(name, trackIds) {
        this.playlists.set(name, trackIds);
        this.emit('playlist-created', { name, trackIds });
    }
    // Event system
    on(event, callback) {
        if (!this.listeners.has(event)) {
            this.listeners.set(event, []);
        }
        this.listeners.get(event).push(callback);
    }
    off(event, callback) {
        const callbacks = this.listeners.get(event);
        if (callbacks) {
            const index = callbacks.indexOf(callback);
            if (index > -1) {
                callbacks.splice(index, 1);
            }
        }
    }
    emit(event, data) {
        const callbacks = this.listeners.get(event);
        if (callbacks) {
            callbacks.forEach(callback => callback(data));
        }
    }
    // State getters
    getState() {
        return {
            isPlaying: this.isPlaying,
            isMuted: this.isMuted,
            volume: this.volume,
            currentTrack: this.getCurrentTrack(),
            playlist: this.getPlaylist(),
            currentPlaylistIndex: this.currentPlaylistIndex
        };
    }
}
// Export singleton instance
export const unifiedMusic = UnifiedMusicSystem.getInstance();
export default unifiedMusic;
