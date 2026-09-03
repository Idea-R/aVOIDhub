# Sprint 05 — Character and Monster Art Matrix

## Shared style lock

Signal Box Storybook character art: expressive model-railway proportions, hand-inked contours and restrained gouache, late-19th-century railway clothing and equipment, deep navy shadows, brass-gold edge light, one specialty color, and controlled violet contamination on hostile creatures. Faces are readable and human without close-up realism or glossy concept-art rendering.

## Crew set

| Character | Specialty | Identity anchor | Portrait | Combat master | Level-2 choice theme | Level-4 choice theme |
|---|---|---|---|---|---|---|
| The Conductor | Conductor | Navy greatcoat, brass cap, whistle | 4:5 | Faces right, commanding stance | Rally vs reposition | Team Tempo vs emergency recovery |
| Hale | Engineer | Goggles, orange scarf, insulated wrench | 4:5 | Faces right, wrench ready | Overcharge safety vs power | Shock strike vs armored guard |
| Sgt. Okoro | Gunner | Coral bandolier, compact railway carbine | 4:5 | Faces right, low firing stance | Focused shot vs suppression | Twin volley vs armor break |
| Ines | Medic | Ice-blue satchel, rolled sleeves | 4:5 | Faces right, field kit open | Strong heal vs cleanse | Revive vs group ward |
| Wren | Surveyor | Teal map case, brass flare pistol | 4:5 | Faces right, sighting a route | Long stun vs Expose | Position swap vs intent reveal |
| Rook | Mechanic | Grease-black apron, heavy spanner | 4:5 | Faces right, braced stance | Counterguard vs repair | Barricade vs burning strike |
| Nessa Quill | Quartermaster | Plum ledger coat, locked cashbox | 4:5 | Faces right, case in one hand | Contract vs supply | Tempo loan vs forced withdrawal |

Hale, Sgt. Okoro, Ines, Wren and Rook already appear in existing event outcomes and should become their canonical characters rather than being replaced. Nessa Quill is the only new working name. The Conductor remains the fixed player character; recruit identity keys must be stable even if display names change.

## Standard foes

| Foe | Region introduction | Silhouette/prop | Combat lesson |
|---|---|---|---|
| Rail Thug | Greenbelt | Patched coat, rail-spike club | Basic readable heavy tell |
| Void Hound | Greenbelt | Low violet quadruped, three eyes | Two fast attacks and position pressure |
| Void Shade | Ash Steppe | Torn floating coat, lantern-like core | Phase/resistance and Burning counter |
| Scrap Brute | Rust Reaches | Broad salvaged armor, furnace hammer | Armor, Exposed and slow area tell |

## Region minibosses

| Miniboss | Visual anchor | Mechanical signature | Required art state |
|---|---|---|---|
| The Spike Captain | Tall rail duelist with switchman's coat and a bundle of marked spikes | Marks a target, then heavy execution | Base plus marked-spike glow overlay |
| Furnace Foreman | Riveted exosuit built around a glowing portable furnace | Furnace armor; targetable weak component | Armored base plus exposed-furnace overlay |
| The Ash Cantor | Masked choir leader wrapped in ash banners | Silence, delayed area chant, position puzzle | Base plus active-chant aura overlay |
| The Gate Warden | Fractured railway sentinel with mirrored violet plates | Half-HP phase shift; mirrors last specialty | Base plus phase-two mirror overlay |

## Runtime outputs

- `public/art/crew/<characterKey>-portrait.webp` — 800×1000 source ratio, displayed down to 48×60.
- `public/art/crew/<characterKey>-combat.webp` — full-body alpha cutout, 768×1024 source ratio.
- `public/art/foes/<foeKey>-combat.webp` — full-body alpha cutout, longest edge 1200.
- `public/art/foes/<foeKey>-overlay.webp` — optional transparent phase/ability overlay.
- `public/art/abilities/<abilityKey>.svg` — authored interface glyphs, not image-generation output.
- `public/art/status/<statusKey>.svg` — Guarded, Exposed, Stunned and Burning.

Portrait thumbnails and enemy dossier crops must be derived from these masters during the build; they are not separately generated images.

## Asset acceptance

- Correct character key and runtime mapping.
- Genuine alpha for combat/overlay files; no baked checkerboard or halo.
- Face, clothing, palette and signature prop agree between portrait and combat master.
- Neutral idle silhouette remains readable at 96 CSS pixels high.
- Transparent bounds contain at least 6% padding and no more than 22% empty area on any side.
- WebP runtime size target: portrait ≤180 KB, combat master ≤220 KB, overlay ≤120 KB.
- No text, logos, UI frames, scenery or unrelated weapons baked into character masters.
- A visual contact sheet is regenerated and reviewed after every accepted batch.
