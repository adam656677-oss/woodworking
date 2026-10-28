/** Undo/redo stack of immutable states. Keeps at most `cap` steps (the oldest drop off). */
export class History<T> {
  private past: T[] = []
  private future: T[] = []
  private now: T

  constructor(initial: T, private cap = 200) {
    this.now = initial
  }

  get current(): T {
    return this.now
  }
  get canUndo(): boolean {
    return this.past.length > 0
  }
  get canRedo(): boolean {
    return this.future.length > 0
  }

  push(next: T): void {
    this.past.push(this.now)
    if (this.past.length > this.cap) this.past.shift()
    this.now = next
    this.future = []
  }

  undo(): T {
    const prev = this.past.pop()
    if (prev !== undefined) {
      this.future.push(this.now)
      this.now = prev
    }
    return this.now
  }

  redo(): T {
    const next = this.future.pop()
    if (next !== undefined) {
      this.past.push(this.now)
      this.now = next
    }
    return this.now
  }

  /** Replace everything (for opening a different project). */
  reset(state: T): void {
    this.past = []
    this.future = []
    this.now = state
  }
}
