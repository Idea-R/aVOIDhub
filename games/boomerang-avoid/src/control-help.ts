import { keyLabel, type Preferences, type Control } from "./input";
import type { Difficulty, Mode } from "@avoid/boomerangavoid-sim";

export type HelpControl = Exclude<Control, "bot"> | "touch";
export const padButtonLabel = (index: number) =>
  [
    "South",
    "East",
    "West",
    "North",
    "L1",
    "R1",
    "L2",
    "R2",
    "View",
    "Menu",
    "L stick",
    "R stick",
    "D-pad up",
    "D-pad down",
    "D-pad left",
    "D-pad right",
  ][index] || `Button ${index}`;
export const helpControlName = (control: HelpControl) =>
  control === "touch"
    ? "Touch"
    : control === "keyboard1"
      ? "Keyboard 1"
      : control === "keyboard2"
        ? "Keyboard 2"
        : `Gamepad ${Number(control.slice(3)) + 1}`;

export function selectedHelpControl(
  explicit: HelpControl | null,
  active: HelpControl,
  choices: readonly HelpControl[],
): HelpControl {
  if (explicit && choices.includes(explicit)) return explicit;
  return choices.includes(active) ? active : choices[0] || "keyboard1";
}

/** Only inputs that actually drive a local seat may take over gameplay hints. */
export function activeHelpControl(
  last: Control,
  assigned: readonly Control[],
  touchEnabled: boolean,
  touchLast: boolean,
): HelpControl {
  const allowed = assigned.filter(
    (c): c is Exclude<Control, "bot"> => c !== "bot",
  );
  const control = allowed.includes(last as Exclude<Control, "bot">)
    ? last
    : allowed[0] || "keyboard1";
  return control === "keyboard1" && touchEnabled && touchLast
    ? "touch"
    : (control as HelpControl);
}
export function controlHelp(prefs: Preferences, control: HelpControl) {
  const touch = control === "touch",
    pad = control.startsWith("pad");
  const binding = prefs.bindings[control === "keyboard2" ? 1 : 0];
  const move = touch
    ? "Touch stick"
    : pad
      ? "Left stick"
      : [binding.up, binding.left, binding.down, binding.right]
          .map(keyLabel)
          .join(" / ");
  const action = (name: "dash" | "slash" | "throw") =>
    touch
      ? name === "throw"
        ? "Throw"
        : name[0].toUpperCase() + name.slice(1)
      : pad
        ? padButtonLabel(prefs.gamepadButtons[name])
        : keyLabel(binding[name]);
  const press = (name: "dash" | "slash" | "throw") =>
    `${touch ? "Tap" : "Press"} ${action(name)}`;
  return {
    control,
    name: helpControlName(control),
    move,
    dash: action("dash"),
    slash: action("slash"),
    throw: action("throw"),
    menu: touch ? "Menu" : pad ? "Menu" : "Escape",
    aim: pad
      ? "Right stick aims separately."
      : "Your last movement sets your aim.",
    movePrompt: touch ? "Drag the touch stick." : `Move with ${move}.`,
    press,
  };
}
export function practiceLessons(help: ReturnType<typeof controlHelp>) {
  return [
    ["Find your feet", help.movePrompt, "Move a little in any direction."],
    [
      "Make a little escape",
      `${help.press("dash")} to dash.`,
      "Avoid blades along the path.",
    ],
    [
      "Leave a bright arc",
      `${help.press("slash")} to slash.`,
      "Strike nearby rivals or time a deflection.",
    ],
    ["Let it fly", `${help.press("throw")} to throw.`, help.aim],
    [
      "Bend the comeback",
      `${help.press("throw")}, then move sideways just after release.`,
      "Your movement curves the first moment of flight.",
    ],
    [
      "Call it home",
      `${help.press("throw")} again while your boomerang is away.`,
      "Recall lasts until catch. A blocked blade needs a fresh press.",
    ],
    [
      "Now, a friendly duel",
      "Try your new moves against Sprout.",
      "Avoid a blade, land a hit. The next round starts automatically.",
    ],
  ];
}
export const difficultyLabel = (value: Difficulty) =>
  value[0].toUpperCase() + value.slice(1);
export const DIFFICULTY_HELP: Record<Difficulty, string> = {
  easy: "More time to react; simple attacks.",
  normal: "Steady pressure with defensive moves.",
  hard: "Quicker decisions and more precise aim.",
};
export const targetText = (mode: Mode, wins: number) =>
  mode === "relay"
    ? "3 deliveries"
    : `${wins} round ${wins === 1 ? "win" : "wins"}`;
export const modeGoal = (mode: Mode, wins: number) =>
  mode === "relay"
    ? "Carry the star seed to the glowing circle. Hold it there, then deliver to the other side. First team to 3 deliveries wins. Enemies can contest the circle."
    : mode === "teams"
      ? `The last team standing wins the round. First team to ${wins} round wins takes the match.`
      : `The last creature standing wins the round. First to ${wins} round wins takes the match.`;
