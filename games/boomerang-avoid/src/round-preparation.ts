import type { MatchState } from '@avoid/boomerangavoid-sim';

export type PrepareRound = (state: MatchState, signal: AbortSignal) => Promise<void>;

/** One round at a time, two bounded attempts, and no late acknowledgement after cancellation. */
export class RoundPreparation {
  private current: { key: string; controller: AbortController } | null = null;
  constructor(private readonly timeoutMs = 6000) {}

  cancel(): void {
    this.current?.controller.abort();
    this.current = null;
  }

  start(key: string, state: MatchState, hooks: readonly PrepareRound[], ready: () => void, failed: (error: Error) => void): void {
    if (this.current?.key === key) return;
    this.cancel();
    const current = { key, controller: new AbortController() };
    this.current = current;
    void (async () => {
      for (let attempt = 0; attempt < 2 && this.current === current; attempt++) {
        const controller = new AbortController();
        const abort = () => controller.abort();
        current.controller.signal.addEventListener('abort', abort, { once: true });
        let timer: ReturnType<typeof setTimeout> | undefined;
        try {
          await Promise.race([
            Promise.all(hooks.map(hook => Promise.resolve().then(() => hook(structuredClone(state), controller.signal)))),
            new Promise<never>((_, reject) => {
              const onAbort = () => reject(new Error('Preparation cancelled.'));
              controller.signal.addEventListener('abort', onAbort, { once: true });
              timer = setTimeout(() => { reject(new Error('Arena assets did not finish loading.')); controller.abort(); }, this.timeoutMs);
            }),
          ]);
          if (this.current === current && !controller.signal.aborted) ready();
          return;
        } catch (error) {
          if (this.current !== current || current.controller.signal.aborted) return;
          if (attempt === 1) failed(error instanceof Error ? error : new Error('Arena assets could not load.'));
        } finally {
          if (timer) clearTimeout(timer);
          controller.abort();
          current.controller.signal.removeEventListener('abort', abort);
        }
      }
    })();
  }
}
