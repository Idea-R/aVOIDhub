/**
 * Custom SVG cursors (32 px, data-URI, explicit hotspots). Exposed as CSS custom properties on <html>
 * (--rv-cur-default, -ui, -plan, -blocked, -pointer, -grab) and switched on with html.rv-cursors.
 * styles.css maps them onto the canvas ([data-cursor=...] set by the render layer) and the DOM UI.
 * Settings.customCursor === false removes the class and the browser falls back to system cursors.
 */

const GOLD = '#e8c170', DARK = '#1a1408', RED = '#e86f6f';

/** Wrap paths in a 32x32 SVG. Every stroke is drawn twice (dark halo under gold) so it reads on any terrain. */
function svg(inner: string): string {
  return `<svg xmlns="http://www.w3.org/2000/svg" width="32" height="32" viewBox="0 0 32 32">${inner}</svg>`;
}
function halo(d: string, color: string, w = 1.6): string {
  return `<path d="${d}" fill="none" stroke="${DARK}" stroke-width="${w + 2}" stroke-linecap="round" opacity="0.85"/><path d="${d}" fill="none" stroke="${color}" stroke-width="${w}" stroke-linecap="round"/>`;
}

// thin crosshair with a gap at the centre
const CROSS = 'M16 3 V11 M16 21 V29 M3 16 H11 M21 16 H29';
const DOT = `<circle cx="16" cy="16" r="1.4" fill="${GOLD}" stroke="${DARK}" stroke-width="0.8"/>`;
// tiny rail spike in the lower-right quadrant: square head + tapered shaft
const SPIKE = `<path d="M22.5 21.5 h5 v2.2 h-1.4 l-0.9 6.3 h-0.4 l-0.9 -6.3 h-1.4 z" fill="${GOLD}" stroke="${DARK}" stroke-width="0.9" stroke-linejoin="round"/>`;

const POINTER_PATH = 'M5 3 L5 24 L10.5 19.5 L14.5 28 L18.5 26.2 L14.6 17.8 L21.5 17.8 Z';

export const CURSORS = {
  default: { svg: svg(halo(CROSS, GOLD) + DOT + SPIKE), hot: [16, 16] as const, fallback: 'crosshair' },
  plan:    { svg: svg(halo(CROSS, GOLD) + DOT + halo('M24 5 V11 M21 8 H27', '#8ee29a', 2)), hot: [16, 16] as const, fallback: 'crosshair' },
  blocked: { svg: svg(`<circle cx="16" cy="16" r="9.5" fill="rgba(26,20,8,0.35)" stroke="${DARK}" stroke-width="4"/><circle cx="16" cy="16" r="9.5" fill="none" stroke="${RED}" stroke-width="2.2"/>` + halo('M9.5 9.5 L22.5 22.5', RED, 2.2)), hot: [16, 16] as const, fallback: 'not-allowed' },
  pointer: { svg: svg(`<path d="${POINTER_PATH}" fill="${GOLD}" stroke="${DARK}" stroke-width="1.6" stroke-linejoin="round"/>`), hot: [5, 3] as const, fallback: 'pointer' },
  ui:      { svg: svg(`<path d="${POINTER_PATH}" fill="#fff2cf" stroke="${DARK}" stroke-width="1.6" stroke-linejoin="round"/><path d="M7 6 L7 19" stroke="${GOLD}" stroke-width="1.2" stroke-linecap="round"/>`), hot: [5, 3] as const, fallback: 'pointer' },
  grab:    { svg: svg(`<path d="M10 15 V9.5 a2 2 0 0 1 4 0 V14 V7.5 a2 2 0 0 1 4 0 V14 V9 a2 2 0 0 1 4 0 V15 V12 a2 2 0 0 1 4 0 V20 c0 5 -3 8 -8 8 c-4 0 -6 -2 -8 -5 l-3.5 -5 a2 2 0 0 1 3.2 -2.3 L10 17 Z" fill="${GOLD}" stroke="${DARK}" stroke-width="1.6" stroke-linejoin="round"/>`), hot: [14, 14] as const, fallback: 'grab' },
};

export type CursorKind = keyof typeof CURSORS;

function cssValue(k: CursorKind): string {
  const c = CURSORS[k];
  return `url("data:image/svg+xml;utf8,${encodeURIComponent(c.svg)}") ${c.hot[0]} ${c.hot[1]}, ${c.fallback}`;
}

let installed = false;
/** Write the cursor variables once; toggle html.rv-cursors according to the setting. */
export function applyCursors(enabled: boolean): void {
  if (typeof document === 'undefined') return;
  const root = document.documentElement;
  if (!installed) {
    installed = true;
    for (const k of Object.keys(CURSORS) as CursorKind[]) root.style.setProperty('--rv-cur-' + k, cssValue(k));
  }
  root.classList.toggle('rv-cursors', !!enabled);
}
