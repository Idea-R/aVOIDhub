export class RunCompletionGate {
  private finished = false;

  reset(): void {
    this.finished = false;
  }

  shouldFinish(isGameOver: boolean): boolean {
    if (!isGameOver || this.finished) return false;
    this.finished = true;
    return true;
  }
}
