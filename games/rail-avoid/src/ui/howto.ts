/** How to Play overlay: six concise cards. */
import { el, btn } from './dom';
import type { UiShared } from './shared';

const CARDS: Array<{ title: string; text: string }> = [
  { title: 'Plan track', text: 'Click hexes ahead of the locomotive to lay a route. Old rail lines are FREE; new track costs rails and depends on terrain (plains 1, hills 3, water 4). Backspace undoes the last hex.' },
  { title: 'Keep moving', text: 'A stopped train builds stop pressure and waves come faster. The void front never stops eating the map from the west — outrun it toward the Last Gate in the east.' },
  { title: 'Cars & adjacency', text: 'Generators power cars within 3 positions; too many consumers → brownout. Heat diffuses to neighbours (≥80 damage, ≥100 fire). Weapons need an ammo supplier within 2 cars. Reorder at yards.' },
  { title: 'Boarding', text: 'Raiders and drones put boarders inside your cars. They walk toward the locomotive every 4 s. Barracks marines and flamethrowers purge adjacent cars; Armour Plate blocks the walk.' },
  { title: 'Settlements', text: 'Reach settlements before their deadline: collect cargo, passengers and specialists. Yards repair and sell cars. Passengers eat food, trigger events, and pay rails when delivered.' },
  { title: 'The void', text: 'Under 4 hexes the meter turns red. Detach rear cars (D) to lose weight instantly — the abandoned segment lures enemies for 20 s. If the void or a sapper reaches the locomotive, the run ends.' },
  { title: 'Expeditions', text: 'Expedition Sites (ruins by the line) offer a timed-hit crew fight: pick up to three crew, STRIKE and press Space on impact for a PERFECT hit, GUARD as a foe\'s blow lands to block it, and use each specialist\'s Special. Every round hands the void 8 s of travel. Win for a relic, Void Marks and salvage.' },
  { title: 'Relics & marks', text: 'Elites (glowing, from region 2), bosses and won expeditions offer a 1-of-3 relic: a permanent passive for the run, shown as chips in the top bar. Void Marks (◆) come from elites, bounties and expeditions; markets sell a relic choice for marks. Settlements post bounties — see the tracker under the route panel.' },
];

export function createHowto(ui: UiShared): HTMLElement {
  const overlay = el('div', { class: 'rv-overlay', role: 'dialog', 'aria-modal': 'true', 'aria-label': 'How to play' },
    el('div', { class: 'rv-panel rv-modal rv-howto' },
      el('h2', { text: 'How to Play' }),
      el('div', { class: 'rv-cards rv-rows' },
        ...CARDS.map((c, i) => el('article', { class: 'rv-card' },
          el('h4', null, c.title, el('span', { class: 'rv-card-n', text: String(i + 1).padStart(2, '0') })),
          el('p', { text: c.text }),
        )),
      ),
      el('h3', { text: 'Controls' }),
      el('p', { html: '<kbd>Space</kbd> pause · <kbd>1</kbd>/<kbd>2</kbd> speed · <kbd>Backspace</kbd>/<kbd>Z</kbd> unplan · <kbd>D</kbd> detach last car · <kbd>R</kbd> reverse / stop ·<kbd>Tab</kbd> train panel · <kbd>Esc</kbd> menu · <kbd>M</kbd> mute · <kbd>+</kbd>/<kbd>-</kbd> zoom · <kbd>F</kbd> centre · <kbd>WASD</kbd> pan · <kbd>IJKL</kbd> cursor · <kbd>Enter</kbd> plan at cursor · <kbd>H</kbd> this screen. Expedition: <kbd>1</kbd>-<kbd>3</kbd> target · <kbd>S</kbd>/<kbd>G</kbd>/<kbd>E</kbd>/<kbd>F</kbd> strike / guard / special / flee · <kbd>Space</kbd> on impact. Gamepad: left stick pan, right stick cursor, A plan, B unplan, X depart, Y train, Start pause, LB/RB speed; in an expedition A strikes / presses on impact, Y guards, X special, D-pad browses.' }),
      el('div', { class: 'rv-actions' },
        btn('Got it', () => { ui.audio().ui('close'); ui.close('howto'); }, { class: 'rv-primary' }),
      ),
    ),
  );
  ui.registerPanel('howto', { el: overlay, modal: true, escClosable: true });
  return overlay;
}
