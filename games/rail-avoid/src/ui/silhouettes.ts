/**
 * Stylised side-view silhouettes (inline SVG strings) for the expedition scene and the crew picker.
 * Crew face right; foes face left. Colours come from CSS (currentColor + --accent) so themes and
 * colour-blind palettes apply.
 */
import type { CrewSpecialty } from '../core/types';

const HEAD = '<circle cx="30" cy="16" r="9"/>';
const BODY = '<path d="M20 28 Q30 22 40 28 L42 58 Q30 62 18 58 Z"/>';
const LEGS = '<path d="M22 56 L18 88 L26 88 L30 66 L34 88 L42 88 L38 56 Z"/>';
const ARM_FRONT = '<path d="M38 30 L52 44 L48 48 L34 38 Z"/>';
const ARM_BACK = '<path d="M22 30 L12 46 L16 49 L26 38 Z" opacity="0.7"/>';

/** Per-specialty props drawn in the accent colour. */
const PROPS: Record<CrewSpecialty, string> = {
  conductor: '<path d="M19 10 L41 10 L39 5 L21 5 Z"/><rect x="18" y="9" width="24" height="3" rx="1"/><rect x="50" y="42" width="9" height="4" rx="1"/><circle cx="59" cy="44" r="2.5"/>',
  engineer: '<rect x="50" y="36" width="5" height="18" rx="1" transform="rotate(-25 52 45)"/><path d="M47 30 l8 -6 l4 4 l-6 8 z"/>',
  gunner: '<rect x="44" y="41" width="22" height="4" rx="1"/><rect x="40" y="43" width="8" height="7" rx="1"/><rect x="60" y="39" width="4" height="8" rx="1"/>',
  medic: '<rect x="26" y="34" width="8" height="8" rx="1"/><path d="M29 35 h2 v2 h2 v2 h-2 v2 h-2 v-2 h-2 v-2 h2 z" fill="#0b0e1a"/><rect x="8" y="44" width="12" height="9" rx="2"/>',
  surveyor: '<path d="M50 44 L58 30 L61 32 L54 46 Z"/><circle cx="60" cy="29" r="3"/><path d="M60 26 l1 -6 M58 27 l-3 -5 M62 27 l3 -5" stroke="currentColor" stroke-width="1.5" fill="none"/>',
  mechanic: '<rect x="48" y="40" width="14" height="4" rx="1" transform="rotate(-40 55 42)"/><rect x="58" y="30" width="7" height="8" rx="2"/>',
  quartermaster: '<path d="M8 40 h14 v14 h-14 z"/><path d="M11 40 v-4 h8 v4" stroke="currentColor" stroke-width="2" fill="none"/><circle cx="15" cy="47" r="1.5" fill="#0b0e1a"/>',
};

export function crewSilhouette(specialty: CrewSpecialty, size = 72): string {
  const h = size, w = Math.round(size * 0.78);
  return `<svg viewBox="0 0 70 90" width="${w}" height="${h}" aria-hidden="true" class="rv-sil rv-sil-crew rv-sil-${specialty}">` +
    `<g fill="currentColor">${ARM_BACK}${LEGS}${BODY}${HEAD}${ARM_FRONT}</g>` +
    `<g fill="var(--accent, #e8c170)" class="rv-sil-prop">${PROPS[specialty] ?? ''}</g></svg>`;
}

const FOES: Record<string, string> = {
  thug: '<g fill="currentColor"><circle cx="34" cy="16" r="10"/><path d="M18 28 Q34 20 50 28 L54 62 Q34 68 14 62 Z"/><path d="M20 60 L14 92 L24 92 L30 70 L38 92 L48 92 L44 60 Z"/><path d="M50 32 L64 48 L58 52 L44 40 Z"/><path d="M18 34 L4 50 L10 54 L24 42 Z" opacity="0.75"/></g>' +
    '<g fill="var(--accent, #a3a8b8)"><rect x="60" y="18" width="5" height="46" rx="1" transform="rotate(20 62 41)"/><rect x="24" y="4" width="20" height="5" rx="2"/></g>',
  hound: '<g fill="currentColor"><ellipse cx="40" cy="52" rx="26" ry="14"/><circle cx="12" cy="42" r="10"/><path d="M4 40 l-6 6 l8 2 z"/><path d="M8 32 l-4 -10 l8 4 z M16 32 l2 -10 l4 8 z"/><path d="M20 60 l-4 22 l8 0 l2 -18 z M32 62 l-2 22 l8 0 l0 -18 z M48 62 l0 22 l8 0 l2 -18 z M60 58 l4 22 l8 0 l-6 -20 z"/><path d="M64 46 q14 -12 10 -26" stroke="currentColor" stroke-width="5" fill="none" stroke-linecap="round"/></g>' +
    '<g fill="var(--accent, #9a8cff)"><circle cx="8" cy="40" r="2"/><circle cx="14" cy="38" r="2"/></g>',
  shade: '<g fill="currentColor" opacity="0.85"><circle cx="34" cy="14" r="9"/><path d="M22 24 Q34 18 46 24 L52 60 Q46 70 40 62 Q36 76 30 64 Q24 78 18 62 Q12 70 16 56 Z"/><path d="M46 30 L62 24 L64 30 L48 40 Z" opacity="0.7"/><path d="M22 30 L6 24 L4 30 L20 40 Z" opacity="0.5"/></g>' +
    '<g fill="var(--accent, #d6b4f0)"><circle cx="30" cy="13" r="2.2"/><circle cx="38" cy="13" r="2.2"/></g>',
  brute: '<g fill="currentColor"><circle cx="36" cy="18" r="9"/><path d="M10 30 Q36 14 62 30 L64 66 Q36 76 8 66 Z"/><path d="M14 64 L6 94 L20 94 L28 72 L44 72 L52 94 L66 94 L58 64 Z"/><path d="M60 34 L74 52 L66 58 L52 44 Z"/><path d="M12 34 L-2 52 L6 58 L20 44 Z" opacity="0.75"/></g>' +
    '<g fill="var(--accent, #c98a4b)"><rect x="14" y="30" width="44" height="8" rx="2"/><rect x="18" y="42" width="36" height="6" rx="2" opacity="0.8"/><rect x="26" y="4" width="20" height="6" rx="2"/></g>',
};

export function foeSilhouette(kind: string, size = 96): string {
  const body = FOES[kind] ?? FOES.thug;
  const w = Math.round(size * 0.85);
  return `<svg viewBox="-4 0 84 96" width="${w}" height="${size}" aria-hidden="true" class="rv-sil rv-sil-foe rv-sil-${kind}">${body}</svg>`;
}
