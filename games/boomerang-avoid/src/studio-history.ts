import { copy, parseDraft, type StudioDraft } from "./studio-contract";

/** Only complete, validated snapshots enter history or become saveable drafts. */
export class StudioHistory {
  private current: StudioDraft;
  private past: StudioDraft[] = [];
  private future: StudioDraft[] = [];

  constructor(initial: unknown) {
    this.current = parseDraft(initial);
  }

  read(): StudioDraft {
    return copy(this.current);
  }

  get canUndo(): boolean { return this.past.length > 0; }
  get canRedo(): boolean { return this.future.length > 0; }

  replace(candidate: unknown): void {
    // Validate before touching current, past or future. A rejected edit must
    // neither discard redo nor add a broken snapshot that Undo could restore.
    const next = parseDraft(candidate);
    if (JSON.stringify(next) === JSON.stringify(this.current)) return;
    this.past.push(this.current);
    if (this.past.length > 40) this.past.shift();
    this.current = next;
    this.future = [];
  }

  undo(): StudioDraft {
    const previous = this.past.pop();
    if (previous) {
      this.future.push(this.current);
      this.current = previous;
    }
    return this.read();
  }

  redo(): StudioDraft {
    const next = this.future.pop();
    if (next) {
      this.past.push(this.current);
      this.current = next;
    }
    return this.read();
  }
}
