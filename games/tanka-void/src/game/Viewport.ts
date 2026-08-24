import {
  WORLD_HEIGHT,
  WORLD_WIDTH,
  type ViewportLayout,
  type WorldPoint,
} from "./types";

export function computeViewport(
  cssWidth: number,
  cssHeight: number,
  requestedDpr: number,
): ViewportLayout {
  const safeWidth = Math.max(1, cssWidth);
  const safeHeight = Math.max(1, cssHeight);
  const dpr = Math.max(1, Math.min(2, requestedDpr || 1));
  const scale = Math.min(safeWidth / WORLD_WIDTH, safeHeight / WORLD_HEIGHT);
  return {
    cssWidth: safeWidth,
    cssHeight: safeHeight,
    bitmapWidth: Math.round(safeWidth * dpr),
    bitmapHeight: Math.round(safeHeight * dpr),
    dpr,
    scale,
    offsetX: (safeWidth - WORLD_WIDTH * scale) / 2,
    offsetY: (safeHeight - WORLD_HEIGHT * scale) / 2,
  };
}

export function mapClientPointToWorld(
  clientX: number,
  clientY: number,
  bounds: Pick<DOMRect, "left" | "top">,
  layout: ViewportLayout,
): WorldPoint {
  const x = (clientX - bounds.left - layout.offsetX) / layout.scale;
  const y = (clientY - bounds.top - layout.offsetY) / layout.scale;
  return {
    x: Math.max(0, Math.min(WORLD_WIDTH, x)),
    y: Math.max(0, Math.min(WORLD_HEIGHT, y)),
  };
}

export interface ResizeObserverPort {
  observe(target: Element): void;
  disconnect(): void;
}

export type ResizeObserverFactory = (
  callback: ResizeObserverCallback,
) => ResizeObserverPort;

const browserResizeObserverFactory: ResizeObserverFactory = (callback) =>
  new ResizeObserver(callback);

export class CanvasViewport {
  private observer: ResizeObserverPort | null = null;
  private layout: ViewportLayout;

  constructor(
    private readonly canvas: HTMLCanvasElement,
    private readonly onChange: () => void,
    private readonly observerFactory: ResizeObserverFactory = browserResizeObserverFactory,
    private readonly readDpr: () => number = () => window.devicePixelRatio || 1,
  ) {
    this.layout = computeViewport(1, 1, 1);
  }

  attach(): void {
    if (this.observer) return;
    this.observer = this.observerFactory(() => this.measure());
    this.observer.observe(this.canvas);
    this.measure();
  }

  destroy(): void {
    this.observer?.disconnect();
    this.observer = null;
  }

  getLayout(): ViewportLayout {
    return this.layout;
  }

  observerCount(): number {
    return this.observer ? 1 : 0;
  }

  private measure(): void {
    const bounds = this.canvas.getBoundingClientRect();
    this.layout = computeViewport(bounds.width, bounds.height, this.readDpr());
    if (this.canvas.width !== this.layout.bitmapWidth)
      this.canvas.width = this.layout.bitmapWidth;
    if (this.canvas.height !== this.layout.bitmapHeight)
      this.canvas.height = this.layout.bitmapHeight;
    this.onChange();
  }
}
