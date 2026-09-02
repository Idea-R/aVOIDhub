/** Phaser game bootstrap. main.ts calls createGame(ctx, document.getElementById('game')!). */
import Phaser from 'phaser';
import type { AppContext } from '../app';
import { GameScene } from './GameScene';
import { BG_CSS } from './palette';

function initialSize(parent: HTMLElement): { w: number; h: number } {
  const r = parent.getBoundingClientRect();
  const w = Math.max(320, Math.round(r.width || parent.clientWidth || window.innerWidth || 1280));
  const h = Math.max(240, Math.round(r.height || parent.clientHeight || window.innerHeight || 720));
  return { w, h };
}

export function createGame(ctx: AppContext, parent: HTMLElement): Phaser.Game | null {
  // Some embedded browsers lay the page out at 0x0 first and never fire a window resize afterwards.
  // Wait for a real size before booting, and keep the canvas glued to the container with a ResizeObserver.
  const r0 = parent.getBoundingClientRect();
  if (!(r0.width > 0 && r0.height > 0)) {
    let started = false;
    const start = () => { if (started) return; const r = parent.getBoundingClientRect(); if (r.width > 0 && r.height > 0) { started = true; ro.disconnect(); clearInterval(iv); window.setTimeout(() => createGame(ctx, parent), 0); } };
    const ro = new ResizeObserver(start);
    ro.observe(parent);
    const iv = window.setInterval(start, 250);
    return null;
  }
  let game = bootWithFallback(ctx, parent);
  try {
    let pending = false;
    const ro = new ResizeObserver(() => {
      if (pending) return;
      pending = true;
      // defer out of the observer callback to avoid "ResizeObserver loop" errors
      window.setTimeout(() => {
        pending = false;
        const r = parent.getBoundingClientRect();
        if (r.width > 0 && r.height > 0) { try { game.scale.refresh(); } catch { /* ignore */ } }
      }, 0);
    });
    ro.observe(parent);
  } catch { /* ResizeObserver unavailable */ }
  return game;
}

function bootWithFallback(ctx: AppContext, parent: HTMLElement): Phaser.Game {
  let game = boot(ctx, parent, Phaser.AUTO);
  // WebGL boot can fail on some drivers/embedded browsers ("Framebuffer status: Incomplete Attachment").
  // Fall back to the Canvas renderer once so the game is always playable.
  let fellBack = false;
  const onError = (ev: ErrorEvent) => {
    const msg = String(ev?.message ?? ev?.error?.message ?? '');
    if (fellBack || ctx.view || !/Framebuffer|WebGL|getContext/i.test(msg)) return;
    fellBack = true;
    window.removeEventListener('error', onError);
    console.warn('[render] WebGL boot failed, falling back to the Canvas renderer:', msg);
    try { game.destroy(true); } catch { /* ignore */ }
    parent.innerHTML = '';
    game = boot(ctx, parent, Phaser.CANVAS);
  };
  window.addEventListener('error', onError);
  setTimeout(() => window.removeEventListener('error', onError), 20000);
  return game;
}

function boot(ctx: AppContext, parent: HTMLElement, type: number): Phaser.Game {
  const scene = new GameScene(ctx);
  const size = initialSize(parent);
  const config: Phaser.Types.Core.GameConfig = {
    type,
    parent,
    backgroundColor: BG_CSS,
    width: size.w,
    height: size.h,
    scale: {
      mode: Phaser.Scale.RESIZE,
      parent,
      width: size.w,
      height: size.h,
      autoRound: true,
    },
    render: {
      antialias: true,
      antialiasGL: true,
      roundPixels: true,
      powerPreference: 'high-performance',
      preserveDrawingBuffer: true,
      pixelArt: false,
      transparent: false,
    },
    fps: { target: 60, forceSetTimeOut: false, smoothStep: true },
    disableContextMenu: true,
    input: { mouse: { preventDefaultWheel: true }, touch: { capture: true }, activePointers: 3 },
    audio: { noAudio: true },
    banner: false,
    scene: [scene],
  };
  const game = new Phaser.Game(config);
  // Safety: if the scene never boots (e.g. WebGL failure), still drop the splash after a while.
  setTimeout(() => {
    try { const boot = document.getElementById('boot'); if (boot && !ctx.view) boot.style.opacity = '0.35'; } catch { /* ignore */ }
  }, 8000);
  return game;
}
