/** ViewApi implementation bound to the GameScene. */
import type { ViewApi } from '../app';
import type { Settings } from '../core/types';
import type { GameScene } from './GameScene';
import { ISO_Y } from '../core/config';
import { hexToWorld } from '../core/hex';
import { clamp } from './util';
import { ZOOM_MIN, ZOOM_MAX } from './cameraController';

export function createViewApi(scene: GameScene): ViewApi {
  const cam = () => scene.cameras.main;
  const center = () => ({ x: scene.scale.width / 2, y: scene.scale.height / 2 });
  const api: ViewApi & { __scene: GameScene } = {
    __scene: scene,
    zoomIn() { const c = center(); scene.cameraCtl.zoomBy(1.25, c.x, c.y); },
    zoomOut() { const c = center(); scene.cameraCtl.zoomBy(1 / 1.25, c.x, c.y); },
    setZoom(z: number) { scene.cameraCtl.setZoom(clamp(Number(z) || 1, ZOOM_MIN, ZOOM_MAX)); },
    getZoom() { return cam().zoom; },
    centerOnTrain() {
      scene.cameraCtl.following = true;
      const lp = scene.locoWorld();
      if (lp) scene.cameraCtl.follow(lp.x, lp.y * ISO_Y, 0, true);
    },
    setFollow(on: boolean) { scene.cameraCtl.following = !!on; },
    isFollowing() { return scene.cameraCtl.following; },
    panBy(dx: number, dy: number) { scene.cameraCtl.panBy(Number(dx) || 0, Number(dy) || 0); },
    screenToHex(sx: number, sy: number) { try { return scene.screenToHex(sx, sy); } catch { return null; } },
    hexToScreen(col: number, row: number) {
      const w = hexToWorld(col | 0, row | 0);
      return scene.worldToScreen(w.x, w.y);
    },
    worldToScreen(x: number, y: number) { return scene.worldToScreen(x, y); },
    selectCar(index: number) { scene.selectedCar = Number.isFinite(index) ? (index | 0) : -1; },
    getSelectedCar() { return scene.selectedCar; },
    snapshot() {
      try {
        // Render one frame synchronously so the buffer holds the latest scene, then read the canvas.
        return scene.game.canvas.toDataURL('image/png');
      } catch (e) { console.warn('[render] snapshot failed', e); return null; }
    },
    perf() {
      const loop = scene.game.loop;
      const renderer = scene.game.renderer as unknown as { drawCount?: number };
      const drawCalls = typeof renderer.drawCount === 'number' && renderer.drawCount > 0 ? renderer.drawCount : scene.visibleCount;
      return {
        fps: Math.round(loop.actualFps * 10) / 10,
        frameMs: Math.round(scene.perfMon.frameMs * 100) / 100,
        worstFrameMs: Math.round(scene.perfMon.worstFrameMs * 100) / 100,
        drawCalls,
        quality: scene.qualityMode === 'auto' ? `auto(${scene.settings.quality})` : scene.settings.quality,
      };
    },
    setQuality(q: Settings['quality']) {
      const v = q === 'auto' || q === 'high' || q === 'medium' || q === 'low' ? q : 'auto';
      scene.setQuality(v);
    },
    setReducedMotion(on: boolean) { scene.applySettings({ reducedMotion: !!on }); },
    moveCursor(dCol: number, dRow: number) { scene.moveCursor(Number(dCol) || 0, Number(dRow) || 0); },
    confirmCursor() { scene.confirmCursor(); },
    resize() { scene.refreshLayout(); },
    playCinematic(name, data) {
      try { return scene.cine.play(name, data ?? {}); } catch (e) { console.warn('[render] cinematic', e); return Promise.resolve(); }
    },
    skipCinematic() { try { scene.cine.skip(); } catch { /* ignore */ } },
    isCinematicPlaying() { return scene.cine.isPlaying(); },
  };
  return api;
}
