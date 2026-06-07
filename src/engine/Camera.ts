// Follow camera with trauma-based screen shake. Position is updated in the fixed
// sim step (CameraSystem); the renderer reads an interpolated position so motion
// stays smooth on high-refresh displays.
import { clamp, lerp } from './math'
import { C } from '../data/balance'
import { rng } from './rng'

export class Camera {
  x = 0
  y = 0
  prevX = 0
  prevY = 0
  /** 0..1 shake energy; offset scales with trauma^2. */
  trauma = 0

  /** Snap the camera to a position with no interpolation (run start). */
  setImmediate(x: number, y: number): void {
    this.x = x
    this.y = y
    this.prevX = x
    this.prevY = y
  }

  snapshotPrev(): void {
    this.prevX = this.x
    this.prevY = this.y
  }

  addTrauma(amount: number): void {
    this.trauma = clamp(this.trauma + amount, 0, 1)
  }

  decay(dt: number): void {
    this.trauma = Math.max(0, this.trauma - C.SHAKE_DECAY * dt)
  }

  /** Interpolated render position for this frame. */
  renderX(alpha: number): number {
    return lerp(this.prevX, this.x, alpha)
  }
  renderY(alpha: number): number {
    return lerp(this.prevY, this.y, alpha)
  }

  /** Current shake offset in screen pixels (cosmetic; uses global rng). */
  shakeX(): number {
    const s = this.trauma * this.trauma
    return (rng.next() * 2 - 1) * s * C.SHAKE_MAX
  }
  shakeY(): number {
    const s = this.trauma * this.trauma
    return (rng.next() * 2 - 1) * s * C.SHAKE_MAX
  }
}
