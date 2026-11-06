import { NEUTRAL, type Input } from '@avoid/boomerangavoid-sim';

/** Connection-local recovery gate. A neutral sample and a resume sample are distinct. */
export class InputSession {
  private suspended = false;
  private neutralSeen = false;
  private ownedKey: string | null = null;

  get paused(): boolean {
    return this.suspended;
  }

  suspend(): void {
    this.suspended = true;
    this.neutralSeen = false;
    this.ownedKey = null;
  }

  map(
    inputs: Readonly<Record<string, Input>>,
    ownedIds: readonly string[],
  ): Record<string, Input> {
    const ids = [...new Set(ownedIds)];
    const entries = ids.map((id): [string, Input] => {
      const value = Object.hasOwn(inputs, id) ? inputs[id] : undefined;
      return [
        id,
        value
          ? {
              mx: value.mx,
              my: value.my,
              ax: value.ax,
              ay: value.ay,
              dash: value.dash,
              slash: value.slash,
              throw: value.throw,
            }
          : { ...NEUTRAL },
      ];
    });
    if (!this.suspended) return Object.fromEntries(entries);

    // A missing welcome/seat list must not count as releasing a newly restored party.
    if (!ids.length) return {};
    const key = JSON.stringify([...ids].sort());
    if (key !== this.ownedKey) {
      this.ownedKey = key;
      this.neutralSeen = false;
    }
    const active = entries.some(
      ([, value]) =>
        !!(value.mx || value.my || value.dash || value.slash || value.throw),
    );
    if (!active) {
      this.neutralSeen = true;
    } else if (this.neutralSeen) {
      this.suspended = false;
      this.neutralSeen = false;
      return Object.fromEntries(entries);
    }
    // Suppress aim too: every packet emitted while paused is fully neutral.
    return Object.fromEntries(ids.map((id) => [id, { ...NEUTRAL }]));
  }
}
