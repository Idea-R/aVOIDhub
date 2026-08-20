import { useCallback, useEffect, useRef, useState } from 'react';
import Game from './components/Game';
import StartScreen from './components/StartScreen';
import { SoundManager, type SoundStatus } from './game/presentation/SoundManager';
import {
  readPlayerPreferences,
  resolveReducedMotion,
  writePlayerPreferences,
  type MotionPreference,
} from './game/presentation/preferences';

function App() {
  const [isPlaying, setIsPlaying] = useState(false);
  const [preferences, setPreferences] = useState(readPlayerPreferences);
  const [systemRequestsReducedMotion, setSystemRequestsReducedMotion] = useState(false);
  const soundRef = useRef<SoundManager | null>(null);
  const [soundStatus, setSoundStatus] = useState<SoundStatus>(preferences.soundEnabled ? 'idle' : 'muted');

  soundRef.current ??= new SoundManager(preferences.soundEnabled);
  const sound = soundRef.current;
  const reducedMotion = resolveReducedMotion(preferences.motion, systemRequestsReducedMotion);

  useEffect(() => {
    const query = window.matchMedia('(prefers-reduced-motion: reduce)');
    const update = () => setSystemRequestsReducedMotion(query.matches);
    update();
    query.addEventListener('change', update);
    return () => query.removeEventListener('change', update);
  }, []);

  useEffect(() => {
    writePlayerPreferences(preferences);
  }, [preferences]);

  useEffect(() => {
    const releaseAudio = (event: PageTransitionEvent) => {
      if (!event.persisted) void sound.destroy();
    };
    window.addEventListener('pagehide', releaseAudio);
    return () => window.removeEventListener('pagehide', releaseAudio);
  }, [sound]);

  const startGame = useCallback(async () => {
    if (preferences.soundEnabled) {
      const status = await sound.activate();
      setSoundStatus(status);
      if (status === 'ready') sound.play('start');
    }
    setIsPlaying(true);
  }, [preferences.soundEnabled, sound]);

  const toggleSound = useCallback(async () => {
    const enabled = !preferences.soundEnabled;
    setPreferences((current) => ({ ...current, soundEnabled: enabled }));
    setSoundStatus(await sound.setEnabled(enabled));
  }, [preferences.soundEnabled, sound]);

  const toggleMotion = useCallback(() => {
    setPreferences((current) => ({
      ...current,
      motion: (current.motion === 'system' ? 'reduced' : 'system') as MotionPreference,
    }));
  }, []);

  return (
    <main className="void-app" data-reduced-motion={reducedMotion ? 'true' : 'false'}>
      {isPlaying ? (
        <Game
          autoStart
          sound={sound}
          soundEnabled={preferences.soundEnabled}
          soundStatus={soundStatus}
          reducedMotion={reducedMotion}
          motionPreference={preferences.motion}
          onToggleSound={toggleSound}
          onToggleMotion={toggleMotion}
          onSoundStatusChange={setSoundStatus}
          onExit={() => setIsPlaying(false)}
        />
      ) : (
        <StartScreen
          soundEnabled={preferences.soundEnabled}
          soundStatus={soundStatus}
          reducedMotion={reducedMotion}
          motionPreference={preferences.motion}
          onStart={startGame}
          onToggleSound={toggleSound}
          onToggleMotion={toggleMotion}
        />
      )}
    </main>
  );
}

export default App;
