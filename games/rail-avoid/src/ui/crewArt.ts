/** One authored identity per current specialty; no procedural crew stand-ins. */
import type { CrewSpecialty } from '../core/types';
import { el } from './dom';
import './crewPortrait.css';
import conductor from '/art/crew/conductor-combat.webp?url&inline';
import conductorPortrait from '/art/crew/conductor.webp?url&inline';
import gunner from '/art/crew/gunner-combat-v1.webp?url&inline';
import gunnerPortrait from '/art/crew/gunner-portrait-v1.webp?url&inline';
import engineer from '/art/crew/engineer-combat-v1.webp?url&inline';
import engineerPortrait from '/art/crew/engineer-portrait-v1.webp?url&inline';
import medic from '/art/crew/medic-combat-v1.webp?url&inline';
import medicPortrait from '/art/crew/medic-portrait-v1.webp?url&inline';
import surveyor from '/art/crew/surveyor-combat-v1.webp?url&inline';
import surveyorPortrait from '/art/crew/surveyor-portrait-v1.webp?url&inline';
import mechanic from '/art/crew/mechanic-combat-v1.webp?url&inline';
import mechanicPortrait from '/art/crew/mechanic-portrait-v1.webp?url&inline';
import quartermaster from '/art/crew/quartermaster-combat-v1.webp?url&inline';
import quartermasterPortrait from '/art/crew/quartermaster-portrait-v1.webp?url&inline';
export const CREW_AVATARS = { conductor, gunner, engineer, medic, surveyor, mechanic, quartermaster } satisfies Record<CrewSpecialty, string>;
export const CREW_PORTRAITS = { conductor: conductorPortrait, gunner: gunnerPortrait, engineer: engineerPortrait, medic: medicPortrait, surveyor: surveyorPortrait, mechanic: mechanicPortrait, quartermaster: quartermasterPortrait } satisfies Record<CrewSpecialty, string>;

/** Presentation-only crop: retain the original native-alpha art and full-body sprites. */
export function crewPortrait(specialty: CrewSpecialty, className: string, alt = ''): HTMLElement {
  const frame = el('span', { class: `rv-portrait-window ${className}` }, el('img', { alt }));
  setCrewPortrait(frame, specialty);
  return frame;
}

export function setCrewPortrait(frame: HTMLElement, specialty: CrewSpecialty): void {
  frame.dataset.portraitRole = specialty;
  const img = frame.querySelector('img')!;
  if (img.getAttribute('src') !== CREW_PORTRAITS[specialty]) img.src = CREW_PORTRAITS[specialty];
}
