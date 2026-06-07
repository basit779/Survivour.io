// Shared target acquisition (used by weapons + homing projectiles).
import type { World } from '../World'
import type { Enemy } from '../entities'

/** Nearest live enemy to (x,y) within maxRange, or null. */
export function findNearest(world: World, x: number, y: number, maxRange: number): Enemy | null {
  const en = world.enemies
  let best = -1
  let bestD2 = maxRange * maxRange
  for (let i = 0; i < en.count; i++) {
    const e = en.items[i]
    if (e.hp <= 0) continue
    const dx = e.x - x
    const dy = e.y - y
    const d2 = dx * dx + dy * dy
    if (d2 < bestD2) {
      bestD2 = d2
      best = i
    }
  }
  return best >= 0 ? en.items[best] : null
}

/**
 * Collect up to `n` nearest live enemies into `out` (cleared first). Simple
 * partial selection — fine for small n (chain lightning targets).
 */
export function findNearestN(world: World, x: number, y: number, maxRange: number, n: number, out: Enemy[]): void {
  out.length = 0
  const en = world.enemies
  const maxD2 = maxRange * maxRange
  for (let i = 0; i < en.count; i++) {
    const e = en.items[i]
    if (e.hp <= 0) continue
    const dx = e.x - x
    const dy = e.y - y
    const d2 = dx * dx + dy * dy
    if (d2 > maxD2) continue
    // insertion into the small out[] keeping it sorted by distance, capped at n
    if (out.length < n) {
      out.push(e)
      sortByDist(out, x, y)
    } else {
      const last = out[out.length - 1]
      if (d2 < distSq(last, x, y)) {
        out[out.length - 1] = e
        sortByDist(out, x, y)
      }
    }
  }
}

function distSq(e: Enemy, x: number, y: number): number {
  const dx = e.x - x
  const dy = e.y - y
  return dx * dx + dy * dy
}

function sortByDist(arr: Enemy[], x: number, y: number): void {
  arr.sort((a, b) => distSq(a, x, y) - distSq(b, x, y))
}
