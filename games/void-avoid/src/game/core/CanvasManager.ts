import { CanvasCore, type CanvasCoreConfig } from './canvas/CanvasCore';
import { CoordinateMapper, type CoordinateMapperConfig } from './canvas/CoordinateMapper';
import { ResizeManager, type ResizeManagerConfig } from './canvas/ResizeManager';

export interface CanvasConfig {
  preventZoom: boolean;
  handleDevicePixelRatio: boolean;
  maintainAspectRatio: boolean;
  minWidth: number;
  minHeight: number;
  maxWidth: number;
  maxHeight: number;
}

export interface CanvasState {
  displayWidth: number;
  displayHeight: number;
  actualWidth: number;
  actualHeight: number;
  pixelRatio: number;
  scaleX: number;
  scaleY: number;
  offsetX: number;
  offsetY: number;
  browserZoom: number;
}

export interface CanvasManagerConfig {
  core?: Partial<CanvasCoreConfig>;
  coordinateMapper?: Partial<CoordinateMapperConfig>;
  resizeManager?: Partial<ResizeManagerConfig>;
}

/** Single resize and coordinate owner. Browser zoom remains available for accessibility. */
export class CanvasManager {
  private readonly canvasCore: CanvasCore;
  private readonly coordinateMapper: CoordinateMapper;
  private readonly resizeManager: ResizeManager;
  private config: CanvasConfig;

  constructor(
    canvas: HTMLCanvasElement,
    config: Partial<CanvasConfig> = {},
    moduleConfig: CanvasManagerConfig = {},
  ) {
    const context = canvas.getContext('2d');
    if (!context) throw new Error('Could not get 2D canvas context');
    this.config = {
      preventZoom: false,
      handleDevicePixelRatio: false,
      maintainAspectRatio: false,
      minWidth: 1,
      minHeight: 1,
      maxWidth: 3840,
      maxHeight: 2160,
      ...config,
    };
    this.canvasCore = new CanvasCore(canvas, this.config, moduleConfig.core);
    this.coordinateMapper = new CoordinateMapper(canvas, context, {
      enableZoomCorrection: false,
      ...moduleConfig.coordinateMapper,
    });
    this.resizeManager = new ResizeManager(canvas, context, this.config, {
      displayWidth: 0,
      displayHeight: 0,
      actualWidth: 0,
      actualHeight: 0,
      pixelRatio: 1,
      scaleX: 1,
      scaleY: 1,
      offsetX: 0,
      offsetY: 0,
      browserZoom: 1,
    }, moduleConfig.resizeManager);
    this.resizeManager.forceResize();
  }

  screenToCanvas(screenX: number, screenY: number): { x: number; y: number } {
    return this.coordinateMapper.screenToCanvas(screenX, screenY, this.resizeManager.getState());
  }

  canvasToScreen(canvasX: number, canvasY: number): { x: number; y: number } {
    return this.coordinateMapper.canvasToScreen(canvasX, canvasY, this.resizeManager.getState());
  }

  isInBounds(x: number, y: number): boolean {
    return this.coordinateMapper.isInBounds(x, y, this.resizeManager.getState());
  }

  getState(): CanvasState { return this.resizeManager.getState(); }
  getGameDimensions(): { width: number; height: number } { return this.resizeManager.getGameDimensions(); }
  getBrowserZoom(): number { return 1; }
  updateBrowserZoom(): void { /* browser zoom is intentionally not intercepted */ }
  onResize(callback: (state: CanvasState) => void): void { this.resizeManager.onResize(callback); }
  forceResize(): void { this.resizeManager.forceResize(); }

  updateConfig(config: Partial<CanvasConfig>): void {
    this.config = { ...this.config, ...config, preventZoom: false };
    this.canvasCore.updateCanvasConfig(this.config);
    this.resizeManager.updateCanvasConfig(this.config);
  }

  cleanup(): void {
    this.canvasCore.cleanup();
    this.resizeManager.cleanup();
  }
}
