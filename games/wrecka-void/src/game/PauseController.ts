export type PauseReason = "manual" | "focus" | "help" | "exit" | "viewport";

export class PauseController {
  private reasons = new Set<PauseReason>();

  set(reason: PauseReason, active: boolean): boolean {
    if (active) {
      this.reasons.add(reason);
    } else {
      this.reasons.delete(reason);
    }
    return this.isPaused();
  }

  toggleManual(): boolean {
    return this.set("manual", !this.reasons.has("manual"));
  }

  reset(): void {
    this.reasons.clear();
  }

  isPaused(): boolean {
    return this.reasons.size > 0;
  }

  activeReasons(): PauseReason[] {
    return [...this.reasons];
  }
}
