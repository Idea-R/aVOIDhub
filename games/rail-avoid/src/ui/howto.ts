/** How to Play overlay: six concise cards. */
import { el, btn } from './dom';
import type { UiShared } from './shared';

const CARDS: Array<{ title: string; text: string }> = [
  { title: 'Plan track', text: 'Click hexes ahead of the locomotive to lay a route. Old rail lines are FREE; new track costs rails and depends on terrain (plains 1, hills 3, water 4). Backspace undoes the last hex.' },
  { title: 'Keep moving', text: 'A stopped train builds stop pressure and waves come faster. The void front never stops eating the map from the west — outrun it toward the Last Gate in the east.' },
  { title: 'Cars & adjacency', text: 'Generators power cars within 3 positions; too many consumers → brownout. Heat diffuses to neighbours (≥80 damage, ≥100 fire). Gatling, Cannon and Flak cars draw directly from shared ammo, from any position. Cargo adds capacity and Foundries make ammo. Starter emergency couplers reconnect the train through region 2; after that, a destroyed car can strand everything behind it.' },
  { title: 'Boarding', text: 'Raiders and drones put boarders inside your cars. They walk toward the locomotive every 4 s. Every operational car has weak ammo-free sidearms against nearby ground and air attackers or its own boarders. Posting any living specialist strengthens them; gunners add more damage. They cannot hurt wisps. Barracks and flamethrowers still clear boarders much faster; Armour Plate blocks the walk.' },
  { title: 'Crew postings', text: 'When a specialist joins, CREW READY appears above the train. Click it, choose a car, then Post specialist. Gunners improve weapons, engineers improve power, mechanics repair their car, medics heal crew, surveyors extend planning, and quartermasters expand storage.' },
  { title: 'Settlements', text: 'Reach settlements before their deadline: collect cargo, passengers and specialists. Staffed settlements and crossroads let you reorder cars. Choose Service stop to hold departure, then repair the weakest hulls to 80%: 4% of one car every 2 seconds, at 1 scrap per 8 HP. The Void keeps moving; X departs. Yards offer instant full repairs, upgrades and trading. Passengers eat food, trigger events, and pay rails when delivered.' },
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
      el('p', { html: 'At staffed stops: <kbd>P</kbd> toggles field repairs and holds departure. <kbd>X</kbd> departs. Choose Service stop → Arrange cars to reorder; repairs and the Void use real world time. <kbd>Space</kbd> pauses both.' }),
      el('p', { html: '<kbd>C</kbd> continue deeper, leave a result, start your prepared team, or resume the pause menu. <kbd>Tab</kbd> moves focus; <kbd>Enter</kbd> confirms that focused control (including Cancel or Retreat). <kbd>Esc</kbd> goes back where safe. <kbd>1</kbd>–<kbd>9</kbd> select the numbered choices on the current screen. C never chooses a dialogue branch or relic for you.' }),
      el('p', { html: 'In combat: <kbd>S</kbd> strike, <kbd>G</kbd> guard, <kbd>E</kbd> special, <kbd>W</kbd> choose a swap, <kbd>F</kbd> flee. Press the action key again or <kbd>Space</kbd> on impact. At a cleared stage: <kbd>C</kbd> continue, <kbd>F</kbd> retreat.' }),
      el('p', { html: '<kbd>Space</kbd> pause · <kbd>1</kbd>/<kbd>2</kbd> speed · <kbd>Backspace</kbd>/<kbd>Z</kbd> unplan · <kbd>D</kbd> detach last car · <kbd>R</kbd> reverse / stop · <kbd>T</kbd> train panel · <kbd>Tab</kbd> focus controls · <kbd>Esc</kbd> menu · <kbd>M</kbd> mute · <kbd>+</kbd>/<kbd>-</kbd> zoom · <kbd>F</kbd> centre · right-drag or <kbd>WASD</kbd> pan · <kbd>IJKL</kbd> cursor · <kbd>Enter</kbd> plan at cursor · <kbd>H</kbd> this screen. Expedition: <kbd>1</kbd>-<kbd>3</kbd> target · <kbd>S</kbd>/<kbd>G</kbd>/<kbd>E</kbd>/<kbd>F</kbd> strike / guard / special / flee · <kbd>Space</kbd> on impact. Gamepad: left stick pan, right stick cursor, A plan, B unplan, X depart, Y train, Start pause, LB/RB speed; in an expedition A strikes / presses on impact, Y guards, X special, D-pad browses.' }),
      el('div', { class: 'rv-actions' },
        btn('Got it', () => { ui.audio().ui('close'); ui.close('howto'); }, { class: 'rv-primary' }),
      ),
    ),
  );
  ui.registerPanel('howto', { el: overlay, modal: true, escClosable: true });
  return overlay;
}
