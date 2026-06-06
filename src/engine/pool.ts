// Object pooling to avoid GC churn from spawning thousands of projectiles,
// enemies, particles, gems and damage numbers per run.
//
// Two flavours:
//  - Pool<T>: generic free-list of reusable objects (acquire/release).
//  - SwapPool<T>: a dense, iteration-friendly active array with O(1) removal via
//    swap-remove, backed by a free-list. Ideal for entities you must iterate every
//    frame and remove in arbitrary order.

export class Pool<T> {
  private free: T[] = []
  private create: () => T
  private resetFn: ((obj: T) => void) | undefined

  constructor(create: () => T, reset?: (obj: T) => void, prefill = 0) {
    this.create = create
    this.resetFn = reset
    for (let i = 0; i < prefill; i++) this.free.push(create())
  }

  acquire(): T {
    return this.free.pop() ?? this.create()
  }

  release(obj: T): void {
    if (this.resetFn) this.resetFn(obj)
    this.free.push(obj)
  }
}

/**
 * Dense active list with pooled storage. Entities carry an `alive` flag; iterate
 * `items` up to `count`. Use `spawn()` to get a recycled entity and `kill(i)` to
 * remove the entity at index i (swap-remove keeps the array dense).
 */
export class SwapPool<T extends { alive: boolean }> {
  items: T[] = []
  count = 0
  private create: () => T
  private resetFn: ((obj: T) => void) | undefined

  constructor(create: () => T, reset?: (obj: T) => void, prefill = 0) {
    this.create = create
    this.resetFn = reset
    for (let i = 0; i < prefill; i++) this.items.push(create())
  }

  /** Activate and return the next entity (grows the backing array if needed). */
  spawn(): T {
    let obj: T
    if (this.count < this.items.length) {
      obj = this.items[this.count]
    } else {
      obj = this.create()
      this.items.push(obj)
    }
    if (this.resetFn) this.resetFn(obj)
    obj.alive = true
    this.count++
    return obj
  }

  /** Remove the entity at active index i via swap with the last active entity. */
  kill(i: number): void {
    const last = this.count - 1
    const dead = this.items[i]
    dead.alive = false
    if (i !== last) {
      this.items[i] = this.items[last]
      this.items[last] = dead
    }
    this.count--
  }

  /** Compact pass: remove all entities whose `alive` became false during update. */
  sweep(): void {
    let i = 0
    while (i < this.count) {
      if (!this.items[i].alive) {
        this.kill(i)
      } else {
        i++
      }
    }
  }

  clear(): void {
    for (let i = 0; i < this.count; i++) this.items[i].alive = false
    this.count = 0
  }
}
