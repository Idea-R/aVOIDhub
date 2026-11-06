import { test } from "node:test";
import assert from "node:assert/strict";
import { DEFAULT_BINDINGS, type Preferences } from "../src/input";
import {
  controlHelp,
  practiceLessons,
  activeHelpControl,
  selectedHelpControl,
  padButtonLabel,
  targetText,
  modeGoal,
  DIFFICULTY_HELP,
} from "../src/control-help";
const prefs: Preferences = {
  music: 0,
  sfx: 0,
  reducedMotion: false,
  touch: false,
  character: "pip",
  quality: "low",
  bindings: DEFAULT_BINDINGS.map((b) => ({ ...b })),
  gamepadButtons: { dash: 4, slash: 5, throw: 7 },
};
test("all keyboard practice action prompts follow the selected remapped bindings without mutating preferences", () => {
  const remapped = {
    ...prefs,
    bindings: prefs.bindings.map((b) => ({ ...b })),
  };
  Object.assign(remapped.bindings[0], {
    dash: "KeyQ",
    slash: "KeyF",
    throw: "KeyR",
  });
  const original = structuredClone(remapped);
  const help = controlHelp(remapped, "keyboard1"),
    lessons = practiceLessons(help);
  assert.match(lessons[1][1], /Press Q/);
  assert.match(lessons[2][1], /Press F/);
  assert.match(lessons[3][1], /Press R/);
  assert.match(lessons[4][1], /Press R/);
  assert.match(lessons[5][1], /Press R again/);
  assert.equal(lessons.length, 7);
  assert.deepEqual(remapped, original);
  assert.equal(controlHelp(remapped, "keyboard2").dash, "Enter");
});
test("guide selection and content agree after a previously chosen input leaves the available crew", () => {
  assert.equal(
    selectedHelpControl("pad1", "keyboard1", ["keyboard1", "pad0"]),
    "keyboard1",
  );
  assert.equal(
    selectedHelpControl("touch", "keyboard2", ["keyboard2", "pad0"]),
    "keyboard2",
  );
  assert.equal(
    selectedHelpControl("pad0", "keyboard2", ["keyboard2", "pad0"]),
    "pad0",
  );
  assert.equal(selectedHelpControl(null, "touch", ["keyboard2"]), "keyboard2");
});
test("remapped pads use positional names and touch never offers unavailable keyboard actions", () => {
  const pad = controlHelp(prefs, "pad1");
  assert.equal(pad.name, "Gamepad 2");
  assert.equal(pad.dash, "L1");
  assert.equal(pad.slash, "R1");
  assert.equal(pad.throw, "R2");
  assert.match(pad.aim, /Right stick/);
  assert.equal(pad.menu, "Menu");
  const touch = controlHelp(prefs, "touch"),
    lessons = practiceLessons(touch);
  assert.equal(touch.move, "Touch stick");
  assert.match(lessons[1][1], /Tap Dash/);
  assert.match(lessons[3][1], /Tap Throw/);
  assert.doesNotMatch(JSON.stringify(lessons), /Space|WASD|South|Press/);
  assert.equal(padButtonLabel(14), "D-pad left");
});
test("unassigned keyboards/pads cannot replace actual local or online mixed-seat control hints", () => {
  assert.equal(
    activeHelpControl("pad1", ["keyboard1", "pad0"], false, false),
    "keyboard1",
  );
  assert.equal(
    activeHelpControl("keyboard2", ["keyboard1", "pad0"], false, false),
    "keyboard1",
  );
  assert.equal(
    activeHelpControl("keyboard2", ["keyboard1", "keyboard2"], false, false),
    "keyboard2",
  );
  assert.equal(
    activeHelpControl("pad0", ["keyboard2", "pad0"], false, false),
    "pad0",
  );
  assert.equal(
    activeHelpControl("keyboard1", ["keyboard2", "pad0"], true, true),
    "keyboard2",
  );
  assert.equal(
    activeHelpControl("keyboard1", ["keyboard1", "pad0"], true, true),
    "touch",
  );
  assert.equal(activeHelpControl("pad0", ["bot", "pad0"], true, true), "pad0");
});
test("Relay guidance remains fixed at three deliveries independently of the elimination wins setting", () => {
  assert.equal(targetText("relay", 7), "3 deliveries");
  assert.equal(targetText("ffa", 7), "7 round wins");
  assert.equal(targetText("teams", 1), "1 round win");
  assert.match(modeGoal("relay", 7), /3 deliveries/);
  assert.doesNotMatch(modeGoal("relay", 7), /7|round wins/);
  assert.equal(Object.keys(DIFFICULTY_HELP).length, 3);
  assert.doesNotMatch(
    Object.values(DIFFICULTY_HELP).join(" "),
    /\d|always|never/,
  );
});
