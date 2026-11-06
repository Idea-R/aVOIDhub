/** Pure browser-pad adapters. Unknown layouts retain the common axes 0/1, 2/3 fallback. */
export interface PadSample {
  id: string;
  index: number;
  connected?: boolean;
  mapping: string;
  axes: readonly number[];
  buttons: readonly { pressed?: boolean; value?: number }[];
}

export function radialStick(x = 0, y = 0, deadzone = 0.18) {
  deadzone=Number.isFinite(deadzone)?Math.max(.05,Math.min(.45,deadzone)):.18;
  const finite = (n: number) =>
    Number.isFinite(n) ? Math.max(-1, Math.min(1, n)) : 0;
  x = finite(x);
  y = finite(y);
  const length = Math.hypot(x, y);
  if (length <= deadzone) return { x: 0, y: 0 };
  const magnitude = (Math.min(1, length) - deadzone) / (1 - deadzone);
  return { x: (x / length) * magnitude, y: (y / length) * magnitude };
}

export function pressedButtons(pad: PadSample): boolean[] {
  return pad.buttons.map(
    (b) => b.pressed === true || (Number.isFinite(b.value) && b.value! > 0.5),
  );
}

export function padAxes(pad: PadSample,deadzone=.18) {
  if (pad.connected === false) return { mx: 0, my: 0, ax: 0, ay: 0 };
  const buttons = pressedButtons(pad);
  let move = radialStick(pad.axes[0], pad.axes[1],deadzone);
  // Browser-standard D-pad supplies a useful fallback for digital-only controllers.
  if (!move.x && !move.y) {
    move = radialStick(
      Number(!!buttons[15]) - Number(!!buttons[14]),
      Number(!!buttons[13]) - Number(!!buttons[12]),
    );
  }
  // Unmapped Sony USB/Bluetooth pads expose right Y at axis 5; axes 3/4 are triggers.
  // Do not treat resting trigger axes as aim. Standard-mapped devices always use 2/3.
  const sony =
    pad.mapping !== "standard" &&
    pad.axes.length >= 6 &&
    /054c|sony|dualshock|dualsense|wireless controller/i.test(pad.id);
  const aim = radialStick(pad.axes[2], pad.axes[sony ? 5 : 3],deadzone);
  return { mx: move.x, my: move.y, ax: aim.x, ay: aim.y };
}

/** Some embedded browsers expose getGamepads but throw until permission/focus is available. */
export function connectedPads(
  read: (() => ArrayLike<PadSample | null>) | undefined,
): PadSample[] {
  try {
    return Array.from(read?.() ?? []).filter(
      (pad): pad is PadSample => !!pad && pad.connected !== false,
    );
  } catch {
    return [];
  }
}
