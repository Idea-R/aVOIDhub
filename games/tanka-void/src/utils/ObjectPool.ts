export class ObjectPool<T> {
  private available: T[] = [];
  private inUse: Set<T> = new Set();

  constructor(
    private createFn: () => T,
    private resetFn: (obj: T) => void,
    initialSize: number = 50
  ) {
    for (let i = 0; i < initialSize; i++) {
      this.available.push(this.createFn());
    }
  }

  get(): T {
    let obj = this.available.pop();
    if (!obj) {
      obj = this.createFn();
    }
    this.inUse.add(obj);
    return obj;
  }

  release(obj: T): void {
    if (this.inUse.has(obj)) {
      this.inUse.delete(obj);
      this.resetFn(obj);
      this.available.push(obj);
    }
  }

  getActiveCount(): number {
    return this.inUse.size;
  }

  getTotalCount(): number {
    return this.inUse.size + this.available.length;
  }
}