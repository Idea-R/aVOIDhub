import React from 'react';
import { motion } from 'framer-motion';
import { Volume2, VolumeX, Eye, EyeOff, Gamepad2, Palette, ArrowLeft } from 'lucide-react';
import { GlassPanel } from '../ui/GlassPanel';
import { NeonButton } from '../ui/NeonButton';
import { useGameStore } from '../../stores/gameStore';
import { useAudioStore } from '../../stores/audioStore';

interface SettingsMenuProps {
  onBack: () => void;
  className?: string;
}

export const SettingsMenu: React.FC<SettingsMenuProps> = ({
  onBack,
  className = ''
}) => {
  const { settings, updateSettings } = useGameStore();
  const { masterVolume, musicVolume, sfxVolume, setMasterVolume, setMusicVolume, setSfxVolume } = useAudioStore();

  const handleAudioChange = (type: 'master' | 'music' | 'sfx', value: number) => {
    switch (type) {
      case 'master':
        setMasterVolume(value);
        updateSettings({
          audio: { ...settings.audio, masterVolume: value }
        });
        break;
      case 'music':
        setMusicVolume(value);
        updateSettings({
          audio: { ...settings.audio, musicVolume: value }
        });
        break;
      case 'sfx':
        setSfxVolume(value);
        updateSettings({
          audio: { ...settings.audio, sfxVolume: value }
        });
        break;
    }
  };

  const handleGraphicsChange = (setting: keyof typeof settings.graphics, value: boolean) => {
    updateSettings({
      graphics: { ...settings.graphics, [setting]: value }
    });
  };

  const handleGameplayChange = (setting: keyof typeof settings.gameplay, value: boolean) => {
    updateSettings({
      gameplay: { ...settings.gameplay, [setting]: value }
    });
  };

  const VolumeSlider = ({ 
    label, 
    value, 
    onChange, 
    icon: Icon 
  }: { 
    label: string; 
    value: number; 
    onChange: (value: number) => void; 
    icon: React.ComponentType<any>;
  }) => (
    <div className="flex items-center space-x-4">
      <Icon className="w-5 h-5 text-avoid-primary" />
      <div className="flex-1">
        <div className="flex justify-between items-center mb-2">
          <span className="text-sm font-game-ui text-text-primary">{label}</span>
          <span className="text-sm font-game-mono text-avoid-primary">{Math.round(value * 100)}%</span>
        </div>
        <div className="relative">
          <input
            type="range"
            min="0"
            max="1"
            step="0.1"
            value={value}
            onChange={(e) => onChange(parseFloat(e.target.value))}
            className="w-full h-2 bg-bg-tertiary rounded-lg appearance-none cursor-pointer slider"
          />
          <div 
            className="absolute top-0 left-0 h-2 bg-gradient-to-r from-avoid-primary to-avoid-accent rounded-lg pointer-events-none"
            style={{ width: `${value * 100}%` }}
          />
        </div>
      </div>
    </div>
  );

  const ToggleSwitch = ({ 
    label, 
    description, 
    value, 
    onChange, 
    icon: Icon 
  }: { 
    label: string; 
    description: string; 
    value: boolean; 
    onChange: (value: boolean) => void; 
    icon: React.ComponentType<any>;
  }) => (
    <div className="flex items-center justify-between p-4 glass-panel border border-white/10 rounded-lg">
      <div className="flex items-center space-x-3">
        <Icon className="w-5 h-5 text-avoid-accent" />
        <div>
          <div className="text-sm font-game-ui text-text-primary font-bold">{label}</div>
          <div className="text-xs text-text-secondary">{description}</div>
        </div>
      </div>
      <motion.button
        className={`relative w-12 h-6 rounded-full transition-colors ${
          value ? 'bg-avoid-primary' : 'bg-bg-tertiary'
        }`}
        onClick={() => onChange(!value)}
        whileTap={{ scale: 0.95 }}
      >
        <motion.div
          className="absolute top-1 w-4 h-4 bg-white rounded-full shadow-lg"
          animate={{ x: value ? 24 : 4 }}
          transition={{ type: 'spring', stiffness: 300, damping: 20 }}
        />
      </motion.button>
    </div>
  );

  return (
    <div className={`min-h-screen flex items-center justify-center p-8 ${className}`}>
      <motion.div
        initial={{ opacity: 0, scale: 0.9 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ duration: 0.3 }}
        className="w-full max-w-4xl"
      >
        <GlassPanel className="p-8">
          {/* Header */}
          <div className="flex items-center justify-between mb-8">
            <div className="flex items-center space-x-4">
              <Palette className="w-8 h-8 text-avoid-primary" />
              <h1 className="text-4xl font-game-display font-bold text-avoid-primary">
                Settings
              </h1>
            </div>
            <NeonButton variant="secondary" onClick={onBack}>
              <ArrowLeft className="w-4 h-4 mr-2" />
              Back to Menu
            </NeonButton>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
            {/* Audio Settings */}
            <div>
              <h2 className="text-2xl font-game-display font-bold text-avoid-accent mb-6 flex items-center">
                <Volume2 className="w-6 h-6 mr-3" />
                Audio Settings
              </h2>
              <div className="space-y-6">
                <VolumeSlider
                  label="Master Volume"
                  value={masterVolume}
                  onChange={(value) => handleAudioChange('master', value)}
                  icon={masterVolume > 0 ? Volume2 : VolumeX}
                />
                <VolumeSlider
                  label="Music Volume"
                  value={musicVolume}
                  onChange={(value) => handleAudioChange('music', value)}
                  icon={Volume2}
                />
                <VolumeSlider
                  label="Sound Effects"
                  value={sfxVolume}
                  onChange={(value) => handleAudioChange('sfx', value)}
                  icon={Volume2}
                />
                
                <div className="space-y-3">
                  <ToggleSwitch
                    label="Spatial Audio"
                    description="3D positioned sound effects"
                    value={settings.audio.spatialAudio}
                    onChange={(value) => updateSettings({
                      audio: { ...settings.audio, spatialAudio: value }
                    })}
                    icon={Volume2}
                  />
                  <ToggleSwitch
                    label="Dynamic Music"
                    description="Music adapts to gameplay intensity"
                    value={settings.audio.dynamicMusic}
                    onChange={(value) => updateSettings({
                      audio: { ...settings.audio, dynamicMusic: value }
                    })}
                    icon={Volume2}
                  />
                </div>
              </div>
            </div>

            {/* Graphics Settings */}
            <div>
              <h2 className="text-2xl font-game-display font-bold text-medium mb-6 flex items-center">
                <Eye className="w-6 h-6 mr-3" />
                Graphics Settings
              </h2>
              <div className="space-y-3">
                <ToggleSwitch
                  label="Particle Effects"
                  description="Word explosions and visual effects"
                  value={settings.graphics.particles}
                  onChange={(value) => handleGraphicsChange('particles', value)}
                  icon={Eye}
                />
                <ToggleSwitch
                  label="Screen Shake"
                  description="Camera shake on impacts"
                  value={settings.graphics.screenShake}
                  onChange={(value) => handleGraphicsChange('screenShake', value)}
                  icon={Eye}
                />
                <ToggleSwitch
                  label="Background Animation"
                  description="Animated background elements"
                  value={settings.graphics.backgroundAnimation}
                  onChange={(value) => handleGraphicsChange('backgroundAnimation', value)}
                  icon={Eye}
                />
                <ToggleSwitch
                  label="Reduced Motion"
                  description="Minimize animations for accessibility"
                  value={settings.graphics.reducedMotion}
                  onChange={(value) => handleGraphicsChange('reducedMotion', value)}
                  icon={EyeOff}
                />
              </div>
            </div>

            {/* Gameplay Settings */}
            <div className="lg:col-span-2">
              <h2 className="text-2xl font-game-display font-bold text-avoid-secondary mb-6 flex items-center">
                <Gamepad2 className="w-6 h-6 mr-3" />
                Gameplay Settings
              </h2>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <ToggleSwitch
                  label="Show WPM"
                  description="Display words per minute"
                  value={settings.gameplay.showWPM}
                  onChange={(value) => handleGameplayChange('showWPM', value)}
                  icon={Gamepad2}
                />
                <ToggleSwitch
                  label="Show Accuracy"
                  description="Display typing accuracy percentage"
                  value={settings.gameplay.showAccuracy}
                  onChange={(value) => handleGameplayChange('showAccuracy', value)}
                  icon={Gamepad2}
                />
                <ToggleSwitch
                  label="Show Next Words"
                  description="Preview upcoming words"
                  value={settings.gameplay.showNextWords}
                  onChange={(value) => handleGameplayChange('showNextWords', value)}
                  icon={Gamepad2}
                />
                <ToggleSwitch
                  label="Auto Capitalize"
                  description="Automatically capitalize first letters"
                  value={settings.gameplay.autoCapitalize}
                  onChange={(value) => handleGameplayChange('autoCapitalize', value)}
                  icon={Gamepad2}
                />
              </div>
            </div>
          </div>

          {/* Reset to Defaults */}
          <div className="mt-8 pt-6 border-t border-white/10">
            <div className="flex justify-between items-center">
              <div>
                <h3 className="text-lg font-game-display font-bold text-text-primary">Reset Settings</h3>
                <p className="text-sm text-text-secondary">Restore all settings to their default values</p>
              </div>
              <NeonButton
                variant="danger"
                onClick={() => {
                  // Reset to default settings
                  const defaultSettings = {
                    audio: {
                      masterVolume: 0.7,
                      musicVolume: 0.5,
                      sfxVolume: 0.8,
                      spatialAudio: true,
                      dynamicMusic: true
                    },
                    graphics: {
                      particles: true,
                      screenShake: true,
                      backgroundAnimation: true,
                      reducedMotion: false
                    },
                    gameplay: {
                      showWPM: true,
                      showAccuracy: true,
                      showNextWords: true,
                      autoCapitalize: false
                    }
                  };
                  updateSettings(defaultSettings);
                  setMasterVolume(0.7);
                  setMusicVolume(0.5);
                  setSfxVolume(0.8);
                }}
              >
                Reset to Defaults
              </NeonButton>
            </div>
          </div>
        </GlassPanel>
      </motion.div>
    </div>
  );
};