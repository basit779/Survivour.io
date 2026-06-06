// Lightweight math helpers used hot-path across the game. Keep allocation-free.

export const TAU = Math.PI * 2

export function clamp(v: number, min: number, max: number): number {
  return v < min ? min : v > max ? max : v
}

export function lerp(a: number, b: number, t: number): number {
  return a + (b - a) * t
}

/** Frame-rate independent exponential smoothing. `rate` ~ how fast (per second). */
export function damp(a: number, b: number, rate: number, dt: number): number {
  return lerp(a, b, 1 - Math.exp(-rate * dt))
}

export function sign(v: number): number {
  return v < 0 ? -1 : v > 0 ? 1 : 0
}

export function dist2(ax: number, ay: number, bx: number, by: number): number {
  const dx = bx - ax
  const dy = by - ay
  return dx * dx + dy * dy
}

export function dist(ax: number, ay: number, bx: number, by: number): number {
  return Math.sqrt(dist2(ax, ay, bx, by))
}

export function len(x: number, y: number): number {
  return Math.sqrt(x * x + y * y)
}

/** Returns angle in radians of vector (x,y). */
export function angle(x: number, y: number): number {
  return Math.atan2(y, x)
}

export function angleBetween(ax: number, ay: number, bx: number, by: number): number {
  return Math.atan2(by - ay, bx - ax)
}

/** Smallest signed difference between two angles, in (-PI, PI]. */
export function angleDelta(from: number, to: number): number {
  let d = (to - from) % TAU
  if (d > Math.PI) d -= TAU
  if (d < -Math.PI) d += TAU
  return d
}

export function approach(current: number, target: number, maxDelta: number): number {
  if (current < target) return Math.min(current + maxDelta, target)
  if (current > target) return Math.max(current - maxDelta, target)
  return current
}

/** 0..1 eased curves. */
export function easeOutCubic(t: number): number {
  const u = 1 - t
  return 1 - u * u * u
}

export function easeOutBack(t: number): number {
  const c1 = 1.70158
  const c3 = c1 + 1
  const u = t - 1
  return 1 + c3 * u * u * u + c1 * u * u
}

export function easeInOutQuad(t: number): number {
  return t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2
}

/** Reusable scratch vector to avoid allocations in hot loops. */
export const scratch = { x: 0, y: 0 }

/** Normalize (x,y) into `out`, returning length. Safe when length is 0. */
export function normalizeInto(x: number, y: number, out: { x: number; y: number }): number {
  const l = Math.sqrt(x * x + y * y)
  if (l < 1e-6) {
    out.x = 0
    out.y = 0
    return 0
  }
  out.x = x / l
  out.y = y / l
  return l
}
