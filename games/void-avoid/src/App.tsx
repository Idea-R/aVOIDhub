import { useState } from 'react';
import Game from './components/Game';
import StartScreen from './components/StartScreen';

function App() {
  const [isPlaying, setIsPlaying] = useState(false);

  return (
    <main className="void-app">
      {isPlaying ? (
        <Game autoStart onExit={() => setIsPlaying(false)} />
      ) : (
        <StartScreen onStart={() => setIsPlaying(true)} />
      )}
    </main>
  );
}

export default App;
