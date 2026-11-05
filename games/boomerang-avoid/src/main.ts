import "./style.css";
import {
  ARENAS,
  CHARACTERS,
  UPGRADES,
  createMatch,
  step,
  getBotInputs,
  restartMatch,
  stateHash,
  type CharacterId,
  type Difficulty,
  type Input,
  type MatchConfig,
  type MatchState,
  type Mode,
  type Seat,
} from "@avoid/boomerangavoid-sim";
import {
  Inputs,
  loadPreferences,
  savePreferences,
  DEFAULT_BINDINGS,
  keyLabel,
  type Action,
  type Control,
} from "./input";
import { GardenRenderer } from "./render";
import { GardenAudio } from "./audio";
import { createOnlineAdapter } from "./net";
const root = document.querySelector<HTMLDivElement>("#app")!;
const prefs = loadPreferences(),
  input = new Inputs(prefs),
  audio = new GardenAudio(prefs),
  net = createOnlineAdapter();
const palette = [0x9bc97d, 0xe5a17c, 0xf1d17d, 0x80c7bc, 0xb0b5cb, 0xc8a1df];
const esc = (value: unknown) =>
  String(value).replace(
    /[&<>"']/g,
    (c) =>
      ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[
        c
      ]!,
  );
const color = (n: number) => `#${n.toString(16).padStart(6, "0")}`;
const arc =
  '<svg viewBox="0 0 32 32" fill="none" aria-hidden="true"><path d="m5 21 11-4 5-12 6 5-8 13-12 4Z" fill="currentColor"/><circle cx="16" cy="18" r="2" fill="#193c38"/></svg>';
const ownsSeat = (id: string) =>
  net.info.ownedSeatIds.includes(id) ||
  id === net.info.clientId ||
  id.startsWith(net.info.clientId + ":");
const chevron = '<span aria-hidden="true">↗</span>';
type Screen =
  | "menu"
  | "setup"
  | "online"
  | "onlineLobby"
  | "settings"
  | "guide"
  | "playing"
  | "paused";
interface LocalSeat extends Seat {
  control: Control;
  ready: boolean;
}
let screen: Screen = "menu",
  backScreen: Screen = "menu",
  playing = false,
  online = false,
  practice = false,
  tutorialStep = 0,
  tutorialFlags = new Set<string>(),
  tutorialOrigin: { x: number; y: number } | null = null;
let notice = "",
  lastHud = "",
  lastHudAt = 0,
  seed = 17492,
  gameTime = 0,
  paused = false;
let recentEvents: MatchState["events"] = [];
let latestDeath: { event: MatchState["events"][number]; round: number } | null =
  null;
let config: MatchConfig = {
  mode: "ffa",
  wins: 3,
  mapId: ARENAS[0].id,
  seed,
  friendlyFire: false,
  upgrades: true,
};
const makeSeat = (i: number, control: Control): LocalSeat => ({
  id: `local-${i + 1}`,
  name:
    i === 0 ? "You" : control === "bot" ? `Bot ${i + 1}` : `Player ${i + 1}`,
  character: CHARACTERS[i % 6].id,
  color: palette[i % 6],
  team: i % 2,
  bot: control === "bot" ? "normal" : null,
  control,
  ready: control === "bot" || i === 0,
});
let seats: LocalSeat[] = [
  makeSeat(0, "keyboard1"),
  makeSeat(1, "bot"),
  makeSeat(2, "bot"),
  makeSeat(3, "bot"),
];
const onlineControlChoices: Control[] = [
  "keyboard1",
  "keyboard2",
  "pad0",
  "pad1",
  "pad2",
  "pad3",
  "pad4",
  "pad5",
];
function loadOnlineParty(): LocalSeat[] {
  try {
    const saved: unknown = JSON.parse(
      sessionStorage.getItem("bav-local-party") || "null",
    );
    if (
      Array.isArray(saved) &&
      saved.length >= 1 &&
      saved.length <= 6 &&
      saved.every(
        (s) =>
          s &&
          typeof s === "object" &&
          onlineControlChoices.includes(s.control) &&
          CHARACTERS.some((c) => c.id === s.character) &&
          typeof s.name === "string",
      )
    ) {
      return saved.map((s, i) => ({
        ...makeSeat(i, s.control),
        name: s.name.trim().slice(0, 18) || `Player ${i + 1}`,
        character: s.character,
        bot: null,
        ready: false,
      }));
    }
  } catch {
    /* Preferences are optional for this tab. */
  }
  return [
    { ...makeSeat(0, "keyboard1"), name: "Gardener", bot: null, ready: false },
  ];
}
let onlineParty = loadOnlineParty();
let onlineControls: Control[] = onlineParty.map((s) => s.control);
let onlineRoomCode = new URL(location.href).searchParams.get("room") || "";
let onlineConnecting = false;
function saveOnlineParty() {
  onlineControls = onlineParty.map((s) => s.control);
  try {
    sessionStorage.setItem(
      "bav-local-party",
      JSON.stringify(
        onlineParty.map(({ name, character, control }) => ({
          name,
          character,
          control,
        })),
      ),
    );
  } catch {
    /* Input choices still apply for this session. */
  }
}
function onlineSeatIds() {
  return net.info.ownedSeatIds.length
    ? net.info.ownedSeatIds
    : net.info.seats.filter((s) => ownsSeat(s.id)).map((s) => s.id);
}
function onlineGroupReady() {
  const ids = onlineSeatIds();
  return ids.length > 0 && ids.every((id) => net.info.readyIds.includes(id));
}
function controlLabel(control: Control) {
  return control === "keyboard1"
    ? "Keyboard 1 / Touch"
    : control === "keyboard2"
      ? "Keyboard 2"
      : `Gamepad ${Number(control.slice(3)) + 1}`;
}
function validateOnlineParty() {
  if (onlineParty.length < 1 || onlineParty.length > 6) {
    notice = "Choose one to six players on this screen.";
    return false;
  }
  if (new Set(onlineControls).size !== onlineControls.length) {
    notice = "Each local player needs a different keyboard or gamepad input.";
    return false;
  }
  const missing = onlineControls.find(
    (control) =>
      control.startsWith("pad") &&
      !navigator.getGamepads?.()[Number(control.slice(3))],
  );
  if (missing) {
    notice = `Connect ${controlLabel(missing)} and press a button, or choose another input.`;
    return false;
  }
  return true;
}
let state = createMatch(
  { ...config, wins: 99 },
  Array.from({ length: 6 }, (_, i) => ({
    ...makeSeat(i, "bot"),
    bot: "normal" as Difficulty,
  })),
);
let renderer: GardenRenderer;
try {
  renderer = new GardenRenderer(
    document.querySelector<HTMLCanvasElement>("#garden")!,
    prefs,
  );
} catch (error) {
  root.innerHTML = `<main class="fatal"><h1>The garden needs WebGL</h1><p>Your browser could not start the 3D renderer. Enable hardware acceleration or try a current browser.</p><p>${esc(error instanceof Error ? error.message : error)}</p><a href="/games/boomerangavoid/">Back to aVOID</a></main>`;
  throw error;
}
input.onActivity = () => audio.unlock();
input.onPause = () => {
  if (onlineConnecting) return;
  if (screen === "playing") pause();
  else if (screen === "paused") resume();
  else if (screen !== "menu") {
    screen = screen === "settings" || screen === "guide" ? backScreen : "menu";
    render();
  }
};
document.addEventListener("visibilitychange", () => {
  if (document.hidden && playing && !online && screen === "playing") pause();
});
document.addEventListener("keydown", (event) => {
  if (event.key !== "Tab") return;
  const modal = root.querySelector<HTMLElement>(".modal-backdrop");
  if (!modal) return;
  const buttons = Array.from(
    modal.querySelectorAll<HTMLElement>("button,a,input,select"),
  );
  const first = buttons[0],
    last = buttons[buttons.length - 1];
  if (event.shiftKey && document.activeElement === first) {
    event.preventDefault();
    last?.focus();
  } else if (!event.shiftKey && document.activeElement === last) {
    event.preventDefault();
    first?.focus();
  }
});
const option = (value: string, label: string, selected: string) =>
  `<option value="${esc(value)}" ${value === selected ? "selected" : ""}>${esc(label)}</option>`;
const button = (
  label: string,
  action: string,
  style = "secondary",
  extra = "",
) =>
  `<button class="${style}" data-action="${action}" ${extra}>${label}</button>`;
const emblem = (id: CharacterId, n: number) =>
  `<span class="creature-icon ${id}" style="--seat:${color(n)}" aria-hidden="true"><i></i><b>••</b></span>`;
function shell(content: string, className = "") {
  return `<div class="shell ${className}"><header class="brand"><a href="/games/boomerangavoid/" aria-label="Back to BoomerangaVOID on aVOID">a<span>VOID</span><small>ORIGINAL</small></a><span class="edition">COSMIC GARDEN CLUB</span></header>${content}<footer class="footer"><span>Made for one more round.</span><span>1–6 players <i>✦</i> No account needed locally</span></footer></div>`;
}
function menu() {
  return shell(
    `<main class="menu-panel"><p class="eyebrow"><span class="live-dot"></span> THE GARDEN IS OPEN</p><h1 class="game-logo">Boomerang<span>aVOID${arc}</span></h1><p class="tagline">Small creatures.<br/>Dangerous comebacks.</p><nav class="play-choices" aria-label="Play modes"><button class="play-choice" data-action="practice"><span class="choice-icon">✦</span><span><strong>Practice</strong><small>Learn the arc. Find your rhythm.</small></span>${chevron}</button><button class="play-choice" data-action="party"><span class="choice-icon">❖</span><span><strong>Couch Party</strong><small>2–6 friends, bots & happy accidents.</small></span>${chevron}</button><button class="play-choice" data-action="online"><span class="choice-icon">◎</span><span><strong>Online Party</strong><small>Private rooms. Same little universe.</small></span>${chevron}</button></nav><div class="menu-tools">${button("How to play", "guide", "text-button")}${button("Settings", "settings", "text-button")}<span class="sound-note">♫ Audio starts when you play</span></div></main><aside class="garden-caption"><span class="caption-line"></span><p>YOUR NEXT COMEBACK<br/><strong>is already on its way.</strong></p><span class="orbit-mark">${arc}</span></aside>`,
    "home",
  );
}
function setup() {
  const arena = ARENAS.find((a) => a.id === config.mapId)!;
  return shell(
    `<main class="panel setup-panel"><div class="panel-heading"><div><p class="eyebrow">GATHER YOUR GARDEN</p><h1>Couch Party</h1></div>${button("← Back", "home", "text-button")}</div><div class="setup-columns"><section><h2>The little crew <span>${seats.length}/6</span></h2><div class="seat-list">${seats.map((seat, i) => `<article class="seat-row" style="--seat:${color(seat.color)}">${emblem(seat.character, seat.color)}<div class="seat-config"><label class="sr-only" for="name-${i}">Player ${i + 1} name</label><input id="name-${i}" data-seat="${i}" data-field="name" maxlength="18" value="${esc(seat.name)}" aria-label="Player ${i + 1} name"/><div class="seat-selects"><label><span class="sr-only">Player ${i + 1} character</span><select data-seat="${i}" data-field="character">${CHARACTERS.map((c) => option(c.id, c.name, seat.character)).join("")}</select></label><label><span class="sr-only">Player ${i + 1} input</span><select data-seat="${i}" data-field="control">${option("bot", "Bot", seat.control)}${option("keyboard1", "Keyboard 1 / Touch", seat.control)}${option("keyboard2", "Keyboard 2", seat.control)}${[0, 1, 2, 3, 4, 5].map((n) => option(`pad${n}`, `Gamepad ${n + 1}${input.controllers().some((p) => p.index === n) ? " · connected" : ""}`, seat.control)).join("")}</select></label></div></div>${config.mode !== "ffa" ? `<label class="team-select"><span>Team</span><select data-seat="${i}" data-field="team">${option("0", "Sun", String(seat.team))}${option("1", "Moon", String(seat.team))}</select></label>` : ""}${seat.bot ? `<label class="bot-select"><span class="sr-only">Bot ${i + 1} difficulty</span><select data-seat="${i}" data-field="bot">${["easy", "normal", "hard"].map((v) => option(v, v, seat.bot!)).join("")}</select></label>` : button(seat.ready ? "✓ Ready" : "Ready?", `ready-${i}`, `ready-button ${seat.ready ? "is-ready" : ""}`)}${seats.length > 2 ? button("×", `remove-${i}`, "remove-seat", `aria-label="Remove player ${i + 1}"`) : ""}</article>`).join("")}</div>${seats.length < 6 ? button("+ Add creature", "add-seat", "add-seat") : ""}<p class="field-help">Keyboard 1: WASD + Space / J / K. Keyboard 2: arrows + Enter / Num 1 / Num 2. Shared keyboards can miss simultaneous keys.</p></section><section class="match-options"><h2>Make it your party</h2><label>Game mode<select data-config="mode">${option("ffa", "Free for all", config.mode)}${option("teams", "Sun vs Moon", config.mode)}${option("relay", "Starlight relay", config.mode)}</select></label><p class="field-help">${config.mode === "relay" ? "Carry the star seed to the glowing circle. Hold for half a second, then visit the other side. Enemies can contest the circle." : config.mode === "teams" ? "Protect your garden. The last team standing takes the round." : "One boomerang. Every creature for themselves."}</p><label>Arena<select data-config="mapId">${ARENAS.map((a) => option(a.id, a.name, config.mapId)).join("")}</select></label><div class="map-preview" style="--map:${color(arena.color)}"><span>✦</span><strong>${esc(arena.name)}</strong><small>${esc(arena.subtitle)}</small></div><div class="inline-fields"><label>First to<select data-config="wins">${[3, 5, 7].map((v) => option(String(v), `${v} wins`, String(config.wins))).join("")}</select></label><label>Garden upgrades<select data-config="upgrades">${option("true", "On", String(config.upgrades))}${option("false", "Off", String(config.upgrades))}</select></label></div>${config.mode !== "ffa" ? `<label class="check-row"><input type="checkbox" data-config="friendlyFire" ${config.friendlyFire ? "checked" : ""}/> Friendly fire</label>` : ""}<div class="match-start">${button(`Let's play ${arc}`, "start", "primary")}<p class="field-help">Everyone on the crew must be ready.</p></div></section></div><p class="notice" role="status">${esc(notice)}</p></main>`,
    "setup",
  );
}
function onlineScreen() {
  const disabled = onlineConnecting ? "disabled" : "";
  return shell(
    `<main class="panel online-party-panel"><div class="panel-heading"><div><p class="eyebrow">A LITTLE CLOSER, FROM AFAR</p><h1>Online Party</h1></div>${button("Back", "home", "text-button", disabled)}</div><div class="connection-state"><span class="live-dot ${net.info.status === "error" ? "offline" : ""}"></span>${esc(net.info.region)}${net.info.ping !== null ? ` / ${net.info.ping} ms` : ""}</div><div class="online-party-columns"><section><h2>Players on this screen <span>${onlineParty.length}/6</span></h2><div class="seat-list">${onlineParty.map((seat, i) => `<article class="seat-row online-seat-row" style="--seat:${color(seat.color)}">${emblem(seat.character, seat.color)}<div class="seat-config"><label class="sr-only" for="${i === 0 ? "online-name" : `online-name-${i}`}">Local player ${i + 1} name</label><input id="${i === 0 ? "online-name" : `online-name-${i}`}" data-online-seat="${i}" data-online-field="name" maxlength="18" value="${esc(seat.name)}" autocomplete="nickname" ${disabled}/><div class="seat-selects"><label><span class="sr-only">Local player ${i + 1} character</span><select data-online-seat="${i}" data-online-field="character" ${disabled}>${CHARACTERS.map((c) => option(c.id, c.name, seat.character)).join("")}</select></label><label><span class="sr-only">Local player ${i + 1} input</span><select data-online-seat="${i}" data-online-field="control" ${disabled}>${onlineControlChoices.map((control) => option(control, controlLabel(control) + (control.startsWith("pad") && input.controllers().some((p) => p.index === Number(control.slice(3))) ? " / connected" : ""), seat.control)).join("")}</select></label></div></div>${onlineParty.length > 1 ? button("&times;", `online-remove-${i}`, "remove-seat", `aria-label="Remove local player ${i + 1}" ${disabled}`) : ""}</article>`).join("")}</div>${onlineParty.length < 6 ? button("+ Add local player", "online-add", "add-seat", disabled) : ""}<p class="field-help">Two keyboard layouts can share this screen. Additional players need connected gamepads. Shared keyboards can miss simultaneous keys.</p><p class="field-help">Input choices are remembered in this tab.</p></section><section class="online-connect"><h2>Meet in the garden</h2><p class="intro">Create a private room for your crew, find a public party, or follow a friend's invitation.</p><div class="online-actions">${button(`Create a room ${chevron}`, "create-room", "primary", disabled)}${button("Find a public party", "quick-join", "secondary", disabled)}</div><div class="or"><span>or follow a friend</span></div><label>Room code<input id="room-code" placeholder="Paste room code" value="${esc(onlineRoomCode)}" maxlength="100" autocomplete="off" autocapitalize="none" ${disabled}/></label>${button("Join room", "join-room", "secondary full", disabled)}<p class="field-help">Your whole local crew joins together. The room must have space for everyone.</p></section></div><p class="notice" role="status">${esc(notice || net.info.message)}</p></main>`,
    "subpage",
  );
}
function onlineLobby() {
  const roomConfig = net.info.config || config;
  const isHost = net.info.hostId === net.info.clientId;
  const owned = onlineSeatIds();
  const humans = net.info.seats.filter((s) => !s.bot).length;
  const bots = net.info.seats.filter((s) => !!s.bot).length;
  const arena = ARENAS.find((a) => a.id === roomConfig.mapId);
  return shell(
    `<main class="panel online-lobby-panel"><div class="panel-heading"><div><p class="eyebrow">${net.info.public ? "YOUR PUBLIC GARDEN" : "YOUR PRIVATE GARDEN"}</p><h1>Room ${esc(net.info.roomId)}</h1></div>${button("Leave", "leave-online", "text-button")}</div><div class="connection-state"><span class="live-dot"></span>${esc(net.info.region)}${net.info.ping !== null ? ` / ${net.info.ping} ms` : ""}<span class="privacy-label">${net.info.public ? "Public / discoverable" : "Private / invite only"}</span></div><div class="online-lobby-columns"><section><h2>The whole crew <span>${net.info.seats.length}/6</span></h2>${button("Copy invite", "copy-invite", "secondary full")}<div class="lobby-seats">${net.info.seats
      .map((s) => {
        const index = owned.indexOf(s.id);
        return `<div class="lobby-seat ${index >= 0 ? "owned-seat" : ""}">${emblem(s.character, s.color)}<div class="lobby-person"><strong>${esc(s.name)}</strong><small>${index >= 0 ? `This screen / ${esc(controlLabel(onlineControls[index] || "keyboard1"))}` : s.bot ? `${esc(s.bot)} bot` : "Remote player"}</small></div><span>${net.info.readyIds.includes(s.id) ? "Ready" : "Getting ready"}</span></div>`;
      })
      .join(
        "",
      )}</div><p class="field-help">${owned.length} ${owned.length === 1 ? "player" : "players"} on this screen. Ready applies to your entire local crew.</p>${button(onlineGroupReady() ? "Ready / unready local crew" : `Ready ${owned.length === 1 ? "up" : `all ${owned.length} local players`}`, "online-ready", "primary full")}${isHost ? button("Start party", "online-start", "secondary full") : '<p class="field-help">The host starts when everyone is ready.</p>'}</section><section class="online-host-options"><h2>Party settings</h2>${isHost ? `<label class="check-row"><input type="checkbox" data-lobby="public" ${net.info.public ? "checked" : ""}/> Let public parties find this room</label><label>Garden bots<select data-lobby="bots">${Array.from({ length: Math.max(0, 6 - humans) + 1 }, (_, i) => option(String(i), i === 0 ? "No bots" : `${i} ${i === 1 ? "bot" : "bots"}`, String(bots))).join("")}</select></label><label>Game mode<select data-lobby="mode">${option("ffa", "Free for all", roomConfig.mode)}${option("teams", "Sun vs Moon", roomConfig.mode)}${option("relay", "Starlight relay", roomConfig.mode)}</select></label><label>Arena<select data-lobby="mapId">${ARENAS.map((a) => option(a.id, a.name, roomConfig.mapId)).join("")}</select></label><div class="inline-fields"><label>First to<select data-lobby="wins">${[3, 5, 7].map((n) => option(String(n), `${n} wins`, String(roomConfig.wins))).join("")}</select></label><label>Upgrades<select data-lobby="upgrades">${option("true", "On", String(roomConfig.upgrades))}${option("false", "Off", String(roomConfig.upgrades))}</select></label></div>${roomConfig.mode !== "ffa" ? `<label class="check-row"><input type="checkbox" data-lobby="friendlyFire" ${roomConfig.friendlyFire ? "checked" : ""}/> Friendly fire</label>` : ""}<p class="field-help">Changing the party settings asks everyone to ready up again.</p>` : `<dl class="room-summary"><div><dt>Mode</dt><dd>${roomConfig.mode === "ffa" ? "Free for all" : roomConfig.mode === "teams" ? "Sun vs Moon" : "Starlight relay"}</dd></div><div><dt>Arena</dt><dd>${esc(arena?.name || roomConfig.mapId)}</dd></div><div><dt>Match</dt><dd>First to ${roomConfig.wins}</dd></div><div><dt>Bots</dt><dd>${bots}</dd></div><div><dt>Upgrades</dt><dd>${roomConfig.upgrades ? "On" : "Off"}</dd></div></dl><p class="field-help">The host chooses the party settings. Changes ask everyone to ready up again.</p>`}</section></div><p class="notice" role="status">${esc(notice || net.info.message)}</p></main>`,
    "subpage",
  );
}

function settings() {
  return shell(
    `<main class="panel settings-panel"><div class="panel-heading"><div><p class="eyebrow">FEEL AT HOME</p><h1>Settings</h1></div>${button("← Back", "back", "text-button")}</div><div class="settings-columns"><section><h2>Sound & comfort</h2><label class="range-label">Music <output id="music-value">${Math.round(prefs.music * 100)}%</output><input type="range" min="0" max="100" value="${prefs.music * 100}" data-pref="music"/></label><label class="range-label">Sound effects <output id="sfx-value">${Math.round(prefs.sfx * 100)}%</output><input type="range" min="0" max="100" value="${prefs.sfx * 100}" data-pref="sfx"/></label><label class="check-row"><input type="checkbox" data-pref="reducedMotion" ${prefs.reducedMotion ? "checked" : ""}/> Reduce decorative motion</label><label class="check-row"><input type="checkbox" data-pref="touch" ${prefs.touch ? "checked" : ""}/> Show touch controls</label><label>Graphics<select data-pref="quality">${option("auto", "Balanced", prefs.quality)}${option("high", "Crisp", prefs.quality)}${option("low", "Lightweight", prefs.quality)}</select></label><p class="field-help">Reduced motion keeps combat cues, while softening bobbing, orbiting and particles.</p><h2 class="section-gap">Gamepad</h2><p class="field-help">${
      input.controllers().length
        ? input
            .controllers()
            .map((p) => `Pad ${p.index + 1}: ${esc(p.name)}`)
            .join("<br/>")
        : "Connect a controller and press a button. Standard browser gamepads use the left stick to move and right stick to aim."
    }</p>${(["dash", "slash", "throw"] as const).map((a) => `<label>${a === "throw" ? "Throw / recall" : a[0].toUpperCase() + a.slice(1)} button<select data-pad="${a}">${Array.from({ length: 16 }, (_, i) => option(String(i), `Button ${i}${i === 0 ? " · South" : i === 1 ? " · East" : i === 2 ? " · West" : ""}`, String(prefs.gamepadButtons[a]))).join("")}</select></label>`).join("")}</section><section><h2>Make room for your hands</h2><p class="field-help">Select a binding, then press a key. Escape cancels. Your choices save on this device.</p><div class="binding-head"><span>Action</span><span>Keyboard 1</span><span>Keyboard 2</span></div>${(["up", "down", "left", "right", "dash", "slash", "throw"] as Action[]).map((action) => `<div class="binding-row"><span>${action === "throw" ? "Throw / recall" : action[0].toUpperCase() + action.slice(1)}</span>${[0, 1].map((i) => button(esc(keyLabel(prefs.bindings[i][action])), `bind-${i}-${action}`, "key-binding", `aria-label="Remap keyboard ${i + 1} ${action}"`)).join("")}</div>`).join("")}${button("Reset key bindings", "reset-bindings", "text-button")}<p class="notice" id="remap-status" role="status">${esc(notice)}</p></section></div></main>`,
    "subpage",
  );
}
function guide() {
  return shell(
    `<main class="panel guide-panel"><div class="panel-heading"><div><p class="eyebrow">WELCOME TO THE GARDEN</p><h1>It always comes back.</h1></div>${button("← Back", "back", "text-button")}</div><div class="lesson-grid">${[
      [
        "01",
        "Move & aim",
        "WASD / arrows / left stick",
        "Face a creature, find a gap. Your last movement sets your throw direction. The right stick can aim separately.",
      ],
      [
        "02",
        "Dash",
        "Space / Enter / South",
        "A quick burst to get out of trouble. It is movement, so watch for blades along the way.",
      ],
      [
        "03",
        "Slash & deflect",
        "J / Num 1 / West",
        "Strike nearby opponents or bat an incoming boomerang back. The bright arc shows your reach.",
      ],
      [
        "04",
        "Throw, curve, recall",
        "K / Num 2 / East",
        "Tap to throw. Move sideways just after release to bend the arc. Tap again to recall. Catch, then tap for a new throw.",
      ],
    ]
      .map(
        ([n, title, keys, text]) =>
          `<article><span class="lesson-number">${n}</span><h2>${title}</h2><kbd>${keys}</kbd><p>${text}</p></article>`,
      )
      .join(
        "",
      )}</div><div class="guide-bottom"><div><h2>A whole garden of surprises</h2><p class="field-help">${UPGRADES.map((u) => `<strong>${esc(u.name)}</strong>: ${esc(u.description)}`).join(" · ")}</p></div>${button("Try it in Practice", "practice", "primary")}</div></main>`,
    "subpage",
  );
}
function game() {
  return `<div class="game-shell"><header class="game-top"><div class="game-brand">${arc}<span>Boomerang<b>aVOID</b></span></div><div class="round-info"><strong id="round-label"></strong><span id="arena-label"></span></div>${button('Ⅱ <span class="pause-word">Menu</span>', "pause", "pause-button", 'aria-label="Pause and open menu"')}</header><div id="scores" class="scores" aria-label="Match scores"></div><div id="phase-overlay" class="phase-overlay" aria-live="polite"></div>${practice ? '<aside id="tutorial" class="tutorial" aria-live="polite"></aside>' : ""}<div id="game-message" class="game-message" role="status"></div><div class="bottom-hints"><span><kbd>${esc(keyLabel(prefs.bindings[0].up))}${esc(keyLabel(prefs.bindings[0].left))}${esc(keyLabel(prefs.bindings[0].down))}${esc(keyLabel(prefs.bindings[0].right))}</kbd> move</span><span><kbd>${esc(keyLabel(prefs.bindings[0].dash))}</kbd> dash</span><span><kbd>${esc(keyLabel(prefs.bindings[0].slash))}</kbd> slash</span><span><kbd>${esc(keyLabel(prefs.bindings[0].throw))}</kbd> throw / recall</span></div><div class="touch-controls ${prefs.touch && (!online || onlineControls.includes("keyboard1")) ? "visible" : ""}" aria-label="Touch game controls"><div id="touch-stick" role="application" aria-label="Move joystick"><span id="stick-thumb"></span></div><div class="touch-actions"><button class="touch-action dash-action" data-touch="dash" aria-label="Dash"><b>↗</b><span>Dash</span></button><button class="touch-action slash-action" data-touch="slash" aria-label="Slash or deflect"><b>✧</b><span>Slash</span></button><button class="touch-action throw-action" data-touch="throw" aria-label="Throw or recall boomerang">${arc}<span>Throw</span></button></div></div></div>`;
}
function pausePanel() {
  return (
    game() +
    `<div class="modal-backdrop"><section class="panel pause-panel" role="dialog" aria-modal="true" aria-labelledby="pause-title"><p class="eyebrow">TAKE A BREATHER</p><h1 id="pause-title">${online ? "Menu" : "Garden paused"}</h1>${online ? '<p class="field-help">The online party keeps playing while this menu is open.</p>' : ""}${button("Back to the garden", "resume", "primary full")}${button("Settings", "settings", "secondary full")}${button("How to play", "guide", "secondary full")}${button("Leave match", "exit-match", "text-button full")}</section></div>`
  );
}
function render() {
  input.clear();
  input.active = screen === "playing";
  renderer.setMenu(!playing);
  root.innerHTML =
    screen === "menu"
      ? menu()
      : screen === "setup"
        ? setup()
        : screen === "online"
          ? onlineScreen()
          : screen === "onlineLobby"
            ? onlineLobby()
            : screen === "settings"
              ? settings()
              : screen === "guide"
                ? guide()
                : screen === "paused"
                  ? pausePanel()
                  : game();
  document.body.classList.toggle("is-playing", playing);
  document.body.classList.toggle("reduced-motion", prefs.reducedMotion);
  lastHud = "";
  if (screen === "playing" || screen === "paused") {
    input.bindTouch(root);
    hud(true);
  }
  bind();
  const focus = root.querySelector<HTMLElement>(
    screen === "paused"
      ? ".pause-panel button"
      : screen === "playing"
        ? ".pause-button"
        : "main button, main input",
  );
  if (focus && screen !== "playing") focus.focus({ preventScroll: true });
}
function bind() {
  root
    .querySelectorAll<
      HTMLInputElement | HTMLSelectElement
    >("[data-online-seat]")
    .forEach((el) => {
      const update = () => {
        const index = Number(el.dataset.onlineSeat),
          seat = onlineParty[index],
          field = el.dataset.onlineField;
        if (field === "name") seat.name = el.value.slice(0, 18);
        else if (field === "character")
          seat.character = el.value as CharacterId;
        else if (field === "control") seat.control = el.value as Control;
        saveOnlineParty();
        notice = "";
        if (field !== "name") {
          render();
          root
            .querySelector<HTMLElement>(
              `[data-online-seat="${index}"][data-online-field="${field}"]`,
            )
            ?.focus({ preventScroll: true });
        }
      };
      el.addEventListener(
        el instanceof HTMLInputElement ? "input" : "change",
        update,
      );
    });
  root
    .querySelector<HTMLInputElement>("#room-code")
    ?.addEventListener("input", (event) => {
      onlineRoomCode = (event.currentTarget as HTMLInputElement).value;
    });
  root
    .querySelectorAll<HTMLInputElement | HTMLSelectElement>("[data-lobby]")
    .forEach((el) =>
      el.addEventListener("change", () => {
        notice = "";
        const field = el.dataset.lobby!;
        if (field === "public")
          net.configure({ public: (el as HTMLInputElement).checked });
        else if (field === "bots") net.configure({ bots: Number(el.value) });
        else {
          const next = { ...(net.info.config || config) };
          if (field === "mode") next.mode = el.value as Mode;
          else if (field === "mapId") next.mapId = el.value;
          else if (field === "wins") next.wins = Number(el.value);
          else if (field === "upgrades") next.upgrades = el.value === "true";
          else if (field === "friendlyFire")
            next.friendlyFire = (el as HTMLInputElement).checked;
          net.configure({ config: next });
        }
      }),
    );
  root.querySelectorAll<HTMLElement>("[data-action]").forEach((el) =>
    el.addEventListener("click", () => {
      audio.unlock();
      void action(el.dataset.action!);
    }),
  );
  root
    .querySelectorAll<HTMLInputElement | HTMLSelectElement>("[data-seat]")
    .forEach((el) =>
      el.addEventListener("change", () => {
        const seat = seats[Number(el.dataset.seat)],
          field = el.dataset.field!;
        if (field === "name") seat.name = el.value.trim() || "Gardener";
        else if (field === "character") {
          seat.character = el.value as CharacterId;
          seat.color = CHARACTERS.find((c) => c.id === seat.character)!.color;
        } else if (field === "control") {
          seat.control = el.value as Control;
          seat.bot = seat.control === "bot" ? "normal" : null;
          seat.ready = seat.control === "bot";
        } else if (field === "bot") seat.bot = el.value as Difficulty;
        else if (field === "team") seat.team = Number(el.value);
        notice = "";
        render();
      }),
    );
  root
    .querySelectorAll<HTMLInputElement | HTMLSelectElement>("[data-config]")
    .forEach((el) =>
      el.addEventListener("change", () => {
        const field = el.dataset.config!;
        if (field === "wins") config.wins = Number(el.value);
        else if (field === "upgrades") config.upgrades = el.value === "true";
        else if (field === "friendlyFire")
          config.friendlyFire = (el as HTMLInputElement).checked;
        else if (field === "mode") config.mode = el.value as Mode;
        else config.mapId = el.value;
        notice = "";
        render();
      }),
    );
  root
    .querySelectorAll<HTMLInputElement | HTMLSelectElement>("[data-pref]")
    .forEach((el) =>
      el.addEventListener("input", () => {
        const field = el.dataset.pref as keyof typeof prefs;
        if (field === "music" || field === "sfx") {
          prefs[field] = Number(el.value) / 100;
          document.querySelector(`#${field}-value`)!.textContent =
            `${el.value}%`;
          audio.unlock();
          audio.update();
        } else if (field === "reducedMotion" || field === "touch")
          prefs[field] = (el as HTMLInputElement).checked;
        else if (field === "quality")
          prefs.quality = el.value as typeof prefs.quality;
        savePreferences(prefs);
        renderer.resize();
        document.body.classList.toggle("reduced-motion", prefs.reducedMotion);
      }),
    );
  root.querySelectorAll<HTMLSelectElement>("[data-pad]").forEach((el) =>
    el.addEventListener("change", () => {
      prefs.gamepadButtons[el.dataset.pad as "dash" | "slash" | "throw"] =
        Number(el.value);
      savePreferences(prefs);
    }),
  );
}
async function action(name: string) {
  notice = "";
  if (name === "home") {
    if (online) net.leave();
    playing = false;
    online = false;
    paused = false;
    practice = false;
    screen = "menu";
    preview();
  } else if (name === "party") {
    screen = "setup";
    playing = false;
  } else if (name === "practice") {
    startPractice();
    return;
  } else if (name === "online") {
    screen = "online";
  } else if (name === "online-add") {
    if (onlineParty.length < 6) {
      const control =
        onlineControlChoices.find(
          (control) => !onlineControls.includes(control),
        ) || "pad5";
      onlineParty.push({
        ...makeSeat(onlineParty.length, control),
        bot: null,
        ready: false,
      });
      saveOnlineParty();
    }
  } else if (name.startsWith("online-remove-")) {
    if (onlineParty.length > 1) {
      onlineParty.splice(Number(name.slice("online-remove-".length)), 1);
      saveOnlineParty();
    }
  } else if (name === "settings" || name === "guide") {
    backScreen = screen;
    screen = name;
  } else if (name === "back") {
    input.remap = null;
    screen = backScreen;
  } else if (name === "add-seat") {
    seats.push(makeSeat(seats.length, "bot"));
  } else if (name.startsWith("remove-")) {
    seats.splice(Number(name.slice(7)), 1);
  } else if (name.startsWith("ready-")) {
    const s = seats[Number(name.slice(6))];
    s.ready = !s.ready;
  } else if (name === "start") {
    if (!validateParty()) {
      render();
      return;
    }
    startLocal(false);
    return;
  } else if (name === "pause") {
    pause();
    return;
  } else if (name === "resume") {
    resume();
    return;
  } else if (name === "exit-match") {
    if (online) net.leave();
    playing = false;
    paused = false;
    online = false;
    practice = false;
    screen = "menu";
    preview();
  } else if (name === "rematch") {
    if (online) net.rematch();
    else {
      state = restartMatch(state);
      latestDeath = null;
      recentEvents = [];
      tutorialOrigin = null;
    }
    screen = "playing";
    paused = false;
    render();
    return;
  } else if (name === "skip-tutorial") {
    tutorialStep = 7;
    render();
    return;
  } else if (name === "reset-bindings") {
    prefs.bindings = DEFAULT_BINDINGS.map((b) => ({ ...b }));
    savePreferences(prefs);
  } else if (name.startsWith("bind-")) {
    const [, index, field] = name.split("-");
    const el = root.querySelector(`[data-action="${name}"]`)!;
    el.textContent = "Press a key…";
    input.remap = (code) => {
      if (code === "Escape") {
        render();
        return;
      }
      const action = field as Action;
      const old = prefs.bindings[Number(index)][action];
      for (const b of prefs.bindings) {
        for (const [key, value] of Object.entries(b))
          if (
            value === code &&
            !(b === prefs.bindings[Number(index)] && key === action)
          )
            b[key as Action] = old;
      }
      prefs.bindings[Number(index)][action] = code;
      savePreferences(prefs);
      notice = `${action} is now ${keyLabel(code)}.`;
      render();
    };
    root.querySelector("#remap-status")!.textContent =
      "Listening for a key. Escape cancels.";
    return;
  } else if (["create-room", "quick-join", "join-room"].includes(name)) {
    if (onlineConnecting) return;
    saveOnlineParty();
    if (!validateOnlineParty()) {
      render();
      return;
    }
    const room =
      root.querySelector<HTMLInputElement>("#room-code")?.value.trim() ||
      onlineRoomCode.trim();
    if (name === "join-room" && !room) {
      notice = "Enter a room code from your friend.";
      render();
      return;
    }
    onlineRoomCode = room;
    const party: Seat[] = onlineParty.map(
      ({ control: _control, ready: _ready, ...seat }, i) => ({
        ...seat,
        id: `local-${i + 1}`,
        name: seat.name.trim() || `Player ${i + 1}`,
        bot: null,
      }),
    );
    const seat = party[0];
    onlineConnecting = true;
    notice = "Connecting to the garden...";
    render();
    try {
      if (name === "create-room") await net.create(config, seat, party);
      else if (name === "quick-join") await net.quickJoin(seat, party);
      else await net.join(room, seat, party);
      screen = "onlineLobby";
      online = true;
      notice = "";
    } catch (error) {
      notice =
        error instanceof Error
          ? error.message
          : "Could not connect to the room server.";
    } finally {
      onlineConnecting = false;
    }
  } else if (name === "leave-online") {
    net.leave();
    screen = "online";
    online = false;
  } else if (name === "online-ready") {
    if (!onlineGroupReady() && !validateOnlineParty()) {
      render();
      return;
    }
    net.ready(!onlineGroupReady());
  } else if (name === "online-start") {
    net.start();
  } else if (name === "copy-invite") {
    const url = new URL(location.href);
    url.searchParams.set("room", net.info.roomId);
    try {
      await navigator.clipboard.writeText(url.href);
      notice = "Invite copied. Send it to your crew.";
    } catch {
      notice = `Room code: ${net.info.roomId}`;
    }
  }
  render();
}
function validateParty() {
  if (!seats.some((s) => !s.bot)) {
    notice = "Add a human to the garden: choose a keyboard or gamepad.";
    return false;
  }
  const controls = seats.filter((s) => !s.bot).map((s) => s.control);
  if (new Set(controls).size !== controls.length) {
    notice =
      "Each player needs their own input. Choose a different keyboard or gamepad.";
    return false;
  }
  if (seats.some((s) => !s.ready)) {
    notice =
      "A creature is still getting ready. Click Ready? beside each human player.";
    return false;
  }
  const disconnected = seats.find(
    (s) =>
      s.control.startsWith("pad") &&
      !navigator.getGamepads?.()[Number(s.control.slice(3))],
  );
  if (disconnected) {
    notice = `Connect Gamepad ${Number(disconnected.control.slice(3)) + 1} and press a button, or choose another input.`;
    return false;
  }
  if (config.mode !== "ffa" && new Set(seats.map((s) => s.team)).size < 2) {
    notice = "Sun and Moon each need at least one creature.";
    return false;
  }
  return true;
}
function preview() {
  latestDeath = null;
  recentEvents = [];
  state = createMatch(
    { ...config, wins: 99 },
    Array.from({ length: 6 }, (_, i) => ({
      ...makeSeat(i, "bot"),
      bot: "normal" as Difficulty,
    })),
  );
}
function startPractice() {
  practice = true;
  tutorialStep = 0;
  tutorialFlags.clear();
  tutorialOrigin = null;
  startLocal(true);
}
function startLocal(isPractice: boolean) {
  latestDeath = null;
  recentEvents = [];
  practice = isPractice;
  playing = true;
  online = false;
  paused = false;
  screen = "playing";
  config.seed = ++seed;
  state = createMatch(
    isPractice
      ? {
          ...config,
          mode: "ffa",
          wins: 3,
          upgrades: false,
          mapId: ARENAS[0].id,
        }
      : config,
    isPractice
      ? [
          { ...makeSeat(0, "keyboard1"), name: "You", bot: null },
          { ...makeSeat(1, "bot"), name: "Sprout", bot: "easy" },
        ]
      : seats.map(({ control: _control, ready: _ready, ...seat }) => seat),
  );
  input.clear();
  audio.unlock();
  render();
}
function pause() {
  if (!playing) return;
  paused = !online;
  screen = "paused";
  render();
}
function resume() {
  paused = false;
  screen = "playing";
  render();
}
const lessons = [
  [
    "Find your feet",
    "Move around with WASD, the left stick, or the touch stick.",
    "Move a little in any direction.",
  ],
  [
    "Make a little escape",
    "Press Space / South, or tap Dash.",
    "Dash is a burst of movement. Avoid blades along the path.",
  ],
  [
    "Leave a bright arc",
    "Press J / West, or tap Slash.",
    "Slash nearby rivals. Time it to deflect an incoming boomerang.",
  ],
  [
    "Let it fly",
    "Press K / East, or tap Throw.",
    "A tap launches toward the direction you last moved.",
  ],
  [
    "Bend the comeback",
    "Throw, then move sideways just after release.",
    "Your movement curves the first moment of flight.",
  ],
  [
    "Call it home",
    "While the boomerang is away, tap Throw again.",
    "Recall persists until catch. A blocked blade needs a fresh tap.",
  ],
  [
    "Now, a friendly duel",
    "Try your new moves against Sprout.",
    "One hit pops a creature. The next round starts automatically.",
  ],
];
function advanceTutorial(inputs: Input) {
  if (!practice || tutorialStep >= 7) return;
  const p = state.players[0];
  if (!p) return;
  if (!tutorialOrigin) tutorialOrigin = { x: p.x, y: p.y };
  if (
    tutorialStep === 0 &&
    Math.hypot(p.x - tutorialOrigin.x, p.y - tutorialOrigin.y) > 1
  )
    tutorialStep++;
  else if (
    tutorialStep === 1 &&
    state.events.some((e) => e.type === "dash" && e.actor === p.id)
  )
    tutorialStep++;
  else if (
    tutorialStep === 2 &&
    state.events.some((e) => e.type === "slash" && e.actor === p.id)
  )
    tutorialStep++;
  else if (
    tutorialStep === 3 &&
    state.weapons.some((w) => w.ownerId === p.id && w.phase === "outbound")
  )
    tutorialStep++;
  else if (
    tutorialStep === 4 &&
    state.weapons.some(
      (w) =>
        w.ownerId === p.id &&
        w.phase === "outbound" &&
        Math.abs(w.heading - w.launchHeading) > 0.055,
    )
  )
    tutorialStep++;
  else if (
    tutorialStep === 5 &&
    state.events.some((e) => e.type === "recall" && e.actor === p.id)
  )
    tutorialStep++;
  else if (tutorialStep === 6 && state.round > 1) tutorialStep++;
  if (inputs.throw) tutorialFlags.add("throw");
}
function hud(force = false) {
  const now = performance.now();
  if (!force && now - lastHudAt < 90) return;
  lastHudAt = now;
  const scores = root.querySelector("#scores");
  if (!scores) return;
  const key =
    state.players
      .map((p) => `${p.id}:${p.score}:${p.alive}:${p.shield}`)
      .join("|") + state.phase;
  if (key !== lastHud) {
    lastHud = key;
    scores.innerHTML = state.players
      .map(
        (p, i) =>
          `<div class="score-card ${p.alive ? "" : "out"}" style="--seat:${color(p.color)}">${emblem(p.character, p.color)}<div><strong>${esc(p.name)}</strong><span>${p.alive ? (p.shield ? "Shield ready" : online && ownsSeat(p.id) ? "You" : state.config.mode !== "ffa" ? (p.team === 0 ? "Sun" : "Moon") : `P${i + 1}`) : "Popped!"}${p.upgrades.length ? ` · ${p.upgrades.map((id) => UPGRADES.find((u) => u.id === id)?.name || id).join(", ")}` : ""}</span></div><b>${p.score}</b></div>`,
      )
      .join("");
  }
  root.querySelector("#round-label")!.textContent =
    state.config.mode === "relay"
      ? `Starlight relay · ${state.relay.scores[0]} : ${state.relay.scores[1]}`
      : `Round ${state.round} · First to ${state.config.wins}`;
  root.querySelector("#arena-label")!.textContent =
    `${ARENAS.find((a) => a.id === state.config.mapId)?.name || "Garden"}${online ? " · Online party" : practice ? " · Practice" : " · Couch party"}`;
  const overlay = root.querySelector("#phase-overlay")!;
  const overlayKey =
    state.phase +
    ":" +
    Math.ceil((state.phaseUntil - state.tick) / 60) +
    ":" +
    state.round;
  if (overlay.getAttribute("data-state") !== overlayKey) {
    overlay.setAttribute("data-state", overlayKey);
    if (state.phase === "countdown")
      overlay.innerHTML = `<div class="countdown"><span>HERE COMES ROUND ${state.round}</span><strong>${Math.max(1, Math.ceil((state.phaseUntil - state.tick) / 60))}</strong><p>Keep your friends close.<br/>Your boomerang closer.</p></div>`;
    else if (state.phase === "roundResults")
      overlay.innerHTML = `<div class="round-result"><span>GARDEN SETTLED</span><h2>${
        state.winnerIds.length
          ? esc(
              state.players
                .filter((p) => state.winnerIds.includes(p.id))
                .map((p) => p.name)
                .join(" & "),
            ) + " takes it!"
          : "A beautiful tie."
      }</h2><p>One more little comeback…</p></div>`;
    else if (state.phase === "matchResults") {
      const winners = state.players.filter((p) =>
        state.matchWinnerIds.includes(p.id),
      );
      overlay.innerHTML = `<section class="panel results-panel"><p class="eyebrow">A GARDEN WELL PLAYED</p><h1>${winners.length ? esc(winners.map((p) => p.name).join(" & ")) + " wins!" : "What a party."}</h1><div class="result-crew">${[
        ...state.players,
      ]
        .sort((a, b) => b.score - a.score)
        .map(
          (p) =>
            `<div>${emblem(p.character, p.color)}<strong>${esc(p.name)}</strong><span>${p.score} wins · ${p.kills} pops</span></div>`,
        )
        .join(
          "",
        )}</div>${button("One more round?", "rematch", "primary full")}${button("Back to the garden", "exit-match", "text-button full")}<p class="field-help">${online ? "Online party result." : "Local match · scores stay on this device."}</p></section>`;
      overlay
        .querySelectorAll<HTMLElement>("[data-action]")
        .forEach((el) =>
          el.addEventListener("click", () => void action(el.dataset.action!)),
        );
      overlay
        .querySelector<HTMLElement>("button")
        ?.focus({ preventScroll: true });
    } else overlay.innerHTML = "";
  }
  const tutorial = root.querySelector("#tutorial");
  if (tutorial) {
    const lesson = lessons[tutorialStep];
    tutorial.innerHTML = lesson
      ? `<div class="tutorial-top"><span>YOUR FIRST COMEBACK · ${tutorialStep + 1}/7</span>${button("Skip lesson", "skip-tutorial", "text-button")}</div><h2>${lesson[0]}</h2><p>${lesson[1]}</p><small>${lesson[2]}</small><div class="lesson-dots">${lessons.map((_, i) => `<i class="${i <= tutorialStep ? "done" : ""}"></i>`).join("")}</div>`
      : '<span class="eyebrow">✦ NICELY GROWN</span><h2>You’ve found your rhythm.</h2><p>Finish this friendly match, or open the menu for your next party.</p>';
    tutorial
      .querySelector<HTMLElement>("[data-action]")
      ?.addEventListener("click", () => void action("skip-tutorial"));
  }
  const message = root.querySelector("#game-message")!;
  const latest = latestDeath?.round === state.round ? latestDeath.event : null;
  const elapsed = state.tick - state.roundStart;
  message.textContent =
    online && net.info.status === "error"
      ? net.info.message
      : online && net.info.status === "reconnecting"
        ? "Reconnecting… your room is being held."
        : state.config.mode !== "relay" &&
            elapsed >= 2700 &&
            state.phase === "playing"
          ? elapsed < 3600
            ? `Garden closing in ${Math.ceil((3600 - elapsed) / 60)}s · Find the center`
            : "The garden is closing · Stay inside the coral edge"
          : latest &&
              state.tick - latest.tick >= 0 &&
              state.tick - latest.tick < 120
            ? `${state.players.find((p) => p.id === latest.target)?.name || "A creature"} popped${latest.actor ? ` · ${state.players.find((p) => p.id === latest.actor)?.name || "Garden"}${latest.detail ? " · " + latest.detail : ""}` : " · Watch the garden hazards"}`
            : "";
  const touchThrow = root.querySelector(".throw-action span");
  if (touchThrow)
    touchThrow.textContent = state.weapons.some(
      (w) =>
        w.ownerId ===
          (online
            ? net.info.ownedSeatIds[onlineControls.indexOf("keyboard1")]
            : state.players[0]?.id) &&
        w.phase !== "held" &&
        w.phase !== "windup",
    )
      ? "Recall"
      : "Throw";
}
net.onState((next) => {
  state = next;
  recentEvents.push(...next.events);
  if (
    net.info.status === "playing" &&
    (!playing || !online || screen === "onlineLobby" || screen === "online")
  ) {
    playing = true;
    online = true;
    practice = false;
    paused = false;
    screen = "playing";
    render();
  }
});
let lastNetworkUiKey = "";
net.onChange(() => {
  if (net.info.status === "reconnecting") input.clear();
  const key = JSON.stringify({
    status: net.info.status,
    stage: net.info.stage,
    room: net.info.roomId,
    host: net.info.hostId,
    seats: net.info.seats,
    ready: net.info.readyIds,
    message: net.info.message,
    public: net.info.public,
    config: net.info.config,
    owned: net.info.ownedSeatIds,
  });
  if (net.info.status === "error" && online) {
    playing = false;
    paused = false;
    input.clear();
    screen = "online";
    notice = net.info.message;
    if (key !== lastNetworkUiKey) {
      lastNetworkUiKey = key;
      render();
    }
  } else if (net.info.status === "lobby" && net.info.stage === "lobby") {
    if (screen !== "onlineLobby" || key !== lastNetworkUiKey) {
      playing = false;
      paused = false;
      input.clear();
      online = true;
      screen = "onlineLobby";
      lastNetworkUiKey = key;
      render();
    }
  } else if (
    (screen === "online" || screen === "onlineLobby") &&
    key !== lastNetworkUiKey
  ) {
    lastNetworkUiKey = key;
    render();
  }
});

let accumulator = 0,
  last = performance.now(),
  networkAccumulator = 0;
const frameSamples: number[] = [];
function frame(time: number) {
  const rawFrameMs = time - last;
  const delta = Math.min(rawFrameMs / 1000, 0.05);
  last = time;
  gameTime += delta;
  frameSamples.push(rawFrameMs);
  if (frameSamples.length > 600) frameSamples.shift();
  accumulator = Math.min(accumulator + delta, 0.15);
  input.pollGamepads(screen !== "playing" || state.phase === "matchResults");
  if (!paused && !online) {
    while (accumulator >= 1 / 60) {
      const inputs: Record<string, Input> = getBotInputs(state);
      if (playing) {
        if (practice) {
          if (tutorialStep < 6)
            for (const player of state.players)
              if (player.bot)
                inputs[player.id] = {
                  mx: 0,
                  my: 0,
                  ax: 0,
                  ay: 0,
                  dash: false,
                  slash: false,
                  throw: false,
                };
          inputs[state.players[0].id] = input.read("keyboard1");
          advanceTutorial(inputs[state.players[0].id]);
        } else
          for (const s of seats)
            if (!s.bot) inputs[s.id] = input.read(s.control);
      }
      step(state, inputs);
      recentEvents.push(...state.events);
      if (!playing && state.phase === "matchResults")
        state = restartMatch(state);
      accumulator -= 1 / 60;
    }
  } else accumulator = 0;
  if (online && playing) {
    networkAccumulator += delta;
    while (networkAccumulator >= 1 / 60) {
      const commands: Record<string, Input> = {};
      net.info.ownedSeatIds.forEach((id, index) => {
        const control = onlineControls[index];
        if (control) commands[id] = input.read(control);
      });
      net.send(commands);
      networkAccumulator -= 1 / 60;
    }
  }
  for (const event of recentEvents)
    if (event.type === "death") latestDeath = { event, round: state.round };
  renderer.draw(
    state,
    delta,
    (type) => {
      if (playing) audio.cue(type);
    },
    recentEvents,
  );
  recentEvents = [];
  audio.tick();
  if (playing) hud();
  requestAnimationFrame(frame);
}
if (import.meta.env.DEV) {
  Object.defineProperty(window, "__BOOMERANGAVOID__", {
    configurable: false,
    get: () => {
      const sorted = [...frameSamples].sort((a, b) => a - b);
      const sampleDurationMs = frameSamples.reduce((sum, ms) => sum + ms, 0);
      const estimatedMissedFrames = Math.max(
        0,
        Math.round(sampleDurationMs / (1000 / 60) - frameSamples.length),
      );
      return Object.freeze({
        ready: true,
        screen,
        playing,
        online,
        network: structuredClone(net.info),
        paused,
        tutorialStep,
        state: structuredClone(state),
        hash: stateHash(state),
        controls: online
          ? net.info.ownedSeatIds.map((id, index) => ({
              id,
              control: onlineControls[index] || null,
            }))
          : seats.map((s) => ({ id: s.id, control: s.control })),
        metrics: {
          ...renderer.metrics,
          frameMs: frameSamples[frameSamples.length-1] || 0,
          medianFrameMs: sorted[Math.floor(sorted.length * 0.5)] || 0,
          p95FrameMs: sorted[Math.floor(sorted.length * 0.95)] || 0,
          sampleCount: sorted.length,
          deliveredFrames: renderer.metrics.frames,
          sampleDeliveredFrames: frameSamples.length,
          sampleDurationMs,
          estimatedMissedFrames,
          missedFrameFraction:
            estimatedMissedFrames /
            (frameSamples.length + estimatedMissedFrames || 1),
          longFrameFraction:
            frameSamples.filter((ms) => ms > 25).length /
            (frameSamples.length || 1),
        },
        elapsed: gameTime,
      });
    },
  });
}
const invite = new URL(location.href).searchParams.get("room");
if (invite) {
  screen = "online";
  notice = `Invite for room ${invite}. Choose the players on this screen, then Join room.`;
  render();
  root.querySelector<HTMLInputElement>("#room-code")!.value = invite;
} else render();
requestAnimationFrame(frame);
