// Deterministic, fast PRNG (mulberry32). A seeded RNG lets us reproduce runs
// (useful for debugging balance) and gives us cheap randomness without Math.random.

export class RNG {
  private state: number

  constructor(seed: number = (Date.now() ^ 0x9e3779b9) >>> 0) {
    this.state = seed >>> 0
  }

  /** Re-seed in place. */
  seed(seed: number): void {
    this.state = seed >>> 0
  }

  /** Float in [0, 1). */
  next(): number {
    this.state |= 0
    this.state = (this.state + 0x6d2b79f5) | 0
    let t = Math.imul(this.state ^ (this.state >>> 15), 1 | this.state)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }

  /** Float in [min, max). */
  range(min: number, max: number): number {
    return min + this.next() * (max - min)
  }

  /** Integer in [min, max] inclusive. */
  int(min: number, max: number): number {
    return Math.floor(this.range(min, max + 1))
  }

  /** True with probability p (0..1). */
  chance(p: number): boolean {
    return this.next() < p
  }

  /** Random element of an array. */
  pick<T>(arr: readonly T[]): T {
    return arr[Math.floor(this.next() * arr.length)]
  }

  /** Random point on a unit circle, written into out. */
  onCircle(out: { x: number; y: number }): void {
    const a = this.next() * Math.PI * 2
    out.x = Math.cos(a)
    out.y = Math.sin(a)
  }

  /** Weighted pick: returns index given an array of weights. */
  weightedIndex(weights: readonly number[]): number {
    let total = 0
    for (let i = 0; i < weights.length; i++) total += weights[i]
    let r = this.next() * total
    for (let i = 0; i < weights.length; i++) {
      r -= weights[i]
      if (r <= 0) return i
    }
    return weights.length - 1
  }
}

/** Shared global RNG instance for non-deterministic cosmetic randomness. */
export const rng = new RNG()
