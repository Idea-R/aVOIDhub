import { describe, expect, it, vi } from 'vitest';
import { PerformanceManager } from './PerformanceManager';
import type { PerformanceSettings } from '../EngineCore';

const settings: PerformanceSettings = {
  autoScaleEnabled: true,
  shadowsEnabled: true,
  dynamicMaxParticles: 300,
  adaptiveTrailsActive: true,
  performanceModeActive: false,
  autoPerformanceModeEnabled: false,
  lowFPSThreshold: 45,
  lowFPSDuration: 3000,
};

describe('PerformanceManager', () => {
  it('uses the first animation timestamp as a baseline instead of a slow frame', () => {
    const manager = new PerformanceManager();
    const scaling = vi.fn();
    const performanceMode = vi.fn();
    manager.setCallbacks(scaling, performanceMode);

    manager.updateFPS(125_000, settings, 0, 0, false);
    expect(performanceMode).not.toHaveBeenCalled();
    expect(manager.getCurrentFPS()).toBe(0);

    for (let frame = 1; frame <= 36; frame += 1) {
      manager.updateFPS(125_000 + frame * (1000 / 60), settings, 0, 0, false);
    }
    expect(manager.getCurrentFPS()).toBeGreaterThanOrEqual(58);
    expect(performanceMode).not.toHaveBeenCalledWith(true);
  });

  it('still enables the bounded fallback after a genuinely slow sample window', () => {
    const manager = new PerformanceManager();
    const performanceMode = vi.fn();
    manager.setCallbacks(vi.fn(), performanceMode);
    manager.updateFPS(10_000, settings, 0, 0, false);
    for (let frame = 1; frame <= 12; frame += 1) {
      manager.updateFPS(10_000 + frame * 50, settings, 0, 0, false);
    }
    expect(manager.getCurrentFPS()).toBe(20);
    expect(performanceMode).toHaveBeenCalledWith(true);
  });
});
