/** Passenger event modal. */
import { el, cap } from './dom';
import type { UiShared } from './shared';
import type { SimState, PassengerEventDef, PassengerEventOption } from '../core/types';
import { activeEventDef, eventStepKey, keeperConversation, type ConversationDef } from '../core/conversations';
import { unmetEventRequirement as unmet } from '../core/eventRequirements';
import { crewPortrait } from './crewArt';
import brassFrame from '/art/ui/expedition-brass-frame-v2.webp?url&inline';
import './conversation.css';
import './trackEncounter.css';
import lanternCamp from '/art/scenes/lantern-camp-v2.webp?url&inline';
import ruinApproach from '/art/scenes/ruin-approach-v2.webp?url&inline';
import falseSignal from '/art/scenes/false-signal-v2.webp?url&inline';
import rainboundSurvivor from '/art/scenes/rainbound-survivor-v2.webp?url&inline';
import abandonedGunCar from '/art/scenes/abandoned-gun-car-v2.webp?url&inline';
import watersideRailDock from '/art/scenes/waterside-rail-dock-v2.webp?url&inline';

export interface EventModal { el: HTMLElement; show(defId?: string): void; update(s: SimState): void; gamepad(button: number): boolean }

function sceneFor(defId: string): { src: string; alt: string } | null {
  if (defId === 'node_site' || defId === 'mystery_away') return { src: ruinApproach, alt: 'The train waits beside an ancient ruin entrance.' };
  if (defId === 'mystery_ambush' || defId === 'track_ambush') return { src: falseSignal, alt: 'Raiders spring a barricade around a false railway signal.' };
  if (defId === 'mystery_survivor') return { src: rainboundSurvivor, alt: 'A lone rail gunner waits beside a wrecked handcar in the rain.' };
  if (defId === 'mystery_weapon') return { src: abandonedGunCar, alt: 'A damaged gun car waits on an overgrown siding.' };
  if (defId === 'mystery_dock') return { src: watersideRailDock, alt: 'A lantern-lit rail dock and fishing settlement beside dark water.' };
  if (defId === 'mystery_cache') return { src: lanternCamp, alt: 'A lantern-lit camp beside the railway.' };
  return null;
}

export function createEventModal(ui: UiShared): EventModal {
  const box = el('div', { class: 'rv-panel rv-modal rv-event' });
  // rv-zone: the card is centred inside the free zone (below the top bar, above the dock, beside any side panel)
  const overlay = el('div', { class: 'rv-overlay rv-zone', role: 'dialog', 'aria-modal': 'true', 'aria-label': 'Passenger event' }, box);
  let currentId: string | null = null;
  let currentStep = '';
  let optionButtons: Array<{ btn: HTMLButtonElement; why: HTMLElement; opt: PassengerEventOption }> = [];

  function render(def: PassengerEventDef, s: SimState | null): void {
    optionButtons = [];
    const conversation = def.id === 'node_crossroads' ? def as ConversationDef : null;
    const step = s ? eventStepKey(s) : '';
    const mystery = def.id.startsWith('mystery_');
    box.className = 'rv-panel rv-modal rv-event' + (def.negative ? ' rv-negative' : '') + (mystery ? ' rv-mystery-event' : '') + (conversation ? ' rv-conversation' : '');
    overlay.classList.toggle('rv-location-overlay', !!conversation);
    overlay.classList.toggle('rv-track-overlay', def.id === 'track_ambush');
    overlay.setAttribute('aria-label', conversation ? 'A conversation at the crossroads' : 'Passenger event');
    box.style.setProperty('--exp-frame', `url("${brassFrame}")`);
    const options = el('div', { class: 'rv-options', role: 'group', 'aria-label': 'Choices' });
    def.options.forEach((o, i) => {
      const why = el('span', { class: 'rv-opt-why' });
      const marks = o.requires?.marks ?? 0;
      const b = el('button', { class: 'rv-btn rv-option' + (marks ? ' rv-opt-marks' : ''), type: 'button', 'aria-label': `${o.label}. ${o.desc}${marks ? ` Costs ${marks} Void Marks.` : ''}` },
        el('span', { class: 'rv-opt-label' }, `${i + 1}. ${o.label}`, marks ? el('span', { class: 'rv-opt-cost', title: `${marks} Void Marks`, text: `◆ ${marks}` }) : null),
        el('span', { class: 'rv-opt-desc', text: o.desc }),
        why,
      );
      b.addEventListener('click', () => {
        const sim = ui.sim();
        if (!sim) return;
        const st = ui.state();
        const live = st ? activeEventDef(st)?.options[i] : undefined;
        if (!st || !live || unmet(st, live)) { ui.audio().ui('error'); return; }
        const ok = sim.chooseEventOption(i, step);
        if (ok) {
          ui.audio().ui('confirm');
          const next = ui.state()?.activeEvent;
          if (next && !next.preparingExpedition) show(next.defId);
          else ui.close('event');
        } else { ui.audio().ui('error'); if (st) update(st); }
      });
      options.appendChild(b);
      optionButtons.push({ btn: b, why, opt: o });
    });
    const h2 = el('h2', { text: def.title });
    if (conversation && s) {
      const place = s.settlements.find(x => x.id === s.activeEvent?.locationId)?.name ?? 'Crossroads';
      const arrival = s.activeEvent?.arrival;
      const receipt = [arrival?.passengers ? `${arrival.passengers} passengers boarded` : '', arrival?.crewName ? `${arrival.crewName} joined the crew` : ''].filter(Boolean).join(' · ');
      const dialogue = el('div', { class: 'rv-conversation-lines', 'aria-live': 'polite' },
        ...conversation.exchange.map((line, i) => el('div', { class: 'rv-conversation-line' },
          i === 1 ? crewPortrait('conductor', 'rv-conversation-portrait') : null,
          el('div', {}, el('b', { class: 'rv-conversation-speaker', text: line.speaker }), el('p', { text: line.text })),
        )),
      );
      box.dataset.dialogueStep = s.activeEvent?.dialogue?.step ?? 'arrival';
      box.replaceChildren(
        el('header', { class: 'rv-conversation-heading' }, el('div', { class: 'rv-label', text: `${place} · train waiting` }), h2),
        el('div', { class: 'rv-conversation-body' },
          el('figure', { class: 'rv-conversation-scene' }, el('img', { src: ruinApproach, alt: 'The train waits at the entrance to the old rail works.' }), el('figcaption', { text: 'The lower works' })),
          dialogue,
        ),
        el('div', { class: 'rv-conversation-context', text: conversation.context }),
        options,
        el('footer', { class: 'rv-conversation-footer' },
          el('span', { text: receipt || 'The railway stays open. Your route does not change.' }),
          el('span', { text: `1–${def.options.length} choose · Tab navigate · Enter confirm` }),
        ),
      );
      update(s);
      return;
    }
    const scene = sceneFor(def.id);
    const mysteryMarks: Record<string, string> = {
      mystery_cache: '▣', mystery_away: '⚔', mystery_ambush: '⚠', mystery_survivor: '♟', mystery_weapon: '⌁', mystery_dock: '≋',
    };
    const heading = el('div', { class: 'rv-event-heading' },
      ...(mystery ? [el('div', { class: 'rv-mystery-mark', 'aria-hidden': 'true', text: mysteryMarks[def.id] ?? '?' })] : []),
      el('div', { class: 'rv-event-heading-copy' },
        el('div', { class: 'rv-label rv-wire', text: def.id === 'track_ambush' ? 'Line blocked · train waiting' : mystery ? 'Unknown signal · identity revealed' : (def.negative ? 'Trouble aboard' : 'Aboard the train') }),
        h2,
      ),
    );
    const decision = el('div', { class: 'rv-event-decision' },
      el('p', { class: 'rv-event-text', text: def.text }),
      options,
      el('div', { class: 'rv-hint', text: `Press 1–${def.options.length} to choose. The train waits while you decide.` }),
    );
    const body = el('div', { class: scene ? 'rv-event-body rv-has-scene' : 'rv-event-body' },
      ...(scene ? [el('figure', { class: 'rv-event-scene' }, el('img', { src: scene.src, alt: scene.alt, 'data-scene': def.id }))] : []),
      decision,
    );
    box.replaceChildren(heading, body);
    if (s) update(s);
  }

  function show(defId?: string): void {
    const s = ui.state();
    const id = defId ?? s?.activeEvent?.defId ?? null;
    if (!id || !s || s.activeEvent?.preparingExpedition) return;
    const def = activeEventDef(s, id);
    if (!def) return;
    const step = eventStepKey(s);
    if (currentId === id && currentStep === step && ui.isOpen('event')) return;
    const alreadyOpen = ui.isOpen('event');
    currentId = id;
    currentStep = step;
    render(def, s);
    // A conversation advances inside one fixed card, without replaying its entrance.
    if (!alreadyOpen) ui.open('event');
    update(s);
    ui.focusFirst(overlay);
  }

  function update(s: SimState): void {
    if (!ui.isOpen('event')) return;
    const liveOptions = currentId === 'node_crossroads' ? keeperConversation(s).options : null;
    for (const [i, { btn: b, why, opt }] of optionButtons.entries()) {
      const live = liveOptions?.[i] ?? opt;
      const reason = unmet(s, live);
      const dis = !!reason;
      if (b.disabled !== dis) b.disabled = dis;
      const txt = reason ? cap(reason) : '';
      if (why.textContent !== txt) why.textContent = txt;
      // Keep current costs honest if game state changes while the dialog is open.
      const desc = b.querySelector('.rv-opt-desc');
      if (desc && desc.textContent !== live.desc) desc.textContent = live.desc;
      b.setAttribute('aria-label', `${live.label}. ${live.desc}${reason ? ` ${reason}` : ''}`);
    }
  }

  // number keys choose options
  overlay.addEventListener('keydown', (e) => {
    if (e.repeat) { e.preventDefault(); return; }
    const n = Number(e.key);
    if (n >= 1 && n <= optionButtons.length) {
      e.preventDefault();
      optionButtons[n - 1].btn.click();
    }
  });

  function gamepad(button: number): boolean {
    if (!ui.isOpen('event')) return false;
    const choices = optionButtons.map(x => x.btn).filter(x => !x.disabled);
    const current = choices.indexOf(document.activeElement as HTMLButtonElement);
    if (button === 0) (choices[current] ?? choices[0])?.click();
    if ([12, 13, 14, 15].includes(button) && choices.length) choices[(Math.max(0, current) + ([12, 14].includes(button) ? -1 : 1) + choices.length) % choices.length].focus();
    return true;
  }

  ui.registerPanel('event', { el: overlay, modal: true, escClosable: false, anim: 'fade', onClose: () => { currentId = null; } });
  return { el: overlay, show, update, gamepad };
}
